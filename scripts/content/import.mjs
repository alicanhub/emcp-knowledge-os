import { importReviewed, printResult } from "./lib.mjs";
const result = importReviewed();
printResult(
  "Reviewed content import",
  result.issues,
  result.added + result.matched,
);
if (!process.exitCode)
  console.log(
    `Imported ${result.added} new record(s); matched ${result.matched} backward-compatible legacy record(s).`,
  );
