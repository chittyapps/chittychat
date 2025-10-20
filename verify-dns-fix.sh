#!/bin/bash
# ChittyCorp CI/CD DNS Verification Script
# Run this after DNS records have been created in Cloudflare Dashboard

set -e

echo "🔍 ChittyCorp CI/CD DNS & Service Verification"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Services to test
SERVICES=(
  "id.chitty.cc"
  "portal.chitty.cc"
  "auth.chitty.cc"
  "registry.chitty.cc"
  "sync.chitty.cc"
  "api.chitty.cc"
  "ai.chitty.cc"
  "langchain.chitty.cc"
  "mcp.chitty.cc"
  "cases.chitty.cc"
)

dns_pass=0
dns_fail=0
health_pass=0
health_fail=0

echo "📋 Phase 1: DNS Resolution Tests"
echo "--------------------------------"
for service in "${SERVICES[@]}"; do
  echo -n "Testing $service... "

  if nslookup "$service" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS OK${NC}"
    ((dns_pass++))
  else
    echo -e "${RED}✗ DNS FAIL${NC}"
    ((dns_fail++))
  fi
done

echo ""
echo "📋 Phase 2: Service Health Checks"
echo "---------------------------------"
for service in "${SERVICES[@]}"; do
  echo -n "Testing https://$service/health... "

  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$service/health" 2>/dev/null || echo "000")

  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ HTTP $response${NC}"
    ((health_pass++))
  else
    echo -e "${RED}✗ HTTP $response${NC}"
    ((health_fail++))
  fi
done

echo ""
echo "📊 Summary"
echo "==========="
echo -e "DNS Resolution:  ${GREEN}$dns_pass passed${NC} / ${RED}$dns_fail failed${NC}"
echo -e "Health Checks:   ${GREEN}$health_pass passed${NC} / ${RED}$health_fail failed${NC}"
echo ""

if [ $dns_fail -eq 0 ] && [ $health_fail -eq 0 ]; then
  echo -e "${GREEN}✅ All services are operational!${NC}"
  exit 0
elif [ $dns_fail -gt 0 ]; then
  echo -e "${YELLOW}⚠️  DNS records still missing. Please create wildcard CNAME in Cloudflare Dashboard.${NC}"
  echo "See DNS-RECORDS-NEEDED.md for instructions."
  exit 1
else
  echo -e "${YELLOW}⚠️  DNS is working but some services have health check failures.${NC}"
  echo "Check service logs for details."
  exit 1
fi
