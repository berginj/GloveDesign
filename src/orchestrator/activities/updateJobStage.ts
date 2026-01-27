import { createJobStoreFromEnv } from "../../common/jobStore";
import { JobOutputs, JobStage } from "../../common/types";

export default async function updateJobStageActivity(input: {
  jobId: string;
  stage: JobStage;
  outputs?: JobOutputs;
  error?: string;
  errorDetails?: string;
  autofillAttempted?: boolean;
  autofillSucceeded?: boolean;
  wizardWarnings?: string[];
}) {
  const store = createJobStoreFromEnv();
  if (!store) {
    return;
  }
  await store.init();
  await store.updateStage(input.jobId, input.stage, {
    outputs: input.outputs,
    error: input.error,
    errorDetails: input.errorDetails,
    autofillAttempted: input.autofillAttempted,
    autofillSucceeded: input.autofillSucceeded,
    wizardWarnings: input.wizardWarnings,
  });
}
