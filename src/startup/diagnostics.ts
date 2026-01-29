/**
 * Startup diagnostics to validate critical configuration
 * This runs when the Function App starts to catch configuration issues early
 */

export function runStartupDiagnostics(): void {
  console.log("=".repeat(80));
  console.log("GLOVE DESIGN - STARTUP DIAGNOSTICS");
  console.log("=".repeat(80));

  const checks: Array<{ name: string; status: "OK" | "WARNING" | "ERROR"; message: string }> = [];

  // Check 1: AzureWebJobsStorage (CRITICAL for Durable Functions)
  const storageConnectionString = process.env.AzureWebJobsStorage || process.env.AZUREWEBJOBSSTORAGE;
  if (!storageConnectionString) {
    checks.push({
      name: "AzureWebJobsStorage",
      status: "ERROR",
      message: "NOT CONFIGURED - Durable Functions WILL NOT WORK. Set AzureWebJobsStorage env var."
    });
  } else if (storageConnectionString === "UseDevelopmentStorage=true") {
    checks.push({
      name: "AzureWebJobsStorage",
      status: "OK",
      message: "Using local development storage (Azurite). Ensure Azurite is running."
    });
  } else if (storageConnectionString.includes("AccountName=devstoreaccount1")) {
    checks.push({
      name: "AzureWebJobsStorage",
      status: "OK",
      message: "Using Azurite connection string. Ensure Azurite is running."
    });
  } else {
    checks.push({
      name: "AzureWebJobsStorage",
      status: "OK",
      message: "Configured with Azure Storage Account"
    });
  }

  // Check 2: FUNCTIONS_WORKER_RUNTIME
  const runtime = process.env.FUNCTIONS_WORKER_RUNTIME;
  if (!runtime) {
    checks.push({
      name: "FUNCTIONS_WORKER_RUNTIME",
      status: "WARNING",
      message: "Not set. Should be 'node' for Node.js functions."
    });
  } else if (runtime === "node") {
    checks.push({
      name: "FUNCTIONS_WORKER_RUNTIME",
      status: "OK",
      message: `Set to '${runtime}'`
    });
  } else {
    checks.push({
      name: "FUNCTIONS_WORKER_RUNTIME",
      status: "WARNING",
      message: `Set to '${runtime}', expected 'node'`
    });
  }

  // Check 3: Service Bus Configuration
  const serviceBusConnection = process.env.SERVICEBUS_CONNECTION;
  const serviceBusQueue = process.env.SERVICEBUS_QUEUE;
  if (!serviceBusConnection) {
    checks.push({
      name: "Service Bus",
      status: "ERROR",
      message: "SERVICEBUS_CONNECTION not configured. Job queue will not work."
    });
  } else if (!serviceBusQueue) {
    checks.push({
      name: "Service Bus",
      status: "WARNING",
      message: "SERVICEBUS_QUEUE not set. Using default 'glovejobs'."
    });
  } else {
    checks.push({
      name: "Service Bus",
      status: "OK",
      message: `Queue: ${serviceBusQueue}`
    });
  }

  // Check 4: Job Store (Cosmos or Table)
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT || process.env.COSMOS_CONNECTION_STRING;
  const tableConnection = process.env.TABLE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cosmosEndpoint && !tableConnection) {
    checks.push({
      name: "Job Store",
      status: "ERROR",
      message: "Neither COSMOS_ENDPOINT nor TABLE_CONNECTION_STRING configured. Job tracking will fail."
    });
  } else if (cosmosEndpoint) {
    checks.push({
      name: "Job Store",
      status: "OK",
      message: "Using Cosmos DB"
    });
  } else {
    checks.push({
      name: "Job Store",
      status: "OK",
      message: "Using Table Storage"
    });
  }

  // Check 5: Blob Storage
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  if (!blobUrl) {
    checks.push({
      name: "Blob Storage",
      status: "ERROR",
      message: "Neither BLOB_URL nor BLOB_CONNECTION_STRING configured. Artifact storage will fail."
    });
  } else {
    checks.push({
      name: "Blob Storage",
      status: "OK",
      message: "Configured"
    });
  }

  // Check 6: Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split(".")[0].replace("v", ""));
  if (majorVersion < 18) {
    checks.push({
      name: "Node.js Version",
      status: "WARNING",
      message: `${nodeVersion} detected. Recommend Node.js 18 or higher.`
    });
  } else {
    checks.push({
      name: "Node.js Version",
      status: "OK",
      message: nodeVersion
    });
  }

  // Print results
  console.log("\nConfiguration Checks:");
  console.log("-".repeat(80));

  let hasErrors = false;
  let hasWarnings = false;

  for (const check of checks) {
    const symbol = check.status === "OK" ? "✓" : check.status === "WARNING" ? "⚠" : "✗";
    const status = check.status.padEnd(8);
    console.log(`${symbol} [${status}] ${check.name}: ${check.message}`);

    if (check.status === "ERROR") hasErrors = true;
    if (check.status === "WARNING") hasWarnings = true;
  }

  console.log("-".repeat(80));

  if (hasErrors) {
    console.log("\n❌ CRITICAL ERRORS DETECTED");
    console.log("   The application may not function correctly. Please fix the ERROR items above.");
    console.log("   For local development:");
    console.log("   1. Run: npm install -g azurite");
    console.log("   2. Run: azurite --silent --location ./azurite");
    console.log("   3. Create local.settings.json with AzureWebJobsStorage=UseDevelopmentStorage=true");
    console.log("   4. Restart the function app");
  } else if (hasWarnings) {
    console.log("\n⚠️  WARNINGS DETECTED");
    console.log("   The application should work but review the WARNING items above.");
  } else {
    console.log("\n✅ ALL CHECKS PASSED");
    console.log("   Configuration looks good!");
  }

  console.log("=".repeat(80));
  console.log("");

  // In production, fail fast if critical errors exist
  if (hasErrors && process.env.NODE_ENV === "production") {
    console.error("\n🛑 ABORTING: Critical configuration errors in production environment");
    process.exit(1);
  }
}
