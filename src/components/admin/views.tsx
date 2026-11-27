// The record view's pages as plain components over data passed in. They read
// nothing themselves: the pages under src/app/admin call requireAdmin(), read
// through src/lib/admin/record.ts, and hand the results here. Server
// components only; tables and plain text.

import Link from "next/link";
import { basisLabel, dateWithPrecision, orNotGiven, rawValue, usd } from "@/lib/admin/format";
import { HANDOVERS_PATH, itemPath, type Kind } from "@/lib/admin/paths";
import {
  type BasisTotal,
  type BatchSummary,
  type HandoverFact,
  type HandoverFilters,
  HANDOVERS_PER_PAGE,
  type ItemRecord,
  type KindCounts,
  type RecipientOption,
  type TripOption,
} from "@/lib/admin/types";
import { TABLE, TD, TH } from "./AdminShell";

const withKind = (href: string, kind: Kind) => (kind === "real" ? href : `${href}${href.includes("?") ? "&" : "?"}kind=synthetic`);

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[34px] font-semibold text-teal sm:text-[40px]">{children}</h1>
      <div aria-hidden="true" className="mt-3 h-[3px] w-16 bg-clay" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[24px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

// ---------- /admin ----------

export function OverviewView({
  kind,
  batches,
  totals,
  counts,
}: {
  kind: Kind;
  batches: BatchSummary[];
  totals: BasisTotal[];
  counts: KindCounts;
}) {
  return (
    <>
      <Heading>Overview: {kind}</Heading>

      {kind === "real" && counts.items === 0 ? (
        <p data-empty-state="" className="mb-10 max-w-3xl rounded bg-teal-soft px-4 py-3">
          There are no items in the record yet. The {counts.trips} trips and {counts.recipients} hospitals from the old site are recorded.
        </p>
      ) : null}

      <Section title="Counts">
        <dl className="grid max-w-3xl grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
          {(
            [
              ["Items", counts.items],
              ["Handovers", counts.handovers],
              ["Recipients", counts.recipients],
              ["Countries", counts.countries],
            ] as const
          ).map(([label, n]) => (
            <div key={label}>
              <dt className="text-stone">{label}</dt>
              <dd className="font-serif text-[28px] font-semibold">{n}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Totals by valuation basis">
        <p className="mb-3 max-w-3xl text-stone">One figure per basis. Bases are different measures and are never added together.</p>
        {totals.length === 0 ? (
          <p>No valued handovers yet.</p>
        ) : (
          <Scroll>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Basis</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Handovers</th>
                  <th className={`${TH} text-right`}>Units</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <tr key={t.basis}>
                    <td className={TD}>{basisLabel(t.basis)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{usd(t.amount_usd)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.handovers}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>

      <Section title="Batches">
        {batches.length === 0 ? (
          <p>No batches of this kind.</p>
        ) : (
          <Scroll>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Label</th>
                  <th className={TH}>File</th>
                  <th className={TH}>Received from</th>
                  <th className={TH}>Received on</th>
                  <th className={`${TH} text-right`}>Rows</th>
                  <th className={`${TH} text-right`}>Trips</th>
                  <th className={`${TH} text-right`}>Recipients</th>
                  <th className={`${TH} text-right`}>Items</th>
                  <th className={`${TH} text-right`}>Handovers</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className={TD}>{b.label}</td>
                    <td className={TD}>{orNotGiven(b.source_filename)}</td>
                    <td className={TD}>{orNotGiven(b.received_from)}</td>
                    <td className={TD}>{orNotGiven(b.received_on)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{b.counts.import_rows}</td>
                    <td className={`${TD} text-right tabular-nums`}>{b.counts.trips}</td>
                    <td className={`${TD} text-right tabular-nums`}>{b.counts.recipients}</td>
                    <td className={`${TD} text-right tabular-nums`}>{b.counts.items}</td>
                    <td className={`${TD} text-right tabular-nums`}>{b.counts.handovers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>
    </>
  );
}

// ---------- /admin/handovers ----------

export function HandoversView({
  kind,
  rows,
  total,
  page,
  filters,
  countries,
  recipients,
  trips,
}: {
  kind: Kind;
  rows: HandoverFact[];
  total: number;
  page: number;
  filters: HandoverFilters;
  countries: string[];
  recipients: RecipientOption[];
  trips: TripOption[];
}) {
  const pages = Math.max(1, Math.ceil(total / HANDOVERS_PER_PAGE));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (kind === "synthetic") q.set("kind", "synthetic");
    if (filters.country) q.set("country", filters.country);
    if (filters.recipient) q.set("recipient", filters.recipient);
    if (filters.trip) q.set("trip", filters.trip);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${HANDOVERS_PATH}?${s}` : HANDOVERS_PATH;
  };
  const select = "mt-1 block w-full max-w-xs rounded border border-ink/30 bg-paper px-2 py-1";
  return (
    <>
      <Heading>Handovers: {kind}</Heading>

      <form method="get" action={HANDOVERS_PATH} className="mb-6 flex flex-wrap items-end gap-4">
        {kind === "synthetic" ? <input type="hidden" name="kind" value="synthetic" /> : null}
        <label className="block">
          Country
          <select name="country" defaultValue={filters.country ?? ""} className={select}>
            <option value="">All</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Recipient
          <select name="recipient" defaultValue={filters.recipient ?? ""} className={select}>
            <option value="">All</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.department ? ` (${r.department})` : ""}
                {r.city ? `, ${r.city}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Trip
          <select name="trip" defaultValue={filters.trip ?? ""} className={select}>
            <option value="">All</option>
            {trips.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-teal px-4 py-1.5 text-paper">
          Filter
        </button>
        <Link href={withKind(HANDOVERS_PATH, kind)} className="py-1.5 text-teal">
          Clear
        </Link>
      </form>

      <p className="mb-3 text-stone">
        {total === 0 ? "No handovers match." : `${total} handover${total === 1 ? "" : "s"}; page ${page} of ${pages}.`}
      </p>

      {rows.length > 0 ? (
        <Scroll>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Item</th>
                <th className={`${TH} text-right`}>Quantity</th>
                <th className={TH}>Recipient</th>
                <th className={TH}>City</th>
                <th className={TH}>Country</th>
                <th className={TH}>Trip</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.handover_id}>
                  <td className={`${TD} whitespace-nowrap`}>{dateWithPrecision(h.handed_on, h.date_precision)}</td>
                  <td className={TD}>
                    <Link href={withKind(itemPath(h.item_id), kind)} className="text-teal">
                      {h.description}
                    </Link>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{h.handed_quantity}</td>
                  <td className={TD}>{h.recipient_name}</td>
                  <td className={TD}>{orNotGiven(h.recipient_city)}</td>
                  <td className={TD}>{h.recipient_country}</td>
                  <td className={TD}>{orNotGiven(h.trip_slug)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : null}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex gap-6">
          {page > 1 ? (
            <Link href={href(page - 1)} className="text-teal">
              Previous 50
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={href(page + 1)} className="text-teal">
              Next 50
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

// ---------- /admin/items/[id] ----------

function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid max-w-3xl grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-stone">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ItemView({ kind, record }: { kind: Kind; record: ItemRecord }) {
  const { item, valuations, handovers, followups, raw } = record;
  return (
    <>
      <Heading>{item.description}</Heading>

      <Section title="Item">
        <KeyValues
          rows={[
            ["Category", orNotGiven(item.category)],
            ["Manufacturer", orNotGiven(item.manufacturer)],
            ["Model", orNotGiven(item.model)],
            ["Serial number", orNotGiven(item.serial_number)],
            ["Quantity", item.quantity],
            ["Condition", item.condition],
            ["Year made", orNotGiven(item.year_made)],
            ["Source", orNotGiven(item.source_name)],
            ["Batch", item.batch_label],
            ["Note", orNotGiven(item.note)],
          ]}
        />
      </Section>

      <Section title="Valuations">
        {valuations.length === 0 ? (
          <p>No valuations.</p>
        ) : (
          <Scroll>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Basis</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH}>Per</th>
                  <th className={TH}>Method</th>
                  <th className={TH}>Valued on</th>
                  <th className={TH}>Valued by</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((v) => (
                  <tr key={v.basis}>
                    <td className={TD}>{basisLabel(v.basis)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{usd(v.amount_usd)}</td>
                    <td className={TD}>{v.per}</td>
                    <td className={TD}>{orNotGiven(v.method_note)}</td>
                    <td className={TD}>{orNotGiven(v.valued_on)}</td>
                    <td className={TD}>{orNotGiven(v.valued_by)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>

      <Section title="Handovers">
        {handovers.length === 0 ? (
          <p>No handovers.</p>
        ) : (
          <Scroll>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={`${TH} text-right`}>Quantity</th>
                  <th className={TH}>Recipient</th>
                  <th className={TH}>City</th>
                  <th className={TH}>Country</th>
                  <th className={TH}>Trip</th>
                </tr>
              </thead>
              <tbody>
                {handovers.map((h) => (
                  <tr key={h.handover_id}>
                    <td className={`${TD} whitespace-nowrap`}>{dateWithPrecision(h.handed_on, h.date_precision)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{h.handed_quantity}</td>
                    <td className={TD}>{h.recipient_name}</td>
                    <td className={TD}>{orNotGiven(h.recipient_city)}</td>
                    <td className={TD}>{h.recipient_country}</td>
                    <td className={TD}>{orNotGiven(h.trip_slug)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>

      <Section title="Followups">
        {followups.length === 0 ? (
          <p>No followups.</p>
        ) : (
          <Scroll>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Checked on</th>
                  <th className={TH}>In service</th>
                  <th className={TH}>Checked by</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((f, i) => (
                  <tr key={`${f.handover_id}-${i}`}>
                    <td className={TD}>{f.checked_on}</td>
                    <td className={TD}>{f.in_service === null ? "Unknown" : f.in_service ? "Yes" : "No"}</td>
                    <td className={TD}>{orNotGiven(f.checked_by)}</td>
                    <td className={TD}>{orNotGiven(f.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Section>

      <Section title="Workbook row">
        {raw ? (
          <>
            <p className="mb-3 text-stone">
              Sheet {raw.sheet}, row {raw.row_number}, exactly as imported.
            </p>
            <KeyValues rows={Object.entries(raw.raw).map(([k, v]) => [k, rawValue(v)])} />
          </>
        ) : (
          <p>No workbook row is linked to this item.</p>
        )}
      </Section>

      <p>
        <Link href={withKind(HANDOVERS_PATH, kind)} className="text-teal">
          All handovers
        </Link>
      </p>
    </>
  );
}
