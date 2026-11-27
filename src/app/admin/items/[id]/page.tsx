import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ItemView } from "@/components/admin/views";
import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_PATH, isUuid, kindFrom } from "@/lib/admin/paths";
import { itemOf } from "@/lib/admin/record";
import { signOut } from "../../actions";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const email = await requireAdmin();
  const { id } = await params;
  const kind = kindFrom((await searchParams).kind);
  if (!isUuid(id)) notFound();
  // An item of the other kind is not found here: the kinds never appear together.
  const record = await itemOf(kind, id);
  if (!record) notFound();
  return (
    <AdminShell email={email} kind={kind} section="item" switchPath={ADMIN_PATH} signOutAction={signOut}>
      <ItemView kind={kind} record={record} />
    </AdminShell>
  );
}
