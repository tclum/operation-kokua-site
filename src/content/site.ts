// Site copy: the organization, the new copy from David, the impact figures,
// the needs list, the fund-use lines, the address and the legal line.
// Sources: the old site (word for word, see schema.ts), David's account to
// Tim (basis david-unconfirmed), and the IRS letter (public-record).

import { z } from "zod";
import { Figure, Text } from "./schema";

const Site = z
  .object({
    /** The organization's name, as on the IRS determination letter. */
    name: z.literal("Operation Kokua"),
    mission: Text,
    headline: Text,
    origin: Text,
    impact: z.array(Figure).length(3),
    closing: Text,
    needs: z.object({ intro: Text, items: z.array(Text).min(1) }).strict(),
    address: Text,
    funds: z.array(Text).min(1),
    give: z.object({ lead: Text, contact: Text }).strict(),
    legal: Text,
    timeline: z.object({ heading: Text }).strict(),
  })
  .strict();

export const site = Site.parse({
  name: "Operation Kokua",
  mission: {
    text: "Providing surgical education and equipment to orthopedic surgeons, general surgeons, and neurosurgeons in Southeast Asia to improve orthopedic care and rehabilitation for under-served populations.",
    basis: "old-site",
  },
  headline: {
    text: "Surgical equipment and teaching, carried to the surgeons who need them.",
    basis: "david-unconfirmed",
    label: "Home headline",
  },
  origin: {
    text: "Operation Kokua began with something David G. Mathews, MD, saw over about 30 years at Kaiser: working surgical equipment retired while hospitals abroad went without. We carry that equipment to surgeons who can use it, and we teach alongside it.",
    basis: "david-unconfirmed",
    label: "Home origin paragraph: about 30 years at Kaiser, and whether the employer may be named",
  },
  impact: [
    {
      value: "About $50 million",
      detail: "in equipment donated",
      basis: "david-unconfirmed",
      label: "Impact figure: about $50 million in equipment donated, and how it was valued",
    },
    {
      value: "3 countries",
      detail: "Vietnam, Cambodia and Nepal",
      basis: "david-unconfirmed",
      label: "Impact figure: 3 countries, including Nepal (the old site documents Vietnam and Cambodia only)",
    },
    // Counted from trips.ts; a test fails if this copy disagrees with it.
    { value: "12 trips", detail: "documented here, 2010 to 2015", basis: "old-site", derivedFrom: "trips.ts" },
  ],
  closing: {
    text: "Kōkua means help. That is the whole idea.",
    basis: "david-unconfirmed",
    label: "Home closing line",
  },
  needs: {
    intro: { text: "Things that we need include", basis: "old-site" },
    // The old site ran these into one line ending in a comma; joined here as a clean list.
    items: [
      { text: "power saws", basis: "old-site" },
      { text: "sterilizable drills", basis: "old-site" },
      { text: "implants", basis: "old-site" },
      { text: "external fixators", basis: "old-site" },
    ],
  },
  // The old Give page: "Items can be shipped to: 1505 Ohialoke Street". The
  // contact line below carries it in full; a test holds the two together.
  address: { text: "1505 Ohialoke Street", basis: "old-site" },
  // As published, without end punctuation on the last two. The old site's
  // "501 3 C status currently pending with IRS" is dropped: the IRS letter of
  // 2014-09-24 supersedes it.
  funds: [
    { text: "Funds are used for shipping, supporting student travel, and purchasing equipment for donations.", basis: "old-site" },
    { text: "All board members and executives are all volunteers", basis: "old-site" },
    { text: "Currently no funds are used for administrative purposes", basis: "old-site" },
  ],
  give: {
    lead: {
      text: "Equipment a hospital here has finished with can run for years in an operating room abroad.",
      basis: "david-unconfirmed",
      label: "Give page lead",
    },
    contact: {
      text: "To offer equipment or support a trip, write to Operation Kokua, 1505 Ohialoke Street, Honolulu, HI 96821.",
      basis: "david-unconfirmed",
      label: "Give page contact line: the street address (1505 Ohialoke Street, Honolulu, HI 96821) appearing publicly",
    },
  },
  legal: {
    text: "Operation Kokua is a 501(c)(3) organization. EIN 46-3431061.",
    basis: "public-record",
    label: "Legal line: 501(c)(3) status and EIN 46-3431061 (matches the IRS letter of 2014-09-24)",
  },
  timeline: {
    heading: { text: "A timeline of our activities", basis: "old-site" },
  },
});

export type Site = typeof site;
