#!/bin/bash
# Cleanup session on exit

echo "Cleaning up session 30d2f0c5..."

# Stop heartbeat
if [ -f .ai-coordination/sessions/30d2f0c5.pid ]; then
    kill $(cat .ai-coordination/sessions/30d2f0c5.pid) 2>/dev/null
fi

# Update session status
if [ -f .ai-coordination/sessions/30d2f0c5.json ]; then
    jq '.status = "terminated"' .ai-coordination/sessions/30d2f0c5.json > tmp.$$ &&     mv tmp.$$ .ai-coordination/sessions/30d2f0c5.json
fi

# Release all locks
for lock in .ai-coordination/locks/*30d2f0c5*; do
    [ -f "$lock" ] && rm "$lock"
done

# Unclaim tasks
for task in .ai-coordination/tasks/*.lock; do
    if [ -f "$task" ] && grep -q "30d2f0c5" "$task"; then
        rm "$task"
    fi
done

echo "Session 30d2f0c5 cleaned up"
