// Timeline helpers: trips grouped by year (newest first), the notes a trip
// shows beside its photos, and the span the impact figure states.

import type { Trip } from "@/content/schema";
import { collapse } from "./verbatim";

export function byYear(trips: readonly Trip[]): { year: number; trips: Trip[] }[] {
  const years = [...new Set(trips.map((t) => t.year))].sort((a, b) => b - a);
  return years.map((year) => ({ year, trips: trips.filter((t) => t.year === year) }));
}

/** Notes not already shown as the caption of one of the trip's photos. */
export function visibleNotes(trip: Trip): string[] {
  const captions = trip.photos.map((p) => collapse(p.caption ?? "")).filter(Boolean);
  return trip.notes.filter((n) => !captions.some((c) => c.includes(collapse(n))));
}

export function tripSpan(trips: readonly Trip[]): { count: number; first: number; last: number } {
  const years = trips.map((t) => t.year);
  return { count: trips.length, first: Math.min(...years), last: Math.max(...years) };
}
