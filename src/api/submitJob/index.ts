import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { v4 as uuidv4 } from "uuid";
import { createCosmosClient, createServiceBusClient } from "../../common/azureClients";
import { JobRecord, JobRequest } from "../../common/types";
import { validateUrl } from "../../common/validation";
import { CosmosJobStore } from "../../common/jobStore";

export async function submitJob(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as JobRequest | null;
  if (!body?.teamUrl || !body?.mode) {
    return { status: 400, jsonBody: { error: "teamUrl and mode are required." } };
  }

  const validation = validateUrl(body.teamUrl);
  if (!validation.ok) {
    return { status: 400, jsonBody: { error: validation.reason } };
  }

  const jobId = uuidv4();
  const job: JobRecord = {
    jobId,
    teamUrl: body.teamUrl,
    mode: body.mode,
    stage: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
  const cosmosDb = process.env.COSMOS_DATABASE || "glovejobs";
  const cosmosContainer = process.env.COSMOS_CONTAINER || "jobs";
  if (cosmosEndpoint) {
    const cosmosClient = createCosmosClient(cosmosEndpoint);
    const store = new CosmosJobStore(cosmosClient, cosmosDb, cosmosContainer);
    await store.init();
    await store.upsertJob(job);
  }

  const serviceBusNamespace = process.env.SERVICEBUS_NAMESPACE;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  if (!serviceBusNamespace) {
    return { status: 500, jsonBody: { error: "Service Bus namespace not configured." } };
  }

  const sbClient = createServiceBusClient(serviceBusNamespace);
  const sender = sbClient.createSender(queueName);
  await sender.sendMessages({ body: { jobId, ...body } });
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
