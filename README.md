# GloveDesign

Azure-centric proof-of-concept for extracting youth baseball team branding and generating glove design proposals with an optional Playwright autofill worker.

## What this project does (in plain English)
- You send a team website URL.
- The system crawls a few pages, finds the best logo, and extracts colors.
- It creates three glove design variants (A/B/C).
- It stores all outputs in Azure Blob Storage and tracks job status.
- If you choose `autofill`, a Playwright worker tries to fill out the BC2 Gloves wizard. If it cannot, the job still finishes with a proposal and manual steps.

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

### Run the customizer UI (placeholder)
The front-end scaffolding lives in `frontend/` (Vite + React).
```bash
cd frontend
npm install
npm run dev
```
The UI uses the shared catalog JSON for now and calls the APIs later.
See `docs/CUSTOMIZER.md` for the product spec, data model, and option engine notes.
To change the checkout handoff link, set `VITE_ORDER_URL` before running:
```bash
VITE_ORDER_URL=https://aka.ms/myorder npm run dev
```
To enable the team branding scan on the start page, point the UI to the Functions API:
```bash
VITE_API_BASE=https://<function-app>.azurewebsites.net VITE_FUNCTION_KEY=<optional> npm run dev
```
In production (SWA), set `VITE_API_BASE` as a GitHub Actions variable and `VITE_FUNCTION_KEY` as a secret so the build can inject them.

## Azure deployment
## Azure components you must deploy
These are the building blocks in Azure. Think of them like Lego pieces the app snaps together:
1) Azure Functions (Function App)
   - Runs the API and Durable Functions orchestration.
   - Receives `POST /jobs` and `GET /jobs/{jobId}`.
2) Azure Service Bus (Queue)
   - Holds incoming job messages so work can run in the background.
3) Azure Storage Account (Blob)
   - Stores the artifacts under `/jobs/{jobId}/`.
4) Cosmos DB (or Table Storage)
   - Stores job status and progress.
5) Application Insights
   - Collects logs and traces. Every log includes `jobId`.
6) Container Apps Job (wizard worker)
   - Runs Playwright automation (optional).

If you deploy with `infra/main.bicep`, the template creates all of the above.

## Integration guide (step-by-step)
### 1) Deploy the Azure resources
Use the Bicep template:
```bash
az group create --name glovedesign-rg --location eastus
az deployment group create \
  --resource-group glovedesign-rg \
  --template-file infra/main.bicep \
  --parameters location=eastus projectName=glovedesign
```

### 2) Configure Function App settings
The Function App needs these settings (see table below). Most are filled in by Bicep, but add the ones you need:
- If you want queue-based worker: set `WIZARD_QUEUE` and `WIZARD_RESULTS_QUEUE`.
- If you want HTTP worker: set `WIZARD_ENDPOINT`.

### 3) Deploy the Function App
Use your preferred method, for example:
```bash
func azure functionapp publish <function-app-name>
```

### 4) Build and deploy the wizard worker (optional)
The worker can be triggered in two ways:
- HTTP mode: deploy the container and set `WIZARD_ENDPOINT` to its URL.
- Queue mode: deploy the container and set `WIZARD_QUEUE` + `WIZARD_RESULTS_QUEUE`.

Docker build (example):
```bash
docker build -f worker/Dockerfile -t glovedesign-wizard:latest .
```

### 5) Submit a job
```bash
curl -X POST https://<function-app>.azurewebsites.net/api/jobs \
  -H "x-functions-key: <key>" \
  -H "content-type: application/json" \
  -d '{"teamUrl":"https://arlingtontravelbaseball.org/","mode":"proposal"}'
```
Response:
```json
{ "jobId": "uuid" }
```

### 6) Poll job status
```bash
curl -X GET https://<function-app>.azurewebsites.net/api/jobs/<jobId> \
  -H "x-functions-key: <key>"
```
When the job finishes, `status` becomes `Succeeded` or `Failed`.

### 7) Read artifacts
Artifacts are written to Blob Storage under:
```
/jobs/{jobId}/
```
Look for:
- `logo.(png|jpg|svg)`
- `palette.json`
- `glove_design.json`
- `proposal.md`
- `crawl_report.json`
- `wizard_schema_snapshot.json` (autofill attempted)
- `configured.png` (autofill success only)

## How the data flows
1) API validates the URL (SSRF checks).
2) Job is queued in Service Bus.
3) Durable Functions runs each stage:
   - validate input
   - robots + terms check
   - crawl pages
   - score logo
   - extract colors
   - generate designs
   - write artifacts
   - optional autofill worker
4) Job status is stored in Cosmos DB or Table Storage.

## Environment variables
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
az group create --name glovedesign-rg --location eastus
az deployment group create \
  --resource-group glovedesign-rg \
  --template-file infra/main.bicep \
  --parameters location=eastus projectName=glovedesign
```

### Deploy infrastructure via GitHub Actions (recommended)
This repo includes `.github/workflows/deploy-infra.yml`. It uses Azure OIDC (no long-lived secrets).

1) Create a service principal with access to your resource group (Contributor is enough).
2) Add a federated credential for your GitHub repo/branch.
3) Add GitHub repository secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
4) Add GitHub repository variables (optional defaults are already in the workflow):
   - `AZURE_RESOURCE_GROUP` (example: `glovedesign-rg`)
   - `AZURE_LOCATION` (example: `eastus`)
   - `PROJECT_NAME` (example: `glovedesign`)
   - `WIZARD_IMAGE` (example: `ghcr.io/your-org/glove-wizard:latest`)
5) Run the workflow manually (this repo does not auto-deploy infra on push).

### Deploy Functions via GitHub Actions (manual)
This repo includes `.github/workflows/deploy-functions.yml` for the Function App.

1) Add GitHub repository secrets:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
2) Add GitHub repository variables:
   - `FUNCTION_APP_NAME` (example: `gloveapp-b4f0gvapbye9eda2`)
   - `AZURE_RESOURCE_GROUP` (example: `glovedesign-rg`)
3) Run the workflow manually.

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

## Troubleshooting (quick fixes)
- Job stays in `Running`
  - Check Service Bus queue length and dead-letter messages.
  - Verify the Function App has access to Service Bus and Storage.
- No artifacts in Blob Storage
  - Confirm `BLOB_URL` and `BLOB_CONTAINER`.
  - Ensure Function App identity has `Storage Blob Data Contributor`.
- Wizard autofill never runs
  - If using HTTP: verify `WIZARD_ENDPOINT` is reachable.
  - If using queues: verify `WIZARD_QUEUE` and `WIZARD_RESULTS_QUEUE`.
- Wizard autofill fails immediately
  - Site may be blocked or require a login/captcha (this is expected; proposal-only still works).
