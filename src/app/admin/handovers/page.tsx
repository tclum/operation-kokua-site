import { AdminShell } from "@/components/admin/AdminShell";
import { HandoversView } from "@/components/admin/views";
import { requireAdmin } from "@/lib/admin/guard";
import { HANDOVERS_PATH, isUuid, kindFrom, param } from "@/lib/admin/paths";
import { handoversOf, recipientsOf, tripsOf } from "@/lib/admin/record";
import type { HandoverFilters } from "@/lib/admin/types";
import { signOut } from "../actions";

export default async function HandoversPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const email = await requireAdmin();
  const sp = await searchParams;
  const kind = kindFrom(sp.kind);
  const recipient = param(sp.recipient);
  const filters: HandoverFilters = {
    country: param(sp.country),
    recipient: isUuid(recipient) ? recipient : undefined,
    trip: param(sp.trip),
  };
  const pageNumber = Number(param(sp.page) ?? "1");
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  const { rows, total } = await handoversOf(kind, filters, page);
  const recipients = await recipientsOf(kind);
  const trips = await tripsOf(kind);
  const countries = [...new Set(recipients.map((r) => r.country))].sort();
  return (
    <AdminShell email={email} kind={kind} section="handovers" switchPath={HANDOVERS_PATH} signOutAction={signOut}>
      <HandoversView
        kind={kind}
        rows={rows}
        total={total}
        page={page}
        filters={filters}
        countries={countries}
        recipients={recipients}
        trips={trips}
      />
    </AdminShell>
  );
}
