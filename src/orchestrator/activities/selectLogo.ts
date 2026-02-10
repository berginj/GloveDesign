import { createBlobClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { CrawlReport, LogoScore } from "../../common/types";
import { applyLogoAnalysis, scoreLogoCandidates } from "../../logo/scoring";
import { analyzeImage } from "../../logo/analyze";
import { safeFetchBuffer } from "../../common/http";

function validateImageBuffer(buffer: Buffer, contentType?: string): boolean {
  if (buffer.length === 0) {
    return false;
  }

  // Check magic bytes for common image formats
  const magicBytes = buffer.slice(0, 12);

  // PNG: 89 50 4E 47
  if (magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4e && magicBytes[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (magicBytes[0] === 0xff && magicBytes[1] === 0xd8 && magicBytes[2] === 0xff) {
    return true;
  }

  // GIF: 47 49 46 38
  if (magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x38) {
    return true;
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 &&
      magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50) {
    return true;
  }

  // SVG: Check for '<svg' or '<?xml' at start (after possible BOM)
  const asText = buffer.toString('utf8', 0, Math.min(100, buffer.length)).toLowerCase();
  if (asText.includes('<svg') || (asText.includes('<?xml') && asText.includes('svg'))) {
    return true;
  }

  // ICO: 00 00 01 00
  if (magicBytes[0] === 0x00 && magicBytes[1] === 0x00 && magicBytes[2] === 0x01 && magicBytes[3] === 0x00) {
    return true;
  }

  // BMP: 42 4D
  if (magicBytes[0] === 0x42 && magicBytes[1] === 0x4d) {
    return true;
  }

  return false;
}

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

  const maxAnalysisCount = Number(process.env.LOGO_ANALYSIS_COUNT) || 8;
  const analysisTimeoutMs = Number(process.env.LOGO_ANALYSIS_TIMEOUT_MS) || 12000;

  // Parallelize image analysis for better performance
  const analyzed: LogoScore[] = await Promise.all(
    scored.slice(0, maxAnalysisCount).map(async (candidate) => {
      try {
        const response = await safeFetchBuffer(candidate.url, { timeoutMs: analysisTimeoutMs, maxBytes: 2 * 1024 * 1024 });
        const analysis = await analyzeImage(response.data);
        return applyLogoAnalysis(candidate, analysis);
      } catch (error) {
        return candidate;
      }
    })
  );

  const prioritized = (analyzed.length > 0 ? analyzed : scored).sort((a, b) => b.score - a.score);
  const downloadTimeoutMs = Number(process.env.LOGO_DOWNLOAD_TIMEOUT_MS) || 15000;
  const failures: string[] = [];
  for (const selection of prioritized) {
    try {
      const response = await safeFetchBuffer(selection.url, { timeoutMs: downloadTimeoutMs, maxBytes: 4 * 1024 * 1024 });
      const imageBuffer = Buffer.from(response.data);

      // Validate the downloaded data is actually an image
      if (!validateImageBuffer(imageBuffer, response.contentType)) {
        failures.push(`${selection.url} (not a valid image format)`);
        continue;
      }

      const extension = resolveImageExtension(selection.url, response.contentType);
      const result = await writeBlob(
        client,
        containerName,
        `jobs/${input.jobId}/logo.${extension}`,
        imageBuffer,
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
