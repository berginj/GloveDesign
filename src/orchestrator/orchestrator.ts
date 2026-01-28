import { CrawlReport, GloveDesign, JobOutputs, JobRequest, LogoScore, PaletteResult, WizardResult } from "../common/types";

const orchestrator = function* (context: any): Generator<unknown, unknown, unknown> {
  const input = context.df.getInput() as JobRequest & { jobId: string };
  const jobId = input.jobId;
  try {
    const validation = (yield context.df.callActivity("validateJob", input)) as { ok: boolean; reason?: string };
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

    const palette = (yield context.df.callActivity("extractColors", {
      jobId,
      logoUrl: logo.url,
      cssUrls: crawlReport.cssUrls,
      inlineStyles: crawlReport.inlineStyles,
    })) as PaletteResult;
    yield context.df.callActivity("updateJobStage", { jobId, stage: "colors_extracted" });

    const design = (yield context.df.callActivity("generateDesign", {
      jobId,
      teamUrl: input.teamUrl,
      logoUrl: logo.url,
      logoBlobPath: logo.blobPath ?? `jobs/${jobId}/logo`,
      palette,
    })) as GloveDesign;
    yield context.df.callActivity("updateJobStage", { jobId, stage: "design_generated" });

    let wizardResult: WizardResult | undefined;
    if (input.mode === "autofill") {
      yield context.df.callActivity("updateJobStage", { jobId, stage: "wizard_attempted", autofillAttempted: true });
      wizardResult = (yield context.df.callActivity("runWizard", { jobId, design, logoBlobPath: logo.blobPath })) as WizardResult;
    }

    const outputs = (yield context.df.callActivity("writeOutputs", {
      jobId,
      crawlReport,
      logo,
      palette,
      design,
      wizardResult,
    })) as JobOutputs;

    yield context.df.callActivity("updateJobStage", {
      jobId,
      stage: "completed",
      outputs,
      autofillAttempted: wizardResult?.autofillAttempted,
      autofillSucceeded: wizardResult?.autofillSucceeded,
      wizardWarnings: wizardResult?.warnings,
    });
    return { jobId, outputs };
  } catch (error) {
    yield context.df.callActivity("updateJobStage", {
      jobId,
      stage: "failed",
      error: "Unhandled orchestration error.",
      errorDetails: String(error),
    });
    return { jobId, error: String(error) };
  }
};

export default orchestrator;
