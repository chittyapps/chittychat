#!/bin/bash
# ChittyFix Auto - Automatic Fix with Agent Enhancement
# Automatically invokes chittycheck-enhancer agent to fix compliance violations

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
FIX_TARGET="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHITTYCHECK_SCRIPT="${SCRIPT_DIR}/chittycheck-enhanced.sh"

# Fallback to absolute path if running via symlink
if [ ! -f "$CHITTYCHECK_SCRIPT" ]; then
    CHITTYCHECK_SCRIPT="/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh"
fi

echo -e "${CYAN}🔧 CHITTYFIX AUTO - Automatic Compliance Fix with Agent${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

# Step 1: Run pre-fix validation
echo -e "${BLUE}[1/4] Pre-Fix Validation...${NC}"
echo ""

BEFORE_OUTPUT=$(bash "$CHITTYCHECK_SCRIPT" 2>&1) || true
BEFORE_SCORE=$(echo "$BEFORE_OUTPUT" | grep "Compliance Score:" | grep -oE '[0-9]+%' | tr -d '%' || echo "0")

echo "   Current Compliance: ${BEFORE_SCORE}%"
echo ""

# Step 2: Identify fix targets
echo -e "${BLUE}[2/4] Identifying Fix Targets...${NC}"
echo "   Target: ${FIX_TARGET}"
echo ""

# Extract specific failure types
ROGUE_ID_FAIL=$(echo "$BEFORE_OUTPUT" | grep -E "Rogue ID Pattern Detection.*❌|No rogue ID generation patterns.*❌" || echo "")
SECURITY_FAIL=$(echo "$BEFORE_OUTPUT" | grep -E "SECURITY VALIDATION" -A 20 | grep "❌" || echo "")
SERVICE_FAIL=$(echo "$BEFORE_OUTPUT" | grep -E "ChittyOS Core Service|Internal Service Integration" -A 30 | grep "❌" || echo "")

# Count issues by category
ROGUE_COUNT=$(echo "$ROGUE_ID_FAIL" | grep -c "❌" || echo "0")
SECURITY_COUNT=$(echo "$SECURITY_FAIL" | grep -c "❌" || echo "0")
SERVICE_COUNT=$(echo "$SERVICE_FAIL" | grep -c "❌" || echo "0")

echo "   Issue Summary:"
echo "   - Rogue ID Patterns: ${ROGUE_COUNT}"
echo "   - Security Issues: ${SECURITY_COUNT}"
echo "   - Service Issues: ${SERVICE_COUNT}"
echo ""

# Step 3: Invoke chittycheck-enhancer agent
echo -e "${BLUE}[3/4] Invoking chittycheck-enhancer agent...${NC}"
echo ""

# Create detailed fix prompt based on target
case "$FIX_TARGET" in
    id|rogue)
        FIX_DESCRIPTION="Fix ChittyID rogue generation patterns (§36 violations)"
        ;;
    security|sec)
        FIX_DESCRIPTION="Fix security issues (hardcoded secrets, direct AI calls)"
        ;;
    services|svc)
        FIX_DESCRIPTION="Fix service connectivity and configuration"
        ;;
    all|*)
        FIX_DESCRIPTION="Fix all compliance violations"
        ;;
esac

AGENT_PROMPT="ChittyFix requested: ${FIX_TARGET}

Current compliance: ${BEFORE_SCORE}%

Issue breakdown:
- Rogue ID Patterns: ${ROGUE_COUNT} failures
- Security Issues: ${SECURITY_COUNT} failures
- Service Issues: ${SERVICE_COUNT} failures

Task: ${FIX_DESCRIPTION}

Please run chittycheck, analyze failures, implement fixes, and verify improvements."

# Check if running in interactive mode
if [ -t 0 ]; then
    # Interactive terminal - guide user
    echo -e "${MAGENTA}┌──────────────────────────────────────────────────────────┐${NC}"
    echo -e "${MAGENTA}│  ChittyFix requires chittycheck-enhancer agent           │${NC}"
    echo -e "${MAGENTA}│                                                          │${NC}"
    echo -e "${MAGENTA}│  Invoke in Claude Code:                                  │${NC}"
    echo -e "${MAGENTA}│                                                          │${NC}"
    echo -e "${MAGENTA}│    @agent-chittycheck-enhancer                           │${NC}"
    echo -e "${MAGENTA}│                                                          │${NC}"
    echo -e "${MAGENTA}│  Fix Target: ${FIX_TARGET}                                      │${NC}"
    echo -e "${MAGENTA}│  Description: ${FIX_DESCRIPTION}${NC}"
    echo -e "${MAGENTA}│                                                          │${NC}"
    echo -e "${MAGENTA}│  The agent will:                                         │${NC}"
    echo -e "${MAGENTA}│  1. Run chittycheck validation                           │${NC}"
    echo -e "${MAGENTA}│  2. Identify specific violations                         │${NC}"
    echo -e "${MAGENTA}│  3. Apply targeted fixes                                 │${NC}"
    echo -e "${MAGENTA}│  4. Re-validate and report                               │${NC}"
    echo -e "${MAGENTA}└──────────────────────────────────────────────────────────┘${NC}"
    echo ""

    # Show what will be fixed
    echo -e "${CYAN}Fix Plan:${NC}"

    if [ "$ROGUE_COUNT" -gt 0 ] && { [ "$FIX_TARGET" = "all" ] || [ "$FIX_TARGET" = "id" ] || [ "$FIX_TARGET" = "rogue" ]; }; then
        echo "   ✓ Replace local ID generation with ChittyID service calls"
        echo "   ✓ Implement SERVICE OR FAIL principle"
    fi

    if [ "$SECURITY_COUNT" -gt 0 ] && { [ "$FIX_TARGET" = "all" ] || [ "$FIX_TARGET" = "security" ] || [ "$FIX_TARGET" = "sec" ]; }; then
        echo "   ✓ Remove hardcoded secrets"
        echo "   ✓ Route AI calls through ChittyRouter"
    fi

    if [ "$SERVICE_COUNT" -gt 0 ] && { [ "$FIX_TARGET" = "all" ] || [ "$FIX_TARGET" = "services" ] || [ "$FIX_TARGET" = "svc" ]; }; then
        echo "   ✓ Fix service endpoints and configuration"
        echo "   ✓ Update environment variables"
    fi

    echo ""
    echo -e "${YELLOW}Waiting for agent invocation...${NC}"
    echo ""

    # Wait for user to invoke agent
    read -p "Press Enter after agent completes fixes, or Ctrl+C to cancel... " -r
    echo ""

    # Step 4: Post-fix validation
    echo -e "${BLUE}[4/4] Post-Fix Validation...${NC}"
    echo ""

    AFTER_OUTPUT=$(bash "$CHITTYCHECK_SCRIPT" 2>&1) || true
    AFTER_SCORE=$(echo "$AFTER_OUTPUT" | grep "Compliance Score:" | grep -oE '[0-9]+%' | tr -d '%' || echo "0")

    # Calculate improvement
    IMPROVEMENT=$((AFTER_SCORE - BEFORE_SCORE))

    echo -e "${CYAN}Fix Results:${NC}"
    echo "   Before: ${BEFORE_SCORE}%"
    echo "   After:  ${AFTER_SCORE}%"

    if [ "$IMPROVEMENT" -gt 0 ]; then
        echo -e "   ${GREEN}Improvement: +${IMPROVEMENT}%${NC}"
    elif [ "$IMPROVEMENT" -lt 0 ]; then
        echo -e "   ${RED}Regression: ${IMPROVEMENT}%${NC}"
    else
        echo -e "   ${YELLOW}No change${NC}"
    fi

    echo ""

    if [ "$AFTER_SCORE" -ge 80 ]; then
        echo -e "${GREEN}🎉 COMPLIANCE ACHIEVED!${NC}"
        echo -e "${GREEN}   Score: ${AFTER_SCORE}% >= 80%${NC}"
        exit 0
    elif [ "$IMPROVEMENT" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Compliance improved but below threshold${NC}"
        echo -e "${YELLOW}   Score: ${AFTER_SCORE}% < 80%${NC}"
        echo ""
        echo "Run chittyfix-auto.sh again to continue fixing remaining issues"
        exit 1
    else
        echo -e "${RED}❌ No improvement detected${NC}"
        echo "   Manual intervention may be required"
        exit 1
    fi
else
    # Non-interactive mode
    echo -e "${RED}❌ ChittyFix requires interactive mode${NC}"
    echo ""
    echo "Run in Claude Code and invoke: @agent-chittycheck-enhancer"
    exit 1
fi
