import { createJobStoreFromEnv } from "../../common/jobStore";
import { JobOutputs, JobStage } from "../../common/types";
import { logError, logInfo } from "../../common/logging";

export default async function updateJobStageActivity(input: {
  jobId: string;
  stage: JobStage;
  outputs?: JobOutputs;
  error?: string;
  errorDetails?: string;
  autofillAttempted?: boolean;
  autofillSucceeded?: boolean;
  wizardWarnings?: string[];
  instanceId?: string;
}) {
  logInfo("update_stage_start", { jobId: input.jobId, stage: input.stage }, {
    targetStage: input.stage,
    hasOutputs: Boolean(input.outputs),
    hasError: Boolean(input.error)
  });

  const store = createJobStoreFromEnv();
  if (!store) {
    const errorMsg = "Job store not configured. Cannot update job stage.";
    logError("update_stage_no_store", { jobId: input.jobId, stage: input.stage }, {
      targetStage: input.stage,
      cosmosConfigured: Boolean(process.env.COSMOS_ENDPOINT),
      tableConfigured: Boolean(process.env.TABLE_CONNECTION_STRING),
      error: errorMsg
    });
    throw new Error(errorMsg);
  }

  try {
    await store.init();
    logInfo("update_stage_store_init", { jobId: input.jobId, stage: input.stage }, { message: "Job store initialized" });
  } catch (initError) {
    logError("update_stage_init_failed", { jobId: input.jobId, stage: input.stage }, {
      error: String(initError),
      errorStack: (initError as Error).stack
    });
    throw new Error(`Failed to initialize job store: ${String(initError)}`);
  }

  try {
    await store.updateStage(input.jobId, input.stage, {
      outputs: input.outputs,
      error: input.error,
      errorDetails: input.errorDetails,
      autofillAttempted: input.autofillAttempted,
      autofillSucceeded: input.autofillSucceeded,
      wizardWarnings: input.wizardWarnings,
      instanceId: input.instanceId,
    });
    logInfo("update_stage_success", { jobId: input.jobId, stage: input.stage }, {
      newStage: input.stage,
      hasOutputs: Boolean(input.outputs)
    });
  } catch (updateError) {
    logError("update_stage_failed", { jobId: input.jobId, stage: input.stage }, {
      error: String(updateError),
      errorStack: (updateError as Error).stack,
      targetStage: input.stage
    });
    throw new Error(`Failed to update job stage to '${input.stage}': ${String(updateError)}`);
  }
}
