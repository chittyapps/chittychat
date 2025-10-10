#!/bin/bash
# Install ChittyOS Sync Aliases

SYNC_CLIENT="/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat/chitty-sync"

# Add to shell RC files
add_aliases() {
    local rc_file="$1"

    if [ -f "$rc_file" ]; then
        # Remove old quarantined aliases
        sed -i.bak '/\.quarantine.*claude-sync/d' "$rc_file"

        # Add new sync aliases
        cat >> "$rc_file" << ALIASES

# ChittyOS Sync Client (sync.chitty.cc)
alias projectsync='$SYNC_CLIENT projectsync'
alias sessionsync='$SYNC_CLIENT sessionsync'
alias topicsync='$SYNC_CLIENT topicsync'
alias syncall='$SYNC_CLIENT syncall'
alias syncstatus='$SYNC_CLIENT status'
ALIASES

        echo "✅ Updated $rc_file"
    fi
}

# Update shell RC files
add_aliases "$HOME/.zshrc"
add_aliases "$HOME/.bashrc"

echo ""
echo "ChittyOS Sync aliases installed!"
echo ""
echo "Reload your shell or run: source ~/.zshrc"
echo ""
echo "Available commands:"
echo "  projectsync  - Sync current project"
echo "  sessionsync  - Register current session"
echo "  topicsync    - Categorize conversations"
echo "  syncall      - Run all sync operations"
echo "  syncstatus   - Show sync status"
