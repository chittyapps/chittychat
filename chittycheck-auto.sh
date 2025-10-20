#!/bin/bash
# ChittyCheck Auto - Automatic Compliance Check with Agent Enhancement
# Automatically invokes chittycheck-enhancer agent when issues are detected

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
COMPLIANCE_THRESHOLD=80
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHITTYCHECK_SCRIPT="${SCRIPT_DIR}/chittycheck-enhanced.sh"

# Fallback to absolute path if running via symlink
if [ ! -f "$CHITTYCHECK_SCRIPT" ]; then
    CHITTYCHECK_SCRIPT="/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh"
fi

CLAUDE_CODE_CLI="claude-code"

echo -e "${CYAN}🤖 CHITTYCHECK AUTO - Compliance Check with Agent Enhancement${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Run chittycheck-enhanced.sh
echo -e "${BLUE}[1/3] Running ChittyCheck Enhanced...${NC}"
echo ""

# Capture output and exit code
CHECK_OUTPUT=$(bash "$CHITTYCHECK_SCRIPT" 2>&1) || CHECK_EXIT_CODE=$?
CHECK_EXIT_CODE=${CHECK_EXIT_CODE:-0}

# Display output
echo "$CHECK_OUTPUT"

# Extract compliance score from output
COMPLIANCE_SCORE=$(echo "$CHECK_OUTPUT" | grep "Compliance Score:" | grep -oE '[0-9]+%' | tr -d '%' || echo "0")

echo ""
echo -e "${BLUE}[2/3] Analyzing Results...${NC}"
echo "   Compliance Score: ${COMPLIANCE_SCORE}%"
echo "   Threshold: ${COMPLIANCE_THRESHOLD}%"
echo ""

# Step 2: Check if agent intervention needed
if [ "$COMPLIANCE_SCORE" -lt "$COMPLIANCE_THRESHOLD" ]; then
    echo -e "${YELLOW}⚠️  Compliance below threshold - Invoking chittycheck-enhancer agent${NC}"
    echo ""

    # Extract failed checks
    FAILED_CHECKS=$(echo "$CHECK_OUTPUT" | grep -E "❌ FAIL" || echo "")
    FAILED_COUNT=$(echo "$FAILED_CHECKS" | grep -c "❌" || echo "0")

    echo -e "${MAGENTA}Failed Checks Detected: ${FAILED_COUNT}${NC}"
    if [ -n "$FAILED_CHECKS" ]; then
        echo "$FAILED_CHECKS" | sed 's/^/   /'
    fi
    echo ""

    # Step 3: Invoke chittycheck-enhancer agent via Claude Code
    echo -e "${BLUE}[3/3] Invoking chittycheck-enhancer agent...${NC}"
    echo ""

    # Create agent task prompt
    AGENT_PROMPT="ChittyCheck compliance check failed with score ${COMPLIANCE_SCORE}% (threshold: ${COMPLIANCE_THRESHOLD}%).

Failures detected:
${FAILED_CHECKS}

Please analyze chittycheck results, fix all compliance violations, and verify improvements."

    # Check if running in Claude Code context (MCP available)
    if [ -t 0 ]; then
        # Interactive terminal - guide user to invoke agent
        echo -e "${YELLOW}┌─────────────────────────────────────────────────────────┐${NC}"
        echo -e "${YELLOW}│  Please invoke the following agent in Claude Code:     │${NC}"
        echo -e "${YELLOW}│                                                         │${NC}"
        echo -e "${YELLOW}│  @agent-chittycheck-enhancer                            │${NC}"
        echo -e "${YELLOW}│                                                         │${NC}"
        echo -e "${YELLOW}│  The agent will automatically:                          │${NC}"
        echo -e "${YELLOW}│  1. Run chittycheck validation                          │${NC}"
        echo -e "${YELLOW}│  2. Analyze compliance failures                         │${NC}"
        echo -e "${YELLOW}│  3. Fix violations (rogue IDs, security, config)        │${NC}"
        echo -e "${YELLOW}│  4. Verify improvements                                 │${NC}"
        echo -e "${YELLOW}└─────────────────────────────────────────────────────────┘${NC}"
        echo ""
        echo -e "${CYAN}Compliance Report:${NC}"
        echo "   Current Score: ${COMPLIANCE_SCORE}%"
        echo "   Target Score: ${COMPLIANCE_THRESHOLD}%"
        echo "   Failed Checks: ${FAILED_COUNT}"
        echo ""
        exit 1
    else
        # Non-interactive (CI/automation) - log and exit
        echo -e "${RED}❌ Compliance check failed in non-interactive mode${NC}"
        echo "   Score: ${COMPLIANCE_SCORE}% < ${COMPLIANCE_THRESHOLD}%"
        echo "   Failed: ${FAILED_COUNT} checks"
        echo ""
        echo "To fix, run in Claude Code and invoke: @agent-chittycheck-enhancer"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Compliance threshold met - No agent intervention needed${NC}"
    echo "   Score: ${COMPLIANCE_SCORE}% >= ${COMPLIANCE_THRESHOLD}%"
    echo ""
    echo -e "${GREEN}🎉 CHITTYOS COMPLIANCE ACHIEVED!${NC}"
    exit 0
fi
