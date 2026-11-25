import type { Trip } from "@/content/schema";
import { visibleNotes } from "@/lib/timeline";
import { Figure } from "./Photo";

/** One trip, anchored at /timeline#<slug>: title, place, hospitals, notes, photos. */
export function TripSection({ trip }: { trip: Trip }) {
  const notes = visibleNotes(trip);
  return (
    <section id={trip.slug} data-trip={trip.slug} aria-labelledby={`${trip.slug}-title`} className="border-t border-ink/15 pt-8">
      <h3 id={`${trip.slug}-title`} className="text-[26px] font-semibold text-teal sm:text-[30px]">
        <a href={`#${trip.slug}`} className="no-underline hover:underline">
          {trip.title}
        </a>
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[16px]">
        <dt className="text-stone">Place</dt>
        <dd>
          {trip.city}, {trip.country}
        </dd>
        {trip.hospitals.length > 0 ? (
          <>
            <dt className="text-stone">{trip.hospitals.length === 1 ? "Hospital" : "Hospitals"}</dt>
            <dd>{trip.hospitals.join("; ")}</dd>
          </>
        ) : null}
      </dl>
      {notes.length > 0 ? (
        <div className="mt-4 max-w-2xl space-y-2">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}
      {trip.photos.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {trip.photos.map((p) => (
            <Figure key={p.file} photo={p} sizes="(min-width: 1152px) 420px, (min-width: 640px) 45vw, 100vw" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
