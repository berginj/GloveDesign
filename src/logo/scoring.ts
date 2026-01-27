import { ImageCandidate, LogoScore } from "../common/types";

const HINTS = ["logo", "mark", "crest", "emblem"];

export function scoreLogoCandidates(candidates: ImageCandidate[]): LogoScore[] {
  return candidates.map((candidate) => {
    let score = 0;
    const reasons: string[] = [];

    if (candidate.context && ["header", "nav"].includes(candidate.context)) {
      score += 15;
      reasons.push("Found in header/nav");
    }

    const urlLower = candidate.url.toLowerCase();
    const altLower = candidate.altText?.toLowerCase() || "";
    for (const hint of HINTS) {
      if (urlLower.includes(hint) || altLower.includes(hint)) {
        score += 10;
        reasons.push(`Hint match: ${hint}`);
        break;
      }
    }

    if (candidate.hints.some((hint) => hint.includes("og:image"))) {
      score += 5;
      reasons.push("OpenGraph image");
    }

    if (candidate.width && candidate.height) {
      const ratio = candidate.width / candidate.height;
      if (ratio > 0.7 && ratio < 1.4) {
        score += 5;
        reasons.push("Logo-like aspect ratio");
      }
    }

    if (urlLower.endsWith(".svg")) {
      score += 8;
      reasons.push("SVG preferred");
    }

    return { url: candidate.url, score, reasons };
  });
}

export function selectBestLogo(candidates: ImageCandidate[]): LogoScore | null {
  const scored = scoreLogoCandidates(candidates);
  const sorted = scored.sort((a, b) => b.score - a.score);
  return sorted[0] ?? null;
}
