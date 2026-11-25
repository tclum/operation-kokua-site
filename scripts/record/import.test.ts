import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Any database client the importer builds goes through createClient; a call
// here fails the test that made it.
const createClient = vi.fn(() => {
  throw new Error("a database client was constructed");
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { DRY_RUN_DONE, NEEDS_TERMINAL, parseImportArgs, runImport } from "./import";
import { REHEARSAL_PATH, SYNTHETIC_PATH } from "./synthetic";

const ROOT = path.resolve(__dirname, "..", "..");

/** Runs the importer in-process with stdin's isTTY set as given; returns the exit code and what it printed. */
async function run(argv: string[], isTTY: boolean): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")));
  const error = vi.spyOn(console, "error").mockImplementation((...a) => void err.push(a.join(" ")));
  const had = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
  try {
    const code = await runImport(argv);
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    if (had) Object.defineProperty(process.stdin, "isTTY", had);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    log.mockRestore();
    error.mockRestore();
  }
}

// Block bodies: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => {
  createClient.mockClear();
});
afterEach(() => {
  expect(createClient).not.toHaveBeenCalled();
});

describe("record:import arguments", () => {
  it("takes either kind, the dry run and the batch flags", () => {
    expect(parseImportArgs(["f.xlsx", "--kind", "synthetic", "--label", "x"])).toEqual({ file: "f.xlsx", kind: "synthetic", label: "x", dryRun: false });
    expect(
      parseImportArgs(["f.xlsx", "--kind", "real", "--label", " May records ", "--dry-run", "--received-from", "David", "--received-on", "2026-12-07", "--note", "box 1"]),
    ).toEqual({ file: "f.xlsx", kind: "real", label: "May records", dryRun: true, receivedFrom: "David", receivedOn: "2026-12-07", note: "box 1" });
  });

  it("refuses a bad kind, a bad date, a missing value and an unknown option", () => {
    expect(parseImportArgs(["f.xlsx", "--kind", "test", "--label", "x"])).toHaveProperty("error");
    expect(parseImportArgs(["f.xlsx", "--kind", "real", "--label", "x", "--received-on", "2026-02-30"])).toHaveProperty("error");
    expect(parseImportArgs(["f.xlsx", "--kind", "real", "--label", "--dry-run"])).toHaveProperty("error");
    expect(parseImportArgs(["f.xlsx", "--kind", "real", "--label", "x", "--yes"])).toHaveProperty("error");
  });
});

describe("record:import --kind real needs a person at a terminal", () => {
  it("without a terminal: exits 1 with the message, before reading the file or constructing a client", async () => {
    const r = await run(["no-such-file.xlsx", "--kind", "real", "--label", "x"], false);
    expect(r).toEqual({ code: 1, out: "", err: NEEDS_TERMINAL });
    // afterEach: createClient was never called.
  });

  it("without a terminal, run as a script: exits 1 with the message", () => {
    const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
    const r = spawnSync(tsx, ["scripts/record/import.ts", "no-such-file.xlsx", "--kind", "real", "--label", "x"], { cwd: ROOT, encoding: "utf8", input: "x\n" });
    expect(r.status).toBe(1);
    expect(r.stderr.trim()).toBe(NEEDS_TERMINAL);
    expect(r.stdout).toBe("");
  });

  it("the source offers no way around the terminal: no flag or variable names it", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(path.join(__dirname, "import.ts"), "utf8");
    expect(text).not.toMatch(/process\.env/);
    expect(text.match(/isTTY/g)).toHaveLength(1);
  });
});

describe("record:import refuses to commit a rehearsal workbook, whatever the kind", () => {
  it("real, even at a terminal: refused before any request", async () => {
    const r = await run([REHEARSAL_PATH, "--kind", "real", "--label", "rehearsal"], true);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Refusing to import: this is a rehearsal workbook");
    expect(r.err).toContain("Trips, 3, trip_slug: rehearsal-nepal-2017");
  });

  it("synthetic: refused before any request", async () => {
    const r = await run([REHEARSAL_PATH, "--kind", "synthetic", "--label", "rehearsal"], false);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Refusing to import: this is a rehearsal workbook");
  });

  it("a dry run is allowed past the refusal (it stops here at the SAMPLE rule, offline)", async () => {
    const r = await run([REHEARSAL_PATH, "--kind", "synthetic", "--label", "rehearsal", "--dry-run"], false);
    expect(r.code).toBe(1);
    expect(r.out).toContain("Note: this is a rehearsal workbook");
    expect(r.out).toContain("does not start with SAMPLE");
    expect(r.out.trim().endsWith(DRY_RUN_DONE)).toBe(true);
  });
});

describe("record:import checks the kind by content", () => {
  it("a synthetic workbook as real is refused on the SAMPLE rule, offline", async () => {
    const r = await run([SYNTHETIC_PATH, "--kind", "real", "--label", "wrong kind", "--dry-run"], false);
    expect(r.code).toBe(1);
    expect(r.out).toContain('Sources, 2, name: "SAMPLE Source A" starts with SAMPLE; a real workbook holds no sample rows');
    expect(r.err).toContain("Refusing to import");
    expect(r.out.trim().endsWith(DRY_RUN_DONE)).toBe(true);
  });
});
