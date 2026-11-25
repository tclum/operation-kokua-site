import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { trips } from "../../src/content/trips";
import { buildRows, INSERT_ORDER } from "../../src/record/build";
import { checkWorkbook } from "../../src/record/check";
import { SHEETS } from "../../src/record/definition";
import { runSelftest } from "../../src/record/selftest";
import { BLANK_COLUMNS, SYNTHETIC_BLANKS_COUNTS, SYNTHETIC_COUNTS, syntheticBlanksWorkbook, syntheticWorkbook } from "../../src/record/synthetic";
import { parseWorkbook, workbookBuffer, workbookCells, workbookLayout } from "../../src/record/workbook";
import { parseImportArgs } from "./import";
import { SYNTHETIC_BLANKS_PATH, SYNTHETIC_PATH } from "./synthetic";
import { TEMPLATE_PATH, writeTemplate } from "./template";

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

/** Import specifiers in a TypeScript file (static and dynamic). */
function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** The absolute path an import resolves to, for relative and "@/" imports; else the specifier. */
function resolved(from: string, spec: string): string {
  if (spec.startsWith("@/")) return path.join(ROOT, "src", spec.slice(2));
  if (spec.startsWith(".")) return path.resolve(path.dirname(from), spec);
  return spec;
}

describe("applied migrations are byte-identical to what was applied", () => {
  it("pins both files by sha256", () => {
    expect(readdirSync(MIGRATIONS).sort()).toEqual(["20261125021239_record_foundation.sql", "20261125021334_seed_old_site.sql"]);
    expect(sha256(path.join(MIGRATIONS, "20261125021239_record_foundation.sql"))).toBe("e3398e14a5c2aae58a6a5ceecc5ee6c1d26002298794e95a72bb3a005c7edd42");
    expect(sha256(path.join(MIGRATIONS, "20261125021334_seed_old_site.sql"))).toBe("df2b6eb922c797e1c8caea2b5820b9cd6b46358ebee7b3bf60c88be141b25f28");
  });
});

describe("the seed's trips are the site's trips", () => {
  it("src/content/trips.ts slugs equal the 12 seeded slugs, in any order", () => {
    const sql = readFileSync(path.join(MIGRATIONS, "20261125021334_seed_old_site.sql"), "utf8");
    const seeded = [...sql.matchAll(/^\s+\('([a-z0-9-]+)', '[^']*', \d{4}, /gm)].map((m) => m[1]);
    expect(seeded).toHaveLength(12);
    expect(trips.map((t) => t.slug).sort()).toEqual([...seeded].sort());
  });
});

describe("secret key isolation", () => {
  const srcFiles = filesUnder(path.join(ROOT, "src")).filter((f) => /\.tsx?$/.test(f));
  const dbModule = path.join(ROOT, "scripts", "record", "db");

  it("no file under src/ imports scripts/record/db.ts", () => {
    const offenders = srcFiles.filter((f) => importsOf(f).some((s) => resolved(f, s).replace(/\.ts$/, "") === dbModule));
    expect(srcFiles.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });

  it("no non-test file under src/ imports anything under scripts/ or @supabase", () => {
    const offenders = srcFiles.filter((f) => !f.endsWith(".test.ts")).filter((f) =>
      importsOf(f).some((s) => s.startsWith("@supabase") || resolved(f, s).startsWith(path.join(ROOT, "scripts") + path.sep)),
    );
    expect(offenders).toEqual([]);
  });

  it("SUPABASE_SECRET_KEY is read only in scripts/record/db.ts", () => {
    const files = [...srcFiles, ...filesUnder(path.join(ROOT, "scripts"))].filter((f) => f !== __filename && /\.tsx?$/.test(f));
    const readers = files.filter((f) => readFileSync(f, "utf8").includes("SUPABASE_SECRET_KEY")).map((f) => path.relative(ROOT, f));
    expect(readers).toEqual(["scripts/record/db.ts"]);
  });

  it("no file under src/app or src/components imports anything under src/record", () => {
    const record = path.join(ROOT, "src", "record");
    const pageFiles = srcFiles.filter((f) => f.startsWith(path.join(ROOT, "src", "app")) || f.startsWith(path.join(ROOT, "src", "components")));
    const offenders = pageFiles.filter((f) => importsOf(f).some((s) => resolved(f, s).startsWith(record)));
    expect(pageFiles.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });

  it("the import check catches an offender (the check can fail)", () => {
    const fake = path.join(ROOT, "src", "app", "x.tsx");
    expect(resolved(fake, "@/record/definition").startsWith(path.join(ROOT, "src", "record"))).toBe(true);
    expect(resolved(path.join(ROOT, "src", "record", "x.ts"), "../../scripts/record/db").replace(/\.ts$/, "")).toBe(dbModule);
  });
});

describe("the template", () => {
  it("the committed template matches a fresh one: sheet names and header rows", async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "okp-template-"));
    try {
      const fresh = path.join(tmp, "t.xlsx");
      await writeTemplate(fresh);
      const committed = await workbookLayout(readFileSync(TEMPLATE_PATH));
      expect(committed).toEqual(await workbookLayout(readFileSync(fresh)));
      expect(committed.map((s) => s.sheet)).toEqual(["Read me", ...SHEETS.map((s) => s.name)]);
      expect(committed.find((s) => s.sheet === "Trips")?.header).toEqual(["trip_slug *", "title *", "year *", "month", "city", "country *", "note"]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("the synthetic workbook", () => {
  it("is deterministic: two runs give equal cell values (and equal bytes)", async () => {
    const a = await workbookBuffer(syntheticWorkbook());
    const b = await workbookBuffer(syntheticWorkbook());
    expect(await workbookCells(a)).toEqual(await workbookCells(b));
    expect(a.equals(b)).toBe(true);
  });

  it("the committed file holds the generator's cells", async () => {
    expect(await workbookCells(readFileSync(SYNTHETIC_PATH))).toEqual(await workbookCells(await workbookBuffer(syntheticWorkbook())));
  });

  it("passes the checker with the counts section 4 names", async () => {
    const result = checkWorkbook(await parseWorkbook(readFileSync(SYNTHETIC_PATH)));
    expect(result.problems).toEqual([]);
    expect(result.counts).toEqual(SYNTHETIC_COUNTS);
    expect(SYNTHETIC_COUNTS).toEqual({ Sources: 3, Recipients: 6, Trips: 4, Items: 40, Shipments: 5, Handovers: 40, Followups: 8 });
  });

  it.each([
    ["synthetic-v1.xlsx", SYNTHETIC_PATH, 500],
    ["synthetic-blanks-v1.xlsx", SYNTHETIC_BLANKS_PATH, 30],
  ])("%s: every string cell that names a thing starts with SAMPLE or sample-", async (_name, file, minimum) => {
    const wb = await parseWorkbook(readFileSync(file));
    const bad: string[] = [];
    let checked = 0;
    for (const s of SHEETS) {
      // Fixed vocabularies and dates name nothing.
      const naming = s.columns.filter((c) => c.type === "text" || c.type === "slug");
      for (const row of wb.sheets[s.name]) {
        for (const c of naming) {
          const v = row.values[c.name];
          if (v === undefined) continue;
          checked++;
          if (typeof v !== "string" || !(v.startsWith("SAMPLE") || v.startsWith("sample-"))) bad.push(`${s.name} ${row.rowNumber} ${c.name}: ${String(v)}`);
        }
      }
      for (const row of wb.sheets[s.name]) {
        for (const c of ["name", "description", "title"]) {
          if (row.values[c] !== undefined && !String(row.values[c]).startsWith("SAMPLE")) bad.push(`${s.name} ${row.rowNumber} ${c}`);
        }
        if (row.values.trip_slug !== undefined && !String(row.values.trip_slug).startsWith("sample-")) bad.push(`${s.name} ${row.rowNumber} trip_slug`);
      }
    }
    expect(checked).toBeGreaterThan(minimum);
    expect(bad).toEqual([]);
  });
});

describe("the blanks workbook", () => {
  it("is deterministic and the committed file holds the generator's cells", async () => {
    const a = await workbookBuffer(syntheticBlanksWorkbook());
    const b = await workbookBuffer(syntheticBlanksWorkbook());
    expect(a.equals(b)).toBe(true);
    expect(await workbookCells(readFileSync(SYNTHETIC_BLANKS_PATH))).toEqual(await workbookCells(a));
  });

  it("passes the checker with its counts", async () => {
    const result = checkWorkbook(await parseWorkbook(readFileSync(SYNTHETIC_BLANKS_PATH)));
    expect(result.problems).toEqual([]);
    expect(result.counts).toEqual(SYNTHETIC_BLANKS_COUNTS);
    expect(SYNTHETIC_BLANKS_COUNTS).toEqual({ Sources: 1, Recipients: 2, Trips: 1, Items: 5, Shipments: 1, Handovers: 5, Followups: 0 });
  });

  it("leaves kind, condition, both quantities, mode, date_precision and value_per blank on every row, and fills original_cost_usd on 2 items", async () => {
    const wb = await parseWorkbook(readFileSync(SYNTHETIC_BLANKS_PATH));
    expect(BLANK_COLUMNS).toEqual({ Sources: ["kind"], Items: ["condition", "quantity", "value_per"], Shipments: ["mode"], Handovers: ["quantity", "date_precision"] });
    for (const [sheet, cols] of Object.entries(BLANK_COLUMNS) as [keyof typeof wb.sheets, string[]][]) {
      expect(wb.sheets[sheet].length).toBeGreaterThan(0);
      for (const r of wb.sheets[sheet]) for (const c of cols) expect(r.values[c], `${sheet} ${r.rowNumber} ${c}`).toBeUndefined();
    }
    expect(wb.sheets.Items.filter((r) => r.values.original_cost_usd !== undefined)).toHaveLength(2);
  });
});

describe("the importer's row builder (no network)", () => {
  it("omits a blank cell from the row object instead of sending null", async () => {
    const wb = await parseWorkbook(readFileSync(SYNTHETIC_BLANKS_PATH));
    let n = 0;
    const rows = buildRows(wb, "batch", () => `id-${++n}`);
    const absent: [keyof typeof rows, string][] = [
      ["sources", "kind"],
      ["items", "condition"],
      ["items", "quantity"],
      ["shipments", "mode"],
      ["handovers", "quantity"],
      ["handovers", "date_precision"],
      ["valuations", "per"],
    ];
    expect(rows.valuations).toHaveLength(2);
    for (const [table, column] of absent) {
      expect(rows[table].length, table).toBeGreaterThan(0);
      for (const r of rows[table]) expect(Object.prototype.hasOwnProperty.call(r, column), `${table}.${column}`).toBe(false);
    }
    // No blank anywhere becomes an explicit null.
    for (const t of INSERT_ORDER) for (const r of rows[t]) expect(Object.values(r), t).not.toContain(null);
  });

  it("yields the section 4 counts, every structured row carrying an import row reference", async () => {
    const wb = await parseWorkbook(readFileSync(SYNTHETIC_PATH));
    let n = 0;
    const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const batchId = "batch";
    const rows = buildRows(wb, batchId, id);

    expect(Object.keys(rows)).toEqual([...INSERT_ORDER]);
    expect(rows.sources).toHaveLength(3);
    expect(rows.recipients).toHaveLength(6);
    expect(rows.trips).toHaveLength(4);
    expect(rows.items).toHaveLength(40);
    expect(rows.shipments).toHaveLength(5);
    expect(rows.handovers).toHaveLength(40);
    expect(rows.followups).toHaveLength(8);
    expect(rows.import_rows).toHaveLength(106);
    const filledAmounts = wb.sheets.Items.reduce((k, r) => k + (r.values.original_cost_usd !== undefined ? 1 : 0) + (r.values.fair_market_usd !== undefined ? 1 : 0), 0);
    expect(rows.valuations).toHaveLength(filledAmounts);

    const importRowIds = new Set(rows.import_rows.map((r) => r.id));
    for (const t of INSERT_ORDER.filter((t) => t !== "import_rows")) {
      for (const r of rows[t]) {
        expect(importRowIds.has(r.import_row_id as string), `${t} ${r.id}`).toBe(true);
        if (t !== "valuations" && t !== "followups") expect(r.batch_id).toBe(batchId);
      }
    }

    // Raw rows hold the cells exactly as read; refs stay there and never become ids.
    const first = rows.import_rows.find((r) => r.sheet === "Items")!;
    expect(first.raw).toEqual(wb.sheets.Items[0].raw);
    expect(JSON.stringify(rows.items)).not.toContain("sample-itm-");

    // Every reference points at a row of this build (its own batch).
    const idsOf = (t: keyof typeof rows) => new Set(rows[t].map((r) => r.id));
    for (const h of rows.handovers) {
      expect(idsOf("items").has(h.item_id as string)).toBe(true);
      expect(idsOf("recipients").has(h.recipient_id as string)).toBe(true);
      expect(idsOf("shipments").has(h.shipment_id as string)).toBe(true);
      expect(idsOf("trips").has(h.trip_id as string)).toBe(true);
    }
    for (const f of rows.followups) expect(idsOf("handovers").has(f.handover_id as string)).toBe(true);
    for (const v of rows.valuations) expect(idsOf("items").has(v.item_id as string)).toBe(true);
  });
});

describe("record:check --selftest", () => {
  it("passes: the synthetic workbook passes and every must-fail fails for its own reason", async () => {
    const { pass, lines } = await runSelftest();
    expect(lines.filter((l) => !l.ok)).toEqual([]);
    expect(lines).toHaveLength(11);
    expect(lines.find((l) => l.name.includes("adding up to more than its quantity"))?.detail).toContain("add up to 2, more than its quantity of 1");
    expect(pass).toBe(true);
  });
});

describe("record:import --kind real", () => {
  it("is refused by the argument parser", () => {
    expect(parseImportArgs(["f.xlsx", "--kind", "real", "--label", "x"])).toEqual({ error: "real imports are not enabled in this slice" });
    expect(parseImportArgs(["f.xlsx", "--kind", "synthetic", "--label", "x"])).toEqual({ file: "f.xlsx", kind: "synthetic", label: "x" });
  });

  it("exits 1 with the message, before reading any file or credential", () => {
    const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
    const r = spawnSync(tsx, ["scripts/record/import.ts", "no-such-file.xlsx", "--kind", "real", "--label", "x"], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe("real imports are not enabled in this slice");
  });
});

describe("record:check touches no network", () => {
  it("the checker's modules import nothing that talks to a database", () => {
    const files = ["scripts/record/check.ts", "src/record/check.ts", "src/record/workbook.ts", "src/record/definition.ts", "src/record/selftest.ts", "src/record/synthetic.ts", "src/record/build.ts"];
    for (const f of files) {
      const specs = importsOf(path.join(ROOT, f));
      expect(specs.filter((s) => s.includes("supabase") || s.endsWith("/db") || s.includes("http")), f).toEqual([]);
    }
  });

  it("git tracks no .env.local", () => {
    expect(execFileSync("git", ["ls-files", ".env.local"], { cwd: ROOT }).toString().trim()).toBe("");
  });
});
