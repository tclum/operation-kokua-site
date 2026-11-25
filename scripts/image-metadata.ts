import sharp from "sharp";

/** Returns the metadata blocks a public image must not carry. ICC is allowed. */
export async function forbiddenMetadata(file: string): Promise<string[]> {
  const m = await sharp(file).metadata();
  const found: string[] = [];
  if (m.exif) found.push("exif");
  if (m.xmp) found.push("xmp");
  if (m.iptc) found.push("iptc");
  return found;
}
