// The two galleries on /work (from the old Teaching, Our Donations and School
// Donations pages, in their order) and the Press photo on /about. Photos left
// out for consent are not listed (src/lib/excluded.ts).

import { z } from "zod";
import { Photo } from "./schema";

const Photos = z
  .object({ teaching: z.array(Photo).min(1), donations: z.array(Photo).min(1), press: Photo })
  .strict();

export const photos = Photos.parse({
  teaching: [
    {
      file: "1246484_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Three men standing in a hospital doorway under a sign for the Intensive Care Unit",
      caption: "Total Joint and Spine Teaching Course along with Vietnam Orthopedic Association, Hanoi",
      basis: "old-site",
    },
    {
      file: "2388542_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Doctors seated in a lecture room facing a presenter, under a banner for the 2nd Workshop on Shoulder Arthroscopy, 8th to 11th November 2005",
      basis: "old-site",
    },
    {
      file: "4124780.jpg",
      width: 687,
      height: 515,
      alt: "Two men outside a hospital under a banner for a Shoulder Replacement Workshop in Ho Chi Minh City dated 19/03/2009, with motorbikes parked behind them",
      basis: "old-site",
    },
    {
      file: "6792933_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Doctors in white coats gathered at a long meeting table set with flowers and water bottles",
      basis: "old-site",
    },
    {
      file: "2501404_orig.jpg",
      width: 1066,
      height: 800,
      alt: "A red sign on a hospital wall for a centre of trauma and orthopaedics, beside a stairway",
      basis: "old-site",
    },
    {
      file: "5616264_orig.jpg",
      width: 640,
      height: 480,
      alt: "Four surgeons in scrubs and caps standing together in a hospital corridor",
      basis: "old-site",
    },
  ],
  donations: [
    {
      file: "4197056_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Four men, three in white coats, holding surgical drills in an office",
      basis: "old-site",
    },
    {
      file: "2038728_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Two surgical power drills on a wooden table beside a box of drill attachments",
      basis: "old-site",
    },
    {
      file: "6499061_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Doctors in white coats around a table of surgical instrument trays, one holding up an instrument while another speaks into a microphone",
      basis: "old-site",
    },
    {
      file: "5662593_orig.jpg",
      width: 1066,
      height: 800,
      alt: "A charger holding four drill batteries, two surgical drills and a box of attachments on a wooden shelf",
      basis: "old-site",
    },
    {
      file: "3649891_orig.jpg",
      width: 1100,
      height: 735,
      alt: "Two men in an office handing over a battery charger, with a box of drill attachments on the glass table in front of them",
      basis: "old-site",
    },
    {
      file: "2013587_orig.jpg",
      width: 1066,
      height: 800,
      alt: "An open sterilization case of orthopedic instruments",
      basis: "old-site",
    },
    {
      file: "1383809_orig.jpg",
      width: 1066,
      height: 800,
      alt: "An open sterilization case of surgical instruments with a pair of pliers on top",
      basis: "old-site",
    },
    {
      file: "5587144_orig.jpg",
      width: 1066,
      height: 800,
      alt: "A tray of orthopedic instruments laid out in rows",
      basis: "old-site",
    },
    {
      file: "7458924_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Two men in white coats shaking hands at the front of a lecture room, one holding a microphone, with equipment on a table beside them",
      basis: "old-site",
    },
    {
      file: "2524133_orig.jpg",
      width: 1066,
      height: 800,
      alt: "A group of doctors and officials standing behind a conference table in a room with a red curtain and a white bust",
      basis: "old-site",
    },
    {
      file: "2280998_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Doctors in white coats around a table looking into an open instrument case",
      basis: "old-site",
    },
    {
      file: "9514001_orig.jpg",
      width: 1066,
      height: 800,
      alt: "A man handing a wrapped gift to a man in a white coat at the front of a room, under a banner reading Donation Ceremony to the HTO, November 7th, 2006",
      basis: "old-site",
    },
    {
      file: "7773461_orig.jpg",
      width: 1066,
      height: 800,
      alt: "Seven men, several in white coats, holding new surgical drills in a meeting room",
      basis: "old-site",
    },
    {
      file: "3012705_orig.jpg",
      width: 640,
      height: 480,
      alt: "Doctors in white coats and visitors standing together in a classroom in front of a chalkboard",
      basis: "old-site",
    },
    {
      file: "9366887_orig.jpg",
      width: 597,
      height: 800,
      alt: "Two men standing beside a stack of cardboard boxes in a doorway",
      basis: "old-site",
    },
  ],
  // The old Press page: this banner photo and a link labelled only "Button Text".
  press: {
    file: "796980_orig.jpg",
    width: 1100,
    height: 705,
    alt: "A banner on a white wall, in Vietnamese and English: Lễ trao quà tặng cho Bệnh viện Chấn thương Chỉnh hình của Bs David G. Mathews, Bệnh viện Kaiser Permanente. Donation Ceremony to the HTO, from Dr David G. Mathews, Kaiser Permanente Hospital, November 7th, 2006.",
    basis: "old-site",
  },
});

/** Home: a handover and a teaching group, at their real size. */
export const homePhotos = [
  photos.donations.find((p) => p.file === "3649891_orig.jpg")!,
  photos.donations.find((p) => p.file === "6499061_orig.jpg")!,
];
