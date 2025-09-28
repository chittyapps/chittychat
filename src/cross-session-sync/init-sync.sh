#!/bin/bash

# Cross-Session Sync Initialization Script
# Sets up AI-native coordination by hijacking Claude/GPT functions

set -e

echo "🚀 Initializing Cross-Session Sync System"
echo "========================================="

# Configuration
SESSION_ID=${SESSION_ID:-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-8)}
AI_MODEL=${AI_MODEL:-"claude"}
GITHUB_REPO=${GITHUB_REPO:-$(git remote get-url origin 2>/dev/null || echo "")}

# Create coordination directory structure
echo "📁 Creating coordination directories..."
mkdir -p .ai-coordination/{sessions,tasks,locks,events,cache}

# Initialize session
echo "🔑 Registering session: $SESSION_ID ($AI_MODEL)"
cat > .ai-coordination/sessions/$SESSION_ID.json <<EOF
{
  "id": "$SESSION_ID",
  "model": "$AI_MODEL",
  "pid": $$,
  "startTime": $(date +%s)000,
  "lastHeartbeat": $(date +%s)000,
  "status": "active",
  "tasks": [],
  "locks": [],
  "branch": "session-$SESSION_ID"
}
EOF

# Create session branch if in git repo
if [ -d .git ]; then
    echo "🌿 Creating session branch..."
    git checkout -b session-$SESSION_ID 2>/dev/null || git checkout session-$SESSION_ID
fi

# Setup heartbeat
echo "❤️ Starting heartbeat process..."
(
    while true; do
        if [ -f .ai-coordination/sessions/$SESSION_ID.json ]; then
            jq ".lastHeartbeat = $(date +%s)000" .ai-coordination/sessions/$SESSION_ID.json > tmp.$$ && \
            mv tmp.$$ .ai-coordination/sessions/$SESSION_ID.json
        fi
        sleep 30
    done
) &
HEARTBEAT_PID=$!
echo $HEARTBEAT_PID > .ai-coordination/sessions/$SESSION_ID.pid

# Setup Cloudflare Worker (if configured)
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "☁️ Deploying Cloudflare Worker..."
    cd cloudflare-worker
    npm install
    npx wrangler deploy
    cd ..

    # Register session with worker
    curl -X POST https://cross-session-sync.workers.dev/session/register \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$SESSION_ID\", \"metadata\": {\"model\": \"$AI_MODEL\"}}"
fi

# Setup Neon Database (if configured)
if [ -n "$NEON_DATABASE_URL" ]; then
    echo "🗄️ Initializing Neon database..."
    psql "$NEON_DATABASE_URL" < neon-github-integration/schema.sql

    # Register session in database
    psql "$NEON_DATABASE_URL" -c "
        INSERT INTO sessions (session_name, github_branch, status, metadata)
        VALUES ('$SESSION_ID', 'session-$SESSION_ID', 'active', '{\"model\": \"$AI_MODEL\"}')
    "
fi

# Setup GitHub Actions (if in git repo)
if [ -d .git ] && [ -n "$GITHUB_TOKEN" ]; then
    echo "🐙 Configuring GitHub integration..."

    # Create workflow if doesn't exist
    mkdir -p .github/workflows
    if [ ! -f .github/workflows/coordination-sync.yml ]; then
        cat > .github/workflows/coordination-sync.yml <<'WORKFLOW'
name: Cross-Session Coordination

on:
  push:
    branches: [ session-* ]
  pull_request:
    types: [ opened, synchronize ]
  issue_comment:
    types: [ created ]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Sync Coordination State
        run: |
          echo "Session branch pushed: ${{ github.ref }}"
          # Update coordination state
          curl -X POST ${{ secrets.SYNC_WEBHOOK }} \
            -H "Content-Type: application/json" \
            -d '{"event": "github_push", "branch": "${{ github.ref }}"}'
WORKFLOW
    fi

    # Push session branch
    git add .github/workflows/coordination-sync.yml 2>/dev/null || true
    git commit -m "[SESSION-$SESSION_ID] Initialize coordination" 2>/dev/null || true
    git push -u origin session-$SESSION_ID 2>/dev/null || true
fi

# Setup Notion Integration (if configured)
if [ -n "$NOTION_TOKEN" ]; then
    echo "📝 Setting up Notion dashboard..."
    cd notion-integration
    npm install
    npx tsx notion-sync.ts create-dashboard --session "$SESSION_ID"
    cd ..
fi

# Create coordination manifest if doesn't exist
if [ ! -f COORDINATION_MANIFEST.md ]; then
    echo "📋 Creating coordination manifest..."
    cp cross-session-sync/COORDINATION_MANIFEST.md .
fi

# Setup file watchers for coordination
echo "👁️ Setting up file watchers..."
cat > .ai-coordination/watch.sh <<'WATCH'
#!/bin/bash
# Watch for coordination changes
fswatch -o COORDINATION_MANIFEST.md .ai-coordination/ | while read event; do
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Coordination update detected"
    # Trigger sync hooks here
done
WATCH
chmod +x .ai-coordination/watch.sh

# Create cleanup script
echo "🧹 Creating cleanup script..."
cat > .ai-coordination/cleanup.sh <<CLEANUP
#!/bin/bash
# Cleanup session on exit

echo "Cleaning up session $SESSION_ID..."

# Stop heartbeat
if [ -f .ai-coordination/sessions/$SESSION_ID.pid ]; then
    kill \$(cat .ai-coordination/sessions/$SESSION_ID.pid) 2>/dev/null
fi

# Update session status
if [ -f .ai-coordination/sessions/$SESSION_ID.json ]; then
    jq '.status = "terminated"' .ai-coordination/sessions/$SESSION_ID.json > tmp.\$\$ && \
    mv tmp.\$\$ .ai-coordination/sessions/$SESSION_ID.json
fi

# Release all locks
for lock in .ai-coordination/locks/*$SESSION_ID*; do
    [ -f "\$lock" ] && rm "\$lock"
done

# Unclaim tasks
for task in .ai-coordination/tasks/*.lock; do
    if [ -f "\$task" ] && grep -q "$SESSION_ID" "\$task"; then
        rm "\$task"
    fi
done

echo "Session $SESSION_ID cleaned up"
CLEANUP
chmod +x .ai-coordination/cleanup.sh

# Set up trap for cleanup
trap .ai-coordination/cleanup.sh EXIT

# Display status
echo ""
echo "✅ Cross-Session Sync Initialized!"
echo "=================================="
echo "Session ID: $SESSION_ID"
echo "AI Model: $AI_MODEL"
echo "Coordination Dir: .ai-coordination/"
echo "Branch: session-$SESSION_ID"
echo ""
echo "📌 Quick Commands:"
echo "  View active sessions: ls .ai-coordination/sessions/"
echo "  Check locks: ls .ai-coordination/locks/"
echo "  View events: tail -f .ai-coordination/events.jsonl"
echo "  Cleanup: .ai-coordination/cleanup.sh"
echo ""
echo "🎯 Next Steps:"
echo "1. Read COORDINATION_MANIFEST.md for protocols"
echo "2. Check .ai-coordination/tasks/ for available tasks"
echo "3. Start working with automatic coordination!"
echo ""

# Create initial event
echo "{\"event\":\"session_started\",\"session\":\"$SESSION_ID\",\"model\":\"$AI_MODEL\",\"time\":$(date +%s)000}" >> .ai-coordination/events.jsonl

# Update coordination manifest with session
if [ -f COORDINATION_MANIFEST.md ]; then
    # Add session to the status table
    sed -i.bak '/\*Auto-populated by sessions\*/a\
| '"$SESSION_ID"' | '"$AI_MODEL"' | active | - | '"$(date +%Y-%m-%d\ %H:%M:%S)"' | session-'"$SESSION_ID"' |' COORDINATION_MANIFEST.md
fi

echo "🚀 Session $SESSION_ID is ready for coordination!"