#!/bin/bash

# Real-time Session Sync System
# Tracks active sessions and syncs based on topic and progress

set -euo pipefail

# Configuration
MIGRATION_DIR="/Users/nb/.claude/projects/-/chittychat/migration"
SESSION_STATE_DIR="$MIGRATION_DIR/sessions/active"
SESSION_ARCHIVE_DIR="$MIGRATION_DIR/sessions/archived"
SESSION_METADATA="$MIGRATION_DIR/sessions/metadata.json"
CHECKPOINT_FILE="$MIGRATION_DIR/sessions/.checkpoint"
LOG_FILE="$MIGRATION_DIR/sessions/sync.log"

# Create necessary directories
mkdir -p "$SESSION_STATE_DIR" "$SESSION_ARCHIVE_DIR"

# Logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Get current session info from Claude environment
get_current_session() {
    local session_id="${CLAUDE_SESSION_ID:-unknown}"
    local session_topic="${CLAUDE_SESSION_TOPIC:-general}"
    local session_project="${CLAUDE_PROJECT:-chittychat}"

    echo "{\"id\":\"$session_id\",\"topic\":\"$session_topic\",\"project\":\"$session_project\"}"
}

# Track session progress
track_progress() {
    local session_info=$(get_current_session)
    local session_id=$(echo "$session_info" | jq -r '.id')
    local session_topic=$(echo "$session_info" | jq -r '.topic')
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Create session state file
    local state_file="$SESSION_STATE_DIR/${session_id}.json"

    if [[ -f "$state_file" ]]; then
        # Update existing session
        local current_state=$(cat "$state_file")
        local progress_count=$(echo "$current_state" | jq -r '.progress_count // 0')
        progress_count=$((progress_count + 1))

        jq --arg ts "$timestamp" \
           --arg topic "$session_topic" \
           --argjson count "$progress_count" \
           '. + {
               "last_update": $ts,
               "topic": $topic,
               "progress_count": $count,
               "status": "active"
           }' "$state_file" > "${state_file}.tmp"
        mv "${state_file}.tmp" "$state_file"
    else
        # Create new session tracking
        cat > "$state_file" <<EOF
{
    "session_id": "$session_id",
    "topic": "$session_topic",
    "start_time": "$timestamp",
    "last_update": "$timestamp",
    "progress_count": 1,
    "status": "active",
    "checkpoints": []
}
EOF
    fi

    log "Progress tracked for session $session_id on topic: $session_topic"
}

# Create checkpoint for important progress
create_checkpoint() {
    local description="$1"
    local session_info=$(get_current_session)
    local session_id=$(echo "$session_info" | jq -r '.id')
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    local state_file="$SESSION_STATE_DIR/${session_id}.json"

    if [[ -f "$state_file" ]]; then
        # Add checkpoint to session
        local checkpoint="{\"time\":\"$timestamp\",\"description\":\"$description\"}"
        jq --argjson cp "$checkpoint" '.checkpoints += [$cp]' "$state_file" > "${state_file}.tmp"
        mv "${state_file}.tmp" "$state_file"

        log "Checkpoint created: $description"
    else
        log "Warning: No active session found for checkpoint"
    fi
}

# Sync session data based on topic
sync_by_topic() {
    local topic="$1"
    local source_pattern="${2:-}"

    log "Syncing sessions for topic: $topic"

    # Find all sessions with this topic
    local matching_sessions=$(find "$SESSION_STATE_DIR" -name "*.json" -exec grep -l "\"topic\": \"$topic\"" {} \;)

    if [[ -n "$matching_sessions" ]]; then
        for session_file in $matching_sessions; do
            local session_id=$(basename "$session_file" .json)
            local session_data=$(cat "$session_file")

            # If source pattern provided, sync from source
            if [[ -n "$source_pattern" ]]; then
                # Look for matching source files
                local source_files=$(find /Users/nb/.claude/projects/-/ -path "*$source_pattern*" -name "*$session_id*" 2>/dev/null || true)

                if [[ -n "$source_files" ]]; then
                    for src in $source_files; do
                        local dest_dir="$SESSION_STATE_DIR/$topic"
                        mkdir -p "$dest_dir"
                        cp -p "$src" "$dest_dir/" 2>/dev/null || true
                        log "Synced: $(basename "$src") to topic directory"
                    done
                fi
            fi

            # Update metadata
            echo "$session_data" | jq --arg topic "$topic" '. + {"synced": true}' > "$session_file"
        done
    else
        log "No active sessions found for topic: $topic"
    fi
}

# Monitor for changes in real-time
monitor_realtime() {
    log "Starting real-time session monitoring..."

    # Watch for changes in Claude transcript files
    local transcript_dirs=(
        "/Users/nb/.claude/projects/-Users-nb--claude-projects---chittychat*"
        "/Users/nb/.claude/projects/-/chittychat"
    )

    for dir in "${transcript_dirs[@]}"; do
        if [[ -d "$dir" ]] || compgen -G "$dir" > /dev/null 2>&1; then
            log "Monitoring: $dir"

            # Use fswatch if available, otherwise poll
            if command -v fswatch &> /dev/null; then
                fswatch -r "$dir" | while read change; do
                    log "Change detected: $(basename "$change")"
                    track_progress

                    # Extract topic from file if possible
                    if [[ "$change" == *.jsonl ]]; then
                        local topic=$(tail -1 "$change" 2>/dev/null | jq -r '.topic // "general"' 2>/dev/null || echo "general")
                        sync_by_topic "$topic"
                    fi
                done &
            else
                # Fallback to polling
                while true; do
                    track_progress
                    sleep 30
                done &
            fi
        fi
    done

    log "Monitoring active. Press Ctrl+C to stop."
    wait
}

# Archive completed sessions
archive_session() {
    local session_id="${1:-}"

    if [[ -z "$session_id" ]]; then
        # Archive all inactive sessions
        local inactive_threshold=$(($(date +%s) - 3600)) # 1 hour

        for state_file in "$SESSION_STATE_DIR"/*.json; do
            [[ -f "$state_file" ]] || continue

            local last_update=$(jq -r '.last_update' "$state_file")
            local last_timestamp=$(date -j -f "%Y-%m-%d %H:%M:%S" "$last_update" +%s 2>/dev/null || echo 0)

            if [[ $last_timestamp -lt $inactive_threshold ]]; then
                local sid=$(basename "$state_file" .json)
                log "Archiving inactive session: $sid"
                mv "$state_file" "$SESSION_ARCHIVE_DIR/"
            fi
        done
    else
        # Archive specific session
        if [[ -f "$SESSION_STATE_DIR/${session_id}.json" ]]; then
            mv "$SESSION_STATE_DIR/${session_id}.json" "$SESSION_ARCHIVE_DIR/"
            log "Archived session: $session_id"
        fi
    fi
}

# Generate session summary
generate_summary() {
    local summary_file="$MIGRATION_DIR/sessions/summary.md"

    cat > "$summary_file" <<EOF
# Session Sync Summary
Generated: $(date '+%Y-%m-%d %H:%M:%S')

## Active Sessions
EOF

    for state_file in "$SESSION_STATE_DIR"/*.json; do
        [[ -f "$state_file" ]] || continue

        local session_data=$(cat "$state_file")
        local session_id=$(echo "$session_data" | jq -r '.session_id')
        local topic=$(echo "$session_data" | jq -r '.topic')
        local progress=$(echo "$session_data" | jq -r '.progress_count')
        local checkpoints=$(echo "$session_data" | jq -r '.checkpoints | length')

        cat >> "$summary_file" <<EOF

### Session: $session_id
- **Topic**: $topic
- **Progress Updates**: $progress
- **Checkpoints**: $checkpoints
- **Last Update**: $(echo "$session_data" | jq -r '.last_update')

EOF
    done

    echo "## Archived Sessions" >> "$summary_file"
    echo "Total: $(ls -1 "$SESSION_ARCHIVE_DIR"/*.json 2>/dev/null | wc -l)" >> "$summary_file"

    log "Summary generated: $summary_file"
}

# Main command processing
case "${1:-monitor}" in
    track)
        track_progress
        ;;
    checkpoint)
        create_checkpoint "${2:-Manual checkpoint}"
        ;;
    sync)
        sync_by_topic "${2:-general}" "${3:-}"
        ;;
    archive)
        archive_session "${2:-}"
        ;;
    summary)
        generate_summary
        ;;
    monitor)
        monitor_realtime
        ;;
    *)
        echo "Usage: $0 {track|checkpoint|sync|archive|summary|monitor}"
        echo ""
        echo "Commands:"
        echo "  track              - Track progress for current session"
        echo "  checkpoint [desc]  - Create a checkpoint with description"
        echo "  sync [topic]       - Sync sessions by topic"
        echo "  archive [id]       - Archive completed/inactive sessions"
        echo "  summary            - Generate session summary"
        echo "  monitor            - Start real-time monitoring (default)"
        exit 1
        ;;
esac