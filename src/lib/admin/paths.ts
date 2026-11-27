// Paths and visible strings for the record view, shared by pages, routes,
// tests and smoke. No secrets and no server imports here.

export const ADMIN_PATH = "/admin";
export const SIGN_IN_PATH = "/admin/sign-in";
export const CONFIRM_PATH = "/admin/confirm";
export const HANDOVERS_PATH = "/admin/handovers";
export const itemPath = (id: string) => `/admin/items/${id}`;

/** What /admin/sign-in shows after any address is submitted, whatever happened. */
export const SIGN_IN_SENT = "If that address is on the list, a sign-in link is on its way.";
/** What /admin/sign-in shows when the confirm route could not use a link. */
export const LINK_FAILED = "That link did not work. Request a new one.";

/** The band across every page while synthetic is selected. */
export const SAMPLE_BAND = "SAMPLE DATA: not part of the record";

/** Headers on every /admin response, whatever SITE_INDEXABLE says. */
export const ADMIN_HEADERS = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } as const;

export type Kind = "real" | "synthetic";

/** The kind switch from the URL: `synthetic` only when it says so exactly; otherwise real. */
export function kindFrom(value: string | string[] | undefined): Kind {
  return value === "synthetic" ? "synthetic" : "real";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** One search parameter as a single string, or undefined. */
export function param(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === "" ? undefined : s;
}
