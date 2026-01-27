import axios from "axios";
import { createBlobClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { CrawlReport, LogoScore } from "../../common/types";
import { selectBestLogo } from "../../logo/scoring";

export default async function selectLogoActivity(input: { jobId: string; crawlReport: CrawlReport }): Promise<LogoScore | null> {
  const selection = selectBestLogo(input.crawlReport.imageCandidates);
  if (!selection) {
    return null;
  }
  const blobUrl = process.env.BLOB_URL;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    return selection;
  }
  const extension = selection.url.split(".").pop() || "png";
  const response = await axios.get(selection.url, { responseType: "arraybuffer", timeout: 15000 });
  const client = createBlobClient(blobUrl);
  const result = await writeBlob(
    client,
    containerName,
    `jobs/${input.jobId}/logo.${extension}`,
    Buffer.from(response.data),
    response.headers["content-type"] || "image/png",
    input.jobId
  );
  return { ...selection, blobPath: result.path, reasons: [...selection.reasons, `Uploaded to ${result.path}`] };
}
