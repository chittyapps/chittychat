#!/bin/bash
#
# ChittySync API Client Library
# Provides HTTP client functions for all ChittySync Hub endpoints
#

# Configuration
CHITTYSYNC_ENDPOINT="${CHITTYSYNC_ENDPOINT:-https://gateway.chitty.cc/api/todos}"
CHITTY_ID_TOKEN="${CHITTY_ID_TOKEN:-}"

# Load token from environment if not set
if [ -z "$CHITTY_ID_TOKEN" ] && [ -f "$HOME/.chittychat/.env" ]; then
    export $(grep -v '^#' "$HOME/.chittychat/.env" | grep CHITTY_ID_TOKEN | xargs)
fi

# Helper: Make authenticated API request
api_request() {
    local method="$1"
    local path="$2"
    local data="$3"
    local url="${CHITTYSYNC_ENDPOINT}${path}"

    local curl_opts=(
        -X "$method"
        -H "Content-Type: application/json"
        -H "Accept: application/json"
        -s
    )

    if [ -n "$CHITTY_ID_TOKEN" ]; then
        curl_opts+=(-H "Authorization: Bearer $CHITTY_ID_TOKEN")
    fi

    if [ -n "$data" ]; then
        curl_opts+=(-d "$data")
    fi

    curl "${curl_opts[@]}" "$url"
}

# === Health & Status ===

api_health_check() {
    api_request "GET" "/health" ""
}

# === Session Management (Tier 1) ===

api_register_session() {
    local session_id="$1"
    local project_id="$2"
    local project_path="$3"
    local git_branch="${4:-main}"
    local git_commit="${5:-}"
    local platform="${6:-claude-code}"

    local json=$(cat <<EOF
{
  "session_id": "$session_id",
  "project_id": "$project_id",
  "project_path": "$project_path",
  "git_branch": "$git_branch",
  "git_commit": "$git_commit",
  "platform": "$platform"
}
EOF
)

    api_request "POST" "/sessions/register" "$json"
}

api_sync_session() {
    local session_id="$1"
    local project_id="$2"
    local strategy="${3:-timestamp}"

    local json=$(cat <<EOF
{
  "project_id": "$project_id",
  "strategy": "$strategy"
}
EOF
)

    api_request "POST" "/sessions/$session_id/sync" "$json"
}

api_get_session() {
    local session_id="$1"
    api_request "GET" "/sessions/$session_id" ""
}

api_get_project_sessions() {
    local project_id="$1"
    api_request "GET" "/projects/$project_id/sessions" ""
}

api_get_project_canonical() {
    local project_id="$1"
    api_request "GET" "/projects/$project_id/canonical" ""
}

api_end_session() {
    local session_id="$1"
    api_request "POST" "/sessions/$session_id/end" ""
}

# === Project Management (Tier 2) ===

api_consolidate_project() {
    local project_id="$1"
    local force="${2:-false}"

    local json=$(cat <<EOF
{
  "force": $force
}
EOF
)

    api_request "POST" "/projects/$project_id/consolidate" "$json"
}

api_get_canonical_state() {
    local project_id="$1"
    api_request "GET" "/projects/$project_id/canonical-state" ""
}

api_get_project_topics() {
    local project_id="$1"
    api_request "GET" "/projects/$project_id/topics" ""
}

api_get_project_topic_todos() {
    local project_id="$1"
    local topic_id="$2"
    api_request "GET" "/projects/$project_id/topics/$topic_id" ""
}

# === Topic Management (Tier 3) ===

api_list_topics() {
    api_request "GET" "/topics" ""
}

api_get_topic() {
    local topic_id="$1"
    api_request "GET" "/topics/$topic_id" ""
}

api_get_topic_todos() {
    local topic_id="$1"
    local project_id="${2:-}"

    local query=""
    if [ -n "$project_id" ]; then
        query="?project_id=$project_id"
    fi

    api_request "GET" "/topics/$topic_id/todos$query" ""
}

api_get_topic_projects() {
    local topic_id="$1"
    api_request "GET" "/topics/$topic_id/projects" ""
}

api_get_topic_dashboard() {
    local topic_id="$1"
    api_request "GET" "/topics/$topic_id/dashboard" ""
}

api_compare_topics() {
    local topics="$1" # Comma-separated topic IDs
    api_request "GET" "/topics/compare?topics=$topics" ""
}

# === Todo Management (Core) ===

api_list_todos() {
    local platform="${1:-}"
    local status="${2:-}"
    local limit="${3:-100}"

    local query="?limit=$limit"
    [ -n "$platform" ] && query="${query}&platform=$platform"
    [ -n "$status" ] && query="${query}&status=$status"

    api_request "GET" "/$query" ""
}

api_get_todo() {
    local todo_id="$1"
    api_request "GET" "/$todo_id" ""
}

api_create_todo() {
    local content="$1"
    local status="${2:-pending}"
    local platform="${3:-claude-code}"

    local json=$(cat <<EOF
{
  "content": "$content",
  "status": "$status",
  "platform": "$platform"
}
EOF
)

    api_request "POST" "" "$json"
}

api_update_todo() {
    local todo_id="$1"
    local status="$2"

    local json=$(cat <<EOF
{
  "status": "$status"
}
EOF
)

    api_request "PUT" "/$todo_id" "$json"
}

api_delete_todo() {
    local todo_id="$1"
    api_request "DELETE" "/$todo_id" ""
}
