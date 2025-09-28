#!/bin/bash
# ChittyCheck Enhanced - ChittyOS Framework Validation
# Validates ChittyID integration, security compliance, and framework adherence

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CHITTY_ID_SERVICE="https://id.chitty.cc"
COMPLIANCE_THRESHOLD=80
PROJECT_DIR="${PWD}"

# Parse command-line arguments
FIX_MODE=false
FIX_TARGET=""
for arg in "$@"; do
    case $arg in
        --fix)
            FIX_MODE=true
            shift
            ;;
        --help|-h)
            if [ "$FIX_MODE" = true ]; then
                # Show fix help
                echo -e "${CYAN}CHITTYCHECK --fix - System Repair and Testing${NC}"
                echo "Usage: chittycheck --fix [target]"
                echo ""
                echo "Targets:"
                echo "  all        - Fix everything"
                echo "  id         - Fix ChittyID system"
                echo "  git        - Fix git repository"
                echo "  data       - Fix data/env configuration"
                echo "  security   - Fix security issues"
                echo "  pen        - Penetration testing scan"
                echo "  qa         - Quality assurance check"
                echo "  ua         - User acceptance testing"
                echo "  schema     - Fix documentation/CLAUDE.md"
                echo "  registry   - Fix service registry"
                echo "  services   - Fix service URLs"
                echo "  deps       - Fix dependencies"
                echo "  claude     - Fix Claude integration"
                echo ""
                echo "Shortcut: chitfix [target]"
                exit 0
            else
                echo -e "${CYAN}CHITTYCHECK - ChittyOS Framework Validation${NC}"
                echo "Usage: chittycheck [options]"
                echo ""
                echo "Options:"
                echo "  --fix [target]  Run system fixes"
                echo "  --qa           Quality assurance mode"
                echo "  --security     Security-focused check"
                echo "  --help         Show this help"
                exit 0
            fi
            ;;
        *)
            if [ "$FIX_MODE" = true ] && [ -z "$FIX_TARGET" ]; then
                FIX_TARGET="$arg"
            fi
            ;;
    esac
done

# If fix mode, source and run chitfix functionality
if [ "$FIX_MODE" = true ]; then
    CHITFIX_SCRIPT="$(dirname "$0")/chitfix"
    if [ -f "$CHITFIX_SCRIPT" ]; then
        # Run chitfix with the target
        exec "$CHITFIX_SCRIPT" "${FIX_TARGET:-all}"
    else
        echo -e "${RED}Error: chitfix script not found at $CHITFIX_SCRIPT${NC}"
        exit 1
    fi
fi

echo -e "${CYAN}🔍 CHITTYCHECK ENHANCED - ChittyOS Framework Validation${NC}"
echo "══════════════════════════════════════════════════════════"

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNINGS=0
CRITICAL_ISSUES=0

check_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    if [ "$result" -eq 0 ]; then
        echo -e "  ${GREEN}✅ PASS${NC} - $test_name"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "  ${RED}❌ FAIL${NC} - $test_name"
        [ -n "$details" ] && echo -e "    ${YELLOW}Details: $details${NC}"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
}

warning_result() {
    local test_name="$1"
    local details="${2:-}"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "  ${YELLOW}⚠️  WARN${NC} - $test_name"
    [ -n "$details" ] && echo -e "    ${YELLOW}Details: $details${NC}"
    WARNINGS=$((WARNINGS + 1))
}

echo -e "\n${BLUE}🏗️  FRAMEWORK VALIDATION${NC}"
echo "════════════════════════════════"

# Check 1: ChittyID Token Authentication
echo -e "${CYAN}[TEST 1] ChittyID Token Authentication${NC}"
if [ -n "${CHITTY_ID_TOKEN:-}" ]; then
    check_result "CHITTY_ID_TOKEN configured" 0
else
    check_result "CHITTY_ID_TOKEN configured" 1 "Environment variable not set"
fi

# Check 2: ChittyOS Data Directory
echo -e "${CYAN}[TEST 2] ChittyOS Data Directory Structure${NC}"
CHITTYOS_DATA="/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data"
if [ -d "$CHITTYOS_DATA" ]; then
    check_result "ChittyOS data directory exists" 0
else
    check_result "ChittyOS data directory exists" 1 "Directory not found: $CHITTYOS_DATA"
fi

# Check 3: Rogue ID Patterns
echo -e "${CYAN}[TEST 3] Rogue ID Pattern Detection${NC}"
rogue_patterns=0
for pattern in "make_.*chitty.*id" "mod-97" "generate.*chitty.*id"; do
    if grep -r "$pattern" . --include="*.py" --include="*.js" >/dev/null 2>&1; then
        rogue_patterns=$((rogue_patterns + 1))
    fi
done

if [ $rogue_patterns -eq 0 ]; then
    check_result "No rogue ID generation patterns" 0
else
    check_result "No rogue ID generation patterns" 1 "Found $rogue_patterns rogue patterns"
fi

# Check 4: Service-Based ID Generation
echo -e "${CYAN}[TEST 4] Service-Based ID Generation${NC}"
service_calls=0
if grep -r "id\.chitty\.cc" . --include="*.py" --include="*.js" >/dev/null 2>&1; then
    service_calls=1
fi

if [ $service_calls -eq 1 ]; then
    check_result "Uses ChittyID service" 0
else
    check_result "Uses ChittyID service" 1 "No service calls found"
fi

echo -e "\n${BLUE}🔒 SECURITY VALIDATION${NC}"
echo "════════════════════════════════"

# Check 5: No Direct AI Provider Calls
echo -e "${CYAN}[TEST 5] No Direct AI Provider Calls${NC}"
if [ -f "./scripts/ci/no-direct-models.sh" ]; then
    if bash ./scripts/ci/no-direct-models.sh >/dev/null 2>&1; then
        check_result "No direct AI provider calls" 0
    else
        check_result "No direct AI provider calls" 1 "Found direct provider calls"
    fi
else
    warning_result "No direct AI provider calls" "CI guard script not found"
fi

# Check 6: Hardcoded Secrets Detection
echo -e "${CYAN}[TEST 6] Hardcoded Secrets Detection${NC}"
secrets_found=0
for pattern in "sk-[a-zA-Z0-9]+" "xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+" "ghp_[a-zA-Z0-9]+"; do
    if grep -r "$pattern" . --include="*.py" --include="*.js" --include="*.md" >/dev/null 2>&1; then
        secrets_found=$((secrets_found + 1))
    fi
done

if [ $secrets_found -eq 0 ]; then
    check_result "No hardcoded secrets" 0
else
    check_result "No hardcoded secrets" 1 "Found $secrets_found potential secrets"
fi

echo -e "\n${BLUE}📊 STORAGE VALIDATION${NC}"
echo "════════════════════════════════"

# Check 7: R2 Configuration
echo -e "${CYAN}[TEST 7] R2 Storage Configuration${NC}"
r2_vars=0
for var in "R2_ENDPOINT" "R2_ACCESS_KEY" "R2_SECRET_KEY"; do
    if [ -n "${!var:-}" ]; then
        r2_vars=$((r2_vars + 1))
    fi
done

if [ $r2_vars -eq 3 ]; then
    check_result "R2 credentials configured" 0
elif [ $r2_vars -gt 0 ]; then
    warning_result "R2 credentials configured" "Partial configuration ($r2_vars/3 variables)"
else
    check_result "R2 credentials configured" 1 "No R2 environment variables set"
fi

# Check 8: Neon Database Configuration
echo -e "${CYAN}[TEST 8] Neon Database Configuration${NC}"
if [ -n "${NEON_CONNECTION_STRING:-}" ]; then
    check_result "Neon connection configured" 0
else
    check_result "Neon connection configured" 1 "NEON_CONNECTION_STRING not set"
fi

echo -e "\n${BLUE}🔧 CODE QUALITY${NC}"
echo "════════════════════════════════"

# Check 9: CLAUDE.md Exists
echo -e "${CYAN}[TEST 9] CLAUDE.md Documentation${NC}"
if [ -f "CLAUDE.md" ]; then
    check_result "CLAUDE.md exists" 0
else
    check_result "CLAUDE.md exists" 1 "Documentation file missing"
fi

# Check 10: Evidence CLI Single Path
echo -e "${CYAN}[TEST 10] Evidence CLI Single Path${NC}"
if [ -f "evidence_cli.py" ]; then
    if grep -q "ChittyOSEvidenceAnalyzer" evidence_cli.py && ! grep -q "EvidenceAnalyzerV2" evidence_cli.py; then
        check_result "Single CLI path (ChittyOS only)" 0
    else
        check_result "Single CLI path (ChittyOS only)" 1 "Multiple analyzer paths detected"
    fi
else
    check_result "Single CLI path (ChittyOS only)" 1 "evidence_cli.py not found"
fi

# Calculate compliance score
if [ $TOTAL_CHECKS -gt 0 ]; then
    COMPLIANCE_SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
else
    COMPLIANCE_SCORE=0
fi

echo -e "\n${BLUE}📈 COMPLIANCE SUMMARY${NC}"
echo "════════════════════════════════"
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${RED}Failed: $CRITICAL_ISSUES${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "Compliance Score: ${COMPLIANCE_SCORE}%"

if [ $COMPLIANCE_SCORE -ge $COMPLIANCE_THRESHOLD ]; then
    echo -e "\n${GREEN}🎉 CHITTYOS COMPLIANCE ACHIEVED!${NC}"
    echo -e "${GREEN}Framework validation successful${NC}"
    exit 0
else
    echo -e "\n${RED}🚨 COMPLIANCE ISSUES DETECTED${NC}"
    echo -e "${RED}Score below threshold: $COMPLIANCE_SCORE% < $COMPLIANCE_THRESHOLD%${NC}"
    exit 1
fi