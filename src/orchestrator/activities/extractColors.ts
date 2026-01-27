import { extractPalette } from "../../colors/extract";

export default async function extractColorsActivity(input: { jobId: string; logoUrl: string; cssUrls: string[] }) {
  return extractPalette(input.logoUrl, input.cssUrls);
}
