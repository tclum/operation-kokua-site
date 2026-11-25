// pnpm record:import <file> --kind synthetic|real --label <text>
//   [--dry-run] [--received-from <text>] [--received-on <YYYY-MM-DD>] [--note <text>]
//
// Raw first: checks the workbook as its kind (refusing on any problem),
// refuses a file whose sha256 is already a batch, and for a real workbook
// resolves it against the real record (src/record/resolve.ts). It prints the
// plan. Then it inserts one import_batches row, every sheet row into
// import_rows exactly as read, then the structured rows, each carrying its
// batch and its import row; a matched row is not inserted, and rows pointing
// at it carry the existing id. On any failed insert it removes only what it
// inserted (deleteImportedBatch) and exits 1. It ends with counts read back.
//
// --dry-run, for either kind: everything up to and including the plan, then
// `DRY RUN: nothing was written`. It writes nothing.
//
// --kind real without --dry-run is for a person only: standard input must be
// an interactive terminal, and the person types the batch label exactly to
// proceed. Without a terminal it exits 1 before reading the file or making
// any request. There is no flag, variable or other way around this.
//
// A workbook with a REHEARSAL name or a rehearsal- slug is never committed,
// whatever the kind; it may be dry-run.

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { buildRows, INSERT_ORDER, type BuiltRows } from "../../src/record/build";
import { checkWorkbook, formatProblem, isIsoDate, RECORD_KINDS, type RecordKind } from "../../src/record/check";
import { SHEETS } from "../../src/record/definition";
import { rehearsalMarkers } from "../../src/record/rehearsal";
import { resolveWorkbook, type Resolution, type Snapshot } from "../../src/record/resolve";
import { parseWorkbook, type ParsedWorkbook } from "../../src/record/workbook";
import { printCheck } from "./check";

export type ImportArgs = {
  file: string;
  kind: RecordKind;
  label: string;
  dryRun: boolean;
  receivedFrom?: string;
  receivedOn?: string;
  note?: string;
};

const USAGE =
  "usage: pnpm record:import <file.xlsx> --kind synthetic|real --label <text> [--dry-run] [--received-from <text>] [--received-on <YYYY-MM-DD>] [--note <text>]";

export const NEEDS_TERMINAL = "a real import needs a person at a terminal; use --dry-run to rehearse";
export const DRY_RUN_DONE = "DRY RUN: nothing was written";

/** Parses argv; returns the error line to print (and exit 1 on) instead of args. */
export function parseImportArgs(argv: string[]): ImportArgs | { error: string } {
  let file: string | undefined;
  const opts: Record<string, string> = {};
  let dryRun = false;
  const valued = ["--kind", "--label", "--received-from", "--received-on", "--note"];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (valued.includes(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) return { error: `${a} needs a value\n${USAGE}` };
      opts[a] = v;
    } else if (a.startsWith("--")) return { error: `unknown option ${a}\n${USAGE}` };
    else if (file === undefined) file = a;
    else return { error: `one file only\n${USAGE}` };
  }
  const kind = opts["--kind"];
  if (!RECORD_KINDS.includes(kind as RecordKind)) return { error: `--kind must be synthetic or real\n${USAGE}` };
  if (!file) return { error: `a file is required\n${USAGE}` };
  const label = opts["--label"]?.trim();
  if (!label) return { error: `--label is required\n${USAGE}` };
  const receivedOn = opts["--received-on"]?.trim();
  if (receivedOn !== undefined && !isIsoDate(receivedOn)) return { error: `--received-on must be a date written like 2026-11-25\n${USAGE}` };
  const out: ImportArgs = { file, kind: kind as RecordKind, label, dryRun };
  const receivedFrom = opts["--received-from"]?.trim();
  const note = opts["--note"]?.trim();
  if (receivedFrom) out.receivedFrom = receivedFrom;
  if (receivedOn) out.receivedOn = receivedOn;
  if (note) out.note = note;
  return out;
}

const CHUNK = 500;
const PAGE = 1000;

type Db = Awaited<typeof import("./db")>;

/** Every row of a real-batch query, a page at a time. */
async function allReal<T>(conn: Db, table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await conn
      .db()
      .from(table)
      .select(`${columns}, import_batches!inner(kind, label)`)
      .eq("import_batches.kind", "real")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`reading real ${table}: ${conn.describeError(error)}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

type WithBatch = { import_batches: { label: string } };

/** The real record's trips, recipients and sources, for the resolver. */
async function fetchRealSnapshot(conn: Db): Promise<Snapshot> {
  type T = { id: string; slug: string; title: string; year: number; country: string } & WithBatch;
  type R = { id: string; name: string; department: string | null; city: string | null; country: string } & WithBatch;
  type S = { id: string; name: string; country: string | null } & WithBatch;
  const [trips, recipients, sources] = await Promise.all([
    allReal<T>(conn, "trips", "id, slug, title, year, country"),
    allReal<R>(conn, "recipients", "id, name, department, city, country"),
    allReal<S>(conn, "sources", "id, name, country"),
  ]);
  return {
    trips: trips.map(({ import_batches, ...t }) => ({ ...t, batchLabel: import_batches.label })),
    recipients: recipients.map(({ import_batches, ...r }) => ({ ...r, batchLabel: import_batches.label })),
    sources: sources.map(({ import_batches, ...s }) => ({ ...s, batchLabel: import_batches.label })),
  };
}

/** The plan: per sheet new and matched, each matched row, direct trip refs, rows to insert. */
export function formatPlan(args: ImportArgs, sha256: string, wb: ParsedWorkbook, rows: BuiltRows, resolution?: Resolution): string {
  const lines: string[] = [];
  lines.push(`Plan: ${args.kind} batch "${args.label}" from ${path.basename(args.file)} (sha256 ${sha256})`);
  if (args.receivedFrom || args.receivedOn || args.note) {
    lines.push(`  received_from ${args.receivedFrom ?? "-"}, received_on ${args.receivedOn ?? "-"}, note ${args.note ?? "-"}`);
  }
  if (!resolution) lines.push("  synthetic: joins only to rows of its own batch, so every row is new");
  lines.push(`  ${"sheet".padEnd(11)} ${"new".padStart(5)} ${"matched".padStart(8)}`);
  for (const s of SHEETS) {
    const matched = resolution ? resolution.rows.filter((r) => r.sheet === s.name && r.outcome === "matched").length : 0;
    lines.push(`  ${s.name.padEnd(11)} ${String(wb.sheets[s.name].length - matched).padStart(5)} ${String(matched).padStart(8)}`);
  }
  if (resolution) {
    const matched = resolution.rows.filter((r) => r.outcome === "matched");
    lines.push("Matched rows (not inserted and not changed; rows that point at them carry the existing id):");
    if (matched.length === 0) lines.push("  (none)");
    for (const m of matched) if (m.outcome === "matched") lines.push(`  ${m.sheet}, ${m.row}: matched ${m.what} [${m.id}] (${m.batchLabel})`);
    lines.push("Existing trips named directly, with no Trips row:");
    if (resolution.directTrips.length === 0) lines.push("  (none)");
    for (const d of resolution.directTrips) lines.push(`  ${d.sheet}, ${d.row}: trip_slug ${d.slug} -> existing trip [${d.id}] (${d.batchLabel})`);
    const used = new Map<string, string>();
    for (const m of matched) if (m.outcome === "matched" && m.sheet === "Trips") used.set(m.what.replace(/^trip /, ""), m.batchLabel);
    for (const d of resolution.directTrips) used.set(d.slug, d.batchLabel);
    lines.push(`Existing real trips this batch points at: ${used.size === 0 ? "none" : [...used].map(([slug, label]) => `${slug} (${label})`).join(", ")}`);
  }
  lines.push("Rows it would insert:");
  lines.push(`  ${"import_batches".padEnd(14)} 1`);
  for (const t of INSERT_ORDER) lines.push(`  ${t.padEnd(14)} ${rows[t].length}`);
  return lines.join("\n");
}

async function confirmAtTerminal(label: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`This writes a REAL batch to the Operation Kokua record. Type the batch label exactly to proceed (${JSON.stringify(label)}), or anything else to stop: `);
    return answer === label;
  } finally {
    rl.close();
  }
}

export async function runImport(argv: string[]): Promise<number> {
  const args = parseImportArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    return 1;
  }
  // A real batch is committed only by a person at a terminal. Checked before
  // the file is read or any request is made.
  if (args.kind === "real" && !args.dryRun && process.stdin.isTTY !== true) {
    console.error(NEEDS_TERMINAL);
    return 1;
  }
  if (!args.dryRun) return importFile(args);
  try {
    return await importFile(args);
  } finally {
    console.log(DRY_RUN_DONE);
  }
}

async function importFile(args: ImportArgs): Promise<number> {
  // 1. Read; refuse to commit a rehearsal workbook, whatever the kind.
  const data = readFileSync(args.file);
  const parsed = await parseWorkbook(data);
  const markers = rehearsalMarkers(parsed);
  if (markers.length > 0) {
    const shown = markers.slice(0, 3).join("; ") + (markers.length > 3 ? `; and ${markers.length - 3} more` : "");
    if (!args.dryRun) {
      console.error(`Refusing to import: this is a rehearsal workbook (${shown}). It may be dry-run, never committed.`);
      return 1;
    }
    console.log(`Note: this is a rehearsal workbook (${shown}); it may be dry-run, never committed.`);
  }

  // 2. Offline check as the stated kind; refuse on any problem.
  const result = checkWorkbook(parsed, args.kind);
  printCheck(args.file, result, args.kind);
  if (result.problems.length > 0) {
    console.error("Refusing to import: fix the problems above first.");
    return 1;
  }

  // The database is reached only after the offline checks pass.
  const conn = await import("./db");
  const { db, describeError } = conn;

  // 3. Refuse a file already imported.
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

  // 4. A real workbook resolves against the real record; a synthetic one never does.
  let resolution: Resolution | undefined;
  if (args.kind === "real") {
    resolution = resolveWorkbook(parsed, await fetchRealSnapshot(conn));
    if (resolution.problems.length > 0) {
      console.error(`${resolution.problems.length} problem(s) against the record:`);
      for (const p of resolution.problems) console.error(`  ${formatProblem(p)}`);
      console.error("Refusing to import: fix the problems above first.");
      return 1;
    }
  }

  // 5. The plan.
  const batchId = randomUUID();
  const rows = buildRows(parsed, batchId, randomUUID, resolution);
  console.log(formatPlan(args, sha256, parsed, rows, resolution));
  if (args.dryRun) return 0;

  // 6. A real batch goes ahead only when the person types its label.
  if (args.kind === "real" && !(await confirmAtTerminal(args.label))) {
    console.error("Not confirmed: nothing was written.");
    return 1;
  }

  const { countsForBatch, formatCounts } = await import("./counts");
  const { deleteImportedBatch } = await import("./batches");

  // 7. The batch row.
  const { error: batchError } = await db().from("import_batches").insert({
    id: batchId,
    kind: args.kind,
    label: args.label,
    source_filename: path.basename(args.file),
    source_sha256: sha256,
    received_from: args.receivedFrom,
    received_on: args.receivedOn,
    note: args.note,
    created_by: "record:import",
  });
  if (batchError) {
    console.error(`Could not create the batch: ${describeError(batchError)}`);
    return 1;
  }

  // 8. Raw rows, then structured rows, in an order where every reference exists.
  for (const table of INSERT_ORDER) {
    for (let i = 0; i < rows[table].length; i += CHUNK) {
      const chunk = rows[table].slice(i, i + CHUNK);
      // defaultToNull: false so a blank cell (an absent key) takes the
      // column's default ('unknown', 1, 'lot') instead of NULL.
      const { error } = await db().from(table).insert(chunk, { defaultToNull: false });
      if (error) {
        console.error(`Insert into ${table} failed (rows ${i + 1} to ${i + chunk.length}): ${describeError(error)}`);
        try {
          await deleteImportedBatch(batchId, args.kind);
          console.error(`Deleted batch ${batchId} and only what it inserted; nothing from this file remains.`);
        } catch (e) {
          console.error(`ALSO FAILED to delete batch ${batchId}: ${e instanceof Error ? e.message : String(e)}.`);
        }
        return 1;
      }
    }
  }

  // 9. Counts read back from the database.
  const counts = await countsForBatch(batchId);
  console.log(`Imported ${args.kind} batch "${args.label}": ${batchId}`);
  console.log("Rows in the database for this batch:");
  console.log(formatCounts(counts));
  return 0;
}

if (require.main === module) {
  runImport(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`record:import failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
