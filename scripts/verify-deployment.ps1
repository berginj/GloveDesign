# GloveDesign Deployment Verification Script (PowerShell)
# This script checks if your Azure deployment is configured correctly

param(
    [string]$ResourceGroup = "GloveDesigner_group",
    [string]$FunctionApp = "GloveApp"
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )

    switch ($Status) {
        "OK" {
            Write-Host "✓ [OK]" -ForegroundColor Green -NoNewline
            Write-Host " $Message"
        }
        "WARN" {
            Write-Host "⚠ [WARN]" -ForegroundColor Yellow -NoNewline
            Write-Host " $Message"
        }
        "ERROR" {
            Write-Host "✗ [ERROR]" -ForegroundColor Red -NoNewline
            Write-Host " $Message"
        }
    }
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "GloveDesign Deployment Verification" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Function App: $FunctionApp"
Write-Host ""

# Check if Azure CLI is installed
try {
    az --version | Out-Null
    Write-Status "OK" "Azure CLI installed"
} catch {
    Write-Status "ERROR" "Azure CLI not installed. Install from https://aka.ms/azure-cli"
    exit 1
}

# Check if logged in
try {
    az account show | Out-Null
    Write-Status "OK" "Logged in to Azure"
} catch {
    Write-Status "ERROR" "Not logged in to Azure. Run: az login"
    exit 1
}

Write-Host ""
Write-Host "Checking Azure Resources..." -ForegroundColor Cyan
Write-Host "----------------------------------"

# Check if Function App exists
try {
    az functionapp show --resource-group $ResourceGroup --name $FunctionApp | Out-Null
    Write-Status "OK" "Function App exists: $FunctionApp"
} catch {
    Write-Status "ERROR" "Function App not found: $FunctionApp"
    exit 1
}

# Check Function App state
$state = az functionapp show --resource-group $ResourceGroup --name $FunctionApp --query "state" -o tsv 2>$null
if ($state -eq "Running") {
    Write-Status "OK" "Function App is running"
} else {
    Write-Status "ERROR" "Function App state: $state (expected: Running)"
}

Write-Host ""
Write-Host "Checking Configuration..." -ForegroundColor Cyan
Write-Host "----------------------------------"

# Get app settings
$settings = az functionapp config appsettings list --resource-group $ResourceGroup --name $FunctionApp -o json 2>$null | ConvertFrom-Json

function Check-Setting {
    param(
        [string]$SettingName,
        [bool]$Required = $true
    )

    $setting = $settings | Where-Object { $_.name -eq $SettingName }
    if ($setting) {
        Write-Status "OK" "$SettingName is configured"
    } else {
        if ($Required) {
            Write-Status "ERROR" "$SettingName is NOT configured (REQUIRED)"
        } else {
            Write-Status "WARN" "$SettingName is NOT configured (optional)"
        }
    }
}

Check-Setting "AzureWebJobsStorage"
Check-Setting "FUNCTIONS_WORKER_RUNTIME"
Check-Setting "SERVICEBUS_NAMESPACE"
Check-Setting "SERVICEBUS_QUEUE"
Check-Setting "COSMOS_ENDPOINT"
Check-Setting "COSMOS_DATABASE"
Check-Setting "COSMOS_CONTAINER"
Check-Setting "BLOB_URL"
Check-Setting "BLOB_CONTAINER"
Check-Setting "BRANDING_CACHE_TTL_HOURS" -Required $false

Write-Host ""
Write-Host "Checking Health Endpoint..." -ForegroundColor Cyan
Write-Host "----------------------------------"

# Get Function App hostname
$hostname = az functionapp show --resource-group $ResourceGroup --name $FunctionApp --query "defaultHostName" -o tsv 2>$null
if (-not $hostname) {
    Write-Status "ERROR" "Could not resolve Function App hostname"
    exit 1
}
Write-Status "OK" "Hostname: $hostname"

# Check health endpoint
$healthUrl = "https://$hostname/api/health"
Write-Host "Checking: $healthUrl"

try {
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Status "OK" "Health endpoint returned 200"

        $health = $response.Content | ConvertFrom-Json
        if ($health.status -eq "healthy") {
            Write-Status "OK" "System is healthy"
            Write-Host ""
            Write-Host "Health Check Details:"
            foreach ($check in $health.checks) {
                Write-Host "  - $($check.name): $($check.status)"
            }
        } else {
            Write-Status "ERROR" "System is unhealthy: $($health.status)"
            Write-Host ""
            Write-Host "Health Check Details:"
            $health | ConvertTo-Json -Depth 10
            exit 1
        }
    }
} catch {
    Write-Status "ERROR" "Health endpoint request failed: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host "Checking Functions..." -ForegroundColor Cyan
Write-Host "----------------------------------"

# List functions
$functions = az functionapp function list --resource-group $ResourceGroup --name $FunctionApp -o json 2>$null | ConvertFrom-Json
$functionCount = $functions.Count

if ($functionCount -gt 0) {
    Write-Status "OK" "Found $functionCount functions deployed"

    function Check-Function {
        param([string]$FunctionName)

        $func = $functions | Where-Object { $_.name -eq $FunctionName }
        if ($func) {
            Write-Status "OK" "  ✓ $FunctionName"
        } else {
            Write-Status "WARN" "  ✗ $FunctionName (not found)"
        }
    }

    Check-Function "submitJob"
    Check-Function "getJob"
    Check-Function "jobQueueTrigger"
    Check-Function "jobOrchestrator"
    Check-Function "healthCheck"
} else {
    Write-Status "ERROR" "No functions found (build may have failed)"
    exit 1
}

Write-Host ""
Write-Host "Checking Service Bus..." -ForegroundColor Cyan
Write-Host "----------------------------------"

# Get Service Bus namespace from settings
$sbNamespace = ($settings | Where-Object { $_.name -eq "SERVICEBUS_NAMESPACE" }).value
if (-not $sbNamespace) {
    Write-Status "WARN" "SERVICEBUS_NAMESPACE not found in settings, skipping queue check"
} else {
    # Extract namespace name (remove .servicebus.windows.net)
    $sbName = $sbNamespace -replace '.servicebus.windows.net', ''

    try {
        az servicebus queue show --resource-group $ResourceGroup --namespace-name $sbName --name "glovejobs" | Out-Null
        Write-Status "OK" "Service Bus queue 'glovejobs' exists"

        # Get queue metrics
        $queueInfo = az servicebus queue show --resource-group $ResourceGroup --namespace-name $sbName --name "glovejobs" -o json 2>$null | ConvertFrom-Json
        $active = $queueInfo.countDetails.activeMessageCount
        $deadletter = $queueInfo.countDetails.deadLetterMessageCount

        Write-Host "  Active messages: $active"
        Write-Host "  Dead letter messages: $deadletter"

        if ($deadletter -gt 0) {
            Write-Status "WARN" "Dead letter queue has $deadletter messages"
        }
    } catch {
        Write-Status "WARN" "Could not verify Service Bus queue (may need permissions)"
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:"
Write-Host "  1. Test job submission:"
Write-Host "     curl -X POST https://$hostname/api/jobs ``"
Write-Host "       -H 'Content-Type: application/json' ``"
Write-Host "       -d '{\"teamUrl\": \"https://example.com\", \"mode\": \"proposal\"}'"
Write-Host ""
Write-Host "  2. Monitor logs:"
Write-Host "     az functionapp log tail --resource-group $ResourceGroup --name $FunctionApp"
Write-Host ""
Write-Host "  3. Check Application Insights for detailed telemetry"
Write-Host ""

exit 0
