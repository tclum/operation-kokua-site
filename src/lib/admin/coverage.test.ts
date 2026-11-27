import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The guard rule, checked from the source: every page, route handler and
// server action under src/app/admin, other than the short exception list,
// calls requireAdmin() before its first data read. Plus the module rules
// around the secret-key client.

const ROOT = path.resolve(__dirname, "..", "..", "..");
const APP_ADMIN = path.join(ROOT, "src", "app", "admin");
const rel = (f: string) => path.relative(ROOT, f);

/** The only files under src/app/admin that do not call requireAdmin(): the way in. */
const EXEMPT = ["src/app/admin/sign-in/page.tsx", "src/app/admin/sign-in/actions.ts", "src/app/admin/confirm/route.ts"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** A page, route handler or server-action file: what the guard rule covers. */
function isGuarded(file: string, text: string): boolean {
  const base = path.basename(file);
  if (/^page\.tsx?$/.test(base) || /^route\.tsx?$/.test(base)) return true;
  return /^\s*["']use server["']/.test(stripComments(text));
}

/** Names imported from the record module (the data reads). */
function recordImports(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](?:@\/lib\/admin\/record|(?:\.\.?\/)+(?:lib\/admin\/)?record)["']/g)) {
    for (const part of m[1].split(",")) {
      const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()!.trim();
      if (n) names.push(n);
    }
  }
  return names;
}

/** Each exported function's body text, by name. */
function exportedFunctions(text: string): { name: string; body: string }[] {
  const starts = [...text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s*(\w*)\s*\(/g)];
  return starts.map((m, i) => ({
    name: m[1] || "default",
    body: text.slice(m.index! + m[0].length, i + 1 < starts.length ? starts[i + 1].index : undefined),
  }));
}

/** Problems with one file under the guard rule; empty when it holds. */
export function guardProblems(file: string, source: string): string[] {
  const text = stripComments(source);
  const reads = recordImports(text);
  const fns = exportedFunctions(text);
  if (fns.length === 0) return [`${file}: no exported function found`];
  const problems: string[] = [];
  for (const fn of fns) {
    const guard = fn.body.search(/await\s+requireAdmin\s*\(/);
    if (guard < 0) {
      problems.push(`${file}: ${fn.name} does not call await requireAdmin()`);
      continue;
    }
    const firstRead = Math.min(
      ...[...reads.map((n) => fn.body.search(new RegExp(`\\b${n}\\s*\\(`))), fn.body.search(/\.from\s*\(/), fn.body.search(/createClient\s*\(/)].filter(
        (i) => i >= 0,
      ),
    );
    if (Number.isFinite(firstRead) && firstRead < guard) problems.push(`${file}: ${fn.name} reads data before requireAdmin()`);
  }
  return problems;
}

describe("every admin page, route and action calls requireAdmin() first", () => {
  const files = filesUnder(APP_ADMIN).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const covered = files.filter((f) => isGuarded(f, readFileSync(f, "utf8")));

  it("finds the pages, the confirm route and both action files", () => {
    expect(covered.map(rel).sort()).toEqual(
      [
        "src/app/admin/actions.ts",
        "src/app/admin/confirm/route.ts",
        "src/app/admin/handovers/page.tsx",
        "src/app/admin/items/[id]/page.tsx",
        "src/app/admin/page.tsx",
        "src/app/admin/sign-in/actions.ts",
        "src/app/admin/sign-in/page.tsx",
      ].sort(),
    );
  });

  it("each one outside the exception list calls it before its first data read", () => {
    const problems = covered.filter((f) => !EXEMPT.includes(rel(f))).flatMap((f) => guardProblems(rel(f), readFileSync(f, "utf8")));
    expect(problems).toEqual([]);
  });

  it("the exempt files read nothing from the record", () => {
    for (const f of EXEMPT) {
      const text = readFileSync(path.join(ROOT, f), "utf8");
      expect(recordImports(text), f).toEqual([]);
      expect(text, f).not.toMatch(/lib\/admin\/record/);
    }
  });

  it("layouts and other files under src/app/admin import nothing from the record", () => {
    const others = files.filter((f) => !covered.includes(f));
    for (const f of others) expect(stripComments(readFileSync(f, "utf8")), rel(f)).not.toMatch(/lib\/admin\/record|requireAdmin/);
  });

  it("goes red on a page that forgets it, and on one that reads first (the check can fail)", () => {
    const forgot = `import { batchesOf } from "@/lib/admin/record";\nexport default async function P() { const b = await batchesOf("real"); return b; }`;
    const readsFirst = `import { requireAdmin } from "@/lib/admin/guard";\nimport { totalsOf as t } from "@/lib/admin/record";\nexport default async function P() { const x = await t("real"); await requireAdmin(); return x; }`;
    const commentOnly = `import { itemOf } from "@/lib/admin/record";\n// await requireAdmin()\nexport default async function P() { return itemOf("real", "x"); }`;
    const oneActionForgets = `"use server";\nimport { requireAdmin } from "@/lib/admin/guard";\nexport async function a() { await requireAdmin(); }\nexport async function b() { return 1; }`;
    const good = `import { requireAdmin } from "@/lib/admin/guard";\nimport { itemOf } from "@/lib/admin/record";\nexport default async function P() { await requireAdmin(); return itemOf("real", "x"); }`;
    expect(guardProblems("forgot.tsx", forgot)).toHaveLength(1);
    expect(guardProblems("reads-first.tsx", readsFirst)).toEqual(["reads-first.tsx: P reads data before requireAdmin()"]);
    expect(guardProblems("comment-only.tsx", commentOnly)).toHaveLength(1);
    expect(guardProblems("actions.ts", oneActionForgets)).toEqual(["actions.ts: b does not call await requireAdmin()"]);
    expect(guardProblems("good.tsx", good)).toEqual([]);
    expect(isGuarded("x/actions.ts", oneActionForgets)).toBe(true);
    expect(isGuarded("x/helpers.ts", "export const a = 1;")).toBe(false);
  });
});

describe("the secret-key client stays in one place", () => {
  const src = filesUnder(path.join(ROOT, "src")).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const importsRecord = (t: string) => /from\s*["'][^"']*lib\/admin\/record["']|from\s*["']\.\/record["']/.test(t);

  it("record.ts is server-only and exports reads only", () => {
    const text = readFileSync(path.join(ROOT, "src", "lib", "admin", "record.ts"), "utf8");
    expect(text.split("\n")[0]).toBe('import "server-only";');
    expect(stripComments(text)).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
  });

  it("guard.ts, auth.ts and sign-in.ts are server-only", () => {
    for (const f of ["guard.ts", "auth.ts", "sign-in.ts"]) {
      expect(readFileSync(path.join(ROOT, "src", "lib", "admin", f), "utf8").split("\n")[0], f).toBe('import "server-only";');
    }
  });

  it("only the guard and the admin pages import record.ts", () => {
    const importers = src.filter((f) => importsRecord(readFileSync(f, "utf8"))).map(rel).sort();
    expect(importers).toEqual(
      ["src/app/admin/handovers/page.tsx", "src/app/admin/items/[id]/page.tsx", "src/app/admin/page.tsx", "src/lib/admin/guard.ts"].sort(),
    );
  });

  it("nothing under src/components imports record.ts, guard.ts or auth.ts", () => {
    const offenders = src
      .filter((f) => f.startsWith(path.join(ROOT, "src", "components")))
      .filter((f) => /lib\/admin\/(record|guard|auth|sign-in)["']/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("no client component imports anything from src/lib/admin", () => {
    const clients = src.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clients.length).toBeGreaterThan(0);
    const offenders = clients.filter((f) => /from\s*["'](?:@\/lib\/admin|[./]+lib\/admin)/.test(readFileSync(f, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("no NEXT_PUBLIC_ Supabase variable anywhere under src", () => {
    const offenders = src.filter((f) => /NEXT_PUBLIC_SUPABASE/.test(readFileSync(f, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
  });
});
