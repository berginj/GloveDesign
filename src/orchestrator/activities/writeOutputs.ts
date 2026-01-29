import { createBlobClient } from "../../common/azureClients";
import { buildProposal } from "../../common/proposal";
import { writeBlob } from "../../common/storage";
import { ArtifactLocation, CrawlReport, GloveDesign, JobOutputs, LogoScore, PaletteResult, WizardResult } from "../../common/types";

export default async function writeOutputsActivity(input: {
  jobId: string;
  crawlReport: CrawlReport;
  logo: LogoScore;
  palette: PaletteResult;
  design: GloveDesign;
  wizardResult?: WizardResult;
}): Promise<JobOutputs> {
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    throw new Error("Blob storage not configured. Set BLOB_URL or BLOB_CONNECTION_STRING environment variable.");
  }
  const client = createBlobClient(blobUrl);
  const jobPath = `jobs/${input.jobId}`;
  const container = client.getContainerClient(containerName);

  const logoLocation = input.logo.blobPath
    ? ({ path: input.logo.blobPath, url: container.getBlockBlobClient(input.logo.blobPath).url } satisfies ArtifactLocation)
    : undefined;

  const paletteResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/palette.json`,
    JSON.stringify(input.palette, null, 2),
    "application/json",
    input.jobId,
    "outputs"
  );

  const designResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/glove_design.json`,
    JSON.stringify(input.design, null, 2),
    "application/json",
    input.jobId,
    "outputs"
  );

  const reportWithDecision: CrawlReport = {
    ...input.crawlReport,
    logoDecision: {
      selectedUrl: input.logo.url,
      score: input.logo.score,
      reasons: input.logo.reasons,
      analysis: input.logo.analysis,
    },
  };

  const proposal = buildProposal(input.design, input.logo, input.palette, reportWithDecision, input.wizardResult);
  const proposalResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/proposal.md`,
    proposal,
    "text/markdown",
    input.jobId,
    "outputs"
  );

  const crawlResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/crawl_report.json`,
    JSON.stringify(reportWithDecision, null, 2),
    "application/json",
    input.jobId,
    "outputs"
  );

  const outputs: JobOutputs = {
    logo: logoLocation,
    palette: { path: paletteResult.path, url: paletteResult.url },
    design: { path: designResult.path, url: designResult.url },
    proposal: { path: proposalResult.path, url: proposalResult.url },
    crawlReport: { path: crawlResult.path, url: crawlResult.url },
  };

  if (input.wizardResult?.schemaSnapshot) {
    outputs.wizardSchema = input.wizardResult.schemaSnapshot;
  }
  if (input.wizardResult?.configuredImage) {
    outputs.configuredImage = input.wizardResult.configuredImage;
  }

  return outputs;
}
