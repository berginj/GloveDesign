# Production Deployment Guide

## Pre-Deployment Checklist

### Required Azure Resources

Verify all resources are provisioned via `infra/main.bicep`:
- ✅ **Storage Account** - For AzureWebJobsStorage and blob artifacts
- ✅ **Service Bus Namespace** - For job queue and wizard queues
- ✅ **Cosmos DB Account** - For job tracking
- ✅ **Function App (Flex)** - For orchestration and API
- ✅ **Application Insights** - For monitoring and diagnostics
- ✅ **Container Apps Environment** - For wizard worker jobs

### Required Environment Variables

**Function App Settings:**
```bash
# Critical (Required)
AzureWebJobsStorage=<storage-connection-string>
FUNCTIONS_WORKER_RUNTIME=node
SERVICEBUS_NAMESPACE=<namespace>.servicebus.windows.net
SERVICEBUS_QUEUE=glovejobs
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/
COSMOS_DATABASE=glovejobs
COSMOS_CONTAINER=jobs
BLOB_URL=https://<account>.blob.core.windows.net
BLOB_CONTAINER=glovejobs

# Optional (with defaults)
BRANDING_CACHE_TTL_HOURS=24
BRANDING_IN_PROGRESS_TTL_MINUTES=15
WIZARD_QUEUE=wizardjobs
WIZARD_RESULTS_QUEUE=wizardjobs-results
```

### Verify Managed Identity Permissions

The Function App and Container Job need these role assignments:

**Function App:**
- `Storage Blob Data Contributor` on Storage Account
- `Azure Service Bus Data Owner` on Service Bus
- `Cosmos DB Built-in Data Contributor` on Cosmos DB

**Container Job (Wizard Worker):**
- `Storage Blob Data Contributor` on Storage Account
- `Azure Service Bus Data Owner` on Service Bus

---

## Deployment Process

### 1. Deploy Infrastructure

```bash
cd infra
az deployment group create \
  --resource-group <resource-group> \
  --template-file main.bicep \
  --parameters projectName=<project-name>
```

### 2. Verify Configuration

After infrastructure deployment, check health endpoint:

```bash
curl https://<function-app>.azurewebsites.net/api/health
```

Expected response (HTTP 200):
```json
{
  "status": "healthy",
  "checks": [
    {"name": "Durable Functions Storage", "status": "ok"},
    {"name": "Durable Functions Client", "status": "ok"},
    {"name": "Job Store", "status": "ok"},
    {"name": "Service Bus", "status": "ok"},
    {"name": "Blob Storage", "status": "ok"}
  ]
}
```

### 3. Deploy Function Code

GitHub Actions automatically deploys on push to `main` branch.

Manual deployment:
```bash
npm run build
func azure functionapp publish <function-app-name>
```

### 4. Post-Deployment Verification

**Check Startup Diagnostics:**
- Go to Azure Portal → Function App → Log Stream
- Look for startup diagnostics output with all ✓ OK

**Test Job Submission:**
```bash
curl -X POST https://<function-app>.azurewebsites.net/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"teamUrl": "https://example.com", "mode": "proposal"}'
```

**Verify Orchestration:**
```bash
# Get job ID from above, then check status
curl https://<function-app>.azurewebsites.net/api/jobs/<job-id>
```

Job should progress through stages:
`received → validation → crawling → logo_selection → color_extraction → completed`

---

## Monitoring & Alerts

### Application Insights Queries

**1. Jobs Stuck at "received" Stage**

Query to find jobs that haven't progressed:
```kusto
customEvents
| where name == "job_stage_updated"
| extend jobId = tostring(customDimensions.jobId), stage = tostring(customDimensions.stage)
| summarize LastStage = arg_max(timestamp, stage) by jobId
| where LastStage == "received" and timestamp < ago(5m)
| count
```

**Alert Condition:** Count > 5

**2. Dead Letter Messages**

Query for dead letter messages in Service Bus:
```kusto
traces
| where message contains "dead letter" or message contains "MaxDeliveryCountExceeded"
| where timestamp > ago(1h)
| count
```

**Alert Condition:** Count > 0

**3. Orchestrator Failures**

Query for failed orchestrations:
```kusto
traces
| where message contains "[Orchestrator]" and message contains "FAILED"
| where timestamp > ago(15m)
| project timestamp, message, severityLevel
```

**Alert Condition:** Count > 3

**4. High Job Processing Time**

Query for jobs taking too long:
```kusto
customEvents
| where name == "job_stage_updated" and customDimensions.stage == "completed"
| extend duration = todouble(customDimensions.durationMs)
| where duration > 300000  // 5 minutes
| summarize count(), avg(duration) by bin(timestamp, 1h)
```

**Alert Condition:** Average duration > 5 minutes

**5. Health Check Failures**

Query for unhealthy health checks:
```kusto
requests
| where url endswith "/api/health"
| where resultCode != "200"
| where timestamp > ago(15m)
| count
```

**Alert Condition:** Count > 2

### Recommended Alert Rules

Create these alerts in Azure Monitor:

| Alert Name | Severity | Threshold | Action |
|------------|----------|-----------|---------|
| Jobs Stuck at Received | Sev 2 | >5 jobs for 5min | Email + SMS |
| Dead Letter Messages | Sev 1 | >0 in 1hr | Email + SMS |
| Orchestrator Failures | Sev 2 | >3 in 15min | Email |
| High Processing Time | Sev 3 | >5min avg | Email |
| Health Check Failures | Sev 1 | >2 in 15min | Email + SMS |
| Storage Errors | Sev 2 | >10 in 15min | Email |

---

## Operational Procedures

### Retry Failed Jobs

If a job fails and goes to dead letter:

**Option 1: Retry via API**
```bash
POST https://<function-app>.azurewebsites.net/api/debug/retry/<job-id>
```

**Option 2: Requeue Dead Letter Message**
```bash
POST https://<function-app>.azurewebsites.net/api/debug/requeue
```

### Clear Stuck Jobs

If many jobs are stuck at "received" stage:

1. **Check health endpoint** to identify the issue
2. **Fix configuration** (usually AzureWebJobsStorage or Service Bus)
3. **Restart Function App**:
   ```bash
   az functionapp restart --resource-group <rg> --name <app>
   ```
4. **Monitor Log Stream** for startup diagnostics
5. **Requeue stuck jobs** if they don't auto-process:
   ```bash
   POST https://<function-app>.azurewebsites.net/api/debug/requeue
   ```

### Scale Configuration

**Function App (Consumption/Flex Plan):**
- Auto-scales based on queue depth
- Max instances: 100 (default), increase if needed
- Monitor `Function Execution Count` metric

**Service Bus Queue:**
- Max delivery count: 10
- Lock duration: 5 minutes
- Enable partitioning for high throughput

**Cosmos DB:**
- Free tier: 1000 RU/s
- Monitor RU consumption
- Scale if seeing throttling (429 errors)

---

## Troubleshooting

### Issue: All Jobs Stuck at "received"

**Root Cause:** Orchestrator not starting (usually AzureWebJobsStorage not configured)

**Solution:**
1. Check health endpoint: `GET /api/health`
2. Verify `AzureWebJobsStorage` is set in Function App settings
3. Check startup diagnostics in Log Stream
4. Restart Function App
5. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for details

### Issue: High Dead Letter Count

**Root Cause:** Messages failing repeatedly (configuration, validation, or external service errors)

**Solution:**
1. Check dead letter messages: `GET /api/debug/deadletters`
2. Review error details in Application Insights
3. Fix underlying issue
4. Retry failed jobs: `POST /api/debug/retry/<job-id>`

### Issue: Jobs Failing at Specific Stage

**Root Causes by Stage:**
- **validation**: Invalid URLs, blocked ports
- **crawling**: Website unreachable, timeout (2min limit)
- **logo_selection**: No images found, blob storage issue
- **color_extraction**: Sharp library failure, blob storage issue

**Solution:**
1. Check job details: `GET /api/jobs/<job-id>`
2. Review `errorDetails` field
3. Check activity logs in Application Insights:
   ```kusto
   traces
   | where customDimensions.jobId == "<job-id>"
   | order by timestamp desc
   ```

---

## Performance Tuning

### Optimize Cold Starts

**Function App Settings:**
```bash
# Reduce cold starts
WEBSITE_RUN_FROM_PACKAGE=1
FUNCTIONS_EXTENSION_VERSION=~4
AzureWebJobsFeatureFlags=EnableWorkerIndexing

# Pre-warm instances (Premium plan only)
WEBSITE_PRELOAD_ENABLED=1
```

### Optimize Crawler Performance

**Environment Variables:**
```bash
# Reduce crawl timeout if sites are slow
CRAWL_TIMEOUT_MS=120000  # 2 minutes (default)

# Limit pages crawled per job
MAX_PAGES_PER_CRAWL=50
```

### Optimize Blob Storage

**Enable CDN** for artifact URLs (palette JSON, logo images):
- Reduces latency for frontend fetches
- Offloads bandwidth from Function App

---

## Security Best Practices

### 1. Lock Down Debug Endpoints

Debug endpoints require function key (`authLevel: "function"`):

```bash
# Get function key
az functionapp function keys list \
  --resource-group <rg> \
  --name <app> \
  --function-name debugListJobs

# Use with requests
curl https://<app>.azurewebsites.net/api/debug/jobs?code=<key>
```

**Production:** Consider IP restrictions on debug endpoints.

### 2. Enable Defender for Cloud

Monitor for security threats:
- Azure Portal → Defender for Cloud
- Enable for Storage, Functions, Cosmos DB, Service Bus

### 3. Rotate Secrets Regularly

**Managed Identity** (Recommended):
- No secrets to rotate
- Already configured in Bicep

**Connection Strings** (If used):
- Rotate every 90 days
- Use Key Vault for storage
- Update Function App settings after rotation

### 4. Enable Diagnostic Logs

Send all logs to Log Analytics:
```bash
az monitor diagnostic-settings create \
  --resource <function-app-resource-id> \
  --name "AllLogsToLogAnalytics" \
  --workspace <log-analytics-workspace-id> \
  --logs '[{"category": "FunctionAppLogs", "enabled": true}]' \
  --metrics '[{"category": "AllMetrics", "enabled": true}]'
```

---

## Cost Optimization

### Estimated Monthly Costs

**Development:**
- Function App (Consumption): ~$5-10
- Storage (LRS): ~$5
- Service Bus (Standard): ~$10
- Cosmos DB (Free tier): $0
- **Total: ~$20-25/month**

**Production (1000 jobs/month):**
- Function App (Consumption): ~$20-30
- Storage (LRS): ~$10-15
- Service Bus (Standard): ~$10
- Cosmos DB (Autoscale): ~$25-50
- Application Insights: ~$10
- **Total: ~$75-125/month**

### Cost Reduction Tips

1. **Use Free Tiers:**
   - Cosmos DB: 1000 RU/s free tier
   - Application Insights: First 5GB/month free

2. **Optimize Storage:**
   - Set blob lifecycle policy (delete old artifacts after 30 days)
   - Use Archive tier for long-term retention

3. **Cache Branding Results:**
   - Default TTL: 24 hours
   - Reduces redundant crawls for same team URLs
   - Adjust: `BRANDING_CACHE_TTL_HOURS=48`

4. **Right-Size Cosmos DB:**
   - Start with 400 RU/s manual throughput
   - Switch to autoscale only if throttling occurs

---

## Disaster Recovery

### Backup Strategy

**Cosmos DB:**
- Automatic backups enabled (30 days retention)
- Point-in-time restore available

**Blob Storage:**
- Enable soft delete (7-day retention)
- Consider geo-redundant storage (GRS) for critical data

### Recovery Procedures

**Restore Deleted Jobs:**
```bash
# Cosmos DB point-in-time restore
az cosmosdb restore \
  --target-database-account-name <account>-restored \
  --account-name <account> \
  --restore-timestamp "2024-01-29T12:00:00Z" \
  --resource-group <rg>
```

**Restore Deleted Artifacts:**
```bash
# Blob soft delete recovery
az storage blob undelete \
  --account-name <account> \
  --container-name glovejobs \
  --name <blob-name>
```

---

## Support Contacts

**Azure Support:**
- Portal: https://portal.azure.com → Support
- Phone: 1-800-642-7676

**Application Issues:**
- GitHub: https://github.com/berginj/GloveDesign/issues
- Email: [Your support email]

**Escalation:**
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review Application Insights logs
3. Open GitHub issue with logs and error details
4. Contact Azure support for infrastructure issues
