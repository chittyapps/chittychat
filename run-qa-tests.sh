#!/bin/bash

# ChittyPM Quality Assurance Test Script
# Run comprehensive tests on the MCP-based project management system

echo "=========================================="
echo "ChittyPM Quality Assurance Test Suite"
echo "=========================================="
echo "Test Date: $(date)"
echo "Environment: Development"
echo ""

# Test configuration
BASE_URL="http://localhost:5000"
TEST_PROJECT_ID=""
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
test_passed() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED_TESTS++))
}

test_failed() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED_TESTS++))
}

test_warning() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

test_api_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint")
    
    if [ "$response" -eq "$expected_status" ]; then
        test_passed "$description"
        return 0
    else
        test_failed "$description (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

echo "1. BASIC CONNECTIVITY TESTS"
echo "----------------------------"

# Test if application is running
if curl -s "$BASE_URL" > /dev/null; then
    test_passed "Application is running on $BASE_URL"
else
    test_failed "Application is not accessible"
    echo "Make sure the application is running with 'npm run dev'"
    exit 1
fi

# Test API endpoints
test_api_endpoint "/api/dashboard/stats" 200 "Dashboard stats endpoint"
test_api_endpoint "/api/projects" 200 "Projects endpoint"
test_api_endpoint "/api/agents/active" 200 "Active agents endpoint"
test_api_endpoint "/api/integrations" 200 "Integrations endpoint"

echo ""
echo "2. PROJECT MANAGEMENT TESTS"
echo "---------------------------"

# Create a test project
echo "Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "QA Automation Test Project",
        "description": "Automated testing project for QA validation",
        "isGlobal": true,
        "category": "Automation"
    }')

if echo "$PROJECT_RESPONSE" | grep -q "id"; then
    TEST_PROJECT_ID=$(echo "$PROJECT_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
    test_passed "Project creation via API"
    echo "  Project ID: $TEST_PROJECT_ID"
else
    test_failed "Project creation via API"
    echo "  Response: $PROJECT_RESPONSE"
fi

# Verify project in list
if curl -s "$BASE_URL/api/projects" | grep -q "$TEST_PROJECT_ID"; then
    test_passed "Project appears in project list"
else
    test_failed "Project does not appear in project list"
fi

echo ""
echo "3. TASK MANAGEMENT TESTS"
echo "------------------------"

if [ -n "$TEST_PROJECT_ID" ]; then
    # Create test tasks
    for i in {1..3}; do
        TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
            -H "Content-Type: application/json" \
            -d '{
                "projectId": "'$TEST_PROJECT_ID'",
                "title": "QA Test Task '$i'",
                "description": "Automated test task for validation",
                "priority": "medium",
                "status": "pending"
            }')
        
        if echo "$TASK_RESPONSE" | grep -q "id"; then
            test_passed "Task $i creation via API"
        else
            test_failed "Task $i creation via API"
        fi
    done
else
    test_warning "Skipping task tests - no valid project ID"
fi

echo ""
echo "4. MCP PROTOCOL TESTS"
echo "--------------------"

# Test MCP discovery endpoint
test_api_endpoint "/api/mcp/discovery" 200 "MCP tool discovery endpoint"

# Test MCP project creation endpoint
MCP_PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/mcp/projects" \
    -H "Content-Type: application/json" \
    -d '{
        "agentId": "test-agent-qa",
        "projectData": {
            "name": "MCP Test Project",
            "description": "Project created via MCP protocol",
            "isGlobal": false,
            "category": "MCP Testing"
        }
    }')

if echo "$MCP_PROJECT_RESPONSE" | grep -q "id"; then
    test_passed "MCP project creation"
else
    test_failed "MCP project creation"
    echo "  Response: $MCP_PROJECT_RESPONSE"
fi

echo ""
echo "5. WEBSOCKET CONNECTION TESTS"
echo "-----------------------------"

# Test WebSocket endpoint (basic connectivity)
if curl -s -H "Upgrade: websocket" -H "Connection: Upgrade" "$BASE_URL/ws" > /dev/null; then
    test_passed "WebSocket endpoint is accessible"
else
    test_failed "WebSocket endpoint not accessible"
fi

echo ""
echo "6. INTEGRATION TESTS"
echo "-------------------"

# Check integration status
INTEGRATIONS_RESPONSE=$(curl -s "$BASE_URL/api/integrations")

if echo "$INTEGRATIONS_RESPONSE" | grep -q "chittyid"; then
    test_passed "ChittyID integration is configured"
else
    test_warning "ChittyID integration not found or configured"
fi

if echo "$INTEGRATIONS_RESPONSE" | grep -q "registry"; then
    test_passed "Registry integration is configured"  
else
    test_warning "Registry integration not found or configured"
fi

echo ""
echo "7. DATA VALIDATION TESTS"
echo "-----------------------"

# Test dashboard stats structure
STATS_RESPONSE=$(curl -s "$BASE_URL/api/dashboard/stats")

if echo "$STATS_RESPONSE" | grep -q "totalProjects\|activeProjects\|activeAgents"; then
    test_passed "Dashboard stats structure is valid"
else
    test_failed "Dashboard stats structure is invalid"
fi

# Verify data consistency
TOTAL_PROJECTS=$(echo "$STATS_RESPONSE" | sed -n 's/.*"totalProjects":\([0-9]*\).*/\1/p')
PROJECT_COUNT=$(curl -s "$BASE_URL/api/projects" | grep -o '"id"' | wc -l)

if [ "$TOTAL_PROJECTS" -eq "$PROJECT_COUNT" ]; then
    test_passed "Project count consistency between stats and list"
else
    test_failed "Project count mismatch (Stats: $TOTAL_PROJECTS, List: $PROJECT_COUNT)"
fi

echo ""
echo "8. ERROR HANDLING TESTS"
echo "----------------------"

# Test invalid endpoints
test_api_endpoint "/api/nonexistent" 404 "404 error for invalid endpoint"

# Test malformed project creation
MALFORMED_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
    -H "Content-Type: application/json" \
    -d '{"invalid": "data"}')

if echo "$MALFORMED_RESPONSE" | grep -q "error\|validation"; then
    test_passed "Proper error handling for invalid project data"
else
    test_failed "No error handling for invalid project data"
fi

echo ""
echo "=========================================="
echo "QA TEST RESULTS SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed Tests: $PASSED_TESTS${NC}"
echo -e "${RED}Failed Tests: $FAILED_TESTS${NC}"

# Calculate success rate
TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))
if [ "$TOTAL_TESTS" -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $SUCCESS_RATE%"
fi

echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ChittyPM is ready for use.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please review the issues above.${NC}"
    exit 1
fi