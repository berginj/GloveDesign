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

  const store = createJobStoreFromEnv();
  if (store) {
    await store.init();
    await store.upsertJob({
      jobId,
      teamUrl: normalizedUrl,
      mode,
      stage: "received",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const client = df.getClient(context) as any;
  const instanceId = await client.startNew("jobOrchestrator", undefined, { jobId, teamUrl: normalizedUrl, mode });
  context.log(`Direct orchestration started: ${instanceId}`);
  return { status: 202, jsonBody: { jobId, direct: true } };
}

app.http("debugStartOrchestration", {
  methods: ["POST"],
  authLevel: "function",
  route: "debug/start",
  extraInputs: [df.input.durableClient()],
  handler: startOrchestrationDirect,
});
