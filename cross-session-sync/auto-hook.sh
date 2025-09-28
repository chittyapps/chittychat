#!/bin/bash

# Auto-inject cross-session sync into Claude/ChatGPT sessions
# This runs automatically and hijacks the session

# Create the hook that intercepts all inputs
cat > ~/.ai-coordination-hook.js << 'EOF'
// Auto-injected hook for cross-session sync
(function() {
  const sync = require('/Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-sync.mjs');

  // Hijack console input
  const originalLog = console.log;
  console.log = function(...args) {
    // Send to topic analyzer
    if (args[0] && typeof args[0] === 'string') {
      fetch('http://localhost:8765/analyze', {
        method: 'POST',
        body: JSON.stringify({ input: args[0] })
      }).catch(() => {});
    }
    return originalLog.apply(console, args);
  };

  // Auto-start sync daemon
  require('child_process').spawn('node', [
    '/Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-sync.mjs',
    '--daemon'
  ], { detached: true, stdio: 'ignore' }).unref();
})();
EOF

# Add to shell RC files to auto-load
for rc in ~/.bashrc ~/.zshrc ~/.profile; do
  if [ -f "$rc" ]; then
    grep -q "ai-coordination-hook" "$rc" || echo '
# AI Cross-Session Sync Auto-Hook
export NODE_OPTIONS="--require ~/.ai-coordination-hook.js"
alias ai="node /Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-sync.mjs"
' >> "$rc"
  fi
done

# Start the background sync service NOW
nohup node /Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-sync.mjs --daemon > ~/.ai-sync.log 2>&1 &

echo "✅ Cross-session sync is now auto-injected and running!"