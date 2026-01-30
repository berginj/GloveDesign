import { app, InvocationContext } from "@azure/functions";
import { createServiceBusClient } from "../common/azureClients";
import { createJobStoreFromEnv } from "../common/jobStore";
import { JobStage } from "../common/types";
import { logError, logInfo, logWarn } from "../common/logging";

const DEFAULT_SCHEDULE = "0 */5 * * * *"; // every 5 minutes

const RETRYABLE_STAGES: JobStage[] = ["received", "queued"];
const STALL_STAGES: JobStage[] = [
  "validated",
  "crawled",
  "logo_selected",
  "colors_extracted",
  "design_generated",
  "wizard_attempted",
];

app.timer("jobSweeper", {
  schedule: process.env.BRANDING_SWEEPER_SCHEDULE ?? DEFAULT_SCHEDULE,
  handler: async (_timer: unknown, context: InvocationContext) => {
    if (process.env.BRANDING_SWEEPER_ENABLED === "false") {
      return;
    }

    const retryMinutes = parseInt(process.env.BRANDING_SWEEPER_RETRY_MINUTES ?? "5", 10);
    const failMinutes = parseInt(process.env.BRANDING_SWEEPER_FAIL_MINUTES ?? "20", 10);
    const maxRetries = parseInt(process.env.BRANDING_SWEEPER_MAX_RETRIES ?? "2", 10);
    const limit = Math.min(Math.max(parseInt(process.env.BRANDING_SWEEPER_LIMIT ?? "25", 10) || 25, 1), 200);

    const store = createJobStoreFromEnv();
    if (!store) {
      logWarn("sweeper_no_store", { stage: "sweeper" }, { message: "Job store not configured." });
      return;
    }

    await store.init();
    const now = Date.now();
    const retryCutoff = new Date(now - retryMinutes * 60 * 1000).toISOString();
    const failCutoff = new Date(now - failMinutes * 60 * 1000).toISOString();

    const retryJobs = await store.listStaleJobs(RETRYABLE_STAGES, retryCutoff, limit);
    const stallJobs = await store.listStaleJobs(STALL_STAGES, failCutoff, limit);

    let sender: ReturnType<ReturnType<typeof createServiceBusClient>["createSender"]> | null = null;
    let sbClient: ReturnType<typeof createServiceBusClient> | null = null;
    const serviceBusConnection = process.env.SERVICEBUS_CONNECTION || process.env.SERVICEBUS_NAMESPACE;
    const queueName = process.env.SERVICEBUS_QUEUE || "glovejobs";

    if (retryJobs.length && serviceBusConnection) {
      sbClient = createServiceBusClient(serviceBusConnection);
      sender = sbClient.createSender(queueName);
    }

    for (const job of retryJobs) {
      const nextRetry = (job.retryCount ?? 0) + 1;
      if (!sender) {
        await store.updateStage(job.jobId, "failed", {
          error: "Service Bus not configured. Job cannot be retried automatically.",
          retryCount: nextRetry,
          lastRetryAt: new Date().toISOString(),
        });
        logWarn("sweeper_retry_no_servicebus", { jobId: job.jobId, stage: "sweeper" }, { queueName });
        continue;
      }

      if (nextRetry > maxRetries) {
        await store.updateStage(job.jobId, "failed", {
          error: `Job exceeded auto-retry limit (${maxRetries}).`,
          retryCount: nextRetry,
          lastRetryAt: new Date().toISOString(),
        });
        logWarn("sweeper_retry_exceeded", { jobId: job.jobId, stage: "sweeper" }, { retryCount: nextRetry });
        continue;
      }

      try {
        await sender.sendMessages({
          body: { jobId: job.jobId, teamUrl: job.teamUrl, mode: job.mode },
          contentType: "application/json",
        });
        await store.updateStage(job.jobId, "queued", {
          retryCount: nextRetry,
          lastRetryAt: new Date().toISOString(),
        });
        logInfo("sweeper_requeued", { jobId: job.jobId, stage: "sweeper" }, { retryCount: nextRetry });
      } catch (error) {
        logError("sweeper_requeue_failed", { jobId: job.jobId, stage: "sweeper" }, { error: String(error) });
      }
    }

    for (const job of stallJobs) {
      const error = `Job stalled in stage '${job.stage}' for more than ${failMinutes} minutes.`;
      await store.updateStage(job.jobId, "failed", { error });
      logWarn("sweeper_stalled_job", { jobId: job.jobId, stage: "sweeper" }, { previousStage: job.stage });
    }

    if (sender) {
      await sender.close();
    }
    if (sbClient) {
      await sbClient.close();
    }

    context.log(
      `[jobSweeper] Completed. Retry candidates: ${retryJobs.length}. Stalled candidates: ${stallJobs.length}.`
    );
  },
});
