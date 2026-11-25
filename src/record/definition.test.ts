import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHEETS } from "./definition";

const SQL_FILE = path.resolve(__dirname, "../../supabase/migrations/20261125021239_record_foundation.sql");

type SqlTable = { columns: Set<string>; checks: Map<string, string[]> };

/** Tables, their columns, and each column's `check (col in (...))` values, read from the SQL. */
function readSchema(sql: string): Map<string, SqlTable> {
  const tables = new Map<string, SqlTable>();
  for (const m of sql.matchAll(/create table public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
    const columns = new Set<string>();
    const checks = new Map<string, string[]>();
    for (const line of m[2].split("\n")) {
      const col = /^\s{2}([a-z_]+) /.exec(line);
      if (!col || ["unique", "primary", "check"].includes(col[1])) continue;
      columns.add(col[1]);
      const check = /check \((\w+) in \(([^)]*)\)\)/.exec(line);
      if (check && check[1] === col[1]) {
        checks.set(col[1], [...check[2].matchAll(/'([^']*)'/g)].map((x) => x[1]));
      }
    }
    tables.set(m[1], { columns, checks });
  }
  return tables;
}

const schema = readSchema(readFileSync(SQL_FILE, "utf8"));

describe("the definition agrees with the migration", () => {
  it("reads the schema (the parser can see the tables)", () => {
    expect(schema.size).toBe(13);
    expect(schema.get("items")?.checks.get("condition")).toEqual(["new", "used-working", "used-needs-service", "unknown"]);
  });

  it("every mapped table and column exists in the SQL", () => {
    const missing: string[] = [];
    for (const s of SHEETS) {
      if (!schema.has(s.table)) missing.push(`${s.name}: table ${s.table}`);
      for (const c of s.columns) {
        if (c.maps.to === "raw") continue;
        if (!schema.get(c.maps.table)?.columns.has(c.maps.column)) missing.push(`${s.name}.${c.name}: ${c.maps.table}.${c.maps.column}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every enum column's allowed values equal its check constraint", () => {
    const enums = SHEETS.flatMap((s) => s.columns.filter((c) => c.type === "enum").map((c) => ({ s, c })));
    expect(enums.map(({ c }) => c.name).sort()).toEqual(["condition", "date_precision", "kind", "mode", "value_per"]);
    for (const { s, c } of enums) {
      if (c.maps.to === "raw") throw new Error(`${s.name}.${c.name} is not mapped`);
      const check = schema.get(c.maps.table)?.checks.get(c.maps.column);
      expect(check, `${s.name}.${c.name} -> ${c.maps.table}.${c.maps.column}`).toBeDefined();
      expect([...c.values!]).toEqual(check);
    }
  });

  it("every valuation basis the workbook writes is allowed by valuations.basis", () => {
    const allowed = schema.get("valuations")!.checks.get("basis")!;
    const bases = SHEETS.flatMap((s) => s.columns).flatMap((c) => (c.maps.to === "valuation-amount" ? [c.maps.basis] : []));
    expect(bases).toEqual(["original-cost", "fair-market"]);
    for (const b of bases) expect(allowed).toContain(b);
  });

  it("detects a disagreement (the check can fail)", () => {
    const altered = readSchema(readFileSync(SQL_FILE, "utf8").replace("'used-needs-service', ", ""));
    const items = SHEETS.find((s) => s.name === "Items")!;
    const condition = items.columns.find((c) => c.name === "condition")!;
    expect([...condition.values!]).not.toEqual(altered.get("items")!.checks.get("condition"));
  });

  it("every column NOT NULL without a default in the SQL is required in its sheet", () => {
    // name, description, country, title, year, checked_on: the ones a person types.
    const required = SHEETS.flatMap((s) => s.columns.filter((c) => c.required && c.maps.to === "column").map((c) => `${s.table}.${(c.maps as { column: string }).column}`));
    for (const need of ["sources.name", "recipients.name", "recipients.country", "trips.slug", "trips.title", "trips.year", "trips.country", "items.description", "followups.checked_on"]) {
      expect(required).toContain(need);
    }
  });
});
