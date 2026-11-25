// The one module that reads the database credentials. Server-only: nothing
// under src/ imports this file (scripts/record/record.test.ts holds that).
// The values are never printed, logged or put into an error message.

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENV_FILE = path.resolve(__dirname, "..", "..", ".env.local");

function readEnv(): { url: string; key: string } {
  let text: string;
  try {
    text = readFileSync(ENV_FILE, "utf8");
  } catch {
    throw new Error(".env.local is missing; it needs SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)");
  }
  const vars = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) vars.set(m[1], m[2].replace(/^["']|["']$/g, ""));
  }
  const url = vars.get("SUPABASE_URL");
  const key = vars.get("SUPABASE_SECRET_KEY");
  if (!url) throw new Error("SUPABASE_URL is not set in .env.local");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set in .env.local");
  return { url, key };
}

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!client) {
    const { url, key } = readEnv();
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** A database error as one line: message and code only, never the request. */
export function describeError(e: { message?: string; code?: string; details?: string | null } | null | undefined): string {
  if (!e) return "unknown error";
  return [e.message, e.code ? `(code ${e.code})` : "", e.details ? `: ${e.details}` : ""].filter(Boolean).join(" ");
}
