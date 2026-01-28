import { LogoAnalysis } from "../common/types";

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

export async function analyzeImage(buffer: Buffer): Promise<LogoAnalysis> {
  const sharp = await getSharp();
  if (!sharp) {
    return { entropy: 0.3, edgeDensity: 0.3, alphaRatio: 0.5 };
  }
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;
  const { data, info } = await image.resize(96, 96, { fit: "inside" }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { entropy, edgeDensity, alphaRatio } = analyzePixels(data, info.width, info.height);
  const aspectRatio = width && height ? width / height : undefined;
  return { width, height, aspectRatio, entropy, edgeDensity, alphaRatio };
}

function analyzePixels(buffer: Buffer, width: number, height: number): { entropy: number; edgeDensity: number; alphaRatio: number } {
  const histogram = new Array(256).fill(0);
  let edgeCount = 0;
  let totalEdges = 0;
  let transparent = 0;
  let total = 0;

  const grayAt = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = buffer[idx];
    const g = buffer[idx + 1];
    const b = buffer[idx + 2];
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = buffer[idx + 3] / 255;
      if (alpha < 0.7) {
        transparent += 1;
      }
      const gray = Math.round(0.299 * buffer[idx] + 0.587 * buffer[idx + 1] + 0.114 * buffer[idx + 2]);
      histogram[gray] += 1;
      total += 1;
      if (x < width - 1 && y < height - 1) {
        const dx = Math.abs(grayAt(x + 1, y) - gray);
        const dy = Math.abs(grayAt(x, y + 1) - gray);
        totalEdges += 2;
        if (dx > 18) {
          edgeCount += 1;
        }
        if (dy > 18) {
          edgeCount += 1;
        }
      }
    }
  }

  let entropy = 0;
  histogram.forEach((count) => {
    if (count === 0) {
      return;
    }
    const p = count / total;
    entropy -= p * Math.log2(p);
  });

  return {
    entropy,
    edgeDensity: totalEdges > 0 ? edgeCount / totalEdges : 0,
    alphaRatio: total > 0 ? transparent / total : 0,
  };
}
