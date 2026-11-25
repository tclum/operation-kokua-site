// The offline checker: every problem in a parsed workbook, as
// `sheet, row, column: what is wrong`. Rules come from ./definition.
// Nothing here touches the network.

import { SHEETS, keyColumn, sheetByName, type Column, type SheetName } from "./definition";
import type { CellValue, ParsedWorkbook } from "./workbook";

export type ProblemCode =
  | "missing-sheet"
  | "unknown-sheet"
  | "missing-column"
  | "unknown-column"
  | "duplicate-column"
  | "missing-required"
  | "not-allowed"
  | "not-a-number"
  | "out-of-range"
  | "bad-date"
  | "bad-slug"
  | "duplicate-ref"
  | "dangling-ref"
  | "handover-over-quantity"
  | "handovers-sum-over-quantity"
  | "followup-no-handover"
  | "followup-many-handovers"
  | "not-synthetic"
  | "looks-synthetic"
  // From the resolver (src/record/resolve.ts), against the real record:
  | "trip-differs"
  | "trip-unknown"
  | "recipient-ambiguous"
  | "source-ambiguous";

/** What a workbook claims to be. Told apart by content, not only by a flag. */
export type RecordKind = "synthetic" | "real";

export const RECORD_KINDS: readonly RecordKind[] = ["synthetic", "real"];

/** Columns whose every value names a thing, and so carries the kind's marker. */
export const NAMING_COLUMNS = ["name", "description", "title"] as const;
export const SAMPLE_NAME = "SAMPLE";
export const SAMPLE_SLUG = "sample-";

export type Problem = { sheet: string; row: number; column: string; code: ProblemCode; message: string };

export type CheckResult = {
  counts: Record<SheetName, number>;
  problems: Problem[];
};

export type Typed = string | number | boolean | null;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date written YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * A cell's value as the database column wants it: text trimmed, numbers as
 * numbers, dates as YYYY-MM-DD, yes/no as booleans. Blank is null.
 */
export function typedValue(c: Column, v: CellValue | undefined): { ok: true; value: Typed } | { ok: false; code: ProblemCode; message: string } {
  if (v === undefined) return { ok: true, value: null };
  const shown = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (typeof v === "string" && v.startsWith("#ERROR")) {
    return { ok: false, code: c.type === "date" ? "bad-date" : "not-a-number", message: `the cell holds a spreadsheet error (${v})` };
  }
  switch (c.type) {
    case "text": {
      return { ok: true, value: v instanceof Date ? shown : String(v).trim() };
    }
    case "slug": {
      const s = String(v).trim();
      return SLUG.test(s)
        ? { ok: true, value: s }
        : { ok: false, code: "bad-slug", message: `"${shown}" is not lowercase letters and digits joined by single dashes` };
    }
    case "enum": {
      const s = String(v).trim();
      return c.values!.includes(s)
        ? { ok: true, value: s }
        : { ok: false, code: "not-allowed", message: `"${shown}" is not one of ${c.values!.join(", ")}` };
    }
    case "boolean": {
      if (typeof v === "boolean") return { ok: true, value: v };
      const s = String(v).trim().toLowerCase();
      if (s === "yes" || s === "true") return { ok: true, value: true };
      if (s === "no" || s === "false") return { ok: true, value: false };
      return { ok: false, code: "not-allowed", message: `"${shown}" is not one of yes, no` };
    }
    case "integer":
    case "number": {
      const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : NaN;
      if (!Number.isFinite(n)) return { ok: false, code: "not-a-number", message: `"${shown}" is not a number` };
      if (c.type === "integer" && !Number.isInteger(n)) {
        return { ok: false, code: "not-a-number", message: `"${shown}" is not a whole number` };
      }
      if ((c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max)) {
        const range = c.max === undefined ? `at least ${c.min}` : c.min === undefined ? `at most ${c.max}` : `between ${c.min} and ${c.max}`;
        return { ok: false, code: "out-of-range", message: `${n} is not ${range}` };
      }
      return { ok: true, value: n };
    }
    case "date": {
      if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) return { ok: false, code: "bad-date", message: "the date cannot be read" };
        return { ok: true, value: v.toISOString().slice(0, 10) };
      }
      const s = String(v).trim();
      if (isIsoDate(s)) return { ok: true, value: s };
      return { ok: false, code: "bad-date", message: `"${shown}" is not a date written like 2016-11-12` };
    }
  }
}

/** Typed values for one row; only call on a workbook that checked clean. */
export function typedRow(sheet: SheetName, values: Record<string, CellValue>): Record<string, Typed> {
  const def = sheetByName(sheet)!;
  const out: Record<string, Typed> = {};
  for (const c of def.columns) {
    const t = typedValue(c, values[c.name]);
    if (!t.ok) throw new Error(`${sheet}.${c.name}: ${t.message} (check the workbook first)`);
    out[c.name] = t.value;
  }
  return out;
}

/**
 * Every problem in the workbook, read as `kind`:
 * - synthetic: every name, description and title starts with SAMPLE and every
 *   trip_slug with sample-; every ref joins within the workbook.
 * - real: no name, description or title starts with SAMPLE and no trip_slug
 *   with sample-. A trip_slug on Shipments or Handovers may name a trip already
 *   in the record, so the offline check leaves those to the resolver
 *   (src/record/resolve.ts), which has the record's trips.
 */
export function checkWorkbook(wb: ParsedWorkbook, kind: RecordKind = "synthetic"): CheckResult {
  const problems: Problem[] = wb.shape.map((p) => ({ ...p, code: p.code as ProblemCode }));
  const counts = Object.fromEntries(SHEETS.map((s) => [s.name, wb.sheets[s.name].length])) as Record<SheetName, number>;
  const typed = {} as Record<SheetName, { row: number; v: Record<string, Typed> }[]>;

  // Cells: required, type, allowed values, range.
  for (const def of SHEETS) {
    typed[def.name] = wb.sheets[def.name].map((r) => {
      const v: Record<string, Typed> = {};
      for (const c of def.columns) {
        const t = typedValue(c, r.values[c.name]);
        if (!t.ok) {
          problems.push({ sheet: def.name, row: r.rowNumber, column: c.name, code: t.code, message: t.message });
          v[c.name] = null;
          continue;
        }
        if (c.required && (t.value === null || t.value === "")) {
          problems.push({ sheet: def.name, row: r.rowNumber, column: c.name, code: "missing-required", message: "required, but blank" });
        }
        v[c.name] = t.value;
      }
      return { row: r.rowNumber, v };
    });
  }

  // Keys: unique within their sheet.
  const keys = {} as Record<SheetName, Map<string, number>>;
  for (const def of SHEETS) {
    const k = keyColumn(def);
    keys[def.name] = new Map();
    if (!k) continue;
    for (const { row, v } of typed[def.name]) {
      const key = v[k.name];
      if (key === null || key === "") continue;
      const first = keys[def.name].get(String(key));
      if (first !== undefined) {
        problems.push({ sheet: def.name, row, column: k.name, code: "duplicate-ref", message: `"${key}" is already used on row ${first}` });
      } else {
        keys[def.name].set(String(key), row);
      }
    }
  }

  // Kind: told apart by what the rows say.
  for (const def of SHEETS) {
    for (const { row, v } of typed[def.name]) {
      for (const c of def.columns) {
        const value = v[c.name];
        if (typeof value !== "string" || value === "") continue;
        const isName = (NAMING_COLUMNS as readonly string[]).includes(c.name);
        const isSlug = c.name === "trip_slug";
        if (!isName && !isSlug) continue;
        const marker = isName ? SAMPLE_NAME : SAMPLE_SLUG;
        const marked = value.startsWith(marker);
        if (kind === "synthetic" && !marked) {
          problems.push({ sheet: def.name, row, column: c.name, code: "not-synthetic", message: `"${value}" does not start with ${marker}; in a synthetic workbook every one does` });
        } else if (kind === "real" && marked) {
          problems.push({ sheet: def.name, row, column: c.name, code: "looks-synthetic", message: `"${value}" starts with ${marker}; a real workbook holds no sample rows` });
        }
      }
    }
  }

  // Refs: each points at a key on its sheet (for real, trip_slug refs may
  // instead name a trip in the record; the resolver checks those).
  for (const def of SHEETS) {
    for (const c of def.columns.filter((c) => c.refSheet)) {
      if (kind === "real" && c.refSheet === "Trips") continue;
      for (const { row, v } of typed[def.name]) {
        const ref = v[c.name];
        if (ref === null || ref === "") continue;
        if (!keys[c.refSheet!].has(String(ref))) {
          problems.push({ sheet: def.name, row, column: c.name, code: "dangling-ref", message: `"${ref}" matches no row on the ${c.refSheet} sheet` });
        }
      }
    }
  }

  // A handover never hands over more than its item holds.
  const itemQty = new Map<string, number>();
  for (const { v } of typed.Items) {
    if (typeof v.item_ref === "string") itemQty.set(v.item_ref, typeof v.quantity === "number" ? v.quantity : 1);
  }
  // Summed across all of an item's handovers, no more than the item holds:
  // reported once per item, on the row where the running total first passes
  // the item's quantity (unless that row is already over on its own).
  const handedSoFar = new Map<string, number>();
  const sumReported = new Set<string>();
  for (const { row, v } of typed.Handovers) {
    if (typeof v.item_ref !== "string") continue;
    const held = itemQty.get(v.item_ref);
    const handed = typeof v.quantity === "number" ? v.quantity : 1;
    if (held === undefined) continue;
    const total = (handedSoFar.get(v.item_ref) ?? 0) + handed;
    handedSoFar.set(v.item_ref, total);
    if (handed > held) {
      problems.push({ sheet: "Handovers", row, column: "quantity", code: "handover-over-quantity", message: `${handed} is more than item ${v.item_ref}'s quantity of ${held}` });
      sumReported.add(v.item_ref);
    } else if (total > held && !sumReported.has(v.item_ref)) {
      const rows = typed.Handovers.filter((h) => h.v.item_ref === v.item_ref && h.row <= row).map((h) => h.row);
      problems.push({ sheet: "Handovers", row, column: "quantity", code: "handovers-sum-over-quantity", message: `handovers of item ${v.item_ref} (rows ${rows.join(", ")}) add up to ${total}, more than its quantity of ${held}` });
      sumReported.add(v.item_ref);
    }
  }

  // A followup matches exactly one handover, by item and recipient.
  for (const { row, v } of typed.Followups) {
    if (typeof v.item_ref !== "string" || typeof v.recipient_ref !== "string") continue;
    if (!keys.Items.has(v.item_ref) || !keys.Recipients.has(v.recipient_ref)) continue; // already a dangling ref
    const matches = typed.Handovers.filter((h) => h.v.item_ref === v.item_ref && h.v.recipient_ref === v.recipient_ref);
    if (matches.length === 0) {
      problems.push({ sheet: "Followups", row, column: "item_ref", code: "followup-no-handover", message: `no handover gives item ${v.item_ref} to ${v.recipient_ref}` });
    } else if (matches.length > 1) {
      problems.push({ sheet: "Followups", row, column: "item_ref", code: "followup-many-handovers", message: `item ${v.item_ref} to ${v.recipient_ref} matches ${matches.length} handovers (rows ${matches.map((m) => m.row).join(", ")})` });
    }
  }

  return { counts, problems };
}

export function formatProblem(p: Problem): string {
  return `${p.sheet}, ${p.row}, ${p.column}: ${p.message}`;
}
