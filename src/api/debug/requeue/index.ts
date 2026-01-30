import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createServiceBusClient } from "../../../common/azureClients";
import { createJobStoreFromEnv } from "../../../common/jobStore";

function normalizeBody(body: unknown) {
  if (!body) {
    return null;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { raw: body };
    }
  }
  return body;
}

export async function requeueDeadLetters(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const serviceBusNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  const maxCount = Math.min(Math.max(parseInt(request.query.get("limit") ?? "1", 10) || 1, 1), 10);
  if (!serviceBusNamespace) {
    return { status: 400, jsonBody: { error: "SERVICEBUS_NAMESPACE or SERVICEBUS_CONNECTION is required." } };
  }

  const store = createJobStoreFromEnv();
  if (store) {
    await store.init();
  }

  try {
    const client = createServiceBusClient(serviceBusNamespace);
    const receiver = client.createReceiver(queueName, { subQueueType: "deadLetter" });
    const sender = client.createSender(queueName);

    const messages = await receiver.receiveMessages(maxCount, { maxWaitTimeInMs: 5000 });
    const requeued: Array<{ messageId?: string; jobId?: string }> = [];

    for (const message of messages) {
      const body = normalizeBody(message.body) as { jobId?: string; teamUrl?: string; mode?: string } | null;
      await sender.sendMessages({
        body: body ?? message.body,
        contentType: message.contentType ?? "application/json",
      });
      await receiver.completeMessage(message);

      if (store && body?.jobId) {
        const job = await store.getJob(body.jobId);
        const nextRetry = (job?.retryCount ?? 0) + 1;
        await store.updateStage(body.jobId, "queued", {
          retryCount: nextRetry,
          lastRetryAt: new Date().toISOString(),
        });
      }

      requeued.push({ messageId: normalizeMessageId(message.messageId), jobId: body?.jobId });
    }

    await receiver.close();
    await sender.close();
    await client.close();

    return {
      status: 200,
      jsonBody: {
        queueName,
        requested: maxCount,
        requeuedCount: requeued.length,
        requeued,
      },
    };
  } catch (error) {
    context.log(`Dead-letter requeue failed: ${String(error)}`);
    return { status: 500, jsonBody: { error: "Failed to requeue dead-letter messages." } };
  }
}

app.http("debugRequeueDeadLetters", {
  methods: ["POST"],
  authLevel: "function",
  route: "debug/requeue",
  handler: requeueDeadLetters,
});

function normalizeMessageId(value: string | number | Buffer | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return String(value);
}
