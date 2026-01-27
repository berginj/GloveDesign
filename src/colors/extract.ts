import axios from "axios";
import sharp from "sharp";
import { PaletteColor, PaletteResult } from "../common/types";

export async function extractPalette(logoUrl: string, cssUrls: string[]): Promise<PaletteResult> {
  const cssColors = await collectCssColors(cssUrls);
  const logoColors = await collectLogoColors(logoUrl);
  const combined = mergeColors([...cssColors, ...logoColors]);
  const [primary, secondary, accent, neutral] = rankPalette(combined);
  return {
    primary,
    secondary,
    accent,
    neutral,
    raw: combined,
  };
}

async function collectCssColors(cssUrls: string[]): Promise<PaletteColor[]> {
  const colors: PaletteColor[] = [];
  for (const url of cssUrls.slice(0, 3)) {
    try {
      const response = await axios.get(url, { timeout: 8000 });
      const matches = response.data.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgb\([^\)]+\)/g) || [];
      for (const match of matches.slice(0, 20)) {
        const hex = normalizeColor(match);
        if (hex) {
          colors.push({ hex, confidence: 0.4, evidence: ["css"] });
        }
      }
    } catch (error) {
      // ignore CSS failures
    }
  }
  return colors;
}

async function collectLogoColors(logoUrl: string): Promise<PaletteColor[]> {
  try {
    const response = await axios.get(logoUrl, { responseType: "arraybuffer", timeout: 15000 });
    const image = sharp(response.data as Buffer);
    const resized = await image.resize(200, 200, { fit: "inside" }).raw().ensureAlpha().toBuffer();
    const colors = kmeansColors(resized, 6);
    return colors.map((hex) => ({ hex, confidence: 0.7, evidence: ["logo"] }));
  } catch (error) {
    return [];
  }
}

function kmeansColors(buffer: Buffer, clusters: number): string[] {
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
  for (let iter = 0; iter < 6; iter += 1) {
    const groups = Array.from({ length: clusters }, () => [] as number[][]);
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
  return centroids.map((c) => rgbToHex(c[0], c[1], c[2]));
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
  const primary = sorted[0] ?? derivedColor("#1b1b1b", "derived");
  const secondary = sorted[1] ?? derivedColor(lighten(primary.hex, 0.2), "derived");
  const accent = sorted[2] ?? derivedColor(lighten(primary.hex, 0.4), "derived");
  const neutral = sorted.find((c) => isNeutral(c.hex)) ?? derivedColor("#f5f5f5", "derived");
  return [primary, secondary, accent, neutral];
}

function normalizeColor(value: string): string | null {
  if (value.startsWith("#")) {
    return value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
  }
  const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/i.exec(value);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10));
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
  return max - min < 20;
}

function derivedColor(hex: string, reason: string): PaletteColor {
  return { hex, confidence: 0.2, evidence: [reason] };
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const blend = (value: number) => Math.min(255, Math.round(value + (255 - value) * factor));
  return rgbToHex(blend(r), blend(g), blend(b));
}
