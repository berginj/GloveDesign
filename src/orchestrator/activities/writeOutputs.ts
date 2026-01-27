import { createBlobClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { CrawlReport, GloveDesign, JobOutputs, LogoScore, PaletteResult } from "../../common/types";

export default async function writeOutputsActivity(input: {
  jobId: string;
  crawlReport: CrawlReport;
  logo: LogoScore;
  palette: PaletteResult;
  design: GloveDesign;
}): Promise<JobOutputs> {
  const blobUrl = process.env.BLOB_URL;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    return {};
  }
  const client = createBlobClient(blobUrl);
  const jobPath = `jobs/${input.jobId}`;

  const paletteResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/palette.json`,
    JSON.stringify(input.palette, null, 2),
    "application/json",
    input.jobId
  );

  const designResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/glove_design.json`,
    JSON.stringify(input.design, null, 2),
    "application/json",
    input.jobId
  );

  const proposal = buildProposal(input.design, input.logo, input.palette, input.crawlReport);
  const proposalResult = await writeBlob(
    client,
    containerName,
    `${jobPath}/proposal.md`,
    proposal,
    "text/markdown",
    input.jobId
  );

  await writeBlob(
    client,
    containerName,
    `${jobPath}/crawl_report.json`,
    JSON.stringify(input.crawlReport, null, 2),
    "application/json",
    input.jobId
  );

  return {
    logoUrl: input.logo.url,
    logoBlobPath: input.logo.blobPath,
    paletteBlobPath: paletteResult.path,
    designBlobPath: designResult.path,
    proposalBlobPath: proposalResult.path,
  };
}

function buildProposal(design: GloveDesign, logo: LogoScore, palette: PaletteResult, report: CrawlReport): string {
  const lines = [
    `# Glove Design Proposal`,
    ``,
    `**Team URL:** ${design.team.sourceUrl}`,
    `**Logo Candidate:** ${logo.url}`,
    `**Logo Evidence:** ${logo.reasons.join("; ")}`,
    ``,
    `## Palette`,
    `- Primary: ${palette.primary.hex} (${palette.primary.evidence.join(", ")})`,
    `- Secondary: ${palette.secondary.hex} (${palette.secondary.evidence.join(", ")})`,
    `- Accent: ${palette.accent.hex} (${palette.accent.evidence.join(", ")})`,
    `- Neutral: ${palette.neutral.hex} (${palette.neutral.evidence.join(", ")})`,
    ``,
    `## Variants`,
  ];

  for (const variant of design.variants) {
    lines.push(`### Variant ${variant.id}`);
    lines.push(`- Components: ${JSON.stringify(variant.components)}`);
    lines.push(`- Notes: ${variant.notes.join("; ")}`);
    lines.push("");
  }

  if (report.notes.length > 0) {
    lines.push("## Crawl Notes");
    lines.push(...report.notes.map((note) => `- ${note}`));
  }

  return lines.join("\n");
}
