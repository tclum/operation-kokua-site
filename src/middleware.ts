// Session refresh for the record view, and nothing else. The matcher limits it
// to /admin and below: the five public pages, robots.txt, the images and the
// IRS letter never pass through it (src/middleware.test.ts holds that).
//
// - Missing configuration closes the door: every /admin request is answered
//   503 with NOT_CONFIGURED and nothing under /admin renders.
// - Otherwise the Supabase session is refreshed exactly as Supabase's current
//   Next.js guide does it (lib/supabase/proxy.ts: getAll/setAll on the request
//   and response, cache headers from setAll, getClaims() right after the
//   client is created). The guide's redirect of signed-out visitors is left to
//   requireAdmin(), so the guard is the one door.
// - Every response carries X-Robots-Tag: noindex, nofollow and
//   Cache-Control: no-store, whatever SITE_INDEXABLE says.
// Next.js 15 calls this file middleware.ts; version 16 renamed it proxy.ts.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminEnv, NOT_CONFIGURED } from "@/lib/admin/env";
import { ADMIN_HEADERS } from "@/lib/admin/paths";

const NOT_CONFIGURED_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>${NOT_CONFIGURED}</title></head><body><h1>${NOT_CONFIGURED}</h1></body></html>`;

function withAdminHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(ADMIN_HEADERS)) response.headers.set(key, value);
  return response;
}

export async function middleware(request: NextRequest) {
  const env = adminEnv();
  if (!env) {
    return withAdminHeaders(new NextResponse(NOT_CONFIGURED_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  await supabase.auth.getClaims();

  // The supabaseResponse is returned as it is; only its noindex and cache
  // headers are set, never its cookies.
  return withAdminHeaders(supabaseResponse);
}

export const config = {
  matcher: ["/admin/:path*"],
};
