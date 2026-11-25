// pnpm record:check <file> [--kind synthetic|real] | --selftest
// Parses and validates an intake workbook offline, read as the given kind
// (default synthetic). Touches no network. Exits 1 on any problem.

import { readFileSync } from "node:fs";
import { SHEETS } from "../../src/record/definition";
import { checkWorkbook, formatProblem, RECORD_KINDS, type CheckResult, type RecordKind } from "../../src/record/check";
import { runSelftest } from "../../src/record/selftest";
import { parseWorkbook } from "../../src/record/workbook";

export async function checkFile(file: string, kind: RecordKind = "synthetic"): Promise<CheckResult> {
  return checkWorkbook(await parseWorkbook(readFileSync(file)), kind);
}

export function printCheck(file: string, result: CheckResult, kind: RecordKind = "synthetic"): void {
  console.log(`record:check ${file} (as ${kind})`);
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
  const usage = "usage: pnpm record:check <file.xlsx> [--kind synthetic|real] | --selftest";
  let file: string | undefined;
  let kind: RecordKind = "synthetic";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kind") {
      const k = args[++i];
      if (!RECORD_KINDS.includes(k as RecordKind)) {
        console.error(`--kind must be synthetic or real\n${usage}`);
        return 1;
      }
      kind = k as RecordKind;
    } else if (args[i].startsWith("--") || file !== undefined) {
      console.error(usage);
      return 1;
    } else file = args[i];
  }
  if (!file) {
    console.error(usage);
    return 1;
  }
  const result = await checkFile(file, kind);
  printCheck(file, result, kind);
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
