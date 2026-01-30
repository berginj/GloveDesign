import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { v4 as uuidv4 } from "uuid";
import { createServiceBusClient } from "../../common/azureClients";
import { JobRecord, JobRequest } from "../../common/types";
import { ensureHttpScheme, validateUrlWithDns } from "../../common/validation";
import { createJobStoreFromEnv } from "../../common/jobStore";

export async function submitJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as JobRequest | null;
  if (!body?.teamUrl || !body?.mode) {
    return { status: 400, jsonBody: { error: "teamUrl and mode are required." } };
  }

  if (body.mode !== "proposal" && body.mode !== "autofill") {
    return { status: 400, jsonBody: { error: "mode must be proposal or autofill." } };
  }

  const normalizedUrl = ensureHttpScheme(body.teamUrl);
  const validation = await validateUrlWithDns(normalizedUrl);
  if (!validation.ok) {
    return { status: 400, jsonBody: { error: validation.reason } };
  }

  const store = createJobStoreFromEnv();
  if (!store) {
    context.error("Job store not configured. Set COSMOS_ENDPOINT or TABLE_CONNECTION_STRING.");
    return { status: 500, jsonBody: { error: "Job store not configured. Please check server configuration." } };
  }

  await store.init();

  const jobId = uuidv4();
  const job: JobRecord = {
    jobId,
    teamUrl: normalizedUrl,
    mode: body.mode,
    stage: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ttlHours = parseInt(process.env.BRANDING_CACHE_TTL_HOURS ?? "24", 10);
  const cacheTtl = Number.isFinite(ttlHours) ? ttlHours : 24;
  const cached = await store.getLatestCompletedJobByTeamUrl(normalizedUrl);
  if (cached?.outputs && cached.stage === "completed") {
    const ageMs = Date.now() - Date.parse(cached.updatedAt);
    if (ageMs >= 0 && ageMs <= cacheTtl * 60 * 60 * 1000) {
      context.log(`Reusing cached job ${cached.jobId} for ${normalizedUrl}.`);
      return { status: 200, jsonBody: { jobId: cached.jobId, cached: true } };
    }
  }

  await store.upsertJob(job);

  const serviceBusConnection = process.env.SERVICEBUS_CONNECTION || process.env.SERVICEBUS_NAMESPACE;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  if (!serviceBusConnection) {
    context.error("Service Bus not configured. Set SERVICEBUS_CONNECTION or SERVICEBUS_NAMESPACE environment variable.");
    return { status: 500, jsonBody: { error: "Service Bus not configured. Please check server configuration." } };
  }

  try {
    const sbClient = createServiceBusClient(serviceBusConnection);
    const sender = sbClient.createSender(queueName);
    await sender.sendMessages({
      body: { jobId, teamUrl: normalizedUrl, mode: body.mode },
      contentType: "application/json",
    });
    await sender.close();
    await sbClient.close();

    context.log(`Job ${jobId} enqueued to Service Bus queue '${queueName}'.`);
    try {
      await store.updateStage(jobId, "queued");
    } catch (updateError) {
      context.error(`Failed to update job ${jobId} to queued: ${String(updateError)}`);
    }
    return { status: 202, jsonBody: { jobId } };
  } catch (error) {
    context.error(`Failed to enqueue job ${jobId}: ${String(error)}`);
    return { status: 500, jsonBody: { error: "Failed to enqueue branding job. Please try again." } };
  }
}

app.http("submitJob", {
  methods: ["POST"],
  authLevel: "function",
  route: "jobs",
  handler: submitJob,
});
