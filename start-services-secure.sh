#!/bin/bash

# ChittyChat Secure Services Startup with 1Password
# Automatically injects credentials from 1Password

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║   ChittyChat Secure Services (1Password)     ║"
echo "╚═══════════════════════════════════════════════╝"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo -e "${RED}❌ 1Password CLI not found${NC}"
    echo "Install from: https://1password.com/downloads/command-line/"
    exit 1
fi

# Check if signed in to 1Password
if ! op account get &> /dev/null; then
    echo -e "${YELLOW}🔐 Signing in to 1Password...${NC}"
    eval $(op signin)
fi

echo -e "${GREEN}✅ 1Password authenticated${NC}"

# Run services with 1Password environment injection
echo -e "${GREEN}🚀 Starting services with secure credentials...${NC}"

# Stop any existing services first
if [ -f "./stop-services.sh" ]; then
    ./stop-services.sh > /dev/null 2>&1 || true
fi

# Start services with 1Password environment
op run --env-file=".env.1password" -- bash -c '
    echo "📋 Loaded secure configuration from 1Password"

    # Create directories
    mkdir -p logs pids

    # Start Universal Sync Service
    echo "🚀 Starting Universal Sync Service..."
    nohup node neon-universal-sync.js > logs/universal-sync.log 2>&1 &
    echo $! > pids/universal-sync.pid

    # Start Immutable Viewer Service
    echo "🚀 Starting Immutable Viewer Service..."
    nohup node chittyos-immutable-viewer.js > logs/immutable-viewer.log 2>&1 &
    echo $! > pids/immutable-viewer.pid

    sleep 3

    # Verify services started
    if lsof -i :${SYNC_PORT:-3006} > /dev/null 2>&1; then
        echo "✅ Universal Sync started on port ${SYNC_PORT:-3006}"
    else
        echo "❌ Universal Sync failed to start"
    fi

    if lsof -i :${VIEWER_PORT:-3007} > /dev/null 2>&1; then
        echo "✅ Immutable Viewer started on port ${VIEWER_PORT:-3007}"
    else
        echo "❌ Immutable Viewer failed to start"
    fi
'

echo ""
echo "🔗 Service URLs:"
echo "  - Universal Sync: http://localhost:3006"
echo "  - Immutable Viewer: http://localhost:3007"
echo ""
echo "📊 Health Checks:"
echo "  curl http://localhost:3006/health"
echo "  curl http://localhost:3007/health"
echo ""
echo "🔒 Credentials: Managed by 1Password"
echo "📝 Logs: tail -f logs/*.log"
echo "🛑 Stop: ./stop-services.sh"
echo ""
echo -e "${GREEN}✅ Services started with secure credentials!${NC}"