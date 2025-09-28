#!/bin/bash

# ChittyChat Session Migration and Sync Script
# Syncs all sessions from various locations to the migration workspace

set -e

echo "Starting ChittyChat session migration and sync..."
echo "================================================"

# Define base directories
MIGRATION_DIR="/Users/nb/.claude/projects/-/chittychat/migration"
SESSIONS_DIR="${MIGRATION_DIR}/sessions"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${MIGRATION_DIR}/backups/${TIMESTAMP}"

# Create necessary directories
mkdir -p "${SESSIONS_DIR}"
mkdir -p "${BACKUP_DIR}"

# Session source locations
declare -a SESSION_SOURCES=(
    "/Users/nb/.claude/projects/-/chittyos-data/chittychat/cross-session-sync/.ai-coordination/sessions"
    "/Users/nb/.claude/projects/-/chittychat/chittychat/cross-session-sync/.ai-coordination/sessions"
    "/Users/nb/.claude/projects/-/chittychat/sync"
)

# Function to sync sessions from a source
sync_sessions() {
    local source=$1
    local target_name=$(basename $(dirname $(dirname "$source")))

    echo ""
    echo "Syncing from: $source"
    echo "Target: ${SESSIONS_DIR}/${target_name}"

    if [ -d "$source" ]; then
        mkdir -p "${SESSIONS_DIR}/${target_name}"

        # Count sessions
        local count=$(find "$source" -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
        echo "Found $count session files"

        if [ "$count" -gt 0 ]; then
            # Copy sessions preserving structure
            rsync -avh --progress \
                --include="*/" \
                --include="*.json" \
                --include="*.md" \
                --include="*.txt" \
                --exclude="*" \
                "$source/" "${SESSIONS_DIR}/${target_name}/"

            echo "✓ Synced $count files to ${target_name}"
        else
            echo "⚠ No session files found in this location"
        fi
    else
        echo "⚠ Directory not found: $source"
    fi
}

# Main sync process
echo ""
echo "Creating backup of existing migration data..."
if [ -d "${SESSIONS_DIR}" ] && [ "$(ls -A ${SESSIONS_DIR} 2>/dev/null)" ]; then
    cp -r "${SESSIONS_DIR}" "${BACKUP_DIR}/"
    echo "✓ Backup created at: ${BACKUP_DIR}"
else
    echo "No existing data to backup"
fi

echo ""
echo "Starting session synchronization..."
echo "===================================="

# Sync from each source
for source in "${SESSION_SOURCES[@]}"; do
    sync_sessions "$source"
done

# Sync main project sync directory
MAIN_SYNC="/Users/nb/.claude/projects/-/chittychat/sync"
if [ -d "$MAIN_SYNC" ]; then
    echo ""
    echo "Syncing main project sync directory..."
    mkdir -p "${SESSIONS_DIR}/main-sync"
    rsync -avh --progress "$MAIN_SYNC/" "${SESSIONS_DIR}/main-sync/"
    echo "✓ Main sync directory synced"
fi

# Create migration metadata
cat > "${MIGRATION_DIR}/migration-metadata.json" << EOF
{
    "timestamp": "${TIMESTAMP}",
    "date": "$(date)",
    "sources": [
        $(printf '"%s"' "${SESSION_SOURCES[@]}" | sed 's/" "/", "/g')
    ],
    "backup_location": "${BACKUP_DIR}",
    "sessions_location": "${SESSIONS_DIR}"
}
EOF

# Generate summary report
echo ""
echo "Generating migration summary..."
echo "==============================="

TOTAL_FILES=$(find "${SESSIONS_DIR}" -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_DIRS=$(find "${SESSIONS_DIR}" -type d 2>/dev/null | wc -l | tr -d ' ')

cat > "${MIGRATION_DIR}/migration-report.txt" << EOF
ChittyChat Session Migration Report
====================================
Timestamp: ${TIMESTAMP}
Date: $(date)

Summary:
--------
Total Files: ${TOTAL_FILES}
Total Directories: ${TOTAL_DIRS}
Sessions Directory: ${SESSIONS_DIR}
Backup Location: ${BACKUP_DIR}

Source Locations Processed:
---------------------------
EOF

for source in "${SESSION_SOURCES[@]}"; do
    echo "- $source" >> "${MIGRATION_DIR}/migration-report.txt"
done

echo "" >> "${MIGRATION_DIR}/migration-report.txt"
echo "Directory Structure:" >> "${MIGRATION_DIR}/migration-report.txt"
echo "-------------------" >> "${MIGRATION_DIR}/migration-report.txt"
tree -L 3 "${SESSIONS_DIR}" 2>/dev/null >> "${MIGRATION_DIR}/migration-report.txt" || \
    ls -la "${SESSIONS_DIR}" >> "${MIGRATION_DIR}/migration-report.txt"

echo ""
echo "✅ Migration Complete!"
echo "====================="
echo "Total files migrated: ${TOTAL_FILES}"
echo "Sessions location: ${SESSIONS_DIR}"
echo "Report saved to: ${MIGRATION_DIR}/migration-report.txt"
echo "Metadata saved to: ${MIGRATION_DIR}/migration-metadata.json"

# Optional: Start monitoring for changes
echo ""
echo "To monitor for future changes, you can run:"
echo "fswatch -r ${SESSION_SOURCES[@]} | xargs -n1 -I{} echo 'Change detected: {}'"