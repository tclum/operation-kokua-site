import Link from "next/link";
import { PageHeading, PageShell } from "@/components/PageShell";

export default function NotFound() {
  return (
    <PageShell current={null}>
      <PageHeading title="Page not found">
        <p className="mt-6 text-[19px]">
          <Link href="/" className="font-semibold text-teal">
            Go to the home page
          </Link>
        </p>
      </PageHeading>
      <div className="pb-24" />
    </PageShell>
  );
}
