# GloveDesign

Azure-centric proof-of-concept for extracting youth baseball team branding and generating glove design proposals with an optional Playwright autofill worker.

## Architecture
```
Client
  |
  v
POST /jobs (Functions API) ---> Service Bus queue ---> Durable Orchestrator
                                                       |-> validate + robots + crawl
                                                       |-> logo scoring + palette
                                                       |-> glove variants + proposal
                                                       |-> Blob artifacts
                                                       |-> Cosmos/Table job status
                                                       |
                                                       v
                                                Wizard Worker (Playwright)
                                                (HTTP or Service Bus job)
```

## Local development
### Prerequisites
- Node.js 20+
- Azure Functions Core Tools v4
- Azurite (Blob + Table)

### Install
```bash
npm install
```

### Run Functions host
```bash
npm run dev
```

### Run wizard worker locally
```bash
npm run worker:dev
```
Set `WORKER_HEADLESS=false` for a visible browser window.

### Local environment (Azurite)
Use `UseDevelopmentStorage=true` for Blob + Table in local settings. Example `local.settings.json` values:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "SERVICEBUS_CONNECTION": "<service bus connection string>",
    "SERVICEBUS_QUEUE": "glovejobs",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER": "glovejobs",
    "TABLE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "TABLE_NAME": "jobs",
    "WIZARD_ENDPOINT": "http://localhost:7072"
  }
}
```

### Run CLI (proposal mode locally)
```bash
npm run start:cli -- https://arlingtontravelbaseball.org/
```
Artifacts are written to `./local-output`.

## Azure deployment
### Environment variables
| Variable | Purpose |
| --- | --- |
| `SERVICEBUS_NAMESPACE` | Service Bus namespace (e.g. `<name>.servicebus.windows.net`) |
| `SERVICEBUS_QUEUE` | Queue name for job submission (default `glovejobs`) |
| `SERVICEBUS_CONNECTION` | Connection string used by Function trigger and optional worker queue |
| `WIZARD_QUEUE` | Optional wizard worker queue name (event-driven job) |
| `WIZARD_RESULTS_QUEUE` | Optional wizard results queue (default `${WIZARD_QUEUE}-results`) |
| `COSMOS_ENDPOINT` | Cosmos DB endpoint |
| `COSMOS_CONNECTION_STRING` | Optional Cosmos connection string (local dev) |
| `COSMOS_DATABASE` | Cosmos DB database name |
| `COSMOS_CONTAINER` | Cosmos DB container name |
| `BLOB_URL` | Storage account Blob endpoint |
| `BLOB_CONNECTION_STRING` | Optional Blob connection string (local dev) |
| `BLOB_CONTAINER` | Blob container name |
| `BLOB_BASE_URL` | Base URL for blob (used by wizard worker) |
| `TABLE_CONNECTION_STRING` | Optional Table connection string (local dev) |
| `TABLE_NAME` | Table name (default `jobs`) |
| `WIZARD_ENDPOINT` | Optional HTTP endpoint for Playwright worker |

### Deploy infrastructure
```bash
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters location=eastus projectName=glovedesign
```

### Deploy Functions and worker
Deploy the Function App using your preferred CI/CD (GitHub Actions or `func azure functionapp publish`).
Build and deploy the wizard worker container to Azure Container Apps Job or an HTTP-enabled container app and set `WIZARD_ENDPOINT` or `WIZARD_QUEUE` accordingly.

## Example job submission
```bash
curl -X POST https://<function-app>.azurewebsites.net/api/jobs \
  -H "x-functions-key: <key>" \
  -H "content-type: application/json" \
  -d '{"teamUrl":"https://arlingtontravelbaseball.org/","mode":"proposal"}'
```

### Example job status request
```bash
curl -X GET https://<function-app>.azurewebsites.net/api/jobs/<jobId> \
  -H "x-functions-key: <key>"
```

### Example status response (structure)
```json
{
  "jobId": "uuid",
  "teamUrl": "https://example.com",
  "mode": "proposal",
  "stage": "completed",
  "status": "Succeeded",
  "outputs": {
    "logo": { "path": "jobs/<jobId>/logo.png", "url": "https://..." },
    "palette": { "path": "jobs/<jobId>/palette.json", "url": "https://..." },
    "design": { "path": "jobs/<jobId>/glove_design.json", "url": "https://..." },
    "proposal": { "path": "jobs/<jobId>/proposal.md", "url": "https://..." },
    "crawlReport": { "path": "jobs/<jobId>/crawl_report.json", "url": "https://..." },
    "wizardSchema": { "path": "jobs/<jobId>/wizard_schema_snapshot.json", "url": "https://..." }
  },
  "autofillAttempted": false,
  "autofillSucceeded": false
}
```

## Artifact structure
- `/jobs/{jobId}/logo.(png|jpg|svg)`
- `/jobs/{jobId}/palette.json`
- `/jobs/{jobId}/glove_design.json`
- `/jobs/{jobId}/proposal.md`
- `/jobs/{jobId}/crawl_report.json`
- `/jobs/{jobId}/wizard_schema_snapshot.json` (autofill attempted)
- `/jobs/{jobId}/configured.png` (autofill success only)

## Security posture
- Input validation + SSRF mitigation (http/https only, block private IPs, DNS rebinding checks, redirect caps).
- Robots.txt best-effort compliance.
- Service Bus, Blob Storage, Cosmos DB accessed via Managed Identity when deployed.
- Durable Functions activity retries should be configured for transient failures.
- Allow/deny lists can be enforced at the API layer before enqueuing jobs.

## Design choices
- **Proposal-first**: pipeline produces a proposal without Playwright dependency.
- **Auditability**: crawl report and scoring reasons stored per job.
- **Reliability**: bounded crawl caps, timeouts, and dedicated worker for autofill.

## Testing
```bash
npm test
```
