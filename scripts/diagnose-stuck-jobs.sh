#!/bin/bash

# Diagnostic script to identify why jobs are stuck
# Usage: ./scripts/diagnose-stuck-jobs.sh <api-base-url>

API_BASE=${1:-"http://localhost:7071"}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=================================="
echo "GloveDesign Job Diagnostics"
echo "=================================="
echo ""
echo "API Base: $API_BASE"
echo ""

# Check health endpoint
echo -e "${BLUE}Checking health endpoint...${NC}"
HEALTH_URL="$API_BASE/api/health"
HTTP_CODE=$(curl -s -o /tmp/health-response.json -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ Health endpoint OK${NC}"

  if command -v jq &> /dev/null; then
    STATUS=$(cat /tmp/health-response.json | jq -r '.status' 2>/dev/null)
    if [ "$STATUS" == "healthy" ]; then
      echo -e "${GREEN}✓ System is healthy${NC}"
      echo ""
      echo "Health Checks:"
      cat /tmp/health-response.json | jq -r '.checks[] | "  - \(.name): \(.status)"' 2>/dev/null
    else
      echo -e "${RED}✗ System is $STATUS${NC}"
      echo ""
      echo "Failed Checks:"
      cat /tmp/health-response.json | jq -r '.checks[] | select(.status != "ok") | "  - \(.name): \(.message)"' 2>/dev/null
    fi
  fi
else
  echo -e "${RED}✗ Health endpoint returned $HTTP_CODE${NC}"
  cat /tmp/health-response.json 2>/dev/null
fi

echo ""
echo -e "${BLUE}Checking job queue status...${NC}"
QUEUE_URL="$API_BASE/api/debug/queue"
HTTP_CODE=$(curl -s -o /tmp/queue-response.json -w "%{http_code}" "$QUEUE_URL" 2>/dev/null)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ Queue endpoint OK${NC}"

  if command -v jq &> /dev/null; then
    ACTIVE=$(cat /tmp/queue-response.json | jq -r '.activeMessageCount' 2>/dev/null)
    DEADLETTER=$(cat /tmp/queue-response.json | jq -r '.deadLetterMessageCount' 2>/dev/null)

    echo "  Active messages: $ACTIVE"
    echo "  Dead letter messages: $DEADLETTER"

    if [ "$DEADLETTER" -gt "0" ]; then
      echo -e "${RED}  ⚠ WARNING: $DEADLETTER messages in dead letter queue${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠ Queue endpoint returned $HTTP_CODE (may need function key)${NC}"
fi

echo ""
echo -e "${BLUE}Checking recent jobs...${NC}"
JOBS_URL="$API_BASE/api/debug/jobs?limit=10"
HTTP_CODE=$(curl -s -o /tmp/jobs-response.json -w "%{http_code}" "$JOBS_URL" 2>/dev/null)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ Jobs endpoint OK${NC}"

  if command -v jq &> /dev/null; then
    COUNT=$(cat /tmp/jobs-response.json | jq -r '.count' 2>/dev/null)
    echo "  Total jobs: $COUNT"
    echo ""
    echo "Job Summary:"

    # Count jobs by stage
    cat /tmp/jobs-response.json | jq -r '.jobs | group_by(.stage) | .[] | "  - \(.[0].stage): \(length) jobs"' 2>/dev/null

    # Show stuck jobs (at received for more than 5 minutes)
    echo ""
    echo -e "${YELLOW}Jobs stuck at 'received':${NC}"
    cat /tmp/jobs-response.json | jq -r '.jobs[] | select(.stage == "received") | "  - \(.jobId) (created: \(.createdAt))"' 2>/dev/null | head -5

    # Show failed jobs
    echo ""
    echo -e "${RED}Failed jobs:${NC}"
    cat /tmp/jobs-response.json | jq -r '.jobs[] | select(.stage == "failed") | "  - \(.jobId): \(.error)"' 2>/dev/null | head -5
  fi
else
  echo -e "${YELLOW}⚠ Jobs endpoint returned $HTTP_CODE (may need function key)${NC}"
fi

echo ""
echo -e "${BLUE}Checking dead letter messages...${NC}"
DEADLETTER_URL="$API_BASE/api/debug/deadletters"
HTTP_CODE=$(curl -s -o /tmp/deadletter-response.json -w "%{http_code}" "$DEADLETTER_URL" 2>/dev/null)

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✓ Dead letter endpoint OK${NC}"

  if command -v jq &> /dev/null; then
    COUNT=$(cat /tmp/deadletter-response.json | jq -r '.count' 2>/dev/null)
    if [ "$COUNT" -gt "0" ]; then
      echo -e "${RED}  Found $COUNT dead letter messages${NC}"
      echo ""
      echo "Dead Letter Messages:"
      cat /tmp/deadletter-response.json | jq -r '.messages[] | "  - Job: \(.body.jobId)\n    Reason: \(.deadLetterReason)\n    Description: \(.deadLetterErrorDescription)\n    Delivery Count: \(.deliveryCount)"' 2>/dev/null
    else
      echo -e "${GREEN}  No dead letter messages${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠ Dead letter endpoint returned $HTTP_CODE (may need function key)${NC}"
fi

echo ""
echo "=================================="
echo "Diagnosis Summary"
echo "=================================="
echo ""

# Analyze results and provide recommendations
if [ -f /tmp/health-response.json ]; then
  if command -v jq &> /dev/null; then
    STATUS=$(cat /tmp/health-response.json | jq -r '.status' 2>/dev/null)

    if [ "$STATUS" != "healthy" ]; then
      echo -e "${RED}❌ ISSUE: System is unhealthy${NC}"
      echo ""
      echo "Failed components:"
      cat /tmp/health-response.json | jq -r '.checks[] | select(.status != "ok") | "  - \(.name): \(.message)"' 2>/dev/null
      echo ""
      echo "Recommended Actions:"
      echo "  1. Check Application Insights logs for errors"
      echo "  2. Verify all environment variables are set correctly"
      echo "  3. Restart the Function App"
      echo "  4. Review docs/TROUBLESHOOTING.md"
    fi

    # Check for Durable Functions storage issue
    DF_STORAGE=$(cat /tmp/health-response.json | jq -r '.checks[] | select(.name == "Durable Functions Storage") | .status' 2>/dev/null)
    if [ "$DF_STORAGE" == "error" ]; then
      echo -e "${RED}❌ CRITICAL: AzureWebJobsStorage not configured${NC}"
      echo ""
      echo "This is the most common cause of jobs stuck at 'received'."
      echo ""
      echo "Solution:"
      echo "  1. For local dev: Start Azurite and set AzureWebJobsStorage=UseDevelopmentStorage=true"
      echo "  2. For Azure: Verify AzureWebJobsStorage is set in Function App settings"
      echo "  3. See docs/TROUBLESHOOTING.md for detailed steps"
    fi
  fi
fi

# Check for stuck jobs
if [ -f /tmp/jobs-response.json ]; then
  if command -v jq &> /dev/null; then
    STUCK_COUNT=$(cat /tmp/jobs-response.json | jq -r '.jobs[] | select(.stage == "received") | .jobId' 2>/dev/null | wc -l)
    if [ "$STUCK_COUNT" -gt "5" ]; then
      echo ""
      echo -e "${YELLOW}⚠ WARNING: $STUCK_COUNT jobs stuck at 'received' stage${NC}"
      echo ""
      echo "This usually means:"
      echo "  - Orchestrator is not starting (check AzureWebJobsStorage)"
      echo "  - Service Bus trigger is not firing"
      echo "  - Function App is not running"
    fi
  fi
fi

# Check for dead letter messages
if [ -f /tmp/deadletter-response.json ]; then
  if command -v jq &> /dev/null; then
    DL_COUNT=$(cat /tmp/deadletter-response.json | jq -r '.count' 2>/dev/null)
    if [ "$DL_COUNT" -gt "0" ]; then
      echo ""
      echo -e "${RED}❌ ISSUE: $DL_COUNT messages in dead letter queue${NC}"
      echo ""
      echo "Messages failed after 10 retry attempts."
      echo ""
      echo "Actions:"
      echo "  1. Review error details above"
      echo "  2. Fix the underlying issue"
      echo "  3. Retry failed jobs: POST $API_BASE/api/debug/retry/{jobId}"
    fi
  fi
fi

# Cleanup
rm -f /tmp/health-response.json /tmp/queue-response.json /tmp/jobs-response.json /tmp/deadletter-response.json

echo ""
echo "For more help, see docs/TROUBLESHOOTING.md"
echo ""
