// Pure assertion functions for scripts/smoke.ts. No network here, so the same
// functions run live (`pnpm smoke <url>`) and offline (`--selftest`).

export type Check = { ok: boolean; detail: string };

const pass = (detail: string): Check => ({ ok: true, detail });
const fail = (detail: string): Check => ({ ok: false, detail });

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Text of every <h1> on the page. */
export function h1s(html: string): string[] {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
}

/** One fetched page: its HTTP outcome, or the transport error. */
export type PageFetch = { status?: number; ms?: number; html?: string; xRobots?: string | null; error?: string };

/** A route answers 200 within the limit with exactly one <h1>. */
export function checkRoute(path: string, page: PageFetch, timeoutMs = 20_000): Check {
  if (page.error !== undefined) return fail(`${path}: request failed: ${page.error}`);
  if (page.status !== 200) return fail(`${path}: returned ${page.status}`);
  if ((page.ms ?? 0) > timeoutMs) return fail(`${path}: took ${page.ms} ms (limit ${timeoutMs})`);
  const found = h1s(page.html ?? "");
  if (found.length !== 1) return fail(`${path}: expected exactly one <h1>, found ${found.length}`);
  return pass(`${path}: 200 in ${page.ms} ms, one <h1>: ${found[0]}`);
}

/** The SHA half of <meta name="build-stamp" content="<sha> <iso time>">. */
export function buildStampSha(html: string): string | null {
  const tag = /<meta\b[^>]*name="build-stamp"[^>]*>/i.exec(html)?.[0];
  if (!tag) return null;
  const content = /content="([^"]*)"/i.exec(tag)?.[1];
  return content ? content.split(" ")[0] : null;
}

export function checkStamp(deployedSha: string | null, localSha: string): Check {
  if (!deployedSha) return fail("no build-stamp meta tag on the page");
  if (deployedSha.endsWith("-dirty")) return fail(`build stamp ${deployedSha} is dirty: built from uncommitted changes; this run does not count`);
  if (deployedSha === "nogit" || localSha === "nogit") return fail(`build stamp ${deployedSha}, local ${localSha}: nogit, no commit to compare; this run does not count`);
  if (deployedSha !== localSha) return fail(`SHA mismatch: deployed ${deployedSha}, local HEAD ${localSha}; this run does not count`);
  return pass(`build stamp matches local HEAD ${localSha}`);
}

export function robotsMeta(html: string): string | null {
  const tag = /<meta\b[^>]*name="robots"[^>]*>/i.exec(html)?.[0];
  if (!tag) return null;
  return /content="([^"]*)"/i.exec(tag)?.[1] ?? "";
}

/** Noindex on one page: header and meta (or neither when expecting indexable). Null when it holds. */
export function noindexProblem(xRobotsTag: string | null, html: string, expectIndexable: boolean): string | null {
  const header = xRobotsTag ?? "";
  const meta = robotsMeta(html);
  if (expectIndexable) {
    if (/noindex/i.test(header)) return `X-Robots-Tag is "${header}"`;
    if (meta !== null && /noindex/i.test(meta)) return `robots meta is "${meta}"`;
    return null;
  }
  if (!/noindex/i.test(header)) return `X-Robots-Tag missing noindex (got ${xRobotsTag === null ? "no header" : `"${header}"`})`;
  if (meta === null || !/^noindex/i.test(meta.trim())) return `robots meta missing noindex (got ${meta === null ? "no tag" : `"${meta}"`})`;
  return null;
}

/** Noindex (or its absence, when expecting indexable) on every route. */
export function checkNoindexAll(pages: Map<string, PageFetch>, expectIndexable: boolean): Check {
  const bad: string[] = [];
  for (const [path, p] of pages) {
    if (p.status !== 200 || p.html === undefined) {
      bad.push(`${path}: not fetched`);
      continue;
    }
    const problem = noindexProblem(p.xRobots ?? null, p.html, expectIndexable);
    if (problem) bad.push(`${path}: ${problem}`);
  }
  if (bad.length) return fail(bad.join("; "));
  return pass(expectIndexable ? `indexable on ${pages.size} routes` : `noindex header and meta on ${pages.size} routes`);
}

/** Every URL in an <img> src or srcset, resolved against baseUrl, deduplicated. */
export function imageUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\ssrc="([^"]+)"/i.exec(tag)?.[1];
    if (src) urls.add(src);
    const srcset = /\ssrcset="([^"]+)"/i.exec(tag)?.[1];
    if (srcset)
      for (const part of srcset.split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (u) urls.add(u);
      }
  }
  return [...urls].map((u) => new URL(u.replace(/&amp;/g, "&"), baseUrl).toString());
}

/**
 * Text for a caught fetch error. Node's fetch throws "fetch failed" and hides
 * the transport reason in `cause`; this prints both.
 */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const code = (cause as { code?: unknown }).code;
    const msg = (cause as { message?: unknown }).message;
    const parts = [typeof code === "string" ? code : null, typeof msg === "string" && msg ? msg : null].filter(Boolean);
    if (parts.length) return `${e.message} (${parts.join(": ")})`;
  }
  return e.message;
}

/** One URL's outcome: an HTTP response (status and content type) or a transport error. */
export type UrlOutcome = { url: string; status?: number; type?: string; error?: string };

/** Every image URL on every route answers 200 with an image/ type. */
export function checkImages(results: UrlOutcome[]): Check {
  if (results.length === 0) return fail("no <img> URLs found on any route");
  const bad = results
    .filter((r) => r.error !== undefined || r.status !== 200 || !(r.type ?? "").startsWith("image/"))
    .map((r) => (r.error !== undefined ? `${r.url} (${r.error})` : `${r.url} (${r.status} ${r.type || "no type"})`));
  if (bad.length) return fail(`${bad.length} of ${results.length} image URLs failed: ${bad.join(", ")}`);
  return pass(`${results.length} image URLs all 200 image/*`);
}

/** The IRS letter answers 200 as application/pdf. */
export function checkPdf(r: UrlOutcome): Check {
  if (r.error !== undefined) return fail(`${r.url}: ${r.error}`);
  if (r.status !== 200 || !(r.type ?? "").startsWith("application/pdf")) return fail(`${r.url}: ${r.status} ${r.type || "no type"}`);
  return pass(`${r.url}: 200 application/pdf`);
}

/** Trip sections on the timeline: elements carrying data-trip. */
export function tripSectionCount(html: string): number {
  return [...html.matchAll(/<section\b[^>]*\sdata-trip="[^"]+"/gi)].length;
}

export function checkTimeline(html: string | undefined, expected: number): Check {
  if (html === undefined) return fail("/timeline: not fetched");
  const n = tripSectionCount(html);
  if (n !== expected) return fail(`/timeline holds ${n} trip sections, expected ${expected}`);
  return pass(`/timeline holds ${n} trip sections`);
}

export function checkNotFound(status: number | undefined, error?: string): Check {
  if (error !== undefined) return fail(`unknown path: request failed: ${error}`);
  if (status !== 404) return fail(`unknown path returned ${status}, expected 404`);
  return pass("unknown path returns 404");
}

export function checkRobotsTxt(status: number, body: string): Check {
  if (status !== 200) return fail(`/robots.txt returned ${status}`);
  const lines = body.split(/\r?\n/);
  if (lines.some((l) => /^\s*disallow:\s*\/\s*$/i.test(l))) return fail("/robots.txt disallows /");
  if (!lines.some((l) => /^\s*allow:\s*\/\s*$/i.test(l))) return fail("/robots.txt has no Allow: /");
  return pass("/robots.txt is 200 and allows /");
}

/** A base URL must be http: or https:. */
export function checkBaseUrl(input: string): Check {
  try {
    const u = new URL(input);
    if (u.protocol === "http:" || u.protocol === "https:") return pass(`base URL ${u.origin}`);
    return fail(`"${input}" is not an http(s) URL`);
  } catch {
    return fail(`"${input}" is not a URL; did you mean https://${input}?`);
  }
}
