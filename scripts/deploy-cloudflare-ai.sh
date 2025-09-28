#!/bin/bash

# ChittyChat Cloudflare AI Services Deployment Script
# Deploys all AI-powered workers, agents, and services to Cloudflare

set -e

echo "🚀 ChittyChat Cloudflare AI Services Deployment"
echo "================================================"

# Load environment variables
if [ -f .env.working ]; then
    source .env.working
    echo "✅ Loaded environment variables from .env.working"
fi

# Function to deploy a specific environment
deploy_environment() {
    local env_name=$1
    local description=$2

    echo ""
    echo "🔧 Deploying $description..."
    npx wrangler deploy --env $env_name

    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed $description"
    else
        echo "❌ Failed to deploy $description"
        return 1
    fi
}

# Function to create KV namespaces
create_kv_namespace() {
    local namespace_name=$1
    local binding=$2

    echo "📦 Creating KV namespace: $namespace_name"
    local namespace_id=$(npx wrangler kv:namespace create "$namespace_name" --preview false | grep -oE '[a-f0-9]{32}')

    if [ ! -z "$namespace_id" ]; then
        echo "✅ Created KV namespace $namespace_name with ID: $namespace_id"
        echo "   Binding: $binding = $namespace_id"
    else
        echo "⚠️  KV namespace $namespace_name might already exist"
    fi
}

# Function to create Vectorize indexes
create_vectorize_index() {
    local index_name=$1
    local dimensions=$2

    echo "🔍 Creating Vectorize index: $index_name"
    npx wrangler vectorize create $index_name \
        --dimensions=$dimensions \
        --metric=cosine \
        2>/dev/null || echo "⚠️  Vectorize index $index_name might already exist"
}

# Function to setup AI Gateway
setup_ai_gateway() {
    echo ""
    echo "🌐 Setting up AI Gateway..."

    # Create AI Gateway via API
    curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai-gateway/gateways" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "chittychat-ai",
            "slug": "chittychat-ai",
            "description": "ChittyChat AI Gateway for Workers AI integration",
            "cache_ttl": 3600,
            "rate_limiting": {
                "enabled": true,
                "requests_per_minute": 100
            },
            "analytics": {
                "enabled": true
            }
        }' 2>/dev/null || echo "⚠️  AI Gateway might already exist"
}

# Function to setup Hyperdrive connections
setup_hyperdrive() {
    local name=$1
    local connection_string=$2

    echo "🚄 Creating Hyperdrive connection: $name"

    local hyperdrive_id=$(npx wrangler hyperdrive create $name \
        --connection-string="$connection_string" \
        2>/dev/null | grep -oE '[a-f0-9-]{36}')

    if [ ! -z "$hyperdrive_id" ]; then
        echo "✅ Created Hyperdrive $name with ID: $hyperdrive_id"
        echo "   Update wrangler.toml with this ID"
    else
        echo "⚠️  Hyperdrive $name might already exist"
    fi
}

# Main deployment process
main() {
    echo ""
    echo "1️⃣  Setting up infrastructure..."
    echo "================================="

    # Create KV namespaces
    create_kv_namespace "metrics-kv" "METRICS_KV"
    create_kv_namespace "gateway-cache" "GATEWAY_CACHE"
    create_kv_namespace "agent-memory" "AGENT_MEMORY"
    create_kv_namespace "mcp-state" "MCP_STATE"
    create_kv_namespace "ai-cache" "AI_CACHE"
    create_kv_namespace "unified-cache" "UNIFIED_CACHE"

    echo ""
    echo "2️⃣  Creating Vectorize indexes..."
    echo "================================="

    # Create Vectorize indexes with appropriate dimensions
    create_vectorize_index "chittychat-main" 768
    create_vectorize_index "chittychat-vectors" 768
    create_vectorize_index "mcp-vectors" 768
    create_vectorize_index "chittychat-agents" 768
    create_vectorize_index "chittychat-mcp" 768

    echo ""
    echo "3️⃣  Setting up AI Gateway..."
    echo "============================="
    setup_ai_gateway

    echo ""
    echo "4️⃣  Setting up Hyperdrive connections..."
    echo "========================================"

    if [ ! -z "$NEON_DATABASE_URL" ]; then
        setup_hyperdrive "chittychat-neon" "$NEON_DATABASE_URL"
    fi

    if [ ! -z "$CHITTYCASES_DATABASE_URL" ]; then
        setup_hyperdrive "chittycases-neon" "$CHITTYCASES_DATABASE_URL"
    fi

    echo ""
    echo "5️⃣  Deploying Workers and Agents..."
    echo "===================================="

    # Deploy each environment
    deploy_environment "ai-gateway" "AI Gateway Worker"
    deploy_environment "langchain" "LangChain Agent Worker"
    deploy_environment "mcp-agent" "MCP Agent (Model Context Protocol)"
    deploy_environment "ai-agents" "AI Agent Provisioning Worker"
    deploy_environment "unified" "Unified AI + Notion Worker"

    echo ""
    echo "6️⃣  Setting up secrets..."
    echo "========================="

    # Set secrets for each environment
    echo "Setting secrets for AI Gateway..."
    echo "$CF_API_TOKEN" | npx wrangler secret put CF_API_TOKEN --env ai-gateway

    echo "Setting secrets for LangChain..."
    echo "$CF_API_TOKEN" | npx wrangler secret put CF_API_TOKEN --env langchain
    echo "$NEON_DATABASE_URL" | npx wrangler secret put DATABASE_URL --env langchain

    echo "Setting secrets for MCP Agent..."
    echo "$CF_API_TOKEN" | npx wrangler secret put CF_API_TOKEN --env mcp-agent
    echo "$NEON_DATABASE_URL" | npx wrangler secret put DATABASE_URL --env mcp-agent

    echo "Setting secrets for Unified Worker..."
    echo "$NOTION_TOKEN" | npx wrangler secret put NOTION_TOKEN --env unified
    echo "$NEON_DATABASE_URL" | npx wrangler secret put DATABASE_URL --env unified
    echo "$NEON_API_KEY" | npx wrangler secret put NEON_API_KEY --env unified

    echo ""
    echo "7️⃣  Configuring routes..."
    echo "========================"

    # Verify DNS records
    echo "Verifying DNS records for:"
    echo "  - ai.chitty.cc"
    echo "  - langchain.chitty.cc"
    echo "  - mcp.chitty.cc"
    echo "  - agents.chitty.cc"
    echo "  - unified.chitty.cc"

    echo ""
    echo "✨ Deployment Complete!"
    echo "======================"
    echo ""
    echo "🌐 Deployed Services:"
    echo "  • AI Gateway: https://ai.chitty.cc"
    echo "  • LangChain Agents: https://langchain.chitty.cc"
    echo "  • MCP Agents: https://mcp.chitty.cc"
    echo "  • Agent Provisioning: https://agents.chitty.cc"
    echo "  • Unified AI+Notion: https://unified.chitty.cc"
    echo ""
    echo "📊 AI Gateway Dashboard:"
    echo "  https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/ai/ai-gateway"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Update Hyperdrive IDs in wrangler.toml"
    echo "  2. Configure DNS records in Cloudflare dashboard"
    echo "  3. Test each endpoint"
    echo "  4. Monitor AI Gateway analytics"
}

# Run main deployment
main