import type { Metadata } from "next";
import { PageHeading, PageShell } from "@/components/PageShell";
import { TripSection } from "@/components/TripSection";
import { site } from "@/content/site";
import { trips } from "@/content/trips";
import { pageTitle } from "@/lib/routes";
import { byYear } from "@/lib/timeline";

export const metadata: Metadata = { title: pageTitle("/timeline") };

const years = byYear(trips);

export default function TimelinePage() {
  return (
    <PageShell current="/timeline">
      <PageHeading title="Timeline">
        <p className="mt-6 max-w-2xl text-[19px]">{site.timeline.heading.text}</p>
      </PageHeading>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[8rem_minmax(0,1fr)]">
        {/* The year rail, on wide screens. */}
        <nav aria-label="Years" className="hidden lg:block">
          <ol className="sticky top-6 space-y-2 border-l-2 border-ink/15">
            {years.map(({ year }) => (
              <li key={year}>
                <a href={`#year-${year}`} className="-ml-[2px] block border-l-2 border-transparent pl-4 font-serif text-[20px] text-teal no-underline hover:border-clay">
                  {year}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="space-y-14">
          {years.map(({ year, trips: ts }) => (
            <section key={year} id={`year-${year}`} data-year={year} aria-labelledby={`year-${year}-title`}>
              <h2 id={`year-${year}-title`} className="font-serif text-[44px] font-semibold text-clay">
                {year}
              </h2>
              <div className="mt-6 space-y-12">
                {ts.map((t) => (
                  <TripSection key={t.slug} trip={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
