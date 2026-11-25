// The intake workbook, described once. The template, the checker, the
// importer's row builder and the synthetic generator all read this file;
// none of them restates a sheet, a column, a type or an allowed value.
//
// Allowed values mirror the check constraints in
// supabase/migrations/20261125021239_record_foundation.sql, and every mapped
// table and column exists there (src/record/definition.test.ts reads the SQL).

export type ColumnType = "text" | "integer" | "number" | "date" | "boolean" | "enum" | "slug";

export type SheetName =
  | "Sources"
  | "Recipients"
  | "Trips"
  | "Items"
  | "Shipments"
  | "Handovers"
  | "Followups";

/** Where a column's value lands in the database. */
export type Maps =
  /** A plain column on the sheet's own table. */
  | { to: "column"; table: string; column: string }
  /** A ref to a row on another sheet of the same workbook, stored as that row's id. */
  | { to: "ref"; table: string; column: string }
  /** One `valuations` row per filled cell, with this basis. */
  | { to: "valuation-amount"; table: "valuations"; column: "amount_usd"; basis: string }
  /** Copied onto every valuation row the item yields. */
  | { to: "valuation-field"; table: "valuations"; column: string }
  /** Only in import_rows.raw (the sheet's own ref, used to join sheets). */
  | { to: "raw" };

export type Column = {
  name: string;
  required: boolean;
  type: ColumnType;
  /** For type "enum": the allowed values, exactly as the check constraint lists them. */
  values?: readonly string[];
  min?: number;
  max?: number;
  /** This column is the sheet's key: unique within the sheet. */
  key?: boolean;
  /** This column points at the key of another sheet. */
  refSheet?: SheetName;
  maps: Maps;
  /** One plain line for the Read me sheet. */
  help: string;
};

export type Sheet = {
  name: SheetName;
  /** The table each row becomes. */
  table: string;
  purpose: string;
  columns: readonly Column[];
};

const col = (c: Column): Column => c;

const text = (name: string, table: string, column: string, help: string, required = false): Column =>
  col({ name, required, type: "text", maps: { to: "column", table, column }, help });

export const SOURCE_KINDS = ["hospital", "manufacturer", "individual", "other", "unknown"] as const;
export const CONDITIONS = ["new", "used-working", "used-needs-service", "unknown"] as const;
export const SHIPMENT_MODES = ["hand-carried", "air-freight", "sea-freight", "courier", "unknown"] as const;
export const DATE_PRECISIONS = ["day", "month", "year", "unknown"] as const;
export const VALUE_PER = ["unit", "lot"] as const;
export const YES_NO = ["yes", "no"] as const;

export const SHEETS: readonly Sheet[] = [
  {
    name: "Sources",
    table: "sources",
    purpose: "Where donated things came from: a hospital, a manufacturer, a person.",
    columns: [
      col({ name: "source_ref", required: true, type: "text", key: true, maps: { to: "raw" }, help: "Your own short label for this source, used on the Items sheet. Any label works, as long as no two rows share one." }),
      text("name", "sources", "name", "Who gave it.", true),
      col({ name: "kind", required: false, type: "enum", values: SOURCE_KINDS, maps: { to: "column", table: "sources", column: "kind" }, help: "Pick from the list; leave blank if unsure." }),
      text("city", "sources", "city", "City, if known."),
      text("country", "sources", "country", "Country, if known."),
      text("note", "sources", "note", "Anything else worth keeping."),
    ],
  },
  {
    name: "Recipients",
    table: "recipients",
    purpose: "The hospitals and departments that received equipment.",
    columns: [
      col({ name: "recipient_ref", required: true, type: "text", key: true, maps: { to: "raw" }, help: "Your own short label for this recipient, used on the Handovers and Followups sheets." }),
      text("name", "recipients", "name", "Hospital or organization name.", true),
      text("department", "recipients", "department", "Department, if one."),
      text("city", "recipients", "city", "City."),
      text("country", "recipients", "country", "Country.", true),
      col({ name: "latitude", required: false, type: "number", min: -90, max: 90, maps: { to: "column", table: "recipients", column: "latitude" }, help: "For the map, if known; a number like 10.77." }),
      col({ name: "longitude", required: false, type: "number", min: -180, max: 180, maps: { to: "column", table: "recipients", column: "longitude" }, help: "For the map, if known; a number like 106.66." }),
      text("contact_name", "recipients", "contact_name", "Who you dealt with there."),
      text("note", "recipients", "note", "Anything else worth keeping."),
    ],
  },
  {
    name: "Trips",
    table: "trips",
    purpose: "Each trip: where, when, and what it was called.",
    columns: [
      col({ name: "trip_slug", required: true, type: "slug", key: true, maps: { to: "column", table: "trips", column: "slug" }, help: "A short lowercase name with dashes, like hanoi-2016. Used on the Shipments and Handovers sheets." }),
      text("title", "trips", "title", "The trip's name, like Hanoi, November 2016.", true),
      col({ name: "year", required: true, type: "integer", min: 1990, max: 2100, maps: { to: "column", table: "trips", column: "year" }, help: "Year, like 2016." }),
      col({ name: "month", required: false, type: "integer", min: 1, max: 12, maps: { to: "column", table: "trips", column: "month" }, help: "Month as a number 1 to 12, if known." }),
      text("city", "trips", "city", "City."),
      text("country", "trips", "country", "Country.", true),
      text("note", "trips", "note", "Anything else worth keeping."),
    ],
  },
  {
    name: "Items",
    table: "items",
    purpose: "Each donated item or lot of identical items, with what it was worth.",
    columns: [
      col({ name: "item_ref", required: true, type: "text", key: true, maps: { to: "raw" }, help: "Your own short label for this item, used on the Handovers and Followups sheets." }),
      col({ name: "source_ref", required: false, type: "text", refSheet: "Sources", maps: { to: "ref", table: "items", column: "source_id" }, help: "Which source it came from (a source_ref from the Sources sheet)." }),
      text("category", "items", "category", "A broad kind, like drills or scopes."),
      text("description", "items", "description", "What it is.", true),
      text("manufacturer", "items", "manufacturer", "Maker, if known."),
      text("model", "items", "model", "Model, if known."),
      text("serial_number", "items", "serial_number", "Serial number, if known."),
      col({ name: "quantity", required: false, type: "integer", min: 1, maps: { to: "column", table: "items", column: "quantity" }, help: "How many; blank means 1." }),
      col({ name: "condition", required: false, type: "enum", values: CONDITIONS, maps: { to: "column", table: "items", column: "condition" }, help: "Pick from the list; leave blank if unsure." }),
      col({ name: "year_made", required: false, type: "integer", min: 1950, max: 2100, maps: { to: "column", table: "items", column: "year_made" }, help: "Year made, if known." }),
      col({ name: "original_cost_usd", required: false, type: "number", min: 0, maps: { to: "valuation-amount", table: "valuations", column: "amount_usd", basis: "original-cost" }, help: "What it cost new, in US dollars, if known." }),
      col({ name: "fair_market_usd", required: false, type: "number", min: 0, maps: { to: "valuation-amount", table: "valuations", column: "amount_usd", basis: "fair-market" }, help: "What it was worth when given, in US dollars, if known." }),
      col({ name: "value_per", required: false, type: "enum", values: VALUE_PER, maps: { to: "valuation-field", table: "valuations", column: "per" }, help: "Whether the dollar figures are per unit or for the whole lot; blank means the whole lot." }),
      col({ name: "valuation_note", required: false, type: "text", maps: { to: "valuation-field", table: "valuations", column: "method_note" }, help: "How the value was worked out." }),
      col({ name: "valued_by", required: false, type: "text", maps: { to: "valuation-field", table: "valuations", column: "valued_by" }, help: "Who worked it out." }),
      col({ name: "valued_on", required: false, type: "date", maps: { to: "valuation-field", table: "valuations", column: "valued_on" }, help: "When the value was worked out, like 2016-10-03." }),
      text("note", "items", "note", "Anything else worth keeping."),
    ],
  },
  {
    name: "Shipments",
    table: "shipments",
    purpose: "How things travelled: each box, crate or suitcase run.",
    columns: [
      col({ name: "shipment_ref", required: true, type: "text", key: true, maps: { to: "raw" }, help: "Your own short label for this shipment, used on the Handovers sheet." }),
      text("reference", "shipments", "reference", "A waybill, tracking or airline tag number, if there is one."),
      col({ name: "trip_slug", required: false, type: "slug", refSheet: "Trips", maps: { to: "ref", table: "shipments", column: "trip_id" }, help: "Which trip it went with (a trip_slug from the Trips sheet)." }),
      col({ name: "shipped_on", required: false, type: "date", maps: { to: "column", table: "shipments", column: "shipped_on" }, help: "Date sent, like 2016-10-03." }),
      col({ name: "arrived_on", required: false, type: "date", maps: { to: "column", table: "shipments", column: "arrived_on" }, help: "Date arrived, like 2016-10-20." }),
      col({ name: "mode", required: false, type: "enum", values: SHIPMENT_MODES, maps: { to: "column", table: "shipments", column: "mode" }, help: "Pick from the list; leave blank if unsure." }),
      text("origin", "shipments", "origin", "Where it left from."),
      text("carrier", "shipments", "carrier", "Airline, shipper or courier."),
      col({ name: "weight_kg", required: false, type: "number", min: 0, maps: { to: "column", table: "shipments", column: "weight_kg" }, help: "Weight in kilograms." }),
      col({ name: "cost_usd", required: false, type: "number", min: 0, maps: { to: "column", table: "shipments", column: "cost_usd" }, help: "Shipping cost in US dollars." }),
      text("paid_by", "shipments", "paid_by", "Who paid for shipping."),
      text("paperwork_note", "shipments", "paperwork_note", "Customs forms, permits, letters."),
    ],
  },
  {
    name: "Handovers",
    table: "handovers",
    purpose: "Who received what: one row each time items were handed to a recipient.",
    columns: [
      col({ name: "item_ref", required: true, type: "text", refSheet: "Items", maps: { to: "ref", table: "handovers", column: "item_id" }, help: "Which item (an item_ref from the Items sheet)." }),
      col({ name: "recipient_ref", required: true, type: "text", refSheet: "Recipients", maps: { to: "ref", table: "handovers", column: "recipient_id" }, help: "Who received it (a recipient_ref from the Recipients sheet)." }),
      col({ name: "shipment_ref", required: false, type: "text", refSheet: "Shipments", maps: { to: "ref", table: "handovers", column: "shipment_id" }, help: "Which shipment carried it, if known." }),
      col({ name: "trip_slug", required: false, type: "slug", refSheet: "Trips", maps: { to: "ref", table: "handovers", column: "trip_id" }, help: "Which trip, if any." }),
      col({ name: "quantity", required: false, type: "integer", min: 1, maps: { to: "column", table: "handovers", column: "quantity" }, help: "How many of the item were handed over; blank means 1." }),
      col({ name: "handed_on", required: false, type: "date", maps: { to: "column", table: "handovers", column: "handed_on" }, help: "Date handed over, like 2016-11-12. If only the month is known, use the 1st and set date_precision to month." }),
      col({ name: "date_precision", required: false, type: "enum", values: DATE_PRECISIONS, maps: { to: "column", table: "handovers", column: "date_precision" }, help: "How exact handed_on is; leave blank if unsure." }),
      text("delivered_by", "handovers", "delivered_by", "Who handed it over."),
      text("received_by", "handovers", "received_by", "Who accepted it."),
      text("acknowledgment_note", "handovers", "acknowledgment_note", "Any thank-you letter, receipt or certificate."),
    ],
  },
  {
    name: "Followups",
    table: "followups",
    purpose: "Later checks on whether donated equipment is still in use.",
    columns: [
      col({ name: "item_ref", required: true, type: "text", refSheet: "Items", maps: { to: "ref", table: "followups", column: "handover_id" }, help: "Which item (an item_ref). Together with recipient_ref it must match one handover." }),
      col({ name: "recipient_ref", required: true, type: "text", refSheet: "Recipients", maps: { to: "ref", table: "followups", column: "handover_id" }, help: "Which recipient (a recipient_ref)." }),
      col({ name: "checked_on", required: true, type: "date", maps: { to: "column", table: "followups", column: "checked_on" }, help: "Date of the check, like 2018-03-01." }),
      col({ name: "in_service", required: false, type: "boolean", values: YES_NO, maps: { to: "column", table: "followups", column: "in_service" }, help: "yes or no; blank if unknown." }),
      text("checked_by", "followups", "checked_by", "Who checked."),
      text("note", "followups", "note", "Anything else worth keeping."),
    ],
  },
];

/** The workbook's version: in the Read me sheet and in every workbook file name. */
export const WORKBOOK_VERSION = 2;

export const READ_ME_SHEET = "Read me";

export const READ_ME_LINES: readonly string[] = [
  `Operation Kokua donation record: intake workbook (version ${WORKBOOK_VERSION})`,
  "",
  "This workbook collects what was donated, where it came from, how it travelled, who received it, and whether it is still in use.",
  "Originals are welcome in any form: packing lists, letters, receipts, photos, old spreadsheets. Send them as they are; nothing needs retyping first.",
  "Blank cells are fine. Fill in what you know and leave the rest empty. Only the columns marked * need a value on a row you fill in.",
  "Each sheet has one row per thing. The first column of most sheets is your own short label (like S1 or drill-3), used to point at that row from another sheet.",
  "Dates are written like 2016-11-12. Money is in US dollars, numbers only.",
  "",
  ...SHEETS.map((s) => `${s.name}: ${s.purpose}`),
];

export function sheetByName(name: string): Sheet | undefined {
  return SHEETS.find((s) => s.name === name);
}

/** The header text the template writes: the column name, with " *" when required. */
export function headerText(c: Column): string {
  return c.required ? `${c.name} *` : c.name;
}

/** The column name a header cell names, ignoring the required marker and case. */
export function headerName(cell: string): string {
  return cell.replace(/\*/g, "").trim().toLowerCase();
}

/** The sheet's key column, if it has one. */
export function keyColumn(sheet: Sheet): Column | undefined {
  return sheet.columns.find((c) => c.key);
}
