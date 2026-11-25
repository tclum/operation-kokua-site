import type { Metadata } from "next";
import { PageHeading, PageShell } from "@/components/PageShell";
import { Photo } from "@/components/Photo";
import { people } from "@/content/people";
import { photos } from "@/content/photos";
import { site } from "@/content/site";
import { IRS_LETTER_PATH, pageTitle } from "@/lib/routes";

export const metadata: Metadata = { title: pageTitle("/about") };

/** The Press banner's widest laid-out size, in CSS pixels. */
const PRESS_MAX_WIDTH = 640;

const h2 = "text-[30px] font-semibold text-teal sm:text-[36px]";

export default function AboutPage() {
  return (
    <PageShell current="/about">
      <PageHeading title="About" />
      <div className="mx-auto max-w-6xl space-y-14 px-4 pb-16 pt-4 sm:px-6">
        <section aria-labelledby="mission">
          <h2 id="mission" className={h2}>
            Mission
          </h2>
          <p className="mt-4 max-w-3xl font-serif text-[24px] leading-snug sm:text-[28px]">{site.mission.text}</p>
        </section>

        <div className="grid gap-14 sm:grid-cols-2">
          <section aria-labelledby="executives">
            <h2 id="executives" className={h2}>
              Executives
            </h2>
            <dl className="mt-4 space-y-3">
              {people.executives.map((p) => (
                <div key={p.role}>
                  <dt className="text-[16px] text-stone">{p.role}</dt>
                  <dd>{p.name}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="board">
            <h2 id="board" className={h2}>
              Board of Directors
            </h2>
            <ul className="mt-4 space-y-2">
              {people.board.map((p) => (
                <li key={p.name}>{p.name}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="documents" className="bg-teal-soft p-6 sm:p-8">
          <h2 id="documents" className={h2}>
            Documents
          </h2>
          <p className="mt-4">{site.legal.text}</p>
          <p className="mt-2">
            <a href={IRS_LETTER_PATH} className="font-semibold text-teal">
              IRS determination letter (PDF)
            </a>
          </p>
        </section>

        <section aria-labelledby="press">
          <h2 id="press" className={h2}>
            Press
          </h2>
          <div className="mt-6">
            {/* A photo in a section, not a page-wide banner: 640 pixels at most on every screen. */}
            <Photo photo={photos.press} maxWidth={PRESS_MAX_WIDTH} sizes={`(min-width: 672px) ${PRESS_MAX_WIDTH}px, 100vw`} />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
