// Smoke check for a running Operation Kokua site.
//   pnpm smoke <baseUrl>     live: numbered assertions, exit 1 on any failure
//   pnpm smoke --selftest    offline: the same assertion functions against
//                            fixtures, every must-fail red and every must-pass green
// Line one is the version, line two the deployed and local SHAs. No skips, no retries.
// SMOKE_EXPECT_INDEXABLE=true flips assertion 7 to expect no noindex.
//
//  1-5  each route returns 200 within 20 s with exactly one <h1>
//    6  the build stamp's SHA equals local HEAD and is not dirty
//    7  noindex in the X-Robots-Tag header and the robots meta on every route
//    8  every image URL on every route returns 200 with an image/ type
//    9  /docs/irs-approval-letter.pdf returns 200 as application/pdf
//   10  /timeline holds one trip section per trip in src/content/trips.ts (12)
//   11  an unknown path returns 404
//   12  /robots.txt returns 200 and allows /
//   13  /admin, unauthenticated, redirects to /admin/sign-in; the body holds
//       none of SAMPLE, Original cost, or any seeded recipient name
//   14  /admin/handovers, the same
//   15  /admin/items/<uuid>, the same
//   16  /admin/sign-in returns 200 with noindex header and meta and
//       Cache-Control no-store
//   17  posting an address that is not on the list to /admin/sign-in ends on
//       the one sentence every address gets

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { trips } from "../src/content/trips";
import { ADMIN_PATH, HANDOVERS_PATH, itemPath, SIGN_IN_PATH, SIGN_IN_SENT } from "../src/lib/admin/paths";
import { IRS_LETTER_PATH, ROUTES } from "../src/lib/routes";
import {
  actionId,
  buildStampSha,
  type Check,
  checkAdminRedirect,
  checkBaseUrl,
  checkImages,
  checkNoindexAll,
  checkNotFound,
  checkPdf,
  checkRobotsTxt,
  checkRoute,
  checkSignInPage,
  checkSignInPost,
  checkStamp,
  checkTimeline,
  errorText,
  h1s,
  imageUrls,
  type PageFetch,
  type RawOutcome,
  type UrlOutcome,
} from "./smoke-checks";

const SMOKE_VERSION = "smoke v0.2.0";
const PAGE_TIMEOUT_MS = 20_000;
const ROUTE_PATHS = ROUTES.map((r) => r.path);
const UNKNOWN_PATH = "/no-such-page-smoke";
const ADMIN_ITEM_PATH = itemPath("00000000-0000-4000-8000-000000000000");
/** An address that is never on the allowlist (example.com is reserved). */
const NOT_LISTED = "smoke-not-on-the-list@example.com";

/** The recipient names the seed migration puts in the real record. */
function seededRecipientNames(): string[] {
  const sql = readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261125021334_seed_old_site.sql"), "utf8");
  return [...sql.matchAll(/^\s+\('([^']+)', (?:'[^']*'|null), '[^']*', '[^']*'\)/gm)].map((m) => m[1]);
}

/** What an unauthenticated redirect body must never hold. */
function forbiddenInRedirect(): string[] {
  return ["SAMPLE", "Original cost", ...seededRecipientNames()];
}

async function raw(url: string, init: RequestInit = {}): Promise<RawOutcome> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PAGE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, redirect: "manual" });
    return {
      status: r.status,
      location: r.headers.get("location"),
      xRobots: r.headers.get("x-robots-tag"),
      cacheControl: r.headers.get("cache-control"),
      body: await r.text(),
    };
  } catch (e) {
    return { error: errorText(e) };
  } finally {
    clearTimeout(t);
  }
}

function localSha(): string {
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "nogit";
  }
}

async function get(url: string, timeoutMs = PAGE_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function outcome(url: string): Promise<UrlOutcome> {
  try {
    const r = await get(url);
    const type = r.headers.get("content-type") ?? "";
    await r.arrayBuffer();
    return { url, status: r.status, type };
  } catch (e) {
    return { url, error: errorText(e) };
  }
}

function report(results: Check[]): boolean {
  results.forEach((r, i) => console.log(`${i + 1}. ${r.ok ? "PASS" : "FAIL"}  ${r.detail}`));
  console.log(`TOTAL: ${results.filter((r) => r.ok).length}/${results.length} passed`);
  return results.every((r) => r.ok);
}

async function live(baseUrl: string): Promise<number> {
  const expectIndexable = process.env.SMOKE_EXPECT_INDEXABLE === "true";
  const local = localSha();
  const pages = new Map<string, PageFetch>();
  for (const path of ROUTE_PATHS) {
    const page: PageFetch = {};
    const t0 = Date.now();
    try {
      const res = await get(new URL(path, baseUrl).toString());
      page.html = await res.text();
      page.status = res.status;
      page.ms = Date.now() - t0;
      page.xRobots = res.headers.get("x-robots-tag");
    } catch (e) {
      page.error = errorText(e);
    }
    pages.set(path, page);
  }
  const deployed = buildStampSha(pages.get("/")?.html ?? "");
  console.log(`deployed ${deployed ?? "unknown"}  local ${local}`);

  const results: Check[] = [];
  // 1-5. Each route: 200 within 20 s, exactly one <h1>.
  for (const path of ROUTE_PATHS) results.push(checkRoute(path, pages.get(path)!, PAGE_TIMEOUT_MS));
  // 6. Stamp equals local HEAD, not dirty.
  results.push(checkStamp(deployed, local));
  // 7. Noindex on every route.
  results.push(checkNoindexAll(pages, expectIndexable));
  // 8. Every image URL on every route.
  const urls = new Set<string>();
  for (const p of pages.values()) if (p.html && p.status === 200) for (const u of imageUrls(p.html, baseUrl)) urls.add(u);
  const images: UrlOutcome[] = [];
  for (const u of urls) images.push(await outcome(u));
  results.push(checkImages(images));
  // 9. The IRS letter.
  results.push(checkPdf(await outcome(new URL(IRS_LETTER_PATH, baseUrl).toString())));
  // 10. The timeline's trip sections.
  const tl = pages.get("/timeline");
  results.push(checkTimeline(tl?.status === 200 ? tl.html : undefined, trips.length));
  // 11. Unknown path.
  const nf = await outcome(new URL(UNKNOWN_PATH, baseUrl).toString());
  results.push(checkNotFound(nf.status, nf.error));
  // 12. robots.txt.
  try {
    const r = await get(new URL("/robots.txt", baseUrl).toString());
    results.push(checkRobotsTxt(r.status, await r.text()));
  } catch (e) {
    results.push({ ok: false, detail: `/robots.txt failed: ${errorText(e)}` });
  }

  // 13-15. Signed-in pages, unauthenticated: redirect to sign-in, nothing leaked.
  const forbidden = forbiddenInRedirect();
  for (const p of [ADMIN_PATH, HANDOVERS_PATH, ADMIN_ITEM_PATH]) {
    results.push(checkAdminRedirect(p, await raw(new URL(p, baseUrl).toString()), SIGN_IN_PATH, forbidden, baseUrl));
  }
  // 16. The sign-in page.
  const signIn = await raw(new URL(SIGN_IN_PATH, baseUrl).toString());
  results.push(checkSignInPage(SIGN_IN_PATH, signIn));
  // 17. Posting an address that is not on the list.
  const id = actionId(signIn.body ?? "");
  if (!id) {
    results.push({ ok: false, detail: `${SIGN_IN_PATH}: no server action id in the form` });
  } else {
    const form = new FormData();
    form.set(`$ACTION_ID_${id}`, "");
    form.set("email", NOT_LISTED);
    const post = await raw(new URL(SIGN_IN_PATH, baseUrl).toString(), { method: "POST", body: form, headers: { Origin: new URL(baseUrl).origin } });
    const landed = post.location ? await raw(new URL(post.location, baseUrl).toString()) : null;
    results.push(checkSignInPost(post, landed, SIGN_IN_SENT));
  }

  const ok = report(results);
  console.log(`RESULT: ${ok ? "pass" : "fail"}`);
  return ok ? 0 : 1;
}

// ---------- selftest ----------

const NOINDEX = "noindex, nofollow";

function pageHtml(path: string, opts: { h1s?: number; robots?: boolean; stamp?: string; trips?: number; img?: boolean } = {}): string {
  const { h1s: n = 1, robots = true, stamp = "abc1234 2026-11-24T00:00:00.000Z", trips: t = 0, img = true } = opts;
  return `<!DOCTYPE html><html><head>${robots ? `<meta name="robots" content="${NOINDEX}"/>` : ""}
<meta name="build-stamp" content="${stamp}"/></head><body>
<a href="#main">Skip to content</a><main id="main">${"<h1>Title</h1>".repeat(n)}
${img ? `<img alt="A photo of people" src="/images/photo-1-1100.jpg" srcset="/images/photo-1-640.jpg 640w, /images/photo-1-1100.jpg 1100w"/>` : ""}
${Array.from({ length: t }, (_, i) => `<section id="t${i}" data-trip="t${i}" aria-labelledby="x"><h3>Trip</h3></section>`).join("")}
${path}</main></body></html>`;
}

const okPage = (path: string, extra: Partial<PageFetch> = {}): PageFetch => ({ status: 200, ms: 120, html: pageHtml(path), xRobots: NOINDEX, ...extra });
const allPages = (override: Record<string, PageFetch> = {}) => new Map(ROUTE_PATHS.map((p) => [p, override[p] ?? okPage(p)]));
const IMG: UrlOutcome = { url: "http://localhost/images/photo-1-640.jpg", status: 200, type: "image/jpeg" };
const FETCH_RESET = new TypeError("fetch failed", { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });

const REDIRECT: RawOutcome = { status: 307, location: SIGN_IN_PATH, xRobots: NOINDEX, cacheControl: "no-store", body: "" };
const SIGN_IN_OK: RawOutcome = {
  status: 200,
  location: null,
  xRobots: NOINDEX,
  cacheControl: "no-store",
  body: `<html><head><meta name="robots" content="${NOINDEX}"/></head><body><form action="" method="POST"><input type="hidden" name="$ACTION_ID_7f00ab"/><input name="email"/></form></body></html>`,
};
const POSTED: RawOutcome = { status: 303, location: `${SIGN_IN_PATH}?sent=1`, body: "" };
const LANDED: RawOutcome = { ...SIGN_IN_OK, body: `<html><body><p role="status">${SIGN_IN_SENT}</p></body></html>` };

type Case = { name: string; mustPass: boolean; run: () => Check };

const cases: Case[] = [
  // must-pass
  ...ROUTE_PATHS.map((p, i): Case => ({ name: `${i + 1} ${p}: 200, one h1`, mustPass: true, run: () => checkRoute(p, okPage(p)) })),
  { name: "6 stamp matches local HEAD", mustPass: true, run: () => checkStamp(buildStampSha(pageHtml("/")), "abc1234") },
  { name: "7 noindex header and meta on every route", mustPass: true, run: () => checkNoindexAll(allPages(), false) },
  {
    name: "7 indexable everywhere when expecting indexable",
    mustPass: true,
    run: () => checkNoindexAll(new Map(ROUTE_PATHS.map((p) => [p, okPage(p, { xRobots: null, html: pageHtml(p, { robots: false }) })])), true),
  },
  {
    name: "8 image URLs come from src and srcset",
    mustPass: true,
    run: () => {
      const n = imageUrls(pageHtml("/"), "http://localhost").length;
      return { ok: n === 2, detail: `${n} URLs` };
    },
  },
  { name: "8 images all 200 image/*", mustPass: true, run: () => checkImages([IMG, { ...IMG, url: "http://localhost/b.jpg" }]) },
  { name: "9 PDF 200 application/pdf", mustPass: true, run: () => checkPdf({ url: IRS_LETTER_PATH, status: 200, type: "application/pdf" }) },
  { name: `10 timeline with ${trips.length} trip sections`, mustPass: true, run: () => checkTimeline(pageHtml("/timeline", { trips: trips.length }), trips.length) },
  { name: "11 unknown path 404", mustPass: true, run: () => checkNotFound(404) },
  { name: "12 robots.txt allows /", mustPass: true, run: () => checkRobotsTxt(200, "User-Agent: *\nAllow: /\n") },
  { name: "address http://localhost:3020", mustPass: true, run: () => checkBaseUrl("http://localhost:3020") },
  {
    name: "fetch error text carries its cause",
    mustPass: true,
    run: () => {
      const t = errorText(FETCH_RESET);
      return { ok: t === "fetch failed (ECONNRESET: socket hang up)", detail: t };
    },
  },
  { name: "h1 text extracted", mustPass: true, run: () => ({ ok: h1s(pageHtml("/"))[0] === "Title", detail: "Title" }) },
  ...[ADMIN_PATH, HANDOVERS_PATH, ADMIN_ITEM_PATH].map(
    (p, i): Case => ({ name: `${13 + i} ${p}: 307 to sign-in, clean body`, mustPass: true, run: () => checkAdminRedirect(p, REDIRECT, SIGN_IN_PATH, forbiddenInRedirect()) }),
  ),
  { name: "13 an absolute Location to sign-in", mustPass: true, run: () => checkAdminRedirect(ADMIN_PATH, { ...REDIRECT, location: `http://localhost${SIGN_IN_PATH}` }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "13-15 seeded recipient names read from the migration (4)", mustPass: true, run: () => ({ ok: seededRecipientNames().length === 4, detail: seededRecipientNames().join(", ") }) },
  { name: "16 sign-in: 200, noindex, no-store", mustPass: true, run: () => checkSignInPage(SIGN_IN_PATH, SIGN_IN_OK) },
  { name: "16 sign-in: Next's private no-cache no-store", mustPass: true, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate" }) },
  { name: "17 action id read from the form", mustPass: true, run: () => ({ ok: actionId(SIGN_IN_OK.body!) === "7f00ab", detail: String(actionId(SIGN_IN_OK.body!)) }) },
  { name: "17 post: 303 then the sentence", mustPass: true, run: () => checkSignInPost(POSTED, LANDED, SIGN_IN_SENT) },
  // must-fail
  { name: "1-5 a route that is 404", mustPass: false, run: () => checkRoute("/work", okPage("/work", { status: 404 })) },
  { name: "1-5 a route that fails to load", mustPass: false, run: () => checkRoute("/work", { error: errorText(FETCH_RESET) }) },
  { name: "1-5 a route slower than 20 s", mustPass: false, run: () => checkRoute("/about", okPage("/about", { ms: 20_001 })) },
  { name: "1-5 a route with two h1s", mustPass: false, run: () => checkRoute("/give", okPage("/give", { html: pageHtml("/give", { h1s: 2 }) })) },
  { name: "1-5 a route with no h1", mustPass: false, run: () => checkRoute("/give", okPage("/give", { html: pageHtml("/give", { h1s: 0 }) })) },
  { name: "6 dirty stamp", mustPass: false, run: () => checkStamp("abc1234-dirty", "abc1234") },
  { name: "6 SHA mismatch", mustPass: false, run: () => checkStamp("abc1234", "def5678") },
  { name: "6 nogit stamp", mustPass: false, run: () => checkStamp("nogit", "nogit") },
  { name: "6 no stamp tag", mustPass: false, run: () => checkStamp(buildStampSha("<html></html>"), "abc1234") },
  { name: "7 one route missing the header", mustPass: false, run: () => checkNoindexAll(allPages({ "/about": okPage("/about", { xRobots: null }) }), false) },
  {
    name: "7 one route missing the meta",
    mustPass: false,
    run: () => checkNoindexAll(allPages({ "/give": okPage("/give", { html: pageHtml("/give", { robots: false }) }) }), false),
  },
  { name: "7 noindex present when expecting indexable", mustPass: false, run: () => checkNoindexAll(allPages(), true) },
  { name: "8 one image 404", mustPass: false, run: () => checkImages([IMG, { ...IMG, url: "http://localhost/x.jpg", status: 404, type: "text/html" }]) },
  { name: "8 one image served as text/html", mustPass: false, run: () => checkImages([IMG, { ...IMG, url: "http://localhost/x.jpg", type: "text/html" }]) },
  { name: "8 one image transport error", mustPass: false, run: () => checkImages([IMG, { url: "http://localhost/x.jpg", error: errorText(FETCH_RESET) }]) },
  { name: "8 no images at all", mustPass: false, run: () => checkImages([]) },
  { name: "9 PDF 404", mustPass: false, run: () => checkPdf({ url: IRS_LETTER_PATH, status: 404, type: "text/html" }) },
  { name: "9 PDF served as text/html", mustPass: false, run: () => checkPdf({ url: IRS_LETTER_PATH, status: 200, type: "text/html" }) },
  { name: "10 timeline with 11 trip sections", mustPass: false, run: () => checkTimeline(pageHtml("/timeline", { trips: trips.length - 1 }), trips.length) },
  { name: "10 timeline not fetched", mustPass: false, run: () => checkTimeline(undefined, trips.length) },
  { name: "11 unknown path returns 200", mustPass: false, run: () => checkNotFound(200) },
  { name: "12 robots.txt disallows /", mustPass: false, run: () => checkRobotsTxt(200, "User-Agent: *\nDisallow: /\n") },
  { name: "12 robots.txt 404", mustPass: false, run: () => checkRobotsTxt(404, "") },
  { name: "address: a bare host", mustPass: false, run: () => checkBaseUrl("kokua.forpono.com") },
  { name: "13 /admin answers 200 (no guard)", mustPass: false, run: () => checkAdminRedirect(ADMIN_PATH, { ...REDIRECT, status: 200, location: null }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "13 /admin answers 503 (not configured)", mustPass: false, run: () => checkAdminRedirect(ADMIN_PATH, { ...REDIRECT, status: 503, location: null }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "13 /admin redirects somewhere else", mustPass: false, run: () => checkAdminRedirect(ADMIN_PATH, { ...REDIRECT, location: "/" }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "13 a redirect with no Location", mustPass: false, run: () => checkAdminRedirect(ADMIN_PATH, { ...REDIRECT, location: null }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "14 redirect body holds SAMPLE", mustPass: false, run: () => checkAdminRedirect(HANDOVERS_PATH, { ...REDIRECT, body: "<td>SAMPLE scalpel</td>" }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "14 redirect body holds Original cost", mustPass: false, run: () => checkAdminRedirect(HANDOVERS_PATH, { ...REDIRECT, body: "<td>Original cost</td>" }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "15 redirect body holds a recipient name", mustPass: false, run: () => checkAdminRedirect(ADMIN_ITEM_PATH, { ...REDIRECT, body: `<td>${seededRecipientNames()[0]}</td>` }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "15 request fails", mustPass: false, run: () => checkAdminRedirect(ADMIN_ITEM_PATH, { error: errorText(FETCH_RESET) }, SIGN_IN_PATH, forbiddenInRedirect()) },
  { name: "16 sign-in 503", mustPass: false, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, status: 503 }) },
  { name: "16 sign-in missing the noindex header", mustPass: false, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, xRobots: null }) },
  { name: "16 sign-in missing the noindex meta", mustPass: false, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, body: "<html><head></head><body><form></form></body></html>" }) },
  { name: "16 sign-in cacheable", mustPass: false, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, cacheControl: "public, max-age=3600" }) },
  { name: "16 sign-in with no Cache-Control", mustPass: false, run: () => checkSignInPage(SIGN_IN_PATH, { ...SIGN_IN_OK, cacheControl: null }) },
  { name: "17 post answers 200 with no redirect", mustPass: false, run: () => checkSignInPost({ status: 200, location: null, body: "" }, null, SIGN_IN_SENT) },
  { name: "17 post lands on a page without the sentence", mustPass: false, run: () => checkSignInPost(POSTED, { ...LANDED, body: "<p>That address is not on the list.</p>" }, SIGN_IN_SENT) },
  { name: "17 post lands on a 500", mustPass: false, run: () => checkSignInPost(POSTED, { ...LANDED, status: 500 }, SIGN_IN_SENT) },
  { name: "17 no action id in a form", mustPass: false, run: () => ({ ok: actionId("<form></form>") !== null, detail: "no id" }) },
  { name: "address: ftp://example.com", mustPass: false, run: () => checkBaseUrl("ftp://example.com") },
];

function selftest(): number {
  let bad = 0;
  for (const c of cases) {
    const r = c.run();
    const good = r.ok === c.mustPass;
    if (!good) bad++;
    console.log(`${good ? "ok  " : "BAD "} ${c.mustPass ? "must-pass" : "must-fail"}  ${c.name}  -> ${r.ok ? "PASS" : "FAIL"}: ${r.detail}`);
  }
  const passCount = cases.filter((c) => c.mustPass).length;
  console.log(`${cases.length} cases (${passCount} must-pass, ${cases.length - passCount} must-fail), ${bad} wrong`);
  console.log(`RESULT: ${bad === 0 ? "pass" : "fail"}`);
  return bad === 0 ? 0 : 1;
}

async function main(): Promise<number> {
  console.log(SMOKE_VERSION);
  const arg = process.argv[2];
  if (arg === "--selftest") {
    console.log(`deployed (fixture) abc1234  local ${localSha()}`);
    return selftest();
  }
  if (!arg) {
    console.error("usage: pnpm smoke <baseUrl> | pnpm smoke --selftest");
    return 2;
  }
  const base = checkBaseUrl(arg);
  if (!base.ok) {
    console.error(`smoke: ${base.detail}`);
    return 2;
  }
  return live(arg);
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
