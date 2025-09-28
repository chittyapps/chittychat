#!/bin/bash

# ChittyChat Services Startup Script
# Starts sync services with proper environment configuration

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║     ChittyChat Services Startup               ║"
echo "╚═══════════════════════════════════════════════╝"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if environment file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from template...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from template${NC}"
        echo -e "${YELLOW}⚠️  Please configure your environment variables in .env${NC}"
    else
        echo -e "${RED}❌ No .env.example found${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Function to check if service is running
check_service() {
    local port=$1
    local service_name=$2

    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port already in use (${service_name})${NC}"
        return 1
    fi
    return 0
}

# Function to start service in background
start_service() {
    local script=$1
    local service_name=$2
    local port=$3

    if check_service $port "$service_name"; then
        echo -e "${GREEN}🚀 Starting $service_name on port $port...${NC}"
        nohup node $script > logs/${service_name}.log 2>&1 &
        echo $! > pids/${service_name}.pid
        sleep 2

        # Verify service started
        if lsof -i :$port > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start $service_name${NC}"
            return 1
        fi
    fi
}

# Create directories for logs and pids
mkdir -p logs pids

echo "📋 Service Configuration:"
echo "  - Universal Sync: Port ${SYNC_PORT:-3006}"
echo "  - Immutable Viewer: Port ${VIEWER_PORT:-3007}"
echo "  - Target: ${SYNC_TARGET:-notion}"
echo "  - Mode: ${SYNC_MODE:-bidirectional}"
echo ""

# Check dependencies
echo "🔍 Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

if [ ! -f package.json ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

if [ ! -d node_modules ]; then
    echo -e "${YELLOW}⚠️  Installing dependencies...${NC}"
    npm install
fi

echo -e "${GREEN}✅ Dependencies verified${NC}"
echo ""

# Start services
echo "🚀 Starting services..."

# Start Universal Sync Service
start_service "neon-universal-sync.js" "universal-sync" "${SYNC_PORT:-3006}"

# Start Immutable Viewer Service
start_service "chittyos-immutable-viewer.js" "immutable-viewer" "${VIEWER_PORT:-3007}"

echo ""
echo "🔗 Service URLs:"
echo "  - Universal Sync: http://localhost:${SYNC_PORT:-3006}"
echo "  - Immutable Viewer: http://localhost:${VIEWER_PORT:-3007}"
echo ""
echo "📊 Health Checks:"
echo "  curl http://localhost:${SYNC_PORT:-3006}/health"
echo "  curl http://localhost:${VIEWER_PORT:-3007}/health"
echo ""
echo "📝 Logs:"
echo "  tail -f logs/universal-sync.log"
echo "  tail -f logs/immutable-viewer.log"
echo ""
echo "🛑 To stop services:"
echo "  ./stop-services.sh"
echo ""
echo -e "${GREEN}✅ All services started successfully!${NC}"