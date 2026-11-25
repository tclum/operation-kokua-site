// Removing one batch's own rows. Every delete is filtered on the batch id (and
// the batch row on its kind as well), so nothing of another batch is touched:
// a real batch's matched rows belong to the batch that first inserted them.
//
// Who calls this: `record:purge` with kind synthetic only (it takes no id or
// label and accepts no other kind, so it cannot name a real batch), and
// `record:import` to undo its own failed import, with the kind it imported.

import { db, describeError } from "./db";

/**
 * Deletes what one import inserted. Handovers go first: their recipient_id is
 * ON DELETE RESTRICT, so this does not rely on the order in which the cascade
 * from import_batches reaches recipients and handovers. Deleting the batch row
 * then cascades to every other row carrying this batch_id, and only those.
 */
export async function deleteImportedBatch(batchId: string, kind: "synthetic" | "real"): Promise<void> {
  const { data: batch, error: findError } = await db()
    .from("import_batches")
    .select("id")
    .eq("id", batchId)
    .eq("kind", kind)
    .maybeSingle();
  if (findError) throw new Error(`finding batch ${batchId}: ${describeError(findError)}`);
  if (!batch) throw new Error(`no ${kind} batch ${batchId}`);

  const { error: handoverError } = await db().from("handovers").delete().eq("batch_id", batchId);
  if (handoverError) throw new Error(`deleting handovers of ${batchId}: ${describeError(handoverError)}`);

  const { error } = await db().from("import_batches").delete().eq("id", batchId).eq("kind", kind);
  if (error) throw new Error(`deleting batch ${batchId}: ${describeError(error)}`);
}
