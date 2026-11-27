// pnpm admin:preview <out-dir>
// (run through scripts/tsconfig.admin-preview.json, which only switches JSX to
// the automatic runtime so tsx can render the .tsx views outside Next.js)
// Test-only: renders each signed-in admin page component against the SAMPLE
// fixtures in test/admin-fixtures.ts and writes one HTML file per page, for
// review without signing in. Reads nothing from the record and makes no
// request. Every page carries a banner saying it is a fixture render. Run
// after `pnpm build`: the site's compiled CSS is inlined from .next/static/css,
// with font URLs pointed at the built files.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell, type AdminSection } from "../src/components/admin/AdminShell";
import { HandoversView, ItemView, OverviewView } from "../src/components/admin/views";
import type { Kind } from "../src/lib/admin/paths";
import {
  FIXTURE_EMAIL,
  fixtureBatches,
  fixtureCounts,
  fixtureEmptyRealBatches,
  fixtureEmptyRealCounts,
  fixtureHandovers,
  fixtureItem,
  fixtureRecipients,
  fixtureTotals,
  fixtureTrips,
} from "../test/admin-fixtures";

const ROOT = path.resolve(__dirname, "..");
const NOTICE = "FIXTURE RENDER: SAMPLE data from test/admin-fixtures.ts, not the record; no signed-in request was made.";

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? cssFiles(path.join(dir, d.name)) : d.name.endsWith(".css") ? [path.join(dir, d.name)] : [],
  );
}

function css(): string {
  const files = cssFiles(path.join(ROOT, ".next", "static"));
  if (files.length === 0) throw new Error("no CSS under .next/static; run pnpm build first");
  const media = pathToFileURL(path.join(ROOT, ".next", "static", "media")).href;
  return files
    .map((f) =>
      readFileSync(f, "utf8")
        .replace(/url\((?:\.\.\/media|\/_next\/static\/media)\//g, `url(${media}/`),
    )
    .join("\n");
}

function page(title: string, kind: Kind, section: AdminSection, switchPath: string, child: ReactElement, styles: string): string {
  const body = renderToStaticMarkup(h(AdminShell, { email: FIXTURE_EMAIL, kind, section, switchPath, signOutAction: async () => {} }, child));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title}</title><style>${styles}</style></head><body class="antialiased"><div style="background:#10201F;color:#F7F4EC;font:600 13px/1.4 system-ui;padding:6px 12px;text-align:center">${NOTICE}</div>${body}</body></html>`;
}

function main(): number {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: pnpm admin:preview <out-dir>");
    return 2;
  }
  mkdirSync(out, { recursive: true });
  const styles = css();
  const pages: [string, string][] = [
    ["admin-overview-synthetic.html", page("Overview (fixture)", "synthetic", "overview", "/admin", h(OverviewView, { kind: "synthetic", batches: fixtureBatches, totals: fixtureTotals, counts: fixtureCounts }), styles)],
    ["admin-overview-real-empty.html", page("Overview, real, empty (fixture)", "real", "overview", "/admin", h(OverviewView, { kind: "real", batches: fixtureEmptyRealBatches, totals: [], counts: fixtureEmptyRealCounts }), styles)],
    [
      "admin-handovers-synthetic.html",
      page(
        "Handovers (fixture)",
        "synthetic",
        "handovers",
        "/admin/handovers",
        h(HandoversView, { kind: "synthetic", rows: fixtureHandovers, total: 112, page: 1, filters: {}, countries: ["SAMPLE Country A", "SAMPLE Country B"], recipients: fixtureRecipients, trips: fixtureTrips }),
        styles,
      ),
    ],
    ["admin-item-synthetic.html", page("Item (fixture)", "synthetic", "item", "/admin", h(ItemView, { kind: "synthetic", record: fixtureItem }), styles)],
  ];
  for (const [name, html] of pages) {
    writeFileSync(path.join(out, name), html);
    console.log(`wrote ${name}`);
  }
  return 0;
}

process.exit(main());
