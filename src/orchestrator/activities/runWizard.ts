import axios from "axios";
import { createBlobClient, createServiceBusClient } from "../../common/azureClients";
import { writeBlob } from "../../common/storage";
import { GloveDesign, WizardResult } from "../../common/types";

export default async function runWizardActivity(input: { jobId: string; design: GloveDesign; logoBlobPath?: string }): Promise<WizardResult> {
  const endpoint = process.env.WIZARD_ENDPOINT;
  const wizardQueue = process.env.WIZARD_QUEUE;
  if (endpoint) {
    try {
      const response = await axios.post(
        endpoint,
        {
          jobId: input.jobId,
          design: input.design,
          blobBaseUrl: process.env.BLOB_BASE_URL,
          logoBlobPath: input.logoBlobPath,
        },
        { timeout: 120000 }
      );
      return response.data as WizardResult;
    } catch (error) {
      return buildFallbackResult(input.jobId, `Wizard endpoint failed: ${String(error)}`);
    }
  }

  if (wizardQueue) {
    try {
      const sbNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
      if (!sbNamespace) {
        return buildFallbackResult(input.jobId, "Service Bus not configured for wizard queue.");
      }
      const client = createServiceBusClient(sbNamespace);
      const sender = client.createSender(wizardQueue);
      const replyQueue = process.env.WIZARD_RESULTS_QUEUE || `${wizardQueue}-results`;
      await sender.sendMessages({
        body: {
          jobId: input.jobId,
          design: input.design,
          blobBaseUrl: process.env.BLOB_BASE_URL,
          logoBlobPath: input.logoBlobPath,
        },
        correlationId: input.jobId,
        replyTo: replyQueue,
      });
      await sender.close();

      const receiver = client.createReceiver(replyQueue);
      const received = await receiver.receiveMessages(1, { maxWaitTimeInMs: 120000 });
      if (!received.length) {
        await receiver.close();
        await client.close();
        return buildFallbackResult(input.jobId, "Wizard worker timed out waiting for response.");
      }
      const message = received[0];
      if (message.correlationId !== input.jobId) {
        await receiver.abandonMessage(message);
        await receiver.close();
        await client.close();
        return buildFallbackResult(input.jobId, "Wizard worker returned mismatched response.");
      }
      await receiver.completeMessage(message);
      await receiver.close();
      await client.close();
      return message.body as WizardResult;
    } catch (error) {
      return buildFallbackResult(input.jobId, `Wizard queue failed: ${String(error)}`);
    }
  }

  return buildFallbackResult(input.jobId, "No wizard endpoint or queue configured.");
}

async function buildFallbackResult(jobId: string, reason: string): Promise<WizardResult> {
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  const warnings = [reason];
  const manualSteps = defaultManualSteps();
  if (!blobUrl) {
    return {
      schemaSnapshot: { path: `jobs/${jobId}/wizard_schema_snapshot.json`, url: "" },
      warnings,
      manualSteps,
      autofillAttempted: true,
      autofillSucceeded: false,
    };
  }
  const client = createBlobClient(blobUrl);
  const result = await writeBlob(
    client,
    containerName,
    `jobs/${jobId}/wizard_schema_snapshot.json`,
    JSON.stringify({ error: reason, manualSteps }, null, 2),
    "application/json",
    jobId,
    "wizard"
  );
  return {
    schemaSnapshot: { path: result.path, url: result.url },
    warnings,
    manualSteps,
    autofillAttempted: true,
    autofillSucceeded: false,
  };
}

function defaultManualSteps(): string[] {
  return [
    "Open https://bc2gloves.com/cart and start the glove wizard.",
    "Select glove model and size, then choose colors matching the proposal palette.",
    "Upload the logo from the job artifacts.",
    "Review the preview and adjust contrast if any panel colors blend together.",
    "Save screenshots of the configuration for approval.",
  ];
}
