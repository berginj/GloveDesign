import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { createJobStoreFromEnv } from "../../../common/jobStore";

export async function retryJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as { jobId?: string } | null;
  const jobId = request.params.jobId ?? body?.jobId;
  if (!jobId) {
    return { status: 400, jsonBody: { error: "jobId is required." } };
  }

  const store = createJobStoreFromEnv();
  if (!store) {
    return { status: 500, jsonBody: { error: "Job store not configured." } };
  }
  await store.init();
  const job = await store.getJob(jobId);
  if (!job) {
    return { status: 404, jsonBody: { error: "Job not found." } };
  }

  const client = df.getClient(context) as any;
  await client.startNew("jobOrchestrator", jobId, { jobId, teamUrl: job.teamUrl, mode: job.mode });
  await store.updateStage(jobId, "received");
  context.log(`Retried job ${jobId}.`);
  return { status: 202, jsonBody: { jobId, retried: true } };
}

app.http("debugRetryJob", {
  methods: ["POST"],
  authLevel: "function",
  route: "debug/retry/{jobId?}",
  extraInputs: [df.input.durableClient()],
  handler: retryJob,
});
