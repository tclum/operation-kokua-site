import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function tracked(pathspec: string): string {
  return execFileSync("git", ["ls-files", pathspec], { cwd: ROOT }).toString().trim();
}

describe("source/ stays out of git", () => {
  it("tracks nothing under source/", () => {
    expect(tracked("source")).toBe("");
  });
});

// Inputs live in source/, relative to the repo root. A machine path or a path
// into the prompts/ workspace means a build that only works on one laptop.
// This file names both patterns, so it skips itself.
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: "absolute home path", re: /\/Users\/|\/home\// },
  { name: "prompts/ path", re: /prompts\// },
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

/** Lines in the given files that match a forbidden pattern, as "file:line: name". */
function forbiddenPaths(files: string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) =>
        FORBIDDEN.filter(({ re }) => re.test(line)).map(
          ({ name }) => `${path.relative(ROOT, file)}:${i + 1}: ${name}`,
        ),
      ),
  );
}

describe("no machine or prompts/ paths in scripts/ or src/", () => {
  it("finds none", () => {
    const files = ["scripts", "src"]
      .flatMap((d) => filesUnder(path.join(ROOT, d)))
      .filter((f) => f !== __filename);
    expect(files.length).toBeGreaterThan(10);
    expect(forbiddenPaths(files)).toEqual([]);
  });

  it("flags both kinds (the check can fail)", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "okp-paths-"));
    try {
      const file = path.join(tmp, "bad.ts");
      writeFileSync(file, "/Users/x/a.jpg\nok\nprompts/r/b.jpg\n");
      expect(forbiddenPaths([file]).map((f) => f.replace(/^.*:(\d+:)/, "$1"))).toEqual([
        "1: absolute home path",
        "3: prompts/ path",
      ]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
