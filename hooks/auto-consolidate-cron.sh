#!/bin/bash
#
# Auto-Consolidate Todo System - Cron Job
# Runs every 30 minutes to sync todos across sessions
#

# Load environment
if [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
fi

# Configuration
TODO_DIR="$HOME/.claude/todos"
CONSOLIDATED_FILE="$HOME/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/todos.json"
LOG_FILE="$HOME/.chittychat/todo-consolidation.log"
SYNC_ENDPOINT="${CHITTY_SYNC_ENDPOINT:-https://sync.chitty.cc}"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$CONSOLIDATED_FILE")"

# Log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "=== Starting todo consolidation ==="

# Count session files
SESSION_COUNT=$(find "$TODO_DIR" -name "*-agent-*.json" 2>/dev/null | wc -l | tr -d ' ')
log "Found $SESSION_COUNT session todo files"

# Check if todo-orchestrator exists
if [ ! -f "$HOME/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/src/services/todo-orchestrator.js" ]; then
    log "ERROR: todo-orchestrator.js not found"
    exit 1
fi

# Run consolidation via Node.js
if command -v node >/dev/null 2>&1; then
    log "Running consolidation with Node.js..."

    # Create temporary consolidation script
    TEMP_SCRIPT="/tmp/consolidate-todos-$$$.js"
    cat > "$TEMP_SCRIPT" << 'EOFJS'
const fs = require('fs');
const path = require('path');

const TODO_DIR = process.env.HOME + '/.claude/todos';
const CONSOLIDATED_FILE = process.env.HOME + '/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/todos.json';

// Read all session files
const sessionFiles = fs.readdirSync(TODO_DIR)
    .filter(f => f.match(/.*-agent-.*\.json$/));

const allTodos = [];
const todoMap = new Map();

// Collect all todos
sessionFiles.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(TODO_DIR, file), 'utf8');
        const todos = JSON.parse(content);
        if (Array.isArray(todos)) {
            todos.forEach(todo => {
                const key = todo.content;
                if (!todoMap.has(key)) {
                    todoMap.set(key, todo);
                } else {
                    // Keep the most recent status
                    const existing = todoMap.get(key);
                    if (todo.status === 'completed' && existing.status !== 'completed') {
                        todoMap.set(key, todo);
                    } else if (todo.status === 'in_progress' && existing.status === 'pending') {
                        todoMap.set(key, todo);
                    }
                }
            });
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});

// Convert map to array
const consolidatedTodos = Array.from(todoMap.values());

// Write consolidated file
fs.writeFileSync(CONSOLIDATED_FILE, JSON.stringify(consolidatedTodos, null, 2));

console.log(`Consolidated ${consolidatedTodos.length} unique todos from ${sessionFiles.length} sessions`);
EOFJS

    # Run consolidation
    node "$TEMP_SCRIPT" >> "$LOG_FILE" 2>&1
    RESULT=$?

    # Clean up
    rm -f "$TEMP_SCRIPT"

    if [ $RESULT -eq 0 ]; then
        log "✅ Consolidation completed successfully"
    else
        log "❌ Consolidation failed with exit code $RESULT"
    fi
else
    log "ERROR: Node.js not found"
    exit 1
fi

# Update JSON status file
log "Updating JSON status file..."
STATUS_FILE="$HOME/.chittychat/claude_sync_status.json"
CONSOLIDATED_COUNT=$(jq '. | length' "$CONSOLIDATED_FILE" 2>/dev/null || echo 0)

# Update status file with current metrics
jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   --argjson todos "$CONSOLIDATED_COUNT" \
   --argjson sessions "$SESSION_COUNT" \
   '.last_updated = $timestamp | .metrics.consolidated_todos = $todos | .metrics.session_files = $sessions | .metrics.last_consolidation = $timestamp' \
   "$STATUS_FILE" > "$STATUS_FILE.tmp" && mv "$STATUS_FILE.tmp" "$STATUS_FILE"

log "✅ Updated JSON status (${CONSOLIDATED_COUNT} todos from ${SESSION_COUNT} sessions)"

# Synthesize project coordination file
log "Synthesizing project coordination data..."
PROJECTS_DIR="$HOME/.claude/projects"
COORD_FILE="$HOME/.chittychat/project-coordination.json"

# Create coordination synthesis script
SYNTHESIS_SCRIPT="/tmp/synthesize-coordination-$$$.js"
cat > "$SYNTHESIS_SCRIPT" << 'EOFSYN'
const fs = require('fs');
const path = require('path');

const TODO_DIR = process.env.HOME + '/.claude/todos';
const PROJECTS_DIR = process.env.HOME + '/.claude/projects';
const OUTPUT_FILE = process.env.HOME + '/.chittychat/project-coordination.json';

// Analyze all session todos by project
const projectMap = new Map();

try {
    const sessionFiles = fs.readdirSync(TODO_DIR)
        .filter(f => f.match(/.*-agent-.*\.json$/));

    sessionFiles.forEach(file => {
        try {
            const content = fs.readFileSync(path.join(TODO_DIR, file), 'utf8');
            const todos = JSON.parse(content);

            // Extract session ID and project context
            const sessionId = file.replace(/\.json$/, '');

            // Group todos by likely project (heuristic based on content)
            todos.forEach(todo => {
                const content = todo.content.toLowerCase();
                let project = 'general';

                // Project detection heuristics
                if (content.includes('chittyschema')) project = 'chittyschema';
                else if (content.includes('chittychat')) project = 'chittychat';
                else if (content.includes('chittyrouter')) project = 'chittyrouter';
                else if (content.includes('chittycheck')) project = 'chittycheck';
                else if (content.includes('propertyproof')) project = 'propertyproof';

                if (!projectMap.has(project)) {
                    projectMap.set(project, {
                        project_name: project,
                        sessions: new Set(),
                        todos: [],
                        last_activity: new Date().toISOString()
                    });
                }

                const proj = projectMap.get(project);
                proj.sessions.add(sessionId);
                proj.todos.push({
                    content: todo.content,
                    status: todo.status,
                    session: sessionId,
                    active_form: todo.activeForm
                });
            });
        } catch (e) {
            // Skip invalid files
        }
    });

    // Convert to output format
    const coordination = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        projects: Array.from(projectMap.values()).map(proj => ({
            ...proj,
            sessions: Array.from(proj.sessions),
            session_count: proj.sessions.size,
            todo_count: proj.todos.length,
            active_todos: proj.todos.filter(t => t.status === 'in_progress').length,
            completed_todos: proj.todos.filter(t => t.status === 'completed').length
        }))
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(coordination, null, 2));
    console.log(`Synthesized coordination for ${coordination.projects.length} projects`);

} catch (e) {
    console.error('Synthesis error:', e.message);
    process.exit(1);
}
EOFSYN

# Run synthesis
node "$SYNTHESIS_SCRIPT" >> "$LOG_FILE" 2>&1
rm -f "$SYNTHESIS_SCRIPT"

log "✅ Project coordination synthesized"

# Sync to remote if endpoint is available
if [ -n "$CHITTY_ID_TOKEN" ] && [ -n "$SYNC_ENDPOINT" ]; then
    log "Syncing to remote endpoint: $SYNC_ENDPOINT"

    # Upload consolidated todos
    curl -s -X POST "$SYNC_ENDPOINT/api/v1/todos/sync" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d @"$CONSOLIDATED_FILE" >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        log "✅ Remote sync completed"
    else
        log "⚠️  Remote sync failed (continuing anyway)"
    fi
fi

log "=== Consolidation complete ==="

# Keep log file manageable (last 1000 lines)
tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"

exit 0
