import { loadContent, printResult, validateBilingual } from "./lib.mjs";
const { records, parseIssues } = loadContent();
printResult(
  "Content bilingual validation",
  [...parseIssues, ...validateBilingual(records)],
  records.length,
);
