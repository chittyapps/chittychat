#!/bin/bash

# CI Guard: No Direct Model Provider Calls
# Ensures all AI model calls go through ChittyRouter, not direct to providers

echo "🔍 Checking for direct model provider calls..."

# Search for direct provider API calls
VIOLATIONS=$(grep -R "openai\|anthropic\|gemini" . --include="*.py" --include="*.js" --include="*.ts" | grep -v "router-sdk" | grep -v "scripts/ci")

if [ -n "$VIOLATIONS" ]; then
    echo "❌ Direct provider calls found:"
    echo "$VIOLATIONS"
    echo ""
    echo "🚫 All AI model calls must go through ChittyRouter service."
    echo "📖 Use router-sdk instead of direct provider clients."
    exit 1
else
    echo "✅ No direct model provider calls found"
    exit 0
fi