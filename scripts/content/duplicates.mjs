import { loadContent, printResult, validateDuplicates } from "./lib.mjs";
const { records, parseIssues } = loadContent();
printResult(
  "Content duplicate validation",
  [...parseIssues, ...validateDuplicates(records)],
  records.length,
);
