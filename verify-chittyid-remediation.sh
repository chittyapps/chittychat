#!/usr/bin/env bash
# verify-chittyid-remediation.sh
# Comprehensive verification that all ChittyID remediation steps completed successfully

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED=0
FAILED=0
WARNINGS=0

check() {
  local name="$1"
  local cmd="$2"
  local expect_success="${3:-true}"

  ((TOTAL_CHECKS++))
  echo -n "Checking: $name ... "

  if eval "$cmd" > /dev/null 2>&1; then
    if [[ "$expect_success" == "true" ]]; then
      echo -e "${GREEN}✅ PASS${NC}"
      ((PASSED++))
    else
      echo -e "${RED}❌ FAIL${NC} (expected failure but succeeded)"
      ((FAILED++))
    fi
  else
    if [[ "$expect_success" == "false" ]]; then
      echo -e "${GREEN}✅ PASS${NC} (correctly failed)"
      ((PASSED++))
    else
      echo -e "${RED}❌ FAIL${NC}"
      ((FAILED++))
    fi
  fi
}

warn() {
  local msg="$1"
  echo -e "${YELLOW}⚠️  WARNING:${NC} $msg"
  ((WARNINGS++))
}

info() {
  echo -e "${CYAN}ℹ️  INFO:${NC} $*"
}

header() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN} $1${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""
}

# Main verification
main() {
  clear
  echo -e "${BOLD}${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║                                                           ║"
  echo "║   ChittyOS Session ChittyID Remediation Verification     ║"
  echo "║                                                           ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo ""

  # Section 1: Deliverables Present
  header "1. Deliverables Present"

  check "Fixups patch exists" "test -f session-chittyid-fixups.patch"
  check "Migration script exists" "test -f scripts/migrate-legacy-session-ids.sh"
  check "Migration script executable" "test -x scripts/migrate-legacy-session-ids.sh"
  check "Session rules script exists" "test -f chittycheck-session-rules.sh"
  check "Session rules executable" "test -x chittycheck-session-rules.sh"
  check "Pre-commit hook exists" "test -f .husky/pre-commit"
  check "Pre-commit hook executable" "test -x .husky/pre-commit"
  check "GitHub Actions workflow exists" "test -f .github/workflows/chittyos-compliance.yml"
  check "Migration guide exists" "test -f CHITTYID-MIGRATION-GUIDE.md"
  check "Compliance report exists" "test -f SESSION-CHITTYID-COMPLIANCE-REPORT.md"
  check "Deliverables summary exists" "test -f DELIVERABLES-SUMMARY.md"

  # Section 2: Prerequisites
  header "2. Prerequisites"

  check "CHITTY_ID_TOKEN set" "test -n \"${CHITTY_ID_TOKEN:-}\""
  check "jq installed" "command -v jq"
  check "curl installed" "command -v curl"
  check "node installed" "command -v node"
  check "npm installed" "command -v npm"
  check "git installed" "command -v git"

  if [[ -n "${CHITTY_ID_TOKEN:-}" ]]; then
    check "id.chitty.cc reachable" "curl -sf -H 'Authorization: Bearer $CHITTY_ID_TOKEN' https://id.chitty.cc/health"
  else
    warn "CHITTY_ID_TOKEN not set, cannot test id.chitty.cc connectivity"
  fi

  # Section 3: Code Changes
  header "3. Code Changes Status"

  if git diff --cached --quiet session-chittyid-fixups.patch 2>/dev/null; then
    info "Patch not yet applied (git staged area empty)"
  else
    info "Changes staged in git"
  fi

  if grep -q "@chittyos/chittyid-client" cross-session-sync/src/session-manager.js 2>/dev/null; then
    check "session-manager.js uses ChittyID client" "true"
  else
    warn "session-manager.js does not import @chittyos/chittyid-client yet (patch not applied?)"
    check "session-manager.js uses ChittyID client" "false" "false"
  fi

  if grep -q "@chittyos/chittyid-client" src/session-persistence/session-state.js 2>/dev/null; then
    check "session-state.js uses ChittyID client" "true"
  else
    warn "session-state.js does not import @chittyos/chittyid-client yet (patch not applied?)"
    check "session-state.js uses ChittyID client" "false" "false"
  fi

  # Section 4: Session Files
  header "4. Session Files Status"

  if [[ -d /Users/nb/.claude/todos ]]; then
    local uuid_sessions
    uuid_sessions=$(ls -1 /Users/nb/.claude/todos/*.json 2>/dev/null | \
      xargs -n1 basename | \
      grep -cE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' || echo 0)

    local chittyid_sessions
    chittyid_sessions=$(ls -1 /Users/nb/.claude/todos/*.json 2>/dev/null | \
      xargs -n1 basename | \
      grep -cE '^CTXT_' || echo 0)

    info "UUID-based sessions: $uuid_sessions"
    info "ChittyID-based sessions: $chittyid_sessions"

    if [[ $uuid_sessions -eq 0 && $chittyid_sessions -gt 0 ]]; then
      check "All sessions migrated to ChittyID" "true"
    elif [[ $uuid_sessions -gt 0 ]]; then
      warn "$uuid_sessions UUID sessions still exist (migration not run?)"
      check "All sessions migrated to ChittyID" "false" "false"
    else
      warn "No session files found in /Users/nb/.claude/todos/"
    fi
  else
    warn "Todos directory not found: /Users/nb/.claude/todos/"
  fi

  # Section 5: Mapping File
  header "5. Migration Mapping"

  if [[ -f /Users/nb/.chittyos/session-id-mapping.json ]]; then
    check "Mapping file exists" "true"

    local mapped_count
    mapped_count=$(jq -r '.sessions | length' /Users/nb/.chittyos/session-id-mapping.json 2>/dev/null || echo 0)
    info "Mapped sessions: $mapped_count"

    if [[ $mapped_count -gt 0 ]]; then
      check "Sessions mapped" "true"
    else
      warn "Mapping file exists but contains no sessions"
    fi
  else
    warn "Mapping file not found (migration not run yet)"
    check "Mapping file exists" "false" "false"
  fi

  # Section 6: NPM Package
  header "6. NPM Dependencies"

  if [[ -f package.json ]]; then
    check "package.json exists" "true"

    if jq -e '.dependencies."@chittyos/chittyid-client"' package.json > /dev/null 2>&1; then
      check "@chittyos/chittyid-client in dependencies" "true"

      local version
      version=$(jq -r '.dependencies."@chittyos/chittyid-client"' package.json)
      info "ChittyID Client version: $version"
    else
      warn "@chittyos/chittyid-client not in package.json dependencies"
      check "@chittyos/chittyid-client in dependencies" "false" "false"
    fi

    if npm list @chittyos/chittyid-client > /dev/null 2>&1; then
      check "@chittyos/chittyid-client installed" "true"
    else
      warn "@chittyos/chittyid-client not installed (run: npm install)"
      check "@chittyos/chittyid-client installed" "false" "false"
    fi
  else
    warn "package.json not found in current directory"
  fi

  # Section 7: Git Hooks
  header "7. Git Hooks Configuration"

  if [[ -f .husky/pre-commit ]]; then
    check "Pre-commit hook exists" "true"

    if [[ -x .husky/pre-commit ]]; then
      check "Pre-commit hook executable" "true"
    else
      warn "Pre-commit hook not executable (run: chmod +x .husky/pre-commit)"
      check "Pre-commit hook executable" "false" "false"
    fi
  fi

  if [[ -d node_modules/husky ]]; then
    check "Husky installed" "true"
  else
    warn "Husky not installed (run: npm install --save-dev husky)"
    check "Husky installed" "false" "false"
  fi

  # Section 8: ChittyCheck Validation
  header "8. ChittyCheck Validation"

  if [[ -x chittycheck-session-rules.sh ]]; then
    info "Running chittycheck-session-rules.sh..."
    if ./chittycheck-session-rules.sh > /tmp/chittycheck-output.log 2>&1; then
      check "ChittyCheck session rules pass" "true"
      local score
      score=$(grep -oE "Compliance Score: [0-9]+/100" /tmp/chittycheck-output.log | grep -oE "[0-9]+" | head -1 || echo 0)
      info "Compliance Score: $score/100"
    else
      warn "ChittyCheck session rules failed (see /tmp/chittycheck-output.log)"
      check "ChittyCheck session rules pass" "false" "false"
    fi
  else
    warn "chittycheck-session-rules.sh not executable"
  fi

  # Section 9: Backup Status
  header "9. Backup Status"

  if ls /Users/nb/.chittyos/session-migration-backup-* > /dev/null 2>&1; then
    local backup_count
    backup_count=$(ls -1d /Users/nb/.chittyos/session-migration-backup-* | wc -l | tr -d ' ')
    info "Backup directories found: $backup_count"
    check "Backup created" "true"
  else
    warn "No backup directories found (migration not run yet)"
    check "Backup created" "false" "false"
  fi

  # Final Report
  header "Final Report"

  local success_rate=$((PASSED * 100 / TOTAL_CHECKS))

  echo ""
  echo -e "${BOLD}Total Checks:${NC} $TOTAL_CHECKS"
  echo -e "${GREEN}${BOLD}Passed:${NC} $PASSED"
  echo -e "${RED}${BOLD}Failed:${NC} $FAILED"
  echo -e "${YELLOW}${BOLD}Warnings:${NC} $WARNINGS"
  echo ""
  echo -e "${BOLD}Success Rate:${NC} ${success_rate}%"
  echo ""

  if [[ $FAILED -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✅ ALL CHECKS PASSED - Remediation Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Commit changes: git add . && git commit"
    echo "  3. Push to remote: git push"
    return 0
  elif [[ $FAILED -eq 0 ]]; then
    echo -e "${YELLOW}${BOLD}⚠️  CHECKS PASSED WITH WARNINGS${NC}"
    echo ""
    echo "Review warnings above and address if needed."
    echo "Some steps may not be complete yet."
    return 0
  else
    echo -e "${RED}${BOLD}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Required actions:"
    echo "  1. Review DELIVERABLES-SUMMARY.md"
    echo "  2. Follow Quick Start instructions"
    echo "  3. Run this script again to verify"
    return 1
  fi
}

# Run main function
main "$@"
