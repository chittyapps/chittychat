#!/bin/bash

# Setup DNS for emails.chitty.cc

echo "📡 Setting up DNS for emails.chitty.cc..."

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN must be set"
    exit 1
fi

# Get Zone ID for chitty.cc
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=chitty.cc" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
    echo "❌ Error: Could not find zone ID for chitty.cc"
    exit 1
fi

echo "✅ Found zone ID: $ZONE_ID"

# Create CNAME record for emails.chitty.cc
echo "🔧 Creating DNS record for emails.chitty.cc..."

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "CNAME",
        "name": "emails",
        "content": "email-viewer.chitty.workers.dev",
        "proxied": true,
        "comment": "Email viewer interface"
    }'

echo ""
echo "✅ DNS Setup Complete!"
echo ""
echo "📧 Email viewer will be available at:"
echo "   https://emails.chitty.cc"
echo ""
echo "Note: DNS propagation may take a few minutes"