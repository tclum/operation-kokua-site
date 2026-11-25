import Link from "next/link";
import { site } from "@/content/site";
import { ROUTES, type RoutePath } from "@/lib/routes";

/** Every page: skip link, header with the five links, main, footer. */
export function PageShell({ current, children }: { current: RoutePath | null; children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <header className="border-b border-ink/10 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
          <Link href="/" className="font-serif text-[22px] font-semibold text-teal no-underline">
            {site.name}
          </Link>
          <nav aria-label="Main">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {ROUTES.map((r) => (
                <li key={r.path}>
                  <Link
                    href={r.path}
                    aria-current={r.path === current ? "page" : undefined}
                    className={`inline-block border-b-2 py-1 text-ink no-underline hover:border-teal ${
                      r.path === current ? "border-clay" : "border-transparent"
                    }`}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <footer className="on-ink bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-[1fr_auto] sm:px-6">
          <div>
            <p className="font-serif text-[20px] font-semibold">{site.name}</p>
            <p className="mt-2 max-w-xl text-teal-soft">{site.legal.text}</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {ROUTES.map((r) => (
                <li key={r.path}>
                  <Link href={r.path} className="text-paper underline decoration-paper/40 hover:decoration-paper">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}

/** A page's title block on paper: the one h1, with an optional lead. */
export function PageHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
      <h1 className="text-[40px] font-semibold text-teal sm:text-[52px]">{title}</h1>
      <div aria-hidden="true" className="mt-4 h-[3px] w-16 bg-clay" />
      {children}
    </div>
  );
}
