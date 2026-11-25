import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blend, contrastRatio, hexToRgb, type RGB } from "./contrast";

// Tokens are read from the real stylesheet, so a token change is checked.
const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
const tokens: Record<string, RGB> = {};
for (const m of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) tokens[m[1]] = hexToRgb(m[2]);

// The lightbox backdrop: ink at N% (globals.css); worst case over a white pixel.
const backdrop = /\.lightbox::backdrop \{\s*background: color-mix\(in srgb, var\(--color-ink\) (\d+)%, transparent\);/.exec(css);
const white: RGB = [255, 255, 255];
const lightboxWorst = blend(tokens.ink, white, Number(backdrop?.[1]) / 100);

const BODY = 4.5;
const NON_TEXT = 3;

// Every text and background pair in use.
const pairs: { name: string; fg: RGB; bg: RGB; min: number }[] = [
  { name: "ink on paper (body text, nav links)", fg: tokens.ink, bg: tokens.paper, min: BODY },
  { name: "teal on paper (headings, links, wordmark)", fg: tokens.teal, bg: tokens.paper, min: BODY },
  { name: "stone on paper (captions, secondary text)", fg: tokens.stone, bg: tokens.paper, min: BODY },
  { name: "clay on paper (year headings, figures on paper)", fg: tokens.clay, bg: tokens.paper, min: BODY },
  { name: "clay on paper (active nav mark, rules; non-text)", fg: tokens.clay, bg: tokens.paper, min: NON_TEXT },
  { name: "teal on paper (focus ring; non-text)", fg: tokens.teal, bg: tokens.paper, min: NON_TEXT },
  { name: "paper on ink (hero headline, footer, outline button)", fg: tokens.paper, bg: tokens.ink, min: BODY },
  { name: "teal-soft on ink (hero mission and name, footer legal line)", fg: tokens["teal-soft"], bg: tokens.ink, min: BODY },
  { name: "ink on paper (hero primary button)", fg: tokens.ink, bg: tokens.paper, min: BODY },
  { name: "ink on teal-soft (primary button hover, impact details, panels)", fg: tokens.ink, bg: tokens["teal-soft"], min: BODY },
  { name: "teal on teal-soft (panel headings and links)", fg: tokens.teal, bg: tokens["teal-soft"], min: BODY },
  { name: "clay on teal-soft (impact figures)", fg: tokens.clay, bg: tokens["teal-soft"], min: BODY },
  { name: "stone on teal-soft (secondary text in panels)", fg: tokens.stone, bg: tokens["teal-soft"], min: BODY },
  { name: "paper on ink (focus ring on ink; non-text)", fg: tokens.paper, bg: tokens.ink, min: NON_TEXT },
  { name: "paper on the lightbox backdrop over a white pixel", fg: tokens.paper, bg: lightboxWorst, min: BODY },
];

describe("contrast", () => {
  it("reads all six tokens and the lightbox backdrop", () => {
    expect(Object.keys(tokens).sort()).toEqual(["clay", "ink", "paper", "stone", "teal", "teal-soft"]);
    expect(backdrop).not.toBeNull();
  });

  it("matches known WCAG values", () => {
    expect(contrastRatio([0, 0, 0], white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it.each(pairs)("$name passes ($min:1)", ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("rejects clay on ink (expected failure: why the active nav mark sits on the paper header)", () => {
    expect(contrastRatio(tokens.clay, tokens.ink)).toBeLessThan(NON_TEXT);
  });

  it("rejects teal on ink (expected failure: why links on the hero are paper)", () => {
    expect(contrastRatio(tokens.teal, tokens.ink)).toBeLessThan(NON_TEXT);
  });
});
