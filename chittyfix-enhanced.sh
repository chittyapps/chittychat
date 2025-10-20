#!/usr/bin/env bash
#
# ChittyFix Enhanced - Automatic ChittyID Compliance Fixer
# Version: 2.0.0
# Fixes rogue ID generation patterns with context-aware replacements
#
# Usage:
#   ./chittyfix-enhanced.sh              # Dry run (shows what would be fixed)
#   ./chittyfix-enhanced.sh --apply      # Apply fixes with backups
#   ./chittyfix-enhanced.sh --verify     # Verify fixes with ChittyCheck
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
MODE="${1:---dry-run}"
BACKUP_DIR="$PROJECT_ROOT/.chittyfix-backups/$(date +%Y%m%d-%H%M%S)"
FIXES_APPLIED=0
FILES_MODIFIED=0
SAFE_MODE=true

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️${NC}  $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }

# Banner
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ChittyFix Enhanced v2.0.0                               ║${NC}"
echo -e "${CYAN}║  Automated ChittyID Compliance Fixer                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check environment
check_environment() {
    log_info "Checking environment..."

    if [ -z "${CHITTY_ID_TOKEN:-}" ]; then
        log_warning "CHITTY_ID_TOKEN not set - fixes will need manual token configuration"
    else
        log_success "CHITTY_ID_TOKEN configured"
    fi

    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "Not in ChittyOS project root (package.json not found)"
        exit 1
    fi

    log_success "Environment check passed"
}

# Create backup
create_backup() {
    local file="$1"
    local backup_file="$BACKUP_DIR/$(basename "$file").bak"

    mkdir -p "$BACKUP_DIR"
    cp "$file" "$backup_file"
    log_info "Backed up: $(basename "$file")"
}

# Detect file context (demo, test, production)
detect_context() {
    local file="$1"

    if [[ "$file" =~ demo|example|sample ]]; then
        echo "demo"
    elif [[ "$file" =~ test|spec|mock ]]; then
        echo "test"
    elif [[ "$file" =~ chittybeacon|service|storage|routes ]]; then
        echo "production"
    else
        echo "unknown"
    fi
}

# Fix #1: Math.random() in demo_property_nft.js (SAFE - demo file)
fix_demo_property_nft() {
    local file="$PROJECT_ROOT/chittychain/demo_property_nft.js"

    if [ ! -f "$file" ]; then
        return
    fi

    log_info "Fixing: chittychain/demo_property_nft.js (demo file)"

    if [ "$MODE" = "--apply" ]; then
        create_backup "$file"

        # Replace Math.random() with comment explaining demo mode
        sed -i.tmp '70s/.*/    const tokenId = Math.floor(Math.random() * 10000) + 1; \/\/ DEMO: Real implementation should use ChittyID service/' "$file"
        rm -f "$file.tmp"

        # Add comment at top of file
        sed -i.tmp '1a\
\/\/ NOTE: This is a DEMO file. Production implementation should use id.chitty.cc for token ID generation.\
\/\/ See: https:\/\/id.chitty.cc\/docs for ChittyID integration.
' "$file"
        rm -f "$file.tmp"

        log_success "Fixed: demo_property_nft.js (added compliance notes)"
        FILES_MODIFIED=$((FILES_MODIFIED + 1))
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    else
        log_warning "[DRY RUN] Would add compliance documentation to demo_property_nft.js"
    fi
}

# Fix #2: Math.random() in ChittyBeaconService.ts (PRODUCTION - needs careful handling)
fix_chitty_beacon_service() {
    local file="$PROJECT_ROOT/chittychain/server/services/ChittyBeaconService.ts"

    if [ ! -f "$file" ]; then
        return
    fi

    log_warning "MANUAL FIX REQUIRED: ChittyBeaconService.ts (production service)"
    log_info "  Location: Line 219"
    log_info "  Pattern: Math.random().toString(36).substr(2, 9)"
    log_info "  Recommended fix:"
    cat <<EOF

    // Replace line 219 with:
    recordId: await this.generateBeaconId(),

    // Add this method to the class:
    private async generateBeaconId(): Promise<string> {
      try {
        const response = await fetch('https://id.chitty.cc/v1/mint', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${process.env.CHITTY_ID_TOKEN}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            domain: 'beacon',
            subtype: 'record',
            metadata: { event: this.appInfo?.event || 'unknown' }
          })
        });

        if (!response.ok) throw new Error('ChittyID service unavailable');

        const { chitty_id } = await response.json();
        return chitty_id;
      } catch (error) {
        // Fallback for service outages
        const fallbackId = \`beacon_\${Date.now()}_\${process.pid}\`;
        console.warn('ChittyID service unavailable, using fallback:', fallbackId);
        return fallbackId;
      }
    }

EOF
}

# Fix #3: Search and document all other violations
fix_remaining_violations() {
    log_info "Scanning for remaining rogue ID patterns..."

    # Find all files with violations (excluding demo and already fixed)
    local violations=(
        "chittychain/server/routes/ai-analysis.ts"
        "chittychronicle/chittyverify/server/routes.ts"
    )

    for file_path in "${violations[@]}"; do
        local full_path="$PROJECT_ROOT/$file_path"

        if [ ! -f "$full_path" ]; then
            continue
        fi

        local context=$(detect_context "$full_path")

        case "$context" in
            demo|test)
                log_info "Adding compliance note to: $file_path ($context)"
                if [ "$MODE" = "--apply" ]; then
                    create_backup "$full_path"
                    # Add comment at top
                    sed -i.tmp '1a\
\/\/ ChittyOS Compliance: This file uses mock data. Production must use id.chitty.cc\
' "$full_path"
                    rm -f "$full_path.tmp"
                    FILES_MODIFIED=$((FILES_MODIFIED + 1))
                    FIXES_APPLIED=$((FIXES_APPLIED + 1))
                fi
                ;;
            production)
                log_warning "MANUAL REVIEW: $file_path (production code)"
                ;;
            *)
                log_info "Requires analysis: $file_path"
                ;;
        esac
    done
}

# Add ChittyID helper utility
create_chittyid_helper() {
    local helper_file="$PROJECT_ROOT/lib/chittyid-helper.ts"

    log_info "Creating ChittyID helper utility..."

    if [ "$MODE" = "--apply" ]; then
        mkdir -p "$PROJECT_ROOT/lib"

        cat > "$helper_file" << 'EOF'
/**
 * ChittyID Helper - Simplified ChittyID service integration
 * Compliant with §36 (ChittyID Authority)
 *
 * @see https://id.chitty.cc/docs
 */

export interface ChittyIDMintRequest {
  domain: string;
  subtype: string;
  metadata?: Record<string, any>;
}

export interface ChittyIDMintResponse {
  chitty_id: string;
  domain: string;
  subtype: string;
  created_at: string;
}

/**
 * Mint a new ChittyID from id.chitty.cc service
 *
 * @param request - ChittyID mint request
 * @param fallback - Optional fallback ID generator (for service outages)
 * @returns ChittyID string
 */
export async function mintChittyID(
  request: ChittyIDMintRequest,
  fallback?: () => string
): Promise<string> {
  try {
    const response = await fetch('https://id.chitty.cc/v1/mint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHITTY_ID_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`ChittyID service error: ${response.status}`);
    }

    const data: ChittyIDMintResponse = await response.json();
    return data.chitty_id;
  } catch (error) {
    console.error('ChittyID minting failed:', error);

    if (fallback) {
      const fallbackId = fallback();
      console.warn('Using fallback ID:', fallbackId);
      return fallbackId;
    }

    throw error;
  }
}

/**
 * Generate a timestamp-based fallback ID (for emergency use only)
 * NOT compliant with §36, only use when ChittyID service is unavailable
 */
export function generateFallbackID(prefix: string = 'temp'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

EOF

        log_success "Created: lib/chittyid-helper.ts"
        FILES_MODIFIED=$((FILES_MODIFIED + 1))
    else
        log_warning "[DRY RUN] Would create lib/chittyid-helper.ts"
    fi
}

# Run ChittyCheck verification
run_chittycheck() {
    log_info "Running ChittyCheck verification..."

    if [ -f "$PROJECT_ROOT/chittycheck-enhanced.sh" ]; then
        "$PROJECT_ROOT/chittycheck-enhanced.sh" > /tmp/chittycheck-post-fix.log 2>&1 || true

        # Extract compliance score
        local score=$(grep "Compliance Score:" /tmp/chittycheck-post-fix.log | grep -oE '[0-9]+%' || echo "unknown")

        log_info "Post-fix compliance score: $score"

        if [ "$score" != "unknown" ]; then
            echo ""
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${BLUE}📊 ChittyCheck Results (Post-Fix)${NC}"
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            grep -A 10 "COMPLIANCE SUMMARY" /tmp/chittycheck-post-fix.log || true
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        fi
    else
        log_warning "chittycheck-enhanced.sh not found, skipping verification"
    fi
}

# Main execution
main() {
    check_environment
    echo ""

    if [ "$MODE" = "--verify" ]; then
        run_chittycheck
        exit 0
    fi

    log_info "Mode: $MODE"
    echo ""

    # Apply fixes
    fix_demo_property_nft
    fix_chitty_beacon_service
    fix_remaining_violations
    create_chittyid_helper

    # Summary
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📊 ChittyFix Summary${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Fixes applied: ${GREEN}$FIXES_APPLIED${NC}"
    echo -e "  Files modified: ${GREEN}$FILES_MODIFIED${NC}"

    if [ "$MODE" = "--apply" ]; then
        echo -e "  Backups saved: ${BLUE}$BACKUP_DIR${NC}"
        echo ""
        log_success "Fixes applied successfully"
        log_warning "⚠️  Manual review required for production services"
        echo ""
        log_info "Next steps:"
        echo "  1. Review changes: git diff"
        echo "  2. Verify compliance: ./chittyfix-enhanced.sh --verify"
        echo "  3. Test affected services"
        echo "  4. Commit if tests pass: git commit -am 'Fix ChittyID compliance violations'"
    else
        echo ""
        log_info "This was a DRY RUN - no changes were made"
        log_info "To apply fixes: ./chittyfix-enhanced.sh --apply"
    fi

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Execute
main

exit 0
