import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { loadContent, loadLegacy } from "./lib.mjs";

const mode = process.argv[2] || "all";
const root = process.cwd();
const directories = {
  topic: "content/topics",
  learning_module: "content/modules",
  content_pack: "content/packs",
  learning_path: "content/paths",
  handbook: "content/handbooks",
  handbook_chapter: "content/handbooks",
  case_study: "content/case-studies",
  checklist: "content/checklists",
  document_guide: "content/document-guides",
};
const files = (folder) =>
  fs.existsSync(folder)
    ? fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(folder, entry.name);
        return entry.isDirectory()
          ? files(target)
          : entry.isFile() && entry.name.endsWith(".json")
            ? [target]
            : [];
      })
    : [];
const publishingFiles = [...new Set(Object.values(directories).flatMap(files))];
const objects = publishingFiles.flatMap((file) => {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  return (Array.isArray(value) ? value : [value]).map((record) => ({
    record,
    file: path.relative(root, file),
  }));
});
const issues = [];
const fail = (code, item, message) =>
  issues.push({ code, file: item.file, id: item.record?.id || null, message });

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const base = JSON.parse(
  fs.readFileSync("schemas/publishing-object.schema.json", "utf8"),
);
ajv.addSchema(base);
const validate = ajv.getSchema(base.$id);
for (const item of objects) {
  if (!validate(item.record))
    for (const error of validate.errors || [])
      fail("schema", item, `${error.instancePath || "/"} ${error.message}`);
  if (item.record.object_type === "handbook_chapter") {
    for (const field of [
      "chapter_number",
      "simple_explanation",
      "professional_explanation",
      "real_world_example",
      "worked_example",
      "formulas",
      "common_mistakes",
      "risks",
      "checklist",
      "uk_practice",
      "turkey_practice",
      "beginner_questions",
      "interview_questions",
      "quiz",
      "next_recommended_chapter",
    ])
      if (!(field in item.record))
        fail("chapter_schema", item, `Missing ${field}.`);
  }
}

const ids = new Map();
for (const item of objects) {
  if (!item.record.id) continue;
  if (ids.has(item.record.id))
    fail("duplicate_id", item, `Duplicate of ${ids.get(item.record.id)}.`);
  else ids.set(item.record.id, item.file);
}
const chapterNumbers = new Map();
for (const item of objects.filter(
  ({ record }) => record.object_type === "handbook_chapter",
)) {
  if (chapterNumbers.has(item.record.chapter_number))
    fail(
      "duplicate_chapter_number",
      item,
      `Chapter number duplicates ${chapterNumbers.get(item.record.chapter_number)}.`,
    );
  else chapterNumbers.set(item.record.chapter_number, item.record.id);
}

const authored = loadContent({ folders: ["reviewed"] }).records.map(
  ({ record }) => record,
);
const knowledgeIds = new Set(authored.map((record) => record.id));
const knowledgeTerms = new Set(
  loadLegacy().entries.map(({ entry }) => entry.term),
);
const calculators = new Set([
  "LTV",
  "LTC",
  "LTGDV",
  "ROI",
  "Rental Yield",
  "Development Profit",
  "Monthly Loan Payment",
  "Arrangement Fee",
  "Interest Roll-up",
  "Concrete Volume",
  "Paint Area",
  "Flooring Area",
  "Plasterboard Sheets",
  "Insulation Area",
  "Tiles Quantity",
]);
const referenceFields = [
  "prerequisites",
  "related_topics",
  "related_documents",
  "related_case_studies",
  "child_topics",
  "child_modules",
  "child_packs",
  "child_paths",
  "chapters",
];
for (const item of objects) {
  for (const field of referenceFields)
    for (const reference of item.record[field] || [])
      if (!ids.has(reference))
        fail(
          "broken_content_link",
          item,
          `${field} references missing ${reference}.`,
        );
  if (item.record.checklist && !ids.has(item.record.checklist))
    fail(
      "broken_content_link",
      item,
      `checklist references missing ${item.record.checklist}.`,
    );
  if (
    item.record.next_recommended_chapter &&
    !ids.has(item.record.next_recommended_chapter)
  )
    fail(
      "broken_content_link",
      item,
      `next chapter references missing ${item.record.next_recommended_chapter}.`,
    );
  for (const reference of item.record.related_knowledge_entries || [])
    if (!knowledgeIds.has(reference) && !knowledgeTerms.has(reference))
      fail(
        "broken_knowledge_reference",
        item,
        `Unknown knowledge entry ${reference}.`,
      );
  for (const reference of item.record.related_calculators || [])
    if (!calculators.has(reference))
      fail(
        "broken_calculator_reference",
        item,
        `Unknown calculator ${reference}.`,
      );
  const bilingualFields = ["title", "summary", "learning_objectives"];
  for (const field of bilingualFields)
    if (!item.record[field]?.en?.length || !item.record[field]?.tr?.length)
      fail(
        "bilingual_incomplete",
        item,
        `${field} requires English and Turkish.`,
      );
}

const roadmapFile = "content/roadmaps/master-content-roadmap.json";
if (!fs.existsSync(roadmapFile))
  issues.push({
    code: "roadmap",
    file: roadmapFile,
    id: null,
    message: "Roadmap is missing.",
  });
else {
  const roadmap = JSON.parse(fs.readFileSync(roadmapFile, "utf8"));
  if (roadmap.packs?.length !== 100)
    issues.push({
      code: "roadmap",
      file: roadmapFile,
      id: null,
      message: "Roadmap must contain exactly 100 packs.",
    });
  const numbers = new Set(roadmap.packs?.map((pack) => pack.pack_number));
  for (let number = 1; number <= 100; number++)
    if (!numbers.has(number))
      issues.push({
        code: "roadmap",
        file: roadmapFile,
        id: null,
        message: `Missing pack ${number}.`,
      });
  for (const pack of roadmap.packs || [])
    if (!pack.title?.en || !pack.title?.tr || pack.planned_entry_count < 1)
      issues.push({
        code: "roadmap",
        file: roadmapFile,
        id: `pack.${pack.pack_number}`,
        message: "Incomplete roadmap pack.",
      });
}

const modeCodes = {
  schema: ["schema", "chapter_schema"],
  references: ["broken_content_link"],
  duplicates: ["duplicate_id", "duplicate_chapter_number"],
  bilingual: ["bilingual_incomplete"],
  calculators: ["broken_calculator_reference"],
  knowledge: ["broken_knowledge_reference"],
  roadmap: ["roadmap"],
};
const shown =
  mode === "all"
    ? issues
    : issues.filter((issue) => modeCodes[mode]?.includes(issue.code));
for (const issue of shown)
  console.error(
    `ERROR ${issue.code} ${issue.file}${issue.id ? ` (${issue.id})` : ""}: ${issue.message}`,
  );
console.log(
  `Publishing ${mode} validation: ${objects.length} object(s), ${shown.length} error(s).`,
);
if (shown.length) process.exitCode = 1;
