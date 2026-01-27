import * as df from "durable-functions";
import { CrawlReport, GloveDesign, JobOutputs, JobRequest, LogoScore, PaletteResult } from "../common/types";

const orchestrator = df.orchestrator(function* (context) {
  const input = context.df.getInput() as JobRequest & { jobId: string };
  const jobId = input.jobId;

  const validation = yield context.df.callActivity("validateJob", input);
  if (!validation.ok) {
    yield context.df.callActivity("updateJobStage", { jobId, stage: "failed", error: validation.reason });
    return { jobId, error: validation.reason };
  }
  yield context.df.callActivity("updateJobStage", { jobId, stage: "validated" });

  const crawlReport = (yield context.df.callActivity("crawlSite", input)) as CrawlReport;
  yield context.df.callActivity("updateJobStage", { jobId, stage: "crawled" });

  const logo = (yield context.df.callActivity("selectLogo", { jobId, crawlReport })) as LogoScore | null;
  if (!logo) {
    yield context.df.callActivity("updateJobStage", { jobId, stage: "failed", error: "No logo candidates found." });
    return { jobId, error: "No logo candidates found." };
  }
  yield context.df.callActivity("updateJobStage", { jobId, stage: "logo_selected" });

  const palette = (yield context.df.callActivity("extractColors", { jobId, logoUrl: logo.url, cssUrls: crawlReport.cssUrls })) as PaletteResult;
  yield context.df.callActivity("updateJobStage", { jobId, stage: "colors_extracted" });

  const design = (yield context.df.callActivity("generateDesign", {
    jobId,
    teamUrl: input.teamUrl,
    logoUrl: logo.url,
    logoBlobPath: logo.blobPath ?? `jobs/${jobId}/logo`,
    palette,
  })) as GloveDesign;
  yield context.df.callActivity("updateJobStage", { jobId, stage: "design_generated" });

  const outputs = (yield context.df.callActivity("writeOutputs", { jobId, crawlReport, logo, palette, design })) as JobOutputs;

  if (input.mode === "autofill") {
    yield context.df.callActivity("updateJobStage", { jobId, stage: "wizard_attempted", outputs });
    yield context.df.callActivity("runWizard", { jobId, design, outputs });
  }

  yield context.df.callActivity("updateJobStage", { jobId, stage: "completed", outputs });
  return { jobId, outputs };
});

export default orchestrator;
