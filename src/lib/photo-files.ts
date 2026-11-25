// Built photo files. `pnpm images` writes each photo at 640 and 1100 pixels
// wide, never wider than its source, so a 640-wide original yields one file.
// Files are named by the old site's photo id: 3649891_orig.jpg builds
// /images/photo-3649891-640.jpg and /images/photo-3649891-1100.jpg.

export const TARGET_WIDTHS = [640, 1100] as const;

export function photoStem(file: string): string {
  return file.replace(/(_orig)?\.jpg$/, "");
}

/** The widths built for a source this wide, ascending, never above it. */
export function builtWidths(sourceWidth: number): number[] {
  return [...new Set(TARGET_WIDTHS.map((w) => Math.min(w, sourceWidth)))].sort((a, b) => a - b);
}

export function photoFile(file: string, width: number): string {
  return `photo-${photoStem(file)}-${width}.jpg`;
}

export function photoSrc(file: string, width: number): string {
  return `/images/${photoFile(file, width)}`;
}

/** src (the largest file), srcSet, and the displayed size for an <img>. */
export function photoAttrs(photo: { file: string; width: number; height: number }) {
  const widths = builtWidths(photo.width);
  const largest = widths[widths.length - 1];
  return {
    src: photoSrc(photo.file, largest),
    srcSet: widths.map((w) => `${photoSrc(photo.file, w)} ${w}w`).join(", "),
    width: largest,
    height: Math.round((photo.height * largest) / photo.width),
  };
}
