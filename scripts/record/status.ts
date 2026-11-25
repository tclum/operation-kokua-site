// pnpm record:status: batches by kind, row counts per table by kind, and
// totals_by_basis, all read from the database.

import { db, describeError } from "./db";
import { COUNTED_TABLES, countsForKind } from "./counts";

const KINDS = ["real", "synthetic"] as const;

async function main(): Promise<number> {
  const { data: batches, error } = await db()
    .from("import_batches")
    .select("id, kind, label, created_at")
    .order("created_at");
  if (error) {
    console.error(`Could not list batches: ${describeError(error)}`);
    return 1;
  }
  console.log("Batches by kind:");
  for (const kind of KINDS) {
    const mine = (batches ?? []).filter((b) => b.kind === kind);
    console.log(`  ${kind}: ${mine.length}${mine.length ? ` (${mine.map((b) => `"${b.label}" ${b.id}`).join(", ")})` : ""}`);
  }

  const counts = { real: await countsForKind("real"), synthetic: await countsForKind("synthetic") };
  console.log("Rows per table by kind:");
  console.log(`  ${"table".padEnd(12)} ${"real".padStart(6)} ${"synthetic".padStart(10)}`);
  for (const t of COUNTED_TABLES) {
    console.log(`  ${t.padEnd(12)} ${String(counts.real[t]).padStart(6)} ${String(counts.synthetic[t]).padStart(10)}`);
  }

  const { data: totals, error: totalsError } = await db()
    .from("totals_by_basis")
    .select("kind, basis, handovers, units, amount_usd")
    .order("kind")
    .order("basis");
  if (totalsError) {
    console.error(`Could not read totals_by_basis: ${describeError(totalsError)}`);
    return 1;
  }
  console.log("totals_by_basis:");
  if (!totals || totals.length === 0) console.log("  (no rows)");
  for (const r of totals ?? []) {
    console.log(`  ${String(r.kind).padEnd(10)} ${String(r.basis).padEnd(14)} handovers ${r.handovers}  units ${r.units}  amount_usd ${r.amount_usd}`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`record:status failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
