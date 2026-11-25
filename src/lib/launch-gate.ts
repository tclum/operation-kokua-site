// The launch gate. The site may be indexable only once every fact on it is
// confirmed: while src/content/unconfirmed.ts lists any item, turning
// SITE_INDEXABLE on fails the build. next.config.ts calls this at build time.

import { isIndexable } from "./indexing";

export type UnconfirmedItem = { label: string; basis: string };

export function launchGateError(
  env: Record<string, string | undefined>,
  unconfirmed: readonly UnconfirmedItem[],
): string | null {
  if (!isIndexable(env) || unconfirmed.length === 0) return null;
  const lines = unconfirmed.map((u) => `  - ${u.label} (${u.basis})`).join("\n");
  return `Launch gate: SITE_INDEXABLE=true but ${unconfirmed.length} item(s) are not yet confirmed (src/content/unconfirmed.ts):\n${lines}`;
}

/** Throws when the site would go indexable with unconfirmed facts on it. */
export function assertLaunchReady(
  env: Record<string, string | undefined>,
  unconfirmed: readonly UnconfirmedItem[],
): void {
  const error = launchGateError(env, unconfirmed);
  if (error) throw new Error(error);
}
