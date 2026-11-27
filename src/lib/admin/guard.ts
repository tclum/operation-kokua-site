import "server-only";

// The guard. Every page, route handler and server action under src/app/admin,
// except the sign-in page and action and the confirm route, calls
// requireAdmin() before it reads anything (src/lib/admin/coverage.test.ts
// holds that). A layout is not the guard. Closed by default:
//   no configuration          -> throws (the middleware has already answered 503)
//   no user, or Auth error     -> redirect to /admin/sign-in
//   user not on the list       -> signed out, then redirect to /admin/sign-in
//   allowlist lookup error     -> signed out, then redirect to /admin/sign-in
//   user on the list           -> returns the admin's email, lowercased
//
// The user is read with auth.getUser(), which asks the Auth server on every
// call, so a session that has been signed out or revoked is refused at once.
// Supabase's current guide names getClaims() for protecting pages; see the
// slice 3b report for why the guard keeps the Auth-server check.

import { redirect } from "next/navigation";
import { createAuthClient } from "./auth";
import { adminEnv, NOT_CONFIGURED } from "./env";
import { SIGN_IN_PATH } from "./paths";
import { isListedAdmin } from "./record";

export async function requireAdmin(): Promise<string> {
  if (!adminEnv()) throw new Error(NOT_CONFIGURED);
  const supabase = await createAuthClient();

  let email: string | undefined;
  try {
    const { data, error } = await supabase.auth.getUser();
    email = error ? undefined : data.user?.email ?? undefined;
  } catch {
    email = undefined;
  }
  if (!email) redirect(SIGN_IN_PATH);

  const normalized = email.toLowerCase();
  let listed = false;
  try {
    listed = await isListedAdmin(normalized);
  } catch {
    listed = false;
  }
  if (!listed) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Closed either way: the redirect below still happens.
    }
    redirect(SIGN_IN_PATH);
  }
  return normalized;
}
