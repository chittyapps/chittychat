#!/bin/bash

# ChittyOS Complete Ecosystem Deployment Script
# Deploys all services, configures infrastructure, and validates the entire platform

set -e

echo "=========================================="
echo "   ChittyOS Ecosystem Deployment"
echo "   Version: 1.0.0"
echo "   Environment: ${ENVIRONMENT:-production}"
echo "=========================================="

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
API_TOKEN=${CLOUDFLARE_API_TOKEN}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    # Check for required tools
    command -v wrangler >/dev/null 2>&1 || { print_error "wrangler is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed."; exit 1; }
    command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed."; exit 1; }

    # Check for environment variables
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        print_error "CLOUDFLARE_ACCOUNT_ID is not set"
        exit 1
    fi

    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        print_error "CLOUDFLARE_API_TOKEN is not set"
        exit 1
    fi

    print_status "Prerequisites check passed"
}

# Create KV namespaces
create_kv_namespaces() {
    echo ""
    echo "Creating KV Namespaces..."

    KV_NAMESPACES=(
        "SERVICE_REGISTRY"
        "CANON_CACHE"
        "CHAT_HISTORY"
        "SYNC_CACHE"
        "LANGCHAIN_STATE"
        "MCP_TOOLS"
        "MCP_MEMORY"
        "AI_CACHE"
        "AUTH_SESSIONS"
        "BEACON_EVENTS"
    )

    for namespace in "${KV_NAMESPACES[@]}"; do
        echo "Creating KV namespace: $namespace"
        wrangler kv:namespace create "$namespace" --preview false 2>/dev/null || print_warning "KV namespace $namespace already exists"
    done

    print_status "KV namespaces created"
}

# Create Durable Object namespaces
create_durable_objects() {
    echo ""
    echo "Creating Durable Object namespaces..."

    # Durable Objects are created automatically when workers are deployed
    # This section is for documentation

    DO_NAMESPACES=(
        "CHAT_SESSIONS"
        "MCP_AGENTS"
        "SYNC_STATE"
        "AUTH_STATE"
    )

    print_status "Durable Object namespaces will be created on worker deployment"
}

# Create D1 databases
create_d1_databases() {
    echo ""
    echo "Creating D1 Databases..."

    D1_DATABASES=(
        "canon-db"
        "audit-db"
        "analytics-db"
    )

    for db in "${D1_DATABASES[@]}"; do
        echo "Creating D1 database: $db"
        wrangler d1 create "$db" 2>/dev/null || print_warning "D1 database $db already exists"
    done

    print_status "D1 databases created"
}

# Create R2 buckets
create_r2_buckets() {
    echo ""
    echo "Creating R2 Buckets..."

    R2_BUCKETS=(
        "audit-logs"
        "processed-docs"
        "email-intake"
        "agent-artifacts"
    )

    for bucket in "${R2_BUCKETS[@]}"; do
        echo "Creating R2 bucket: $bucket"
        wrangler r2 bucket create "$bucket" 2>/dev/null || print_warning "R2 bucket $bucket already exists"
    done

    print_status "R2 buckets created"
}

# Create Vectorize indexes
create_vectorize_indexes() {
    echo ""
    echo "Creating Vectorize Indexes..."

    # Create langchain-memory index
    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/vectorize/indexes" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "langchain-memory",
            "config": {
                "dimensions": 1536,
                "metric": "cosine"
            }
        }' 2>/dev/null || print_warning "Vectorize index langchain-memory already exists"

    # Create mcp-embeddings index
    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/vectorize/indexes" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "mcp-embeddings",
            "config": {
                "dimensions": 768,
                "metric": "euclidean"
            }
        }' 2>/dev/null || print_warning "Vectorize index mcp-embeddings already exists"

    # Create knowledge-base index
    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/vectorize/indexes" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "knowledge-base",
            "config": {
                "dimensions": 1536,
                "metric": "cosine"
            }
        }' 2>/dev/null || print_warning "Vectorize index knowledge-base already exists"

    print_status "Vectorize indexes created"
}

# Setup AI Gateway
setup_ai_gateway() {
    echo ""
    echo "Setting up AI Gateway..."

    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai-gateway/gateways" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "chittyos-ai-gateway",
            "slug": "chittyos",
            "config": {
                "cache": {
                    "enabled": true,
                    "ttl": 3600
                },
                "rateLimiting": {
                    "enabled": true,
                    "requestsPerMinute": 100
                },
                "logging": {
                    "enabled": true
                }
            }
        }' 2>/dev/null || print_warning "AI Gateway already exists"

    print_status "AI Gateway configured"
}

# Deploy Core Services
deploy_core_services() {
    echo ""
    echo "Deploying Core Services..."

    # Deploy ID Service
    echo "Deploying id.chitty.cc..."
    cd workers/id-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy Auth Service
    echo "Deploying auth.chitty.cc..."
    cd workers/auth-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy Beacon Service
    echo "Deploying beacon.chitty.cc..."
    cd workers/beacon-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy Registry Service
    echo "Deploying registry.chitty.cc..."
    cd workers/registry-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    print_status "Core services deployed"
}

# Deploy Data Services
deploy_data_services() {
    echo ""
    echo "Deploying Data Services..."

    # Deploy Canon Service
    echo "Deploying canon.chitty.cc..."
    cd workers/canon-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy Verify Service
    echo "Deploying verify.chitty.cc..."
    cd workers/verify-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy Sync Service
    echo "Deploying sync.chitty.cc..."
    cd workers/sync-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    print_status "Data services deployed"
}

# Deploy Communication Services
deploy_communication_services() {
    echo ""
    echo "Deploying Communication Services..."

    # Deploy Chat Service
    echo "Deploying chat.chitty.cc..."
    cd workers/chat-service
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    print_status "Communication services deployed"
}

# Deploy AI Services
deploy_ai_services() {
    echo ""
    echo "Deploying AI Services..."

    # Deploy LangChain Agents
    echo "Deploying langchain.chitty.cc..."
    cd workers/langchain-agent
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    # Deploy MCP Agents
    echo "Deploying mcp.chitty.cc..."
    cd workers/mcp-agent
    wrangler deploy --env $ENVIRONMENT
    cd ../..

    print_status "AI services deployed"
}

# Set secrets for all services
set_secrets() {
    echo ""
    echo "Setting secrets for all services..."

    # Core secrets
    echo "$CHITTY_JWT_SECRET" | wrangler secret put CHITTY_JWT_SECRET --env $ENVIRONMENT
    echo "$CHITTY_API_KEY" | wrangler secret put CHITTY_API_KEY --env $ENVIRONMENT
    echo "$NEON_DATABASE_URL" | wrangler secret put NEON_DATABASE_URL --env $ENVIRONMENT

    # Integration secrets
    echo "$NOTION_TOKEN" | wrangler secret put NOTION_TOKEN --env $ENVIRONMENT
    echo "$GOOGLE_SERVICE_ACCOUNT_KEY" | wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY --env $ENVIRONMENT
    echo "$GITHUB_TOKEN" | wrangler secret put GITHUB_TOKEN --env $ENVIRONMENT

    # AI secrets
    echo "$CLOUDFLARE_AI_TOKEN" | wrangler secret put CLOUDFLARE_AI_TOKEN --env $ENVIRONMENT

    print_status "Secrets configured"
}

# Validate deployment
validate_deployment() {
    echo ""
    echo "Validating deployment..."

    SERVICES=(
        "https://id.chitty.cc/health"
        "https://auth.chitty.cc/health"
        "https://beacon.chitty.cc/health"
        "https://registry.chitty.cc/health"
        "https://canon.chitty.cc/health"
        "https://verify.chitty.cc/health"
        "https://chat.chitty.cc/health"
        "https://sync.chitty.cc/health"
        "https://langchain.chitty.cc/health"
        "https://mcp.chitty.cc/health"
    )

    for service in "${SERVICES[@]}"; do
        if curl -f -s "$service" > /dev/null; then
            print_status "✓ $service is healthy"
        else
            print_warning "⚠ $service is not responding"
        fi
    done
}

# Register services in registry
register_services() {
    echo ""
    echo "Registering services in Service Registry..."

    # Register each service
    curl -X POST "https://registry.chitty.cc/api/register" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CHITTY_API_KEY" \
        -d '{
            "services": [
                {"name": "id", "url": "https://id.chitty.cc", "type": "core"},
                {"name": "auth", "url": "https://auth.chitty.cc", "type": "core"},
                {"name": "beacon", "url": "https://beacon.chitty.cc", "type": "monitoring"},
                {"name": "registry", "url": "https://registry.chitty.cc", "type": "infrastructure"},
                {"name": "canon", "url": "https://canon.chitty.cc", "type": "data"},
                {"name": "verify", "url": "https://verify.chitty.cc", "type": "data"},
                {"name": "chat", "url": "https://chat.chitty.cc", "type": "communication"},
                {"name": "sync", "url": "https://sync.chitty.cc", "type": "integration"},
                {"name": "langchain", "url": "https://langchain.chitty.cc", "type": "ai"},
                {"name": "mcp", "url": "https://mcp.chitty.cc", "type": "ai"}
            ]
        }'

    print_status "Services registered"
}

# Setup monitoring dashboard
setup_monitoring() {
    echo ""
    echo "Setting up monitoring dashboard..."

    # Configure Cloudflare Analytics
    curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/config" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "chittyos-monitoring",
            "enabled": true
        }' 2>/dev/null || print_warning "Analytics already configured"

    print_status "Monitoring configured"
}

# Main deployment flow
main() {
    echo "Starting ChittyOS Ecosystem Deployment..."
    echo ""

    # Pre-deployment checks
    check_prerequisites

    # Infrastructure setup
    echo ""
    echo "=== INFRASTRUCTURE SETUP ==="
    create_kv_namespaces
    create_durable_objects
    create_d1_databases
    create_r2_buckets
    create_vectorize_indexes
    setup_ai_gateway

    # Service deployment
    echo ""
    echo "=== SERVICE DEPLOYMENT ==="
    deploy_core_services
    deploy_data_services
    deploy_communication_services
    deploy_ai_services

    # Configuration
    echo ""
    echo "=== CONFIGURATION ==="
    set_secrets
    register_services
    setup_monitoring

    # Validation
    echo ""
    echo "=== VALIDATION ==="
    validate_deployment

    echo ""
    echo "=========================================="
    echo "   ChittyOS Ecosystem Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "Services deployed:"
    echo "  Core: id, auth, beacon, registry"
    echo "  Data: canon, verify, sync"
    echo "  Comm: chat"
    echo "  AI: langchain, mcp"
    echo ""
    echo "Access points:"
    echo "  Dashboard: https://beacon.chitty.cc/dashboard"
    echo "  API Gateway: https://api.chitty.cc"
    echo "  AI Gateway: https://ai.chitty.cc"
    echo ""
    echo "Next steps:"
    echo "  1. Test services: npm run test:ecosystem"
    echo "  2. View monitoring: https://beacon.chitty.cc/dashboard"
    echo "  3. Check logs: wrangler tail --env $ENVIRONMENT"
    echo ""
    print_status "Deployment successful!"
}

# Run main function
main "$@"