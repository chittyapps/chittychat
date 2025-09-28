#!/bin/bash

# ChittyChat Email Routing and Vectorize Setup Script
# This configures Cloudflare Email Routing to capture all emails to chitty.cc
# and sets up Vectorize for intelligent email search

set -e

echo "🚀 Setting up ChittyChat Email Routing and Vectorize..."

# Check if required environment variables are set
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"
    echo "   You can find these in your Cloudflare dashboard"
    exit 1
fi

# Zone ID for chitty.cc
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=chitty.cc" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ -z "$ZONE_ID" ]; then
    echo "❌ Error: Could not find zone ID for chitty.cc"
    exit 1
fi

echo "✅ Found zone ID: $ZONE_ID"

# 1. Enable Email Routing for the zone
echo "📧 Enabling Email Routing for chitty.cc..."
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/enable" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"enabled": true}'

# 2. Create destination addresses for email forwarding
echo "📬 Setting up email destinations..."

# Create verified destination addresses (update these with your actual addresses)
DESTINATIONS=(
    "nick@example.com"  # Replace with your actual email
)

for email in "${DESTINATIONS[@]}"; do
    curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/email/routing/addresses" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"email\": \"$email\"}"
done

# 3. Create Email Routing rules
echo "📝 Creating Email Routing rules..."

# Create catchall rule for all @chitty.cc emails
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/rules/catch_all" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "enabled": true,
        "action": "worker",
        "matcher": "all"
    }'

# Create specific routing rules for each email address
EMAILS=(
    "nick@chitty.cc"
    "receipts@chitty.cc"
    "bills@chitty.cc"
    "finance@chitty.cc"
    "support@chitty.cc"
    "city@chitty.cc"
    "loft@chitty.cc"
    "cozy@chitty.cc"
    "villa@chitty.cc"
    "chico@chitty.cc"
    "bcc@chitty.cc"
)

for email in "${EMAILS[@]}"; do
    echo "  Adding rule for $email..."
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/email/routing/rules" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
            \"matchers\": [{\"type\": \"literal\", \"field\": \"to\", \"value\": \"$email\"}],
            \"actions\": [{\"type\": \"worker\", \"value\": [\"email-worker\"]}],
            \"name\": \"Route $email to worker\",
            \"enabled\": true
        }"
done

# 4. Create Vectorize index for email embeddings
echo "🔍 Creating Vectorize index for email search..."

curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/vectorize/v2/indexes" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "name": "chittychat-emails",
        "description": "Email embeddings for ChittyChat",
        "config": {
            "dimensions": 1536,
            "metric": "cosine"
        }
    }'

# 5. Deploy the email worker
echo "🔧 Deploying email worker..."
cd "$(dirname "$0")/.."
npx wrangler deploy src/workers/email-worker.js --name email-worker

# 6. Verify setup
echo ""
echo "✅ Email Routing Setup Complete!"
echo ""
echo "📊 Configuration Summary:"
echo "  - Zone: chitty.cc"
echo "  - Catchall: Enabled (all emails to @chitty.cc)"
echo "  - Worker: email-worker"
echo "  - R2 Bucket: chitty-email-intake"
echo "  - Vectorize Index: chittychat-emails"
echo ""
echo "📧 Configured email addresses:"
for email in "${EMAILS[@]}"; do
    echo "  - $email"
done
echo ""
echo "🔍 Testing Email Routing:"
echo "  Send a test email to any of the above addresses"
echo "  Check R2 bucket 'chitty-email-intake' for captured emails"
echo "  Monitor worker logs: wrangler tail email-worker"
echo ""
echo "📝 Next steps:"
echo "  1. Send test emails to verify capture"
echo "  2. Check R2 bucket for stored emails"
echo "  3. Query Vectorize for email search"
echo "  4. Monitor AutoRAG indexing for email content"