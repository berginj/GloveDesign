import { createBlobClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { CrawlReport, LogoScore } from "../../common/types";
import { applyLogoAnalysis, scoreLogoCandidates } from "../../logo/scoring";
import { analyzeImage } from "../../logo/analyze";
import { safeFetchBuffer } from "../../common/http";

function buildPlaceholderSvg(sourceUrl: string) {
  let label = "Team";
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    label = hostname.split(".")[0]?.slice(0, 12) || label;
  } catch {
    // ignore
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="240" viewBox="0 0 520 240">
  <rect width="520" height="240" fill="#f6efe5"/>
  <rect x="20" y="20" width="480" height="200" rx="24" fill="#1f4b5a"/>
  <text x="50%" y="52%" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="48" fill="#fef6eb">${label}</text>
  <text x="50%" y="70%" text-anchor="middle" font-family="Space Grotesk, Arial, sans-serif" font-size="16" fill="#f6d7b1">Placeholder logo</text>
</svg>`;
}

export default async function selectLogoActivity(input: { jobId: string; crawlReport: CrawlReport }): Promise<LogoScore | null> {
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    throw new Error("Blob storage not configured. Set BLOB_URL or BLOB_CONNECTION_STRING environment variable.");
  }

  // Defensive checks
  if (!input.crawlReport || typeof input.crawlReport !== "object") {
    throw new Error("Invalid crawl report provided to selectLogo activity");
  }

  if (!Array.isArray(input.crawlReport.imageCandidates)) {
    throw new Error("Crawl report must include imageCandidates array");
  }

  const scored = scoreLogoCandidates(input.crawlReport.imageCandidates).sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    const fallback: LogoScore = {
      url: input.crawlReport.startUrl,
      score: 0.05,
      reasons: ["fallback: no logo candidates"],
    };
    const client = createBlobClient(blobUrl);
    const svg = buildPlaceholderSvg(input.crawlReport.startUrl);
    const result = await writeBlob(
      client,
      containerName,
      `jobs/${input.jobId}/logo.svg`,
      svg,
      "image/svg+xml",
      input.jobId,
      "logo_fallback"
    );
    return { ...fallback, blobPath: result.path, reasons: [...fallback.reasons, `Placeholder at ${result.path}`] };
  }

  const analyzed: LogoScore[] = [];
  for (const candidate of scored.slice(0, 5)) {
    try {
      const response = await safeFetchBuffer(candidate.url, { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 });
      const analysis = await analyzeImage(response.data);
      analyzed.push(applyLogoAnalysis(candidate, analysis));
    } catch (error) {
      analyzed.push(candidate);
    }
  }

  const selection = (analyzed.length > 0 ? analyzed : scored).sort((a, b) => b.score - a.score)[0];
  if (!selection) {
    throw new Error("No logo candidates found after scoring and analysis.");
  }
  const extension = selection.url.split(".").pop() || "png";
  const response = await safeFetchBuffer(selection.url, { timeoutMs: 15000, maxBytes: 4 * 1024 * 1024 });
  const client = createBlobClient(blobUrl);
  const result = await writeBlob(
    client,
    containerName,
    `jobs/${input.jobId}/logo.${extension}`,
    Buffer.from(response.data),
    response.contentType || "image/png",
    input.jobId,
    "logo_upload"
  );
  return { ...selection, blobPath: result.path, reasons: [...selection.reasons, `Uploaded to ${result.path}`] };
}
