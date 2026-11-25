// The old-site copy check: every string marked `old-site` in src/content/
// must appear in the outline of the old site (test/fixtures/weebly-outline.md)
// once whitespace is collapsed on both sides. Zero-width spaces, which the old
// Weebly pages carry, count as whitespace.

export function collapse(text: string): string {
  return text.replace(/[​ ]/g, " ").replace(/\s+/g, " ").trim();
}

// Keys that hold our own data rather than published copy: identifiers, file
// names, alt text we wrote, and the basis marker itself.
const NOT_COPY = new Set(["basis", "slug", "file", "alt", "label", "id", "href", "oldPage", "derivedFrom"]);

/**
 * Every string under a node whose `basis` is "old-site" (the basis applies to
 * the whole node and what it holds), as [path, text].
 */
export function oldSiteStrings(node: unknown, path = "", inherited = false): [string, string][] {
  if (Array.isArray(node)) return node.flatMap((v, i) => oldSiteStrings(v, `${path}[${i}]`, inherited));
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    // Computed from other content (the trip figure); its own test holds it.
    if (obj.derivedFrom !== undefined) return [];
    const basis = typeof obj.basis === "string" ? obj.basis : undefined;
    const own = basis === undefined ? inherited : basis === "old-site";
    return Object.entries(obj).flatMap(([k, v]) => {
      if (NOT_COPY.has(k)) return [];
      if (typeof v === "string") return own ? [[`${path}.${k}`, v] as [string, string]] : [];
      return oldSiteStrings(v, `${path}.${k}`, own);
    });
  }
  return [];
}

/** The old-site strings that do not appear in the outline, as "path: text". */
export function notInOutline(content: unknown, outline: string): string[] {
  const haystack = collapse(outline);
  return oldSiteStrings(content)
    .filter(([, text]) => !haystack.includes(collapse(text)))
    .map(([p, text]) => `${p}: ${text}`);
}
