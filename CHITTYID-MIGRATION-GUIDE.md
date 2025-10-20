# ChittyOS Session ChittyID Migration Guide

## Overview

This guide documents the migration from UUID-based session IDs to ChittyID-based session IDs, enforcing the ChittyOS policy that **ALL identifiers must be minted from id.chitty.cc**.

## Background

**Violation Discovered:** Platform Guardian audit identified P0 compliance violation where Claude Code sessions used locally-generated UUIDs instead of ChittyIDs from the central authority service.

**Impact:**
- 74 legacy UUID-based session files in `/Users/nb/.claude/todos/`
- 2 code locations generating session IDs with `crypto.randomBytes()`
- Platform health score: 45/100 (target: 80+/100)

## Migration Steps

### 1. Apply Code Fixes

Apply the automated patch to fix session ID generation:

```bash
cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat

# Review the patch
cat session-chittyid-fixups.patch

# Apply the patch
git apply session-chittyid-fixups.patch

# Verify changes
git diff
```

**Files Modified:**
- `cross-session-sync/src/session-manager.js`
- `src/session-persistence/session-state.js`

**Changes Made:**
- Replaced `crypto.randomBytes()` with `ChittyIDClient.mint()`
- Added CHITTY_ID_TOKEN validation
- Made `generateSessionId()` async
- Added proper error handling

### 2. Install ChittyID Client

Ensure the npm package is installed:

```bash
npm install @chittyos/chittyid-client
```

Verify installation:

```bash
npm list @chittyos/chittyid-client
```

### 3. Configure Environment

Ensure `CHITTY_ID_TOKEN` is set:

```bash
# Check if token exists
echo $CHITTY_ID_TOKEN

# If empty, obtain from id.chitty.cc
# Add to ~/.zshrc or ~/.bashrc:
export CHITTY_ID_TOKEN="mcp_auth_..."
```

Test connectivity:

```bash
curl -H "Authorization: Bearer $CHITTY_ID_TOKEN" https://id.chitty.cc/health
```

### 4. Migrate Legacy Sessions

Run the retroactive migration script:

```bash
# Dry run first (recommended)
./scripts/migrate-legacy-session-ids.sh --dry-run

# Review output, then run actual migration
./scripts/migrate-legacy-session-ids.sh
```

**What it does:**
- Scans `/Users/nb/.claude/todos/` for UUID-based session files
- Mints ChittyIDs for each legacy session via id.chitty.cc
- Creates UUID→ChittyID mapping in `/Users/nb/.chittyos/session-id-mapping.json`
- Creates backup in `/Users/nb/.chittyos/session-migration-backup-*/`
- Generates detailed log

**Output:**
```
════════════════════════════════════════
  LEGACY SESSION MIGRATION REPORT
════════════════════════════════════════
Total sessions found: 74
Successfully migrated: 74
Skipped (already migrated or dry run): 0
Failed migrations: 0

Mapping file: /Users/nb/.chittyos/session-id-mapping.json
Backup directory: /Users/nb/.chittyos/session-migration-backup-...
Log file: /Users/nb/.chittyos/logs/session-migration-...
════════════════════════════════════════
Platform Health Estimate:
  Before: 45/100
  After:  80/100
════════════════════════════════════════
```

### 5. Validate Compliance

Run enhanced ChittyCheck with session rules:

```bash
# Run session-specific rules
./chittycheck-session-rules.sh

# Run full ChittyCheck
./chittycheck-enhanced.sh
```

**Expected Output:**
```
╔═══════════════════════════════════════════╗
║  ChittyCheck Session ChittyID Rules      ║
╚═══════════════════════════════════════════╝

[RULE 1] Session ChittyID Authority
✅ PASS - Session ID Authority (74 ChittyID sessions)

[RULE 2] No Local Session ID Generation
✅ PASS - No local session ID generation patterns detected

[RULE 3] ChittyID Client Usage
✅ PASS - ChittyID Client Package installed
✅ PASS - ChittyID Client import in session-manager.js
✅ PASS - ChittyID Client import in session-state.js

[RULE 4] Session ChittyID Token Validation
✅ PASS - CHITTY_ID_TOKEN is configured
✅ PASS - id.chitty.cc connectivity verified

[RULE 5] Session ID Format Validation
✅ PASS - Session ID format validation present

[RULE 6] Session Migration Status
✅ PASS - All sessions migrated to ChittyIDs (74 total)

════════════════════════════════════════
  SESSION CHITTYID COMPLIANCE REPORT
════════════════════════════════════════
Total checks: 10
Passed: 10
Failed: 0
Warnings: 0

Compliance Score: 100/100 ✅
════════════════════════════════════════
```

### 6. Enable CI/CD Gates

Install git hooks to prevent future violations:

```bash
# Install husky (if not already installed)
npm install --save-dev husky
npx husky install

# Verify pre-commit hook is executable
chmod +x .husky/pre-commit

# Test the hook
git add cross-session-sync/src/session-manager.js
git commit -m "test: verify pre-commit hook"
```

The pre-commit hook will:
- Block commits with `crypto.randomBytes()` in session files
- Block uuid/nanoid imports in session files
- Warn about missing CHITTY_ID_TOKEN validation
- Provide corrective guidance

### 7. Integration Testing

Test the complete workflow:

```bash
# Test 1: Create new session
node -e "
  const SessionState = require('./src/session-persistence/session-state.js').SessionState;
  (async () => {
    const session = new SessionState();
    await session.initialize();
    console.log('Session ID:', session.sessionId);
    console.assert(session.sessionId.startsWith('CTXT_'), 'Must be ChittyID');
  })();
"

# Test 2: Session Manager
node -e "
  const SessionManager = require('./cross-session-sync/src/session-manager.js');
  (async () => {
    const manager = new SessionManager();
    await manager.initialize();
    const session = await manager.registerSession('test');
    console.log('Session ID:', session.id);
    console.assert(session.id.startsWith('CTXT_'), 'Must be ChittyID');
  })();
"

# Test 3: LaunchAgent compatibility
osascript -e 'tell application "System Events" to get name of every process whose name contains "watch_claude_todos"'
```

## Verification Checklist

- [ ] Code patches applied successfully
- [ ] @chittyos/chittyid-client installed and verified
- [ ] CHITTY_ID_TOKEN environment variable configured
- [ ] id.chitty.cc connectivity tested
- [ ] 74 legacy sessions migrated to ChittyIDs
- [ ] UUID→ChittyID mapping file created
- [ ] ChittyCheck session rules pass (100/100)
- [ ] Pre-commit hook installed and tested
- [ ] GitHub Actions workflow enabled
- [ ] Integration tests pass
- [ ] Platform health score improved to 80+/100

## Rollback Procedure

If issues occur, rollback is safe:

```bash
# Restore code from backup
git checkout cross-session-sync/src/session-manager.js
git checkout src/session-persistence/session-state.js

# Restore session files from backup
BACKUP_DIR=$(ls -td /Users/nb/.chittyos/session-migration-backup-* | head -1)
cp -R "$BACKUP_DIR"/* /Users/nb/.claude/todos/

# Remove mapping file
rm /Users/nb/.chittyos/session-id-mapping.json
```

## Troubleshooting

### Issue: CHITTY_ID_TOKEN not found

**Solution:**
```bash
# Obtain token from id.chitty.cc
# Add to shell profile
echo 'export CHITTY_ID_TOKEN="mcp_auth_..."' >> ~/.zshrc
source ~/.zshrc
```

### Issue: id.chitty.cc unreachable

**Solution:**
```bash
# Check network connectivity
curl -I https://id.chitty.cc

# Check DNS resolution
nslookup id.chitty.cc

# Check token validity
curl -H "Authorization: Bearer $CHITTY_ID_TOKEN" https://id.chitty.cc/health
```

### Issue: Migration script fails

**Solution:**
```bash
# Check logs
tail -100 /Users/nb/.chittyos/logs/session-migration-*.log

# Verify prerequisites
./scripts/migrate-legacy-session-ids.sh --dry-run

# Run with increased verbosity
bash -x ./scripts/migrate-legacy-session-ids.sh
```

### Issue: Pre-commit hook blocks legitimate changes

**Solution:**
```bash
# Review the violation
git diff --cached

# If false positive, temporarily bypass (NOT RECOMMENDED)
git commit --no-verify -m "message"

# Better: Fix the code to comply
# Use @chittyos/chittyid-client instead of crypto.randomBytes()
```

## Architecture Changes

### Before (Violating)

```javascript
// session-manager.js:264
generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}
```

### After (Compliant)

```javascript
// session-manager.js:264+
async generateSessionId() {
  if (!process.env.CHITTY_ID_TOKEN) {
    throw new Error('CHITTY_ID_TOKEN required');
  }

  const chittyIdClient = new ChittyIDClient({
    apiKey: process.env.CHITTY_ID_TOKEN,
  });

  return await chittyIdClient.mint({
    entity: 'CONTEXT',
    name: 'Session Manager Session',
    metadata: {
      type: 'session_manager_session',
      timestamp: Date.now(),
    },
  });
}
```

## ChittyID Format

**Valid ChittyID:** `CTXT_<base64_encoded_data>`

**Example:** `CTXT_1759778534_abc123def456`

**Properties:**
- Globally unique across ChittyOS
- Blockchain-anchored for immutability
- Traceable to minting authority (id.chitty.cc)
- Includes metadata for audit trail

## Further Reading

- ChittyOS Framework Documentation: `/Users/nb/.claude/CLAUDE.md`
- ChittyID Service: https://id.chitty.cc
- Platform Guardian Report: (internal)
- ChittyCheck Enhanced: `./chittycheck-enhanced.sh`

## Support

For issues or questions:
- Check logs: `/Users/nb/.chittyos/logs/`
- Review mapping: `/Users/nb/.chittyos/session-id-mapping.json`
- Run diagnostics: `./chittycheck-session-rules.sh`
- Contact: ChittyOS Platform Team

---

**Migration Date:** October 6, 2025
**Version:** 1.0
**Author:** ChittyOS Compliance Engineering Team
