import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { ApiResponse, getJobStore, validateRequired } from "../../common/apiHelpers";

export async function cancelJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const jobId = request.params.jobId ?? request.query.get("jobId");
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

  let terminated = false;
  try {
    const client = df.getClient(context);
    await client.terminate(jobId, "Cancelled by user");
    terminated = true;
  } catch (error) {
    context.log(`Failed to terminate orchestration ${jobId}: ${String(error)}`);
  }

  await storeResult.store.updateStage(jobId, "canceled", { error: "Job canceled by user." });

  return ApiResponse.accepted({ jobId, canceled: true, terminated });
}

app.http("cancelJob", {
  methods: ["POST"],
  authLevel: "function",
  route: "jobs/{jobId}/cancel",
  extraInputs: [df.input.durableClient()],
  handler: cancelJob,
});
