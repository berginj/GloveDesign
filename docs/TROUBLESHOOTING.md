# Troubleshooting Guide

## Jobs Stuck in "received" Stage

**Symptoms:**
- Jobs are created and stored in job store
- Jobs stay at `"stage": "received"` forever
- Orchestrator never starts
- Dead letter messages in Service Bus queue

**Root Cause:**
The Durable Functions orchestrator cannot start because **`AzureWebJobsStorage` is not configured**.

### Why This Happens

Azure Durable Functions requires persistent storage to:
- Track orchestration state (task hub)
- Store activity execution history
- Manage replay and checkpointing

Without `AzureWebJobsStorage`, the Service Bus trigger fires but fails when trying to:
```typescript
const client = df.getClient(context);
await client.startNew("jobOrchestrator", jobId, payload);
```

This causes:
1. Exception thrown in trigger handler
2. Message redelivered (up to 10 times per Service Bus config)
3. Message moved to dead letter queue
4. Job stuck at "received" stage

---

## Solution: Configure AzureWebJobsStorage

### For Local Development

**Step 1: Install Azurite**
```bash
npm install -g azurite
```

**Step 2: Start Azurite**
```bash
# Start in a separate terminal
azurite --silent --location ./azurite

# Or run in background
azurite --silent --location ./azurite --debug ./azurite/debug.log &
```

**Step 3: Create `local.settings.json`**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SERVICEBUS_CONNECTION": "<your-service-bus-connection-string>",
    "SERVICEBUS_QUEUE": "glovejobs",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER": "glovejobs",
    "TABLE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "TABLE_NAME": "jobs",
    "COSMOS_ENDPOINT": "",
    "COSMOS_DATABASE": "",
    "COSMOS_CONTAINER": ""
  }
}
```

**Step 4: Restart Function App**
```bash
# Stop current instance (Ctrl+C)
# Start again
npm run dev
```

**Step 5: Verify**
```bash
# Check startup diagnostics in console
# Should show: [OK] AzureWebJobsStorage: Using local development storage

# Test health endpoint
curl http://localhost:7071/api/health

# Should show all services as "ok"
```

---

### For Azure Production

**AzureWebJobsStorage should be automatically set** when you create a Function App in Azure. To verify:

**Option 1: Azure Portal**
1. Go to Azure Portal → Your Function App
2. Click "Configuration" in left sidebar
3. Look for `AzureWebJobsStorage` in Application Settings
4. Should be set to a connection string like: `DefaultEndpointsProtocol=https;AccountName=...`

**Option 2: Azure CLI**
```bash
az functionapp config appsettings list \
  --name <function-app-name> \
  --resource-group <resource-group> \
  --query "[?name=='AzureWebJobsStorage']"
```

**If Missing (rare), set it:**
```bash
az functionapp config appsettings set \
  --name <function-app-name> \
  --resource-group <resource-group> \
  --settings "AzureWebJobsStorage=<storage-connection-string>"
```

**Get storage connection string:**
```bash
az storage account show-connection-string \
  --name <storage-account-name> \
  --resource-group <resource-group> \
  --query connectionString \
  --output tsv
```

---

## Diagnostic Tools

### 1. Startup Diagnostics

When the Function App starts, it automatically runs configuration checks:

```
================================================================================
GLOVE DESIGN - STARTUP DIAGNOSTICS
================================================================================

Configuration Checks:
--------------------------------------------------------------------------------
✓ [OK      ] AzureWebJobsStorage: Configured with Azure Storage Account
✓ [OK      ] FUNCTIONS_WORKER_RUNTIME: Set to 'node'
✓ [OK      ] Service Bus: Queue: glovejobs
✓ [OK      ] Job Store: Using Cosmos DB
✓ [OK      ] Blob Storage: Configured
✓ [OK      ] Node.js Version: v20.11.0
--------------------------------------------------------------------------------

✅ ALL CHECKS PASSED
   Configuration looks good!
================================================================================
```

**If you see errors**, the console output will tell you exactly what's missing.

---

### 2. Health Check Endpoint

```bash
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T...",
  "checks": [
    {
      "name": "Durable Functions Storage",
      "status": "ok",
      "message": "AzureWebJobsStorage configured",
      "details": "Using Azure Storage Account"
    },
    {
      "name": "Durable Functions Client",
      "status": "ok",
      "message": "Durable Functions client initialized successfully",
      "details": "Orchestrations can be started"
    },
    // ... more checks
  ]
}
```

**Unhealthy Example:**
```json
{
  "status": "unhealthy",
  "checks": [
    {
      "name": "Durable Functions Storage",
      "status": "error",
      "message": "AzureWebJobsStorage not configured - Durable Functions CANNOT run",
      "details": "Set AzureWebJobsStorage environment variable..."
    }
  ]
}
```

---

### 3. Debug Endpoints

**View Queue Status:**
```bash
GET /api/debug/queue
```

**View Dead Letter Messages:**
```bash
GET /api/debug/deadletters
```

**View Durable Orchestration Status:**
```bash
GET /api/debug/durable/{instanceId}?history=true
```

**Retry Failed Job:**
```bash
POST /api/debug/retry/{jobId}
```

---

## Common Error Messages

### "Durable Functions client is null"

**Cause:** `AzureWebJobsStorage` not configured
**Solution:** Follow steps above to configure storage

---

### "Failed to get Durable Functions client"

**Cause:** Storage is configured but unreachable (Azurite not running, network issue)
**Solution:**
- Local: Ensure Azurite is running (`azurite --silent --location ./azurite`)
- Azure: Check storage account exists and Function App has network access

---

### "MaxDeliveryCountExceeded"

**Cause:** Service Bus message failed 10 times and moved to dead letter
**Solution:**
1. Fix the underlying issue (usually storage config)
2. Retry the job: `POST /api/debug/retry/{jobId}`
3. Or manually process dead letter messages

---

### "Job store not configured"

**Cause:** Neither `COSMOS_ENDPOINT` nor `TABLE_CONNECTION_STRING` is set
**Solution:** Configure at least one:
```bash
# Option 1: Cosmos DB
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_DATABASE=glovejobs
COSMOS_CONTAINER=jobs

# Option 2: Table Storage
TABLE_CONNECTION_STRING=<connection-string>
TABLE_NAME=jobs
```

---

## Logs to Check

### Application Insights (Production)

Query for orchestrator errors:
```kusto
traces
| where message contains "jobQueueTrigger"
    or message contains "[Orchestrator]"
| where severityLevel >= 2  // Warning or higher
| order by timestamp desc
| take 100
```

### Local Logs (Development)

The Function App console shows:
- Startup diagnostics
- `[jobQueueTrigger]` messages when Service Bus messages arrive
- `[Orchestrator]` messages during orchestration execution
- Activity execution logs

**Look for:**
- `Failed to get Durable Functions client` → Storage issue
- `jobQueueTrigger FAILED` → Trigger errors
- `Job store not configured` → Missing Cosmos/Table config

---

## Still Not Working?

1. **Restart Everything:**
   ```bash
   # Kill Azurite
   pkill azurite

   # Kill Function App
   # (Ctrl+C in terminal)

   # Start Azurite
   azurite --silent --location ./azurite &

   # Wait 5 seconds

   # Start Function App
   npm run dev
   ```

2. **Check Environment Variables:**
   ```bash
   # Verify all required env vars are set
   env | grep -E '(AZURE|SERVICEBUS|BLOB|COSMOS|TABLE)'
   ```

3. **Clear Azurite Data:**
   ```bash
   rm -rf ./azurite
   mkdir ./azurite
   azurite --silent --location ./azurite &
   ```

4. **Test with Debug Endpoint:**
   ```bash
   # Bypass queue and start orchestrator directly
   POST /api/debug/start
   {
     "teamUrl": "https://example.com",
     "mode": "proposal"
   }

   # Should return immediately with jobId and start orchestration
   ```

---

## Prevention

To avoid this issue in the future:

1. **Use `local.settings.json` template** - Copy from `local.settings.json.example`
2. **Run health check before testing** - `GET /api/health`
3. **Watch startup diagnostics** - Check console output for errors
4. **Use infrastructure as code** - Bicep/Terraform ensures all resources exist
5. **Set up monitoring** - Application Insights alerts for orchestration failures
