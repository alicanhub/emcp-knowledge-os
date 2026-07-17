import { loadContent, printResult, validateReferences } from "./lib.mjs";
const { records, parseIssues } = loadContent();
printResult(
  "Content reference validation",
  [...parseIssues, ...validateReferences(records)],
  records.length,
);
