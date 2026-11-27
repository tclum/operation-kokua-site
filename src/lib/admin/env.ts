// The one module that reads the record view's configuration. Three
// server-side variables, none NEXT_PUBLIC_:
//   SUPABASE_URL              the project URL
//   SUPABASE_PUBLISHABLE_KEY  Auth, with the visitor's cookies
//   SUPABASE_SECRET_KEY       reading the record, after the guard passes
// Missing any of them closes /admin: the middleware answers 503 with
// NOT_CONFIGURED and nothing else under /admin renders.
// Values are never printed, logged or put into an error message.

export type AdminEnv = { url: string; publishableKey: string; secretKey: string };

export const NOT_CONFIGURED = "The record view is not configured";

/** The three variables, or null when any is missing or blank. Read per call, at request time. */
export function adminEnv(env: Record<string, string | undefined> = process.env): AdminEnv | null {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !publishableKey || !secretKey) return null;
  return { url, publishableKey, secretKey };
}
