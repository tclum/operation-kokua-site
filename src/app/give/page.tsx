import type { Metadata } from "next";
import { PageHeading, PageShell } from "@/components/PageShell";
import { site } from "@/content/site";
import { pageTitle } from "@/lib/routes";

export const metadata: Metadata = { title: pageTitle("/give") };

const h2 = "text-[30px] font-semibold text-teal sm:text-[36px]";

// No payment control: the organization has none yet.
export default function GivePage() {
  return (
    <PageShell current="/give">
      <PageHeading title="Give">
        <p className="mt-6 max-w-3xl font-serif text-[24px] leading-snug sm:text-[28px]">{site.give.lead.text}</p>
      </PageHeading>
      <div className="mx-auto grid max-w-6xl gap-14 px-4 pb-16 pt-6 sm:px-6 md:grid-cols-2">
        <section aria-labelledby="supplies">
          <h2 id="supplies" className={h2}>
            Supplies and Equipment
          </h2>
          <p className="mt-4">{site.needs.intro.text}:</p>
          <ul className="mt-3 space-y-2">
            {site.needs.items.map((n) => (
              <li key={n.text} className="border-l-[3px] border-clay pl-4">
                {n.text}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="money">
          <h2 id="money" className={h2}>
            Money
          </h2>
          <ul className="mt-4 space-y-3">
            {site.funds.map((f) => (
              <li key={f.text} className="border-l-[3px] border-clay pl-4">
                {f.text}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="write" className="bg-teal-soft p-6 sm:p-8 md:col-span-2">
          <h2 id="write" className={h2}>
            Write to us
          </h2>
          <p className="mt-4 text-[19px]">{site.give.contact.text}</p>
        </section>
      </div>
    </PageShell>
  );
}
