#!/bin/bash

# Update Cloudflare Email Routing to use unified email-worker
# This consolidates multiple workers into one efficient system

set -e

echo "📧 Updating ChittyChat Email Routes..."

# Check for required environment variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "⚠️  Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first"
    exit 1
fi

ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=chitty.cc" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

echo "Zone ID: $ZONE_ID"

# Addresses to consolidate to email-worker
CONSOLIDATE_ADDRESSES=(
    "chico@chitty.cc"
    "support@chitty.cc"
    "receipts@chitty.cc"
    "bills@chitty.cc"
    "nick@chitty.cc"
    "city@chitty.cc"
    "loft@chitty.cc"
    "cozy@chitty.cc"
    "villa@chitty.cc"
    "bcc@chitty.cc"
    "finance@chitty.cc"
)

# Keep separate (special handling)
KEEP_SEPARATE=(
    "chitcommit@chitty.cc"  # Git commits
    "gayle@chitty.cc"       # Personal
    "tony@chitty.cc"        # Personal
)

echo ""
echo "📝 Addresses to route to unified email-worker:"
for addr in "${CONSOLIDATE_ADDRESSES[@]}"; do
    echo "  ✓ $addr"
done

echo ""
echo "🔒 Keeping separate routing for:"
for addr in "${KEEP_SEPARATE[@]}"; do
    echo "  • $addr"
done

echo ""
echo "Current routing configuration:"
echo "================================"
echo "chico@     → email-worker ✅ (already correct)"
echo "support@   → chitty-cc-email-worker (needs update)"
echo "receipts@  → chitty-cc-email-worker-production (needs update)"
echo "bills@     → chitty-cc-email-worker-production (needs update)"
echo "nick@      → chitty-cc-intake (needs update)"
echo ""
echo "New addresses to add:"
echo "city@, loft@, cozy@, villa@, bcc@, finance@"
echo ""
echo "To update routes in Cloudflare Dashboard:"
echo "1. Go to Email > Email Routing"
echo "2. Update each address to use 'email-worker'"
echo "3. Add new addresses for property and tracking"
echo ""
echo "Or use this API command for each address:"
echo ""
echo "curl -X PUT \"https://api.cloudflare.com/client/v4/zones/\$ZONE_ID/email/routing/rules/{rule_id}\" \\"
echo "  -H \"Authorization: Bearer \$CLOUDFLARE_API_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  --data '{\"actions\":[{\"type\":\"worker\",\"value\":[\"email-worker\"]}]}'"