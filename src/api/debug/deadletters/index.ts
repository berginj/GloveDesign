import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createServiceBusClient } from "../../../common/azureClients";

export async function peekDeadLetters(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const serviceBusNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  const maxCount = Math.min(Math.max(parseInt(request.query.get("limit") ?? "5", 10) || 5, 1), 20);
  if (!serviceBusNamespace) {
    return { status: 400, jsonBody: { error: "SERVICEBUS_NAMESPACE or SERVICEBUS_CONNECTION is required." } };
  }
  try {
    const client = createServiceBusClient(serviceBusNamespace);
    const receiver = client.createReceiver(queueName, { subQueueType: "deadLetter" });
    const messages = await receiver.peekMessages(maxCount);
    await receiver.close();
    await client.close();
    return {
      status: 200,
      jsonBody: {
        queueName,
        count: messages.length,
        messages: messages.map((msg) => ({
          messageId: msg.messageId,
          enqueuedTimeUtc: msg.enqueuedTimeUtc,
          deadLetterReason: msg.deadLetterReason,
          deadLetterErrorDescription: msg.deadLetterErrorDescription,
          deliveryCount: msg.deliveryCount,
          body: msg.body,
        })),
      },
    };
  } catch (error) {
    context.log(`Dead-letter peek failed: ${String(error)}`);
    return { status: 500, jsonBody: { error: "Failed to read dead-letter messages." } };
  }
}

app.http("debugDeadLetters", {
  methods: ["GET"],
  authLevel: "function",
  route: "debug/deadletters",
  handler: peekDeadLetters,
});
