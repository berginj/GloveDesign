import { BlobServiceClient } from "@azure/storage-blob";
import { logInfo } from "./logging";

export interface BlobWriteResult {
  path: string;
  url: string;
}

export async function writeBlob(
  client: BlobServiceClient,
  containerName: string,
  path: string,
  content: Buffer | string,
  contentType: string,
  jobId?: string,
  stage = "storage"
): Promise<BlobWriteResult> {
  const container = client.getContainerClient(containerName);
  await container.createIfNotExists();
  const blockBlob = container.getBlockBlobClient(path);
  const payload = typeof content === "string" ? Buffer.from(content) : content;
  await blockBlob.uploadData(payload, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  logInfo("blob_written", { jobId, stage }, { path });
  return { path, url: blockBlob.url };
}
