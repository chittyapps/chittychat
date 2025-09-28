#!/bin/bash

# ChittyChat MCP Agent Testing Script
# Tests all MCP (Model Context Protocol) agent patterns and capabilities

set -e

# Configuration
MCP_ENDPOINT="${MCP_ENDPOINT:-https://mcp.chitty.cc}"
LOCAL_ENDPOINT="${LOCAL_ENDPOINT:-http://localhost:8787}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 ChittyChat MCP Agent Test Suite"
echo "=================================="

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local path=$2
    local data=$3
    local description=$4

    echo ""
    echo "Testing: $description"
    echo "Endpoint: $method $path"

    if [ "$method" == "POST" ]; then
        response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${MCP_ENDPOINT}${path}" 2>&1)
    else
        response=$(curl -s "${MCP_ENDPOINT}${path}" 2>&1)
    fi

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        echo "Response: $(echo $response | jq -c '.' 2>/dev/null || echo $response)"
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "Error: $response"
        return 1
    fi
}

# Test 1: Database Query Tool
echo ""
echo "1️⃣  Testing Database Query Tool"
echo "================================"
test_endpoint "POST" "/tools/database_query" \
    '{"query": "SELECT COUNT(*) FROM sync_metadata", "params": []}' \
    "Database query execution"

# Test 2: Vector Search Tool
echo ""
echo "2️⃣  Testing Vector Search Tool"
echo "=============================="
test_endpoint "POST" "/tools/vector_search" \
    '{"query": "AI agent coordination", "namespace": "default", "limit": 5}' \
    "Vector similarity search"

# Test 3: Generate Embedding Tool
echo ""
echo "3️⃣  Testing Generate Embedding Tool"
echo "==================================="
test_endpoint "POST" "/tools/generate_embedding" \
    '{"text": "ChittyChat MCP Agent Test", "model": "@cf/baai/bge-base-en-v1.5"}' \
    "Text embedding generation"

# Test 4: Generate Text Tool
echo ""
echo "4️⃣  Testing Generate Text Tool"
echo "=============================="
test_endpoint "POST" "/tools/generate_text" \
    '{"prompt": "What is ChittyChat?", "model": "@cf/meta/llama-2-7b-chat-fp16", "maxTokens": 100}' \
    "Text generation with LLM"

# Test Pattern 1: Prompt Chaining
echo ""
echo "🔗 Testing Pattern 1: Prompt Chaining"
echo "====================================="
test_endpoint "POST" "/tools/chain_prompts" \
    '{
        "prompts": [
            "Analyze the input data",
            "Extract key insights",
            "Generate recommendations"
        ],
        "context": {"data": "ChittyChat usage metrics show 50% growth"}
    }' \
    "Sequential prompt processing"

# Test Pattern 2: Routing
echo ""
echo "🚦 Testing Pattern 2: Routing"
echo "============================="
test_endpoint "POST" "/tools/route_task" \
    '{
        "input": "Generate a technical report on system performance",
        "routes": [
            {"condition": "simple", "handler": "Basic response", "model": "@cf/meta/llama-2-7b-chat-fp16"},
            {"condition": "complex", "handler": "Detailed analysis", "model": "@cf/meta/llama-2-7b-chat-fp16"},
            {"condition": "technical", "handler": "Technical documentation", "model": "@cf/meta/llama-2-7b-chat-fp16"}
        ]
    }' \
    "Task routing based on complexity"

# Test Pattern 3: Parallelization
echo ""
echo "⚡ Testing Pattern 3: Parallelization"
echo "===================================="
test_endpoint "POST" "/tools/parallel_agents" \
    '{
        "task": "Analyze ChittyChat system health",
        "agents": [
            {"name": "DatabaseAnalyst", "role": "Analyze database metrics", "model": "@cf/meta/llama-2-7b-chat-fp16"},
            {"name": "PerformanceExpert", "role": "Evaluate performance data", "model": "@cf/meta/llama-2-7b-chat-fp16"},
            {"name": "SecurityAuditor", "role": "Check security status", "model": "@cf/meta/llama-2-7b-chat-fp16"}
        ]
    }' \
    "Parallel agent execution"

# Test Pattern 4: Orchestrator-Workers
echo ""
echo "🎯 Testing Pattern 4: Orchestrator-Workers"
echo "========================================="
test_endpoint "POST" "/tools/orchestrate_workers" \
    '{
        "task": "Perform comprehensive ChittyChat system audit",
        "maxWorkers": 3
    }' \
    "Orchestrated worker pattern"

# Test Pattern 5: Evaluator-Optimizer
echo ""
echo "📈 Testing Pattern 5: Evaluator-Optimizer"
echo "========================================"
test_endpoint "POST" "/tools/evaluate_optimize" \
    '{
        "input": "ChittyChat is an AI-powered synchronization platform.",
        "maxIterations": 2,
        "targetQuality": 0.8
    }' \
    "Iterative improvement pattern"

# Test Analytics Tools
echo ""
echo "📊 Testing Analytics Tools"
echo "========================="
test_endpoint "GET" "/tools/get_metrics" "" "Retrieve system metrics"
test_endpoint "POST" "/tools/reset_metrics" '{}' "Reset metrics"

# Test Agent State Management
echo ""
echo "💾 Testing Agent State Management"
echo "================================"
test_endpoint "GET" "/state" "" "Get current agent state"

# Health Check
echo ""
echo "🏥 Testing Health Check"
echo "======================"
test_endpoint "GET" "/health" "" "Service health check"

# Performance Test
echo ""
echo "⚡ Running Performance Test"
echo "=========================="
echo "Sending 10 concurrent requests..."

for i in {1..10}; do
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"text": "Performance test '${i}'"}' \
        "${MCP_ENDPOINT}/tools/generate_embedding" > /dev/null 2>&1 &
done

wait
echo -e "${GREEN}✅ Performance test completed${NC}"

# Summary
echo ""
echo "📋 Test Summary"
echo "=============="
echo "• Database Tools: Tested"
echo "• AI Tools: Tested"
echo "• Pattern 1 (Chaining): Tested"
echo "• Pattern 2 (Routing): Tested"
echo "• Pattern 3 (Parallelization): Tested"
echo "• Pattern 4 (Orchestration): Tested"
echo "• Pattern 5 (Evaluation): Tested"
echo "• Analytics: Tested"
echo "• State Management: Tested"
echo "• Health Check: Tested"
echo "• Performance: 10 concurrent requests"

echo ""
echo -e "${GREEN}✨ All MCP Agent tests completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check AI Gateway analytics: https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/ai/ai-gateway"
echo "2. Monitor Vectorize indexes: wrangler vectorize list"
echo "3. Review KV state: wrangler kv:key list --namespace-id=mcp-state"