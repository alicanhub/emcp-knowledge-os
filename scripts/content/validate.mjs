import { loadContent, printResult, validateSchema } from "./lib.mjs";
const { records, parseIssues } = loadContent();
printResult(
  "Content schema validation",
  [...parseIssues, ...validateSchema(records)],
  records.length,
);
