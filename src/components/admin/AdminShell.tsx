import Link from "next/link";
import { ADMIN_PATH, HANDOVERS_PATH, type Kind, SAMPLE_BAND } from "@/lib/admin/paths";

export type AdminSection = "overview" | "handovers" | "item";

/** Every signed-in admin page: the SAMPLE band when synthetic, a header with the kind switch and sign-out, then the page. */
export function AdminShell({
  email,
  kind,
  section,
  switchPath,
  signOutAction,
  children,
}: {
  email: string;
  kind: Kind;
  section: AdminSection;
  /** Where the kind switch links to (the same page, or /admin from an item). */
  switchPath: string;
  signOutAction: (formData: FormData) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const withKind = (p: string, k: Kind) => (k === "real" ? p : `${p}?kind=synthetic`);
  const nav: { key: AdminSection; label: string; href: string }[] = [
    { key: "overview", label: "Overview", href: withKind(ADMIN_PATH, kind) },
    { key: "handovers", label: "Handovers", href: withKind(HANDOVERS_PATH, kind) },
  ];
  return (
    <>
      {kind === "synthetic" ? (
        <div data-sample-band="" role="status" className="sticky top-0 z-50 bg-clay px-4 py-2 text-center font-semibold tracking-wide text-paper">
          {SAMPLE_BAND}
        </div>
      ) : null}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <header className="border-b border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="font-serif text-[20px] font-semibold text-teal">Operation Kokua record</span>
            <nav aria-label="Record">
              <ul className="flex gap-x-5">
                {nav.map((n) => (
                  <li key={n.key}>
                    <Link
                      href={n.href}
                      aria-current={n.key === section ? "page" : undefined}
                      className={`inline-block border-b-2 py-1 text-ink no-underline hover:border-teal ${n.key === section ? "border-clay" : "border-transparent"}`}
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <nav aria-label="Kind" className="flex items-center gap-2">
              <span className="text-stone">Showing</span>
              {(["real", "synthetic"] as const).map((k) => (
                <Link
                  key={k}
                  href={withKind(switchPath, k)}
                  aria-current={k === kind ? "true" : undefined}
                  className={`rounded px-2 py-0.5 no-underline ${k === kind ? "bg-teal text-paper" : "text-teal underline"}`}
                >
                  {k}
                </Link>
              ))}
            </nav>
            <span className="text-stone">{email}</span>
            <form action={signOutAction}>
              <button type="submit" className="rounded border border-teal px-3 py-1 text-teal hover:bg-teal-soft">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-16 pt-8 focus:outline-none sm:px-6">
        {children}
      </main>
    </>
  );
}

/** Plain table styling shared by the admin views. */
export const TABLE = "w-full border-collapse text-left text-[15px]";
export const TH = "border-b-2 border-ink/20 px-2 py-2 align-bottom font-semibold";
export const TD = "border-b border-ink/10 px-2 py-2 align-top";
