// Fixtures for `pnpm record:check --selftest`: the synthetic workbook must
// pass, and each must-fail fixture (the synthetic workbook with one thing
// broken) must fail with its own problem at its own cell.

import { checkWorkbook, formatProblem, type ProblemCode } from "./check";
import type { SheetName } from "./definition";
import { syntheticRows } from "./synthetic";
import { buildWorkbook, parseWorkbook, workbookBuffer, type CellInput } from "./workbook";

type Rows = Record<SheetName, Record<string, CellInput>[]>;

export type MustFail = {
  name: string;
  expect: { sheet: SheetName; row: number; column: string; code: ProblemCode };
  mutate: (rows: Rows) => void;
};

/** Data row i (0-based) sits on spreadsheet row i + 2. */
const row = (i: number) => i + 2;

export const MUST_FAIL: readonly MustFail[] = [
  {
    name: "a missing required cell",
    expect: { sheet: "Items", row: row(0), column: "description", code: "missing-required" },
    mutate: (r) => void (r.Items[0].description = undefined),
  },
  {
    name: "a value outside its allowed set",
    expect: { sheet: "Items", row: row(0), column: "condition", code: "not-allowed" },
    mutate: (r) => void (r.Items[0].condition = "broken"),
  },
  {
    name: "a non-number where a number belongs",
    expect: { sheet: "Items", row: row(0), column: "original_cost_usd", code: "not-a-number" },
    mutate: (r) => void (r.Items[0].original_cost_usd = "about 500"),
  },
  {
    name: "an unparseable date",
    expect: { sheet: "Handovers", row: row(0), column: "handed_on", code: "bad-date" },
    mutate: (r) => void (r.Handovers[0].handed_on = "sometime in November"),
  },
  {
    name: "a duplicate ref",
    expect: { sheet: "Sources", row: row(3), column: "source_ref", code: "duplicate-ref" },
    mutate: (r) => void r.Sources.push({ ...r.Sources[0] }),
  },
  {
    name: "a ref that points at nothing",
    expect: { sheet: "Handovers", row: row(0), column: "shipment_ref", code: "dangling-ref" },
    mutate: (r) => void (r.Handovers[0].shipment_ref = "sample-shp-99"),
  },
  {
    name: "a handover quantity above its item's quantity",
    expect: { sheet: "Handovers", row: row(0), column: "quantity", code: "handover-over-quantity" },
    mutate: (r) => void (r.Handovers[0].quantity = Number(r.Items[0].quantity) + 1),
  },
  {
    name: "handovers of one item adding up to more than its quantity",
    expect: { sheet: "Handovers", row: row(40), column: "quantity", code: "handovers-sum-over-quantity" },
    mutate: (r) => {
      // A second handover of an item of 1, each row within the quantity on its own.
      const item = r.Items.find((i) => i.quantity === 1)!;
      const first = r.Handovers.find((h) => h.item_ref === item.item_ref)!;
      const other = r.Recipients.find((x) => x.recipient_ref !== first.recipient_ref)!;
      r.Handovers.push({ ...first, recipient_ref: other.recipient_ref, quantity: 1 });
    },
  },
  {
    name: "a followup that matches no handover",
    expect: { sheet: "Followups", row: row(0), column: "item_ref", code: "followup-no-handover" },
    mutate: (r) => {
      const f = r.Followups[0];
      f.recipient_ref = r.Recipients.map((x) => x.recipient_ref).find(
        (ref) => !r.Handovers.some((h) => h.item_ref === f.item_ref && h.recipient_ref === ref),
      );
    },
  },
  {
    name: "a followup that matches more than one handover",
    expect: { sheet: "Followups", row: row(0), column: "item_ref", code: "followup-many-handovers" },
    mutate: (r) => {
      const f = r.Followups[0];
      const h = r.Handovers.find((x) => x.item_ref === f.item_ref && x.recipient_ref === f.recipient_ref)!;
      r.Handovers.push({ ...h, quantity: 1 });
    },
  },
];

export type SelftestLine = { name: string; ok: boolean; detail: string };

export async function runSelftest(): Promise<{ pass: boolean; lines: SelftestLine[] }> {
  const lines: SelftestLine[] = [];

  const clean = checkWorkbook(await parseWorkbook(await workbookBuffer(buildWorkbook(syntheticRows()))));
  lines.push({
    name: "must pass: the synthetic workbook",
    ok: clean.problems.length === 0,
    detail: clean.problems.length === 0 ? "no problems" : clean.problems.map(formatProblem).join("; "),
  });

  for (const f of MUST_FAIL) {
    const rows = syntheticRows();
    f.mutate(rows);
    const result = checkWorkbook(await parseWorkbook(await workbookBuffer(buildWorkbook(rows))));
    const hit = result.problems.find(
      (p) => p.sheet === f.expect.sheet && p.row === f.expect.row && p.column === f.expect.column && p.code === f.expect.code,
    );
    lines.push({
      name: `must fail: ${f.name}`,
      ok: hit !== undefined,
      detail: hit ? formatProblem(hit) : `expected ${f.expect.code} at ${f.expect.sheet}, ${f.expect.row}, ${f.expect.column}; got ${result.problems.map(formatProblem).join("; ") || "no problems"}`,
    });
  }
  return { pass: lines.every((l) => l.ok), lines };
}
