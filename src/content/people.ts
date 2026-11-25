// Executives and board, as the old About page lists them (word for word,
// including the spelling "Johnn"; confirming it is an open question).

import { z } from "zod";
import { Person } from "./schema";

const People = z.object({ executives: z.array(Person).min(1), board: z.array(Person).min(1) }).strict();

export const people = People.parse({
  executives: [
    { role: "President", name: "David G. Mathews, MD", basis: "old-site" },
    { role: "Treasurer", name: "Eric Matayoshi, MD", basis: "old-site" },
    { role: "Secretary", name: "Johnn Saruwatari, MD", basis: "old-site" },
  ],
  board: [
    { name: "Eric Matayoshi, MD", basis: "old-site" },
    { name: "David G. Mathews, MD", basis: "old-site" },
    { name: "Mr. Todd Patterson", basis: "old-site" },
    { name: "Johnn Saruwatari, MD", basis: "old-site" },
    { name: "Ron Wyatt, MD", basis: "old-site" },
  ],
});
