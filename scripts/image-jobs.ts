// What `pnpm images` builds. Every file in public/images/ comes from one job
// below, and public/docs/irs-approval-letter.pdf from the one copy job. Pure
// data, so tests can list the expected outputs without sharp. The builder is
// scripts/images.ts. The only input is `source/weebly/` (the mirror of the old
// site, gitignored and read-only).
//
// The photo jobs follow from the content: every photo named in src/content/
// (trips, galleries, press) is built, and nothing else.

import path from "node:path";
import { photos } from "../src/content/photos";
import type { Photo } from "../src/content/schema";
import { trips } from "../src/content/trips";
import { builtWidths, photoFile } from "../src/lib/photo-files";

const ROOT = path.resolve(__dirname, "..");
export const UPLOADS_DIR = path.join(ROOT, "source/weebly/uploads");
export const MANIFEST = path.join(ROOT, "source/weebly/manifest.tsv");
export const OUT_DIR = path.join(ROOT, "public/images");
export const DOCS_OUT_DIR = path.join(ROOT, "public/docs");

export type Job = {
  /** The upload's file name, as the outline names it. */
  file: string;
  source: string;
  /** Where the photo appears on this site and on the old site. */
  usedOn: string[];
  sizes: number[];
  outputs: string[];
  quality: number;
};

/** Every content photo with where it is used, in content order, one job per file. */
function contentPhotos(): { photo: Photo; usedOn: string }[] {
  return [
    ...trips.flatMap((t) => t.photos.map((photo) => ({ photo, usedOn: `/timeline#${t.slug} (old page ${t.oldPage})` }))),
    ...photos.teaching.map((photo) => ({ photo, usedOn: "/work Teaching (old page teaching)" })),
    ...photos.donations.map((photo) => ({ photo, usedOn: "/work Donations (old page our-donations or school-donations)" })),
    { photo: photos.press, usedOn: "/about Press (old page press)" },
  ];
}

export const jobs: Job[] = (() => {
  const byFile = new Map<string, Job>();
  for (const { photo, usedOn } of contentPhotos()) {
    const existing = byFile.get(photo.file);
    if (existing) {
      if (!existing.usedOn.includes(usedOn)) existing.usedOn.push(usedOn);
      continue;
    }
    const sizes = builtWidths(photo.width);
    byFile.set(photo.file, {
      file: photo.file,
      source: path.join(UPLOADS_DIR, photo.file),
      usedOn: [usedOn],
      sizes,
      outputs: sizes.map((w) => photoFile(photo.file, w)),
      quality: 82,
    });
  }
  return [...byFile.values()];
})();

/** The named copy job: the IRS determination letter, linked from /about. */
export const irsLetterJob = {
  name: "irs-letter",
  source: path.join(UPLOADS_DIR, "irs_approval_letter.pdf"),
  output: path.join(DOCS_OUT_DIR, "irs-approval-letter.pdf"),
} as const;

/** Every file name the jobs write into public/images/. */
export function expectedOutputs(): string[] {
  return jobs.flatMap((job) => job.outputs);
}
