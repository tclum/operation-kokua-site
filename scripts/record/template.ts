// pnpm record:template: writes the empty intake workbook from the definition.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WORKBOOK_VERSION } from "../../src/record/definition";
import { buildWorkbook, workbookBuffer } from "../../src/record/workbook";

export const TEMPLATE_PATH = path.resolve(__dirname, "..", "..", "record", `operation-kokua-intake-v${WORKBOOK_VERSION}.xlsx`);

export async function writeTemplate(file = TEMPLATE_PATH): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, await workbookBuffer(buildWorkbook()));
}

if (require.main === module) {
  writeTemplate().then(
    () => console.log(`wrote ${path.relative(process.cwd(), TEMPLATE_PATH)}`),
    (e) => {
      console.error(`record:template failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
