import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Photo } from "@/components/Photo";
import { homePhotos } from "@/content/photos";
import { site } from "@/content/site";
import { trips } from "@/content/trips";

const recent = trips.slice(0, 3);

export default function Home() {
  return (
    <PageShell current="/">
      {/* Typographic hero on ink: the source photos are too small to run full-bleed. */}
      <section aria-labelledby="home-title" className="on-ink bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 id="home-title" className="text-[20px] font-semibold uppercase tracking-[0.14em] text-teal-soft">
            {site.name}
          </h1>
          <p className="mt-6 max-w-4xl font-serif text-[36px] leading-[1.15] sm:text-[52px] lg:text-[60px]">{site.headline.text}</p>
          <p className="mt-8 max-w-2xl text-[18px] text-teal-soft sm:text-[20px]">{site.mission.text}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/work" className="rounded bg-paper px-6 py-3 font-semibold text-ink no-underline hover:bg-teal-soft">
              See the work
            </Link>
            <Link href="/give" className="rounded border-2 border-paper px-6 py-[10px] font-semibold text-paper no-underline hover:bg-paper hover:text-ink">
              Give
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="origin-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 id="origin-title" className="text-[30px] font-semibold text-teal sm:text-[36px]">
              How it began
            </h2>
            <div aria-hidden="true" className="mt-4 h-[3px] w-16 bg-clay" />
            <p className="mt-6 text-[19px] sm:text-[20px]">{site.origin.text}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {homePhotos.map((p, i) => (
              <Photo key={p.file} photo={p} sizes="(min-width: 1152px) 330px, (min-width: 640px) 45vw, 100vw" priority={i === 0} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="impact-title" className="bg-teal-soft">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="impact-title" className="text-[30px] font-semibold text-teal sm:text-[36px]">
            The work so far
          </h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-3">
            {site.impact.map((f) => (
              <div key={f.value} className="border-t-[3px] border-clay pt-4">
                <dt className="font-serif text-[36px] font-semibold leading-tight text-clay sm:text-[40px]">{f.value}</dt>
                <dd className="mt-1 text-ink">{f.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="recent-title" className="text-[30px] font-semibold text-teal sm:text-[36px]">
          Recent trips
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {recent.map((t) => {
            const line = t.notes[0];
            return (
              <li key={t.slug} className="border-t border-ink/20 pt-4">
                <h3 className="text-[22px] font-semibold">
                  <Link href={`/timeline#${t.slug}`} className="text-teal">
                    {t.title}
                  </Link>
                </h3>
                {line ? <p className="mt-2 text-stone">{line}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-8">
          <Link href="/timeline" className="font-semibold text-teal">
            The full timeline
          </Link>
        </p>
      </section>

      <section aria-label="Closing" className="border-t border-ink/10">
        <p className="mx-auto max-w-6xl px-4 py-16 font-serif text-[30px] text-teal sm:px-6 sm:text-[40px]">{site.closing.text}</p>
      </section>
    </PageShell>
  );
}
