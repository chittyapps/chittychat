#!/bin/bash
# Create wildcard DNS record using Cloudflare Global API Key

set -e

# Load credentials
CLOUDFLARE_API_KEY=$(op read "op://Private/gxyne23yqngvk2nzjwl62uakx4/ChittyCorp LLC/global_api_key")
CLOUDFLARE_EMAIL="nick@chittycorp.com"
ZONE_ID="7a4f759e0928fb2be4772a2f72ad0df2"

echo "🌐 Creating wildcard DNS record: *.chitty.cc → chitty.cc"
echo ""

# Create the DNS record
response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "X-Auth-Email: ${CLOUDFLARE_EMAIL}" \
  -H "X-Auth-Key: ${CLOUDFLARE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "*",
    "content": "chitty.cc",
    "proxied": true,
    "ttl": 1,
    "comment": "Wildcard CNAME for all ChittyOS subdomains - proxied through Cloudflare"
  }')

# Check result
if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
  echo "✅ DNS record created successfully!"
  echo ""
  echo "$response" | jq -r '.result | "Record ID: \(.id)\nName: \(.name)\nContent: \(.content)\nProxied: \(.proxied)"'
  echo ""
  echo "🎉 All subdomains will now resolve!"
  exit 0
else
  echo "❌ Failed to create DNS record"
  echo ""
  echo "$response" | jq .
  exit 1
fi
