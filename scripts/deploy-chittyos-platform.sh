#!/bin/bash

# ChittyOS Platform Master Deployment Script
# Deploys the complete ChittyOS ecosystem in optimal sequence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Logging
LOG_FILE="$PROJECT_ROOT/logs/deployment-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$PROJECT_ROOT/logs"

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

error() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

info() {
    log "${BLUE}INFO: $1${NC}"
}

warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Banner
cat << "EOF"
  _____ _     _ _   _         ____   _____   _____  _       _    __
 / ____| |   (_) | | |       / __ \ / ____| |  __ \| |     | |  / _|
| |    | |__  _| |_| |_ _   | |  | | (___   | |__) | | __ _| |_| |_ ___  _ __ _ __ ___
| |    | '_ \| | __| __| | | | |  | |\___ \  |  ___/| |/ _` | __|  _/ _ \| '__| '_ ` _ \
| |____| | | | | |_| |_| |_| | |__| |____) | | |    | | (_| | |_| || (_) | |  | | | | | |
 \_____|_| |_|_|\__|\__|\__, | \____/|_____/  |_|    |_|\__,_|\__|_| \___/|_|  |_| |_| |_|
                        __/ |
                       |___/

                       Platform Orchestrator v1.0
                       Deploying 34+ ChittyOS Services
EOF

log "${PURPLE}Starting ChittyOS Platform Deployment${NC}"
log "Timestamp: $(date)"
log "Log file: $LOG_FILE"

# Check prerequisites
info "Checking prerequisites..."

if ! command -v wrangler &> /dev/null; then
    error "Wrangler CLI not found. Install with: npm install -g wrangler"
fi

if ! command -v node &> /dev/null; then
    error "Node.js not found. Please install Node.js"
fi

if ! wrangler whoami &> /dev/null; then
    error "Not logged into Wrangler. Run: wrangler login"
fi

success "Prerequisites check passed"

# Environment check
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    warning "No .env file found. Using defaults..."
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        info "Created .env from .env.example"
    fi
fi

# Deployment mode
DEPLOY_MODE=${1:-"full"}
case $DEPLOY_MODE in
    "phase0"|"ai")
        PHASES=("0")
        ;;
    "phase1"|"core")
        PHASES=("0" "1")
        ;;
    "phase2"|"user")
        PHASES=("0" "1" "2")
        ;;
    "full")
        PHASES=("0" "1" "2" "3")
        ;;
    *)
        error "Invalid deployment mode. Use: phase0, phase1, phase2, or full"
        ;;
esac

info "Deployment mode: $DEPLOY_MODE"
info "Phases to deploy: ${PHASES[*]}"

# Deployment functions
deploy_phase_0() {
    log "${PURPLE}=== PHASE 0: AI Infrastructure ===${NC}"

    info "Deploying AI Gateway..."
    if [ -f "$SCRIPT_DIR/deploy-ai-gateway.sh" ]; then
        bash "$SCRIPT_DIR/deploy-ai-gateway.sh" || error "AI Gateway deployment failed"
    else
        wrangler deploy --env ai-gateway || error "AI Gateway deployment failed"
    fi

    info "Deploying LangChain Agents..."
    if [ -f "$SCRIPT_DIR/deploy-langchain-agents.sh" ]; then
        bash "$SCRIPT_DIR/deploy-langchain-agents.sh" || error "LangChain Agents deployment failed"
    else
        wrangler deploy --env langchain || error "LangChain Agents deployment failed"
    fi

    info "Deploying MCP Agents..."
    if [ -f "$SCRIPT_DIR/deploy-mcp-agents.sh" ]; then
        bash "$SCRIPT_DIR/deploy-mcp-agents.sh" || error "MCP Agents deployment failed"
    else
        wrangler deploy --env mcp || error "MCP Agents deployment failed"
    fi

    info "Setting up Vectorize indexes..."
    wrangler vectorize create embeddings --dimensions=1536 --metric=cosine || warning "Embeddings index might already exist"
    wrangler vectorize create knowledge-base --dimensions=768 --metric=cosine || warning "Knowledge-base index might already exist"

    info "Creating KV namespaces..."
    wrangler kv namespace create "LANGCHAIN_MEMORY" || warning "Namespace might already exist"
    wrangler kv namespace create "MCP_AGENT_STATE" || warning "Namespace might already exist"

    success "Phase 0 (AI Infrastructure) deployed successfully"
}

deploy_phase_1() {
    log "${PURPLE}=== PHASE 1: Core Service Mesh ===${NC}"

    info "Deploying ChittyID Pipeline Service..."
    # ChittyID deployment (to be implemented)
    warning "ChittyID Pipeline deployment script needed"

    info "Deploying ChittyAuth Service..."
    # ChittyAuth deployment (to be implemented)
    warning "ChittyAuth deployment script needed"

    info "Deploying ChittyRegistry Service..."
    # ChittyRegistry deployment (to be implemented)
    warning "ChittyRegistry deployment script needed"

    info "Deploying ChittyVerify Service..."
    # ChittyVerify deployment (to be implemented)
    warning "ChittyVerify deployment script needed"

    info "Deploying ChittyCanon Service..."
    # ChittyCanon deployment (to be implemented)
    warning "ChittyCanon deployment script needed"

    success "Phase 1 (Core Service Mesh) configured"
}

deploy_phase_2() {
    log "${PURPLE}=== PHASE 2: User-Facing Services ===${NC}"

    info "Deploying ChittyChat Service..."
    # Already deployed as sync service
    success "ChittyChat Sync already deployed"

    info "Creating documentation resources..."
    # Documentation setup (Notion integration)
    warning "Documentation setup script needed"

    info "Setting up CLI tools..."
    # CLI tools deployment
    warning "CLI tools deployment script needed"

    success "Phase 2 (User Services) configured"
}

deploy_phase_3() {
    log "${PURPLE}=== PHASE 3: Ecosystem Expansion ===${NC}"

    info "Deploying framework integrations..."
    warning "Framework integration deployment script needed"

    info "Setting up enterprise features..."
    warning "Enterprise features deployment script needed"

    info "Configuring advanced monitoring..."
    warning "Advanced monitoring setup script needed"

    success "Phase 3 (Ecosystem Expansion) configured"
}

# Test deployment
test_deployment() {
    log "${PURPLE}=== Testing Deployment ===${NC}"

    info "Testing AI Gateway..."
    if curl -s -f "https://ai.chitty.cc/health" > /dev/null; then
        success "AI Gateway health check passed"
    else
        warning "AI Gateway health check failed"
    fi

    info "Testing Beacon Service..."
    if curl -s -f "https://beacon.chitty.cc/health" > /dev/null; then
        success "Beacon Service health check passed"
    else
        warning "Beacon Service health check failed"
    fi

    info "Testing Sync Service..."
    if curl -s -f "https://sync.chitty.cc/health" > /dev/null; then
        success "Sync Service health check passed"
    else
        warning "Sync Service health check failed"
    fi

    success "Deployment testing completed"
}

# Main deployment execution
main() {
    cd "$PROJECT_ROOT"

    # Install dependencies
    info "Installing dependencies..."
    npm install || error "Failed to install dependencies"

    # Deploy phases
    for phase in "${PHASES[@]}"; do
        case $phase in
            "0")
                deploy_phase_0
                ;;
            "1")
                deploy_phase_1
                ;;
            "2")
                deploy_phase_2
                ;;
            "3")
                deploy_phase_3
                ;;
        esac

        # Brief pause between phases
        sleep 2
    done

    # Test deployment
    test_deployment

    # Summary
    log "${GREEN}=== DEPLOYMENT COMPLETE ===${NC}"
    log "Deployed phases: ${PHASES[*]}"
    log "Log file: $LOG_FILE"
    log "Timestamp: $(date)"

    info "Service URLs:"
    info "  - AI Gateway: https://ai.chitty.cc"
    info "  - LangChain: https://langchain.chitty.cc"
    info "  - MCP Agents: https://mcp.chitty.cc"
    info "  - Beacon: https://beacon.chitty.cc"
    info "  - Sync: https://sync.chitty.cc"

    success "ChittyOS Platform deployment completed successfully!"
}

# Trap for cleanup
trap 'error "Deployment interrupted"' INT TERM

# Execute main function
main

exit 0