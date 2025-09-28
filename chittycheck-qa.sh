#!/bin/bash

# ChittyCheck QA Test Suite
# Comprehensive testing for ChittyCheck functionality, security, and reliability

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Test counters
QA_PASSED=0
QA_FAILED=0
QA_WARNINGS=0
QA_TOTAL=0

CHITTYCHECK_SCRIPT="/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh"
TEST_WORKSPACE="/tmp/chittycheck-qa-$$"

# QA Test Framework
qa_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"

    ((QA_TOTAL++))
    echo -e "${CYAN}[TEST $QA_TOTAL] $test_name${RESET}"

    # Run test
    eval "$test_command" >/dev/null 2>&1
    local actual_exit_code=$?

    if [ $actual_exit_code -eq $expected_exit_code ]; then
        echo -e "  ${GREEN}✅ PASS${RESET}"
        ((QA_PASSED++))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${RESET} (expected exit $expected_exit_code, got $actual_exit_code)"
        ((QA_FAILED++))
        return 1
    fi
}

qa_security_test() {
    local test_name="$1"
    local test_command="$2"
    local security_check="$3"

    ((QA_TOTAL++))
    echo -e "${BLUE}[SECURITY $QA_TOTAL] $test_name${RESET}"

    # Run test and capture output
    local output=$(eval "$test_command" 2>&1)
    local exit_code=$?

    # Check security condition
    if eval "$security_check"; then
        echo -e "  ${GREEN}🔒 SECURE${RESET}"
        ((QA_PASSED++))
        return 0
    else
        echo -e "  ${RED}🚨 SECURITY RISK${RESET}"
        echo -e "  Output: $output"
        ((QA_FAILED++))
        return 1
    fi
}

# Setup test workspace
setup_test_workspace() {
    echo -e "${BOLD}🏗️  Setting up QA test workspace${RESET}"

    mkdir -p "$TEST_WORKSPACE"
    cd "$TEST_WORKSPACE"

    # Create mock project structure
    mkdir -p src tests docs

    # Create test files
    cat > package.json << 'EOF'
{
  "name": "test-project",
  "dependencies": {
    "uuid": "^9.0.0",
    "nanoid": "^4.0.0"
  }
}
EOF

    cat > .env << 'EOF'
CHITTY_ID_TOKEN=test_token_123
CHITTYOS_ACCOUNT_ID=test_account
EOF

    cat > src/main.js << 'EOF'
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Rogue patterns for testing
const id1 = crypto.randomUUID();
const id2 = crypto.randomBytes(16).toString('hex');
const id3 = Date.now().toString() + '_id';
const id4 = Math.random().toString(36).substr(2, 9);

// Good patterns
const chittyId = await mintChittyId({ type: 'user' });
const response = fetch('https://id.chitty.cc/v1/mint');

function generateId() {
    return 'local_' + Math.random();
}
EOF

    echo -e "  ${GREEN}✅ Test workspace created at $TEST_WORKSPACE${RESET}"
}

# Cleanup test workspace
cleanup_test_workspace() {
    echo -e "${BOLD}🧹 Cleaning up test workspace${RESET}"
    rm -rf "$TEST_WORKSPACE"
}

# ============================================
# FUNCTIONAL TESTS
# ============================================

run_functional_tests() {
    echo -e "${BOLD}🔧 FUNCTIONAL TESTS${RESET}"
    echo -e "════════════════════════════════"

    # Test 1: Script exists and is executable
    qa_test "Script exists and executable" "[ -x '$CHITTYCHECK_SCRIPT' ]"

    # Test 2: Script runs without crashing
    qa_test "Script runs without fatal errors" "$CHITTYCHECK_SCRIPT" 1

    # Test 3: Detects rogue packages
    qa_test "Detects rogue packages in package.json" "grep -q 'uuid.*nanoid' <($CHITTYCHECK_SCRIPT 2>&1)"

    # Test 4: Detects rogue patterns
    qa_test "Detects rogue ID patterns" "grep -q 'crypto\.randomUUID.*instance' <($CHITTYCHECK_SCRIPT 2>&1)"

    # Test 5: Validates token presence
    qa_test "Validates CHITTY_ID_TOKEN" "grep -q 'CHITTY_ID_TOKEN' <($CHITTYCHECK_SCRIPT 2>&1)"

    # Test 6: Shows compliance score
    qa_test "Shows compliance score" "grep -q '[0-9]*%.*Grade' <($CHITTYCHECK_SCRIPT 2>&1)"

    # Test 7: Creates missing files
    rm -f .gitignore CLAUDE.md
    qa_test "Auto-creates missing files" "$CHITTYCHECK_SCRIPT >/dev/null 2>&1 && [ -f .gitignore ] && [ -f CLAUDE.md ]"

    echo ""
}

# ============================================
# SECURITY TESTS
# ============================================

run_security_tests() {
    echo -e "${BOLD}🔒 SECURITY TESTS${RESET}"
    echo -e "════════════════════════════════"

    # Security Test 1: No secrets leaked in output
    qa_security_test "No secrets in output" \
        "$CHITTYCHECK_SCRIPT 2>&1" \
        "! echo '$output' | grep -E '(secret|password|key|token).*[a-zA-Z0-9]{20,}'"

    # Security Test 2: Safe .env parsing
    echo "MALICIOUS_VAR=\$(rm -rf /)" >> .env
    qa_security_test "Safe .env parsing (no command injection)" \
        "$CHITTYCHECK_SCRIPT 2>&1" \
        "[ -d '$TEST_WORKSPACE' ]"  # Directory should still exist

    # Security Test 3: No unauthorized network calls
    qa_security_test "No unauthorized network calls" \
        "strace -e trace=network $CHITTYCHECK_SCRIPT 2>&1 | head -100" \
        "! echo '$output' | grep -E '(connect.*[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})' | grep -v 'chitty.cc'"

    # Security Test 4: Input validation
    PROJECT_NAME="../../../etc/passwd" qa_security_test "Input validation on project name" \
        "$CHITTYCHECK_SCRIPT 2>&1" \
        "! echo '$output' | grep -q '/etc/passwd'"

    # Security Test 5: File permissions check
    qa_security_test "Secure file creation permissions" \
        "$CHITTYCHECK_SCRIPT >/dev/null 2>&1; ls -la .gitignore" \
        "echo '$output' | grep -q '^-rw-r--r--'"

    echo ""
}

# ============================================
# PENETRATION TESTS
# ============================================

run_penetration_tests() {
    echo -e "${BOLD}🎯 PENETRATION TESTS${RESET}"
    echo -e "════════════════════════════════"

    # Pen Test 1: Command injection via environment
    export CHITTY_ID_TOKEN="; rm -rf /tmp/test; echo 'injected'"
    qa_security_test "Command injection via CHITTY_ID_TOKEN" \
        "$CHITTYCHECK_SCRIPT 2>&1" \
        "! echo '$output' | grep -q 'injected'"

    # Pen Test 2: Path traversal
    mkdir -p ../../../tmp/pentest
    echo "sensitive_data" > ../../../tmp/pentest/secret.txt
    qa_security_test "Path traversal protection" \
        "cd ../../../tmp/pentest && $CHITTYCHECK_SCRIPT 2>&1" \
        "! echo '$output' | grep -q 'sensitive_data'"

    # Pen Test 3: Resource exhaustion
    qa_security_test "Resource exhaustion protection" \
        "timeout 30s $CHITTYCHECK_SCRIPT >/dev/null 2>&1" \
        "[ $? -eq 124 ] || [ $? -eq 0 ] || [ $? -eq 1 ]"  # Should timeout or complete normally

    # Pen Test 4: Log injection
    export PROJECT_NAME=$'evil\nINJECTED LOG LINE\nmore_evil'
    qa_security_test "Log injection protection" \
        "$CHITTYCHECK_SCRIPT 2>&1" \
        "! echo '$output' | grep -q 'INJECTED LOG LINE'"

    # Pen Test 5: Race condition testing
    qa_security_test "Race condition protection" \
        "$CHITTYCHECK_SCRIPT & $CHITTYCHECK_SCRIPT & wait" \
        "[ -f .env ] && [ -f .gitignore ]"  # Files should still be intact

    echo ""
}

# ============================================
# PERFORMANCE TESTS
# ============================================

run_performance_tests() {
    echo -e "${BOLD}⚡ PERFORMANCE TESTS${RESET}"
    echo -e "════════════════════════════════"

    # Create large test files
    for i in {1..100}; do
        echo "const id$i = crypto.randomUUID();" >> src/large_file_$i.js
    done

    # Performance Test 1: Execution time
    local start_time=$(date +%s)
    $CHITTYCHECK_SCRIPT >/dev/null 2>&1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    qa_test "Completes within 60 seconds" "[ $duration -lt 60 ]"

    # Performance Test 2: Memory usage
    qa_test "Memory usage under 100MB" \
        "/usr/bin/time -l $CHITTYCHECK_SCRIPT >/dev/null 2>&1 | grep 'maximum resident set size' | awk '{print \$1}' | awk '{print (\$1 < 100000000)}' | grep -q 1"

    echo ""
}

# ============================================
# INTEGRATION TESTS
# ============================================

run_integration_tests() {
    echo -e "${BOLD}🔗 INTEGRATION TESTS${RESET}"
    echo -e "════════════════════════════════"

    # Integration Test 1: Status line integration
    qa_test "Status line integration works" \
        "source /Users/nb/.claude/projects/-/chittychat/chittycheck-status.sh && chittycheck_status 'compact' | grep -q '%'"

    # Integration Test 2: ChittyChat logging
    qa_test "ChittyChat logging integration" \
        "$CHITTYCHECK_SCRIPT >/dev/null 2>&1 && [ -d ~/.chittychat/compliance ]"

    # Integration Test 3: Config loading
    qa_test "ChittyOS config loading" \
        "$CHITTYCHECK_SCRIPT 2>&1 | grep -q 'Registry: https://registry.chitty.cc'"

    echo ""
}

# ============================================
# MAIN QA RUNNER
# ============================================

show_qa_summary() {
    echo -e "${BOLD}📊 QA TEST SUMMARY${RESET}"
    echo -e "════════════════════════════════"
    echo -e "Total Tests: $QA_TOTAL"
    echo -e "${GREEN}Passed: $QA_PASSED${RESET}"
    echo -e "${RED}Failed: $QA_FAILED${RESET}"
    echo -e "${YELLOW}Warnings: $QA_WARNINGS${RESET}"

    local success_rate=0
    if [ $QA_TOTAL -gt 0 ]; then
        success_rate=$(( (QA_PASSED * 100) / QA_TOTAL ))
    fi

    echo -e "Success Rate: ${success_rate}%"

    if [ $QA_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${RESET}"
        return 0
    else
        echo -e "${RED}💥 SOME TESTS FAILED!${RESET}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BOLD}🔬 CHITTYCHECK QA & PENETRATION TESTING${RESET}"
    echo -e "══════════════════════════════════════════════"
    echo ""

    # Setup
    setup_test_workspace
    echo ""

    # Run test suites
    run_functional_tests
    run_security_tests
    run_penetration_tests
    run_performance_tests
    run_integration_tests

    # Summary
    show_qa_summary
    local exit_code=$?

    # Cleanup
    cleanup_test_workspace

    exit $exit_code
}

# Run if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi