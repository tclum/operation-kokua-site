// Old-site text held back: kept word for word, rendered nowhere. Each line is
// tied to the photo ids the old page paired it with. The Teaching lines are the
// captions of two excluded photos (src/lib/excluded.ts) and return with them.
// The Donations line sat beside a whole column of photos, not one, so it
// captions none of them and waits for David to say which it describes.
// A test keeps this file out of every page and component.

import { z } from "zod";

const Held = z
  .object({
    text: z.string().min(1),
    basis: z.literal("old-site"),
    oldPage: z.string().min(1),
    /** The old site's ids of the photos the page paired this text with. */
    photoIds: z.array(z.string().regex(/^\d{6,10}$/)).min(1),
  })
  .strict();

export const held = z.array(Held).parse([
  {
    text: "Dr Santi teaching at Cho Ray Hospital, Saigon.",
    basis: "old-site",
    oldPage: "teaching",
    photoIds: ["8488644"], // excluded; returns with it
  },
  {
    text: "Teaching Rounds at Hospital 108 in Hanoi.",
    basis: "old-site",
    oldPage: "teaching",
    photoIds: ["2690840"], // excluded; returns with it
  },
  {
    text: "Battery-powered drill donations to Cho Ray Hospital",
    basis: "old-site",
    oldPage: "our-donations",
    // The right-hand column of one two-column row; the left column holds these 16 photos.
    photoIds: [
      "4197056",
      "2038728",
      "6499061",
      "5354987",
      "5662593",
      "3649891",
      "2013587",
      "1383809",
      "5673472",
      "5587144",
      "7458924",
      "2524133",
      "2280998",
      "9514001",
      "5320735",
      "7773461",
    ],
  },
]);
