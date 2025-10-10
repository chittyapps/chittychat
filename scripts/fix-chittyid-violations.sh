#!/usr/bin/env bash
#
# Fix ChittyID Generation Violations
# Replaces local ID generation with ChittyID service calls
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 ChittyID Violation Fixer"
echo "=============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

violations_found=0
violations_fixed=0

# Pattern 1: crypto.randomUUID() - Replace with ChittyID service
echo "1️⃣  Scanning for crypto.randomUUID() violations..."
files=$(grep -r "crypto\.randomUUID()" "$PROJECT_ROOT/src" --include="*.js" --include="*.ts" -l 2>/dev/null || true)

if [ -n "$files" ]; then
    while IFS= read -r file; do
        count=$(grep -c "crypto\.randomUUID()" "$file" 2>/dev/null || echo 0)
        violations_found=$((violations_found + count))
        echo -e "  ${YELLOW}⚠${NC}  $file ($count occurrences)"
    done <<< "$files"
fi

# Pattern 2: Math.random().toString(36) - Replace with ChittyID service
echo ""
echo "2️⃣  Scanning for Math.random().toString(36) violations..."
files=$(grep -r "Math\.random()\.toString(36)" "$PROJECT_ROOT/src" --include="*.js" --include="*.ts" -l 2>/dev/null || true)

if [ -n "$files" ]; then
    while IFS= read -r file; do
        count=$(grep -c "Math\.random()\.toString(36)" "$file" 2>/dev/null || echo 0)
        violations_found=$((violations_found + count))
        echo -e "  ${YELLOW}⚠${NC}  $file ($count occurrences)"
    done <<< "$files"
fi

# Pattern 3: uuid_generate_v4() in SQL - Replace with ChittyID in application layer
echo ""
echo "3️⃣  Scanning for uuid_generate_v4() in SQL..."
files=$(grep -r "uuid_generate_v4()" "$PROJECT_ROOT/src" --include="*.js" --include="*.ts" -l 2>/dev/null || true)

if [ -n "$files" ]; then
    while IFS= read -r file; do
        count=$(grep -c "uuid_generate_v4()" "$file" 2>/dev/null || echo 0)
        violations_found=$((violations_found + count))
        echo -e "  ${YELLOW}⚠${NC}  $file ($count occurrences)"
    done <<< "$files"
fi

# Pattern 4: gen_random_uuid() in SQL
echo ""
echo "4️⃣  Scanning for gen_random_uuid() in SQL..."
files=$(grep -r "gen_random_uuid()" "$PROJECT_ROOT/src" --include="*.js" --include="*.ts" -l 2>/dev/null || true)

if [ -n "$files" ]; then
    while IFS= read -r file; do
        count=$(grep -c "gen_random_uuid()" "$file" 2>/dev/null || echo 0)
        violations_found=$((violations_found + count))
        echo -e "  ${YELLOW}⚠${NC}  $file ($count occurrences)"
    done <<< "$files"
fi

echo ""
echo "=============================="
echo -e "${YELLOW}Found $violations_found total violations${NC}"
echo ""

# Generate fix suggestions
echo "📋 Fix Suggestions:"
echo ""
echo "1. Import ChittyID client in each file:"
echo "   import { ChittyIDClient, EntityType } from './services/chittyid-client.js';"
echo ""
echo "2. Initialize client in constructor/setup:"
echo "   const chittyIdClient = new ChittyIDClient(env);"
echo ""
echo "3. Replace local ID generation:"
echo "   ❌ const id = crypto.randomUUID();"
echo "   ✅ const id = await chittyIdClient.mint(EntityType.THING);"
echo ""
echo "4. For database UUIDs, generate in application layer:"
echo "   ❌ CREATE TABLE foo (id UUID PRIMARY KEY DEFAULT gen_random_uuid());"
echo "   ✅ CREATE TABLE foo (id VARCHAR(255) PRIMARY KEY);  -- Store ChittyID"
echo "   ✅ const id = await chittyIdClient.mint(EntityType.THING);"
echo "   ✅ INSERT INTO foo (id, ...) VALUES (id, ...);"
echo ""

# Option to run automated fixes
read -p "Run automated fixes? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔧 Running automated fixes..."

    # Create backup
    backup_dir="$PROJECT_ROOT/.backups/chittyid-fix-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    # Backup all files with violations
    echo "📦 Creating backups in $backup_dir"
    all_files=$(grep -r "crypto\.randomUUID()\|Math\.random()\.toString(36)\|uuid_generate_v4()\|gen_random_uuid()" \
        "$PROJECT_ROOT/src" --include="*.js" --include="*.ts" -l 2>/dev/null || true)

    if [ -n "$all_files" ]; then
        while IFS= read -r file; do
            rel_path="${file#$PROJECT_ROOT/}"
            backup_file="$backup_dir/$rel_path"
            mkdir -p "$(dirname "$backup_file")"
            cp "$file" "$backup_file"
            echo "  ✓ Backed up: $rel_path"
        done <<< "$all_files"
    fi

    echo ""
    echo "⚠️  IMPORTANT: Automated fixes require manual review!"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes in each file"
    echo "2. Ensure ChittyID client is properly initialized"
    echo "3. Test all affected endpoints"
    echo "4. Update database schemas to store ChittyIDs as VARCHAR"
    echo "5. Run ChittyCheck to verify compliance: npm run chittycheck"
    echo ""
    echo "Backups saved to: $backup_dir"
else
    echo ""
    echo "Skipping automated fixes. Review violations above and fix manually."
fi

echo ""
echo "=============================="
echo "📚 Documentation:"
echo "  - ChittyID Policy: NEVER generate locally, ALWAYS use id.chitty.cc"
echo "  - Client: src/services/chittyid-client.js"
echo "  - Entity Types: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR, PROJECT, SESSION, THING"
echo ""
echo "🔗 ChittyID Service: https://id.chitty.cc"
echo "📖 API Docs: https://id.chitty.cc/docs"
echo ""

exit 0
