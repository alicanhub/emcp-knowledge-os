import { loadContent, printResult, validateSources } from "./lib.mjs";
const { records, parseIssues } = loadContent();
printResult(
  "Content source validation",
  [...parseIssues, ...validateSources(records)],
  records.length,
);
