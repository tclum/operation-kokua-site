// Exempt from requireAdmin(): this is the way in. It reads nothing from the record.

import { SignInView } from "@/components/admin/SignInView";
import { signIn } from "./actions";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = sp.sent === "1" ? "sent" : sp.error === "link" ? "link-failed" : "form";
  return <SignInView state={state} action={signIn} />;
}
