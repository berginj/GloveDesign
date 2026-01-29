import { app, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";

app.serviceBusQueue("jobQueueTrigger", {
  connection: "SERVICEBUS_CONNECTION",
  queueName: "%SERVICEBUS_QUEUE%",
  extraInputs: [df.input.durableClient()],
  handler: async (message: any, context: InvocationContext) => {
    try {
      const client = df.getClient(context) as any;
      const payload = normalizePayload(message?.body ?? message, context);
      if (!payload?.jobId) {
        throw new Error("jobQueueTrigger missing jobId in message body.");
      }
      context.log(`jobQueueTrigger received job ${payload.jobId} (${payload.teamUrl ?? "no url"}).`);
      const instanceId = await client.startNew("jobOrchestrator", payload.jobId, payload);
      context.log(`Started orchestration with ID = '${instanceId}'.`);
    } catch (error) {
      context.error(`jobQueueTrigger failed: ${String(error)}`);
      throw error;
    }
  },
});

function normalizePayload(raw: unknown, context: InvocationContext) {
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      context.error(`jobQueueTrigger could not parse string payload: ${String(error)}`);
      return raw;
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch (error) {
      context.error(`jobQueueTrigger could not parse buffer payload: ${String(error)}`);
      return raw.toString("utf8");
    }
  }
  if (ArrayBuffer.isView(raw)) {
    try {
      const text = Buffer.from(raw.buffer).toString("utf8");
      return JSON.parse(text);
    } catch (error) {
      context.error(`jobQueueTrigger could not parse binary payload: ${String(error)}`);
      return raw;
    }
  }
  return raw;
}
