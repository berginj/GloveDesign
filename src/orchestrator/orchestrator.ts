import type { Task } from "durable-functions";
import { CrawlReport, GloveDesign, JobOutputs, JobRequest, LogoScore, PaletteResult, WizardResult } from "../common/types";

// Retry policy for network-dependent activities
const networkRetryOptions = {
  firstRetryIntervalInMilliseconds: 2000,
  maxNumberOfAttempts: 3,
  backoffCoefficient: 2,
  maxRetryIntervalInMilliseconds: 30000,
  retryTimeoutInMilliseconds: 300000,
};

// Retry policy for storage operations
const storageRetryOptions = {
  firstRetryIntervalInMilliseconds: 1000,
  maxNumberOfAttempts: 5,
  backoffCoefficient: 1.5,
  maxRetryIntervalInMilliseconds: 10000,
  retryTimeoutInMilliseconds: 60000,
};

const orchestrator = function* (context: any): Generator<Task, unknown, unknown> {
  const input = context.df.getInput() as JobRequest & { jobId: string };
  const jobId = input.jobId;
  let currentActivity = "initialization";

  // Log orchestration startup
  context.log(`[Orchestrator] Started for job ${jobId}. TeamUrl: ${input.teamUrl}, Mode: ${input.mode}`);
  context.log(`[Orchestrator] Instance ID: ${context.df.instanceId}`);

  try {
    currentActivity = "validateJob";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const validation = (yield context.df.callActivityWithRetry("validateJob", networkRetryOptions, input)) as { ok: boolean; reason?: string };
    if (!validation.ok) {
      context.log(`[Orchestrator] ${jobId}: Validation FAILED: ${validation.reason}`);
      yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "failed", error: `Validation failed: ${validation.reason}` });
      return { jobId, error: `Validation failed: ${validation.reason}` };
    }
    context.log(`[Orchestrator] ${jobId}: Validation succeeded`);
    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "validated" });

    currentActivity = "crawlSite";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const crawlReport = (yield context.df.callActivityWithRetry("crawlSite", networkRetryOptions, input)) as CrawlReport;
    context.log(`[Orchestrator] ${jobId}: Crawl completed. Pages: ${crawlReport.visited.length}, Images: ${crawlReport.imageCandidates.length}`);
    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "crawled" });

    currentActivity = "selectLogo";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const logo = (yield context.df.callActivityWithRetry("selectLogo", networkRetryOptions, { jobId, crawlReport })) as LogoScore;
    context.log(`[Orchestrator] ${jobId}: Logo selected. Score: ${logo.score}, URL: ${logo.url}`);
    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "logo_selected" });

    currentActivity = "extractColors";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const palette = (yield context.df.callActivityWithRetry("extractColors", networkRetryOptions, {
      jobId,
      logoUrl: logo.url,
      cssUrls: crawlReport.cssUrls,
      inlineStyles: crawlReport.inlineStyles,
    })) as PaletteResult;
    context.log(`[Orchestrator] ${jobId}: Colors extracted. Primary: ${palette.primary?.hex}, Secondary: ${palette.secondary?.hex}`);
    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "colors_extracted" });

    currentActivity = "generateDesign";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const design = (yield context.df.callActivity("generateDesign", {
      jobId,
      teamUrl: input.teamUrl,
      logoUrl: logo.url,
      logoBlobPath: logo.blobPath ?? `jobs/${jobId}/logo`,
      palette,
    })) as GloveDesign;
    context.log(`[Orchestrator] ${jobId}: Design generated. Variants: ${design.variants?.length ?? 0}`);
    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "design_generated" });

    let wizardResult: WizardResult | undefined;
    if (input.mode === "autofill") {
      currentActivity = "runWizard";
      context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity} (autofill mode)`);
      yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, { jobId, stage: "wizard_attempted", autofillAttempted: true });
      // No retry for wizard as it's complex and not idempotent
      wizardResult = (yield context.df.callActivity("runWizard", { jobId, design, logoBlobPath: logo.blobPath })) as WizardResult;
      context.log(`[Orchestrator] ${jobId}: Wizard completed. Success: ${wizardResult.autofillSucceeded}`);
    }

    currentActivity = "writeOutputs";
    context.log(`[Orchestrator] ${jobId}: Starting activity: ${currentActivity}`);
    const outputs = (yield context.df.callActivityWithRetry("writeOutputs", storageRetryOptions, {
      jobId,
      crawlReport,
      logo,
      palette,
      design,
      wizardResult,
    })) as JobOutputs;
    context.log(`[Orchestrator] ${jobId}: Outputs written to blob storage`);

    yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, {
      jobId,
      stage: "completed",
      outputs,
      autofillAttempted: wizardResult?.autofillAttempted,
      autofillSucceeded: wizardResult?.autofillSucceeded,
      wizardWarnings: wizardResult?.warnings,
    });
    context.log(`[Orchestrator] ${jobId}: Job COMPLETED successfully`);
    return { jobId, outputs };
  } catch (error) {
    const errorMessage = getActivityErrorMessage(currentActivity, error);
    const errorDetails = String(error);
    const errorStack = (error as Error).stack;

    context.log(`[Orchestrator] ${jobId}: FAILED in activity '${currentActivity}'`);
    context.log(`[Orchestrator] ${jobId}: Error: ${errorMessage}`);
    context.log(`[Orchestrator] ${jobId}: Details: ${errorDetails}`);
    if (errorStack) {
      context.log(`[Orchestrator] ${jobId}: Stack: ${errorStack}`);
    }

    try {
      yield context.df.callActivityWithRetry("updateJobStage", storageRetryOptions, {
        jobId,
        stage: "failed",
        error: errorMessage,
        errorDetails,
      });
      context.log(`[Orchestrator] ${jobId}: Job stage updated to 'failed'`);
    } catch (updateError) {
      // If updating job stage fails, log but don't throw
      context.log(`[Orchestrator] ${jobId}: WARNING - Failed to update job stage during error handling: ${String(updateError)}`);
    }

    return { jobId, error: errorMessage, errorDetails };
  }
};

function getActivityErrorMessage(activity: string, error: unknown): string {
  const errorStr = String(error);

  const activityMessages: Record<string, string> = {
    validateJob: "Failed to validate team URL",
    crawlSite: "Failed to crawl team website",
    selectLogo: "Failed to select or upload team logo",
    extractColors: "Failed to extract color palette",
    generateDesign: "Failed to generate glove design",
    runWizard: "Failed to run autofill wizard",
    writeOutputs: "Failed to save job outputs",
    initialization: "Failed to initialize job orchestration",
  };

  const baseMessage = activityMessages[activity] ?? "Branding job failed";

  // Check for specific error types to provide more helpful messages
  if (errorStr.includes("storage not configured") || errorStr.includes("BLOB")) {
    return `${baseMessage}: Blob storage not configured. Please contact support.`;
  }
  if (errorStr.includes("Service Bus") || errorStr.includes("SERVICEBUS")) {
    return `${baseMessage}: Message queue not configured. Please contact support.`;
  }
  if (errorStr.includes("Job store") || errorStr.includes("COSMOS") || errorStr.includes("TABLE")) {
    return `${baseMessage}: Database not configured. Please contact support.`;
  }
  if (errorStr.includes("robots.txt") || errorStr.includes("Disallow")) {
    return `${baseMessage}: Website blocks automated crawling.`;
  }
  if (errorStr.includes("timeout") || errorStr.includes("ETIMEDOUT")) {
    return `${baseMessage}: Website took too long to respond.`;
  }
  if (errorStr.includes("ENOTFOUND") || errorStr.includes("DNS")) {
    return `${baseMessage}: Website not found or unreachable.`;
  }

  return `${baseMessage}. ${errorStr}`;
}

export default orchestrator;
