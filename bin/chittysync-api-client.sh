#!/bin/bash
#
# ChittySync API Client
# Reusable client for ChittySync Hub API endpoints
#

# Configuration
CHITTYSYNC_API="${CHITTYSYNC_API:-https://gateway.chitty.cc/api/todos}"
CHITTY_ID_TOKEN="${CHITTY_ID_TOKEN:-mcp_auth_9b69455f5f799a73f16484eb268aea50}"

# API client functions

# Health check
api_health() {
    curl -s "${CHITTYSYNC_API}/health"
}

# List all sessions
api_list_sessions() {
    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        "${CHITTYSYNC_API}?platform=claude-code"
}

# List todos with filters
api_list_todos() {
    local platform="$1"
    local status="$2"
    local limit="${3:-100}"

    local url="${CHITTYSYNC_API}?"
    [ -n "$platform" ] && url="${url}platform=${platform}&"
    [ -n "$status" ] && url="${url}status=${status}&"
    url="${url}limit=${limit}"

    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" "$url"
}

# Get single todo
api_get_todo() {
    local id="$1"
    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        "${CHITTYSYNC_API}/${id}"
}

# Bulk sync
api_bulk_sync() {
    local json_file="$1"
    curl -s -X POST \
        -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "@${json_file}" \
        "${CHITTYSYNC_API}/sync"
}

# Get updates since timestamp
api_todos_since() {
    local timestamp="$1"
    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        "${CHITTYSYNC_API}/since/${timestamp}"
}

# List branches (Phase 2.1)
api_list_branches() {
    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        "${CHITTYSYNC_API}/branches"
}

# List conflicts (Phase 2.1)
api_list_conflicts() {
    local resolved="${1:-false}"
    curl -s -H "Authorization: Bearer ${CHITTY_ID_TOKEN}" \
        "${CHITTYSYNC_API}/conflicts?resolved=${resolved}"
}

# Helper: Parse JSON field
parse_json() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"${field}\":[^,}]*" | sed 's/.*://;s/"//g'
}

# Helper: Count JSON array items
count_json_items() {
    local json="$1"
    echo "$json" | grep -o '"id":' | wc -l | tr -d ' '
}

# Export functions for use in main script
export -f api_health
export -f api_list_sessions
export -f api_list_todos
export -f api_get_todo
export -f api_bulk_sync
export -f api_todos_since
export -f api_list_branches
export -f api_list_conflicts
export -f parse_json
export -f count_json_items
