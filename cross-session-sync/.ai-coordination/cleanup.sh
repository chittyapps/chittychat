#!/bin/bash
# Cleanup session on exit

echo "Cleaning up session 46d9ed1e..."

# Stop heartbeat
if [ -f .ai-coordination/sessions/46d9ed1e.pid ]; then
    kill $(cat .ai-coordination/sessions/46d9ed1e.pid) 2>/dev/null
fi

# Update session status
if [ -f .ai-coordination/sessions/46d9ed1e.json ]; then
    jq '.status = "terminated"' .ai-coordination/sessions/46d9ed1e.json > tmp.$$ &&     mv tmp.$$ .ai-coordination/sessions/46d9ed1e.json
fi

# Release all locks
for lock in .ai-coordination/locks/*46d9ed1e*; do
    [ -f "$lock" ] && rm "$lock"
done

# Unclaim tasks
for task in .ai-coordination/tasks/*.lock; do
    if [ -f "$task" ] && grep -q "46d9ed1e" "$task"; then
        rm "$task"
    fi
done

echo "Session 46d9ed1e cleaned up"
