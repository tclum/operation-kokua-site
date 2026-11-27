import "server-only";

// The Auth client for Server Components, Server Actions and Route Handlers,
// with the visitor's cookies and the publishable key. Cookie handling follows
// Supabase's current Next.js guide (lib/supabase/server.ts) exactly; the only
// difference is that the URL and key come from adminEnv() (server-side
// variables) instead of NEXT_PUBLIC_ ones.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminEnv, NOT_CONFIGURED } from "./env";

export async function createAuthClient() {
  const env = adminEnv();
  if (!env) throw new Error(NOT_CONFIGURED);
  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
