import { extractPalette } from "../../colors/extract";

export default async function extractColorsActivity(input: {
  jobId: string;
  logoUrl: string;
  cssUrls: string[];
  inlineStyles?: string[];
}) {
  // Defensive checks
  if (!input.logoUrl || typeof input.logoUrl !== "string") {
    throw new Error("Invalid logoUrl provided to extractColors activity");
  }

  const cssUrls = Array.isArray(input.cssUrls) ? input.cssUrls.filter((url) => url && typeof url === "string") : [];
  const inlineStyles = Array.isArray(input.inlineStyles) ? input.inlineStyles.filter((style) => style && typeof style === "string") : [];

  return extractPalette(input.logoUrl, cssUrls, inlineStyles, input.jobId);
}
