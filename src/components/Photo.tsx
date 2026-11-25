/* eslint-disable @next/next/no-img-element -- the files are pre-built at
   their real widths by `pnpm images`; a plain <img> with srcset serves them
   without next/image resizing on request. */
import type { Photo as PhotoData } from "@/content/schema";
import { photoAttrs } from "@/lib/photo-files";

/**
 * A photo at no more than its real size: the largest built file, with the
 * smaller one in srcset. `sizes` says how wide it is laid out; `maxWidth`
 * caps the laid-out width below the file's own.
 */
export function Photo({
  photo,
  sizes,
  className = "",
  priority = false,
  maxWidth,
}: {
  photo: PhotoData;
  sizes: string;
  className?: string;
  priority?: boolean;
  maxWidth?: number;
}) {
  const a = photoAttrs(photo);
  return (
    <img
      src={a.src}
      srcSet={a.srcSet}
      sizes={sizes}
      width={a.width}
      height={a.height}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`block h-auto w-full ${className}`}
      style={{ maxWidth: `${Math.min(a.width, maxWidth ?? a.width)}px` }}
    />
  );
}

/** A photo with its caption (when the old site gave it one). */
export function Figure({ photo, sizes, className = "" }: { photo: PhotoData; sizes: string; className?: string }) {
  return (
    <figure className={className}>
      <Photo photo={photo} sizes={sizes} />
      {photo.caption ? <figcaption className="mt-2 text-[16px] text-stone">{photo.caption}</figcaption> : null}
    </figure>
  );
}
