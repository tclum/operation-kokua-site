import type { Metadata } from "next";

// Not the guard: every page below calls requireAdmin() itself. This layout
// only sets noindex (whatever SITE_INDEXABLE says) and keeps /admin dynamic.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Record | Operation Kokua",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
