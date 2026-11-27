"use server";

// The sign-out control on every admin page.

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/admin/auth";
import { requireAdmin } from "@/lib/admin/guard";
import { SIGN_IN_PATH } from "@/lib/admin/paths";

export async function signOut(): Promise<void> {
  await requireAdmin();
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
