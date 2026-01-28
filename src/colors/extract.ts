import { PaletteColor, PaletteResult } from "../common/types";
import { safeFetchBuffer, safeFetchText } from "../common/http";

const MAX_CSS_FILES = 4;
let sharpModule: typeof import("sharp") | null | undefined;

async function getSharp() {
  if (sharpModule !== undefined) {
    return sharpModule;
  }
  try {
    const mod = await import("sharp");
    sharpModule = mod.default ?? (mod as unknown as typeof import("sharp"));
  } catch (error) {
    sharpModule = null;
  }
  return sharpModule;
}

export async function extractPalette(logoUrl: string, cssUrls: string[], inlineStyles: string[] = []): Promise<PaletteResult> {
  const cssColors = await collectCssColors(cssUrls, inlineStyles);
  const logoColors = await collectLogoColors(logoUrl);
  const combined = mergeColors([...cssColors, ...logoColors]).sort((a, b) => b.confidence - a.confidence);
  const [primary, secondary, accent, neutral] = rankPalette(combined);
  return {
    primary,
    secondary,
    accent,
    neutral,
    raw: combined,
  };
}

async function collectCssColors(cssUrls: string[], inlineStyles: string[]): Promise<PaletteColor[]> {
  const colors: PaletteColor[] = [];
  const sources: Array<{ content: string; label: string }> = [];

  for (const inline of inlineStyles.slice(0, 20)) {
    sources.push({ content: inline, label: "css:inline" });
  }

  for (const url of cssUrls.slice(0, MAX_CSS_FILES)) {
    try {
      const response = await safeFetchText(url, { timeoutMs: 8000, maxBytes: 500 * 1024 });
      sources.push({ content: response.data, label: `css:${url}` });
    } catch (error) {
      // ignore CSS failures
    }
  }

  const colorMap = new Map<string, { confidence: number; evidence: Set<string> }>();
  for (const source of sources) {
    const matches = extractCssColorValues(source.content);
    matches.forEach((match) => {
      const hex = normalizeColor(match.value);
      if (!hex) {
        return;
      }
      const entry = colorMap.get(hex) ?? { confidence: 0, evidence: new Set<string>() };
      const weight = match.isVariable ? 0.5 : 0.35;
      entry.confidence = Math.min(1, entry.confidence + weight);
      entry.evidence.add(source.label);
      if (match.name) {
        entry.evidence.add(`var:${match.name}`);
      }
      colorMap.set(hex, entry);
    });
  }

  colorMap.forEach((value, hex) => {
    colors.push({ hex, confidence: Math.min(0.8, value.confidence), evidence: Array.from(value.evidence) });
  });

  return colors;
}

async function collectLogoColors(logoUrl: string): Promise<PaletteColor[]> {
  try {
    const sharp = await getSharp();
    if (!sharp) {
      return [];
    }
    const response = await safeFetchBuffer(logoUrl, { timeoutMs: 15000, maxBytes: 2 * 1024 * 1024 });
    const image = sharp(response.data as Buffer);
    const resized = await image.resize(200, 200, { fit: "inside" }).raw().ensureAlpha().toBuffer();
    const colors = kmeansColors(resized, 8);
    return colors.map((color) => ({
      hex: color.hex,
      confidence: Math.min(0.95, 0.5 + color.weight * 0.6),
      evidence: ["logo"],
    }));
  } catch (error) {
    return [];
  }
}

function kmeansColors(buffer: Buffer, clusters: number): Array<{ hex: string; weight: number }> {
  const pixels: number[][] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    const alpha = buffer[i + 3] / 255;
    if (alpha < 0.2) {
      continue;
    }
    pixels.push([buffer[i], buffer[i + 1], buffer[i + 2]]);
  }
  if (pixels.length === 0) {
    return [];
  }
  const centroids = pixels.slice(0, clusters).map((p) => [...p]);
  let groups = Array.from({ length: clusters }, () => [] as number[][]);
  for (let iter = 0; iter < 6; iter += 1) {
    groups = Array.from({ length: clusters }, () => [] as number[][]);
    for (const p of pixels) {
      const idx = nearestCentroid(p, centroids);
      groups[idx].push(p);
    }
    for (let i = 0; i < clusters; i += 1) {
      if (groups[i].length === 0) {
        continue;
      }
      const avg = average(groups[i]);
      centroids[i] = avg;
    }
  }

  const weights = groups.map((group) => group.length / pixels.length);
  return centroids.map((c, index) => ({ hex: rgbToHex(c[0], c[1], c[2]), weight: weights[index] ?? 0 }));
}

function nearestCentroid(pixel: number[], centroids: number[][]): number {
  let best = 0;
  let bestDist = Infinity;
  centroids.forEach((c, index) => {
    const dist = distance(pixel, c);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

function distance(a: number[], b: number[]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function average(points: number[][]): number[] {
  const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [Math.round(sum[0] / points.length), Math.round(sum[1] / points.length), Math.round(sum[2] / points.length)];
}

export function mergeColors(colors: PaletteColor[]): PaletteColor[] {
  const merged: PaletteColor[] = [];
  for (const color of colors) {
    const existing = merged.find((c) => colorDistance(c.hex, color.hex) < 25);
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + color.confidence * 0.5);
      existing.evidence = Array.from(new Set([...existing.evidence, ...color.evidence]));
    } else {
      merged.push({ ...color });
    }
  }
  return merged;
}

function rankPalette(colors: PaletteColor[]): PaletteColor[] {
  const sorted = colors.sort((a, b) => b.confidence - a.confidence);
  const primary = sorted.find((color) => !isNeutral(color.hex)) ?? derivedColor("#1b1b1b", "derived");
  const secondary =
    sorted.find((color) => color.hex !== primary.hex && !isNeutral(color.hex)) ??
    derivedColor(lighten(primary.hex, 0.2), "derived");
  const accent =
    sorted.find((color) => color.hex !== primary.hex && color.hex !== secondary.hex) ??
    derivedColor(lighten(primary.hex, 0.4), "derived");
  const neutral = sorted.find((c) => isNeutral(c.hex)) ?? derivedColor("#f5f5f5", "derived");
  return [primary, secondary, accent, neutral];
}

function normalizeColor(value: string): string | null {
  if (value.startsWith("#")) {
    return value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
  }
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10));
  }
  const hslMatch = /hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?/i.exec(value);
  if (hslMatch) {
    const rgb = hslToRgb(parseInt(hslMatch[1], 10), parseInt(hslMatch[2], 10), parseInt(hslMatch[3], 10));
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16).padStart(2, "0");
      return hex;
    })
    .join("")}`;
}

export function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return distance([ar, ag, ab], [br, bg, bb]);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

function isNeutral(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 24;
}

function derivedColor(hex: string, reason: string): PaletteColor {
  return { hex, confidence: 0.2, evidence: [reason] };
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (value: number) => Math.min(255, Math.round(value + (255 - value) * factor));
  return rgbToHex(blend(r), blend(g), blend(b));
}

function extractCssColorValues(content: string): Array<{ value: string; isVariable: boolean; name?: string }> {
  const results: Array<{ value: string; isVariable: boolean; name?: string }> = [];
  const variableMatches = Array.from(content.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g));
  variableMatches.forEach((match) => {
    const value = match[2]?.trim();
    if (!value) {
      return;
    }
    results.push({ value, isVariable: true, name: match[1] });
  });

  const genericMatches = content.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^\)]+\)|hsla?\([^\)]+\)/g) || [];
  genericMatches.forEach((value) => results.push({ value, isVariable: false }));
  return results;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
