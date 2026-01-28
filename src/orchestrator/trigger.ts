import { app, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";

app.serviceBusQueue("jobQueueTrigger", {
  connection: "SERVICEBUS_CONNECTION",
  queueName: "%SERVICEBUS_QUEUE%",
  extraInputs: [df.input.durableClient()],
  handler: async (message: any, context: InvocationContext) => {
    const client = df.getClient(context) as any;
    const payload = message?.body ?? message;
    const instanceId = await client.startNew("jobOrchestrator", undefined, payload);
    context.log(`Started orchestration with ID = '${instanceId}'.`);
  },
});
