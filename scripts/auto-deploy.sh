#!/bin/bash
# Automated deployment script for ChittyOS Project Initiation Service
# Usage: ./scripts/auto-deploy.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to staging if no environment specified
ENVIRONMENT="${1:-staging}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ChittyOS Project Initiation - Auto Deploy          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"
echo ""

# Pre-deployment checks
echo -e "${BLUE}=== Pre-Deployment Checks ===${NC}"

# Check wrangler installed
if ! command -v wrangler &> /dev/null; then
  echo -e "${RED}❌ Wrangler not installed${NC}"
  echo "Install: npm install -g wrangler"
  exit 1
fi
echo -e "${GREEN}✅ Wrangler installed${NC}"

# Check wrangler.toml exists
if [ ! -f "wrangler.optimized.toml" ]; then
  echo -e "${RED}❌ wrangler.optimized.toml not found${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Configuration file found${NC}"

# Check required files
REQUIRED_FILES=(
  "src/services/project-initiation.js"
  "src/platform-worker.js"
  "package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Missing required file: $file${NC}"
    exit 1
  fi
done
echo -e "${GREEN}✅ All required files present${NC}"

# Check dependencies
echo -e "\n${BLUE}=== Checking Dependencies ===${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm ci
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Validate secrets
echo -e "\n${BLUE}=== Validating Secrets ===${NC}"

# Check CLOUDFLARE_API_TOKEN
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  CLOUDFLARE_API_TOKEN not set in environment${NC}"
  echo "Set with: export CLOUDFLARE_API_TOKEN=your-token"
  echo "Or secrets will be used from wrangler"
fi

# Check GITHUB_TOKEN
GITHUB_TOKEN_SET=$(wrangler secret list --env "$ENVIRONMENT" 2>/dev/null | grep -c "GITHUB_TOKEN" || echo "0")
if [ "$GITHUB_TOKEN_SET" = "0" ]; then
  echo -e "${YELLOW}⚠️  GITHUB_TOKEN secret not set${NC}"
  echo "Set with: wrangler secret put GITHUB_TOKEN --env $ENVIRONMENT"
else
  echo -e "${GREEN}✅ GITHUB_TOKEN configured${NC}"
fi

# Check CHITTY_ID_TOKEN
CHITTY_TOKEN_SET=$(wrangler secret list --env "$ENVIRONMENT" 2>/dev/null | grep -c "CHITTY_ID_TOKEN" || echo "0")
if [ "$CHITTY_TOKEN_SET" = "0" ]; then
  echo -e "${YELLOW}⚠️  CHITTY_ID_TOKEN secret not set${NC}"
  echo "Set with: wrangler secret put CHITTY_ID_TOKEN --env $ENVIRONMENT"
else
  echo -e "${GREEN}✅ CHITTY_ID_TOKEN configured${NC}"
fi

# Check ChittyID service health
echo -e "\n${BLUE}=== Checking ChittyOS Services ===${NC}"

CHITTYID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://id.chitty.cc/health)
if [ "$CHITTYID_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ ChittyID service healthy${NC}"
else
  echo -e "${RED}❌ ChittyID service unhealthy (HTTP $CHITTYID_STATUS)${NC}"
  echo "Cannot proceed without ChittyID service"
  exit 1
fi

# Check ChittyRouter (optional)
ROUTER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://router.chitty.cc/health)
if [ "$ROUTER_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ ChittyRouter service healthy${NC}"
else
  echo -e "${YELLOW}⚠️  ChittyRouter service degraded (HTTP $ROUTER_STATUS)${NC}"
fi

# Run tests
echo -e "\n${BLUE}=== Running Tests ===${NC}"

# Start dev server for testing
echo "Starting dev server..."
npm run dev &
DEV_PID=$!
sleep 10

# Run tests
echo "Running integration tests..."
BASE_URL="http://localhost:8787" AUTH_TOKEN="test-token" node test-project-initiation.js || {
  echo -e "${RED}❌ Tests failed${NC}"
  kill $DEV_PID 2>/dev/null
  exit 1
}

# Stop dev server
kill $DEV_PID 2>/dev/null
echo -e "${GREEN}✅ Tests passed${NC}"

# Deployment confirmation
echo -e "\n${BLUE}=== Ready to Deploy ===${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Service: ${YELLOW}project-initiation${NC}"
echo -e "Version: ${YELLOW}1.0.0${NC}"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT${NC}"
  echo -e "${RED}This will deploy to live production environment!${NC}"
  echo ""
  read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " -r
  echo
  if [[ ! $REPLY =~ ^yes$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
  fi
fi

# Deploy
echo -e "\n${BLUE}=== Deploying to $ENVIRONMENT ===${NC}"

wrangler deploy --env "$ENVIRONMENT" || {
  echo -e "${RED}❌ Deployment failed${NC}"
  exit 1
}

# Wait for deployment
echo "Waiting for deployment to stabilize..."
sleep 20

# Post-deployment verification
echo -e "\n${BLUE}=== Post-Deployment Verification ===${NC}"

# Determine URL based on environment
if [ "$ENVIRONMENT" = "production" ]; then
  BASE_URL="https://initiate.chitty.cc"
elif [ "$ENVIRONMENT" = "staging" ]; then
  BASE_URL="https://staging-initiate.chitty.cc"
else
  BASE_URL="https://$ENVIRONMENT.chitty.cc"
fi

# Health check
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed (HTTP $HEALTH_STATUS)${NC}"
else
  echo -e "${RED}❌ Health check failed (HTTP $HEALTH_STATUS)${NC}"
  echo "Consider rollback: wrangler rollback --env $ENVIRONMENT"
  exit 1
fi

# Secure health check
if [ -n "$CHITTY_ID_TOKEN" ]; then
  SECURE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/secure" -H "Authorization: Bearer $CHITTY_ID_TOKEN")
  if [ "$SECURE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Secure health check passed${NC}"
  else
    echo -e "${YELLOW}⚠️  Secure health check degraded (HTTP $SECURE_STATUS)${NC}"
  fi
fi

# Smoke tests
echo -e "\n${BLUE}=== Running Smoke Tests ===${NC}"

BASE_URL="$BASE_URL" AUTH_TOKEN="${CHITTY_ID_TOKEN:-test-token}" node test-project-initiation.js || {
  echo -e "${RED}❌ Smoke tests failed${NC}"
  echo "Service is deployed but may have issues"
  exit 1
}

# Register in ChittyRegistry (production only)
if [ "$ENVIRONMENT" = "production" ] && [ -n "$CHITTY_ID_TOKEN" ]; then
  echo -e "\n${BLUE}=== Registering in ChittyRegistry ===${NC}"

  DEPLOY_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  curl -X POST https://registry.chitty.cc/api/register \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
    -d "{
      \"serviceId\": \"chittychat.project.initiation\",
      \"name\": \"Project Initiation Service\",
      \"version\": \"1.0.0\",
      \"endpoint\": \"https://initiate.chitty.cc\",
      \"capabilities\": [\"github\", \"ai\", \"chittysync\", \"ledger\", \"projects-v2\"],
      \"healthEndpoint\": \"https://initiate.chitty.cc/health\",
      \"deployedAt\": \"$DEPLOY_TIME\"
    }" > /dev/null 2>&1 && echo -e "${GREEN}✅ Registered in ChittyRegistry${NC}" || echo -e "${YELLOW}⚠️  Registry update skipped${NC}"
fi

# Success summary
echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Successful! 🎉                    ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "URL: ${GREEN}$BASE_URL${NC}"
echo -e "Health: ${GREEN}$BASE_URL/health${NC}"
echo -e "Deployed at: ${GREEN}$(date)${NC}"
echo ""
echo -e "Next steps:"
echo "  1. Monitor logs: wrangler tail --env $ENVIRONMENT"
echo "  2. Check metrics in Cloudflare dashboard"
echo "  3. Test with real project kickoff"
echo ""
