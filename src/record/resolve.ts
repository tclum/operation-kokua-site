// Resolving a real workbook against the real record. Pure and offline: the
// importer fetches the snapshot of existing real trips, recipients and
// sources and passes it in. Synthetic batches never come here; they join only
// to rows of their own batch.
//
// Per sheet row, the outcome is `new`, `matched <existing id>`, or a problem:
// - Trips: a trip_slug equal to an existing real trip's slug is matched when
//   title, year and country agree (case and surrounding space ignored; a blank
//   optional cell agrees with anything), and is a problem naming each
//   differing column when they do not. A trip_slug on Shipments or Handovers
//   may name a Trips row of the workbook or an existing real trip directly.
// - Recipients: matched when name, city and country agree and department
//   agrees or is blank on either side. Two existing rows agreeing is a problem.
// - Sources: matched when name and country agree. Two agreeing is a problem.
// - Items, shipments, handovers, followups and valuations are always new; the
//   file's sha256 is the guard against loading the same records twice.
// A matched row is not inserted and not changed; rows that point at it carry
// the existing id. Its raw row still goes into import_rows.

import { sheetByName, type SheetName } from "./definition";
import { typedRow, type Problem, type Typed } from "./check";
import type { ParsedWorkbook } from "./workbook";

export type ExistingTrip = { id: string; slug: string; title: string; year: number; country: string; batchLabel: string };
export type ExistingRecipient = { id: string; name: string; department: string | null; city: string | null; country: string; batchLabel: string };
export type ExistingSource = { id: string; name: string; country: string | null; batchLabel: string };

/** The real record as it stands: what a real workbook may match or point at. */
export type Snapshot = { trips: ExistingTrip[]; recipients: ExistingRecipient[]; sources: ExistingSource[] };

export type Resolved =
  | { sheet: SheetName; row: number; outcome: "new" }
  | { sheet: SheetName; row: number; outcome: "matched"; id: string; what: string; batchLabel: string }
  | { sheet: SheetName; row: number; outcome: "problem"; problems: Problem[] };

/** A trip_slug on Shipments or Handovers that names an existing trip with no Trips row. */
export type DirectTripRef = { sheet: SheetName; row: number; slug: string; id: string; batchLabel: string };

export type Resolution = {
  /** One entry per sheet row, in sheet order. */
  rows: Resolved[];
  directTrips: DirectTripRef[];
  problems: Problem[];
  /** What the row builder needs: per keyed sheet, key -> existing id for matched rows. */
  matched: Partial<Record<SheetName, Map<string, string>>>;
  /** Existing trips named directly, slug -> id. */
  existingTrips: Map<string, string>;
};

const norm = (v: Typed | undefined): string => (v === null || v === undefined ? "" : String(v).trim().toLowerCase());

/** Equal ignoring case and surrounding space. Blank agrees with anything when `blankAgrees`. */
function agree(a: Typed | undefined, b: Typed | undefined, blankAgrees: boolean): boolean {
  const [x, y] = [norm(a), norm(b)];
  if (blankAgrees && (x === "" || y === "")) return true;
  return x === y;
}

function optional(sheet: SheetName, column: string): boolean {
  return !sheetByName(sheet)!.columns.find((c) => c.name === column)!.required;
}

export function resolveWorkbook(wb: ParsedWorkbook, snapshot: Snapshot): Resolution {
  const rows: Resolved[] = [];
  const directTrips: DirectTripRef[] = [];
  const problems: Problem[] = [];
  const matched: Resolution["matched"] = { Trips: new Map(), Recipients: new Map(), Sources: new Map() };
  const existingTrips = new Map<string, string>();
  const tripBySlug = new Map(snapshot.trips.map((t) => [t.slug, t]));
  const workbookSlugs = new Set(wb.sheets.Trips.map((r) => norm(typedRow("Trips", r.values).trip_slug)));

  const problem = (sheet: SheetName, row: number, column: string, code: Problem["code"], message: string) => {
    const p: Problem = { sheet, row, column, code, message };
    problems.push(p);
    rows.push({ sheet, row, outcome: "problem", problems: [p] });
  };

  for (const r of wb.sheets.Sources) {
    const v = typedRow("Sources", r.values);
    const hits = snapshot.sources.filter((s) => agree(v.name, s.name, false) && agree(v.country, s.country, false));
    if (hits.length > 1) {
      problem("Sources", r.rowNumber, "name", "source-ambiguous", `"${v.name}" matches ${hits.length} sources already in the record (${hits.map((h) => `${h.id} (${h.batchLabel})`).join(", ")})`);
    } else if (hits.length === 1) {
      matched.Sources!.set(String(v.source_ref), hits[0].id);
      rows.push({ sheet: "Sources", row: r.rowNumber, outcome: "matched", id: hits[0].id, what: `source ${hits[0].name}`, batchLabel: hits[0].batchLabel });
    } else {
      rows.push({ sheet: "Sources", row: r.rowNumber, outcome: "new" });
    }
  }

  for (const r of wb.sheets.Recipients) {
    const v = typedRow("Recipients", r.values);
    const hits = snapshot.recipients.filter(
      (e) => agree(v.name, e.name, false) && agree(v.city, e.city, false) && agree(v.country, e.country, false) && agree(v.department, e.department, true),
    );
    if (hits.length > 1) {
      problem("Recipients", r.rowNumber, "name", "recipient-ambiguous", `"${v.name}" matches ${hits.length} recipients already in the record (${hits.map((h) => `${h.id} (${h.batchLabel})`).join(", ")})`);
    } else if (hits.length === 1) {
      const e = hits[0];
      matched.Recipients!.set(String(v.recipient_ref), e.id);
      const what = [e.name, e.department, e.city, e.country].filter(Boolean).join(", ");
      rows.push({ sheet: "Recipients", row: r.rowNumber, outcome: "matched", id: e.id, what: `recipient ${what}`, batchLabel: e.batchLabel });
    } else {
      rows.push({ sheet: "Recipients", row: r.rowNumber, outcome: "new" });
    }
  }

  for (const r of wb.sheets.Trips) {
    const v = typedRow("Trips", r.values);
    const e = tripBySlug.get(String(v.trip_slug));
    if (!e) {
      rows.push({ sheet: "Trips", row: r.rowNumber, outcome: "new" });
      continue;
    }
    const differing = (["title", "year", "country"] as const).filter((c) => !agree(v[c], e[c], optional("Trips", c)));
    if (differing.length > 0) {
      const detail = differing.map((c) => `${c} ("${v[c] ?? ""}" here, "${e[c]}" in the record)`).join(", ");
      problem("Trips", r.rowNumber, "trip_slug", "trip-differs", `trip ${e.slug} is already in the record (${e.batchLabel}) with a different ${detail}`);
    } else {
      matched.Trips!.set(String(v.trip_slug), e.id);
      rows.push({ sheet: "Trips", row: r.rowNumber, outcome: "matched", id: e.id, what: `trip ${e.slug}`, batchLabel: e.batchLabel });
    }
  }

  for (const sheet of ["Items", "Shipments", "Handovers", "Followups"] as const) {
    for (const r of wb.sheets[sheet]) {
      const slug = sheet === "Shipments" || sheet === "Handovers" ? typedRow(sheet, r.values).trip_slug : null;
      if (typeof slug === "string" && slug !== "" && !workbookSlugs.has(norm(slug))) {
        const e = tripBySlug.get(slug);
        if (!e) {
          problem(sheet, r.rowNumber, "trip_slug", "trip-unknown", `"${slug}" matches no row on the Trips sheet and no trip in the record`);
          continue;
        }
        existingTrips.set(slug, e.id);
        directTrips.push({ sheet, row: r.rowNumber, slug, id: e.id, batchLabel: e.batchLabel });
      }
      rows.push({ sheet, row: r.rowNumber, outcome: "new" });
    }
  }

  return { rows, directTrips, problems, matched, existingTrips };
}
