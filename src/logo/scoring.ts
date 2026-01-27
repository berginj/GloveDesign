import { ImageCandidate, LogoAnalysis, LogoScore } from "../common/types";

const POSITIVE_HINTS = ["logo", "mark", "crest", "emblem", "wordmark", "brand", "club", "team"];
const NEGATIVE_HINTS = ["hero", "banner", "background", "slide", "slideshow", "photo", "sponsor", "ad", "roster"];

export function scoreLogoCandidates(candidates: ImageCandidate[]): LogoScore[] {
  return candidates.map((candidate) => {
    let score = 0;
    const reasons: string[] = [];

    if (candidate.context && ["header", "nav"].includes(candidate.context)) {
      score += 15;
      reasons.push("Found in header/nav");
    } else if (candidate.context && candidate.context.includes("footer")) {
      score -= 3;
      reasons.push("Footer placement");
    }

    const urlLower = candidate.url.toLowerCase();
    const altLower = candidate.altText?.toLowerCase() || "";
    const fileHint = candidate.fileNameHint?.toLowerCase() || "";
    for (const hint of POSITIVE_HINTS) {
      if (urlLower.includes(hint) || altLower.includes(hint) || fileHint.includes(hint)) {
        score += 10;
        reasons.push(`Hint match: ${hint}`);
        break;
      }
    }
    for (const hint of NEGATIVE_HINTS) {
      if (urlLower.includes(hint) || altLower.includes(hint) || fileHint.includes(hint)) {
        score -= 8;
        reasons.push(`Likely photo/banner: ${hint}`);
        break;
      }
    }

    if (candidate.hints.includes("logo")) {
      score += 6;
      reasons.push("Semantic logo hint");
    }

    if (candidate.hints.some((hint) => hint.includes("og:image"))) {
      score += 3;
      reasons.push("OpenGraph image");
    }

    if (candidate.width && candidate.height) {
      const ratio = candidate.width / candidate.height;
      if (ratio > 0.6 && ratio < 2.2) {
        score += 4;
        reasons.push("Logo-like aspect ratio");
      } else if (ratio > 3 || ratio < 0.3) {
        score -= 6;
        reasons.push("Extreme aspect ratio");
      }
      const maxSide = Math.max(candidate.width, candidate.height);
      if (maxSide < 50) {
        score -= 4;
        reasons.push("Very small image");
      } else if (maxSide > 800) {
        score -= 3;
        reasons.push("Very large image");
      } else if (maxSide >= 120 && maxSide <= 500) {
        score += 4;
        reasons.push("Reasonable logo size");
      }
    }

    if (urlLower.endsWith(".svg")) {
      score += 8;
      reasons.push("SVG preferred");
    } else if (urlLower.endsWith(".png")) {
      score += 4;
      reasons.push("PNG preferred");
    }

    return { url: candidate.url, score, reasons };
  });
}

export function selectBestLogo(candidates: ImageCandidate[]): LogoScore | null {
  const scored = scoreLogoCandidates(candidates);
  const sorted = scored.sort((a, b) => b.score - a.score);
  return sorted[0] ?? null;
}

export function applyLogoAnalysis(score: LogoScore, analysis: LogoAnalysis): LogoScore {
  const reasons = [...score.reasons];
  let adjusted = score.score;

  if (analysis.entropy !== undefined && analysis.entropy > 5.2) {
    adjusted -= 6;
    reasons.push("High entropy suggests photo");
  }
  if (analysis.edgeDensity !== undefined && analysis.edgeDensity > 0.18) {
    adjusted -= 4;
    reasons.push("High edge density suggests photo");
  }
  if (analysis.alphaRatio !== undefined && analysis.alphaRatio > 0.05) {
    adjusted += 4;
    reasons.push("Transparency suggests logo");
  }
  if (analysis.aspectRatio !== undefined) {
    if (analysis.aspectRatio > 0.6 && analysis.aspectRatio < 2.2) {
      adjusted += 2;
      reasons.push("Aspect ratio reinforced by analysis");
    } else if (analysis.aspectRatio > 3 || analysis.aspectRatio < 0.3) {
      adjusted -= 3;
      reasons.push("Aspect ratio suggests banner");
    }
  }

  return { ...score, score: adjusted, reasons, analysis };
}
