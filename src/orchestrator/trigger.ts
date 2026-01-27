import { app, InvocationContext } from "@azure/functions";
import * as df from "durable-functions";

app.serviceBusQueue("jobQueueTrigger", {
  connection: "SERVICEBUS_CONNECTION",
  queueName: "%SERVICEBUS_QUEUE%",
  handler: async (message: any, context: InvocationContext) => {
    const client = df.getClient(context);
    const instanceId = await client.startNew("jobOrchestrator", undefined, message);
    context.log(`Started orchestration with ID = '${instanceId}'.`);
  },
});
