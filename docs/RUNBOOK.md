# Runbook

## Troubleshooting
### Service Bus queue backlog or DLQ
- Check `glovejobs` queue depth and dead-letter counts.
- Inspect dead-lettered messages for invalid payloads or schema mismatches.
- Re-submit failed jobs after fixing validation or downstream dependencies.

### Wizard worker failures
- Confirm the worker can reach `https://bc2gloves.com/cart` without login/captcha.
- Verify `WIZARD_ENDPOINT` (HTTP mode) or `WIZARD_QUEUE` + `WIZARD_RESULTS_QUEUE` (queue mode).
- Ensure Playwright dependencies are installed in the container image and `WORKER_HEADLESS` is set appropriately.

### Blob permissions / missing artifacts
- Ensure the Function App Managed Identity has `Storage Blob Data Contributor`.
- Verify `BLOB_URL` and `BLOB_CONTAINER` are set.
- For local dev, confirm `BLOB_CONNECTION_STRING=UseDevelopmentStorage=true`.

### Cosmos/Table job status not updating
- Ensure `COSMOS_ENDPOINT` and RBAC (`Cosmos DB Built-in Data Contributor`) are configured.
- For Table Storage, confirm `TABLE_CONNECTION_STRING` and `TABLE_NAME`.
- Check Function App identity assignments and network rules.

## Operational checks
- Application Insights: filter by `jobId` to trace end-to-end pipeline steps.
- Durable Functions: check orchestration history for failed activities.
- Storage: verify `/jobs/{jobId}/` artifacts exist in Blob.
