import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { createJobStoreFromEnv } from "../../common/jobStore";

export async function cancelJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const jobId = request.params.jobId ?? request.query.get("jobId");
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

  let terminated = false;
  try {
    const client = df.getClient(context);
    await client.terminate(jobId, "Cancelled by user");
    terminated = true;
  } catch (error) {
    context.log(`Failed to terminate orchestration ${jobId}: ${String(error)}`);
  }

  await store.updateStage(jobId, "canceled", { error: "Job canceled by user." });

  return {
    status: 202,
    jsonBody: { jobId, canceled: true, terminated },
  };
}

app.http("cancelJob", {
  methods: ["POST"],
  authLevel: "function",
  route: "jobs/{jobId}/cancel",
  extraInputs: [df.input.durableClient()],
  handler: cancelJob,
});
