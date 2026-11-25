// Reading and writing intake workbooks. Layout comes from ./definition only.
// Offline: nothing here touches the network.

import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  READ_ME_LINES,
  READ_ME_SHEET,
  SHEETS,
  headerName,
  headerText,
  type SheetName,
} from "./definition";

/** A cell value as the checker sees it. */
export type CellValue = string | number | boolean | Date;

/** A JSON value, as stored in import_rows.raw. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type ParsedRow = {
  /** The spreadsheet row number (the header is row 1). */
  rowNumber: number;
  /** Every non-empty cell, keyed by its header text exactly as written, value as read. */
  raw: Record<string, Json>;
  /** Every non-empty cell under a known column, keyed by column name. */
  values: Record<string, CellValue>;
};

/** A problem with the workbook's shape: a missing sheet or column, an unknown one. */
export type ShapeProblem = { sheet: string; row: number; column: string; code: string; message: string };

export type ParsedWorkbook = {
  sheets: Record<SheetName, ParsedRow[]>;
  shape: ShapeProblem[];
};

/** Fixed so two runs of the generators write identical workbooks. */
const STAMP = new Date(Date.UTC(2026, 10, 24));
/** Rows that carry dropdowns in a generated workbook. */
export const VALIDATED_ROWS = 1000;

type RawCell = ExcelJS.CellValue;

/** What the cell holds, unwrapped from rich text, formulas and hyperlinks. */
function unwrap(v: RawCell): CellValue | { error: string } | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v.trim() === "" ? undefined : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("richText" in v) return unwrap(v.richText.map((r) => r.text).join(""));
    if ("formula" in v || "sharedFormula" in v) return unwrap((v as ExcelJS.CellFormulaValue).result as RawCell);
    if ("hyperlink" in v) return unwrap((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return { error: String((v as ExcelJS.CellErrorValue).error) };
  }
  return { error: `unreadable cell ${JSON.stringify(v)}` };
}

function toJson(v: CellValue | { error: string }): Json {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return { error: v.error };
  return v;
}

function cellText(v: RawCell): string {
  const u = unwrap(v);
  if (u === undefined) return "";
  if (u instanceof Date) return u.toISOString();
  return typeof u === "object" ? "" : String(u);
}

export async function parseWorkbook(data: Buffer | ArrayBuffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const shape: ShapeProblem[] = [];
  const sheets = Object.fromEntries(SHEETS.map((s) => [s.name, [] as ParsedRow[]])) as Record<SheetName, ParsedRow[]>;

  for (const ws of wb.worksheets) {
    if (ws.name !== READ_ME_SHEET && !SHEETS.some((s) => s.name === ws.name)) {
      shape.push({ sheet: ws.name, row: 1, column: "-", code: "unknown-sheet", message: "this sheet is not part of the intake workbook" });
    }
  }

  for (const def of SHEETS) {
    const ws = wb.getWorksheet(def.name);
    if (!ws) {
      shape.push({ sheet: def.name, row: 1, column: "-", code: "missing-sheet", message: "sheet is missing" });
      continue;
    }
    // Header row: column index -> [header text, column name].
    const headers = new Map<number, { text: string; name: string }>();
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell.value);
      if (text !== "") headers.set(colNumber, { text, name: headerName(text) });
    });
    const known = new Set(def.columns.map((c) => c.name));
    const seen = new Set<string>();
    for (const { text, name } of headers.values()) {
      if (!known.has(name)) {
        shape.push({ sheet: def.name, row: 1, column: text, code: "unknown-column", message: "this column is not part of the sheet" });
      } else if (seen.has(name)) {
        shape.push({ sheet: def.name, row: 1, column: text, code: "duplicate-column", message: "this column appears twice" });
      }
      seen.add(name);
    }
    for (const c of def.columns) {
      if (c.required && !seen.has(c.name)) {
        shape.push({ sheet: def.name, row: 1, column: c.name, code: "missing-column", message: "required column is missing" });
      }
    }

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const raw: Record<string, Json> = {};
      const values: Record<string, CellValue> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const v = unwrap(cell.value);
        if (v === undefined) return;
        const header = headers.get(colNumber) ?? { text: `column ${colNumber}`, name: "" };
        raw[header.text] = toJson(v);
        if (!known.has(header.name)) return;
        values[header.name] = typeof v === "object" && !(v instanceof Date) ? `#ERROR ${v.error}` : v;
      });
      if (Object.keys(raw).length === 0) return;
      sheets[def.name].push({ rowNumber, raw, values });
    });
  }
  return { sheets, shape };
}

/** A value the generators write into a cell. */
export type CellInput = string | number | boolean | Date | undefined;

/**
 * The intake workbook: a Read me sheet, then one sheet per definition with a
 * frozen header row, required headers marked " *", and dropdowns for every
 * column with a fixed set of values. `rows` fills the sheets (the synthetic
 * generator); without it the workbook is the empty template.
 */
export function buildWorkbook(rows?: Partial<Record<SheetName, Record<string, CellInput>[]>>): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "operation-kokua-site";
  wb.lastModifiedBy = "operation-kokua-site";
  wb.created = STAMP;
  wb.modified = STAMP;

  const readMe = wb.addWorksheet(READ_ME_SHEET);
  readMe.getColumn(1).width = 110;
  READ_ME_LINES.forEach((line, i) => {
    const cell = readMe.getCell(i + 1, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  for (const def of SHEETS) {
    const ws = wb.addWorksheet(def.name, { views: [{ state: "frozen", ySplit: 1 }] });
    def.columns.forEach((c, i) => {
      const cell = ws.getCell(1, i + 1);
      cell.value = headerText(c);
      cell.font = { bold: true };
      if (c.required) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7B0" } };
      }
      cell.note = c.required ? `Required. ${c.help}` : c.help;
      ws.getColumn(i + 1).width = Math.max(14, headerText(c).length + 4);
      if (c.values) {
        const letter = ws.getColumn(i + 1).letter;
        (ws as unknown as { dataValidations: { add(a: string, v: ExcelJS.DataValidation): void } }).dataValidations.add(
          `${letter}2:${letter}${VALIDATED_ROWS}`,
          {
            type: "list",
            allowBlank: true,
            formulae: [`"${c.values.join(",")}"`],
            showErrorMessage: true,
            errorTitle: c.name,
            error: `Pick one of: ${c.values.join(", ")}, or leave blank.`,
          },
        );
      }
    });
    for (const r of rows?.[def.name] ?? []) {
      ws.addRow(def.columns.map((c) => r[c.name] ?? null));
    }
  }
  return wb;
}

/**
 * The workbook as .xlsx bytes. exceljs stamps every zip entry with the current
 * time, so the zip is re-packed with the fixed STAMP: the same workbook gives
 * the same bytes (and the same sha256) on every run.
 */
export async function workbookBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(await wb.xlsx.writeBuffer()));
  const out = new JSZip();
  for (const name of Object.keys(zip.files).sort()) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    out.file(name, await entry.async("nodebuffer"), { date: STAMP, createFolders: false });
  }
  return out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Sheet names and header rows, in order: what the template test compares. */
export async function workbookLayout(data: Buffer): Promise<{ sheet: string; header: string[] }[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  return wb.worksheets.map((ws) => {
    const header: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => header.push(cellText(cell.value)));
    return { sheet: ws.name, header };
  });
}

/** Every sheet's cell values row by row, for comparing two workbooks. */
export async function workbookCells(data: Buffer): Promise<Record<string, Json[][]>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const out: Record<string, Json[][]> = {};
  for (const ws of wb.worksheets) {
    const rows: Json[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: Json[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = unwrap(cell.value);
        cells.push(v === undefined ? null : toJson(v));
      });
      rows.push(cells);
    });
    out[ws.name] = rows;
  }
  return out;
}
