import { createBlobClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { CrawlReport, LogoScore } from "../../common/types";
import { applyLogoAnalysis, scoreLogoCandidates } from "../../logo/scoring";
import { analyzeImage } from "../../logo/analyze";
import { safeFetchBuffer } from "../../common/http";

export default async function selectLogoActivity(input: { jobId: string; crawlReport: CrawlReport }): Promise<LogoScore | null> {
  const scored = scoreLogoCandidates(input.crawlReport.imageCandidates).sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return null;
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
    return null;
  }

  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    return selection;
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
