// The one indexing switch. The site is indexable only when SITE_INDEXABLE is
// exactly "true". Anything else, including unset, keeps it noindex.
// Read at build time (layout metadata and next.config.ts headers), so a
// change needs a rebuild.
export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_INDEXABLE === "true";
}
