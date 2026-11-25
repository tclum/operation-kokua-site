// The content model. Every fact carries a `basis`:
//   old-site           published by Operation Kokua on operationkokua.weebly.com
//                      (word for word; checked against test/fixtures/weebly-outline.md)
//   public-record      from IRS listings
//   david-unconfirmed  told to Tim by David Mathews, not yet checked
// The page renders all three the same. Every item that is not `old-site`
// carries a `label` naming it, and src/content/unconfirmed.ts lists them: the
// launch gate keeps the site noindex until that list is empty.
//
// A `derivedFrom` marker says a string is computed from other content (the
// trip count from trips.ts); a test holds it to its source instead of the
// outline.

import { z } from "zod";

export const Basis = z.enum(["old-site", "public-record", "david-unconfirmed"]);
export type Basis = z.infer<typeof Basis>;

const labelled = <T extends { basis: Basis; label?: string }>(v: T) => v.basis === "old-site" || !!v.label;
const LABEL_MSG = { message: "an item that is not old-site needs a label (it is listed in unconfirmed.ts)" };

export const Text = z
  .object({ text: z.string().min(1), basis: Basis, label: z.string().optional() })
  .strict()
  .refine(labelled, LABEL_MSG);
export type Text = z.infer<typeof Text>;

export const Figure = z
  .object({
    value: z.string().min(1),
    detail: z.string().min(1),
    basis: Basis,
    label: z.string().optional(),
    derivedFrom: z.literal("trips.ts").optional(),
  })
  .strict()
  .refine(labelled, LABEL_MSG);
export type Figure = z.infer<typeof Figure>;

/**
 * A photo as published on the old site. `file` is the upload the outline names
 * (the larger of a pair); `width` and `height` are that file's, from the
 * outline. `alt` is ours and describes only what is visible. `caption` is set
 * only when the old page paired that text with this one photo in one row.
 */
export const Photo = z
  .object({
    file: z.string().regex(/^\d{6,10}(_orig)?\.jpg$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    alt: z.string().min(10),
    caption: z.string().min(1).optional(),
    basis: z.literal("old-site"),
  })
  .strict();
export type Photo = z.infer<typeof Photo>;

export const Person = z
  .object({ name: z.string().min(1), role: z.string().min(1).optional(), basis: Basis, label: z.string().optional() })
  .strict()
  .refine(labelled, LABEL_MSG);
export type Person = z.infer<typeof Person>;

/**
 * One trip page of the old site. A later slice's donation record will point
 * at a trip by `slug`, so slugs never change once published.
 */
export const Trip = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** The old site's page for this trip (operationkokua.weebly.com/<oldPage>.html). */
    oldPage: z.string().min(1),
    title: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12).optional(),
    city: z.string().min(1),
    country: z.enum(["Vietnam", "Cambodia"]),
    hospitals: z.array(z.string().min(1)),
    notes: z.array(z.string().min(1)),
    photos: z.array(Photo),
    basis: z.literal("old-site"),
  })
  .strict();
export type Trip = z.infer<typeof Trip>;
