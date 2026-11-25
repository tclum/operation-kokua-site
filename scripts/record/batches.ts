// Removing a synthetic batch. Only synthetic batches can be named here: every
// delete is filtered on kind = 'synthetic' as well as the id.

import { db, describeError } from "./db";

/**
 * Deletes one synthetic batch and everything in it. Handovers go first: their
 * recipient_id is ON DELETE RESTRICT, so this does not rely on the order in
 * which the cascade from import_batches reaches recipients and handovers.
 * Deleting the batch row then cascades to every other row of the batch.
 */
export async function deleteSyntheticBatch(batchId: string): Promise<void> {
  const { data: batch, error: findError } = await db()
    .from("import_batches")
    .select("id")
    .eq("id", batchId)
    .eq("kind", "synthetic")
    .maybeSingle();
  if (findError) throw new Error(`finding batch ${batchId}: ${describeError(findError)}`);
  if (!batch) throw new Error(`no synthetic batch ${batchId}`);

  const { error: handoverError } = await db().from("handovers").delete().eq("batch_id", batchId);
  if (handoverError) throw new Error(`deleting handovers of ${batchId}: ${describeError(handoverError)}`);

  const { error } = await db().from("import_batches").delete().eq("id", batchId).eq("kind", "synthetic");
  if (error) throw new Error(`deleting batch ${batchId}: ${describeError(error)}`);
}
