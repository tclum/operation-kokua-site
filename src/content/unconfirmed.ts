// Every item on the site that is not published by the organization itself:
// what David told Tim (david-unconfirmed) and what comes from IRS listings
// (public-record). docs/project-state.md lists the same items under Open
// questions (a test holds the two together). While this list is non-empty,
// SITE_INDEXABLE=true fails the build (src/lib/launch-gate.ts).

import type { UnconfirmedItem } from "../lib/launch-gate";
import { people } from "./people";
import { photos } from "./photos";
import { site } from "./site";
import { trips } from "./trips";

/** Every node under `node` with a basis other than old-site, as { label, basis }. */
export function collectUnconfirmed(node: unknown): UnconfirmedItem[] {
  if (Array.isArray(node)) return node.flatMap(collectUnconfirmed);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const here =
      typeof obj.basis === "string" && obj.basis !== "old-site"
        ? [{ label: String(obj.label ?? "(unlabelled)"), basis: obj.basis }]
        : [];
    return [...here, ...Object.values(obj).flatMap(collectUnconfirmed)];
  }
  return [];
}

export const unconfirmed: readonly UnconfirmedItem[] = collectUnconfirmed({ site, people, trips, photos });
