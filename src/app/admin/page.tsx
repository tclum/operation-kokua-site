import { AdminShell } from "@/components/admin/AdminShell";
import { OverviewView } from "@/components/admin/views";
import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_PATH, kindFrom } from "@/lib/admin/paths";
import { batchesOf, countsOf, totalsOf } from "@/lib/admin/record";
import { signOut } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const email = await requireAdmin();
  const kind = kindFrom((await searchParams).kind);
  const [batches, totals, counts] = [await batchesOf(kind), await totalsOf(kind), await countsOf(kind)];
  return (
    <AdminShell email={email} kind={kind} section="overview" switchPath={ADMIN_PATH} signOutAction={signOut}>
      <OverviewView kind={kind} batches={batches} totals={totals} counts={counts} />
    </AdminShell>
  );
}
