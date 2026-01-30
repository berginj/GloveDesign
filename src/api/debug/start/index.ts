import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { v4 as uuidv4 } from "uuid";
import { createJobStoreFromEnv } from "../../../common/jobStore";
import { ensureHttpScheme } from "../../../common/validation";

export async function startOrchestrationDirect(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as { teamUrl?: string; mode?: "proposal" | "autofill" } | null;
  if (!body?.teamUrl) {
    return { status: 400, jsonBody: { error: "teamUrl is required." } };
  }
  const mode = body.mode === "autofill" ? "autofill" : "proposal";
  const normalizedUrl = ensureHttpScheme(body.teamUrl);
  const jobId = uuidv4();
  const nowIso = new Date().toISOString();

  const store = createJobStoreFromEnv();
  if (store) {
    await store.init();
    await store.upsertJob({
      jobId,
      teamUrl: normalizedUrl,
      mode,
      stage: "received",
      createdAt: nowIso,
      updatedAt: nowIso,
      stageTimestamps: { received: nowIso },
      retryCount: 0,
    });
  }

  const client = df.getClient(context) as any;
  const instanceId = await client.startNew("jobOrchestrator", jobId, { jobId, teamUrl: normalizedUrl, mode });
  context.log(`Direct orchestration started: ${instanceId}`);

  const status = await waitForDurableStatus(client, instanceId, context);
  if (!status) {
    const errorMessage = "Durable instance not found after startNew.";
    context.error(`[debug/start] ${errorMessage} instanceId=${instanceId}`);
    if (store) {
      await store.updateStage(jobId, "failed", {
        error: errorMessage,
        errorDetails: "Durable Functions extension returned 404 for instanceId.",
        instanceId,
      });
    }
    return {
      status: 500,
      jsonBody: {
        error: errorMessage,
        jobId,
        instanceId,
      },
    };
  }

  if (store) {
    await store.updateStage(jobId, "queued", { instanceId });
  }
  return { status: 202, jsonBody: { jobId, instanceId, direct: true, durableStatus: status } };
}

app.http("debugStartOrchestration", {
  methods: ["POST"],
  authLevel: "function",
  route: "debug/start",
  extraInputs: [df.input.durableClient()],
  handler: startOrchestrationDirect,
});

async function waitForDurableStatus(client: any, instanceId: string, context: InvocationContext) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const status = await client.getStatus(instanceId, false, false, true);
      if (status) {
        return status;
      }
    } catch (error) {
      context.log(`[debug/start] Status poll attempt ${attempt} failed: ${String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}
