import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createJobStoreFromEnv } from "../../common/jobStore";
import { createServiceBusClient, createBlobClient } from "../../common/azureClients";

interface ConfigCheck {
  name: string;
  status: "ok" | "error" | "warning";
  message: string;
  details?: string;
}

export async function healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const checks: ConfigCheck[] = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check Job Store
  try {
    const store = createJobStoreFromEnv();
    if (store) {
      await store.init();
      checks.push({
        name: "Job Store",
        status: "ok",
        message: "Job store configured and accessible",
        details: process.env.COSMOS_ENDPOINT ? "Using Cosmos DB" : "Using Table Storage",
      });
    } else {
      checks.push({
        name: "Job Store",
        status: "error",
        message: "Job store not configured",
        details: "Set COSMOS_ENDPOINT or TABLE_CONNECTION_STRING",
      });
      overallStatus = "unhealthy";
    }
  } catch (error) {
    checks.push({
      name: "Job Store",
      status: "error",
      message: "Job store configuration error",
      details: String(error),
    });
    overallStatus = "unhealthy";
  }

  // Check Service Bus
  try {
    const serviceBusConnection = process.env.SERVICEBUS_CONNECTION;
    if (serviceBusConnection) {
      // Just check if we can create a client (don't actually send messages in health check)
      const client = createServiceBusClient(serviceBusConnection);
      await client.close();
      checks.push({
        name: "Service Bus",
        status: "ok",
        message: "Service Bus configured",
        details: `Queue: ${process.env.SERVICEBUS_QUEUE || "glovejobs"}`,
      });
    } else {
      checks.push({
        name: "Service Bus",
        status: "error",
        message: "Service Bus not configured",
        details: "Set SERVICEBUS_CONNECTION environment variable",
      });
      overallStatus = "unhealthy";
    }
  } catch (error) {
    checks.push({
      name: "Service Bus",
      status: "error",
      message: "Service Bus configuration error",
      details: String(error),
    });
    overallStatus = "unhealthy";
  }

  // Check Blob Storage
  try {
    const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
    if (blobUrl) {
      const client = createBlobClient(blobUrl);
      const containerName = process.env.BLOB_CONTAINER || "glovejobs";
      const container = client.getContainerClient(containerName);
      await container.exists();
      checks.push({
        name: "Blob Storage",
        status: "ok",
        message: "Blob storage configured and accessible",
        details: `Container: ${containerName}`,
      });
    } else {
      checks.push({
        name: "Blob Storage",
        status: "error",
        message: "Blob storage not configured",
        details: "Set BLOB_URL or BLOB_CONNECTION_STRING",
      });
      overallStatus = "unhealthy";
    }
  } catch (error) {
    checks.push({
      name: "Blob Storage",
      status: "error",
      message: "Blob storage configuration error",
      details: String(error),
    });
    overallStatus = "unhealthy";
  }

  // Check Sharp library
  try {
    const sharp = await import("sharp");
    checks.push({
      name: "Sharp Library",
      status: "ok",
      message: "Sharp image library loaded successfully",
    });
  } catch (error) {
    checks.push({
      name: "Sharp Library",
      status: "warning",
      message: "Sharp image library not available",
      details: "Color extraction will use CSS only. Consider installing platform-specific sharp binaries.",
    });
    if (overallStatus === "healthy") {
      overallStatus = "degraded";
    }
  }

  // Check environment configuration
  const envChecks: ConfigCheck = {
    name: "Environment Configuration",
    status: "ok",
    message: "All optional settings reviewed",
    details: `Cache TTL: ${process.env.BRANDING_CACHE_TTL_HOURS || "24"} hours`,
  };
  checks.push(envChecks);

  const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return {
    status: statusCode,
    jsonBody: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});
