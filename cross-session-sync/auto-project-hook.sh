#!/bin/bash

# Auto-inject PROJECT-BASED cross-session sync into Claude sessions
# Sessions sync ONLY when working on the SAME ChittyChat project

# Kill old sync systems
pkill -f "start-sync.mjs" 2>/dev/null
pkill -f "start-project-sync.mjs" 2>/dev/null

# Update hook to use project-based sync
cat > ~/.ai-project-hook.js << 'EOF'
// Project-based cross-session sync hook
(function() {
  // Auto-start project sync daemon
  const { spawn } = require('child_process');

  const daemon = spawn('node', [
    '/Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-project-sync.mjs',
    '--daemon'
  ], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CHITTYCHAT_URL: 'http://localhost:5000'
    }
  });

  daemon.unref();

  console.log('✅ Project-based cross-session sync activated');
})();
EOF

# Update shell RC files
for rc in ~/.bashrc ~/.zshrc ~/.profile; do
  if [ -f "$rc" ]; then
    # Remove old hook
    sed -i.bak '/ai-coordination-hook/d' "$rc" 2>/dev/null

    # Add new project hook
    grep -q "ai-project-hook" "$rc" || echo '
# AI Project-Based Cross-Session Sync
export NODE_OPTIONS="--require ~/.ai-project-hook.js"
alias sync-project="node /Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-project-sync.mjs"
alias sync-status="ps aux | grep start-project-sync | grep -v grep"
' >> "$rc"
  fi
done

# Start the project-based sync daemon NOW
nohup node /Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-project-sync.mjs --daemon > ~/.ai-project-sync.log 2>&1 &

echo "✅ Project-based cross-session sync is now active!"
echo "   Sessions will sync ONLY when working on the SAME ChittyChat project"
echo "   Use 'sync-project' command to select projects"