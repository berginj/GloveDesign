#!/bin/bash

# GloveDesign Deployment Verification Script
# This script checks if your Azure deployment is configured correctly

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

RESOURCE_GROUP=${1:-"GloveDesigner_group"}
FUNCTION_APP=${2:-"GloveApp"}

echo "=================================="
echo "GloveDesign Deployment Verification"
echo "=================================="
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo "Function App: $FUNCTION_APP"
echo ""

# Function to print status
print_status() {
  local status=$1
  local message=$2
  if [ "$status" == "OK" ]; then
    echo -e "${GREEN}✓ [OK]${NC} $message"
  elif [ "$status" == "WARN" ]; then
    echo -e "${YELLOW}⚠ [WARN]${NC} $message"
  else
    echo -e "${RED}✗ [ERROR]${NC} $message"
  fi
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  print_status "ERROR" "Azure CLI not installed. Install from https://aka.ms/azure-cli"
  exit 1
fi
print_status "OK" "Azure CLI installed"

# Check if logged in
if ! az account show &> /dev/null; then
  print_status "ERROR" "Not logged in to Azure. Run: az login"
  exit 1
fi
print_status "OK" "Logged in to Azure"

echo ""
echo "Checking Azure Resources..."
echo "----------------------------------"

# Check if Function App exists
if az functionapp show --resource-group "$RESOURCE_GROUP" --name "$FUNCTION_APP" &> /dev/null; then
  print_status "OK" "Function App exists: $FUNCTION_APP"
else
  print_status "ERROR" "Function App not found: $FUNCTION_APP"
  exit 1
fi

# Check Function App state
STATE=$(az functionapp show --resource-group "$RESOURCE_GROUP" --name "$FUNCTION_APP" --query "state" -o tsv 2>/dev/null)
if [ "$STATE" == "Running" ]; then
  print_status "OK" "Function App is running"
else
  print_status "ERROR" "Function App state: $STATE (expected: Running)"
fi

echo ""
echo "Checking Configuration..."
echo "----------------------------------"

# Get app settings
SETTINGS=$(az functionapp config appsettings list --resource-group "$RESOURCE_GROUP" --name "$FUNCTION_APP" -o json 2>/dev/null)

# Check critical settings
check_setting() {
  local setting_name=$1
  local required=$2

  if echo "$SETTINGS" | jq -e ".[] | select(.name==\"$setting_name\")" > /dev/null 2>&1; then
    print_status "OK" "$setting_name is configured"
  else
    if [ "$required" == "true" ]; then
      print_status "ERROR" "$setting_name is NOT configured (REQUIRED)"
    else
      print_status "WARN" "$setting_name is NOT configured (optional)"
    fi
  fi
}

check_setting "AzureWebJobsStorage" "true"
check_setting "FUNCTIONS_WORKER_RUNTIME" "true"
check_setting "SERVICEBUS_NAMESPACE" "true"
check_setting "SERVICEBUS_QUEUE" "true"
check_setting "COSMOS_ENDPOINT" "true"
check_setting "COSMOS_DATABASE" "true"
check_setting "COSMOS_CONTAINER" "true"
check_setting "BLOB_URL" "true"
check_setting "BLOB_CONTAINER" "true"
check_setting "BRANDING_CACHE_TTL_HOURS" "false"

echo ""
echo "Checking Health Endpoint..."
echo "----------------------------------"

# Get Function App hostname
HOSTNAME=$(az functionapp show --resource-group "$RESOURCE_GROUP" --name "$FUNCTION_APP" --query "defaultHostName" -o tsv 2>/dev/null)
if [ -z "$HOSTNAME" ]; then
  print_status "ERROR" "Could not resolve Function App hostname"
  exit 1
fi
print_status "OK" "Hostname: $HOSTNAME"

# Check health endpoint
HEALTH_URL="https://$HOSTNAME/api/health"
echo "Checking: $HEALTH_URL"

HTTP_CODE=$(curl -s -o /tmp/health-check.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)
if [ "$HTTP_CODE" == "200" ]; then
  print_status "OK" "Health endpoint returned 200"

  # Parse health check response
  if command -v jq &> /dev/null; then
    HEALTH_STATUS=$(cat /tmp/health-check.json | jq -r '.status' 2>/dev/null)
    if [ "$HEALTH_STATUS" == "healthy" ]; then
      print_status "OK" "System is healthy"
      echo ""
      echo "Health Check Details:"
      cat /tmp/health-check.json | jq '.checks[] | "  - \(.name): \(.status)"' -r 2>/dev/null || cat /tmp/health-check.json
    else
      print_status "ERROR" "System is unhealthy: $HEALTH_STATUS"
      echo ""
      echo "Health Check Details:"
      cat /tmp/health-check.json | jq '.' 2>/dev/null || cat /tmp/health-check.json
      exit 1
    fi
  else
    echo "  (Install jq for detailed health check analysis)"
    cat /tmp/health-check.json
  fi
else
  print_status "ERROR" "Health endpoint returned $HTTP_CODE (expected 200)"
  echo ""
  echo "Response:"
  cat /tmp/health-check.json 2>/dev/null || echo "(no response body)"
  exit 1
fi

echo ""
echo "Checking Functions..."
echo "----------------------------------"

# List functions
FUNCTIONS=$(az functionapp function list --resource-group "$RESOURCE_GROUP" --name "$FUNCTION_APP" -o json 2>/dev/null)
FUNCTION_COUNT=$(echo "$FUNCTIONS" | jq length 2>/dev/null || echo "0")

if [ "$FUNCTION_COUNT" -gt "0" ]; then
  print_status "OK" "Found $FUNCTION_COUNT functions deployed"

  # Check for critical functions
  check_function() {
    local func_name=$1
    if echo "$FUNCTIONS" | jq -e ".[] | select(.name==\"$func_name\")" > /dev/null 2>&1; then
      print_status "OK" "  ✓ $func_name"
    else
      print_status "WARN" "  ✗ $func_name (not found)"
    fi
  }

  check_function "submitJob"
  check_function "getJob"
  check_function "jobQueueTrigger"
  check_function "jobOrchestrator"
  check_function "healthCheck"
else
  print_status "ERROR" "No functions found (build may have failed)"
  exit 1
fi

echo ""
echo "Checking Service Bus..."
echo "----------------------------------"

# Get Service Bus namespace from settings
SB_NAMESPACE=$(echo "$SETTINGS" | jq -r '.[] | select(.name=="SERVICEBUS_NAMESPACE") | .value' 2>/dev/null)
if [ -z "$SB_NAMESPACE" ] || [ "$SB_NAMESPACE" == "null" ]; then
  print_status "WARN" "SERVICEBUS_NAMESPACE not found in settings, skipping queue check"
else
  # Extract namespace name (remove .servicebus.windows.net)
  SB_NAME=$(echo "$SB_NAMESPACE" | sed 's/.servicebus.windows.net//')

  # Try to get queue info
  if az servicebus queue show --resource-group "$RESOURCE_GROUP" --namespace-name "$SB_NAME" --name "glovejobs" &> /dev/null; then
    print_status "OK" "Service Bus queue 'glovejobs' exists"

    # Get queue metrics
    ACTIVE=$(az servicebus queue show --resource-group "$RESOURCE_GROUP" --namespace-name "$SB_NAME" --name "glovejobs" --query "countDetails.activeMessageCount" -o tsv 2>/dev/null || echo "?")
    DEADLETTER=$(az servicebus queue show --resource-group "$RESOURCE_GROUP" --namespace-name "$SB_NAME" --name "glovejobs" --query "countDetails.deadLetterMessageCount" -o tsv 2>/dev/null || echo "?")

    echo "  Active messages: $ACTIVE"
    echo "  Dead letter messages: $DEADLETTER"

    if [ "$DEADLETTER" != "0" ] && [ "$DEADLETTER" != "?" ]; then
      print_status "WARN" "Dead letter queue has $DEADLETTER messages"
    fi
  else
    print_status "WARN" "Could not verify Service Bus queue (may need permissions)"
  fi
fi

echo ""
echo "=================================="
echo "Verification Complete!"
echo "=================================="
echo ""
echo "Next Steps:"
echo "  1. Test job submission:"
echo "     curl -X POST https://$HOSTNAME/api/jobs \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"teamUrl\": \"https://example.com\", \"mode\": \"proposal\"}'"
echo ""
echo "  2. Monitor logs:"
echo "     az functionapp log tail --resource-group $RESOURCE_GROUP --name $FUNCTION_APP"
echo ""
echo "  3. Check Application Insights for detailed telemetry"
echo ""

# Cleanup
rm -f /tmp/health-check.json

exit 0
