// pnpm record:import <file> --kind synthetic --label <text>
//
// Raw first: checks the workbook (refusing on any problem), refuses a file
// whose sha256 is already a batch, inserts one import_batches row, then every
// sheet row into import_rows exactly as read, then the structured rows, each
// carrying its batch and its import row. On any failed insert it deletes the
// batch (the cascade removes the rest) and exits 1. It ends with counts read
// back from the database. `--kind real` is refused in this slice.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildRows, INSERT_ORDER } from "../../src/record/build";
import { checkWorkbook } from "../../src/record/check";
import { parseWorkbook } from "../../src/record/workbook";
import { printCheck } from "./check";

export type ImportArgs = { file: string; kind: "synthetic"; label: string };

const USAGE = "usage: pnpm record:import <file.xlsx> --kind synthetic --label <text>";

/** Parses argv; returns the error line to print (and exit 1 on) instead of args. */
export function parseImportArgs(argv: string[]): ImportArgs | { error: string } {
  let file: string | undefined;
  let kind: string | undefined;
  let label: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind") kind = argv[++i];
    else if (a === "--label") label = argv[++i];
    else if (a.startsWith("--")) return { error: `unknown option ${a}\n${USAGE}` };
    else if (file === undefined) file = a;
    else return { error: `one file only\n${USAGE}` };
  }
  if (kind === "real") return { error: "real imports are not enabled in this slice" };
  if (kind !== "synthetic") return { error: `--kind must be synthetic\n${USAGE}` };
  if (!file) return { error: `a file is required\n${USAGE}` };
  if (!label || label.trim() === "") return { error: `--label is required\n${USAGE}` };
  return { file, kind, label: label.trim() };
}

const CHUNK = 500;

async function main(): Promise<number> {
  const args = parseImportArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(args.error);
    return 1;
  }

  // 1. Offline check; refuse on any problem.
  const data = readFileSync(args.file);
  const parsed = await parseWorkbook(data);
  const result = checkWorkbook(parsed);
  printCheck(args.file, result);
  if (result.problems.length > 0) {
    console.error("Refusing to import: fix the problems above first.");
    return 1;
  }

  // The database is reached only after the offline check passes.
  const { db, describeError } = await import("./db");
  const { countsForBatch, formatCounts } = await import("./counts");
  const { deleteSyntheticBatch } = await import("./batches");

  // 2. Refuse a file already imported.
  const sha256 = createHash("sha256").update(data).digest("hex");
  const { data: existing, error: findError } = await db()
    .from("import_batches")
    .select("id, kind, label")
    .eq("source_sha256", sha256);
  if (findError) {
    console.error(`Could not look for an earlier import: ${describeError(findError)}`);
    return 1;
  }
  if (existing && existing.length > 0) {
    console.error(`Refusing to import: this file (sha256 ${sha256}) is already imported as ${existing.map((b) => `${b.kind} batch "${b.label}" (${b.id})`).join(", ")}.`);
    return 1;
  }

  // 3. The batch row.
  const batchId = randomUUID();
  const { error: batchError } = await db().from("import_batches").insert({
    id: batchId,
    kind: args.kind,
    label: args.label,
    source_filename: path.basename(args.file),
    source_sha256: sha256,
    created_by: "record:import",
  });
  if (batchError) {
    console.error(`Could not create the batch: ${describeError(batchError)}`);
    return 1;
  }

  // 4. Raw rows, then structured rows, in an order where every reference exists.
  const rows = buildRows(parsed, batchId, randomUUID);
  for (const table of INSERT_ORDER) {
    for (let i = 0; i < rows[table].length; i += CHUNK) {
      const chunk = rows[table].slice(i, i + CHUNK);
      // defaultToNull: false so a blank cell (an absent key) takes the
      // column's default ('unknown', 1, 'lot') instead of NULL.
      const { error } = await db().from(table).insert(chunk, { defaultToNull: false });
      if (error) {
        console.error(`Insert into ${table} failed (rows ${i + 1} to ${i + chunk.length}): ${describeError(error)}`);
        try {
          await deleteSyntheticBatch(batchId);
          console.error(`Deleted batch ${batchId}; nothing from this file remains.`);
        } catch (e) {
          console.error(`ALSO FAILED to delete batch ${batchId}: ${e instanceof Error ? e.message : String(e)}. Run pnpm record:purge --kind synthetic.`);
        }
        return 1;
      }
    }
  }

  // 5. Counts read back from the database.
  const counts = await countsForBatch(batchId);
  console.log(`Imported ${args.kind} batch "${args.label}": ${batchId}`);
  console.log("Rows in the database for this batch:");
  console.log(formatCounts(counts));
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`record:import failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
