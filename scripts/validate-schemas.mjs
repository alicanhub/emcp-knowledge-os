import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "node:fs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(read("schemas/scenario.schema.json"));
ajv.addSchema(read("schemas/collection.schema.json"));
ajv.addSchema(read("schemas/publishing-object.schema.json"));
for (const name of [
  "topic",
  "learning-module",
  "content-pack",
  "learning-path",
  "handbook",
  "handbook-chapter",
  "case-study",
  "checklist",
  "document-guide",
  "content-job",
  "content-queue",
  "source-research",
  "content-review",
])
  ajv.compile(read(`schemas/${name}.schema.json`));
const validateIndex = ajv.compile(read("schemas/knowledge-index.schema.json"));
const validateEntry = ajv.compile(read("schemas/knowledge-entry.schema.json"));
const validateContentEntry = ajv.compile(
  read("schemas/content-entry.schema.json"),
);
const validateTranslations = ajv.compile(
  read("schemas/knowledge-translations.schema.json"),
);
const validateSearchIndex = ajv.compile(
  read("schemas/knowledge-search-index.schema.json"),
);
const validateRelationships = ajv.compile(
  read("schemas/knowledge-relationships.schema.json"),
);
const validateDetails = ajv.compile(
  read("schemas/knowledge-details.schema.json"),
);
const validateRuntime = ajv.compile(read("schemas/runtime-config.schema.json"));
const validateBackup = ajv.compile(
  read("schemas/workspace-backup.schema.json"),
);
const index = read("data/knowledge/index.json");
if (!validateIndex(index))
  throw new Error(ajv.errorsText(validateIndex.errors));
for (const category of index.categories) {
  const entries = read(`data/knowledge/${category.file}`);
  for (const entry of entries)
    if (!validateEntry(entry))
      throw new Error(
        `${category.file}: ${ajv.errorsText(validateEntry.errors)}`,
      );
}
for (const folder of ["drafts", "reviewed", "rejected"]) {
  const location = `content/${folder}`;
  if (!fs.existsSync(location)) continue;
  for (const name of fs
    .readdirSync(location)
    .filter((file) => file.endsWith(".json"))) {
    const entry = read(`${location}/${name}`);
    if (!validateContentEntry(entry))
      throw new Error(
        `${location}/${name}: ${ajv.errorsText(validateContentEntry.errors)}`,
      );
  }
}
if (!validateTranslations(read(`data/knowledge/${index.translations}`)))
  throw new Error(ajv.errorsText(validateTranslations.errors));
if (!validateSearchIndex(read(`data/knowledge/${index.searchIndex}`)))
  throw new Error(ajv.errorsText(validateSearchIndex.errors));
if (!validateRelationships(read(`data/knowledge/${index.relationships}`)))
  throw new Error(ajv.errorsText(validateRelationships.errors));
if (!validateDetails(read(`data/knowledge/${index.details}`)))
  throw new Error(ajv.errorsText(validateDetails.errors));
if (!validateRuntime(read("config/runtime.json")))
  throw new Error(ajv.errorsText(validateRuntime.errors));
const sample = {
  format: "emcp-workspace",
  version: 1,
  exportedAt: new Date().toISOString(),
  data: {
    favourites: [],
    recent: [],
    collections: [],
    notes: {},
    scenarios: [],
    preferences: { language: "en", theme: "light" },
  },
};
if (!validateBackup(sample))
  throw new Error(ajv.errorsText(validateBackup.errors));
console.log("JSON Schema validation passed.");
