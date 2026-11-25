// pnpm record:synthetic: writes the synthetic workbook from a fixed seed.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SHEETS } from "../../src/record/definition";
import { SYNTHETIC_SEED, syntheticBlanksRows, syntheticBlanksWorkbook, syntheticRows, syntheticWorkbook } from "../../src/record/synthetic";
import { workbookBuffer } from "../../src/record/workbook";

export const SYNTHETIC_PATH = path.resolve(__dirname, "..", "..", "record", "synthetic-v1.xlsx");
export const SYNTHETIC_BLANKS_PATH = path.resolve(__dirname, "..", "..", "record", "synthetic-blanks-v1.xlsx");

export async function writeSynthetic(file = SYNTHETIC_PATH, blanksFile = SYNTHETIC_BLANKS_PATH): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, await workbookBuffer(syntheticWorkbook()));
  writeFileSync(blanksFile, await workbookBuffer(syntheticBlanksWorkbook()));
}

if (require.main === module) {
  writeSynthetic().then(
    () => {
      const rows = syntheticRows();
      console.log(`wrote ${path.relative(process.cwd(), SYNTHETIC_PATH)} (seed ${SYNTHETIC_SEED})`);
      for (const s of SHEETS) console.log(`  ${s.name.padEnd(11)} ${rows[s.name].length} rows`);
      const blanks = syntheticBlanksRows();
      console.log(`wrote ${path.relative(process.cwd(), SYNTHETIC_BLANKS_PATH)} (no seed: fixed rows, defaulted cells blank)`);
      for (const s of SHEETS) console.log(`  ${s.name.padEnd(11)} ${blanks[s.name].length} rows`);
    },
    (e) => {
      console.error(`record:synthetic failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
