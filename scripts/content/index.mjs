import { generateContentIndexes, printResult } from "./lib.mjs";
const result = generateContentIndexes();
printResult("Content index generation", result.issues, result.indexed || 0);
if (!process.exitCode)
  console.log(
    `Generated category, search and relationship indexes for ${result.indexed} reviewed record(s).`,
  );
