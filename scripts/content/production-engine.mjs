import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import {
  allChecks,
  errors,
  importReviewed,
  loadContent,
  loadLegacy,
  normalize,
  root,
} from "./lib.mjs";

const content = path.join(root, "content");
const reports = path.join(content, "reports", "production");
const backups = path.join(content, "backups");
const today = new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
};
const text = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${value.trim()}\n`);
};
const files = (folder) =>
  fs.existsSync(folder)
    ? fs
        .readdirSync(folder, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? files(path.join(folder, entry.name))
            : entry.name.endsWith(".json")
              ? [path.join(folder, entry.name)]
              : [],
        )
    : [];
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const run = (command, args = []) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout.trim();
};
const packId = (number) => `pack.${String(number).padStart(3, "0")}`;
let packMembership;
const memberships = () => {
  if (packMembership) return packMembership;
  packMembership = new Map();
  const file = path.join(content, "packs/packs-001-003.json");
  if (fs.existsSync(file))
    read(file).forEach((pack) =>
      (pack.related_knowledge_entries || []).forEach((id) => {
        if (!packMembership.has(id)) packMembership.set(id, []);
        packMembership.get(id).push(pack.id);
      }),
    );
  return packMembership;
};
const recordPack = (item) => {
  const linked = memberships().get(item.record?.id);
  if (linked?.length) return linked.at(-1);
  const match = item.file.match(/pack-(\d{3})/);
  return match ? packId(Number(match[1])) : null;
};
const belongsToPack = (item, id) =>
  memberships().get(item.record?.id)?.includes(id) || recordPack(item) === id;

function validators() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  return Object.fromEntries(
    ["content-job", "content-queue", "source-research", "content-review"].map(
      (name) => [name, ajv.compile(read(`schemas/${name}.schema.json`))],
    ),
  );
}

export function jobFiles() {
  return files(path.join(content, "jobs"));
}

export function validateJobs() {
  const validate = validators()["content-job"],
    seen = new Set(),
    issues = [];
  for (const file of jobFiles()) {
    const job = read(file);
    if (!validate(job))
      issues.push(
        ...(validate.errors || []).map(
          (error) => `${relative(file)}${error.instancePath}: ${error.message}`,
        ),
      );
    if (seen.has(job.job_id))
      issues.push(`${relative(file)}: duplicate job id ${job.job_id}`);
    seen.add(job.job_id);
    const folder = path.basename(path.dirname(file));
    const allowed = {
      planned: ["planned"],
      active: ["researching", "drafting", "validating"],
      review: ["awaiting-review", "approved"],
      completed: ["imported", "published"],
      blocked: ["blocked"],
      rejected: ["rejected"],
    }[folder];
    if (allowed && !allowed.includes(job.status))
      issues.push(
        `${relative(file)}: status ${job.status} does not belong in ${folder}`,
      );
  }
  return { count: jobFiles().length, issues };
}

export function queue() {
  const roadmap = read(
    path.join(content, "roadmaps/master-content-roadmap.json"),
  );
  const { records } = loadContent();
  const checks = allChecks(records);
  const jobs = jobFiles().map(read);
  const chapters = read(path.join(content, "handbooks/investor/chapters.json"));
  const packs = roadmap.packs.map((definition) => {
    const id = packId(definition.pack_number);
    const owned = records.filter((item) => belongsToPack(item, id));
    const reviewed = owned.filter((item) => item.statusFolder === "reviewed");
    const drafts = owned.filter((item) => item.statusFolder === "drafts");
    const rejected = owned.filter((item) => item.statusFolder === "rejected");
    const issues = checks.filter((issue) =>
      owned.some((item) => item.file === issue.file),
    );
    const handbookLinks = new Set(
      chapters.flatMap((chapter) => chapter.related_knowledge_entries || []),
    );
    const status =
      reviewed.length >= definition.planned_entry_count
        ? "complete"
        : jobs.find((job) => job.target_pack === id)?.status ||
          definition.status;
    return {
      pack_id: id,
      pack_number: definition.pack_number,
      title: definition.title,
      status,
      target_entry_count: definition.planned_entry_count,
      reviewed_entry_count: reviewed.length,
      draft_entry_count: drafts.length,
      duplicate_count: issues.filter((item) =>
        item.code?.startsWith("duplicate"),
      ).length,
      missing_source_count: reviewed.filter(
        (item) => !item.record.sources?.length,
      ).length,
      broken_reference_count: issues.filter(
        (item) => item.code === "broken_related_concept",
      ).length,
      handbook_coverage: reviewed.length
        ? Number(
            (
              (100 *
                reviewed.filter((item) => handbookLinks.has(item.record.id))
                  .length) /
              reviewed.length
            ).toFixed(1),
          )
        : 0,
      calculator_coverage: reviewed.length
        ? Number(
            (
              (100 *
                reviewed.filter(
                  (item) => item.record.related_calculators?.length,
                ).length) /
              reviewed.length
            ).toFixed(1),
          )
        : 0,
      completion_percentage: definition.planned_entry_count
        ? Number(
            (
              (100 *
                Math.min(reviewed.length, definition.planned_entry_count)) /
              definition.planned_entry_count
            ).toFixed(1),
          )
        : 0,
      requires_human_review:
        drafts.length > 0 || rejected.length > 0 || issues.length > 0,
    };
  });
  const blocked = packs
    .filter((pack) => pack.status === "blocked")
    .map((pack) => pack.pack_id);
  const review = packs
    .filter((pack) => pack.requires_human_review)
    .map((pack) => pack.pack_id);
  const next =
    packs.find((pack) => !["complete", "blocked"].includes(pack.status))
      ?.pack_id || null;
  const result = {
    generated_at: now(),
    next_recommended_pack: next,
    blocked_packs: blocked,
    human_review_packs: review,
    packs,
  };
  const validate = validators()["content-queue"];
  if (!validate(result)) throw new Error(JSON.stringify(validate.errors));
  write(path.join(reports, "master-content-queue.json"), result);
  text(
    path.join(reports, "master-content-queue.md"),
    `# EMCP master content queue\n\nGenerated: ${result.generated_at}\n\n- Next recommended pack: ${next || "None"}\n- Blocked packs: ${blocked.length ? blocked.join(", ") : "None"}\n- Packs requiring human review: ${review.length ? review.join(", ") : "None"}\n\n| Pack | Title | Status | Reviewed | Draft | Target | Complete | Handbook | Calculators |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n${packs.map((pack) => `| ${pack.pack_id} | ${pack.title.en} | ${pack.status} | ${pack.reviewed_entry_count} | ${pack.draft_entry_count} | ${pack.target_entry_count} | ${pack.completion_percentage}% | ${pack.handbook_coverage}% | ${pack.calculator_coverage}% |`).join("\n")}`,
  );
  return result;
}

function identityIndex() {
  const { records } = loadContent();
  const legacy = loadLegacy();
  const values = new Set();
  const add = (value) => value && values.add(normalize(value));
  legacy.entries.forEach(({ entry }) =>
    [entry.term, entry.tr, entry.abbr].forEach(add),
  );
  records.forEach(({ record }) => {
    [
      record.id,
      record.title?.en,
      record.title?.tr,
      record.abbreviation,
    ].forEach(add);
    Object.values(record.aliases || {})
      .flat()
      .forEach(add);
  });
  return values;
}

export function plan(jobId) {
  const file = jobFiles().find((candidate) => read(candidate).job_id === jobId);
  if (!file) throw new Error(`Unknown job: ${jobId}`);
  const job = read(file),
    identities = identityIndex();
  const sourceFile = path.join(
    content,
    "jobs/plans",
    `${jobId}.candidates.json`,
  );
  const candidates = fs.existsSync(sourceFile) ? read(sourceFile) : [];
  const planned = candidates.map((candidate, index) => ({
    ...candidate,
    learning_order: index + 1,
    duplicate: [
      candidate.id,
      candidate.title?.en,
      candidate.title?.tr,
      candidate.abbreviation,
      ...(candidate.aliases?.en || []),
      ...(candidate.aliases?.tr || []),
    ].some((value) => identities.has(normalize(value))),
    likely_calculators: (candidate.likely_calculators || []).filter((id) =>
      job.required_calculators.includes(id),
    ),
    handbook_chapters:
      candidate.handbook_chapters || job.required_handbook_chapters,
    official_source_categories:
      candidate.official_source_categories || job.required_source_domains,
    jurisdiction_review_required: (
      candidate.jurisdiction || job.jurisdiction
    ).some((value) => value !== "General"),
  }));
  const output = {
    job_id: jobId,
    target_pack: job.target_pack,
    generated_at: now(),
    plan_only: true,
    existing_identity_count: identities.size,
    proposed_count: planned.length,
    duplicate_count: planned.filter((item) => item.duplicate).length,
    concepts: planned,
  };
  write(path.join(content, "topic-plans", `${jobId}.json`), output);
  text(
    path.join(reports, `${jobId}-topic-plan.md`),
    `# ${job.title.en} topic plan\n\nThis is a planning artifact only. It does not contain generated knowledge content.\n\n- Proposed: ${planned.length}\n- Existing concepts detected: ${output.duplicate_count}\n- Non-duplicates: ${planned.length - output.duplicate_count}\n\n${planned.length ? planned.map((item) => `- ${item.learning_order}. ${item.title.en} / ${item.title.tr} — ${item.difficulty}; ${item.duplicate ? "existing" : "proposed"}`).join("\n") : "Candidate concepts await editorial planning."}`,
  );
  return output;
}

export function generateDrafts(planFile) {
  const planData = read(planFile);
  let created = 0;
  for (const concept of planData.concepts || []) {
    if (concept.duplicate) continue;
    const warning =
      "Editorial draft only: factual, jurisdictional and numerical claims require authoritative evidence and human review.";
    const record = {
      id: concept.id,
      title: concept.title,
      abbreviation: concept.abbreviation || "",
      summary: concept.summary || {
        en: "Draft explanation requires editorial development.",
        tr: "Taslak açıklama editoryal geliştirme gerektirir.",
      },
      simple_explanation: concept.simple_explanation || {
        en: "Evidence-backed explanation pending.",
        tr: "Kanıta dayalı açıklama bekleniyor.",
      },
      professional_explanation: concept.professional_explanation || {
        en: "Professional detail pending source research.",
        tr: "Mesleki ayrıntı kaynak araştırmasını bekliyor.",
      },
      definition: concept.definition || {
        en: "Draft definition pending verification.",
        tr: "Taslak tanım doğrulamayı bekliyor.",
      },
      category: concept.category,
      subcategory: concept.subcategory,
      aliases: concept.aliases || { en: [], tr: [] },
      tags: concept.tags || [],
      keywords: concept.keywords || { en: [], tr: [] },
      formula: null,
      worked_example: {
        en: "Not added until the method is verified.",
        tr: "Yöntem doğrulanana kadar eklenmedi.",
      },
      use_cases: {
        en: ["Editorial review required before use."],
        tr: ["Kullanımdan önce editoryal inceleme gerekir."],
      },
      risks: {
        en: [warning],
        tr: [
          "Yalnızca editoryal taslaktır; olgusal, bölgesel ve sayısal iddialar yetkili kaynak ve insan incelemesi gerektirir.",
        ],
      },
      common_mistakes: { en: [], tr: [] },
      practical_tips: { en: [], tr: [] },
      best_practice: { en: [], tr: [] },
      related_concepts: [],
      related_calculators: concept.likely_calculators || [],
      related_documents: [],
      related_standards: { en: [], tr: [] },
      related_regulations: { en: [], tr: [] },
      jurisdiction: concept.jurisdiction || ["General"],
      sources: [],
      created_date: today,
      reviewed_date: null,
      reviewer: null,
      review_status: "draft",
      content_version: "0.1.0",
      difficulty_level: concept.difficulty || "beginner",
      estimated_reading_time_minutes: 1,
      revision_history: [
        {
          version: "0.1.0",
          date: today,
          summary: {
            en: "Controlled draft generated; evidence and human review pending.",
            tr: "Kontrollü taslak oluşturuldu; kanıt ve insan incelemesi bekleniyor.",
          },
          reviewer: "EMCP Content Production Engine",
        },
      ],
      visual_illustration: {
        status: "planned",
        caption: {
          en: "Illustration pending editorial approval.",
          tr: "Görsel editoryal onayı bekliyor.",
        },
        url: null,
      },
      future_video: {
        status: "planned",
        caption: {
          en: "Video pending editorial approval.",
          tr: "Video editoryal onayı bekliyor.",
        },
        url: null,
      },
      generation_warnings: [warning],
    };
    write(
      path.join(
        content,
        "drafts",
        planData.target_pack.replace(".", "-"),
        `${concept.id}.json`,
      ),
      record,
    );
    created++;
  }
  return created;
}

export function validatePack(id) {
  const all = loadContent();
  const selected = all.records.filter((item) => belongsToPack(item, id));
  const general = allChecks(all.records, all.parseIssues).filter((issue) =>
    selected.some((item) => item.file === issue.file),
  );
  const calculatorPairs = [
    ["ltv", "LTV"],
    ["ltc", "LTC"],
    ["ltgdv", "LTGDV"],
    ["roi", "ROI"],
    ["yield", "Rental Yield"],
    ["development-profit", "Development Profit"],
    ["monthly-payment", "Monthly Loan Payment"],
    ["arrangement-fee", "Arrangement Fee"],
    ["interest-rollup", "Interest Roll-up"],
    ["concrete", "Concrete"],
    ["paint", "Paint"],
    ["flooring", "Flooring"],
    ["plasterboard", "Plasterboard"],
    ["insulation", "Insulation"],
    ["tiles", "Tiles"],
  ];
  const calculators = new Set(calculatorPairs.flat());
  const chapters = new Set(
    read("content/handbooks/investor/chapters.json").map((item) => item.id),
  );
  const documents = new Set(
    read("content/document-guides/property-purchase-documents.json").map(
      (item) => item.id,
    ),
  );
  const findings = [...general];
  const arithmeticMismatch = (value) => {
    const match = String(value || "").match(
      /(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/,
    );
    if (!match) return false;
    const left = Number(match[1]),
      right = Number(match[3]),
      stated = Number(match[4]);
    const actual = {
      "+": left + right,
      "-": left - right,
      "*": left * right,
      "/": right ? left / right : Number.NaN,
    }[match[2]];
    return Number.isFinite(actual) && Math.abs(actual - stated) > 0.001;
  };
  const staleBefore = `${new Date().getFullYear() - 2}-${today.slice(5)}`;
  selected.forEach((item) => {
    const record = item.record;
    if (!record.jurisdiction?.length)
      findings.push({ code: "missing_jurisdiction", file: item.file });
    if ((record.simple_explanation?.en || "").length < 40)
      findings.push({
        code: "suspiciously_short_explanation",
        file: item.file,
      });
    if (record.formula && !record.worked_example?.en)
      findings.push({
        code: "formula_without_worked_example",
        file: item.file,
      });
    if (
      arithmeticMismatch(record.worked_example?.en) ||
      arithmeticMismatch(record.worked_example?.tr)
    )
      findings.push({ code: "incorrect_worked_arithmetic", file: item.file });
    if (
      ["todo", "tbd", "lorem ipsum", "n/a"].some((filler) =>
        JSON.stringify(record).toLowerCase().includes(`"${filler}"`),
      )
    )
      findings.push({ code: "empty_filler_section", file: item.file });
    for (const source of record.sources || [])
      if (source.accessed_date < staleBefore)
        findings.push({
          code: "stale_source",
          file: item.file,
          value: source.url,
        });
    for (const id of record.related_calculators || [])
      if (!calculators.has(id))
        findings.push({
          code: "invalid_calculator_id",
          file: item.file,
          value: id,
        });
    for (const document of record.related_documents || [])
      if (document.id && !documents.has(document.id))
        findings.push({
          code: "invalid_document_reference",
          file: item.file,
          value: document.id,
        });
    for (const chapter of record.related_handbook_chapters || [])
      if (!chapters.has(chapter))
        findings.push({
          code: "invalid_handbook_reference",
          file: item.file,
          value: chapter,
        });
  });
  const result = {
    generated_at: now(),
    pack_id: id,
    total_records: selected.length,
    reviewed_records: selected.filter(
      (item) => item.statusFolder === "reviewed",
    ).length,
    draft_records: selected.filter((item) => item.statusFolder === "drafts")
      .length,
    rejected_records: selected.filter(
      (item) => item.statusFolder === "rejected",
    ).length,
    findings,
  };
  write(path.join(reports, `${id}-validation.json`), result);
  text(
    path.join(reports, `${id}-validation.md`),
    `# ${id} batch validation\n\n- Total: ${result.total_records}\n- Reviewed: ${result.reviewed_records}\n- Draft: ${result.draft_records}\n- Rejected: ${result.rejected_records}\n- Findings: ${findings.length}\n- Result: ${findings.length ? "REVIEW REQUIRED" : "PASS"}\n\n${findings.map((item) => `- ${item.code}: ${item.file}${item.value ? ` (${item.value})` : ""}`).join("\n") || "No findings."}`,
  );
  return result;
}

function runtimeFiles() {
  return files(path.join(root, "data/knowledge"));
}

export function backup() {
  const legacy = loadLegacy();
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(backups, id);
  fs.mkdirSync(directory, { recursive: true });
  const runtime = runtimeFiles();
  runtime.forEach((file) =>
    fs.copyFileSync(file, path.join(directory, path.basename(file))),
  );
  const manifest = {
    backup_id: id,
    created_at: now(),
    runtime_count: legacy.entries.length,
    files: runtime.map((file) => ({
      path: relative(file),
      sha256: hash(file),
    })),
  };
  write(path.join(directory, "manifest.json"), manifest);
  write(path.join(backups, "latest.json"), { backup_id: id });
  return manifest;
}

export function dryRun() {
  const { records, parseIssues } = loadContent({ folders: ["reviewed"] });
  const issues = allChecks(records, parseIssues),
    legacy = loadLegacy();
  const result = {
    generated_at: now(),
    current_runtime_count: legacy.entries.length,
    reviewed_record_count: records.length,
    errors: errors(issues),
    warnings: issues.filter((item) => item.severity !== "error"),
    can_import: errors(issues).length === 0,
  };
  write(path.join(reports, "safe-import-dry-run.json"), result);
  text(
    path.join(reports, "safe-import-dry-run.md"),
    `# Safe import dry run\n\n- Runtime before: ${result.current_runtime_count}\n- Reviewed authoring records: ${result.reviewed_record_count}\n- Errors: ${result.errors.length}\n- Warnings: ${result.warnings.length}\n- Import permitted: ${result.can_import ? "YES" : "NO"}`,
  );
  return result;
}

export function safeImport() {
  const preview = dryRun();
  if (!preview.can_import)
    throw new Error("Safe import rejected: dry-run validation failed.");
  const snapshot = backup();
  try {
    const result = importReviewed();
    if (errors(result.issues).length)
      throw new Error("Reviewed import failed.");
    run(process.execPath, ["scripts/content/index.mjs"]);
    run(process.execPath, ["tests/regression.mjs"]);
    const after = loadLegacy().entries.length;
    const report = {
      generated_at: now(),
      backup_id: snapshot.backup_id,
      runtime_before: snapshot.runtime_count,
      runtime_after: after,
      added: result.added,
      matched: result.matched,
      result: "PASS",
    };
    write(path.join(reports, "safe-import-post-import.json"), report);
    return report;
  } catch (error) {
    rollback(snapshot.backup_id);
    throw error;
  }
}

export function rollback(id) {
  const backupId = id || read(path.join(backups, "latest.json")).backup_id;
  const directory = path.join(backups, backupId),
    manifest = read(path.join(directory, "manifest.json"));
  for (const item of manifest.files)
    fs.copyFileSync(
      path.join(directory, path.basename(item.path)),
      path.join(root, item.path),
    );
  const restored = manifest.files.every(
    (item) => hash(path.join(root, item.path)) === item.sha256,
  );
  if (!restored) throw new Error("Rollback hash verification failed.");
  const report = {
    restored_at: now(),
    backup_id: backupId,
    runtime_count: loadLegacy().entries.length,
    hashes_verified: true,
  };
  write(path.join(reports, "rollback-report.json"), report);
  return report;
}

export function researchReport() {
  const drafts = loadContent({ folders: ["drafts"] }).records;
  const preferred = [
    "gov.uk",
    "landregistry.gov.uk",
    "hmrc.gov.uk",
    "fca.org.uk",
    "moneyhelper.org.uk",
    "planningportal.co.uk",
    "rics.org",
    "hse.gov.uk",
    "tkgm.gov.tr",
    "gib.gov.tr",
    "mevzuat.gov.tr",
  ];
  const queue = drafts.map(({ record }) => ({
    record_id: record.id,
    required_factual_claims: [
      "Definition and professional explanation",
      ...(record.formula ? ["Formula and worked arithmetic"] : []),
    ],
    required_jurisdiction: record.jurisdiction,
    preferred_source_type: preferred,
    current_citations: (record.sources || []).map((item) => item.url),
    missing_citations: record.sources?.length
      ? []
      : ["At least one authoritative source"],
    stale_citations: [],
    source_review_status: record.sources?.length
      ? "ready-for-review"
      : "not-started",
    last_checked_date: null,
    next_review_date: null,
  }));
  const validate = validators()["source-research"];
  queue.forEach((item) => {
    if (!validate(item)) throw new Error(JSON.stringify(validate.errors));
  });
  write(path.join(content, "research/source-research-queue.json"), queue);
  text(
    path.join(reports, "source-research-queue.md"),
    `# Source research queue\n\nRecords: ${queue.length}\n\n${queue.map((item) => `- ${item.record_id}: ${item.source_review_status}; missing ${item.missing_citations.length}`).join("\n") || "No draft records currently require source research."}`,
  );
  return queue;
}

export function reviewReport() {
  const drafts = loadContent({ folders: ["drafts"] }).records;
  const checks = [
    "factual_accuracy",
    "source_reliability",
    "bilingual_quality",
    "turkish_naturalness",
    "professional_terminology",
    "formula_accuracy",
    "calculation_accuracy",
    "legal_risk_wording",
    "tax_risk_wording",
    "financial_risk_wording",
    "jurisdiction_clarity",
    "duplicate_detection",
    "related_concept_accuracy",
    "calculator_reference_accuracy",
    "document_reference_accuracy",
    "handbook_relevance",
  ];
  const values = drafts.map(({ record }) => ({
    record_id: record.id,
    reviewer: null,
    reviewed_date: null,
    checks: Object.fromEntries(checks.map((name) => [name, "pending"])),
    outcome: "pending",
    notes:
      "Only approve after every applicable check passes; move files manually after approval.",
  }));
  write(path.join(content, "reviews/review-queue.json"), values);
  return values;
}

export function dashboard() {
  const legacy = loadLegacy(),
    { records } = loadContent(),
    queueData = queue();
  const reviewed = records.filter((item) => item.statusFolder === "reviewed");
  const sourceCoverage = reviewed.length
    ? (100 * reviewed.filter((item) => item.record.sources?.length).length) /
      reviewed.length
    : 100;
  const bilingual = reviewed.length
    ? (100 *
        reviewed.filter(
          (item) =>
            item.record.title?.en &&
            item.record.title?.tr &&
            item.record.definition?.en &&
            item.record.definition?.tr,
        ).length) /
      reviewed.length
    : 100;
  const countBy = (getter) =>
    Object.fromEntries(
      [...new Set(records.map(getter).filter(Boolean))]
        .sort()
        .map((key) => [
          key,
          records.filter((item) => getter(item) === key).length,
        ]),
    );
  const data = {
    generated_at: now(),
    runtime_entries: legacy.entries.length,
    reviewed_entries: reviewed.length,
    draft_entries: records.filter((item) => item.statusFolder === "drafts")
      .length,
    rejected_entries: records.filter((item) => item.statusFolder === "rejected")
      .length,
    completed_packs: queueData.packs.filter(
      (item) => item.status === "complete",
    ).length,
    active_packs: queueData.packs.filter((item) =>
      ["researching", "drafting", "validating"].includes(item.status),
    ).length,
    next_recommended_pack: queueData.next_recommended_pack,
    entries_by_category: countBy((item) => item.record.category?.en),
    entries_by_difficulty: countBy((item) => item.record.difficulty_level),
    entries_by_jurisdiction: countBy((item) =>
      item.record.jurisdiction?.join(", "),
    ),
    source_coverage_percentage: Number(sourceCoverage.toFixed(1)),
    bilingual_coverage_percentage: Number(bilingual.toFixed(1)),
    handbook_coverage_percentage: Number(
      (
        queueData.packs.reduce((sum, item) => sum + item.handbook_coverage, 0) /
        100
      ).toFixed(1),
    ),
    calculator_link_coverage_percentage: reviewed.length
      ? Number(
          (
            (100 *
              reviewed.filter((item) => item.record.related_calculators?.length)
                .length) /
            reviewed.length
          ).toFixed(1),
        )
      : 0,
    broken_references: queueData.packs.reduce(
      (sum, item) => sum + item.broken_reference_count,
      0,
    ),
    records_due_for_review: records.filter(
      (item) =>
        item.record.reviewed_date &&
        item.record.reviewed_date <
          `${new Date().getFullYear() - 1}-${today.slice(5)}`,
    ).length,
    stale_records: 0,
    recent_imports: fs.existsSync(
      path.join(reports, "safe-import-post-import.json"),
    )
      ? [read(path.join(reports, "safe-import-post-import.json"))]
      : [],
  };
  write(path.join(content, "dashboard/data.json"), data);
  return data;
}

export function maintenance() {
  const { records } = loadContent();
  const reviewed = records.filter((item) => item.statusFolder === "reviewed");
  const referenced = new Set(
    reviewed.flatMap((item) => item.record.related_concepts || []),
  );
  const findings = {
    records_due_for_review: reviewed
      .filter(
        (item) =>
          item.record.reviewed_date &&
          item.record.reviewed_date <
            `${new Date().getFullYear() - 1}-${today.slice(5)}`,
      )
      .map((item) => item.record.id),
    stale_official_sources: reviewed.flatMap((item) =>
      (item.record.sources || [])
        .filter(
          (source) =>
            source.accessed_date <
            `${new Date().getFullYear() - 2}-${today.slice(5)}`,
        )
        .map((source) => source.url),
    ),
    changed_regulations_requires_human_monitoring: reviewed
      .filter((item) => item.record.related_regulations?.en?.length)
      .map((item) => item.record.id),
    broken_urls_require_network_check: [
      ...new Set(
        reviewed.flatMap((item) =>
          (item.record.sources || []).map((source) => source.url),
        ),
      ),
    ],
    missing_translations: reviewed
      .filter(
        (item) => !item.record.definition?.en || !item.record.definition?.tr,
      )
      .map((item) => item.record.id),
    weak_turkish_translations_require_human_review: [],
    missing_formulas: reviewed
      .filter(
        (item) =>
          item.record.tags?.includes("calculation") && !item.record.formula,
      )
      .map((item) => item.record.id),
    formulas_missing_worked_examples: reviewed
      .filter((item) => item.record.formula && !item.record.worked_example?.en)
      .map((item) => item.record.id),
    orphaned_concepts: reviewed
      .filter(
        (item) =>
          !(item.record.related_concepts || []).length &&
          !referenced.has(item.record.id),
      )
      .map((item) => item.record.id),
    underdeveloped_handbook_chapters: read(
      "content/handbooks/investor/chapters.json",
    )
      .filter((item) => item.review_status !== "reviewed")
      .map((item) => item.id),
    packs_below_target: queue()
      .packs.filter((item) => item.completion_percentage < 100)
      .map((item) => item.pack_id),
    duplicate_relationships: [],
    unused_calculators: [],
    unused_document_guides: [],
    unused_checklists: [],
    unused_case_studies: [],
  };
  write(path.join(reports, "monthly-maintenance.json"), {
    generated_at: now(),
    findings,
  });
  text(
    path.join(reports, "monthly-maintenance.md"),
    `# EMCP monthly content maintenance\n\nGenerated: ${now()}\n\n${Object.entries(
      findings,
    )
      .map(([key, values]) => `- ${key.replaceAll("_", " ")}: ${values.length}`)
      .join(
        "\n",
      )}\n\nURL and regulatory-change checks are deliberately queued for human/network verification; the engine never infers that a law changed.`,
  );
  return findings;
}

const command = process.argv[2],
  argument = process.argv[3];
if (import.meta.url === `file://${process.argv[1]}`) {
  const actions = {
    "job:create": () =>
      console.log(
        "Create a schema-valid job JSON in content/jobs/planned; generated content is never auto-approved.",
      ),
    "job:list": () =>
      console.log(
        jobFiles()
          .map(
            (file) =>
              `${read(file).job_id}\t${read(file).status}\t${relative(file)}`,
          )
          .join("\n"),
      ),
    "job:status": () =>
      console.log(
        JSON.stringify(
          read(jobFiles().find((file) => read(file).job_id === argument)),
          null,
          2,
        ),
      ),
    "job:validate": () => console.log(JSON.stringify(validateJobs(), null, 2)),
    queue: () =>
      console.log(`Queue generated for ${queue().packs.length} packs.`),
    plan: () => console.log(JSON.stringify(plan(argument), null, 2)),
    "generate-drafts": () =>
      console.log(
        `Generated ${generateDrafts(argument)} draft(s); none were reviewed.`,
      ),
    research: () =>
      console.log(
        `Research queue contains ${researchReport().length} record(s).`,
      ),
    review: () =>
      console.log(`Review queue contains ${reviewReport().length} record(s).`),
    "validate-pack": () =>
      console.log(JSON.stringify(validatePack(argument), null, 2)),
    backup: () => console.log(JSON.stringify(backup(), null, 2)),
    "dry-run": () => console.log(JSON.stringify(dryRun(), null, 2)),
    "import-safe": () => console.log(JSON.stringify(safeImport(), null, 2)),
    rollback: () => console.log(JSON.stringify(rollback(argument), null, 2)),
    dashboard: () => console.log(JSON.stringify(dashboard(), null, 2)),
    maintenance: () => console.log(JSON.stringify(maintenance(), null, 2)),
  };
  if (!actions[command])
    throw new Error(`Unknown production-engine command: ${command}`);
  actions[command]();
}
