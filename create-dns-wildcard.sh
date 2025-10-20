#!/bin/bash
# ChittyCorp CI/CD - Create Wildcard DNS Record
# Creates *.chitty.cc → chitty.cc CNAME with Cloudflare proxy

set -e

ZONE_ID="7a4f759e0928fb2be4772a2f72ad0df2"  # chitty.cc zone ID

echo "🌐 ChittyCorp CI/CD - Wildcard DNS Setup"
echo "========================================"
echo ""

# Check if API token is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ ERROR: CLOUDFLARE_API_TOKEN environment variable not set"
  echo ""
  echo "To create an API token:"
  echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
  echo "2. Click 'Create Token'"
  echo "3. Use 'Edit zone DNS' template"
  echo "4. Set permissions: Zone → DNS → Edit, Zone → Zone → Read"
  echo "5. Set zone resources to: chitty.cc"
  echo "6. Create token and copy it"
  echo ""
  echo "Then run:"
  echo "  export CLOUDFLARE_API_TOKEN='your_token_here'"
  echo "  $0"
  exit 1
fi

echo "✓ API token found"
echo ""

# Create wildcard CNAME record
echo "📝 Creating wildcard CNAME: *.chitty.cc → chitty.cc"
response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "*",
    "content": "chitty.cc",
    "proxied": true,
    "ttl": 1,
    "comment": "Wildcard CNAME for all ChittyOS subdomains - proxied through Cloudflare"
  }')

# Check if successful
if echo "$response" | grep -q '"success":true'; then
  echo "✅ Wildcard DNS record created successfully!"
  echo ""
  echo "$response" | jq -r '.result | "Record ID: \(.id)\nName: \(.name)\nContent: \(.content)\nProxied: \(.proxied)\nCreated: \(.created_on)"'
  echo ""
  echo "🎉 All subdomains will now resolve through Cloudflare!"
  echo ""
  echo "Next step: Run verification script"
  echo "  ./verify-dns-fix.sh"
else
  echo "❌ Failed to create DNS record"
  echo ""
  echo "Response:"
  echo "$response" | jq .
  exit 1
fi
