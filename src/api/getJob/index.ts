import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createJobStoreFromEnv } from "../../common/jobStore";

export async function getJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const jobId = request.params.jobId;
  if (!jobId) {
    return { status: 400, jsonBody: { error: "jobId is required." } };
  }

  const store = createJobStoreFromEnv();
  if (!store) {
    context.log("Job store not configured.");
    return { status: 500, jsonBody: { error: "Job store not configured." } };
  }
  await store.init();
  const job = await store.getJob(jobId);
  if (!job) {
    return { status: 404, jsonBody: { error: "Job not found." } };
  }

  const status =
    job.stage === "completed" ? "Succeeded" : job.stage === "failed" || job.stage === "canceled" ? "Failed" : "Running";
  return {
    status: 200,
    jsonBody: {
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
    },
  };
}

app.http("getJob", {
  methods: ["GET"],
  authLevel: "function",
  route: "jobs/{jobId}",
  handler: getJob,
});
