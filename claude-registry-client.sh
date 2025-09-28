#!/bin/bash

# CLAUDE.md Registry Client
# Uses registry.chitty.cc as the central source of truth

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

REGISTRY_URL="https://registry.chitty.cc"

# ============================================
# Register Local CLAUDE.md with Registry
# ============================================
register_claude_md() {
    local project_name=$(basename $(pwd))
    local project_path=$(pwd)
    local claude_md_path="$project_path/CLAUDE.md"

    if [ ! -f "$claude_md_path" ]; then
        echo -e "${YELLOW}No CLAUDE.md found in current directory${RESET}"
        return 1
    fi

    echo -e "${CYAN}${BOLD}Registering CLAUDE.md with registry.chitty.cc${RESET}"

    # Extract commands from CLAUDE.md
    local commands=$(grep -E "^[-*].*\`/[a-z]+\`.*Execute:" "$claude_md_path" | \
        sed 's/.*`\/\([^`]*\)`.*/\1/' | tr '\n' ',' | sed 's/,$//')

    # Register with registry
    local response=$(curl -s -X POST "$REGISTRY_URL/api/v1/claude/register" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        -d "{
            \"project\": \"$project_name\",
            \"path\": \"$project_path\",
            \"commands\": \"$commands\",
            \"type\": \"claude_md\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" 2>/dev/null)

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Registered with registry${RESET}"
    else
        echo -e "${RED}❌ Failed to register${RESET}"
    fi
}

# ============================================
# Fetch Global CLAUDE.md Configuration
# ============================================
fetch_global_config() {
    echo -e "${CYAN}${BOLD}Fetching global CLAUDE.md from registry${RESET}"

    local response=$(curl -s "$REGISTRY_URL/api/v1/claude/global" \
        -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$response" ]; then
        # Parse and inject global config
        echo "$response" | jq -r '.content' 2>/dev/null > /tmp/claude_global.md

        if [ -s /tmp/claude_global.md ]; then
            echo -e "${GREEN}✅ Global configuration fetched${RESET}"

            # Merge with local CLAUDE.md if exists
            if [ -f "CLAUDE.md" ]; then
                echo -e "${CYAN}Merging with local CLAUDE.md...${RESET}"

                # Create merged version
                cat > CLAUDE.md.new << EOF
<!-- SYNCED WITH: registry.chitty.cc -->
<!-- LAST SYNC: $(date -u +%Y-%m-%dT%H:%M:%SZ) -->

# GLOBAL CONFIGURATION (from registry.chitty.cc)

$(cat /tmp/claude_global.md)

# LOCAL CONFIGURATION

$(cat CLAUDE.md | grep -v "^<!-- SYNCED WITH:" | grep -v "^<!-- LAST SYNC:")

<!-- END SYNC -->
EOF
                mv CLAUDE.md CLAUDE.md.bak
                mv CLAUDE.md.new CLAUDE.md
                echo -e "${GREEN}✅ Merged global and local configurations${RESET}"
            else
                cp /tmp/claude_global.md CLAUDE.md
                echo -e "${GREEN}✅ Created CLAUDE.md from global${RESET}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Could not fetch global configuration${RESET}"
    fi
}

# ============================================
# Query Available Commands from Registry
# ============================================
query_commands() {
    echo -e "${CYAN}${BOLD}Available Commands from Registry${RESET}"
    echo ""

    local response=$(curl -s "$REGISTRY_URL/api/v1/claude/commands" \
        -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo "$response" | jq -r '.commands[] | "  /\(.name) - \(.description)"' 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  Could not fetch commands from registry${RESET}"
    fi
}

# ============================================
# Sync All CLAUDE.md Files with Registry
# ============================================
sync_all() {
    echo -e "${CYAN}${BOLD}🔄 SYNCING WITH REGISTRY.CHITTY.CC${RESET}"
    echo ""

    # 1. Register current project
    if [ -f "CLAUDE.md" ]; then
        register_claude_md
    fi

    # 2. Fetch global configuration
    fetch_global_config

    # 3. Get all registered projects
    echo ""
    echo -e "${BOLD}Registered Projects:${RESET}"
    local projects=$(curl -s "$REGISTRY_URL/api/v1/claude/projects" \
        -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$projects" ]; then
        echo "$projects" | jq -r '.projects[] | "  • \(.name) (\(.path))"' 2>/dev/null || echo "  No projects registered"
    fi

    echo ""
    echo -e "${GREEN}✅ Sync complete${RESET}"
}

# ============================================
# Push Local Commands to Registry
# ============================================
push_commands() {
    echo -e "${CYAN}${BOLD}Pushing commands to registry${RESET}"

    local commands_file="/Users/nb/.claude/projects/-/chittychat/slash-commands-extended.sh"

    if [ ! -f "$commands_file" ]; then
        echo -e "${YELLOW}Commands file not found${RESET}"
        return 1
    fi

    # Extract command definitions
    local commands=$(grep -E "^[a-z_]+_command\(\)" "$commands_file" | \
        sed 's/_command().*//' | tr '\n' ' ')

    for cmd in $commands; do
        echo "  Registering /$cmd..."

        curl -s -X POST "$REGISTRY_URL/api/v1/commands/register" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
            -d "{
                \"name\": \"$cmd\",
                \"type\": \"slash_command\",
                \"executable\": \"/Users/nb/.claude/projects/-/chittychat/slash-commands-extended.sh $cmd\",
                \"description\": \"ChittyOS $cmd command\",
                \"category\": \"chittyos\"
            }" 2>/dev/null

        if [ $? -eq 0 ]; then
            echo -e "    ${GREEN}✓${RESET} /$cmd registered"
        fi
    done

    echo -e "${GREEN}✅ Commands pushed to registry${RESET}"
}

# ============================================
# Main Command Router
# ============================================
case "$1" in
    register)
        register_claude_md
        ;;
    fetch)
        fetch_global_config
        ;;
    commands)
        query_commands
        ;;
    sync)
        sync_all
        ;;
    push)
        push_commands
        ;;
    *)
        echo -e "${BOLD}CLAUDE.md Registry Client${RESET}"
        echo ""
        echo "Commands:"
        echo "  register  - Register local CLAUDE.md with registry"
        echo "  fetch     - Fetch global configuration from registry"
        echo "  commands  - List available commands from registry"
        echo "  sync      - Full sync with registry"
        echo "  push      - Push local commands to registry"
        echo ""
        echo "Registry: $REGISTRY_URL"
        ;;
esac