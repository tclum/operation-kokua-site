import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { PageHeading, PageShell } from "@/components/PageShell";
import { photos } from "@/content/photos";
import { pageTitle } from "@/lib/routes";

export const metadata: Metadata = { title: pageTitle("/work") };

export default function WorkPage() {
  return (
    <PageShell current="/work">
      <PageHeading title="Work" />
      <section aria-labelledby="teaching" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h2 id="teaching" className="text-[30px] font-semibold text-teal sm:text-[36px]">
          Teaching
        </h2>
        <div className="mt-6">
          <Gallery id="teaching" photos={photos.teaching} label="Teaching photos" />
        </div>
      </section>
      <section aria-labelledby="donations" className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <h2 id="donations" className="text-[30px] font-semibold text-teal sm:text-[36px]">
          Donations
        </h2>
        <div className="mt-6">
          <Gallery id="donations" photos={photos.donations} label="Donation photos" />
        </div>
      </section>
      <GalleryLightbox />
    </PageShell>
  );
}
