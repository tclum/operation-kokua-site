// The rehearsal workbook: shaped like a real workbook, for dry runs only.
// It repeats one real trip (hanoi-2015) and one real recipient (Cho Ray
// Hospital, Neurosurgery) exactly as the old-site batch holds them, so a dry
// run against the live record shows them matched, and names cambodia-2015
// directly from two handovers with no Trips row for it. Everything new is
// plainly a rehearsal: names, descriptions and titles start with REHEARSAL,
// new trip slugs with rehearsal-. The importer refuses to commit it.

import { READ_ME_LINES, type SheetName } from "./definition";
import { NAMING_COLUMNS } from "./check";
import { buildWorkbook, type CellInput, type ParsedWorkbook } from "./workbook";

export const REHEARSAL_NAME = "REHEARSAL";
export const REHEARSAL_SLUG = "rehearsal-";

export const REHEARSAL_READ_ME: readonly string[] = [
  "REHEARSAL FILE: for dry runs only. It must never be imported into the record.",
  "",
  ...READ_ME_LINES,
];

type Rows = Record<SheetName, Record<string, CellInput>[]>;

export function rehearsalRows(): Rows {
  return {
    Sources: [{ source_ref: "rehearsal-src-1", name: "REHEARSAL Source A", kind: "manufacturer" }],
    Recipients: [
      // Repeats the old-site recipient; must match it.
      { recipient_ref: "rehearsal-rcp-cho-ray", name: "Cho Ray Hospital", department: "Neurosurgery", city: "Ho Chi Minh City", country: "Vietnam" },
      { recipient_ref: "rehearsal-rcp-new", name: "REHEARSAL Recipient A", city: "REHEARSAL City", country: "Cambodia" },
    ],
    Trips: [
      // Repeats the old-site trip; must match it.
      { trip_slug: "hanoi-2015", title: "Hanoi, November 2015", year: 2015, month: 11, city: "Hanoi", country: "Vietnam" },
      { trip_slug: "rehearsal-nepal-2017", title: "REHEARSAL Nepal 2017", year: 2017, country: "Nepal" },
    ],
    Items: [1, 2, 3, 4].map((i) => ({
      item_ref: `rehearsal-itm-${i}`,
      source_ref: "rehearsal-src-1",
      description: `REHEARSAL item ${i}`,
      quantity: 1,
      condition: "used-working",
      original_cost_usd: i * 1000,
      fair_market_usd: i <= 2 ? i * 400 : undefined,
      value_per: "lot",
      valued_on: i <= 2 ? "2016-10-03" : undefined,
    })),
    Shipments: [{ shipment_ref: "rehearsal-shp-1", reference: "REHEARSAL-WAYBILL-0001", trip_slug: "hanoi-2015", mode: "hand-carried" }],
    Handovers: [
      { item_ref: "rehearsal-itm-1", recipient_ref: "rehearsal-rcp-cho-ray", shipment_ref: "rehearsal-shp-1", trip_slug: "hanoi-2015", handed_on: "2015-11-01", date_precision: "month" },
      { item_ref: "rehearsal-itm-2", recipient_ref: "rehearsal-rcp-new", trip_slug: "rehearsal-nepal-2017", handed_on: "2017-01-01", date_precision: "year" },
      // cambodia-2015 named directly: no Trips row for it.
      { item_ref: "rehearsal-itm-3", recipient_ref: "rehearsal-rcp-new", trip_slug: "cambodia-2015", handed_on: "2015-12-01", date_precision: "month" },
      { item_ref: "rehearsal-itm-4", recipient_ref: "rehearsal-rcp-cho-ray", trip_slug: "cambodia-2015", handed_on: "2015-12-01", date_precision: "month" },
    ],
    Followups: [],
  };
}

export function rehearsalWorkbook() {
  return buildWorkbook(rehearsalRows(), REHEARSAL_READ_ME);
}

/**
 * Every cell that marks a workbook as a rehearsal: a name, description or
 * title starting with REHEARSAL, or a trip_slug starting with rehearsal-, on
 * any sheet. The importer refuses to commit a workbook with any.
 */
export function rehearsalMarkers(wb: ParsedWorkbook): string[] {
  const out: string[] = [];
  for (const [sheet, rows] of Object.entries(wb.sheets)) {
    for (const r of rows) {
      for (const [column, v] of Object.entries(r.values)) {
        if (typeof v !== "string") continue;
        const s = v.trim();
        if ((NAMING_COLUMNS as readonly string[]).includes(column) && s.startsWith(REHEARSAL_NAME)) out.push(`${sheet}, ${r.rowNumber}, ${column}: ${s}`);
        if (column === "trip_slug" && s.startsWith(REHEARSAL_SLUG)) out.push(`${sheet}, ${r.rowNumber}, ${column}: ${s}`);
      }
    }
  }
  return out;
}
