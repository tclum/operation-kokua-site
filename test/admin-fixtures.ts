// SAMPLE fixture data shaped like the record view's reads, for rendering the
// admin views without signing in or touching the record. Every name,
// description and title starts with SAMPLE; trip slugs with sample-. Nothing
// here is read from the database.

import type { BasisTotal, BatchSummary, HandoverFact, ItemRecord, KindCounts, RecipientOption, TripOption } from "../src/lib/admin/types";

export const FIXTURE_EMAIL = "sample-admin@example.com";

export const fixtureBatches: BatchSummary[] = [
  {
    id: "5a3f0e1c-0000-4000-8000-000000000001",
    label: "SAMPLE batch one",
    source_filename: "sample-batch-one.xlsx",
    received_from: "SAMPLE sender",
    received_on: "2026-11-20",
    counts: { import_rows: 61, trips: 2, recipients: 3, items: 20, handovers: 20 },
  },
  {
    id: "5a3f0e1c-0000-4000-8000-000000000002",
    label: "SAMPLE batch two",
    source_filename: "sample-batch-two.xlsx",
    received_from: null,
    received_on: null,
    counts: { import_rows: 14, trips: 1, recipients: 1, items: 5, handovers: 5 },
  },
];

export const fixtureTotals: BasisTotal[] = [
  { basis: "fair-market", handovers: 12, units: 18, amount_usd: "41250.00" },
  { basis: "original-cost", handovers: 15, units: 22, amount_usd: "126400.00" },
];

export const fixtureCounts: KindCounts = { items: 25, handovers: 25, recipients: 4, countries: 2, trips: 3 };

/** The real kind before any items: only the old-site trips and hospitals. */
export const fixtureEmptyRealCounts: KindCounts = { items: 0, handovers: 0, recipients: 4, countries: 2, trips: 12 };
export const fixtureEmptyRealBatches: BatchSummary[] = [
  {
    id: "5a3f0e1c-0000-4000-8000-000000000003",
    label: "SAMPLE old-site stand-in",
    source_filename: "sample-site",
    received_from: "SAMPLE public website",
    received_on: "2026-11-24",
    counts: { import_rows: 0, trips: 12, recipients: 4, items: 0, handovers: 0 },
  },
];

export const fixtureRecipients: RecipientOption[] = [
  { id: "5a3f0e1c-0000-4000-8000-0000000000a1", name: "SAMPLE Hospital Alpha", department: "SAMPLE Surgery", city: "SAMPLE City North", country: "SAMPLE Country A" },
  { id: "5a3f0e1c-0000-4000-8000-0000000000a2", name: "SAMPLE Hospital Beta", department: null, city: "SAMPLE City South", country: "SAMPLE Country A" },
  { id: "5a3f0e1c-0000-4000-8000-0000000000a3", name: "SAMPLE Clinic Gamma", department: null, city: null, country: "SAMPLE Country B" },
];

export const fixtureTrips: TripOption[] = [
  { slug: "sample-trip-2026", title: "SAMPLE trip, 2026" },
  { slug: "sample-trip-2025", title: "SAMPLE trip, 2025" },
];

const precisions = ["day", "month", "year", "unknown"] as const;

export const fixtureHandovers: HandoverFact[] = Array.from({ length: 12 }, (_, i) => {
  const r = fixtureRecipients[i % fixtureRecipients.length];
  return {
    handover_id: `5a3f0e1c-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`,
    handed_on: i === 11 ? null : `2026-0${(i % 9) + 1}-1${i % 9}`,
    date_precision: precisions[i % precisions.length],
    handed_quantity: (i % 3) + 1,
    item_id: `5a3f0e1c-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`,
    description: `SAMPLE item ${i + 1}: ${["surgical drill", "headlamp", "retractor set", "suction unit"][i % 4]}`,
    recipient_id: r.id,
    recipient_name: r.name,
    recipient_city: r.city,
    recipient_country: r.country,
    trip_slug: i % 5 === 4 ? null : fixtureTrips[i % 2].slug,
  };
});

export const fixtureItem: ItemRecord = {
  item: {
    id: "5a3f0e1c-0000-4000-8000-000000000200",
    category: "SAMPLE power tools",
    description: "SAMPLE item 1: surgical drill",
    manufacturer: "SAMPLE Maker",
    model: "SAMPLE-100",
    serial_number: "SAMPLE-SN-0001",
    quantity: 3,
    condition: "used-working",
    year_made: 2019,
    note: "SAMPLE note about the item.",
    batch_label: "SAMPLE batch one",
    source_name: "SAMPLE Donor Hospital",
  },
  valuations: [
    { basis: "fair-market", amount_usd: "1500.00", per: "unit", method_note: "SAMPLE comparable listings", valued_on: "2026-11-01", valued_by: "SAMPLE appraiser" },
    { basis: "original-cost", amount_usd: "9000.00", per: "lot", method_note: "SAMPLE purchase invoice", valued_on: null, valued_by: "SAMPLE donor" },
  ],
  handovers: fixtureHandovers.slice(0, 2).map((h) => ({ ...h, item_id: "5a3f0e1c-0000-4000-8000-000000000200", description: "SAMPLE item 1: surgical drill" })),
  followups: [
    { handover_id: fixtureHandovers[0].handover_id, checked_on: "2026-11-15", in_service: true, checked_by: "SAMPLE checker", note: "SAMPLE in daily use." },
    { handover_id: fixtureHandovers[1].handover_id, checked_on: "2026-11-16", in_service: null, checked_by: null, note: null },
  ],
  raw: {
    sheet: "Items",
    row_number: 2,
    raw: {
      item_ref: "sample-item-1",
      source_ref: "sample-source-1",
      category: "SAMPLE power tools",
      description: "SAMPLE item 1: surgical drill",
      manufacturer: "SAMPLE Maker",
      model: "SAMPLE-100",
      quantity: 3,
      condition: "used-working",
      original_cost_usd: 9000,
      fair_market_usd: 1500,
    },
  },
};
