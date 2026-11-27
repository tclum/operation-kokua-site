import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Any database client record:admin builds goes through createClient; a call
// here fails the test that made it.
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => {
    throw new Error("a database client was constructed");
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { NEEDS_TERMINAL, parseAdminArgs, runAdmin } from "./admin";

const ROOT = path.resolve(__dirname, "..", "..");

async function run(argv: string[], isTTY: boolean): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")));
  const error = vi.spyOn(console, "error").mockImplementation((...a) => void err.push(a.join(" ")));
  const had = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
  try {
    const code = await runAdmin(argv);
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    if (had) Object.defineProperty(process.stdin, "isTTY", had);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    log.mockRestore();
    error.mockRestore();
  }
}

beforeEach(() => {
  createClient.mockClear();
});
afterEach(() => {
  expect(createClient).not.toHaveBeenCalled();
});

describe("record:admin arguments", () => {
  it("takes list, add <email> and remove <email>, lowercasing the address", () => {
    expect(parseAdminArgs(["list"])).toEqual({ command: "list" });
    expect(parseAdminArgs(["add", " Tim@Example.COM "])).toEqual({ command: "add", email: "tim@example.com" });
    expect(parseAdminArgs(["remove", "tim@example.com"])).toEqual({ command: "remove", email: "tim@example.com" });
  });

  it("refuses anything else, including any extra flag", () => {
    for (const argv of [[], ["add"], ["add", "not-an-email"], ["add", "a@b.co", "--yes"], ["list", "x"], ["grant", "a@b.co"]]) {
      expect(parseAdminArgs(argv), argv.join(" ")).toHaveProperty("error");
    }
  });
});

describe("record:admin add and remove need a person at a terminal", () => {
  for (const command of ["add", "remove"]) {
    it(`${command} without a terminal: exits 1 with the message, before any client is constructed`, async () => {
      const r = await run([command, "someone@example.com"], false);
      expect(r).toEqual({ code: 1, out: "", err: NEEDS_TERMINAL });
    });

    it(`${command} without a terminal, run as a script with input piped: exits 1 with the message`, () => {
      const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
      const r = spawnSync(tsx, ["scripts/record/admin.ts", command, "someone@example.com"], { cwd: ROOT, encoding: "utf8", input: "someone@example.com\n" });
      expect(r.status).toBe(1);
      expect(r.stderr.trim()).toBe(NEEDS_TERMINAL);
      expect(r.stdout).toBe("");
    });
  }

  it("the source offers no way around the terminal: no flag or variable names it", () => {
    const text = readFileSync(path.join(__dirname, "admin.ts"), "utf8");
    expect(text).not.toMatch(/process\.env/);
    expect(text.match(/isTTY/g)).toHaveLength(1);
    expect(text).toMatch(/Type the address exactly to proceed/);
  });
});
