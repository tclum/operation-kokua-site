"use server";

// The sign-in form's server action. Exempt from requireAdmin(): it is how an
// admin gets in. It reads nothing from the record.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestSignIn } from "@/lib/admin/sign-in";

export async function signIn(formData: FormData): Promise<void> {
  const to = await requestSignIn(formData.get("email"), await headers());
  redirect(to);
}
