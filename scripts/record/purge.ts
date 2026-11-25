// pnpm record:purge --kind synthetic
// Deletes every synthetic batch. It takes no batch id or label, and the only
// kind it accepts is synthetic, so it has no way to name a real batch.

import { db, describeError } from "./db";
import { deleteSyntheticBatch } from "./batches";
import { countsForKind, formatCounts } from "./counts";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length !== 2 || argv[0] !== "--kind" || argv[1] !== "synthetic") {
    console.error("usage: pnpm record:purge --kind synthetic");
    return 1;
  }
  console.log("Synthetic rows before:");
  console.log(formatCounts(await countsForKind("synthetic")));

  const { data: batches, error } = await db()
    .from("import_batches")
    .select("id, label, created_at")
    .eq("kind", "synthetic")
    .order("created_at");
  if (error) {
    console.error(`Could not list synthetic batches: ${describeError(error)}`);
    return 1;
  }
  if (!batches || batches.length === 0) console.log("No synthetic batches.");
  for (const b of batches ?? []) {
    await deleteSyntheticBatch(b.id);
    console.log(`Deleted synthetic batch "${b.label}" (${b.id})`);
  }

  console.log("Synthetic rows after:");
  console.log(formatCounts(await countsForKind("synthetic")));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`record:purge failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
