import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createServiceBusAdminClient } from "../../../common/azureClients";

export async function getQueueStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const serviceBusNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
  const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";
  if (!serviceBusNamespace) {
    return { status: 400, jsonBody: { error: "SERVICEBUS_NAMESPACE or SERVICEBUS_CONNECTION is required." } };
  }
  try {
    const admin = createServiceBusAdminClient(serviceBusNamespace);
    const props = await admin.getQueueRuntimeProperties(queueName);
    return {
      status: 200,
      jsonBody: {
        queueName,
        activeMessageCount: props.activeMessageCount,
        deadLetterMessageCount: props.deadLetterMessageCount,
        totalMessageCount: props.totalMessageCount,
        transferMessageCount: props.transferMessageCount,
      },
    };
  } catch (error) {
    context.log(`Queue status failed: ${String(error)}`);
    return { status: 500, jsonBody: { error: "Failed to fetch queue status." } };
  }
}

app.http("debugQueueStatus", {
  methods: ["GET"],
  authLevel: "function",
  route: "debug/queue",
  handler: getQueueStatus,
});
