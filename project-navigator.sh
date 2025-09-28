#!/opt/homebrew/bin/bash

# ChittyOS Project Command Integration
# This mirrors the navigate.sh functionality for the project command

# Source the main navigator
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_ROOT="$(dirname "$SCRIPT_DIR")"

# Debug path resolution
# echo "DEBUG: SCRIPT_DIR=$SCRIPT_DIR"
# echo "DEBUG: ORCHESTRATOR_ROOT=$ORCHESTRATOR_ROOT"
# echo "DEBUG: Looking for navigate.sh at: $ORCHESTRATOR_ROOT/navigate.sh"

if [[ -f "$ORCHESTRATOR_ROOT/navigate.sh" ]]; then
    source "$ORCHESTRATOR_ROOT/navigate.sh"
else
    echo "❌ Error: Main navigator not found at $ORCHESTRATOR_ROOT/navigate.sh"
    # Try absolute path as fallback
    if [[ -f "/Users/nb/.claude/projects/-/navigate.sh" ]]; then
        echo "🔄 Using absolute path fallback..."
        source "/Users/nb/.claude/projects/-/navigate.sh"
    else
        echo "❌ Could not find navigate.sh in any location"
        exit 1
    fi
fi

# Project command function
project() {
    local cmd="$1"

    case "$cmd" in
        "nav"|"navigate"|"menu")
            echo "🚦 Starting ChittyOS Project Navigator..."
            nav
            ;;
        "list"|"ls")
            echo "🎯 ChittyOS Project Portfolio:"
            echo ""
            show_categories
            ;;
        "status")
            echo "📊 Running system status check..."
            ./chittychat/slash-commands-extended.sh status
            ;;
        "health"|"check")
            echo "🔍 Running ChittyCheck validation..."
            ./chittycheck/chittycheck-enhanced.sh
            ;;
        "help"|"--help"|"-h")
            show_project_help
            ;;
        "")
            # No arguments - show interactive menu
            nav
            ;;
        *)
            # Try to match project by name/number
            if [[ "$cmd" =~ ^[0-9]+$ ]] && [[ -n "${PROJECTS[$cmd]}" ]]; then
                execute_project "$cmd"
            else
                # Try to find project by name
                local found=""
                for key in "${!PROJECTS[@]}"; do
                    IFS='|' read -r dir status name desc command <<< "${PROJECTS[$key]}"
                    if [[ "${dir,,}" == "${cmd,,}" ]] || [[ "${name,,}" == *"${cmd,,}"* ]]; then
                        found="$key"
                        break
                    fi
                done

                if [[ -n "$found" ]]; then
                    execute_project "$found"
                else
                    echo "❌ Unknown project or command: $cmd"
                    echo "💡 Use 'project help' for available options"
                fi
            fi
            ;;
    esac
}

show_project_help() {
    echo "🎛️  ChittyOS Project Command Usage:"
    echo ""
    echo "  project                    # Interactive project navigator"
    echo "  project nav               # Same as above"
    echo "  project list              # Show all projects"
    echo "  project status            # System status check"
    echo "  project health            # Run ChittyCheck validation"
    echo "  project [number]          # Launch project by number (1-17)"
    echo "  project [name]            # Launch project by name"
    echo ""
    echo "Examples:"
    echo "  project 1                 # Launch ChittyChat"
    echo "  project chittychat        # Same as above"
    echo "  project chittyrouter      # Launch ChittyRouter"
    echo "  project help              # Show this help"
    echo ""
}

# Export the function for shell use
export -f project

# If sourced with an argument, execute it
if [[ -n "$1" ]]; then
    project "$@"
fi