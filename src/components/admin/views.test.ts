import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
} from "../../../test/admin-fixtures";
import { confirmPage } from "@/lib/admin/confirm-page";
import { NOT_GIVEN } from "@/lib/admin/format";
import { SAMPLE_BAND } from "@/lib/admin/paths";
import { SignInView } from "./SignInView";
import { AdminShell } from "./AdminShell";
import { HandoversView, ItemView, OverviewView } from "./views";

const noop = async () => {};
const shell = (kind: "real" | "synthetic", child: React.ReactElement) =>
  renderToStaticMarkup(h(AdminShell, { email: FIXTURE_EMAIL, kind, section: "overview", switchPath: "/admin", signOutAction: noop }, child));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("the admin views over SAMPLE fixtures", () => {
  it("synthetic carries the SAMPLE band; real does not", () => {
    const overview = h(OverviewView, { kind: "synthetic", batches: fixtureBatches, totals: fixtureTotals, counts: fixtureCounts });
    expect(text(shell("synthetic", overview))).toContain(SAMPLE_BAND);
    expect(SAMPLE_BAND).toBe("SAMPLE DATA: not part of the record");
    expect(text(shell("real", h(OverviewView, { kind: "real", batches: [], totals: [], counts: fixtureEmptyRealCounts })))).not.toContain(SAMPLE_BAND);
  });

  it("every page has exactly one h1 and a sign-out control", () => {
    for (const child of [
      h(OverviewView, { kind: "synthetic", batches: fixtureBatches, totals: fixtureTotals, counts: fixtureCounts }),
      h(HandoversView, { kind: "synthetic", rows: fixtureHandovers, total: 120, page: 2, filters: {}, countries: ["SAMPLE Country A"], recipients: fixtureRecipients, trips: fixtureTrips }),
      h(ItemView, { kind: "synthetic", record: fixtureItem }),
    ]) {
      const html = shell("synthetic", child);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    }
  });

  it("totals: one figure per basis, labelled in words, never a sum across bases", () => {
    const t = text(shell("synthetic", h(OverviewView, { kind: "synthetic", batches: fixtureBatches, totals: fixtureTotals, counts: fixtureCounts })));
    expect(t).toContain("Original cost $126,400.00");
    expect(t).toContain("Fair market value $41,250.00");
    expect(t).not.toContain("$167,650.00");
    expect(t).not.toMatch(/\bTotal\b/);
  });

  it("the real kind with no items says so and names the old-site trips and hospitals", () => {
    const t = text(shell("real", h(OverviewView, { kind: "real", batches: fixtureEmptyRealBatches, totals: [], counts: fixtureEmptyRealCounts })));
    expect(t).toContain("There are no items in the record yet. The 12 trips and 4 hospitals from the old site are recorded.");
  });

  it("the kind switch keeps synthetic in every admin link while selected", () => {
    const html = shell("synthetic", h(HandoversView, { kind: "synthetic", rows: fixtureHandovers, total: 120, page: 2, filters: { country: "SAMPLE Country A" }, countries: ["SAMPLE Country A"], recipients: fixtureRecipients, trips: fixtureTrips }));
    const itemLinks = [...html.matchAll(/href="(\/admin\/items\/[^"]+)"/g)].map((m) => m[1]);
    expect(itemLinks.length).toBe(fixtureHandovers.length);
    for (const l of itemLinks) expect(l).toMatch(/\?kind=synthetic$/);
    expect(html).toContain('href="/admin/handovers?kind=synthetic&amp;country=SAMPLE+Country+A"');
    expect(html).toContain('href="/admin/handovers?kind=synthetic&amp;country=SAMPLE+Country+A&amp;page=3"');
  });

  it("the item page shows valuations with basis, method and valuer, and the raw row as keys and values", () => {
    const t = text(shell("synthetic", h(ItemView, { kind: "synthetic", record: fixtureItem })));
    expect(t).toContain("Fair market value $1,500.00 unit SAMPLE comparable listings 2026-11-01 SAMPLE appraiser");
    expect(t).toContain("Sheet Items, row 2");
    expect(t).toContain("item_ref sample-item-1");
  });

  it("no long dash anywhere in a rendered admin page; an empty value reads \"not given\"", () => {
    const pages = [
      shell("synthetic", h(OverviewView, { kind: "synthetic", batches: fixtureBatches, totals: fixtureTotals, counts: fixtureCounts })),
      shell("real", h(OverviewView, { kind: "real", batches: fixtureEmptyRealBatches, totals: [], counts: fixtureEmptyRealCounts })),
      shell("real", h(OverviewView, { kind: "real", batches: [], totals: [], counts: fixtureEmptyRealCounts })),
      shell("synthetic", h(HandoversView, { kind: "synthetic", rows: fixtureHandovers, total: 120, page: 2, filters: {}, countries: ["SAMPLE Country A"], recipients: fixtureRecipients, trips: fixtureTrips })),
      shell("synthetic", h(HandoversView, { kind: "synthetic", rows: [], total: 0, page: 1, filters: {}, countries: [], recipients: [], trips: [] })),
      shell("synthetic", h(ItemView, { kind: "synthetic", record: fixtureItem })),
      shell("synthetic", h(ItemView, { kind: "synthetic", record: { ...fixtureItem, valuations: [], handovers: [], followups: [], raw: null } })),
      renderToStaticMarkup(h(SignInView, { state: "form", action: noop })),
      renderToStaticMarkup(h(SignInView, { state: "sent", action: noop })),
      renderToStaticMarkup(h(SignInView, { state: "link-failed", action: noop })),
      confirmPage("abc123", "email"),
    ];
    for (const html of pages) expect(html).not.toMatch(/\u2014|&mdash;|&#8212;|&#x2014;/i);
    // Fixture rows with empty fields: batch two's sender and date, the null trip and city, the valuation date, the followup.
    expect(text(pages[0])).toContain("SAMPLE batch two sample-batch-two.xlsx not given not given");
    expect(text(pages[3])).toMatch(/SAMPLE Clinic Gamma not given SAMPLE Country B/);
    expect(text(pages[5])).toContain("Original cost $9,000.00 lot SAMPLE purchase invoice not given SAMPLE donor");
    expect(text(pages[5])).toContain("2026-11-16 Unknown not given not given");
    expect(NOT_GIVEN).toBe("not given");
  });

  it("the fixtures are all SAMPLE", () => {
    const all = JSON.stringify([fixtureBatches, fixtureTotals, fixtureRecipients, fixtureTrips, fixtureHandovers, fixtureItem]);
    for (const m of all.matchAll(/"(name|label|description|title|recipient_name)":"([^"]*)"/g)) expect(m[2], m[0]).toMatch(/^SAMPLE/);
    for (const m of all.matchAll(/"(slug|trip_slug)":"([^"]*)"/g)) expect(m[2], m[0]).toMatch(/^sample-/);
  });
});
