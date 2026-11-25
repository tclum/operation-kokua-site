// pnpm record:synthetic: writes the synthetic workbooks (one from a fixed
// seed, one with defaulted cells blank) and the rehearsal workbook, for dry
// runs only. Every file is the same bytes on every run.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SHEETS, WORKBOOK_VERSION } from "../../src/record/definition";
import { rehearsalRows, rehearsalWorkbook } from "../../src/record/rehearsal";
import { SYNTHETIC_SEED, syntheticBlanksRows, syntheticBlanksWorkbook, syntheticRows, syntheticWorkbook } from "../../src/record/synthetic";
import { workbookBuffer } from "../../src/record/workbook";

const RECORD_DIR = path.resolve(__dirname, "..", "..", "record");
export const SYNTHETIC_PATH = path.join(RECORD_DIR, `synthetic-v${WORKBOOK_VERSION}.xlsx`);
export const SYNTHETIC_BLANKS_PATH = path.join(RECORD_DIR, `synthetic-blanks-v${WORKBOOK_VERSION}.xlsx`);
export const REHEARSAL_PATH = path.join(RECORD_DIR, `rehearsal-real-v${WORKBOOK_VERSION}.xlsx`);

export async function writeSynthetic(file = SYNTHETIC_PATH, blanksFile = SYNTHETIC_BLANKS_PATH, rehearsalFile = REHEARSAL_PATH): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, await workbookBuffer(syntheticWorkbook()));
  writeFileSync(blanksFile, await workbookBuffer(syntheticBlanksWorkbook()));
  writeFileSync(rehearsalFile, await workbookBuffer(rehearsalWorkbook()));
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
      const rehearsal = rehearsalRows();
      console.log(`wrote ${path.relative(process.cwd(), REHEARSAL_PATH)} (rehearsal for dry runs only; the importer refuses to commit it)`);
      for (const s of SHEETS) console.log(`  ${s.name.padEnd(11)} ${rehearsal[s.name].length} rows`);
    },
    (e) => {
      console.error(`record:synthetic failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
