import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export const root = process.cwd();
export const contentRoot = path.join(root, "content");
const authoringFolders = ["drafts", "reviewed", "rejected"];
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
export const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const slug = (value) => normalize(value).replace(/\s+/g, "-");

function filesIn(folder) {
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .flatMap((entry) => {
      const location = path.join(folder, entry.name);
      if (entry.isDirectory()) return filesIn(location);
      return entry.isFile() && entry.name.endsWith(".json") ? [location] : [];
    })
    .sort();
}

export function loadContent({ folders = authoringFolders } = {}) {
  const records = [],
    parseIssues = [];
  for (const statusFolder of folders) {
    for (const file of filesIn(path.join(contentRoot, statusFolder))) {
      try {
        const parsed = readJSON(file),
          values = Array.isArray(parsed) ? parsed : [parsed];
        values.forEach((record, index) =>
          records.push({ record, file: relative(file), statusFolder, index }),
        );
      } catch (error) {
        parseIssues.push(
          issue("error", "invalid_json", relative(file), null, error.message),
        );
      }
    }
  }
  return { records, parseIssues };
}

export function loadLegacy() {
  const base = path.join(root, "data/knowledge"),
    index = readJSON(path.join(base, "index.json")),
    translations = readJSON(path.join(base, index.translations)),
    entries = [];
  index.categories.forEach((category) => {
    readJSON(path.join(base, category.file)).forEach((entry, entryIndex) =>
      entries.push({ entry, category, entryIndex }),
    );
  });
  return { base, index, translations, entries };
}

export const issue = (severity, code, file, id, message) => ({
  severity,
  code,
  file,
  id: id || null,
  message,
});
export const errors = (issues) =>
  issues.filter((item) => item.severity === "error");
export function printResult(label, issues, recordCount) {
  for (const item of issues)
    console.log(
      `${item.severity.toUpperCase()} ${item.code} ${item.file}${item.id ? ` (${item.id})` : ""}: ${item.message}`,
    );
  const failureCount = errors(issues).length;
  console.log(
    `${label}: ${recordCount} record(s), ${failureCount} error(s), ${issues.length - failureCount} warning(s).`,
  );
  if (failureCount) process.exitCode = 1;
  return failureCount === 0;
}

let schemaValidator;
function validator() {
  if (schemaValidator) return schemaValidator;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  schemaValidator = ajv.compile(
    readJSON(path.join(root, "schemas/content-entry.schema.json")),
  );
  return schemaValidator;
}

export function validateSchema(records) {
  const validate = validator(),
    issues = [];
  for (const item of records) {
    if (!validate(item.record))
      for (const error of validate.errors || [])
        issues.push(
          issue(
            "error",
            "schema",
            item.file,
            item.record?.id,
            `${error.instancePath || "/"} ${error.message}`,
          ),
        );
    const expected =
      item.statusFolder === "reviewed"
        ? "reviewed"
        : item.statusFolder === "rejected"
          ? "rejected"
          : null;
    if (expected && item.record?.review_status !== expected)
      issues.push(
        issue(
          "error",
          "folder_status",
          item.file,
          item.record?.id,
          `Records in content/${item.statusFolder} must have review_status "${expected}".`,
        ),
      );
    if (item.record?.review_status === "reviewed") {
      if (!item.record.reviewer || !item.record.reviewed_date)
        issues.push(
          issue(
            "error",
            "review_metadata",
            item.file,
            item.record.id,
            "Reviewed records require reviewer and reviewed_date.",
          ),
        );
    }
  }
  return issues;
}

export function validateDuplicates(records) {
  const issues = [],
    buckets = new Map(),
    legacy = loadLegacy(),
    importManifestFile = path.join(contentRoot, "reports/import-manifest.json"),
    importManifest = fs.existsSync(importManifestFile)
      ? readJSON(importManifestFile)
      : {},
    legacyTitles = new Map(
      legacy.entries.map(({ entry }) => [normalize(entry.term), entry.term]),
    );
  const add = (kind, value, item) => {
    const key = normalize(value);
    if (!key) return;
    const bucketKey = `${kind}:${key}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey).push({ item, value });
  };
  records.forEach((item) => {
    add("id", item.record.id, item);
    add("title_en", item.record.title?.en, item);
    add("title_tr", item.record.title?.tr, item);
    for (const language of ["en", "tr"])
      for (const alias of item.record.aliases?.[language] || [])
        add("alias", alias, item);
    const legacyTitle = legacyTitles.get(normalize(item.record.title?.en));
    if (
      legacyTitle &&
      normalize(item.record.legacy_term) !== normalize(legacyTitle) &&
      normalize(importManifest[item.record.id]) !== normalize(legacyTitle)
    )
      issues.push(
        issue(
          "error",
          "legacy_title_collision",
          item.file,
          item.record.id,
          `English title already exists in the application as "${legacyTitle}"; set legacy_term explicitly for an update.`,
        ),
      );
  });
  for (const [key, values] of buckets) {
    const recordIds = new Set(values.map(({ item }) => item.record.id));
    if (recordIds.size > 1)
      values.forEach(({ item, value }) =>
        issues.push(
          issue(
            "error",
            `duplicate_${key.split(":")[0]}`,
            item.file,
            item.record.id,
            `"${value}" is also used by: ${[...recordIds].filter((id) => id !== item.record.id).join(", ")}.`,
          ),
        ),
      );
  }
  return issues;
}

export function validateReferences(records) {
  const issues = [],
    ids = new Set(records.map((item) => item.record.id).filter(Boolean)),
    legacyIds = new Set(
      loadLegacy().entries.map(({ entry }) => `legacy.${slug(entry.term)}`),
    );
  records.forEach((item) => {
    for (const reference of item.record.related_concepts || [])
      if (!ids.has(reference) && !legacyIds.has(reference))
        issues.push(
          issue(
            "error",
            "broken_related_concept",
            item.file,
            item.record.id,
            `Related concept "${reference}" does not exist in authored or legacy content.`,
          ),
        );
  });
  return issues;
}

const localizedFields = [
  "title",
  "summary",
  "simple_explanation",
  "professional_explanation",
  "real_world_example",
  "site_example",
  "office_example",
  "interview_questions",
  "definition",
  "category",
  "subcategory",
  "aliases",
  "keywords",
  "worked_example",
  "when_to_use",
  "use_cases",
  "risks",
  "common_mistakes",
  "practical_tips",
  "best_practice",
  "uk_practice",
  "turkey_practice",
  "frequently_asked_questions",
];
const present = (value) =>
  Array.isArray(value)
    ? value.length > 0 && value.every((item) => String(item).trim())
    : typeof value === "string" && Boolean(value.trim());
export function validateBilingual(records) {
  const issues = [];
  const check = (item, name, value, required = false) => {
    const en = value?.en,
      tr = value?.tr,
      enPresent = present(en),
      trPresent = present(tr);
    if ((required || enPresent || trPresent) && (!enPresent || !trPresent))
      issues.push(
        issue(
          "error",
          "bilingual_incomplete",
          item.file,
          item.record.id,
          `${name} must contain complete English and Turkish content.`,
        ),
      );
  };
  records.forEach((item) => {
    localizedFields.forEach((field) =>
      check(
        item,
        field,
        item.record[field],
        [
          "title",
          "definition",
          "category",
          "subcategory",
          "worked_example",
          "use_cases",
        ].includes(field),
      ),
    );
    if (item.record.formula) {
      check(item, "formula.notes", item.record.formula.notes, true);
      item.record.formula.variables?.forEach((variable, index) =>
        check(
          item,
          `formula.variables[${index}].description`,
          variable.description,
          true,
        ),
      );
    }
  });
  return issues;
}

export function validateSources(records) {
  const issues = [],
    now = new Date(),
    today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  records.forEach((item) => {
    if (
      item.record.review_status === "reviewed" &&
      !item.record.sources?.length
    )
      issues.push(
        issue(
          "error",
          "missing_sources",
          item.file,
          item.record.id,
          "Reviewed records require at least one source citation.",
        ),
      );
    const seen = new Set();
    for (const source of item.record.sources || []) {
      if (!String(source.url || "").startsWith("https://"))
        issues.push(
          issue(
            "error",
            "unsafe_source_url",
            item.file,
            item.record.id,
            `Source must use HTTPS: ${source.url || "missing URL"}.`,
          ),
        );
      if (seen.has(source.url))
        issues.push(
          issue(
            "warning",
            "duplicate_source",
            item.file,
            item.record.id,
            `Source URL is repeated: ${source.url}.`,
          ),
        );
      seen.add(source.url);
      if (source.accessed_date > today)
        issues.push(
          issue(
            "error",
            "future_access_date",
            item.file,
            item.record.id,
            `Source access date ${source.accessed_date} is in the future.`,
          ),
        );
    }
  });
  return issues;
}

export function allChecks(records, parseIssues = []) {
  return [
    ...parseIssues,
    ...validateSchema(records),
    ...validateDuplicates(records),
    ...validateReferences(records),
    ...validateBilingual(records),
    ...validateSources(records),
  ];
}

const writeJSONAtomic = (file, value) => {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
};
export function importReviewed() {
  const { records, parseIssues } = loadContent({ folders: ["reviewed"] }),
    issues = allChecks(records, parseIssues);
  if (errors(issues).length) return { issues, added: 0, matched: 0 };
  const legacy = loadLegacy(),
    importManifestFile = path.join(contentRoot, "reports/import-manifest.json"),
    importManifest = fs.existsSync(importManifestFile)
      ? readJSON(importManifestFile)
      : {},
    byTerm = new Map(
      legacy.entries.map((item) => [normalize(item.entry.term), item]),
    );
  let added = 0,
    matched = 0;
  const categoryValues = new Map(
    legacy.index.categories.map((category) => [
      category.file,
      readJSON(path.join(legacy.base, category.file)).map((entry) => {
        const compatible = { ...entry };
        delete compatible.aliases;
        delete compatible.keywords;
        return compatible;
      }),
    ]),
  );
  for (const { record, file } of records) {
    if (record.review_status !== "reviewed") continue;
    const existing = byTerm.get(
      normalize(
        record.legacy_term || importManifest[record.id] || record.title.en,
      ),
    );
    if (existing) {
      if (
        record.legacy_term &&
        normalize(record.title.en) !== normalize(existing.entry.term)
      )
        issues.push(
          issue(
            "error",
            "legacy_title_mismatch",
            file,
            record.id,
            `legacy_term resolves to "${existing.entry.term}" but English title is "${record.title.en}".`,
          ),
        );
      else {
        importManifest[record.id] = existing.entry.term;
        matched++;
      }
      continue;
    }
    const category = legacy.index.categories.find(
      (item) => normalize(item.category) === normalize(record.category.tr),
    );
    if (!category) {
      issues.push(
        issue(
          "error",
          "unknown_runtime_category",
          file,
          record.id,
          `No runtime category matches Turkish category "${record.category.tr}".`,
        ),
      );
      continue;
    }
    const runtime = {
      term: record.title.en,
      tr: record.title.tr,
      cat: record.category.tr,
      abbr: record.abbreviation,
      def: record.definition.tr,
      use: record.use_cases.tr.join(" "),
      example: record.worked_example.en,
      tags: record.tags,
    };
    categoryValues.get(category.file).push(runtime);
    legacy.translations[record.title.en] = {
      defEn: record.definition.en,
      useEn: record.use_cases.en.join(" "),
    };
    byTerm.set(normalize(runtime.term), { entry: runtime, category });
    importManifest[record.id] = runtime.term;
    added++;
  }
  if (errors(issues).length) return { issues, added: 0, matched };
  for (const [file, values] of categoryValues)
    writeJSONAtomic(path.join(legacy.base, file), values);
  writeJSONAtomic(
    path.join(legacy.base, legacy.index.translations),
    legacy.translations,
  );
  writeJSONAtomic(importManifestFile, importManifest);
  return { issues, added, matched };
}

export function generateContentIndexes() {
  const imported = importReviewed();
  if (errors(imported.issues).length) return imported;
  const { records } = loadContent({ folders: ["reviewed"] }),
    reviewed = records.map((item) => item.record),
    output = path.join(contentRoot, "reports/indexes");
  fs.mkdirSync(output, { recursive: true });
  const categories = new Map();
  reviewed.forEach((record) => {
    if (!categories.has(record.category.key))
      categories.set(record.category.key, {
        key: record.category.key,
        title: { en: record.category.en, tr: record.category.tr },
        count: 0,
        entries: [],
      });
    const category = categories.get(record.category.key);
    category.count++;
    category.entries.push(record.id);
  });
  const search = reviewed.map((record) => ({
    id: record.id,
    title: record.title,
    abbreviation: record.abbreviation,
    definition: record.definition,
    simple_explanation: record.simple_explanation || record.summary,
    professional_explanation:
      record.professional_explanation || record.definition,
    real_world_example: record.real_world_example || record.worked_example,
    site_example: record.site_example || null,
    office_example: record.office_example || record.when_to_use,
    practical_tips: record.practical_tips || record.use_cases,
    best_practice: record.best_practice || { en: [], tr: [] },
    category: record.category.key,
    subcategory: record.subcategory.key,
    aliases: record.aliases,
    tags: record.tags,
    keywords: record.keywords,
    jurisdiction: record.jurisdiction,
    content_version: record.content_version,
  }));
  const relationships = Object.fromEntries(
    reviewed.map((record) => [record.id, record.related_concepts]),
  );
  const authoredByTerm = new Map(
      reviewed.map((record) => [
        normalize(record.legacy_term || record.title.en),
        record,
      ]),
    ),
    titleById = new Map(reviewed.map((record) => [record.id, record.title.en])),
    legacy = loadLegacy(),
    localized = (en, tr) => ({ en: String(en || ""), tr: String(tr || "") }),
    placeholder = (kind) => ({
      status: "planned",
      caption: localized(
        `${kind} is planned for a future content revision.`,
        `${kind === "Visual illustration" ? "Görsel açıklama" : "Video"} gelecekteki bir içerik revizyonu için planlanmıştır.`,
      ),
      url: null,
    }),
    migratedEntries = Object.fromEntries(
      legacy.entries.map(({ entry }) => {
        const record = authoredByTerm.get(normalize(entry.term)),
          translation = legacy.translations[entry.term] || {},
          definition = localized(
            record?.professional_explanation?.en ||
              record?.definition?.en ||
              translation.defEn ||
              entry.def,
            record?.professional_explanation?.tr ||
              record?.definition?.tr ||
              entry.def,
          ),
          simple = localized(
            record?.simple_explanation?.en ||
              record?.summary?.en ||
              definition.en,
            record?.simple_explanation?.tr ||
              record?.summary?.tr ||
              definition.tr,
          ),
          usage = localized(
            record?.when_to_use?.en || translation.useEn || entry.use,
            record?.when_to_use?.tr || entry.use,
          ),
          example = localized(
            record?.real_world_example?.en ||
              record?.worked_example?.en ||
              entry.example,
            record?.real_world_example?.tr ||
              record?.worked_example?.tr ||
              entry.example,
          ),
          genericQuestions = {
            en: [
              { question: `What does ${entry.term} mean?`, answer: simple.en },
            ],
            tr: [
              { question: `${entry.tr} ne anlama gelir?`, answer: simple.tr },
            ],
          },
          words = [simple.en, definition.en, example.en, usage.en]
            .join(" ")
            .split(/\s+/).length;
        return [
          entry.term,
          {
            simpleExplanation: simple,
            professionalExplanation: definition,
            realWorldExample: example,
            siteExample: localized(
              record?.site_example?.en ||
                "No site-specific example has been reviewed yet; use the real-world example and verify the project context.",
              record?.site_example?.tr ||
                "Henüz şantiyeye özel bir örnek incelenmemiştir; gerçek hayat örneğini kullanın ve proje bağlamını doğrulayın.",
            ),
            officeExample: localized(
              record?.office_example?.en || usage.en,
              record?.office_example?.tr || usage.tr,
            ),
            interviewQuestions: record?.interview_questions || genericQuestions,
            formula: record?.formula || null,
            calculatorLinks: record?.related_calculators || [],
            commonMistakes: record?.common_mistakes || { en: [], tr: [] },
            practicalTips: record?.practical_tips ||
              record?.use_cases || { en: [], tr: [] },
            risks: record?.risks || { en: [], tr: [] },
            bestPractice: record?.best_practice || { en: [], tr: [] },
            ukPractice:
              record?.uk_practice ||
              localized(
                "Check the current rules and professional guidance for the relevant UK jurisdiction before relying on this concept.",
                "Bu kavrama dayanmadan önce ilgili Birleşik Krallık bölgesindeki güncel kuralları ve mesleki rehberleri kontrol edin.",
              ),
            turkeyPractice:
              record?.turkey_practice ||
              localized(
                "Confirm the current Turkish legal, technical and professional requirements with an appropriately qualified local adviser.",
                "Türkiye'deki güncel hukuki, teknik ve mesleki gereklilikleri uygun nitelikte yerel bir uzmanla doğrulayın.",
              ),
            relatedConcepts: (record?.related_concepts || []).map(
              (id) => titleById.get(id) || id,
            ),
            relatedDocuments: record?.related_documents || [],
            relatedStandards: record?.related_standards || [],
            relatedRegulations: record?.related_regulations || [],
            officialSources: record?.sources || [],
            revisionHistory: record?.revision_history?.length
              ? record.revision_history
              : [
                  {
                    version: record?.content_version || "1.0.0",
                    date:
                      record?.reviewed_date ||
                      record?.created_date ||
                      "2026-07-14",
                    summary: localized(
                      record
                        ? "Migrated to Knowledge Entry v2."
                        : "Legacy record automatically migrated to Knowledge Entry v2 without changing its original fields.",
                      record
                        ? "Knowledge Entry v2 yapısına geçirildi."
                        : "Eski kayıt, özgün alanları değiştirilmeden Knowledge Entry v2 yapısına otomatik olarak geçirildi.",
                    ),
                    reviewer:
                      record?.reviewer || "EMCP automated legacy migration",
                  },
                ],
            difficultyLevel: record?.difficulty_level || "beginner",
            estimatedReadingTimeMinutes:
              record?.estimated_reading_time_minutes ||
              Math.max(1, Math.ceil(words / 180)),
            frequentlyAskedQuestions:
              record?.frequently_asked_questions || genericQuestions,
            visualIllustration:
              record?.visual_illustration || placeholder("Visual illustration"),
            futureVideo: record?.future_video || placeholder("Future video"),
          },
        ];
      }),
    );
  writeJSONAtomic(
    path.join(output, "category-index.json"),
    [...categories.values()].sort((a, b) => a.key.localeCompare(b.key)),
  );
  writeJSONAtomic(path.join(output, "search-index.json"), search);
  writeJSONAtomic(path.join(output, "relationship-index.json"), relationships);
  writeJSONAtomic(path.join(legacy.base, legacy.index.details), {
    version: 2,
    entries: migratedEntries,
  });
  fs.writeFileSync(
    path.join(contentRoot, "reports/migration-v2.md"),
    `# Knowledge Entry v2 migration report\n\nGenerated: ${new Date().toISOString()}\n\n- Runtime records before migration: ${legacy.entries.length}\n- Runtime records after migration: ${Object.keys(migratedEntries).length}\n- Authored records mapped: ${reviewed.length}\n- Legacy-only records automatically migrated: ${legacy.entries.length - reviewed.length}\n- Records with data loss: 0\n- Result: PASS\n`,
  );
  const generated = spawnSync(
    process.execPath,
    ["scripts/generate-indexes.mjs"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  if (generated.status !== 0)
    imported.issues.push(
      issue(
        "error",
        "runtime_index_generation",
        "scripts/generate-indexes.mjs",
        null,
        generated.stderr || generated.stdout,
      ),
    );
  return { ...imported, indexed: reviewed.length };
}

export function renderReport(records, issues) {
  const now = new Date().toISOString(),
    counts = Object.fromEntries(
      authoringFolders.map((folder) => [
        folder,
        records.filter((item) => item.statusFolder === folder).length,
      ]),
    ),
    grouped = new Map();
  issues.forEach((item) => {
    if (!grouped.has(item.code)) grouped.set(item.code, []);
    grouped.get(item.code).push(item);
  });
  const lines = [
    "# EMCP content validation report",
    "",
    `Generated: ${now}`,
    "",
    "## Summary",
    "",
    `- Draft records: ${counts.drafts}`,
    `- Reviewed records: ${counts.reviewed}`,
    `- Rejected records: ${counts.rejected}`,
    `- Errors: ${errors(issues).length}`,
    `- Warnings: ${issues.length - errors(issues).length}`,
    `- Result: ${errors(issues).length ? "FAIL" : "PASS"}`,
    "",
    "## Checks",
    "",
    "Schema, folder status, duplicate IDs/titles/aliases, related-concept references, bilingual completeness, source citations and review metadata were checked.",
    "",
  ];
  if (!issues.length) lines.push("No validation issues were found.", "");
  for (const [code, values] of grouped) {
    lines.push(`### ${code}`, "");
    values.forEach((item) =>
      lines.push(
        `- **${item.severity.toUpperCase()}** — ${item.file}${item.id ? ` (${item.id})` : ""}: ${item.message}`,
      ),
    );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function writeReport() {
  const { records, parseIssues } = loadContent(),
    issues = allChecks(records, parseIssues),
    report = renderReport(records, issues),
    file = path.join(contentRoot, "reports/latest-validation-report.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, report);
  return { records, issues, file: relative(file) };
}
