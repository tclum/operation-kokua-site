// pnpm check:bundle            after `pnpm build`: no file under .next/static
//                              (what the browser can download) contains
//                              "sb_secret_", the variable name
//                              "SUPABASE_SECRET_KEY", or the secret key's value
//                              from .env.local. Exit 1 on any hit, or when
//                              .next/static is missing or empty.
// pnpm check:bundle --selftest plants each in a temp tree and expects red, and
//                              expects a clean tree green.
// The secret's value is read through scripts/record/db.ts, compared as bytes
// and never printed: a hit names the file and which needle, not the value.

import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { secretKeyForComparison } from "./record/db";

const ROOT = path.resolve(__dirname, "..");
export const STATIC_DIR = path.join(ROOT, ".next", "static");

export type Needle = { name: string; value: string };

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

/** Problems in a tree: each file holding a needle, as "relative/path: needle name". */
export function scanTree(dir: string, needles: Needle[]): { files: number; problems: string[] } {
  let files: string[];
  try {
    files = filesUnder(dir);
  } catch {
    return { files: 0, problems: [`${dir} does not exist; run pnpm build first`] };
  }
  if (files.length === 0) return { files: 0, problems: [`${dir} is empty; run pnpm build first`] };
  const problems: string[] = [];
  for (const f of files) {
    const bytes = readFileSync(f);
    for (const n of needles) {
      if (n.value.length === 0) continue;
      if (bytes.includes(Buffer.from(n.value, "utf8"))) problems.push(`${path.relative(dir, f)}: contains ${n.name}`);
    }
  }
  return { files: files.length, problems };
}

export function needles(secretValue: string): Needle[] {
  return [
    { name: '"sb_secret_"', value: "sb_secret_" },
    { name: 'the name "SUPABASE_SECRET_KEY"', value: "SUPABASE_SECRET_KEY" },
    { name: "the secret key's value from .env.local", value: secretValue },
  ];
}

function live(): number {
  let secret: string;
  try {
    secret = secretKeyForComparison();
  } catch (e) {
    console.error(`check:bundle: cannot compare against the secret's value: ${e instanceof Error ? e.message : String(e)}`);
    console.log("RESULT: fail");
    return 1;
  }
  const { files, problems } = scanTree(STATIC_DIR, needles(secret));
  console.log(`scanned ${files} files under .next/static for ${needles(secret).map((n) => n.name).join(", ")}`);
  for (const p of problems) console.log(`FAIL  ${p}`);
  console.log(`RESULT: ${problems.length === 0 ? "pass" : "fail"}`);
  return problems.length === 0 ? 0 : 1;
}

function selftest(): number {
  const planted = "planted-selftest-value-6f1c2a";
  const cases: { name: string; mustPass: boolean; files: Record<string, string | Buffer> | null }[] = [
    { name: "a clean tree", mustPass: true, files: { "chunks/app.js": "console.log('hello')", "css/a.css": "body{}", "media/f.woff2": Buffer.from([0, 1, 2, 3]) } },
    { name: '"sb_secret_" in a chunk', mustPass: false, files: { "chunks/app.js": "ok", "chunks/deep/x.js": 'const k="sb_secret_abc"' } },
    { name: 'the name "SUPABASE_SECRET_KEY" in a chunk', mustPass: false, files: { "chunks/app.js": "var n=\"SUPABASE_SECRET_KEY\"" } },
    { name: "the secret's value in a chunk", mustPass: false, files: { "chunks/app.js": `x="${planted}"` } },
    { name: "the secret's value in a binary file", mustPass: false, files: { "media/f.bin": Buffer.concat([Buffer.from([0, 255]), Buffer.from(planted), Buffer.from([7])]) } },
    { name: "an empty tree", mustPass: false, files: {} },
    { name: "no tree at all", mustPass: false, files: null },
  ];
  let bad = 0;
  for (const c of cases) {
    const tmp = mkdtempSync(path.join(tmpdir(), "okp-bundle-"));
    try {
      const dir = path.join(tmp, "static");
      if (c.files) {
        mkdirSync(dir);
        for (const [rel, body] of Object.entries(c.files)) {
          mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
          writeFileSync(path.join(dir, rel), body);
        }
      }
      const { problems } = scanTree(dir, needles(planted));
      const passed = problems.length === 0;
      const good = passed === c.mustPass;
      if (!good) bad++;
      console.log(`${good ? "ok  " : "BAD "} ${c.mustPass ? "must-pass" : "must-fail"}  ${c.name}  -> ${passed ? "PASS" : `FAIL: ${problems.map((p) => p.replace(tmp, "<tmp>")).join("; ")}`}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`${cases.length} cases, ${bad} wrong`);
  console.log(`RESULT: ${bad === 0 ? "pass" : "fail"}`);
  return bad === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exit(process.argv[2] === "--selftest" ? selftest() : live());
}
