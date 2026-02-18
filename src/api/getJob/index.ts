import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ApiResponse, getJobStore, validateRequired } from "../../common/apiHelpers";

export async function getJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const jobId = request.params.jobId;
  const validationError = validateRequired(jobId, "jobId");
  if (validationError) {
    return validationError;
  }

  const storeResult = await getJobStore(context);
  if ("error" in storeResult) {
    return storeResult.error;
  }

  const job = await storeResult.store.getJob(jobId);
  if (!job) {
    return ApiResponse.notFound("Job not found.");
  }

  const status =
    job.stage === "completed" ? "Succeeded" : job.stage === "failed" || job.stage === "canceled" ? "Failed" : "Running";

  return ApiResponse.ok({
    jobId: job.jobId,
    teamUrl: job.teamUrl,
    mode: job.mode,
    stage: job.stage,
    status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    stageTimestamps: job.stageTimestamps,
    retryCount: job.retryCount,
    lastRetryAt: job.lastRetryAt,
    outputs: job.outputs,
    error: job.error,
    errorDetails: job.errorDetails,
    autofillAttempted: job.autofillAttempted,
    autofillSucceeded: job.autofillSucceeded,
    wizardWarnings: job.wizardWarnings,
  });
}

app.http("getJob", {
  methods: ["GET"],
  authLevel: "function",
  route: "jobs/{jobId}",
  handler: getJob,
});

app.http("healthz", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "healthz",
  handler: async () => ({
    status: 200,
    jsonBody: { status: "ok", timestamp: new Date().toISOString() },
  }),
});
