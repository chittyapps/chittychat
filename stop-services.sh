#!/bin/bash

# ChittyChat Services Stop Script
# Gracefully stops all sync services

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║     ChittyChat Services Stop                  ║"
echo "╚═══════════════════════════════════════════════╝"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="pids/${service_name}.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")

        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}🛑 Stopping $service_name (PID: $pid)...${NC}"
            kill $pid

            # Wait for graceful shutdown
            local count=0
            while ps -p $pid > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done

            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}⚠️  Force killing $service_name...${NC}"
                kill -9 $pid
            fi

            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name not running${NC}"
        fi

        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  No PID file for $service_name${NC}"
    fi
}

# Function to stop service by port
stop_by_port() {
    local port=$1
    local service_name=$2

    local pid=$(lsof -ti :$port 2>/dev/null || echo "")

    if [ -n "$pid" ]; then
        echo -e "${YELLOW}🛑 Stopping $service_name on port $port (PID: $pid)...${NC}"
        kill $pid
        sleep 2

        # Force kill if still running
        local still_running=$(lsof -ti :$port 2>/dev/null || echo "")
        if [ -n "$still_running" ]; then
            echo -e "${YELLOW}⚠️  Force killing process on port $port...${NC}"
            kill -9 $still_running
        fi

        echo -e "${GREEN}✅ Service on port $port stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  No service running on port $port${NC}"
    fi
}

echo "🛑 Stopping ChittyChat sync services..."
echo ""

# Stop services by PID files
if [ -d "pids" ]; then
    stop_service "universal-sync"
    stop_service "immutable-viewer"
else
    echo -e "${YELLOW}⚠️  No pids directory found, stopping by port...${NC}"

    # Load environment if available
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs) 2>/dev/null || true
    fi

    # Stop by default ports
    stop_by_port "${SYNC_PORT:-3006}" "Universal Sync"
    stop_by_port "${VIEWER_PORT:-3007}" "Immutable Viewer"
fi

echo ""
echo "🔍 Cleaning up..."

# Clean up PID files
if [ -d "pids" ]; then
    rm -f pids/*.pid
    rmdir pids 2>/dev/null || true
fi

# Archive logs with timestamp
if [ -d "logs" ]; then
    timestamp=$(date +"%Y%m%d_%H%M%S")
    mkdir -p "logs/archive"

    if [ -f "logs/universal-sync.log" ]; then
        mv "logs/universal-sync.log" "logs/archive/universal-sync_${timestamp}.log"
    fi

    if [ -f "logs/immutable-viewer.log" ]; then
        mv "logs/immutable-viewer.log" "logs/archive/immutable-viewer_${timestamp}.log"
    fi

    echo -e "${GREEN}✅ Logs archived to logs/archive/${NC}"
fi

echo ""
echo -e "${GREEN}✅ All services stopped successfully!${NC}"
echo ""
echo "📂 Archived logs available in logs/archive/"
echo "🚀 To restart services: ./start-services.sh"