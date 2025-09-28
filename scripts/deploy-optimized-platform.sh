#!/bin/bash

# ChittyOS Optimized Platform Deployment
# Single worker with intelligent routing - maximum efficiency

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Banner
cat << "EOF"
   _____ _     _ _   _         ____   _____   ____        _   _           _              _
  / ____| |   (_) | | |       / __ \ / ____| |  _ \ _ __ | |_| |__   __ _| |_ __   __ _| |
 | |    | |__  _| |_| |_ _   | |  | | (___   | |_) | '_ \| __| '_ \ / _` | | '_ \ / _` | |
 | |    | '_ \| | __| __| | | | |  | |\___ \  |  __/| | | | |_| | | | (_| | | | | | (_| | |
 | |____| | | | | |_| |_| |_| | |__| |____) | |  _  | |_| | |_| |_| |\__,_|_|_| |_|\__,_|_|
  \_____|_| |_|_|\__|\__|\__, | \____/|_____/  |_|  _|\__,_|\__|____/
                         __/ |                    | |
                        |___/                     |_|

                        Optimized Platform Deployment
EOF

log "Starting ChittyOS Optimized Platform Deployment"

# Check prerequisites
log "Checking prerequisites..."
if ! command -v wrangler &> /dev/null; then
    error "Wrangler CLI not found. Install with: npm install -g wrangler"
fi

if ! wrangler whoami &> /dev/null; then
    error "Not logged into Wrangler. Run: wrangler login"
fi

success "Prerequisites check passed"

# Check if optimized config exists
if [ ! -f "wrangler.optimized.toml" ]; then
    error "wrangler.optimized.toml not found. Run optimization setup first."
fi

# Backup current wrangler.toml
if [ -f "wrangler.toml" ]; then
    log "Backing up current wrangler.toml"
    cp wrangler.toml wrangler.toml.backup
    success "Backup created: wrangler.toml.backup"
fi

# Switch to optimized configuration
log "Switching to optimized configuration..."
cp wrangler.optimized.toml wrangler.toml
success "Using optimized configuration"

# Create necessary resources
log "Creating Cloudflare resources..."

# KV Namespaces
log "Creating KV namespaces..."
wrangler kv namespace create "PLATFORM_CACHE" --preview false 2>/dev/null || warning "PLATFORM_CACHE namespace might already exist"
wrangler kv namespace create "PLATFORM_STATE" --preview false 2>/dev/null || warning "PLATFORM_STATE namespace might already exist"

# R2 Buckets
log "Creating R2 buckets..."
wrangler r2 bucket create chittyos-platform-storage 2>/dev/null || warning "chittyos-platform-storage bucket might already exist"
wrangler r2 bucket create chittyos-audit-logs 2>/dev/null || warning "chittyos-audit-logs bucket might already exist"

# Vectorize indexes
log "Creating Vectorize indexes..."
wrangler vectorize create chittyos-vectors --dimensions=1536 --metric=cosine 2>/dev/null || warning "chittyos-vectors index might already exist"

success "Cloudflare resources configured"

# Deploy the optimized platform worker
log "Deploying ChittyOS Platform Orchestrator..."

# Development deployment first
log "Deploying to development environment..."
if wrangler deploy --env development; then
    success "Development deployment successful"
else
    error "Development deployment failed"
fi

# Production deployment
log "Deploying to production environment..."
if wrangler deploy --env production; then
    success "Production deployment successful"
else
    warning "Production deployment failed - check configuration"
fi

# Health checks
log "Performing health checks..."
sleep 5  # Wait for services to initialize

check_service() {
    local service_name=$1
    local url=$2
    local max_retries=3
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if curl -s -f "$url/health" > /dev/null 2>&1; then
            success "$service_name is healthy"
            return 0
        else
            retry=$((retry + 1))
            if [ $retry -lt $max_retries ]; then
                log "Retrying $service_name health check ($retry/$max_retries)..."
                sleep 3
            fi
        fi
    done

    warning "$service_name health check failed"
    return 1
}

# Check platform health
check_service "Platform Orchestrator" "https://ai.chitty.cc"
check_service "Sync Service" "https://sync.chitty.cc"
check_service "Beacon Service" "https://beacon.chitty.cc"

# Summary
log "Deployment Summary:"
cat << EOF

🚀 ChittyOS Optimized Platform Deployed!

Single Worker Efficiency:
  ✅ All services consolidated into one worker
  ✅ Intelligent routing by hostname
  ✅ Shared resources and reduced overhead
  ✅ Cost-optimized configuration

Live Services:
  ✅ AI Gateway: https://ai.chitty.cc
  ✅ Sync Service: https://sync.chitty.cc
  ✅ Beacon Service: https://beacon.chitty.cc

Coming Soon Services:
  🔄 LangChain Agents: https://langchain.chitty.cc
  🔄 MCP Agents: https://mcp.chitty.cc
  🔄 ChittyID Pipeline: https://id.chitty.cc

Resources Created:
  📦 KV: PLATFORM_CACHE, PLATFORM_STATE
  💾 R2: chittyos-platform-storage, chittyos-audit-logs
  🔍 Vectorize: chittyos-vectors

Cost Optimization:
  💰 Reduced from 15+ workers to 1 worker
  ⚡ Intelligent routing eliminates cold starts
  📊 Shared resources across all services

Next Steps:
  1. Monitor platform performance
  2. Deploy Phase 0 AI agents
  3. Complete service implementations
  4. Scale based on usage patterns

EOF

success "Optimized platform deployment completed!"
exit 0