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

  const jobId = uuidv4();
  const job: JobRecord = {
    jobId,
    teamUrl: normalizedUrl,
    mode: body.mode,
    stage: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = createJobStoreFromEnv();
  if (store) {
    await store.init();
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
  }

  const serviceBusNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  if (!serviceBusNamespace) {
    return { status: 500, jsonBody: { error: "Service Bus namespace not configured." } };
  }

  const sbClient = createServiceBusClient(serviceBusNamespace);
  const sender = sbClient.createSender(queueName);
  await sender.sendMessages({ body: { jobId, teamUrl: normalizedUrl, mode: body.mode } });
  await sender.close();
  await sbClient.close();

  context.log(`Job ${jobId} enqueued.`);
  return { status: 202, jsonBody: { jobId } };
}

app.http("submitJob", {
  methods: ["POST"],
  authLevel: "function",
  route: "jobs",
  handler: submitJob,
});
