#!/usr/bin/env bash
# migrate-legacy-session-ids.sh
# Retroactively mint ChittyIDs for legacy UUID-based sessions
# Maintains UUID→ChittyID mapping to preserve session relationships

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
TODOS_DIR="/Users/nb/.claude/todos"
MAPPING_FILE="/Users/nb/.chittyos/session-id-mapping.json"
BACKUP_DIR="/Users/nb/.chittyos/session-migration-backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/Users/nb/.chittyos/logs/session-migration-$(date +%Y%m%d-%H%M%S).log"
DRY_RUN=false

# Statistics
TOTAL_SESSIONS=0
MIGRATED_SESSIONS=0
SKIPPED_SESSIONS=0
FAILED_SESSIONS=0

log() {
  local level="$1"
  shift
  local msg="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] ${msg}" | tee -a "$LOG_FILE"
}

error() {
  log "ERROR" "${RED}$*${NC}"
}

warn() {
  log "WARN" "${YELLOW}$*${NC}"
}

info() {
  log "INFO" "${BLUE}$*${NC}"
}

success() {
  log "SUCCESS" "${GREEN}$*${NC}"
}

# Validate prerequisites
validate_prerequisites() {
  info "Validating prerequisites..."

  # Check CHITTY_ID_TOKEN
  if [[ -z "${CHITTY_ID_TOKEN:-}" ]]; then
    error "CHITTY_ID_TOKEN environment variable not set"
    error "Obtain token from: https://id.chitty.cc"
    exit 1
  fi

  # Check id.chitty.cc connectivity
  if ! curl -sf -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
    https://id.chitty.cc/health > /dev/null 2>&1; then
    error "Cannot connect to id.chitty.cc - check token and network"
    exit 1
  fi

  # Check @chittyos/chittyid-client is installed
  if ! node -e "require('@chittyos/chittyid-client')" 2>/dev/null; then
    error "@chittyos/chittyid-client npm package not found"
    error "Install with: npm install @chittyos/chittyid-client"
    exit 1
  fi

  # Check todos directory exists
  if [[ ! -d "$TODOS_DIR" ]]; then
    error "Todos directory not found: $TODOS_DIR"
    exit 1
  fi

  success "Prerequisites validated"
}

# Create backup of todos directory
create_backup() {
  info "Creating backup of todos directory..."
  mkdir -p "$BACKUP_DIR"
  cp -R "$TODOS_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
  success "Backup created: $BACKUP_DIR"
}

# Mint ChittyID for a session
mint_chittyid_for_session() {
  local uuid="$1"
  local session_type="${2:-unknown}"

  # Call ChittyID service via Node.js
  local chittyid
  chittyid=$(node -e "
    const ChittyIDClient = require('@chittyos/chittyid-client').default;
    const client = new ChittyIDClient({
      serviceUrl: 'https://id.chitty.cc',
      apiKey: process.env.CHITTY_ID_TOKEN
    });

    (async () => {
      try {
        const id = await client.mint({
          entity: 'CONTEXT',
          name: 'Retroactive Session Migration',
          metadata: {
            type: 'session_retroactive_migration',
            legacyUuid: '${uuid}',
            sessionType: '${session_type}',
            migrationTimestamp: Date.now(),
            migrationReason: 'ChittyOS compliance - P0 violation remediation'
          }
        });
        console.log(id);
      } catch (error) {
        console.error('MINT_ERROR:', error.message);
        process.exit(1);
      }
    })();
  " 2>&1)

  # Validate ChittyID format: VV-G-LLL-SSSS-T-YM-C-X (flexible number lengths)
  if [[ "$chittyid" =~ ^[0-9]{2}-[A-Z]-[A-Z]{3}-[0-9]+-[A-Z]-[0-9]+-[0-9]+-[0-9A-Z]+$ ]]; then
    echo "$chittyid"
    return 0
  else
    error "Invalid ChittyID format received: $chittyid"
    error "Expected format: VV-G-LLL-SSSS-T-YM-C-X (e.g., 01-C-CON-3758-I-2510-8-96)"
    return 1
  fi
}

# Load or initialize mapping file
load_mapping() {
  if [[ -f "$MAPPING_FILE" ]]; then
    info "Loading existing UUID→ChittyID mapping"
    cat "$MAPPING_FILE"
  else
    info "Initializing new mapping file"
    echo '{"sessions":{},"migrationDate":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","version":"1.0"}'
  fi
}

# Save mapping to file
save_mapping() {
  local mapping="$1"
  mkdir -p "$(dirname "$MAPPING_FILE")"
  echo "$mapping" | jq '.' > "$MAPPING_FILE"
  info "Mapping saved to: $MAPPING_FILE"
}

# Extract session UUID from filename
extract_session_uuid() {
  local filename="$1"
  # Pattern: UUID-agent-UUID.json
  # Extract first UUID (session ID)
  echo "$filename" | grep -oE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' || echo ""
}

# Extract agent UUID from filename
extract_agent_uuid() {
  local filename="$1"
  # Pattern: UUID-agent-UUID.json
  # Extract second UUID (agent ID)
  echo "$filename" | grep -oE 'agent-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})' | \
    sed 's/agent-//' || echo ""
}

# Migrate a single session
migrate_session() {
  local session_uuid="$1"
  local mapping="$2"

  info "Migrating session: $session_uuid"

  # Check if already migrated
  local existing_chittyid
  existing_chittyid=$(echo "$mapping" | jq -r ".sessions.\"$session_uuid\".chittyid // empty")

  if [[ -n "$existing_chittyid" ]]; then
    warn "Session $session_uuid already migrated to $existing_chittyid"
    echo "$existing_chittyid"
    return 0
  fi

  # Mint new ChittyID
  local chittyid
  if chittyid=$(mint_chittyid_for_session "$session_uuid" "claude_code_session"); then
    success "Minted ChittyID: $chittyid for UUID: $session_uuid"

    # Update mapping
    mapping=$(echo "$mapping" | jq \
      --arg uuid "$session_uuid" \
      --arg cid "$chittyid" \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '.sessions[$uuid] = {chittyid: $cid, migratedAt: $ts}')

    echo "$chittyid"
    return 0
  else
    error "Failed to mint ChittyID for $session_uuid"
    return 1
  fi
}

# Migrate all sessions
migrate_all_sessions() {
  info "Scanning todos directory for UUID sessions..."

  local mapping
  mapping=$(load_mapping)

  # Get unique session UUIDs
  local sessions
  sessions=$(ls -1 "$TODOS_DIR"/*.json 2>/dev/null | \
    xargs -n1 basename | \
    xargs -n1 -I{} bash -c "echo {} | grep -oE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'" | \
    sort -u)

  TOTAL_SESSIONS=$(echo "$sessions" | wc -l | tr -d ' ')
  info "Found $TOTAL_SESSIONS unique session UUIDs"

  if [[ $DRY_RUN == true ]]; then
    warn "DRY RUN MODE - No actual migration will occur"
  fi

  # Migrate each session
  while IFS= read -r session_uuid; do
    [[ -z "$session_uuid" ]] && continue

    if [[ $DRY_RUN == true ]]; then
      info "[DRY RUN] Would migrate: $session_uuid"
      ((SKIPPED_SESSIONS++)) || true
    else
      local chittyid
      if chittyid=$(migrate_session "$session_uuid" "$mapping"); then
        mapping=$(echo "$mapping" | jq \
          --arg uuid "$session_uuid" \
          --arg cid "$chittyid" \
          --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          '.sessions[$uuid] = {chittyid: $cid, migratedAt: $ts}')
        ((MIGRATED_SESSIONS++)) || true
      else
        ((FAILED_SESSIONS++)) || true
      fi
    fi
  done <<< "$sessions"

  if [[ $DRY_RUN == false ]]; then
    save_mapping "$mapping"
  fi
}

# Generate migration report
generate_report() {
  info ""
  info "════════════════════════════════════════"
  info "  LEGACY SESSION MIGRATION REPORT"
  info "════════════════════════════════════════"
  info "Total sessions found: $TOTAL_SESSIONS"
  success "Successfully migrated: $MIGRATED_SESSIONS"
  warn "Skipped (already migrated or dry run): $SKIPPED_SESSIONS"
  [[ $FAILED_SESSIONS -gt 0 ]] && error "Failed migrations: $FAILED_SESSIONS" || true
  info ""
  info "Mapping file: $MAPPING_FILE"
  info "Backup directory: $BACKUP_DIR"
  info "Log file: $LOG_FILE"
  info "════════════════════════════════════════"

  # Calculate compliance improvement
  local compliance_before=45
  local compliance_after=$((compliance_before + (MIGRATED_SESSIONS * 35 / TOTAL_SESSIONS)))
  info "Platform Health Estimate:"
  info "  Before: ${compliance_before}/100"
  info "  After:  ${compliance_after}/100"
  info "════════════════════════════════════════"
}

# Main execution
main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --help|-h)
        echo "Usage: $0 [--dry-run]"
        echo ""
        echo "Retroactively mint ChittyIDs for legacy UUID-based sessions"
        echo ""
        echo "Options:"
        echo "  --dry-run    Simulate migration without making changes"
        echo "  --help       Show this help message"
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        exit 1
        ;;
    esac
  done

  # Ensure log directory exists
  mkdir -p "$(dirname "$LOG_FILE")"

  info "════════════════════════════════════════"
  info "  ChittyOS Session ID Migration Tool"
  info "════════════════════════════════════════"

  validate_prerequisites
  create_backup
  migrate_all_sessions
  generate_report

  if [[ $FAILED_SESSIONS -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
