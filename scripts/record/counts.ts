// Row counts read from the database, by batch or by batch kind.

import { db, describeError } from "./db";

export const COUNTED_TABLES = [
  "import_rows",
  "sources",
  "recipients",
  "trips",
  "items",
  "valuations",
  "shipments",
  "handovers",
  "followups",
  "documents",
] as const;

export type CountedTable = (typeof COUNTED_TABLES)[number];

/** How a table reaches import_batches: directly, or through its parent. */
const PATH: Record<CountedTable, { select: string; prefix: string }> = {
  import_rows: { select: "id, import_batches!inner(kind)", prefix: "" },
  sources: { select: "id, import_batches!inner(kind)", prefix: "" },
  recipients: { select: "id, import_batches!inner(kind)", prefix: "" },
  trips: { select: "id, import_batches!inner(kind)", prefix: "" },
  items: { select: "id, import_batches!inner(kind)", prefix: "" },
  shipments: { select: "id, import_batches!inner(kind)", prefix: "" },
  handovers: { select: "id, import_batches!inner(kind)", prefix: "" },
  documents: { select: "id, import_batches!inner(kind)", prefix: "" },
  valuations: { select: "id, items!inner(batch_id, import_batches!inner(kind))", prefix: "items." },
  followups: { select: "id, handovers!inner(batch_id, import_batches!inner(kind))", prefix: "handovers." },
};

async function count(table: CountedTable, filter: { column: "batch_id" | "kind"; value: string }): Promise<number> {
  const p = PATH[table];
  const column = filter.column === "kind" ? `${p.prefix}import_batches.kind` : `${p.prefix}batch_id`;
  const { count: n, error } = await db().from(table).select(p.select, { count: "exact", head: true }).eq(column, filter.value);
  if (error) throw new Error(`counting ${table}: ${describeError(error)}`);
  return n ?? 0;
}

export async function countsForBatch(batchId: string): Promise<Record<CountedTable, number>> {
  const out = {} as Record<CountedTable, number>;
  for (const t of COUNTED_TABLES) out[t] = await count(t, { column: "batch_id", value: batchId });
  return out;
}

export async function countsForKind(kind: "synthetic" | "real"): Promise<Record<CountedTable, number>> {
  const out = {} as Record<CountedTable, number>;
  for (const t of COUNTED_TABLES) out[t] = await count(t, { column: "kind", value: kind });
  return out;
}

export function formatCounts(c: Record<string, number>): string {
  return Object.entries(c)
    .map(([t, n]) => `  ${t.padEnd(12)} ${n}`)
    .join("\n");
}
