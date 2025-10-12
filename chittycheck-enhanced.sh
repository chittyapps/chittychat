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

# Session Provisioning: Ensure session has ChittyID
echo -e "${CYAN}[SESSION] Provisioning Session ChittyID${NC}"
SESSION_STATE_FILE="${HOME}/.claude/session-sync-state.json"
CURRENT_SESSION=""

# Check if session already exists
if [ -f "$SESSION_STATE_FILE" ]; then
    CURRENT_SESSION=$(jq -r '.active_session // empty' "$SESSION_STATE_FILE" 2>/dev/null || echo "")
fi

# If no session or invalid, provision new one via chittyid-client
if [ -z "$CURRENT_SESSION" ] || [ "$CURRENT_SESSION" = "null" ]; then
    echo -e "  ${YELLOW}ℹ️  No active session - provisioning via id.chitty.cc...${NC}"

    if [ -z "${CHITTY_ID_TOKEN:-}" ]; then
        echo -e "  ${RED}❌ CHITTY_ID_TOKEN not set - cannot provision session${NC}"
        CURRENT_SESSION="local_fallback_$(date +%s)"
    else
        # Use chittyid-client npm package to mint session ID
        CURRENT_SESSION=$(node -e "
(async () => {
    try {
        const { ChittyIDClient } = await import('@chittyos/chittyid-client');
        const os = await import('os');

        const client = new ChittyIDClient({
            serviceUrl: 'https://id.chitty.cc/v1',
            apiKey: process.env.CHITTY_ID_TOKEN
        });

        const chittyId = await client.mint({
            entity: 'SESSION',
            name: 'chittycheck-session',
            metadata: {
                hostname: os.hostname(),
                platform: os.platform(),
                user: os.userInfo().username,
                timestamp: new Date().toISOString(),
                type: 'chittycheck-session',
                tool: 'chittycheck',
                framework: 'chittyos-v1.0.1'
            }
        });

        console.log(chittyId);
    } catch (error) {
        console.error('PROVISION_FAILED:', error.message);
        process.exit(1);
    }
})();
" 2>&1)

        if [ $? -ne 0 ]; then
            echo -e "  ${RED}❌ Session provisioning failed: $CURRENT_SESSION${NC}"
            CURRENT_SESSION="local_fallback_$(date +%s)"
        else
            echo -e "  ${GREEN}✅ Session provisioned: $CURRENT_SESSION${NC}"

            # Save session state
            mkdir -p "$(dirname "$SESSION_STATE_FILE")"
            cat > "$SESSION_STATE_FILE" <<EOF
{
    "last_sync": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "active_session": "${CURRENT_SESSION}",
    "session_count": 1,
    "chittyos_integration": true,
    "chittychat_enabled": true,
    "cross_session_memory": {
        "framework_version": "1.0.1",
        "tool": "chittycheck"
    }
}
EOF
        fi
    fi
else
    echo -e "  ${GREEN}✅ Using existing session: $CURRENT_SESSION${NC}"

    # Check for crash from previous session
    echo -e "${CYAN}[SESSION] Checking for crash recovery${NC}"
    CRASH_DETECTION=$(node -e "
(async () => {
    try {
        const { detectCrash } = await import('/Users/nb/.claude/tools/session-manager.js');
        const result = await detectCrash();
        console.log(JSON.stringify(result));
    } catch (error) {
        console.error('CRASH_DETECT_FAILED:', error.message);
        process.exit(1);
    }
})();
" 2>&1)

    if [ $? -eq 0 ]; then
        CRASH_STATUS=$(echo "$CRASH_DETECTION" | jq -r '.crashed // false')
        CRASH_REASON=$(echo "$CRASH_DETECTION" | jq -r '.reason // "unknown"')

        if [ "$CRASH_STATUS" = "true" ]; then
            echo -e "  ${YELLOW}⚠️  Unclean shutdown detected: $CRASH_REASON${NC}"
            echo -e "  ${YELLOW}   Previous session may have crashed${NC}"
            echo -e "  ${BLUE}   💡 Run 'chitty session --start' to restore from crash${NC}"
        else
            echo -e "  ${GREEN}✅ No crash detected - clean shutdown${NC}"
        fi
    fi
fi

# Export session ID for use in other checks
export CHITTY_SESSION_ID="$CURRENT_SESSION"

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

# Check 3: Rogue ID Patterns (Enhanced Detection)
echo -e "${CYAN}[TEST 3] Rogue ID Pattern Detection${NC}"
rogue_patterns=0
rogue_files=()

# Comprehensive patterns for local ID generation
# NOTE: These must be IMPLEMENTATIONS, not just function names
declare -a ID_PATTERNS=(
    # UUID/Random generation patterns (§36 violations - actual implementations)
    "crypto\.randomUUID\(\)"
    "Math\.random\(\)\.toString\(36\)"
    "Date\.now\(\).*Math\.random\(\)"
    "uuid\.v4\(\)"
    "uuidv4\(\)"

    # Session/Transaction ID local generation (actual assignments)
    "session.*=.*Math\.random"
    "sessionId.*=.*Math\.random"
    "transactionId.*=.*Math\.random"
    "const.*Id.*=.*crypto\.randomUUID"
    "const.*Id.*=.*Math\.random"
    "version.*=.*crypto\.randomUUID"

    # Mod-97 algorithm (ChittyID local generation)
    "mod.?97|mod.{1,3}97"
)

# Exclude patterns (legitimate uses)
EXCLUDE_DIRS="node_modules|archive|deprecated|test|\.git|dist|build|public|\.next|\.wrangler|chittypornjockey|email-worker-repo|attached_assets"
EXCLUDE_FILES="backup|legacy|\.test\.|\.spec\.|\.min\.|\.bundle\.|demo_|Mock\.|mock\.|\.backup|\.old"

# Search for patterns (optimized with single grep)
combined_pattern=$(IFS='|'; echo "${ID_PATTERNS[*]}")
while IFS= read -r file_match; do
    # Skip excluded directories and files
    if echo "$file_match" | grep -qE "$EXCLUDE_DIRS|$EXCLUDE_FILES"; then
        continue
    fi

    # Additional filter: skip minified/bundled files
    if [[ "$file_match" == *"/public/"* ]] || [[ "$file_match" == *"/dist/"* ]]; then
        continue
    fi

    rogue_patterns=$((rogue_patterns + 1))
    rogue_files+=("$file_match")
done < <(grep -rlE "$combined_pattern" . --include="*.py" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build 2>/dev/null | head -20 || true)

if [ $rogue_patterns -eq 0 ]; then
    check_result "No rogue ID generation patterns" 0
else
    check_result "No rogue ID generation patterns" 1 "Found $rogue_patterns rogue patterns"

    # Log first 5 violations for debugging
    if [ ${#rogue_files[@]} -gt 0 ]; then
        echo -e "    ${YELLOW}Sample violations:${NC}"
        for i in "${!rogue_files[@]}"; do
            if [ $i -lt 5 ]; then
                echo -e "      - ${rogue_files[$i]}"
            fi
        done
        [ ${#rogue_files[@]} -gt 5 ] && echo -e "      ... and $((${#rogue_files[@]} - 5)) more"
    fi
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
# Search in multiple standard locations
EVIDENCE_CLI_PATHS=(
    "/Users/nb/.chittyos/bin/evidence_cli.py"
    "/Users/nb/.claude/bin/evidence_cli.py"
    "/Users/nb/bin/evidence_cli.py"
    "evidence_cli.py"
)

EVIDENCE_CLI_FOUND=false
EVIDENCE_CLI_PATH=""
for path in "${EVIDENCE_CLI_PATHS[@]}"; do
    if [ -f "$path" ]; then
        EVIDENCE_CLI_FOUND=true
        EVIDENCE_CLI_PATH="$path"
        break
    fi
done

if [ "$EVIDENCE_CLI_FOUND" = true ]; then
    # Check if it contains multiple analyzer implementations
    if grep -q "EvidenceAnalyzerV2" "$EVIDENCE_CLI_PATH"; then
        check_result "Single CLI path (ChittyOS only)" 1 "Multiple analyzer paths detected in $EVIDENCE_CLI_PATH"
    else
        # Either stub or ChittyOS-only implementation (both valid)
        check_result "Single CLI path (ChittyOS only)" 0 "Found at $EVIDENCE_CLI_PATH"
    fi
else
    check_result "Single CLI path (ChittyOS only)" 1 "evidence_cli.py not found in any standard location"
fi

# Check 11: Sync Platform Health Checks
echo -e "${CYAN}[TEST 11] Sync Platform Health Checks${NC}"
SYNC_SERVICE="https://sync.chitty.cc"

# Check main sync service
if command -v curl >/dev/null 2>&1; then
    sync_health=$(curl -s -o /dev/null -w "%{http_code}" "${SYNC_SERVICE}/health" 2>/dev/null || echo "000")
    if [ "$sync_health" = "200" ]; then
        check_result "Sync service health" 0
    else
        check_result "Sync service health" 1 "HTTP $sync_health"
    fi

    # Check each platform endpoint
    for platform in neon notion github drive cloudflare local; do
        platform_health=$(curl -s -o /dev/null -w "%{http_code}" "${SYNC_SERVICE}/${platform}/health" 2>/dev/null || echo "000")
        if [ "$platform_health" = "200" ]; then
            check_result "  ├─ ${platform} platform health" 0
        else
            warning_result "  ├─ ${platform} platform health" "HTTP $platform_health"
        fi
    done
else
    warning_result "Sync platform health checks" "curl not available"
fi

# Check 12: ChittyOS Core Service Health
echo -e "${CYAN}[TEST 12] ChittyOS Core Service Health${NC}"

# Check ChittyID service (ChittyFoundation)
id_health=$(curl -s -o /dev/null -w "%{http_code}" "https://id.chitty.cc/health" 2>/dev/null || echo "000")
if [ "$id_health" = "200" ]; then
    check_result "ChittyID service (id.chitty.cc - Foundation)" 0
else
    check_result "ChittyID service (id.chitty.cc - Foundation)" 1 "HTTP $id_health"
fi

# Check Register service (ChittyFoundation - Canonical)
register_health=$(curl -s -o /dev/null -w "%{http_code}" "https://register.chitty.cc/health" 2>/dev/null || echo "000")
if [ "$register_health" = "200" ]; then
    check_result "Register service (register.chitty.cc - Foundation)" 0
else
    check_result "Register service (register.chitty.cc - Foundation)" 1 "HTTP $register_health"
fi

# Check Registry service (ChittyCorp - Discovery)
registry_health=$(curl -s -o /dev/null -w "%{http_code}" "https://registry.chitty.cc/health" 2>/dev/null || echo "000")
if [ "$registry_health" = "200" ]; then
    check_result "Registry service (registry.chitty.cc - Corp)" 0
else
    warning_result "Registry service (registry.chitty.cc - Corp)" "HTTP $registry_health"
fi

# Check Canon service (ChittyFoundation)
canon_health=$(curl -s -o /dev/null -w "%{http_code}" "https://canon.chitty.cc/health" 2>/dev/null || echo "000")
if [ "$canon_health" = "200" ]; then
    check_result "Canon service (canon.chitty.cc - Foundation)" 0
else
    warning_result "Canon service (canon.chitty.cc - Foundation)" "HTTP $canon_health"
fi

# Check Gateway service (ChittyCorp)
gateway_health=$(curl -s -o /dev/null -w "%{http_code}" "https://gateway.chitty.cc/health" 2>/dev/null || echo "000")
if [ "$gateway_health" = "200" ]; then
    check_result "Gateway service (gateway.chitty.cc - Corp)" 0
else
    warning_result "Gateway service (gateway.chitty.cc - Corp)" "HTTP $gateway_health"
fi

# Check 13: Internal Service Integration
echo -e "${CYAN}[TEST 13] Internal Service Integration${NC}"

# Test ChittyID can mint (functional test, not just health)
if [ -n "${CHITTY_ID_TOKEN:-}" ]; then
    id_mint_test=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"entity":"SESSION","name":"chittycheck-validation","metadata":{"purpose":"validation"}}' \
        "https://id.chitty.cc/v1/mint" 2>/dev/null || echo "000")
    id_mint_status=$(echo "$id_mint_test" | tail -n1)

    if [ "$id_mint_status" = "200" ]; then
        check_result "  ├─ ChittyID minting functional" 0
    else
        check_result "  ├─ ChittyID minting functional" 1 "HTTP $id_mint_status"
    fi
else
    warning_result "  ├─ ChittyID minting functional" "No CHITTY_ID_TOKEN"
fi

# Test Registry can list services (functional test)
registry_services=$(curl -s "https://registry.chitty.cc/api/v1/services" 2>/dev/null)
if echo "$registry_services" | grep -q "total"; then
    service_count=$(echo "$registry_services" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    check_result "  ├─ Registry service discovery" 0 "$service_count services registered"
else
    warning_result "  ├─ Registry service discovery" "Cannot list services"
fi

# Test Sync can reach platforms (functional test)
sync_platforms=$(curl -s "https://sync.chitty.cc/api/status" 2>/dev/null)
if echo "$sync_platforms" | grep -q "platforms"; then
    check_result "  ├─ Sync platform coordination" 0
else
    warning_result "  ├─ Sync platform coordination" "Cannot get platform status"
fi

# Check 14: Service Auto-Registration via Sync
echo -e "${CYAN}[TEST 14] Service Auto-Registration${NC}"

# Trigger sync to register all services
sync_register=$(curl -s -X POST "https://sync.chitty.cc/api/project" \
    -H "Content-Type: application/json" \
    -d '{"id":"chittyos-services","name":"ChittyOS Services"}' 2>/dev/null)

if echo "$sync_register" | grep -q "success"; then
    check_result "Sync triggers service registration" 0

    # Verify services are registered in both systems
    sleep 1

    # Check Register (ChittyFoundation - Canonical)
    register_services=$(curl -s "https://register.chitty.cc/api/services" 2>/dev/null)
    if echo "$register_services" | grep -q "identity\|sync"; then
        check_result "  ├─ Services registered with Register (Foundation)" 0
    else
        warning_result "  ├─ Services registered with Register (Foundation)" "Cannot verify"
    fi

    # Check Registry (ChittyCorp - Discovery)
    registry_services=$(curl -s "https://registry.chitty.cc/api/v1/services" 2>/dev/null)

    # Check for key Foundation services
    for service in "identity" "register" "canon"; do
        if echo "$registry_services" | grep -q "\"name\":\"$service\""; then
            check_result "  ├─ $service (Foundation) in Registry" 0
        else
            warning_result "  ├─ $service (Foundation) in Registry" "Not found"
        fi
    done

    # Check for key Corp services
    for service in "sync" "registry" "gateway" "auth"; do
        if echo "$registry_services" | grep -q "\"name\":\"$service\""; then
            check_result "  ├─ $service (Corp) in Registry" 0
        else
            warning_result "  ├─ $service (Corp) in Registry" "Not found"
        fi
    done
else
    warning_result "Sync triggers service registration" "Registration failed"
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
    echo ""
    echo -e "${CYAN}💡 Suggested Fix:${NC}"
    echo -e "   Run automated fix: ${YELLOW}chittycheck-auto.sh${NC}"
    echo -e "   Or invoke agent: ${YELLOW}@agent-chittycheck-enhancer${NC}"
    echo ""
    echo -e "${CYAN}   The agent will automatically:${NC}"
    echo -e "   1. Analyze compliance failures"
    echo -e "   2. Fix rogue ID patterns (§36 violations)"
    echo -e "   3. Fix security issues"
    echo -e "   4. Verify improvements"
    exit 1
fi