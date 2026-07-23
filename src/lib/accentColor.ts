// Dominant-color extraction for vendor images, run once at upload time
// (never on page load — the tournament UI just reads the stored value).

export const FALLBACK_ACCENT_COLOR = "#B8532F";

const MIN_LIGHTNESS = 0.12;
const MAX_LIGHTNESS = 0.92;
const MIN_SATURATION = 0.08;
const MAX_SATURATION = 0.9;
// Normalize the winning bucket into a readable medium tone.
const TARGET_LIGHTNESS_MIN = 0.35;
const TARGET_LIGHTNESS_MAX = 0.55;
const TARGET_SATURATION_MIN = 0.35;
const TARGET_SATURATION_MAX = 0.65;
const SAMPLE_SIZE = 48;
const HUE_BUCKET_SIZE = 15;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case rn:
      h = ((gn - bn) / d) % 6;
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function loadImageSource(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = (event) => {
      reject(event);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Extracts one dominant, readable accent color from an image file.
 * Returns null if extraction fails or every sampled pixel is too
 * black/white/gray/oversaturated to normalize into a usable color.
 */
export async function extractAccentColor(file: File): Promise<string | null> {
  try {
    const source = await loadImageSource(file);
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const buckets = new Map<number, { count: number; h: number; s: number; l: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue; // skip transparent pixels
      const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue; // near-black / near-white
      if (s < MIN_SATURATION || s > MAX_SATURATION) continue; // gray / extremely saturated
      const key = Math.round(h / HUE_BUCKET_SIZE) * HUE_BUCKET_SIZE;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.h += h;
        bucket.s += s;
        bucket.l += l;
      } else {
        buckets.set(key, { count: 1, h, s, l });
      }
    }

    let winner: { count: number; h: number; s: number; l: number } | null = null;
    for (const bucket of buckets.values()) {
      if (!winner || bucket.count > winner.count) winner = bucket;
    }
    if (!winner) return null;

    const h = winner.h / winner.count;
    const s = clamp(winner.s / winner.count, TARGET_SATURATION_MIN, TARGET_SATURATION_MAX);
    const l = clamp(winner.l / winner.count, TARGET_LIGHTNESS_MIN, TARGET_LIGHTNESS_MAX);
    return hslToHex(h, s, l);
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Picks white or near-black foreground text for readable contrast on `hex`. */
export function getReadableTextColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#141110";
  return relativeLuminance(rgb) > 0.45 ? "#141110" : "#ffffff";
}

/** Returns `hex` as an `rgba()` string with the given alpha, for subtle rings/glows. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(184, 83, 47, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
