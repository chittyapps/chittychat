#!/bin/bash

# ChittyCheck Status Line Module
# Provides compact compliance status for integration into status displays

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Function to run silent chittycheck and return status
chittycheck_status() {
    local violations=0
    local warnings=0
    local passed=0
    local critical_violations=()

    # Load configuration silently
    if [ -f "$HOME/.chittyos/config.json" ] && command -v jq &> /dev/null; then
        eval "$(jq -r '.services | to_entries[] | .value[] | "export \(.name | ascii_upcase)_SERVICE=\"\(.url)\""' "$HOME/.chittyos/config.json" 2>/dev/null)" 2>/dev/null
        export REGISTRY_SERVICE=$(jq -r '.registry // "https://registry.chitty.cc"' "$HOME/.chittyos/config.json" 2>/dev/null)
        export CHITTYOS_ACCOUNT_ID=$(jq -r '.account_id // "bbf9fcd845e78035b7a135c481e88541"' "$HOME/.chittyos/config.json" 2>/dev/null)
    fi

    # Load .env if exists
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env 2>/dev/null | xargs) 2>/dev/null
    fi

    # Quick checks (silent)

    # 1. Token check
    if [ -n "$CHITTY_ID_TOKEN" ] && [ "$CHITTY_ID_TOKEN" != "YOUR_TOKEN_HERE_REPLACE_ME" ]; then
        ((passed++))
    else
        ((violations++))
        critical_violations+=("No valid ChittyID token")
    fi

    # 2. Rogue package check (if package.json exists)
    if [ -f "package.json" ]; then
        local rogue_packages=(uuid nanoid shortid cuid uniqid)
        for pkg in "${rogue_packages[@]}"; do
            if grep -q "\"$pkg\"" package.json 2>/dev/null; then
                ((violations++))
                critical_violations+=("Rogue ID package: $pkg")
            fi
        done
        ((passed++))  # No rogue packages found
    fi

    # 3. Rogue pattern check (quick scan)
    if [ -d "src" ] || [ -d "." ]; then
        local pattern_count=0
        local rogue_patterns=("crypto\.randomUUID" "nanoid\(\)" "Math\.random.*toString" "generateId\|generateID")

        for pattern in "${rogue_patterns[@]}"; do
            local count=$(grep -r "$pattern" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
            pattern_count=$((pattern_count + count))
        done

        if [ $pattern_count -gt 0 ]; then
            ((violations++))
            critical_violations+=("$pattern_count rogue ID patterns")
        else
            ((passed++))
        fi
    fi

    # 4. ChittyID integration check
    if grep -r "id\.chitty\.cc\|ChittyIDClient\|mintChittyId" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | head -1 >/dev/null; then
        ((passed++))
    else
        ((warnings++))
    fi

    # 5. Git/session check
    if [ -d ".git" ]; then
        local current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
        if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
            ((warnings++))
        else
            ((passed++))
        fi

        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            ((warnings++))
        else
            ((passed++))
        fi
    fi

    # 6. Essential files check
    [ -f ".gitignore" ] && ((passed++)) || ((warnings++))
    [ -f "CLAUDE.md" ] && ((passed++)) || ((warnings++))

    # Calculate score
    local total_checks=$((violations + warnings + passed))
    local score=0
    if [ $total_checks -gt 0 ]; then
        score=$(( (passed * 100) / total_checks ))
    fi

    # Return results based on format requested
    case "$1" in
        "compact")
            # For status lines - very compact format
            local color=""
            local icon=""
            if [ $violations -gt 0 ]; then
                color="${RED}"
                icon="❌"
            elif [ $warnings -gt 0 ]; then
                color="${YELLOW}"
                icon="⚠️"
            else
                color="${GREEN}"
                icon="✅"
            fi

            local issues=$((violations + warnings))
            echo -e "${color}${icon}${score}%${RESET}${color}(${issues})${RESET}"
            ;;
        "badge")
            # For status badges - medium format
            local status_color=""
            local status_text=""
            if [ $violations -gt 0 ]; then
                status_color="${RED}"
                status_text="FAIL"
            elif [ $warnings -gt 0 ]; then
                status_color="${YELLOW}"
                status_text="WARN"
            else
                status_color="${GREEN}"
                status_text="PASS"
            fi

            echo -e "${CYAN}ChittyCheck:${RESET} ${status_color}${status_text} ${score}%${RESET} ${CYAN}(${violations}v/${warnings}w)${RESET}"
            ;;
        "full")
            # Full status report
            echo "ChittyCheck Status:"
            echo "  Compliance: $score%"
            echo "  Violations: $violations"
            echo "  Warnings: $warnings"
            echo "  Passed: $passed"
            echo "  Issues to fix: $((violations + warnings))"

            if [ ${#critical_violations[@]} -gt 0 ]; then
                echo "  Critical issues:"
                for violation in "${critical_violations[@]}"; do
                    echo "    • $violation"
                done
            fi
            ;;
        *)
            # Default: just the percentage and issue count
            echo "${score}% (${violations}v/${warnings}w)"
            ;;
    esac
}

# If called directly, show full status
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    chittycheck_status "full"
fi