import { LINK_FAILED, SIGN_IN_SENT } from "@/lib/admin/paths";

/** /admin/sign-in: one email field, or, after a request, the one sentence every address gets. */
export function SignInView({
  state,
  action,
}: {
  state: "form" | "sent" | "link-failed";
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 pb-16 pt-16 sm:px-6">
      <p className="font-serif text-[20px] font-semibold text-teal">Operation Kokua record</p>
      <h1 className="mt-6 text-[34px] font-semibold text-teal">Sign in</h1>
      <div aria-hidden="true" className="mt-3 h-[3px] w-16 bg-clay" />
      {state === "sent" ? (
        <p role="status" className="mt-8">
          {SIGN_IN_SENT}
        </p>
      ) : (
        <>
          {state === "link-failed" ? (
            <p role="alert" className="mt-8 rounded bg-teal-soft px-4 py-3">
              {LINK_FAILED}
            </p>
          ) : null}
          <p className="mt-8 text-stone">Enter your email address to get a sign-in link.</p>
          <form action={action} className="mt-6">
            <label htmlFor="email" className="block font-semibold">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded border border-ink/30 bg-paper px-3 py-2"
            />
            <button type="submit" className="mt-4 rounded bg-teal px-5 py-2 font-semibold text-paper">
              Email me a link
            </button>
          </form>
        </>
      )}
    </main>
  );
}
