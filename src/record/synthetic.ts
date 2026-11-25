// A synthetic intake workbook from a fixed seed: the same cells on every run.
// Every name, description, title and other text that names a thing starts
// with "SAMPLE"; every ref and slug starts with "sample-". No real hospital,
// person, place of work or serial number appears. Values are round.

import type { SheetName } from "./definition";
import { buildWorkbook, type CellInput } from "./workbook";

export const SYNTHETIC_SEED = 20261124;

export const SYNTHETIC_COUNTS: Record<SheetName, number> = {
  Sources: 3,
  Recipients: 6,
  Trips: 4,
  Items: 40,
  Shipments: 5,
  Handovers: 40,
  Followups: 8,
};

/** mulberry32: small, fixed, and the same on every platform. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rows = Record<SheetName, Record<string, CellInput>[]>;

export function syntheticRows(seed = SYNTHETIC_SEED): Rows {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  const letters = "ABCDEF";

  const sources = (["hospital", "manufacturer", "individual"] as const).map((kind, i) => ({
    source_ref: `sample-src-${i + 1}`,
    name: `SAMPLE Source ${letters[i]}`,
    kind,
    city: `SAMPLE City ${letters[i]}`,
    country: "SAMPLE Country North",
    note: `SAMPLE note for source ${letters[i]}`,
  }));

  const recipients = Array.from({ length: 6 }, (_, i) => ({
    recipient_ref: `sample-rcp-${i + 1}`,
    name: `SAMPLE Recipient ${letters[i]}`,
    department: i % 2 === 0 ? `SAMPLE Department ${letters[i]}` : undefined,
    city: `SAMPLE City ${letters[(i + 3) % 6]}`,
    country: i < 4 ? "SAMPLE Country East" : "SAMPLE Country South",
    latitude: 10 + i,
    longitude: 100 + i,
    contact_name: `SAMPLE Person ${i + 1}`,
    note: undefined,
  }));

  const trips = Array.from({ length: 4 }, (_, i) => ({
    trip_slug: `sample-trip-${2016 + i}`,
    title: `SAMPLE Trip ${2016 + i}`,
    year: 2016 + i,
    month: 10 + (i % 3),
    city: recipients[i].city,
    country: recipients[i].country,
    note: `SAMPLE note for trip ${2016 + i}`,
  }));

  const shipments = Array.from({ length: 5 }, (_, i) => {
    const trip = trips[i % 4];
    return {
      shipment_ref: `sample-shp-${i + 1}`,
      trip_slug: trip.trip_slug,
      shipped_on: `${trip.year}-${pad(trip.month - 1)}-01`,
      arrived_on: `${trip.year}-${pad(trip.month - 1)}-15`,
      mode: pick(["hand-carried", "air-freight", "sea-freight", "courier"] as const),
      origin: "SAMPLE Origin City",
      carrier: `SAMPLE Carrier ${letters[i % 3]}`,
      weight_kg: int(1, 20) * 10,
      cost_usd: int(1, 12) * 100,
      paid_by: `SAMPLE Person ${7 + (i % 2)}`,
      paperwork_note: `SAMPLE paperwork note ${i + 1}`,
    };
  });

  const categories = ["SAMPLE drills", "SAMPLE scopes", "SAMPLE instrument sets", "SAMPLE monitors"] as const;
  const items = Array.from({ length: 40 }, (_, i) => {
    const quantity = pick([1, 1, 2, 4, 5, 10] as const);
    const per = pick(["unit", "lot"] as const);
    const cost = int(1, 40) * 500;
    const original = per === "unit" ? cost : cost * quantity;
    return {
      item_ref: `sample-itm-${pad(i + 1)}`,
      source_ref: sources[i % 3].source_ref,
      category: categories[i % 4],
      description: `SAMPLE item ${pad(i + 1)}`,
      manufacturer: `SAMPLE Maker ${letters[i % 4]}`,
      model: `SAMPLE-M${100 + (i % 7) * 10}`,
      serial_number: `SAMPLE-SN-${String(i + 1).padStart(4, "0")}`,
      quantity,
      condition: pick(["new", "used-working", "used-needs-service", "unknown"] as const),
      year_made: int(2005, 2015),
      original_cost_usd: i % 8 === 7 ? undefined : original,
      fair_market_usd: i % 5 === 4 ? undefined : Math.round((original * 0.4) / 100) * 100,
      value_per: per,
      valuation_note: "SAMPLE valuation note",
      valued_by: "SAMPLE Person 9",
      note: undefined,
    };
  });

  // One handover per item, so item and recipient together name one handover.
  const handovers = items.map((item, i) => {
    const shipment = shipments[i % 5];
    const trip = trips.find((t) => t.trip_slug === shipment.trip_slug)!;
    return {
      item_ref: item.item_ref,
      recipient_ref: recipients[i % 6].recipient_ref,
      shipment_ref: shipment.shipment_ref,
      trip_slug: trip.trip_slug,
      quantity: item.quantity === 1 ? 1 : pick([1, item.quantity] as const),
      handed_on: `${trip.year}-${pad(trip.month)}-${pad(int(1, 28))}`,
      date_precision: "day",
      delivered_by: "SAMPLE Person 10",
      received_by: `SAMPLE Person ${11 + (i % 6)}`,
      acknowledgment_note: i % 3 === 0 ? "SAMPLE acknowledgment letter" : undefined,
    };
  });

  const followups = Array.from({ length: 8 }, (_, i) => {
    const h = handovers[i * 5];
    const year = Number(String(h.handed_on).slice(0, 4)) + 2;
    return {
      item_ref: h.item_ref,
      recipient_ref: h.recipient_ref,
      checked_on: `${year}-03-01`,
      in_service: i % 4 === 3 ? "no" : "yes",
      checked_by: "SAMPLE Person 20",
      note: `SAMPLE followup note ${i + 1}`,
    };
  });

  return {
    Sources: sources,
    Recipients: recipients,
    Trips: trips,
    Items: items,
    Shipments: shipments,
    Handovers: handovers,
    Followups: followups,
  };
}

export function syntheticWorkbook(seed = SYNTHETIC_SEED) {
  return buildWorkbook(syntheticRows(seed));
}

// A second synthetic workbook that leaves every optional cell with a database
// default blank on every row that has it (kind, condition, both quantities,
// mode, date_precision, value_per), so the import exercises those defaults.

export const SYNTHETIC_BLANKS_COUNTS: Record<SheetName, number> = {
  Sources: 1,
  Recipients: 2,
  Trips: 1,
  Items: 5,
  Shipments: 1,
  Handovers: 5,
  Followups: 0,
};

/** The columns left blank on every row of the blanks workbook. */
export const BLANK_COLUMNS: Partial<Record<SheetName, readonly string[]>> = {
  Sources: ["kind"],
  Items: ["condition", "quantity", "value_per"],
  Shipments: ["mode"],
  Handovers: ["quantity", "date_precision"],
};

export function syntheticBlanksRows(): Rows {
  const trip = {
    trip_slug: "sample-blanks-trip-2020",
    title: "SAMPLE Blanks Trip 2020",
    year: 2020,
    month: undefined,
    city: undefined,
    country: "SAMPLE Country West",
    note: undefined,
  };
  return {
    Sources: [{ source_ref: "sample-blanks-src-1", name: "SAMPLE Blanks Source A" }],
    Recipients: [1, 2].map((i) => ({
      recipient_ref: `sample-blanks-rcp-${i}`,
      name: `SAMPLE Blanks Recipient ${i}`,
      country: "SAMPLE Country West",
    })),
    Trips: [trip],
    Items: [1, 2, 3, 4, 5].map((i) => ({
      item_ref: `sample-blanks-itm-${i}`,
      source_ref: "sample-blanks-src-1",
      description: `SAMPLE blanks item ${i}`,
      original_cost_usd: i <= 2 ? i * 1000 : undefined,
    })),
    Shipments: [{ shipment_ref: "sample-blanks-shp-1", trip_slug: trip.trip_slug }],
    Handovers: [1, 2, 3, 4, 5].map((i) => ({
      item_ref: `sample-blanks-itm-${i}`,
      recipient_ref: `sample-blanks-rcp-${((i - 1) % 2) + 1}`,
      shipment_ref: "sample-blanks-shp-1",
      trip_slug: trip.trip_slug,
    })),
    Followups: [],
  };
}

export function syntheticBlanksWorkbook() {
  return buildWorkbook(syntheticBlanksRows());
}
