import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { isExcluded } from "../src/lib/excluded";
import { builtWidths, photoFile } from "../src/lib/photo-files";
import { expectedOutputs, irsLetterJob, jobs } from "./image-jobs";
import { forbiddenMetadata } from "./image-metadata";

const PUBLIC_IMAGES = path.join(__dirname, "../public/images");
const files = readdirSync(PUBLIC_IMAGES).filter((f) => !f.startsWith("."));

describe("public/images", () => {
  it("holds exactly the files the jobs build (no orphans, none missing)", () => {
    const expected = expectedOutputs();
    const orphans = files.filter((f) => !expected.includes(f));
    const missing = expected.filter((f) => !files.includes(f));
    expect({ orphans, missing }).toEqual({ orphans: [], missing: [] });
    expect(new Set(expected).size, "two jobs write the same file").toBe(expected.length);
  });

  it("builds 640 and 1100, never wider than the source", () => {
    expect(builtWidths(1100)).toEqual([640, 1100]);
    expect(builtWidths(1066)).toEqual([640, 1066]);
    expect(builtWidths(640)).toEqual([640]);
    expect(builtWidths(597)).toEqual([597]);
    expect(photoFile("3649891_orig.jpg", 640)).toBe("photo-3649891-640.jpg");
  });

  it.each(jobs.map((j) => [j.file, j] as const))("%s: each built file has the width its name says", async (_f, job) => {
    for (const [i, w] of job.sizes.entries()) {
      const m = await sharp(path.join(PUBLIC_IMAGES, job.outputs[i])).metadata();
      expect(m.width).toBe(w);
    }
  });

  it("the IRS letter is copied to public/docs/", () => {
    expect(existsSync(irsLetterJob.output)).toBe(true);
    expect(readFileSync(irsLetterJob.output).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("excluded photos stay out of public/images", () => {
  it("no file derives from an excluded id", () => {
    expect(files.filter(isExcluded)).toEqual([]);
    expect(expectedOutputs().filter(isExcluded)).toEqual([]);
  });

  it("goes red on a file derived from 2690840 (the check can fail)", () => {
    expect([...files, "photo-2690840-640.jpg"].filter(isExcluded)).toEqual(["photo-2690840-640.jpg"]);
  });
});

describe("images carry no metadata", () => {
  it.each(files)("%s has no exif, xmp or iptc", async (f) => {
    expect(await forbiddenMetadata(path.join(PUBLIC_IMAGES, f))).toEqual([]);
  });

  const tmp = mkdtempSync(path.join(tmpdir(), "okp-meta-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("rejects a JPEG written with EXIF (the checker can fail)", async () => {
    const file = path.join(tmp, "with-exif.jpg");
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#808080" } })
      .withMetadata()
      .withExif({ IFD0: { Copyright: "test", Make: "TestCam" } })
      .jpeg()
      .toFile(file);
    expect(await forbiddenMetadata(file)).toContain("exif");
  });
});
