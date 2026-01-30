import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";

export async function durableStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as { instanceId?: string } | null;
  const instanceId = request.params.instanceId ?? request.query.get("instanceId") ?? body?.instanceId;
  if (!instanceId) {
    return { status: 400, jsonBody: { error: "instanceId is required." } };
  }

  const showHistory = request.query.get("history") === "true";
  const showHistoryOutput = request.query.get("historyOutput") === "true";
  const showInput = request.query.get("input") !== "false";

  try {
    const client = df.getClient(context) as any;
    const status = await client.getStatus(instanceId, showHistory, showHistoryOutput, showInput);
    if (!status) {
      return { status: 404, jsonBody: { error: "Instance not found." } };
    }
    return { status: 200, jsonBody: status };
  } catch (error) {
    const errorText = String(error);
    if (errorText.includes("HTTP 404") || errorText.includes("404 response")) {
      return {
        status: 404,
        jsonBody: {
          error: "Instance not found.",
          details: errorText,
        },
      };
    }
    context.error(`debug/durable failed: ${String(error)}`);
    return {
      status: 500,
      jsonBody: {
        error: "Failed to query durable status",
        details: errorText,
      },
    };
  }
}

app.http("debugDurableStatus", {
  methods: ["GET", "POST"],
  authLevel: "function",
  route: "debug/durable/{instanceId?}",
  extraInputs: [df.input.durableClient()],
  handler: durableStatus,
});
