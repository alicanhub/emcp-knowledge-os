import { printResult, writeReport } from "./lib.mjs";
const result = writeReport();
printResult("Content report", result.issues, result.records.length);
console.log(`Wrote ${result.file}.`);
