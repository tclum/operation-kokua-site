import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRows } from "./build";
import { checkWorkbook } from "./check";
import type { SheetName } from "./definition";
import { rehearsalRows } from "./rehearsal";
import { resolveWorkbook, type Snapshot } from "./resolve";
import { buildWorkbook, parseWorkbook, workbookBuffer, type CellInput, type ParsedWorkbook } from "./workbook";

type Rows = Partial<Record<SheetName, Record<string, CellInput>[]>>;

const parsed = async (rows: Rows): Promise<ParsedWorkbook> => parseWorkbook(await workbookBuffer(buildWorkbook(rows)));

/** The old-site batch as the seed migration inserts it, with made-up ids. */
function seedSnapshot(): Snapshot {
  const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261125021334_seed_old_site.sql"), "utf8");
  const q = (s: string) => (s === "null" ? null : s.replace(/^'|'$/g, ""));
  const trips = [...sql.matchAll(/^\s+\('([a-z0-9-]+)', '([^']*)', (\d{4}), (\d+|null), ('[^']*'|null), '([^']*)'\)/gm)].map((m, i) => ({
    id: `trip-${i + 1}`,
    slug: m[1],
    title: m[2],
    year: Number(m[3]),
    country: m[6],
    batchLabel: "old-site",
  }));
  const recipients = [...sql.matchAll(/^\s+\('([^']*)', ('[^']*'|null), '([^']*)', '([^']*)'\)/gm)].map((m, i) => ({
    id: `rcp-${i + 1}`,
    name: m[1],
    department: q(m[2]),
    city: m[3],
    country: m[4],
    batchLabel: "old-site",
  }));
  return { trips, recipients, sources: [] };
}

const SNAP = seedSnapshot();
const id = (slug: string) => SNAP.trips.find((t) => t.slug === slug)!.id;
const outcome = (r: ReturnType<typeof resolveWorkbook>, sheet: SheetName, row: number) => r.rows.find((x) => x.sheet === sheet && x.row === row);

describe("the test snapshot is the seed", () => {
  it("holds the 12 trips and 4 recipients of the old-site batch", () => {
    expect(SNAP.trips).toHaveLength(12);
    expect(SNAP.recipients).toHaveLength(4);
    expect(SNAP.recipients[0]).toMatchObject({ name: "Cho Ray Hospital", department: "Neurosurgery", city: "Ho Chi Minh City", country: "Vietnam" });
    expect(SNAP.recipients[1].department).toBeNull();
  });
});

describe("resolver: trips", () => {
  it("matched: same slug, title, year and country, ignoring case and surrounding space", async () => {
    const r = resolveWorkbook(await parsed({ Trips: [{ trip_slug: "hanoi-2015", title: "  HANOI, november 2015 ", year: 2015, country: "vietnam " }] }), SNAP);
    expect(outcome(r, "Trips", 2)).toEqual({ sheet: "Trips", row: 2, outcome: "matched", id: id("hanoi-2015"), what: "trip hanoi-2015", batchLabel: "old-site" });
    expect(r.matched.Trips!.get("hanoi-2015")).toBe(id("hanoi-2015"));
    expect(r.problems).toEqual([]);
  });

  it("new: a slug not in the record", async () => {
    const r = resolveWorkbook(await parsed({ Trips: [{ trip_slug: "hue-2018", title: "Hue, 2018", year: 2018, country: "Vietnam" }] }), SNAP);
    expect(outcome(r, "Trips", 2)).toEqual({ sheet: "Trips", row: 2, outcome: "new" });
  });

  it("problem: same slug, and the problem names each differing column", async () => {
    const r = resolveWorkbook(await parsed({ Trips: [{ trip_slug: "hanoi-2015", title: "Hanoi, October 2015", year: 2015, country: "Laos" }] }), SNAP);
    expect(r.problems).toHaveLength(1);
    const p = r.problems[0];
    expect(p).toMatchObject({ sheet: "Trips", row: 2, column: "trip_slug", code: "trip-differs" });
    expect(p.message).toContain('title ("Hanoi, October 2015" here, "Hanoi, November 2015" in the record)');
    expect(p.message).toContain('country ("Laos" here, "Vietnam" in the record)');
    expect(p.message).not.toContain("year");
    expect(outcome(r, "Trips", 2)?.outcome).toBe("problem");
  });

  it("a trip_slug on Shipments or Handovers may name an existing trip directly", async () => {
    const r = resolveWorkbook(
      await parsed({
        Shipments: [{ shipment_ref: "s1", trip_slug: "cambodia-2015" }],
        Handovers: [{ item_ref: "i1", recipient_ref: "r1", trip_slug: "cambodia-2014" }],
      }),
      SNAP,
    );
    expect(r.problems).toEqual([]);
    expect(r.directTrips).toEqual([
      { sheet: "Shipments", row: 2, slug: "cambodia-2015", id: id("cambodia-2015"), batchLabel: "old-site" },
      { sheet: "Handovers", row: 2, slug: "cambodia-2014", id: id("cambodia-2014"), batchLabel: "old-site" },
    ]);
    expect(outcome(r, "Shipments", 2)?.outcome).toBe("new");
    expect(outcome(r, "Handovers", 2)?.outcome).toBe("new");
  });

  it("a trip_slug naming a Trips row of the workbook is not a direct ref, even when that slug is new", async () => {
    const r = resolveWorkbook(
      await parsed({ Trips: [{ trip_slug: "hue-2018", title: "Hue, 2018", year: 2018, country: "Vietnam" }], Shipments: [{ shipment_ref: "s1", trip_slug: "hue-2018" }] }),
      SNAP,
    );
    expect(r.directTrips).toEqual([]);
    expect(r.problems).toEqual([]);
  });

  it("problem: a trip_slug that names neither a Trips row nor a trip in the record", async () => {
    const r = resolveWorkbook(await parsed({ Handovers: [{ item_ref: "i1", recipient_ref: "r1", trip_slug: "hue-2018" }] }), SNAP);
    expect(r.problems).toEqual([
      { sheet: "Handovers", row: 2, column: "trip_slug", code: "trip-unknown", message: '"hue-2018" matches no row on the Trips sheet and no trip in the record' },
    ]);
  });
});

describe("resolver: recipients", () => {
  const cho = { recipient_ref: "r1", name: "Cho Ray Hospital", department: "Neurosurgery", city: "Ho Chi Minh City", country: "Vietnam" };

  it("matched: name, city, country and department agree, ignoring case and surrounding space", async () => {
    const r = resolveWorkbook(await parsed({ Recipients: [{ ...cho, name: " cho ray HOSPITAL ", department: "neurosurgery" }] }), SNAP);
    expect(outcome(r, "Recipients", 2)).toMatchObject({ outcome: "matched", id: "rcp-1", batchLabel: "old-site" });
    expect(r.matched.Recipients!.get("r1")).toBe("rcp-1");
  });

  it("matched: department blank in the workbook agrees with one in the record", async () => {
    const r = resolveWorkbook(await parsed({ Recipients: [{ ...cho, department: undefined }] }), SNAP);
    expect(outcome(r, "Recipients", 2)).toMatchObject({ outcome: "matched", id: "rcp-1" });
  });

  it("matched: department filled in the workbook agrees with a blank one in the record", async () => {
    const r = resolveWorkbook(await parsed({ Recipients: [{ recipient_ref: "r1", name: "Hospital 108", department: "Orthopedics", city: "Hanoi", country: "Vietnam" }] }), SNAP);
    expect(outcome(r, "Recipients", 2)).toMatchObject({ outcome: "matched", id: "rcp-2" });
  });

  it("new: department differs on both sides", async () => {
    const r = resolveWorkbook(await parsed({ Recipients: [{ ...cho, department: "Orthopedics" }] }), SNAP);
    expect(outcome(r, "Recipients", 2)?.outcome).toBe("new");
  });

  it("new: city differs, or is blank where the record has one", async () => {
    const r = resolveWorkbook(await parsed({ Recipients: [{ ...cho, city: "Saigon" }, { ...cho, recipient_ref: "r2", city: undefined }] }), SNAP);
    expect(outcome(r, "Recipients", 2)?.outcome).toBe("new");
    expect(outcome(r, "Recipients", 3)?.outcome).toBe("new");
  });

  it("problem: two rows in the record agree", async () => {
    const snap: Snapshot = { ...SNAP, recipients: [...SNAP.recipients, { ...SNAP.recipients[0], id: "rcp-dup", department: null, batchLabel: "later" }] };
    const r = resolveWorkbook(await parsed({ Recipients: [cho] }), snap);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ sheet: "Recipients", row: 2, column: "name", code: "recipient-ambiguous" });
    expect(r.problems[0].message).toContain("rcp-1 (old-site), rcp-dup (later)");
  });
});

describe("resolver: sources", () => {
  const snap: Snapshot = { ...SNAP, sources: [{ id: "src-1", name: "Kaiser Donations", country: "USA", batchLabel: "b1" }] };

  it("matched: name and country agree, ignoring case and surrounding space", async () => {
    const r = resolveWorkbook(await parsed({ Sources: [{ source_ref: "s", name: "kaiser donations ", country: "usa" }] }), snap);
    expect(outcome(r, "Sources", 2)).toMatchObject({ outcome: "matched", id: "src-1", batchLabel: "b1" });
  });

  it("new: country differs", async () => {
    const r = resolveWorkbook(await parsed({ Sources: [{ source_ref: "s", name: "Kaiser Donations", country: "Japan" }] }), snap);
    expect(outcome(r, "Sources", 2)?.outcome).toBe("new");
  });

  it("problem: two rows in the record agree", async () => {
    const two: Snapshot = { ...snap, sources: [...snap.sources, { id: "src-2", name: "KAISER DONATIONS", country: "USA", batchLabel: "b2" }] };
    const r = resolveWorkbook(await parsed({ Sources: [{ source_ref: "s", name: "Kaiser Donations", country: "USA" }] }), two);
    expect(r.problems.map((p) => p.code)).toEqual(["source-ambiguous"]);
  });
});

describe("resolver: everything else is always new", () => {
  it("items, shipments, handovers and followups are never matched", async () => {
    const r = resolveWorkbook(
      await parsed({
        Items: [{ item_ref: "i1", description: "Cho Ray Hospital" }],
        Shipments: [{ shipment_ref: "s1" }],
        Handovers: [{ item_ref: "i1", recipient_ref: "r1" }],
        Followups: [{ item_ref: "i1", recipient_ref: "r1", checked_on: "2018-03-01" }],
      }),
      SNAP,
    );
    expect(r.rows.map((x) => `${x.sheet} ${x.outcome}`)).toEqual(["Items new", "Shipments new", "Handovers new", "Followups new"]);
  });
});

describe("the rehearsal workbook", () => {
  it("checks clean as real and fails as synthetic", async () => {
    const wb = await parsed(rehearsalRows());
    expect(checkWorkbook(wb, "real").problems).toEqual([]);
    expect(checkWorkbook(wb, "synthetic").problems.map((p) => p.code)).toContain("not-synthetic");
  });

  it("resolves to 2 matched trips referenced (one by Trips row, one directly), 1 matched recipient, the rest new", async () => {
    const wb = await parsed(rehearsalRows());
    const r = resolveWorkbook(wb, SNAP);
    expect(r.problems).toEqual([]);
    const matched = r.rows.filter((x) => x.outcome === "matched");
    expect(matched.map((m) => m.outcome === "matched" && `${m.sheet} ${m.what}`)).toEqual([
      "Recipients recipient Cho Ray Hospital, Neurosurgery, Ho Chi Minh City, Vietnam",
      "Trips trip hanoi-2015",
    ]);
    expect([...new Set(r.directTrips.map((d) => d.slug))]).toEqual(["cambodia-2015"]);
    expect(r.directTrips.map((d) => `${d.sheet} ${d.row}`)).toEqual(["Handovers 4", "Handovers 5"]);
    const trips = new Set([...r.matched.Trips!.values(), ...r.existingTrips.values()]);
    expect(trips).toEqual(new Set([id("hanoi-2015"), id("cambodia-2015")]));
    const total = Object.values(wb.sheets).reduce((n, rows) => n + rows.length, 0);
    expect(r.rows).toHaveLength(total);
    expect(r.rows.filter((x) => x.outcome === "new")).toHaveLength(total - 2);
  });

  it("builds rows that skip matched rows, keep their raw rows, and carry the existing ids", async () => {
    const wb = await parsed(rehearsalRows());
    const r = resolveWorkbook(wb, SNAP);
    let n = 0;
    const rows = buildRows(wb, "batch", () => `new-${++n}`, r);
    expect(rows.import_rows).toHaveLength(14);
    expect(rows.trips).toHaveLength(1);
    expect(rows.recipients).toHaveLength(1);
    expect(rows.sources).toHaveLength(1);
    expect(rows.items).toHaveLength(4);
    expect(rows.shipments).toHaveLength(1);
    expect(rows.handovers).toHaveLength(4);
    expect(rows.valuations).toHaveLength(6);
    expect(rows.shipments[0]).toMatchObject({ trip_id: id("hanoi-2015"), reference: "REHEARSAL-WAYBILL-0001" });
    expect(rows.handovers.map((h) => h.trip_id)).toEqual([id("hanoi-2015"), rows.trips[0].id, id("cambodia-2015"), id("cambodia-2015")]);
    expect(rows.handovers.map((h) => h.recipient_id)).toEqual(["rcp-1", rows.recipients[0].id, rows.recipients[0].id, "rcp-1"]);
    expect(rows.valuations.filter((v) => v.valued_on === "2016-10-03")).toHaveLength(4);
    // No row of the build carries an existing id as its own id.
    const own = new Set(Object.values(rows).flat().map((x) => x.id));
    for (const existing of [id("hanoi-2015"), id("cambodia-2015"), "rcp-1"]) expect(own.has(existing)).toBe(false);
  });
});
