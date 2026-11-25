/* eslint-disable @next/next/no-img-element -- see Photo.tsx */
import type { Photo } from "@/content/schema";
import { photoAttrs } from "@/lib/photo-files";

// Target row height in pixels. Rows are justified: every tile grows in
// proportion to its photo's width/height ratio, so the photos in a row share
// one height and fill it, each shown whole and never above its real width.
const ROW_HEIGHT = 240;

/**
 * A justified-row gallery. Each tile links to the photo's largest file, so it
 * works without JavaScript; with JavaScript, GalleryLightbox opens it in a
 * dialog instead.
 */
export function Gallery({ id, photos, label }: { id: string; photos: Photo[]; label: string }) {
  return (
    <ul data-gallery={id} aria-label={label} className="flex flex-wrap gap-3">
      {photos.map((p, i) => {
        const a = photoAttrs(p);
        const ratio = p.width / p.height;
        return (
          <li
            key={p.file}
            className="min-w-0"
            style={{ flexGrow: ratio, flexBasis: `${Math.round(ratio * ROW_HEIGHT)}px`, maxWidth: `${a.width}px` }}
          >
            <figure>
              <a href={a.src} data-lightbox-index={i} className="block">
                <img
                  src={a.src}
                  srcSet={a.srcSet}
                  sizes={`(min-width: 1152px) ${Math.round(ratio * ROW_HEIGHT * 1.6)}px, 100vw`}
                  width={a.width}
                  height={a.height}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full bg-teal-soft"
                />
              </a>
              {p.caption ? <figcaption className="mt-2 text-[16px] text-stone">{p.caption}</figcaption> : null}
            </figure>
          </li>
        );
      })}
      {/* Keeps a short last row from stretching across the width. */}
      <li aria-hidden="true" className="h-0" style={{ flexGrow: 10, flexBasis: 0 }} />
    </ul>
  );
}
