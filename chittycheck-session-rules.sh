#!/usr/bin/env bash
# chittycheck-session-rules.sh
# Enhanced ChittyCheck validation rules for session ChittyID enforcement
# Integrates with chittycheck-enhanced.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
TODOS_DIR="/Users/nb/.claude/todos"
MAPPING_FILE="/Users/nb/.chittyos/session-id-mapping.json"
SESSION_DIRS=(
  "/Users/nb/.claude/sessions"
  "/Users/nb/.claude/projects/.ai-coordination/sessions"
)

# Statistics
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

check_passed() {
  local name="$1"
  ((TOTAL_CHECKS++))
  ((PASSED_CHECKS++))
  echo -e "${GREEN}✅ PASS${NC} - $name"
}

check_failed() {
  local name="$1"
  local details="$2"
  ((TOTAL_CHECKS++))
  ((FAILED_CHECKS++))
  echo -e "${RED}❌ FAIL${NC} - $name"
  echo -e "  ${RED}Details:${NC} $details"
}

check_warning() {
  local name="$1"
  local details="$2"
  ((WARNINGS++))
  echo -e "${YELLOW}⚠️  WARN${NC} - $name"
  echo -e "  ${YELLOW}Details:${NC} $details"
}

# Rule 1: session_chittyid_authority
# Validates all session IDs are ChittyIDs (CTXT_* prefix)
rule_session_chittyid_authority() {
  echo -e "\n${CYAN}[RULE 1]${NC} Session ChittyID Authority"

  if [[ ! -d "$TODOS_DIR" ]]; then
    check_warning "Todos directory check" "Directory not found: $TODOS_DIR"
    return
  fi

  # Check for UUID-pattern session files
  local uuid_sessions
  uuid_sessions=$(ls -1 "$TODOS_DIR"/*.json 2>/dev/null | \
    xargs -n1 basename | \
    grep -E '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | \
    wc -l | tr -d ' ')

  # Check for ChittyID-pattern session files
  local chittyid_sessions
  chittyid_sessions=$(ls -1 "$TODOS_DIR"/*.json 2>/dev/null | \
    xargs -n1 basename | \
    grep -E '^CTXT_' | \
    wc -l | tr -d ' ')

  local total_sessions=$((uuid_sessions + chittyid_sessions))

  if [[ $uuid_sessions -gt 0 ]]; then
    check_failed "Session ID Authority" \
      "Found $uuid_sessions UUID-based sessions (should be ChittyIDs). Run: scripts/migrate-legacy-session-ids.sh"
  elif [[ $chittyid_sessions -gt 0 ]]; then
    check_passed "Session ID Authority ($chittyid_sessions ChittyID sessions)"
  else
    check_warning "Session ID Authority" "No session files found"
  fi
}

# Rule 2: no_local_session_generation
# Blocks UUID/nanoid/crypto patterns in session code
rule_no_local_session_generation() {
  echo -e "\n${CYAN}[RULE 2]${NC} No Local Session ID Generation"

  local violations=()

  # Pattern 1: crypto.randomBytes() for session IDs
  local crypto_violations
  crypto_violations=$(grep -rn "crypto\.randomBytes.*generateSessionId\|generateSessionId.*crypto\.randomBytes" \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/ \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/cross-session-sync/ \
    2>/dev/null | grep -v node_modules | grep -v '.git' || true)

  if [[ -n "$crypto_violations" ]]; then
    violations+=("crypto.randomBytes() usage detected:")
    while IFS= read -r line; do
      violations+=("  $line")
    done <<< "$crypto_violations"
  fi

  # Pattern 2: uuid or nanoid imports in session files
  local uuid_imports
  uuid_imports=$(grep -rn "import.*uuid\|require.*uuid\|import.*nanoid\|require.*nanoid" \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/*session*.js \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/cross-session-sync/src/session*.js \
    2>/dev/null | grep -v node_modules || true)

  if [[ -n "$uuid_imports" ]]; then
    violations+=("UUID/nanoid imports in session files:")
    while IFS= read -r line; do
      violations+=("  $line")
    done <<< "$uuid_imports"
  fi

  # Pattern 3: Direct session ID string generation
  local string_gen_violations
  string_gen_violations=$(grep -rn "session-.*Date\.now\|session_.*Date\.now\|session.*randomBytes" \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/ \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/cross-session-sync/ \
    2>/dev/null | grep "generateSessionId" | grep -v node_modules | grep -v '.git' || true)

  if [[ -n "$string_gen_violations" ]]; then
    violations+=("Direct session ID string generation:")
    while IFS= read -r line; do
      violations+=("  $line")
    done <<< "$string_gen_violations"
  fi

  if [[ ${#violations[@]} -gt 0 ]]; then
    check_failed "Local Session ID Generation Blocked" "${violations[*]}"
  else
    check_passed "No local session ID generation patterns detected"
  fi
}

# Rule 3: chittyid_client_usage
# Enforces @chittyos/chittyid-client npm package usage
rule_chittyid_client_usage() {
  echo -e "\n${CYAN}[RULE 3]${NC} ChittyID Client Usage"

  # Check if package is installed
  local package_json="/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/package.json"

  if [[ ! -f "$package_json" ]]; then
    check_failed "package.json check" "File not found: $package_json"
    return
  fi

  local has_chittyid_client
  has_chittyid_client=$(jq -r '.dependencies."@chittyos/chittyid-client" // empty' "$package_json")

  if [[ -z "$has_chittyid_client" ]]; then
    check_failed "ChittyID Client Package" \
      "@chittyos/chittyid-client not in dependencies. Run: npm install @chittyos/chittyid-client"
    return
  fi

  check_passed "ChittyID Client Package installed (version: $has_chittyid_client)"

  # Check for correct usage in session files
  local session_files=(
    "/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/cross-session-sync/src/session-manager.js"
    "/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/session-persistence/session-state.js"
  )

  for file in "${session_files[@]}"; do
    if [[ ! -f "$file" ]]; then
      check_warning "Session file check" "File not found: $file"
      continue
    fi

    local has_import
    has_import=$(grep -n "@chittyos/chittyid-client\|chittyid-client" "$file" || true)

    if [[ -z "$has_import" ]]; then
      check_failed "ChittyID Client Import" \
        "File $file does not import @chittyos/chittyid-client"
    else
      check_passed "ChittyID Client import in $(basename $file)"
    fi
  done
}

# Rule 4: session_chittyid_token_validation
# Validates CHITTY_ID_TOKEN environment variable
rule_session_chittyid_token_validation() {
  echo -e "\n${CYAN}[RULE 4]${NC} Session ChittyID Token Validation"

  if [[ -z "${CHITTY_ID_TOKEN:-}" ]]; then
    check_failed "CHITTY_ID_TOKEN Environment Variable" \
      "Not set. Obtain from: https://id.chitty.cc"
    return
  fi

  # Validate token format (mcp_auth_...)
  if [[ ! "$CHITTY_ID_TOKEN" =~ ^mcp_auth_ ]]; then
    check_failed "CHITTY_ID_TOKEN Format" \
      "Invalid format (expected: mcp_auth_...)"
    return
  fi

  check_passed "CHITTY_ID_TOKEN is configured"

  # Test connectivity to id.chitty.cc
  if curl -sf -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
    https://id.chitty.cc/health > /dev/null 2>&1; then
    check_passed "id.chitty.cc connectivity verified"
  else
    check_failed "id.chitty.cc Connectivity" \
      "Cannot reach service or token invalid"
  fi
}

# Rule 5: session_id_format_validation
# Validates session ID format in code
rule_session_id_format_validation() {
  echo -e "\n${CYAN}[RULE 5]${NC} Session ID Format Validation"

  # Check for CTXT_ prefix validation in code
  local has_format_check
  has_format_check=$(grep -rn "CTXT_\|startsWith.*CTXT\|match.*CTXT" \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/ \
    /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/cross-session-sync/ \
    2>/dev/null | grep -i "session" | grep -v node_modules | wc -l | tr -d ' ')

  if [[ $has_format_check -gt 0 ]]; then
    check_passed "Session ID format validation present ($has_format_check locations)"
  else
    check_warning "Session ID Format Validation" \
      "No CTXT_ prefix validation found in session code"
  fi
}

# Rule 6: session_migration_status
# Reports on migration progress
rule_session_migration_status() {
  echo -e "\n${CYAN}[RULE 6]${NC} Session Migration Status"

  if [[ ! -f "$MAPPING_FILE" ]]; then
    check_warning "Migration Mapping" \
      "No migration mapping file found. Run: scripts/migrate-legacy-session-ids.sh"
    return
  fi

  local total_migrated
  total_migrated=$(jq -r '.sessions | length' "$MAPPING_FILE")

  local uuid_sessions
  uuid_sessions=$(ls -1 "$TODOS_DIR"/*.json 2>/dev/null | \
    xargs -n1 basename | \
    grep -E '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | \
    wc -l | tr -d ' ')

  if [[ $uuid_sessions -eq 0 ]]; then
    check_passed "All sessions migrated to ChittyIDs ($total_migrated total)"
  else
    check_failed "Incomplete Migration" \
      "$uuid_sessions UUID sessions remaining, $total_migrated already migrated"
  fi
}

# Generate compliance score
generate_compliance_score() {
  echo -e "\n${CYAN}════════════════════════════════════════${NC}"
  echo -e "${CYAN}  SESSION CHITTYID COMPLIANCE REPORT${NC}"
  echo -e "${CYAN}════════════════════════════════════════${NC}"
  echo -e "Total checks: $TOTAL_CHECKS"
  echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
  echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
  echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
  echo ""

  local compliance_score
  if [[ $TOTAL_CHECKS -gt 0 ]]; then
    compliance_score=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
  else
    compliance_score=0
  fi

  if [[ $compliance_score -ge 80 ]]; then
    echo -e "Compliance Score: ${GREEN}${compliance_score}/100${NC} ✅"
  elif [[ $compliance_score -ge 50 ]]; then
    echo -e "Compliance Score: ${YELLOW}${compliance_score}/100${NC} ⚠️"
  else
    echo -e "Compliance Score: ${RED}${compliance_score}/100${NC} ❌"
  fi

  echo -e "${CYAN}════════════════════════════════════════${NC}\n"

  # Return exit code based on failures
  if [[ $FAILED_CHECKS -gt 0 ]]; then
    return 1
  fi
  return 0
}

# Main execution
main() {
  echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║  ChittyCheck Session ChittyID Rules      ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}\n"

  rule_session_chittyid_authority
  rule_no_local_session_generation
  rule_chittyid_client_usage
  rule_session_chittyid_token_validation
  rule_session_id_format_validation
  rule_session_migration_status

  generate_compliance_score
}

main "$@"
