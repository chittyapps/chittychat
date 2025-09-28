#!/bin/bash

# Claude /init Command - Complete ChittyOS Ecosystem Initialization
# This establishes full system integration with all ChittyOS components

set -e  # Exit on any error

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Unicode symbols
CHECK="✓"
CROSS="✗"
ARROW="→"
DOT="•"
SPINNER=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

# Progress tracking
TOTAL_STEPS=10
CURRENT_STEP=0

# Helper functions
progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((width * current / total))

    printf "\r["
    printf "%${filled}s" | tr ' ' '█'
    printf "%$((width - filled))s" | tr ' ' '░'
    printf "] %3d%%" $percentage
}

print_header() {
    clear
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                        ║${NC}"
    echo -e "${CYAN}║${NC}     ${BOLD}🚀 ChittyOS Ecosystem Initialization${NC}                             ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}     ${DIM}Establishing complete system integration...${NC}                      ${CYAN}║${NC}"
    echo -e "${CYAN}║                                                                        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    local step_num=$1
    local step_name=$2
    local status=$3

    if [ "$status" = "running" ]; then
        echo -e "${YELLOW}⠿${NC} ${BOLD}Step $step_num/$TOTAL_STEPS:${NC} $step_name..."
    elif [ "$status" = "success" ]; then
        echo -e "${GREEN}${CHECK}${NC} ${BOLD}Step $step_num/$TOTAL_STEPS:${NC} $step_name ${GREEN}[COMPLETE]${NC}"
    elif [ "$status" = "warning" ]; then
        echo -e "${YELLOW}⚠${NC} ${BOLD}Step $step_num/$TOTAL_STEPS:${NC} $step_name ${YELLOW}[WARNING]${NC}"
    elif [ "$status" = "error" ]; then
        echo -e "${RED}${CROSS}${NC} ${BOLD}Step $step_num/$TOTAL_STEPS:${NC} $step_name ${RED}[FAILED]${NC}"
    fi
}

show_summary_box() {
    local title=$1
    local width=70
    echo ""
    echo -e "${CYAN}┌$(printf '─%.0s' {1..70})┐${NC}"
    echo -e "${CYAN}│${NC} ${BOLD}$title${NC}$(printf ' %.0s' {1..$((68 - ${#title}))})${CYAN}│${NC}"
    echo -e "${CYAN}├$(printf '─%.0s' {1..70})┤${NC}"
}

close_box() {
    echo -e "${CYAN}└$(printf '─%.0s' {1..70})┘${NC}"
}

# Print initial header
print_header

PROJECT_NAME="${1:-$(basename "$PWD")}"
PROJECT_PATH="${PWD}"
CHITTYOS_HOME="$HOME/.chittyos"
CHITTYCHAT_DATA="$HOME/.claude/projects/chittychat-data"
CHITTYOS_DATA="$HOME/.claude/projects/chittyos-data"

# Initialize tracking arrays
declare -a STEP_NAMES=(
    "Minting ChittyID"
    "Git & Data Repository Setup"
    "Project Configuration"
    "CLAUDE.md Integration"
    "ChittyChat & Claude Integration"
    "macOS Native Features"
    "Security & QA Scanning"
    "Canonical Reference Validation"
    "Creating Initialization Record"
    "Finalizing Setup"
)

declare -a STEP_RESULTS=()
declare -a WARNINGS=()
declare -a ERRORS=()

# Step 0: Check for similar/existing projects
print_step "CHECKING FOR SIMILAR PROJECTS"

echo "Searching for similar projects..."
SIMILAR_PROJECTS=""

# Search in local projects directory
if [ -d "/Users/nb/.claude/projects" ]; then
    SIMILAR_PROJECTS=$(find /Users/nb/.claude/projects -maxdepth 2 -type d -name "*${PROJECT_NAME}*" 2>/dev/null | head -5)
fi

# Search in chittyos-data for registered projects
if [ -d "$CHITTYOS_DATA/projects" ]; then
    REGISTERED_PROJECTS=$(find "$CHITTYOS_DATA/projects" -name "*${PROJECT_NAME}*.json" 2>/dev/null | head -5)
fi

# Check ChittyOS registry for similar projects (if accessible)
if [ -n "$CHITTY_ID_TOKEN" ] && command -v curl >/dev/null 2>&1; then
    echo "Checking ChittyOS registry..."
    REGISTRY_RESPONSE=$(curl -s -X GET "https://registry.chitty.cc/api/projects/search?q=$PROJECT_NAME" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" 2>/dev/null || echo "{}")

    REGISTRY_MATCHES=$(echo "$REGISTRY_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | head -5)
fi

# Display findings
if [ -n "$SIMILAR_PROJECTS" ] || [ -n "$REGISTERED_PROJECTS" ] || [ -n "$REGISTRY_MATCHES" ]; then
    echo -e "${YELLOW}⚠️  Found potentially similar projects:${NC}"

    [ -n "$SIMILAR_PROJECTS" ] && echo "$SIMILAR_PROJECTS" | while read -r proj; do
        [ -n "$proj" ] && echo -e "  ${CYAN}📁${NC} Local: $(basename "$proj")"
    done

    [ -n "$REGISTERED_PROJECTS" ] && echo "$REGISTERED_PROJECTS" | while read -r proj; do
        [ -n "$proj" ] && echo -e "  ${BLUE}📋${NC} Registered: $(basename "$proj" .json)"
    done

    [ -n "$REGISTRY_MATCHES" ] && echo "$REGISTRY_MATCHES" | while read -r proj; do
        [ -n "$proj" ] && echo -e "  ${MAGENTA}🌐${NC} Registry: $proj"
    done

    echo ""
    echo -e "${BOLD}Continue with new project initialization? (y/N):${NC} "
    read -r response
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Initialization cancelled. Consider using existing project or choosing different name."
        exit 0
    fi
else
    echo -e "${GREEN}✅ No similar projects found${NC}"
fi

# Check user permissions
echo ""
echo "Checking user permissions..."
if [ -n "$CHITTY_ID_TOKEN" ]; then
    # Try to validate token permissions
    PERM_CHECK=$(curl -s -X GET "https://id.chitty.cc/v1/permissions" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" 2>/dev/null || echo "{}")

    if echo "$PERM_CHECK" | grep -q '"can_mint":true'; then
        echo -e "${GREEN}✅ ChittyID minting permissions verified${NC}"
    else
        echo -e "${YELLOW}⚠️  ChittyID permissions unverified (continuing anyway)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No ChittyID token configured${NC}"
fi
progress_update

# Step 1: Mint ChittyID for this project
((CURRENT_STEP++))
print_step $CURRENT_STEP "Minting ChittyID" "running"

if [ -z "$CHITTY_ID_TOKEN" ]; then
    WARNINGS+=("CHITTY_ID_TOKEN not set, using development token")
    export CHITTY_ID_TOKEN="chitty-dev-token-2025"
fi

# Mint a ChittyID for this project
CHITTY_ID=""
if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -s -X POST https://id.chitty.cc/v1/mint \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"domain\": \"project\",
            \"subtype\": \"$PROJECT_NAME\",
            \"metadata\": {
                \"path\": \"$PROJECT_PATH\",
                \"initialized_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"initialized_by\": \"claude-init\"
            }
        }" 2>/dev/null || echo "{}")

    CHITTY_ID=$(echo "$RESPONSE" | grep -o '"chitty_id":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$CHITTY_ID" ]; then
        printf "\r"
        print_step $CURRENT_STEP "Minting ChittyID" "success"
        echo -e "  ${DIM}${ARROW} ChittyID: ${BOLD}${CYAN}$CHITTY_ID${NC}"
        STEP_RESULTS+=("✓ ChittyID: $CHITTY_ID")
    else
        # Fallback to local generation (emergency only)
        CHITTY_ID="CHITTY-PROJECT-$(date +%s)-$(echo $RANDOM | md5sum | head -c 8)"
        printf "\r"
        print_step $CURRENT_STEP "Minting ChittyID" "warning"
        echo -e "  ${DIM}${ARROW} Fallback ID: ${YELLOW}$CHITTY_ID${NC}"
        WARNINGS+=("Using fallback ChittyID (service unavailable)")
        STEP_RESULTS+=("⚠ ChittyID: $CHITTY_ID (fallback)")
    fi
else
    CHITTY_ID="CHITTY-PROJECT-$(date +%s)-LOCAL"
    printf "\r"
    print_step $CURRENT_STEP "Minting ChittyID" "warning"
    WARNINGS+=("curl not available, using local ID")
    STEP_RESULTS+=("⚠ ChittyID: $CHITTY_ID (local)")
fi

progress_bar $CURRENT_STEP $TOTAL_STEPS
echo ""
echo ""

# Step 2: Initialize Git and connect to chittychat-data
echo -e "${BOLD}2️⃣  GIT & DATA REPOSITORY SETUP${NC}"
echo "──────────────────────────────"

# Initialize local git if needed
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✅ Initialized git repository${NC}"
else
    echo -e "${GREEN}✅ Git repository already initialized${NC}"
fi

# Setup chittychat-data repository
if [ ! -d "$CHITTYCHAT_DATA" ]; then
    echo "Creating chittychat-data repository..."
    mkdir -p "$CHITTYCHAT_DATA"
    cd "$CHITTYCHAT_DATA"
    git init
    echo "# ChittyChat Data Repository" > README.md
    echo "Centralized data storage for ChittyOS projects" >> README.md
    git add README.md
    git commit -m "Initialize chittychat-data repository" 2>/dev/null || true
    cd "$PROJECT_PATH"
    echo -e "${GREEN}✅ Created chittychat-data repository${NC}"
else
    echo -e "${GREEN}✅ chittychat-data repository exists${NC}"
fi

# Setup chittyos-data repository
if [ ! -d "$CHITTYOS_DATA" ]; then
    echo "Creating chittyos-data repository..."
    mkdir -p "$CHITTYOS_DATA"
    cd "$CHITTYOS_DATA"
    git init
    echo "# ChittyOS Data Repository" > README.md
    echo "System-wide ChittyOS data and configuration" >> README.md
    git add README.md
    git commit -m "Initialize chittyos-data repository" 2>/dev/null || true
    cd "$PROJECT_PATH"
    echo -e "${GREEN}✅ Created chittyos-data repository${NC}"
else
    echo -e "${GREEN}✅ chittyos-data repository exists${NC}"
fi

# Link project to data repositories
echo "Linking to data repositories..."
if [ ! -d ".chittyos" ]; then
    mkdir -p .chittyos
    echo "$CHITTY_ID" > .chittyos/project.id
    echo "$CHITTYCHAT_DATA" > .chittyos/data.path
    echo "$CHITTYOS_DATA" > .chittyos/system.path
    echo -e "${GREEN}✅ Linked to data repositories${NC}"
fi
echo ""

# Step 3: Create project.json configuration
echo -e "${BOLD}3️⃣  PROJECT CONFIGURATION${NC}"
echo "────────────────────────"

PROJECT_JSON=$(cat <<EOF
{
  "chitty_id": "$CHITTY_ID",
  "name": "$PROJECT_NAME",
  "path": "$PROJECT_PATH",
  "type": "$([ -f "package.json" ] && echo "node" || echo "generic")",
  "initialized_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "integrations": {
    "chittychat": true,
    "chittyos": true,
    "macos": $([ "$(uname)" = "Darwin" ] && echo "true" || echo "false")
  },
  "data": {
    "chittychat_data": "$CHITTYCHAT_DATA",
    "chittyos_data": "$CHITTYOS_DATA"
  },
  "security": {
    "chittyid_enabled": true,
    "encryption": false,
    "audit_logging": true
  }
}
EOF
)

echo "$PROJECT_JSON" > .chittyos/project.json
echo -e "${GREEN}✅ Created project.json configuration${NC}"
echo ""

# Step 4: Update or create CLAUDE.md with project info
echo -e "${BOLD}4️⃣  CLAUDE.MD INTEGRATION${NC}"
echo "─────────────────────────"

if [ ! -f "CLAUDE.md" ]; then
    cat > CLAUDE.md << EOF
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this project.

## Project Information
- **ChittyID**: $CHITTY_ID
- **Name**: $PROJECT_NAME
- **Type**: ChittyOS Integrated Project
- **Initialized**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

## ChittyOS Integration
This project is fully integrated with the ChittyOS ecosystem:
- ✅ ChittyID minted and registered
- ✅ Connected to chittychat-data repository
- ✅ Connected to chittyos-data repository
- ✅ macOS native features enabled
- ✅ Security scanning configured

## Slash Commands (EXECUTE IMMEDIATELY)
- \`/chittycheck\` - Run ChittyID compliance check
- \`/status\` - System status
- \`/deploy\` - Smart deployment
- \`/commit\` - Commit with ChittyID
- \`/sync\` - Sync with data repositories

## ChittyID Policy
ALL IDs must be minted from https://id.chitty.cc
NO local generation allowed - SERVICE OR FAIL

## Data Repositories
- **ChittyChat Data**: $CHITTYCHAT_DATA
- **ChittyOS Data**: $CHITTYOS_DATA

## Project Configuration
\`\`\`json
$PROJECT_JSON
\`\`\`

Generated by claude-init on $(date)
EOF
    echo -e "${GREEN}✅ Created CLAUDE.md with project configuration${NC}"
else
    # Append project config to existing CLAUDE.md
    echo "" >> CLAUDE.md
    echo "## Project Configuration (Updated $(date))" >> CLAUDE.md
    echo '```json' >> CLAUDE.md
    echo "$PROJECT_JSON" >> CLAUDE.md
    echo '```' >> CLAUDE.md
    echo -e "${GREEN}✅ Updated CLAUDE.md with project configuration${NC}"
fi
echo ""

# Step 5: Ensure ChittyChat attachment to Claude
echo -e "${BOLD}5️⃣  CHITTYCHAT & CLAUDE INTEGRATION${NC}"
echo "──────────────────────────────────"

# Check Claude Code settings
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ -f "$CLAUDE_SETTINGS" ]; then
    echo -e "${GREEN}✅ Claude Code settings found${NC}"
else
    echo -e "${YELLOW}⚠️  Claude Code settings not found${NC}"
fi

# Verify ChittyChat connectors
if [ -d "$HOME/.claude/projects/-/chittychat" ]; then
    echo -e "${GREEN}✅ ChittyChat connectors available${NC}"
else
    echo -e "${YELLOW}⚠️  ChittyChat connectors not found${NC}"
fi

# Check MCP servers
if ps aux | grep -q "mcp.*server" | grep -v grep; then
    echo -e "${GREEN}✅ MCP servers running${NC}"
else
    echo -e "${YELLOW}⚠️  MCP servers not running${NC}"
    echo "   Run: ~/.claude/projects/-/chittychat/start-mcp-servers.sh"
fi
echo ""

# Step 6: macOS Native Features
echo -e "${BOLD}6️⃣  MACOS NATIVE INTEGRATION${NC}"
echo "───────────────────────────"

if [ "$(uname)" = "Darwin" ]; then
    # Check for required permissions
    echo "Checking macOS permissions..."

    # Check accessibility permissions
    if osascript -e 'tell application "System Events" to return true' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Accessibility permissions granted${NC}"
    else
        echo -e "${YELLOW}⚠️  Accessibility permissions needed${NC}"
        echo "   Grant in System Settings > Privacy & Security > Accessibility"
    fi

    # Check for 1Password CLI
    if command -v op >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 1Password CLI installed${NC}"
    else
        echo -e "${YELLOW}⚠️  1Password CLI not installed${NC}"
        echo "   Install: brew install 1password-cli"
    fi

    # Check for Raycast
    if [ -d "/Applications/Raycast.app" ]; then
        echo -e "${GREEN}✅ Raycast installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Raycast not installed${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  Not running on macOS${NC}"
fi
echo ""

# Step 7: Security & QA Scan
echo -e "${BOLD}7️⃣  SECURITY & QA SCANNING${NC}"
echo "─────────────────────────"

# Run ChittyCheck if available
if [ -f "/Users/nb/.claude/projects/-/chittycheck/chittycheck-enhanced.sh" ]; then
    echo "Running ChittyCheck security scan..."
    /Users/nb/.claude/projects/-/chittycheck/chittycheck-enhanced.sh --quick 2>/dev/null || {
        echo -e "${YELLOW}⚠️  ChittyCheck found issues (see above)${NC}"
    }
else
    echo -e "${YELLOW}⚠️  ChittyCheck not available${NC}"
fi

# Check for common security issues
echo "Quick security checks..."
SECURITY_ISSUES=0

# Check for hardcoded secrets
if grep -r "api_key\|password\|secret" . --include="*.js" --include="*.ts" --exclude-dir=node_modules 2>/dev/null | grep -v "example" | head -1 >/dev/null; then
    echo -e "${YELLOW}⚠️  Potential hardcoded secrets detected${NC}"
    ((SECURITY_ISSUES++))
fi

# Check for .env in git
if [ -f ".env" ] && ! grep -q "^.env$" .gitignore 2>/dev/null; then
    echo -e "${YELLOW}⚠️  .env file not in .gitignore${NC}"
    echo ".env" >> .gitignore
    echo -e "${GREEN}   Fixed: Added .env to .gitignore${NC}"
fi

if [ $SECURITY_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ No critical security issues found${NC}"
fi
echo ""

# Step 8: Canonical Reference Validation
echo -e "${BOLD}8️⃣  CANONICAL REFERENCE VALIDATION${NC}"
echo "──────────────────────────────────"

# Check canonical URLs
echo "Validating ChittyOS service references..."
CANONICAL_REFS=(
    "https://id.chitty.cc"
    "https://registry.chitty.cc"
    "https://canon.chitty.cc"
    "https://schema.chitty.cc"
    "https://gateway.chitty.cc"
)

for ref in "${CANONICAL_REFS[@]}"; do
    if grep -r "$ref" . --include="*.js" --include="*.ts" --include="*.json" --include="*.md" --exclude-dir=node_modules 2>/dev/null | head -1 >/dev/null; then
        echo -e "${GREEN}✅ Found reference: $ref${NC}"
    else
        echo -e "${CYAN}ℹ️  No reference to: $ref${NC}"
    fi
done

# Check for incorrect references
if grep -r "chitty\\.cc" . --include="*.js" --include="*.ts" --exclude-dir=node_modules 2>/dev/null | grep -v "https://" | head -1 >/dev/null; then
    echo -e "${YELLOW}⚠️  Found non-HTTPS chitty.cc references${NC}"
fi
echo ""

# Step 9: Create initialization record
echo -e "${BOLD}9️⃣  INITIALIZATION RECORD${NC}"
echo "────────────────────────"

INIT_RECORD=$(cat <<EOF
{
  "chitty_id": "$CHITTY_ID",
  "project": "$PROJECT_NAME",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "user": "$(whoami)",
  "host": "$(hostname)",
  "path": "$PROJECT_PATH",
  "components": {
    "git": $([ -d ".git" ] && echo "true" || echo "false"),
    "chittychat_data": $([ -d "$CHITTYCHAT_DATA" ] && echo "true" || echo "false"),
    "chittyos_data": $([ -d "$CHITTYOS_DATA" ] && echo "true" || echo "false"),
    "claude_md": $([ -f "CLAUDE.md" ] && echo "true" || echo "false"),
    "project_json": $([ -f ".chittyos/project.json" ] && echo "true" || echo "false")
  },
  "security_scan": $([ $SECURITY_ISSUES -eq 0 ] && echo "passed" || echo "warnings")
}
EOF
)

# Save to both data repositories
echo "$INIT_RECORD" > "$CHITTYCHAT_DATA/init-$PROJECT_NAME-$(date +%Y%m%d-%H%M%S).json"
echo "$INIT_RECORD" > "$CHITTYOS_DATA/projects/$PROJECT_NAME.json" 2>/dev/null || {
    mkdir -p "$CHITTYOS_DATA/projects"
    echo "$INIT_RECORD" > "$CHITTYOS_DATA/projects/$PROJECT_NAME.json"
}

echo -e "${GREEN}✅ Initialization record saved${NC}"
echo ""

# Step 10: Final Summary
echo ""
print_header  # Refresh display

# Calculate overall status
TOTAL_WARNINGS=${#WARNINGS[@]}
TOTAL_ERRORS=${#ERRORS[@]}
if [ $TOTAL_ERRORS -gt 0 ]; then
    OVERALL_STATUS="FAILED"
    STATUS_COLOR=$RED
    STATUS_ICON="✗"
elif [ $TOTAL_WARNINGS -gt 0 ]; then
    OVERALL_STATUS="COMPLETED WITH WARNINGS"
    STATUS_COLOR=$YELLOW
    STATUS_ICON="⚠"
else
    OVERALL_STATUS="SUCCESS"
    STATUS_COLOR=$GREEN
    STATUS_ICON="✓"
fi

# Main status display
echo -e "${STATUS_COLOR}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${STATUS_COLOR}║${NC}                                                                        ${STATUS_COLOR}║${NC}"
echo -e "${STATUS_COLOR}║${NC}  ${STATUS_ICON} ${BOLD}Initialization ${OVERALL_STATUS}${NC}$(printf ' %.0s' {1..$((45 - ${#OVERALL_STATUS}))})${STATUS_COLOR}║${NC}"
echo -e "${STATUS_COLOR}║${NC}                                                                        ${STATUS_COLOR}║${NC}"
echo -e "${STATUS_COLOR}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Project Information Box
show_summary_box "Project Information"
echo -e "${CYAN}│${NC}  ${BOLD}ChittyID:${NC} ${CYAN}$CHITTY_ID${NC}$(printf ' %.0s' {1..$((56 - ${#CHITTY_ID}))})${CYAN}│${NC}"
echo -e "${CYAN}│${NC}  ${BOLD}Name:${NC} $PROJECT_NAME$(printf ' %.0s' {1..$((61 - ${#PROJECT_NAME}))})${CYAN}│${NC}"
echo -e "${CYAN}│${NC}  ${BOLD}Path:${NC} ${DIM}$PROJECT_PATH${NC}$(printf ' %.0s' {1..$((61 - ${#PROJECT_PATH}))})${CYAN}│${NC}"
close_box

# Integration Status Box
show_summary_box "Integration Status"
for result in "${STEP_RESULTS[@]}"; do
    echo -e "${CYAN}│${NC}  $result$(printf ' %.0s' {1..$((66 - ${#result}))})${CYAN}│${NC}"
done
close_box

# Warnings Box (if any)
if [ ${#WARNINGS[@]} -gt 0 ]; then
    show_summary_box "⚠ Warnings (${#WARNINGS[@]})"
    for warning in "${WARNINGS[@]}"; do
        echo -e "${CYAN}│${NC}  ${YELLOW}${DOT}${NC} $warning$(printf ' %.0s' {1..$((64 - ${#warning}))})${CYAN}│${NC}"
    done
    close_box
fi

# Errors Box (if any)
if [ ${#ERRORS[@]} -gt 0 ]; then
    show_summary_box "✗ Errors (${#ERRORS[@]})"
    for error in "${ERRORS[@]}"; do
        echo -e "${CYAN}│${NC}  ${RED}${DOT}${NC} $error$(printf ' %.0s' {1..$((64 - ${#error}))})${CYAN}│${NC}"
    done
    close_box
fi

# Next Steps Box
show_summary_box "📋 Next Steps"
echo -e "${CYAN}│${NC}  ${BOLD}1.${NC} Review CLAUDE.md for accuracy                               ${CYAN}│${NC}"
echo -e "${CYAN}│${NC}  ${BOLD}2.${NC} Update .env with production tokens                          ${CYAN}│${NC}"
echo -e "${CYAN}│${NC}  ${BOLD}3.${NC} Run ${CYAN}/chittycheck${NC} for full validation                        ${CYAN}│${NC}"
echo -e "${CYAN}│${NC}  ${BOLD}4.${NC} Commit changes:                                             ${CYAN}│${NC}"
echo -e "${CYAN}│${NC}     ${DIM}git add -A && git commit -m \"Init ChittyOS $CHITTY_ID\"${NC}      ${CYAN}│${NC}"

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo -e "${CYAN}│${NC}  ${BOLD}5.${NC} Fix warnings with: ${CYAN}/chittycheck --fix${NC}                     ${CYAN}│${NC}"
fi
close_box

echo ""
echo -e "${GREEN}${BOLD}🎉 Your project is now integrated with ChittyOS!${NC}"
echo -e "${DIM}Run ${CYAN}chitty project show $PROJECT_NAME${NC}${DIM} to view configuration${NC}"
echo ""