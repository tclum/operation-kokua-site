import "server-only";

// The sign-in request behind /admin/sign-in's server action. Whatever the
// address and whatever Auth answers (sent, not on the list, malformed, rate
// limited, unreachable), the visible result is the same: a redirect to
// /admin/sign-in?sent=1, which shows SIGN_IN_SENT, after the same minimum
// time. Nothing about the address or the outcome is logged.

import { createAuthClient } from "./auth";
import { CONFIRM_PATH, SIGN_IN_PATH } from "./paths";

/** Every request takes at least this long, so timing does not tell a listed address from another. */
export const SIGN_IN_MIN_MS = 1200;
export const SIGN_IN_DONE = `${SIGN_IN_PATH}?sent=1`;

/** This site's origin from the request's own headers. Supabase refuses any redirect not on its Redirect URLs list. */
export function originFrom(h: { get(name: string): string | null }): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const forwarded = h.get("x-forwarded-proto");
  const proto = forwarded ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends the link if Auth will; returns where to redirect, which never depends on the outcome. */
export async function requestSignIn(rawEmail: unknown, h: { get(name: string): string | null }, minMs = SIGN_IN_MIN_MS): Promise<string> {
  const started = Date.now();
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (email.length > 0 && email.length <= 320) {
    try {
      const supabase = await createAuthClient();
      await supabase.auth.signInWithOtp({
        email,
        options: {
          // set this to false if you do not want the user to be automatically signed up
          shouldCreateUser: false,
          emailRedirectTo: `${originFrom(h)}${CONFIRM_PATH}`,
        },
      });
    } catch {
      // Same result whatever went wrong.
    }
  }
  const left = minMs - (Date.now() - started);
  if (left > 0) await sleep(left);
  return SIGN_IN_DONE;
}
