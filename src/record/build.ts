// The importer's row builder: a checked workbook in, every database row out,
// with ids assigned here so rows can point at each other before any insert.
// Pure and offline; the importer (scripts/record/import.ts) does the writes.
//
// Raw first: one import_rows row per sheet row, holding the cells exactly as
// read. Every structured row carries batch_id (where its table has one) and
// the import_row_id of the sheet row it came from. Without a resolution
// (synthetic), refs join only within the workbook, so a batch's rows point
// only at rows of the same batch. With one (real, src/record/resolve.ts), a
// matched row is not built (its raw row still is) and refs to it, or to an
// existing trip named directly, carry the existing id.

import { SHEETS, keyColumn, type SheetName } from "./definition";
import { typedRow, type Typed } from "./check";
import type { Resolution } from "./resolve";
import type { Json, ParsedWorkbook } from "./workbook";

export type Row = Record<string, Json>;

/** Tables in insert order: each points only at tables before it. */
export const INSERT_ORDER = [
  "import_rows",
  "sources",
  "recipients",
  "trips",
  "items",
  "valuations",
  "shipments",
  "handovers",
  "followups",
] as const;

export type TableName = (typeof INSERT_ORDER)[number];

export type BuiltRows = Record<TableName, Row[]>;

export function buildRows(
  wb: ParsedWorkbook,
  batchId: string,
  newId: () => string,
  resolution?: Pick<Resolution, "matched" | "existingTrips">,
): BuiltRows {
  const out = Object.fromEntries(INSERT_ORDER.map((t) => [t, [] as Row[]])) as BuiltRows;
  /** Per sheet: key value -> the id of the structured row it became. */
  const ids = Object.fromEntries(SHEETS.map((s) => [s.name, new Map<string, string>()])) as Record<SheetName, Map<string, string>>;
  /** Handover ids by "item_ref|recipient_ref", for followups. */
  const handoverByPair = new Map<string, string>();

  for (const def of SHEETS) {
    const key = keyColumn(def);
    for (const parsed of wb.sheets[def.name]) {
      const importRowId = newId();
      out.import_rows.push({ id: importRowId, batch_id: batchId, sheet: def.name, row_number: parsed.rowNumber, raw: parsed.raw });

      const v = typedRow(def.name, parsed.values);
      const existing = key ? resolution?.matched[def.name]?.get(String(v[key.name])) : undefined;
      if (existing !== undefined) {
        // Matched: not inserted and not changed; refs to it carry its id.
        ids[def.name].set(String(v[key!.name]), existing);
        continue;
      }
      const id = newId();
      const row: Row = { id, import_row_id: importRowId };
      if (def.table !== "followups") row.batch_id = batchId;
      const valuationFields: Row = {};
      const amounts: { basis: string; amount: number }[] = [];

      for (const c of def.columns) {
        const value: Typed = v[c.name];
        if (value === null) continue; // blank: the database default applies
        switch (c.maps.to) {
          case "raw":
            break;
          case "column":
            row[c.maps.column] = value;
            break;
          case "ref": {
            if (def.name === "Followups") break; // joined below, by item and recipient together
            const target =
              ids[c.refSheet!].get(String(value)) ??
              (c.refSheet === "Trips" ? resolution?.existingTrips.get(String(value)) : undefined);
            if (target === undefined) throw new Error(`${def.name} row ${parsed.rowNumber}: ${c.name} "${value}" resolves to nothing (check and resolve the workbook first)`);
            row[c.maps.column] = target;
            break;
          }
          case "valuation-amount":
            amounts.push({ basis: c.maps.basis, amount: value as number });
            break;
          case "valuation-field":
            valuationFields[c.maps.column] = value;
            break;
        }
      }

      if (def.name === "Followups") {
        row.handover_id = handoverByPair.get(`${v.item_ref}|${v.recipient_ref}`)!;
      }
      if (key) ids[def.name].set(String(v[key.name]), id);
      if (def.name === "Handovers") handoverByPair.set(`${v.item_ref}|${v.recipient_ref}`, id);

      out[def.table as TableName].push(row);
      for (const a of amounts) {
        out.valuations.push({ id: newId(), item_id: id, import_row_id: importRowId, basis: a.basis, amount_usd: a.amount, ...valuationFields });
      }
    }
  }
  return out;
}
