import "server-only";

// The one module under src/ that holds the secret-key client. It exports read
// functions only: nothing here inserts, updates, upserts or deletes, and a
// test holds that. Pages call these only after requireAdmin() has passed;
// the guard itself calls isListedAdmin(). Nothing under src/components
// imports this file, and no client component imports anything in src/lib/admin.
// Every read is filtered to one batch kind; the two kinds never mix.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminEnv, NOT_CONFIGURED } from "./env";
import type { Kind } from "./paths";
import {
  type BasisTotal,
  type BatchSummary,
  type HandoverFact,
  type HandoverFilters,
  HANDOVERS_PER_PAGE,
  type ItemRecord,
  type KindCounts,
  type RecipientOption,
  type TripOption,
} from "./types";

let client: SupabaseClient | undefined;

function recordClient(): SupabaseClient {
  if (!client) {
    const env = adminEnv();
    if (!env) throw new Error(NOT_CONFIGURED);
    client = createClient(env.url, env.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** A database error as one line, message and code only. */
function fail(what: string, e: { message?: string; code?: string } | null): never {
  throw new Error(`${what}: ${e?.message ?? "unknown error"}${e?.code ? ` (code ${e.code})` : ""}`);
}

// ---------- the allowlist ----------

/** True when the (already lowercased) address is in app_admins. Throws on a lookup error. */
export async function isListedAdmin(email: string): Promise<boolean> {
  const { data, error } = await recordClient().from("app_admins").select("email").eq("email", email).maybeSingle();
  if (error) fail("reading app_admins", error);
  return data !== null;
}

// ---------- /admin ----------

async function countWhere(table: string, column: string, value: string, select = "id"): Promise<number> {
  const { count, error } = await recordClient().from(table).select(select, { count: "exact", head: true }).eq(column, value);
  if (error) fail(`counting ${table}`, error);
  return count ?? 0;
}

export async function batchesOf(kind: Kind): Promise<BatchSummary[]> {
  const { data, error } = await recordClient()
    .from("import_batches")
    .select("id, label, source_filename, received_from, received_on")
    .eq("kind", kind)
    .order("created_at");
  if (error) fail("reading import_batches", error);
  const out: BatchSummary[] = [];
  for (const b of data ?? []) {
    const counts = {
      import_rows: await countWhere("import_rows", "batch_id", b.id),
      trips: await countWhere("trips", "batch_id", b.id),
      recipients: await countWhere("recipients", "batch_id", b.id),
      items: await countWhere("items", "batch_id", b.id),
      handovers: await countWhere("handovers", "batch_id", b.id),
    };
    out.push({ ...b, counts });
  }
  return out;
}

/** totals_by_basis for one kind: one row per valuation basis, never summed across bases. */
export async function totalsOf(kind: Kind): Promise<BasisTotal[]> {
  const { data, error } = await recordClient()
    .from("totals_by_basis")
    .select("basis, handovers, units, amount_usd")
    .eq("kind", kind)
    .order("basis");
  if (error) fail("reading totals_by_basis", error);
  return (data ?? []).map((r) => ({ basis: r.basis, handovers: Number(r.handovers), units: Number(r.units), amount_usd: String(r.amount_usd) }));
}

export async function countsOf(kind: Kind): Promise<KindCounts> {
  const viaBatch = "id, import_batches!inner(kind)";
  const items = await countWhere("items", "import_batches.kind", kind, viaBatch);
  const handovers = await countWhere("handovers", "import_batches.kind", kind, viaBatch);
  const trips = await countWhere("trips", "import_batches.kind", kind, viaBatch);
  const recipients = await recipientsOf(kind);
  return { items, handovers, trips, recipients: recipients.length, countries: new Set(recipients.map((r) => r.country)).size };
}

// ---------- /admin/handovers ----------

export async function recipientsOf(kind: Kind): Promise<RecipientOption[]> {
  const { data, error } = await recordClient()
    .from("recipients")
    .select("id, name, department, city, country, import_batches!inner(kind)")
    .eq("import_batches.kind", kind)
    .order("name");
  if (error) fail("reading recipients", error);
  return (data ?? []).map(({ id, name, department, city, country }) => ({ id, name, department, city, country }));
}

export async function tripsOf(kind: Kind): Promise<TripOption[]> {
  const { data, error } = await recordClient()
    .from("trips")
    .select("slug, title, year, import_batches!inner(kind)")
    .eq("import_batches.kind", kind)
    .order("year", { ascending: false })
    .order("slug");
  if (error) fail("reading trips", error);
  return (data ?? []).map(({ slug, title }) => ({ slug, title }));
}

const FACT_COLUMNS =
  "handover_id, handed_on, date_precision, handed_quantity, item_id, description, recipient_id, recipient_name, recipient_city, recipient_country, trip_slug";

/** One page (1-based) of handover_facts for one kind, filtered; and the total that matches. */
export async function handoversOf(kind: Kind, filters: HandoverFilters, page: number): Promise<{ rows: HandoverFact[]; total: number }> {
  let q = recordClient().from("handover_facts").select(FACT_COLUMNS, { count: "exact" }).eq("kind", kind);
  if (filters.country) q = q.eq("recipient_country", filters.country);
  if (filters.recipient) q = q.eq("recipient_id", filters.recipient);
  if (filters.trip) q = q.eq("trip_slug", filters.trip);
  const from = (page - 1) * HANDOVERS_PER_PAGE;
  const { data, count, error } = await q
    .order("handed_on", { ascending: false, nullsFirst: false })
    .order("handover_id")
    .range(from, from + HANDOVERS_PER_PAGE - 1);
  if (error) fail("reading handover_facts", error);
  return { rows: (data ?? []) as unknown as HandoverFact[], total: count ?? 0 };
}

// ---------- /admin/items/[id] ----------

/** One item of the given kind with everything hanging off it, or null when there is no such item of that kind. */
export async function itemOf(kind: Kind, id: string): Promise<ItemRecord | null> {
  const db = recordClient();
  const { data: item, error } = await db
    .from("items")
    .select(
      "id, category, description, manufacturer, model, serial_number, quantity, condition, year_made, note, import_row_id, import_batches!inner(kind, label), sources(name)",
    )
    .eq("id", id)
    .eq("import_batches.kind", kind)
    .maybeSingle();
  if (error) fail("reading items", error);
  if (!item) return null;

  const { data: valuations, error: vErr } = await db
    .from("valuations")
    .select("basis, amount_usd, per, method_note, valued_on, valued_by")
    .eq("item_id", id)
    .order("basis");
  if (vErr) fail("reading valuations", vErr);

  const { data: handovers, error: hErr } = await db
    .from("handover_facts")
    .select(FACT_COLUMNS)
    .eq("kind", kind)
    .eq("item_id", id)
    .order("handed_on", { ascending: false, nullsFirst: false });
  if (hErr) fail("reading handover_facts", hErr);
  const facts = (handovers ?? []) as unknown as HandoverFact[];

  let followups: ItemRecord["followups"] = [];
  if (facts.length > 0) {
    const { data: f, error: fErr } = await db
      .from("followups")
      .select("handover_id, checked_on, in_service, checked_by, note")
      .in(
        "handover_id",
        facts.map((h) => h.handover_id),
      )
      .order("checked_on");
    if (fErr) fail("reading followups", fErr);
    followups = f ?? [];
  }

  let raw: ItemRecord["raw"] = null;
  if (item.import_row_id) {
    const { data: r, error: rErr } = await db.from("import_rows").select("sheet, row_number, raw").eq("id", item.import_row_id).maybeSingle();
    if (rErr) fail("reading import_rows", rErr);
    raw = r ?? null;
  }

  const batch = item.import_batches as unknown as { label: string };
  const source = item.sources as unknown as { name: string } | null;
  return {
    item: {
      id: item.id,
      category: item.category,
      description: item.description,
      manufacturer: item.manufacturer,
      model: item.model,
      serial_number: item.serial_number,
      quantity: item.quantity,
      condition: item.condition,
      year_made: item.year_made,
      note: item.note,
      batch_label: batch.label,
      source_name: source?.name ?? null,
    },
    valuations: (valuations ?? []).map((v) => ({ ...v, amount_usd: String(v.amount_usd) })),
    handovers: facts,
    followups,
    raw,
  };
}
