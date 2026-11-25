import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXCLUDED_PHOTO_IDS, isExcluded, photoId } from "@/lib/excluded";
import { tripSpan, visibleNotes } from "@/lib/timeline";
import { collapse, notInOutline } from "@/lib/verbatim";
import { held } from "./held";
import { people } from "./people";
import { photos } from "./photos";
import { site } from "./site";
import { trips } from "./trips";
import { collectUnconfirmed, unconfirmed } from "./unconfirmed";

const ROOT = path.resolve(__dirname, "../..");
const outline = readFileSync(path.join(ROOT, "test/fixtures/weebly-outline.md"), "utf8");
const content = { site, people, trips, photos, held };

describe("old-site copy is verbatim", () => {
  it("every old-site string appears in the outline (whitespace collapsed)", () => {
    expect(notInOutline(content, outline)).toEqual([]);
  });

  it("goes red on one changed word (the check can fail)", () => {
    const changed = { ...site, mission: { ...site.mission, text: site.mission.text.replace("Southeast", "Southwest") } };
    expect(notInOutline({ site: changed }, outline)).toEqual([
      `.site.mission.text: ${changed.mission.text}`,
    ]);
  });

  it("ignores new copy that is not old-site", () => {
    expect(notInOutline({ x: { text: "Not on the old site.", basis: "david-unconfirmed", label: "x" } }, outline)).toEqual([]);
  });

  it("keeps the published spelling Johnn", () => {
    expect(people.executives.map((p) => p.name)).toContain("Johnn Saruwatari, MD");
  });

  it("drops the superseded IRS-pending line", () => {
    expect(JSON.stringify(content)).not.toMatch(/pending with IRS/);
  });
});

describe("trips", () => {
  it("has one entry per trip page of the old site (12), slugs unique", () => {
    expect(trips).toHaveLength(12);
    expect(new Set(trips.map((t) => t.slug)).size).toBe(12);
    expect(new Set(trips.map((t) => t.oldPage)).size).toBe(12);
  });

  it("is in timeline order: years, then months where given, never increase", () => {
    for (let i = 1; i < trips.length; i++) {
      const [a, b] = [trips[i - 1], trips[i]];
      expect(b.year).toBeLessThanOrEqual(a.year);
      if (a.year === b.year && a.month && b.month) expect(b.month).toBeLessThanOrEqual(a.month);
    }
  });

  it("a caption on a trip photo is one of the trip's notes, collapsed", () => {
    for (const t of trips)
      for (const p of t.photos)
        if (p.caption) expect(t.notes.some((n) => collapse(p.caption!).includes(collapse(n))), `${t.slug} ${p.file}`).toBe(true);
  });

  it("shows a note only when no photo carries it as its caption", () => {
    const t = trips.find((x) => x.slug === "hanoi-2015")!;
    expect(visibleNotes(t)).toEqual(["Dr. Schilz and Dr. Yiam operating in Hanoi."]);
  });
});

describe("trip count and year span match the copy", () => {
  const figure = site.impact.find((f) => f.derivedFrom === "trips.ts")!;
  const check = (list: typeof trips) => {
    const { count, first, last } = tripSpan(list);
    return figure.value === `${count} trips` && figure.detail === `documented here, ${first} to ${last}`;
  };

  it("12 trips, 2010 to 2015", () => {
    expect(figure).toBeDefined();
    expect(check(trips)).toBe(true);
  });

  it("goes red when a trip is added or the span changes (the check can fail)", () => {
    expect(check(trips.slice(1))).toBe(false); // 11 trips
    expect(check([...trips, { ...trips[0], slug: "extra" }])).toBe(false); // 13 trips
    expect(check(trips.slice(0, -1))).toBe(false); // drops 2010
  });
});

describe("unconfirmed items", () => {
  const state = readFileSync(path.join(ROOT, "docs/project-state.md"), "utf8");
  const open = state.slice(state.indexOf("## Open questions"), state.indexOf("## Not yet specified"));

  it("lists every david-unconfirmed and public-record item, each labelled", () => {
    expect(unconfirmed.length).toBeGreaterThan(0);
    expect(unconfirmed.every((u) => u.label !== "(unlabelled)")).toBe(true);
    expect(new Set(unconfirmed.map((u) => u.basis))).toEqual(new Set(["david-unconfirmed", "public-record"]));
  });

  it("docs/project-state.md names each one under Open questions", () => {
    expect(open.length).toBeGreaterThan(0);
    const missing = unconfirmed.filter((u) => !open.includes(u.label)).map((u) => u.label);
    expect(missing).toEqual([]);
  });

  it("collects a nested item (the collector can find one)", () => {
    expect(collectUnconfirmed({ a: [{ b: { text: "x", basis: "public-record", label: "L" } }] })).toEqual([
      { label: "L", basis: "public-record" },
    ]);
  });

  it("the contact line carries the old site's street address", () => {
    expect(site.give.contact.text).toContain(site.address.text);
  });
});

describe("held old-site text", () => {
  it("each Teaching line is the caption of an excluded photo, as the outline pairs them", () => {
    for (const h of held.filter((x) => x.oldPage === "teaching")) {
      expect(h.photoIds).toHaveLength(1);
      expect(EXCLUDED_PHOTO_IDS as readonly string[]).toContain(h.photoIds[0]);
      const esc = h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(outline).toMatch(new RegExp(`IMG #\\d+: ${h.photoIds[0]}_orig\\.jpg[^\\n]*\\n(H2:[^\\n]*\\n)?TEXT: ${esc}\\n`));
    }
  });

  it("no page or component imports it", () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = path.join(d, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = [...walk(path.join(ROOT, "src/app")), ...walk(path.join(ROOT, "src/components"))].filter(
      (f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"),
    );
    expect(files.filter((f) => /content\/held/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});

describe("excluded photos stay out", () => {
  /** Content photo files that derive from an excluded id. */
  const excludedIn = (node: unknown): string[] =>
    [...JSON.stringify(node).matchAll(/"file":"([^"]+)"/g)].map((m) => m[1]).filter(isExcluded);

  it("no entry in src/content/ derives from an excluded id", () => {
    // Held text names its photos under photoIds, not file, so it is not a photo entry.
    expect(excludedIn(content)).toEqual([]);
  });

  it("goes red on a fixture entry naming 2690840 (the check can fail)", () => {
    const fixture = { teaching: [{ file: "2690840_orig.jpg", width: 1066, height: 800, alt: "x", basis: "old-site" }] };
    expect(excludedIn(fixture)).toEqual(["2690840_orig.jpg"]);
  });

  it("reads ids from upload and output names", () => {
    expect(photoId("2690840_orig.jpg")).toBe("2690840");
    expect(photoId("photo-159885-640.jpg")).toBe("159885");
    expect(photoId("1387005847.jpg")).toBe("1387005847");
    expect(EXCLUDED_PHOTO_IDS).toHaveLength(19);
  });
});
