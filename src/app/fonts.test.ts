import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const FONTS_CSS = path.join(__dirname, "fonts.css");

// Built at runtime so this file never contains the literal module name and
// `grep -rn` for it over src stays empty.
const GOOGLE = ["next", "font", "google"].join("/");
const QUOTED = `["']${GOOGLE.replace(/\//g, "\\/")}["']`;
const IMPORT_RE = new RegExp(`\\bfrom\\s+${QUOTED}|\\bimport\\s*\\(?\\s*${QUOTED}|\\brequire\\(\\s*${QUOTED}`);

/** True when the source text imports the Google Fonts loader in any form. */
function importsGoogleFonts(text: string): boolean {
  return IMPORT_RE.test(text);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) ? [p] : [];
  });
}

type Face = { family: string; weight: string; style: string; display: string; src: string; range: string };

function faces(css: string): Face[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const get = (prop: string) => new RegExp(`${prop}:\\s*([^;]+);`).exec(body)?.[1].trim() ?? "";
    return {
      family: get("font-family").replace(/["']/g, ""),
      weight: get("font-weight"),
      style: get("font-style"),
      display: get("font-display"),
      src: get("src"),
      range: get("unicode-range"),
    };
  });
}

const FAMILIES = [
  { pkg: "source-serif-4", family: "Source Serif 4" },
  { pkg: "inter", family: "Inter" },
];
const WEIGHTS = ["400", "600"];
const SUBSETS = ["latin", "latin-ext", "vietnamese"];

describe("fonts", () => {
  it("the import check catches the Google Fonts loader and passes other imports", () => {
    expect(importsGoogleFonts(`import { Inter } from "${GOOGLE}";`)).toBe(true);
    expect(importsGoogleFonts(`import {Inter} from '${GOOGLE}'`)).toBe(true);
    expect(importsGoogleFonts(`const f = await import("${GOOGLE}");`)).toBe(true);
    expect(importsGoogleFonts(`const f = require("${GOOGLE}");`)).toBe(true);
    expect(importsGoogleFonts('import localFont from "next/font/local";')).toBe(false);
    expect(importsGoogleFonts('import "./fonts.css";')).toBe(false);
  });

  it("no file under src imports the Google Fonts loader", () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => importsGoogleFonts(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("fonts.css declares exactly the 12 faces in use, matching the pinned package", () => {
    const ours = faces(readFileSync(FONTS_CSS, "utf8"));
    expect(ours).toHaveLength(FAMILIES.length * WEIGHTS.length * SUBSETS.length);
    for (const { pkg, family } of FAMILIES) {
      for (const weight of WEIGHTS) {
        const pkgCss = readFileSync(path.join(ROOT, "node_modules/@fontsource", pkg, `${weight}.css`), "utf8");
        for (const subset of SUBSETS) {
          const file = `${pkg}-${subset}-${weight}-normal.woff2`;
          const theirs = faces(pkgCss).find((f) => f.src.includes(`./files/${file}`));
          const mine = ours.find((f) => f.src.includes(`/${file}`));
          expect(theirs, `${file} in @fontsource/${pkg}/${weight}.css`).toBeDefined();
          expect(mine, `${file} in fonts.css`).toBeDefined();
          expect(mine).toMatchObject({ family, weight, style: "normal", display: "swap", range: theirs!.range });
          expect(mine!.src).toBe(`url("@fontsource/${pkg}/files/${file}") format("woff2")`);
          expect(existsSync(path.join(ROOT, "node_modules/@fontsource", pkg, "files", file))).toBe(true);
        }
      }
    }
  });

  it("fonts.css sets the two variables globals.css reads", () => {
    const css = readFileSync(FONTS_CSS, "utf8");
    const globals = readFileSync(path.join(__dirname, "globals.css"), "utf8");
    expect(css).toMatch(/--font-source-serif:\s*"Source Serif 4";/);
    expect(css).toMatch(/--font-inter:\s*"Inter";/);
    expect(globals).toContain("var(--font-source-serif)");
    expect(globals).toContain("var(--font-inter)");
    expect(css).not.toMatch(/googleapis|gstatic/);
  });
});
