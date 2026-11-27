// The link in the sign-in email lands here. Exempt from requireAdmin(): it is
// how a session starts. It reads nothing from the record.
//
// A sign-in link is never redeemed by a GET (mail scanners and link previews
// fetch links):
//   GET  ?token_hash=...&type=email|magiclink  verifies nothing; renders a page
//        with one "Continue" button whose form posts token_hash and type back here
//   POST token_hash, type                       verifyOtp, then /admin
//   GET  ?code=...  (the default template)      exchangeCodeForSession, then /admin
// A missing, unknown or disallowed type, a cross-origin post, or any failure
// lands on /admin/sign-in?error=link. There is no `next` parameter, so this
// route cannot be used to redirect anywhere else.

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/admin/auth";
import { confirmPage } from "@/lib/admin/confirm-page";
import { ADMIN_HEADERS, ADMIN_PATH, SIGN_IN_PATH } from "@/lib/admin/paths";

/** The only link types that sign an admin in; signup, invite, recovery and email change links are refused. */
const SIGN_IN_TYPES: readonly string[] = ["email", "magiclink"];
const isSignInType = (t: unknown): t is EmailOtpType => typeof t === "string" && SIGN_IN_TYPES.includes(t);

function withAdminHeaders<T extends NextResponse>(res: T): T {
  for (const [key, value] of Object.entries(ADMIN_HEADERS)) res.headers.set(key, value);
  return res;
}

const go = (request: NextRequest, path: string) => withAdminHeaders(NextResponse.redirect(new URL(path, request.url), 303));
const failed = (request: NextRequest) => go(request, `${SIGN_IN_PATH}?error=link`);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (token_hash) {
    if (!isSignInType(type)) return failed(request);
    return withAdminHeaders(new NextResponse(confirmPage(token_hash, type), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  }

  if (code) {
    let ok = false;
    try {
      const supabase = await createAuthClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
    } catch {
      ok = false;
    }
    return ok ? go(request, ADMIN_PATH) : failed(request);
  }

  return failed(request);
}

export async function POST(request: NextRequest) {
  // Route handlers get no server-action origin check, so refuse a post from another site.
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) return failed(request);

  let ok = false;
  try {
    const form = await request.formData();
    const token_hash = form.get("token_hash");
    const type = form.get("type");
    if (typeof token_hash === "string" && token_hash.length > 0 && isSignInType(type)) {
      const supabase = await createAuthClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      ok = !error;
    }
  } catch {
    ok = false;
  }
  return ok ? go(request, ADMIN_PATH) : failed(request);
}
