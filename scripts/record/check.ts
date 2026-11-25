// pnpm record:check <file> | --selftest
// Parses and validates an intake workbook offline. Touches no network.
// Exits 1 on any problem.

import { readFileSync } from "node:fs";
import { SHEETS } from "../../src/record/definition";
import { checkWorkbook, formatProblem, type CheckResult } from "../../src/record/check";
import { runSelftest } from "../../src/record/selftest";
import { parseWorkbook } from "../../src/record/workbook";

export async function checkFile(file: string): Promise<CheckResult> {
  return checkWorkbook(await parseWorkbook(readFileSync(file)));
}

export function printCheck(file: string, result: CheckResult): void {
  console.log(`record:check ${file}`);
  for (const s of SHEETS) console.log(`  ${s.name.padEnd(11)} ${result.counts[s.name]} rows`);
  if (result.problems.length === 0) {
    console.log("No problems.");
    return;
  }
  console.log(`${result.problems.length} problem(s):`);
  for (const p of result.problems) console.log(`  ${formatProblem(p)}`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args[0] === "--selftest") {
    const { pass, lines } = await runSelftest();
    for (const l of lines) console.log(`${l.ok ? "ok  " : "FAIL"} ${l.name}: ${l.detail}`);
    console.log(`RESULT: ${pass ? "pass" : "FAIL"}`);
    return pass ? 0 : 1;
  }
  if (args.length !== 1) {
    console.error("usage: pnpm record:check <file.xlsx> | --selftest");
    return 1;
  }
  const result = await checkFile(args[0]);
  printCheck(args[0], result);
  return result.problems.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`record:check failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
