#!/bin/bash

# ChittyChat Secure Deployment with 1Password
# Deploys to Cloudflare with credentials from 1Password

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║    ChittyChat Cloudflare Deployment          ║"
echo "║         (1Password Secured)                   ║"
echo "╚═══════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check 1Password CLI
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ 1Password CLI not found${NC}"
    echo "Install: https://1password.com/downloads/command-line/"
    exit 1
fi

# Check Wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Wrangler...${NC}"
    npm install -g wrangler
fi

# Authenticate 1Password
if ! op account get &> /dev/null; then
    echo -e "${YELLOW}🔐 Signing in to 1Password...${NC}"
    eval $(op signin)
fi

echo -e "${GREEN}✅ 1Password authenticated${NC}"

# Select environment
echo ""
echo "Select deployment environment:"
echo "  1) Production (sync.chitty.cc, viewer.chitty.cc)"
echo "  2) Staging (staging-sync.chitty.cc)"
echo "  3) Development (local only)"
read -p "Choice [1-3]: " ENV_CHOICE

case $ENV_CHOICE in
    1) ENV_NAME="production" ;;
    2) ENV_NAME="staging" ;;
    3) ENV_NAME="" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Deploy with 1Password credentials
echo ""
echo -e "${GREEN}🚀 Deploying to Cloudflare...${NC}"

op run --env-file=".env.1password" -- wrangler deploy ${ENV_NAME:+--env $ENV_NAME}

# Set secrets in Cloudflare
echo ""
echo -e "${YELLOW}🔐 Configuring secrets in Cloudflare...${NC}"

# Function to set secret
set_secret() {
    local SECRET_NAME=$1
    local OP_PATH=$2

    echo -n "  Setting $SECRET_NAME... "

    # Get value from 1Password
    VALUE=$(op read "$OP_PATH" 2>/dev/null || echo "")

    if [ -n "$VALUE" ]; then
        echo "$VALUE" | op run --env-file=".env.1password" -- wrangler secret put "$SECRET_NAME" ${ENV_NAME:+--env $ENV_NAME} > /dev/null 2>&1
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}skipped (not found)${NC}"
    fi
}

# Set all secrets
set_secret "NEON_DATABASE_URL" "op://Private/NEON_DATABASE_STRINGS/chittychat_db"
set_secret "NOTION_TOKEN" "op://ChittyOS-Legal/ylso3kbkjvmh5xzhpte5prqg6i/credential"
set_secret "CLOUDFLARE_API_TOKEN" "op://Private/CLOUDFLARE/api_token"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""

# Show deployment URLs
if [ "$ENV_NAME" = "production" ]; then
    echo "🌐 Production URLs:"
    echo "  - Sync Service: https://sync.chitty.cc"
    echo "  - Viewer Service: https://viewer.chitty.cc"
    echo "  - API Gateway: https://api.chitty.cc/sync"
elif [ "$ENV_NAME" = "staging" ]; then
    echo "🌐 Staging URL:"
    echo "  - https://staging-sync.chitty.cc"
else
    echo "🌐 Development:"
    echo "  - Use: wrangler dev"
fi

echo ""
echo "📊 Monitor logs:"
echo "  op run --env-file='.env.1password' -- wrangler tail ${ENV_NAME:+--env $ENV_NAME}"
echo ""
echo "🔒 All credentials secured by 1Password!"