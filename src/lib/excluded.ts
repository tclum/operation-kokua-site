// Photos left out of the site (slice 1 brief, step 5). They show patients,
// surgery in progress, children, or a person's private contact details, and
// David has not confirmed consent; the last three are also under 600 pixels on
// their long side. Tim decides at a gate whether any return; until then a test
// keeps every one of them out of public/images/ and src/content/.

export const EXCLUDED_PHOTO_IDS = [
  "8488644",
  "2690840",
  "2941555",
  "4970086",
  "3402989",
  "5354987",
  "5320735",
  "4067775",
  "4942639",
  "1387005847",
  "9451655",
  "1678003",
  "3799347",
  "159885",
  "2789932", // a newspaper scan
  "4357147", // a person lying on a table being examined in front of a class
  // Under 600 pixels on the long side.
  "5673472",
  "7756280",
  "1397198920",
] as const;

/** The old site's photo id in a file name: `3649891_orig.jpg`, `photo-3649891-640.jpg` and `3649891.jpg` all give `3649891`. */
export function photoId(file: string): string | null {
  return /(?:^|[^0-9])(\d{6,10})(?=[^0-9]|$)/.exec(file.split("/").pop() ?? "")?.[1] ?? null;
}

export function isExcluded(file: string): boolean {
  const id = photoId(file);
  return id !== null && (EXCLUDED_PHOTO_IDS as readonly string[]).includes(id);
}
