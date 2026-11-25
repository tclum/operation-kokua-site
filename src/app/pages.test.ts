import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { h1s, tripSectionCount } from "../../scripts/smoke-checks";
import { held } from "@/content/held";
import { photos } from "@/content/photos";
import { trips } from "@/content/trips";
import { rootMetadata } from "@/lib/metadata";
import { photoStem } from "@/lib/photo-files";
import { IRS_LETTER_PATH, ROUTES, type RoutePath } from "@/lib/routes";

const rootMeta = rootMetadata({});
import AboutPage, { metadata as aboutMeta } from "./about/page";
import GivePage, { metadata as giveMeta } from "./give/page";
import NotFound from "./not-found";
import Home from "./page";
import TimelinePage, { metadata as timelineMeta } from "./timeline/page";
import WorkPage, { metadata as workMeta } from "./work/page";

const PAGES: Record<RoutePath, { Page: () => React.ReactNode; metadata: Metadata }> = {
  "/": { Page: Home, metadata: rootMeta },
  "/work": { Page: WorkPage, metadata: workMeta },
  "/timeline": { Page: TimelinePage, metadata: timelineMeta },
  "/about": { Page: AboutPage, metadata: aboutMeta },
  "/give": { Page: GivePage, metadata: giveMeta },
};

const render = (Page: () => React.ReactNode) => renderToStaticMarkup(createElement(Page));
const APP = __dirname;

/** The app directory's page file for a route path. */
const pageFile = (p: string) => path.join(APP, p === "/" ? "" : p.slice(1), "page.tsx");

/** hrefs of the links in <nav aria-label="Main">. */
function mainNavHrefs(html: string): string[] {
  const nav = /<nav aria-label="Main"[^>]*>[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
  return [...nav.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
}

describe("routes", () => {
  it("lists the five pages in order, each with a page file", () => {
    expect(ROUTES.map((r) => r.path)).toEqual(["/", "/work", "/timeline", "/about", "/give"]);
    for (const r of ROUTES) expect(existsSync(pageFile(r.path)), r.path).toBe(true);
  });

  it("a route without a page file is caught (the check can fail)", () => {
    expect(existsSync(pageFile("/donate"))).toBe(false);
  });
});

describe.each(ROUTES.map((r) => [r.path, r] as const))("%s", (p, r) => {
  const html = render(PAGES[p].Page);

  it("has exactly one h1", () => {
    expect(h1s(html)).toHaveLength(1);
  });

  it("links to the five routes in the header, each resolving to a page, this one current", () => {
    const hrefs = mainNavHrefs(html);
    expect(hrefs).toEqual(ROUTES.map((x) => x.path));
    for (const h of hrefs) expect(existsSync(pageFile(h)), h).toBe(true);
    const current = [...html.matchAll(/<a\b([^>]*)>/g)].filter((m) => /aria-current="page"/.test(m[1]));
    expect(current).toHaveLength(1);
    expect(current[0][1]).toContain(`href="${p}"`);
  });

  it("has a skip link to #main, and #main exists", () => {
    expect(html).toMatch(/<a href="#main"/);
    expect(html).toMatch(/<main id="main"/);
  });

  it(`is titled "${r.title}"`, () => {
    expect(PAGES[p].metadata.title).toBe(r.title);
  });

  it("gives every image alt text", () => {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) expect(tag).toMatch(/\salt="[^"]{10,}"/);
  });
});

describe("one h1 check can fail", () => {
  it("counts two", () => {
    expect(h1s("<h1>a</h1><h1>b</h1>")).toHaveLength(2);
  });
});

describe("page content", () => {
  it("root metadata is noindex unless SITE_INDEXABLE=true", () => {
    expect(rootMeta.robots).toEqual({ index: false, follow: false });
    expect(rootMetadata({ SITE_INDEXABLE: "true" }).robots).toEqual({ index: true, follow: true });
  });

  it("home: the name is the h1; meta description is the mission", () => {
    expect(h1s(render(Home))).toEqual(["Operation Kokua"]);
    expect(String(rootMeta.description)).toMatch(/^Providing surgical education/);
  });

  it("timeline: one anchored section per trip, newest first", () => {
    const html = render(TimelinePage);
    expect(tripSectionCount(html)).toBe(trips.length);
    const ids = [...html.matchAll(/data-trip="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(trips.map((t) => t.slug));
  });

  it("about: links the IRS letter", () => {
    expect(render(AboutPage)).toContain(`href="${IRS_LETTER_PATH}"`);
  });

  it("about: the Press photo is laid out no wider than 640 pixels", () => {
    const html = render(AboutPage);
    const img = html.match(/<img[^>]*>/g)?.find((t) => t.includes(`photo-${photoStem(photos.press.file)}-`)) ?? "";
    expect(img).toContain("max-width:640px");
    expect(img).toContain('sizes="(min-width: 672px) 640px, 100vw"');
  });

  it("held old-site text appears on no page", () => {
    const all = Object.values(PAGES).map(({ Page }) => render(Page)).join("\n");
    for (const h of held) expect(all, h.text).not.toContain(h.text);
  });

  it("work: Teaching and Donations have a heading and a gallery, no lead line", () => {
    const html = render(WorkPage);
    for (const id of ["teaching", "donations"]) {
      const section = new RegExp(`<section aria-labelledby="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? "";
      expect(section).toMatch(/<h2[^>]*>/);
      expect(section).not.toMatch(/<\/h2>\s*<div class="mt-4/);
      expect(section).not.toMatch(/<p>/);
    }
  });

  it("timeline: Da Lat 2013 shows Thank you dinner. as a note, not a caption", () => {
    const html = render(TimelinePage);
    const section = /<section id="dalat-2013"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(section).toContain("<p>Thank you dinner.</p>");
    expect(section).not.toMatch(/<figcaption[^>]*>Thank you dinner\.<\/figcaption>/);
  });

  it("timeline: Ho Chi Minh City 2015 shows its title, place and both notes, no photo", () => {
    const html = render(TimelinePage);
    const section = /<section id="ho-chi-minh-city-2015"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
    expect(section).toContain("Ho Chi Minh City, November 2015");
    expect(section).toContain("Ho Chi Minh City, Vietnam");
    expect(section).toContain("Dr. Schilz and Dr. Yiam examining patients in Ho Chi Minh City.");
    expect(section).toContain("Dr. Santi teaching ACL revision surgery in Ho Chi Minh, 2015.");
    expect(section).not.toContain("<img");
  });

  it("give: no payment control", () => {
    expect(render(GivePage)).not.toMatch(/<form|<input|stripe|paypal/i);
  });

  it("not-found: one h1", () => {
    expect(h1s(render(NotFound))).toHaveLength(1);
  });
});
