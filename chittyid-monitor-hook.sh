#!/bin/bash

# ChittyID Monitoring Hook for ChittyOS Sessions
# Monitors ChittyID requests, status, and validation across all active sessions
# Version: 1.0.0

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CLAUDE_PROJECTS_DIR="${HOME}/.claude/projects"
CHITTYID_SERVICE="https://id.chitty.cc"
MONITOR_INTERVAL="${CHITTYID_MONITOR_INTERVAL:-5}" # seconds
LOG_FILE="${HOME}/.claude/chittyid-monitor.log"
STATE_FILE="${HOME}/.claude/chittyid-state.json"

# Initialize state file if not exists
if [ ! -f "$STATE_FILE" ]; then
    echo '{"sessions": {}, "last_check": null, "stats": {"total_requests": 0, "successful": 0, "failed": 0}}' > "$STATE_FILE"
fi

# Logging function
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    case "$level" in
        ERROR)
            echo -e "${RED}[ChittyID Monitor]${NC} ❌ $message" >&2
            ;;
        WARNING)
            echo -e "${YELLOW}[ChittyID Monitor]${NC} ⚠️  $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[ChittyID Monitor]${NC} ✅ $message"
            ;;
        INFO)
            echo -e "${CYAN}[ChittyID Monitor]${NC} ℹ️  $message"
            ;;
        *)
            echo -e "${BLUE}[ChittyID Monitor]${NC} $message"
            ;;
    esac
}

# Function to check ChittyID service status
check_chittyid_service() {
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$CHITTYID_SERVICE" 2>/dev/null || echo "000")

    if [ "$response_code" = "200" ] || [ "$response_code" = "404" ]; then
        echo "ONLINE"
    else
        echo "OFFLINE"
    fi
}

# Function to scan session files for ChittyID references
scan_session_for_chittyids() {
    local session_file="$1"
    local session_id=$(basename "$session_file" .jsonl)

    # Count ChittyID-related activities
    local chittyid_requests=0
    local chittyid_errors=0
    local chittyid_successes=0
    local pending_chittyids=0

    # Scan for ChittyID patterns
    if [ -f "$session_file" ]; then
        # Count various ChittyID patterns
        chittyid_requests=$(grep -c "request_chitty_id\|ChittyID.*request\|chittyid.*request" "$session_file" 2>/dev/null || echo 0)
        chittyid_errors=$(grep -c "ChittyID.*failed\|ChittyID.*error\|Cannot proceed without valid ChittyID" "$session_file" 2>/dev/null || echo 0)
        chittyid_successes=$(grep -c "Received ChittyID\|chitty_id.*CHITTY_" "$session_file" 2>/dev/null || echo 0)
        pending_chittyids=$(grep -c "PENDING_CHITTYID_\|awaiting.*ChittyID" "$session_file" 2>/dev/null || echo 0)

        # Extract actual ChittyIDs
        local valid_chittyids=$(grep -o "CHITTY_[A-Za-z0-9_-]\{20,\}" "$session_file" 2>/dev/null | sort -u | wc -l || echo 0)
    fi

    # Return JSON object
    echo "{
        \"session_id\": \"$session_id\",
        \"requests\": $chittyid_requests,
        \"errors\": $chittyid_errors,
        \"successes\": $chittyid_successes,
        \"pending\": $pending_chittyids,
        \"valid_ids\": $valid_chittyids
    }"
}

# Function to analyze all active sessions
analyze_all_sessions() {
    local total_requests=0
    local total_errors=0
    local total_successes=0
    local total_pending=0
    local active_sessions=0

    log_message "INFO" "Scanning all ChittyOS sessions for ChittyID activity..."

    # Find all session files modified in the last 24 hours
    local session_files=$(find "$CLAUDE_PROJECTS_DIR" -name "*.jsonl" -type f -mtime -1 2>/dev/null)

    if [ -z "$session_files" ]; then
        log_message "WARNING" "No active sessions found in last 24 hours"
        return
    fi

    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}      ChittyID Monitor - Session Analysis Report       ${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}\n"

    # Check service status first
    local service_status=$(check_chittyid_service)
    echo -e "${CYAN}ChittyID Service Status:${NC} "
    if [ "$service_status" = "ONLINE" ]; then
        echo -e "${GREEN}● ONLINE${NC} at $CHITTYID_SERVICE\n"
    else
        echo -e "${RED}● OFFLINE${NC} - Service unavailable\n"
    fi

    echo -e "${CYAN}Active Sessions with ChittyID Activity:${NC}\n"

    # Analyze each session
    while IFS= read -r session_file; do
        if [ -f "$session_file" ]; then
            local session_data=$(scan_session_for_chittyids "$session_file")
            local session_id=$(echo "$session_data" | jq -r '.session_id')
            local requests=$(echo "$session_data" | jq -r '.requests')
            local errors=$(echo "$session_data" | jq -r '.errors')
            local successes=$(echo "$session_data" | jq -r '.successes')
            local pending=$(echo "$session_data" | jq -r '.pending')
            local valid_ids=$(echo "$session_data" | jq -r '.valid_ids')

            # Only show sessions with ChittyID activity
            if [ "$requests" -gt 0 ] || [ "$pending" -gt 0 ] || [ "$valid_ids" -gt 0 ]; then
                active_sessions=$((active_sessions + 1))
                total_requests=$((total_requests + requests))
                total_errors=$((total_errors + errors))
                total_successes=$((total_successes + successes))
                total_pending=$((total_pending + pending))

                # Format session display
                echo -e "${BLUE}Session:${NC} ${session_id:0:8}..."
                echo -e "  📊 Requests: $requests | ✅ Success: $successes | ❌ Errors: $errors"
                echo -e "  ⏳ Pending: $pending | 🆔 Valid IDs: $valid_ids"

                # Show status indicator
                if [ "$errors" -gt 0 ] && [ "$successes" -eq 0 ]; then
                    echo -e "  ${RED}⚠️  Status: Service connection issues${NC}"
                elif [ "$pending" -gt 0 ]; then
                    echo -e "  ${YELLOW}⏳ Status: Awaiting ChittyID service${NC}"
                elif [ "$successes" -gt 0 ]; then
                    echo -e "  ${GREEN}✅ Status: ChittyIDs issued${NC}"
                fi
                echo ""
            fi
        fi
    done <<< "$session_files"

    # Summary statistics
    echo -e "${PURPLE}───────────────────────────────────────────────────────${NC}"
    echo -e "${CYAN}Summary Statistics:${NC}"
    echo -e "  📁 Active Sessions: $active_sessions"
    echo -e "  📨 Total Requests: $total_requests"
    echo -e "  ✅ Successful: $total_successes"
    echo -e "  ❌ Failed: $total_errors"
    echo -e "  ⏳ Pending: $total_pending"

    # Calculate success rate
    if [ "$total_requests" -gt 0 ]; then
        local success_rate=$((total_successes * 100 / total_requests))
        echo -e "  📈 Success Rate: ${success_rate}%"
    fi

    # Recommendations
    echo -e "\n${CYAN}Recommendations:${NC}"
    if [ "$service_status" = "OFFLINE" ]; then
        echo -e "  ${YELLOW}➤${NC} ChittyID service appears offline. Evidence archival will be blocked."
        echo -e "  ${YELLOW}➤${NC} Check service endpoint: $CHITTYID_SERVICE"
    fi

    if [ "$total_pending" -gt 0 ]; then
        echo -e "  ${YELLOW}➤${NC} $total_pending items awaiting ChittyID assignment"
        echo -e "  ${YELLOW}➤${NC} Re-run archival when service is available"
    fi

    if [ "$total_errors" -gt "$total_successes" ]; then
        echo -e "  ${RED}➤${NC} High error rate detected. Review service configuration."
    fi

    echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}\n"

    # Update state file
    local current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    jq --arg time "$current_time" \
       --arg requests "$total_requests" \
       --arg successes "$total_successes" \
       --arg errors "$total_errors" \
       '.last_check = $time |
        .stats.total_requests = ($requests | tonumber) |
        .stats.successful = ($successes | tonumber) |
        .stats.failed = ($errors | tonumber)' \
       "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

    log_message "SUCCESS" "ChittyID monitoring complete: $active_sessions active sessions analyzed"
}

# Function to monitor specific session in real-time
monitor_session() {
    local session_id="$1"
    local session_file=$(find "$CLAUDE_PROJECTS_DIR" -name "${session_id}*.jsonl" -type f 2>/dev/null | head -1)

    if [ -z "$session_file" ]; then
        log_message "ERROR" "Session $session_id not found"
        return 1
    fi

    log_message "INFO" "Monitoring ChittyID activity for session: $session_id"
    echo -e "${GREEN}Monitoring session $session_id for ChittyID activity...${NC}"
    echo -e "Press Ctrl+C to stop monitoring\n"

    while true; do
        local session_data=$(scan_session_for_chittyids "$session_file")
        clear
        echo -e "${PURPLE}═══ ChittyID Real-time Monitor ═══${NC}"
        echo -e "${CYAN}Session:${NC} $session_id"
        echo -e "${CYAN}Time:${NC} $(date '+%Y-%m-%d %H:%M:%S')\n"

        echo "$session_data" | jq '.'

        # Check for new ChittyIDs
        local latest_chittyid=$(tail -100 "$session_file" 2>/dev/null | grep -o "CHITTY_[A-Za-z0-9_-]\{20,\}" | tail -1)
        if [ -n "$latest_chittyid" ]; then
            echo -e "\n${GREEN}Latest ChittyID:${NC} $latest_chittyid"
        fi

        sleep "$MONITOR_INTERVAL"
    done
}

# Main execution
main() {
    case "${1:-analyze}" in
        analyze)
            analyze_all_sessions
            ;;
        monitor)
            if [ -z "${2:-}" ]; then
                echo "Usage: $0 monitor <session-id>"
                exit 1
            fi
            monitor_session "$2"
            ;;
        service)
            local status=$(check_chittyid_service)
            echo -e "${CYAN}ChittyID Service Status:${NC} $status"
            ;;
        clean)
            echo -n > "$LOG_FILE"
            echo '{"sessions": {}, "last_check": null, "stats": {"total_requests": 0, "successful": 0, "failed": 0}}' > "$STATE_FILE"
            log_message "SUCCESS" "Monitor state cleaned"
            ;;
        help)
            echo "ChittyID Monitor Hook - Usage:"
            echo "  $0 analyze    - Analyze all sessions for ChittyID activity"
            echo "  $0 monitor <id> - Monitor specific session in real-time"
            echo "  $0 service    - Check ChittyID service status"
            echo "  $0 clean      - Clear monitor logs and state"
            echo "  $0 help       - Show this help message"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"