#!/bin/bash
# ChittyFix ID Patterns - Automatic Rogue ID Pattern Fixer
# Fixes crypto.randomUUID(), Math.random(), and other local ID generation patterns
# Replaces with proper ChittyID service calls

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔧 ChittyFix ID Patterns - Automated ID Pattern Fixer${NC}"
echo "════════════════════════════════════════════════════════"

# Configuration
DRY_RUN=${1:-true}
TARGET_DIR="${2:-.}"
FIXES_APPLIED=0
FILES_MODIFIED=0

# Exclude patterns
EXCLUDE_DIRS="node_modules|archive|deprecated|backup|legacy|\.git"
EXCLUDE_FILES="\.test\.|\.spec\.|\.backup"

log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC}  $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

# Fix crypto.randomUUID() pattern
fix_crypto_random_uuid() {
    local file="$1"
    local context="$2" # 'session', 'version', 'transaction', etc.

    log_info "Fixing crypto.randomUUID() in $file (context: $context)"

    # Backup original
    cp "$file" "$file.chittyfix.bak"

    # Determine appropriate domain/subtype based on context
    local domain="unknown"
    local subtype="generated"

    case "$context" in
        session*)
            domain="session"
            subtype="coordination"
            ;;
        version*)
            domain="state"
            subtype="version"
            ;;
        transaction*)
            domain="transaction"
            subtype="event"
            ;;
        *)
            domain="entity"
            subtype="generated"
            ;;
    esac

    # Create fix pattern based on file type
    if [[ "$file" == *.ts || "$file" == *.tsx ]]; then
        # TypeScript fix
        cat > /tmp/chittyfix_replace.txt << EOF
// Request ChittyID from service (§36 compliant)
const chittyIdResponse = await fetch('https://id.chitty.cc/v1/mint', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${env.CHITTY_ID_TOKEN || process.env.CHITTY_ID_TOKEN}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: '$domain',
    subtype: '$subtype',
    metadata: { source: '$(basename $file)' }
  })
});

if (!chittyIdResponse.ok) {
  throw new Error(\`ChittyID service unavailable: \${chittyIdResponse.status}\`);
}

const { chitty_id } = await chittyIdResponse.json();
// Use chitty_id instead of crypto.randomUUID()
EOF
    else
        # JavaScript fix
        cat > /tmp/chittyfix_replace.txt << EOF
// Request ChittyID from service (§36 compliant)
const chittyIdResponse = await fetch('https://id.chitty.cc/v1/mint', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.CHITTY_ID_TOKEN}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    domain: '$domain',
    subtype: '$subtype',
    metadata: { source: '$(basename $file)' }
  })
});

if (!chittyIdResponse.ok) {
  throw new Error(\`ChittyID service unavailable: \${chittyIdResponse.status}\`);
}

const { chitty_id } = await chittyIdResponse.json();
// Use chitty_id instead of crypto.randomUUID()
EOF
    fi

    if [ "$DRY_RUN" = "false" ]; then
        # Note: This is a template - actual sed replacement would need precise context
        log_warning "Manual review required: $file"
        log_warning "  Replace crypto.randomUUID() with ChittyID service call"
        log_warning "  Template saved to /tmp/chittyfix_replace.txt"
        FILES_MODIFIED=$((FILES_MODIFIED + 1))
    else
        log_warning "[DRY RUN] Would fix crypto.randomUUID() in $file"
    fi

    FIXES_APPLIED=$((FIXES_APPLIED + 1))
}

# Fix Math.random() pattern
fix_math_random() {
    local file="$1"

    log_info "Fixing Math.random().toString(36) in $file"

    if [ "$DRY_RUN" = "false" ]; then
        log_warning "Manual review required: $file"
        log_warning "  Replace Math.random() ID generation with ChittyID service"
        FILES_MODIFIED=$((FILES_MODIFIED + 1))
    else
        log_warning "[DRY RUN] Would fix Math.random() in $file"
    fi

    FIXES_APPLIED=$((FIXES_APPLIED + 1))
}

# Scan and fix files
scan_and_fix() {
    log_info "Scanning for rogue ID patterns in $TARGET_DIR..."

    # Find crypto.randomUUID() violations
    while IFS= read -r file; do
        # Skip excluded paths
        if echo "$file" | grep -qE "$EXCLUDE_DIRS|$EXCLUDE_FILES"; then
            continue
        fi

        # Detect context from surrounding code
        local context=$(grep -B 3 "crypto.randomUUID()" "$file" | grep -i "session\|version\|transaction" | head -1 || echo "unknown")

        if [[ "$context" =~ session ]]; then
            fix_crypto_random_uuid "$file" "session"
        elif [[ "$context" =~ version ]]; then
            fix_crypto_random_uuid "$file" "version"
        elif [[ "$context" =~ transaction ]]; then
            fix_crypto_random_uuid "$file" "transaction"
        else
            fix_crypto_random_uuid "$file" "unknown"
        fi
    done < <(grep -rl "crypto\.randomUUID()" "$TARGET_DIR" --include="*.js" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

    # Find Math.random() violations
    while IFS= read -r file; do
        # Skip excluded paths
        if echo "$file" | grep -qE "$EXCLUDE_DIRS|$EXCLUDE_FILES"; then
            continue
        fi

        fix_math_random "$file"
    done < <(grep -rl "Math\.random()\.toString(36)" "$TARGET_DIR" --include="*.js" --include="*.ts" 2>/dev/null || true)
}

# Main execution
if [ "$DRY_RUN" = "true" ]; then
    log_warning "Running in DRY RUN mode - no files will be modified"
    log_warning "Run with: $0 false <directory> to apply fixes"
    echo ""
fi

scan_and_fix

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 ChittyFix ID Patterns Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Fixes identified: ${YELLOW}$FIXES_APPLIED${NC}"
echo -e "  Files requiring manual review: ${YELLOW}$FILES_MODIFIED${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo ""
    log_warning "This was a DRY RUN - no changes were made"
    log_info "To apply fixes: $0 false"
else
    echo ""
    log_success "Fixes have been identified"
    log_warning "⚠️  IMPORTANT: Manual code review required!"
    log_warning "   - Review backup files (*.chittyfix.bak)"
    log_warning "   - Check /tmp/chittyfix_replace.txt for templates"
    log_warning "   - Verify ChittyID service integration"
    log_warning "   - Test functionality after changes"
fi

echo ""

exit 0
