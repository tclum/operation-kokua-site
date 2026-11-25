// WCAG 2.x relative luminance and contrast ratio.

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex color: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite `top` at `alpha` (0 to 1) over `bottom`. */
export function blend(top: RGB, bottom: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) => top[i] * alpha + bottom[i] * (1 - alpha)) as RGB;
}
