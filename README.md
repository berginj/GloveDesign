# GloveDesign

Azure-centric proof-of-concept for extracting youth baseball team branding and generating glove design proposals.

## Architecture overview
- **API**: Azure Functions (TypeScript) accepts `POST /jobs` and enqueues jobs to Service Bus.
- **Orchestration**: Durable Functions drives validation → crawl → logo selection → color extraction → design variants → optional wizard autofill.
- **Autofill worker**: Playwright container job invoked via HTTP for optional wizard automation.
- **Storage**: Azure Blob Storage for artifacts; Cosmos DB for job status.
- **Observability**: Application Insights via structured logs (jobId correlation).

## Local development
### Prerequisites
- Node.js 20+
- Azure Functions Core Tools v4

### Install
```bash
npm install
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
| `SERVICEBUS_NAMESPACE` | Service Bus namespace URL (e.g. `https://<name>.servicebus.windows.net`) |
| `SERVICEBUS_QUEUE` | Queue name (default `glovejobs`) |
| `SERVICEBUS_CONNECTION` | Service Bus connection setting for trigger binding |
| `COSMOS_ENDPOINT` | Cosmos DB endpoint |
| `COSMOS_DATABASE` | Cosmos DB database name |
| `COSMOS_CONTAINER` | Cosmos DB container name |
| `BLOB_URL` | Storage account Blob endpoint |
| `BLOB_CONTAINER` | Blob container name |
| `BLOB_BASE_URL` | Base URL for blob (used by wizard worker) |
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
Deploy the container worker image to Azure Container Apps Jobs and set `WIZARD_ENDPOINT` to its public endpoint.

## Example job submission
```bash
curl -X POST https://<function-app>.azurewebsites.net/api/jobs \
  -H "x-functions-key: <key>" \
  -H "content-type: application/json" \
  -d '{"teamUrl":"https://arlingtontravelbaseball.org/","mode":"proposal"}'
```

## Artifact structure
- `/jobs/{jobId}/logo.(png|jpg|svg)`
- `/jobs/{jobId}/palette.json`
- `/jobs/{jobId}/glove_design.json`
- `/jobs/{jobId}/proposal.md`
- `/jobs/{jobId}/crawl_report.json`
- `/jobs/{jobId}/wizard_schema_snapshot.json` (optional)
- `/jobs/{jobId}/configured.png` (optional)

## Security posture
- Input validation + SSRF mitigation (`http/https` only, block private IPs).
- Robots.txt best-effort compliance.
- Service Bus, Blob Storage, Cosmos DB accessed via Managed Identity.
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
