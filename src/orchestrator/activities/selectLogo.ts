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

  const client = createBlobClient(blobUrl);
  const scored = scoreLogoCandidates(input.crawlReport.imageCandidates).sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return writePlaceholderLogo(client, containerName, input.jobId, input.crawlReport.startUrl, [
      "fallback: no logo candidates",
    ]);
  }

  const analyzed: LogoScore[] = [];
  for (const candidate of scored.slice(0, 8)) {
    try {
      const response = await safeFetchBuffer(candidate.url, { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 });
      const analysis = await analyzeImage(response.data);
      analyzed.push(applyLogoAnalysis(candidate, analysis));
    } catch (error) {
      analyzed.push(candidate);
    }
  }

  const prioritized = (analyzed.length > 0 ? analyzed : scored).sort((a, b) => b.score - a.score);
  const failures: string[] = [];
  for (const selection of prioritized) {
    try {
      const response = await safeFetchBuffer(selection.url, { timeoutMs: 15000, maxBytes: 4 * 1024 * 1024 });
      const extension = resolveImageExtension(selection.url, response.contentType);
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
    } catch (error) {
      failures.push(`${selection.url} (${String(error)})`);
    }
  }

  const failureSummary =
    failures.length === 0
      ? []
      : [`fallback: all candidate downloads failed`, `failed candidates: ${failures.slice(0, 3).join(" | ")}`];
  return writePlaceholderLogo(client, containerName, input.jobId, input.crawlReport.startUrl, failureSummary);
}

async function writePlaceholderLogo(
  client: ReturnType<typeof createBlobClient>,
  containerName: string,
  jobId: string,
  sourceUrl: string,
  reasons: string[]
): Promise<LogoScore> {
  const svg = buildPlaceholderSvg(sourceUrl);
  const result = await writeBlob(
    client,
    containerName,
    `jobs/${jobId}/logo.svg`,
    svg,
    "image/svg+xml",
    jobId,
    "logo_fallback"
  );
  return {
    url: result.url,
    score: 0.05,
    blobPath: result.path,
    reasons: [...reasons, `Placeholder at ${result.path}`],
  };
}

function resolveImageExtension(url: string, contentType?: string): string {
  const extFromType = extensionFromContentType(contentType);
  if (extFromType) {
    return extFromType;
  }

  try {
    const pathname = new URL(url).pathname;
    const match = /\.([a-z0-9]{1,6})$/i.exec(pathname);
    if (!match) {
      return "png";
    }
    const extension = match[1].toLowerCase();
    if (extension === "jpeg") {
      return "jpg";
    }
    if (["png", "jpg", "svg", "gif", "webp", "bmp", "ico"].includes(extension)) {
      return extension;
    }
  } catch {
    // ignore and fallback
  }

  return "png";
}

function extensionFromContentType(contentType?: string): string | null {
  if (!contentType) {
    return null;
  }
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  switch (normalized) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    case "image/bmp":
      return "bmp";
    default:
      return null;
  }
}
