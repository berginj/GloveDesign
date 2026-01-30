import { app, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";
import { logError, logInfo } from "../common/logging";

const serviceBusQueueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
const serviceBusConnectionSetting = process.env.SERVICEBUS_CONNECTION ? "SERVICEBUS_CONNECTION" : "SERVICEBUS_NAMESPACE";

app.serviceBusQueue("jobQueueTrigger", {
  connection: serviceBusConnectionSetting,
  queueName: serviceBusQueueName,
  extraInputs: [df.input.durableClient()],
  handler: async (message: any, context: InvocationContext) => {
    const startTime = Date.now();
    let jobId = "unknown";

    try {
      // Log raw message for debugging
      context.log(
        `[jobQueueTrigger] Received message. Queue=${serviceBusQueueName}. Type=${typeof message}. HasBody=${Boolean(message?.body)}`
      );

      // Parse payload
      const payload = normalizePayload(message?.body ?? message, context);
      if (!payload?.jobId) {
        const errorMsg = "jobQueueTrigger missing jobId in message body.";
        context.error(`[jobQueueTrigger] ${errorMsg}. Payload: ${JSON.stringify(payload)}`);
        logError("trigger_missing_jobid", {}, { payload, messageType: typeof message });
        throw new Error(errorMsg);
      }

      jobId = payload.jobId;
      logInfo("trigger_received", { jobId, stage: "trigger" }, { teamUrl: payload.teamUrl, mode: payload.mode });

      // Validate Durable Functions client
      let client: any;
      try {
        client = df.getClient(context);
        if (!client) {
          throw new Error("Durable Functions client is null. Check AzureWebJobsStorage configuration.");
        }
        context.log(`[jobQueueTrigger] Durable Functions client obtained for job ${jobId}`);
      } catch (clientError) {
        const errorMsg = `Failed to get Durable Functions client: ${String(clientError)}`;
        context.error(`[jobQueueTrigger] ${errorMsg}`);
        logError("trigger_client_error", { jobId, stage: "trigger" }, {
          error: String(clientError),
          errorStack: (clientError as Error).stack,
          storageConfigured: Boolean(process.env.AzureWebJobsStorage),
          storageEnvVar: process.env.AzureWebJobsStorage ? "SET" : "NOT_SET"
        });
        throw new Error(errorMsg);
      }

      // Start orchestration
      context.log(`[jobQueueTrigger] Starting orchestration for job ${jobId}...`);
      let instanceId: string;
      try {
        instanceId = await client.startNew("jobOrchestrator", jobId, payload);
      } catch (startError) {
        const errorMsg = `Failed to start orchestration: ${String(startError)}`;
        context.error(`[jobQueueTrigger] ${errorMsg}`);
        logError("trigger_start_error", { jobId, stage: "trigger" }, {
          error: String(startError),
          errorStack: (startError as Error).stack,
          errorName: (startError as Error).name,
          payload
        });
        throw new Error(errorMsg);
      }

      const duration = Date.now() - startTime;
      context.log(`[jobQueueTrigger] Successfully started orchestration with ID = '${instanceId}' for job ${jobId}. Duration: ${duration}ms`);
      logInfo("trigger_success", { jobId, stage: "trigger" }, { instanceId, duration, teamUrl: payload.teamUrl });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorDetails = {
        error: String(error),
        errorType: (error as Error).name,
        errorStack: (error as Error).stack,
        duration,
        messageType: typeof message,
        hasBody: Boolean(message?.body)
      };

      context.error(`[jobQueueTrigger] FAILED for job ${jobId}. Duration: ${duration}ms. Error: ${String(error)}`);
      logError("trigger_fatal_error", { jobId, stage: "trigger" }, errorDetails);

      // Re-throw to trigger retry or dead-letter
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
