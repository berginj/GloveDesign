# GloveDesign Quick Reference

Fast reference for common tasks and commands.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Azurite (local storage)
azurite --silent --location ./azurite &

# Configure local settings
cp local.settings.json.example local.settings.json

# Start Functions API
npm run dev

# Run tests
npm test
```

## 📦 Common Commands

### Development
```bash
npm run dev                    # Start Functions host (port 7071)
npm run worker:dev             # Start Playwright worker (port 7072)
npm run start:cli -- <url>     # Run CLI tool with team URL
```

### Testing
```bash
npm test                       # Run all unit tests
npm run test:unit              # Run unit tests only
npm run test:integration       # Run integration tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm run test:server            # Start test fixture server
```

### Building
```bash
npm run build                  # Compile TypeScript
npm run lint                   # Lint code
npm audit                      # Check for vulnerabilities
npm audit fix                  # Fix vulnerabilities
```

### Frontend
```bash
cd frontend
npm install                    # Install frontend dependencies
npm run dev                    # Start dev server (port 5173)
npm run build                  # Build for production
```

## 🔍 Diagnostic Commands

### Check System Health
```bash
curl http://localhost:7071/api/health
```

### Check Job Status
```bash
curl http://localhost:7071/api/jobs/{jobId}
```

### Run Diagnostic Script
```bash
./scripts/diagnose-stuck-jobs.sh http://localhost:7071
```

### Check Queue Status
```bash
curl http://localhost:7071/api/debug/queue
```

### List Recent Jobs
```bash
curl http://localhost:7071/api/debug/jobs?limit=10
```

## 📝 Submit a Test Job

### Local Development
```bash
curl -X POST http://localhost:7071/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"teamUrl":"http://localhost:3000","mode":"proposal"}'
```

### Production
```bash
curl -X POST https://your-app.azurewebsites.net/api/jobs \
  -H "x-functions-key: YOUR_FUNCTION_KEY" \
  -H "Content-Type: application/json" \
  -d '{"teamUrl":"https://example.com","mode":"proposal"}'
```

## 🔧 Configuration

### Essential Environment Variables

**Local Development (local.settings.json):**
```json
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "SERVICEBUS_CONNECTION": "YOUR_CONNECTION_STRING",
    "SERVICEBUS_QUEUE": "glovejobs",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER": "glovejobs",
    "TABLE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "TABLE_NAME": "jobs"
  }
}
```

**Production (Azure App Settings):**
- `AzureWebJobsStorage` - Automatically set by Azure
- `SERVICEBUS_NAMESPACE` - e.g., `myapp.servicebus.windows.net`
- `BLOB_URL` - e.g., `https://myaccount.blob.core.windows.net`
- `COSMOS_ENDPOINT` - e.g., `https://myaccount.documents.azure.com:443/`

### Performance Tuning (Optional)
```bash
BRANDING_CRAWL_MAX_PAGES=6              # Max pages to crawl
BRANDING_CRAWL_REQUEST_DELAY_MS=150    # Rate limiting delay
LOGO_ANALYSIS_COUNT=8                   # Number of logos to analyze
```

## 🐛 Troubleshooting Quick Fixes

### Jobs Stuck at "received"
```bash
# Check if Azurite is running
ps aux | grep azurite

# Start Azurite if not running
azurite --silent --location ./azurite &

# Verify AzureWebJobsStorage in local.settings.json
grep AzureWebJobsStorage local.settings.json

# Restart Functions
# Ctrl+C to stop, then:
npm run dev
```

### Tests Failing
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run specific test
npm test -- tests/crawl.edge-cases.test.ts

# Check if Azurite is needed
npm run test:integration  # Requires Azurite
```

### Port Already in Use
```bash
# Kill process on port 7071
lsof -ti:7071 | xargs kill -9

# Or use different port
func start --port 7072
```

### Module Not Found
```bash
# Rebuild
npm run build

# Check TypeScript compilation
npx tsc --noEmit
```

## 📊 Monitoring & Logs

### View Application Insights Logs (Azure)
```kusto
traces
| where timestamp > ago(1h)
| where customDimensions.jobId == "YOUR_JOB_ID"
| project timestamp, message, customDimensions
| order by timestamp desc
```

### View Failed Jobs
```kusto
traces
| where message contains "error" or message contains "failed"
| where timestamp > ago(24h)
| project timestamp, message, customDimensions.jobId
| order by timestamp desc
```

### View Job Performance
```kusto
customMetrics
| where name == "job_duration"
| summarize avg(value), max(value), min(value) by bin(timestamp, 1h)
```

## 🚢 Deployment

### Deploy to Azure (Manual)
```bash
# Build
npm run build

# Deploy Functions
func azure functionapp publish YOUR_FUNCTION_APP_NAME

# Deploy Frontend (if using Static Web Apps)
cd frontend
npm run build
# Upload dist/ to Azure Static Web Apps
```

### Deploy via GitHub Actions
```bash
# Push to main branch
git push origin main

# Workflows will run automatically:
# - .github/workflows/ci.yml (tests)
# - .github/workflows/main_gloveapp.yml (functions)
# - .github/workflows/azure-static-web-apps-*.yml (frontend)
```

## 📚 Key Files

```
├── src/
│   ├── orchestrator/           # Durable Functions orchestration
│   ├── crawl/                  # Web crawling logic
│   ├── logo/                   # Logo detection & scoring
│   ├── colors/                 # Color extraction
│   └── common/                 # Shared utilities
├── tests/                      # Unit tests
├── test/integration/           # Integration tests
├── frontend/                   # React UI
├── docs/                       # Documentation
│   ├── PRODUCTION.md          # Deployment guide
│   ├── TROUBLESHOOTING.md     # Common issues
│   └── TESTING.md             # Test guide
├── local.settings.json        # Local config (gitignored)
└── local.settings.json.example # Config template
```

## 🔐 Security Checks

```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check for secrets
git secrets --scan

# Validate Bicep templates
az bicep build --file infra/main.bicep
```

## 📦 Release Process

```bash
# 1. Update version
npm version patch  # or minor, major

# 2. Update CHANGELOG.md
# Add entries for changes

# 3. Run full test suite
npm test
npm run test:integration

# 4. Build
npm run build

# 5. Tag and push
git push origin main --tags

# 6. Deploy
# Deployment workflows run automatically
```

## 🆘 Getting Help

- **Documentation**: See `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/berginj/GloveDesign/issues)
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Troubleshooting**: See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

**Last Updated**: 2026-02-17
**Version**: 0.1.0
