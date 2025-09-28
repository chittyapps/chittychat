/**
 * ChittyChat Session Conflict Detector
 * Detects overlaps and competing developments across parallel sessions
 * Prevents divergent work on the same codebase
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { GitHubOrchestrator } from './github-orchestrator.js';

export class SessionConflictDetector {
  constructor(config = {}) {
    this.sessionDir = '/Users/nb/.claude/sessions';
    this.projectsDir = '/Users/nb/.claude/projects';

    // GitHub orchestrator for conflict resolution
    this.orchestrator = new GitHubOrchestrator(config);

    // Track active sessions and their work
    this.activeSessions = new Map();
    this.fileModifications = new Map();
    this.conflictAlerts = new Map();

    // Conflict detection thresholds
    this.thresholds = {
      fileOverlapWarning: 3, // Files modified in 3+ sessions
      timeWindowMs: 3600000, // 1 hour window for concurrent work
      similarityThreshold: 0.8, // Similarity score for duplicate detection
    };
  }

  /**
   * Monitor all active sessions for conflicts
   */
  async monitorSessions() {
    console.log('👁️ Starting session conflict monitoring...');

    // Scan active sessions
    const sessions = await this.scanActiveSessions();

    // Track modifications per session
    for (const session of sessions) {
      await this.trackSessionModifications(session);
    }

    // Detect conflicts
    const conflicts = await this.detectConflicts();

    // Alert on conflicts
    if (conflicts.length > 0) {
      await this.handleConflicts(conflicts);
    }

    return {
      activeSessions: this.activeSessions.size,
      conflicts: conflicts.length,
      alerts: Array.from(this.conflictAlerts.values()),
    };
  }

  /**
   * Scan for active sessions
   */
  async scanActiveSessions() {
    const sessions = [];

    try {
      const entries = await fs.readdir(this.sessionDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionPath = path.join(this.sessionDir, entry.name);
          const sessionInfo = await this.getSessionInfo(sessionPath);

          if (sessionInfo.isActive) {
            sessions.push({
              id: entry.name,
              path: sessionPath,
              ...sessionInfo,
            });

            this.activeSessions.set(entry.name, sessionInfo);
          }
        }
      }
    } catch (error) {
      console.warn('Could not scan sessions:', error.message);
    }

    // Also check git worktrees for session-based branches
    await this.scanWorktreeSessions();

    return sessions;
  }

  /**
   * Scan git worktrees for session branches
   */
  async scanWorktreeSessions() {
    try {
      const worktrees = execSync('git worktree list --porcelain', {
        cwd: this.projectsDir,
        encoding: 'utf-8',
      }).split('\n\n');

      for (const worktree of worktrees) {
        if (!worktree) continue;

        const lines = worktree.split('\n');
        const worktreePath = lines[0]?.replace('worktree ', '');
        const branch = lines[2]?.replace('branch refs/heads/', '');

        // Check if this is a session branch
        if (branch?.includes('session-') || branch?.includes('claude-')) {
          const sessionId =
            branch.match(/session-([a-z0-9]+)/)?.[1] || branch.match(/claude-([a-z0-9]+)/)?.[1];

          if (sessionId && !this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, {
              type: 'worktree',
              branch,
              path: worktreePath,
              isActive: true,
            });
          }
        }
      }
    } catch {
      // No worktrees or git not available
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo(sessionPath) {
    const info = {
      isActive: false,
      startTime: null,
      lastActivity: null,
      files: [],
      project: null,
    };

    try {
      // Check for session manifest
      const manifestPath = path.join(sessionPath, 'session.json');
      const manifest = await fs
        .readFile(manifestPath, 'utf-8')
        .then(JSON.parse)
        .catch(() => null);

      if (manifest) {
        info.startTime = manifest.startTime;
        info.lastActivity = manifest.lastActivity || manifest.startTime;
        info.project = manifest.project;

        // Consider active if activity within threshold
        const lastActivityTime = new Date(info.lastActivity).getTime();
        info.isActive = Date.now() - lastActivityTime < this.thresholds.timeWindowMs;
      }

      // Scan for modified files
      const files = await this.scanSessionFiles(sessionPath);
      info.files = files;
    } catch (error) {
      console.warn(`Could not get info for ${sessionPath}:`, error.message);
    }

    return info;
  }

  /**
   * Track modifications per session
   */
  async trackSessionModifications(session) {
    for (const file of session.files || []) {
      if (!this.fileModifications.has(file.path)) {
        this.fileModifications.set(file.path, []);
      }

      this.fileModifications.get(file.path).push({
        sessionId: session.id,
        timestamp: file.modified || session.lastActivity,
        type: file.type || 'modify',
        hash: file.hash,
      });
    }
  }

  /**
   * Detect conflicts between sessions
   */
  async detectConflicts() {
    const conflicts = [];

    // Check for file overlap conflicts
    for (const [filePath, modifications] of this.fileModifications) {
      if (modifications.length >= 2) {
        // Multiple sessions modifying the same file
        const sessionIds = [...new Set(modifications.map((m) => m.sessionId))];

        if (sessionIds.length >= 2) {
          conflicts.push({
            type: 'file-overlap',
            severity: sessionIds.length >= this.thresholds.fileOverlapWarning ? 'high' : 'medium',
            file: filePath,
            sessions: sessionIds,
            modifications,
            description: `File modified in ${sessionIds.length} parallel sessions`,
          });
        }
      }
    }

    // Check for competing feature developments
    const competingFeatures = await this.detectCompetingFeatures();
    conflicts.push(...competingFeatures);

    // Check for divergent branches
    const divergentBranches = await this.detectDivergentBranches();
    conflicts.push(...divergentBranches);

    // Check for duplicate implementations
    const duplicates = await this.detectDuplicateWork();
    conflicts.push(...duplicates);

    return conflicts;
  }

  /**
   * Detect competing feature developments
   */
  async detectCompetingFeatures() {
    const conflicts = [];
    const featurePatterns = new Map();

    for (const [sessionId, session] of this.activeSessions) {
      // Extract feature patterns from session work
      const features = await this.extractFeatures(session);

      for (const feature of features) {
        if (!featurePatterns.has(feature.pattern)) {
          featurePatterns.set(feature.pattern, []);
        }
        featurePatterns.get(feature.pattern).push({
          sessionId,
          feature,
          session,
        });
      }
    }

    // Find competing implementations
    for (const [pattern, implementations] of featurePatterns) {
      if (implementations.length >= 2) {
        conflicts.push({
          type: 'competing-feature',
          severity: 'high',
          pattern,
          sessions: implementations.map((i) => i.sessionId),
          description: `Multiple sessions implementing similar feature: ${pattern}`,
          details: implementations,
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect divergent branches
   */
  async detectDivergentBranches() {
    const conflicts = [];

    try {
      // Get all branches
      const branches = execSync('git branch -a', {
        cwd: this.projectsDir,
        encoding: 'utf-8',
      })
        .split('\n')
        .filter((b) => b.trim());

      // Check for divergence
      for (let i = 0; i < branches.length; i++) {
        for (let j = i + 1; j < branches.length; j++) {
          const branch1 = branches[i].trim().replace('* ', '');
          const branch2 = branches[j].trim().replace('* ', '');

          if (this.areBranchesRelated(branch1, branch2)) {
            const divergence = await this.checkBranchDivergence(branch1, branch2);

            if (divergence.isDiverged) {
              conflicts.push({
                type: 'branch-divergence',
                severity: divergence.commits > 10 ? 'high' : 'medium',
                branches: [branch1, branch2],
                divergence,
                description: `Branches have diverged by ${divergence.commits} commits`,
              });
            }
          }
        }
      }
    } catch {
      // Git operations failed
    }

    return conflicts;
  }

  /**
   * Detect duplicate work across sessions
   */
  async detectDuplicateWork() {
    const conflicts = [];
    const codeSignatures = new Map();

    for (const [sessionId, session] of this.activeSessions) {
      const signatures = await this.generateCodeSignatures(session);

      for (const sig of signatures) {
        // Check for similar signatures
        for (const [existingSig, existingSession] of codeSignatures) {
          const similarity = this.calculateSimilarity(sig.hash, existingSig);

          if (similarity >= this.thresholds.similarityThreshold) {
            conflicts.push({
              type: 'duplicate-work',
              severity: similarity > 0.95 ? 'high' : 'medium',
              sessions: [sessionId, existingSession.sessionId],
              similarity,
              description: `Sessions contain ${Math.round(similarity * 100)}% similar code`,
              files: [sig.file, existingSession.file],
            });
          }
        }

        codeSignatures.set(sig.hash, { sessionId, ...sig });
      }
    }

    return conflicts;
  }

  /**
   * Handle detected conflicts
   */
  async handleConflicts(conflicts) {
    console.log(`⚠️ Detected ${conflicts.length} conflicts`);

    for (const conflict of conflicts) {
      console.log(`  ${conflict.severity.toUpperCase()}: ${conflict.description}`);

      // Store alert
      const alertId = crypto.randomBytes(8).toString('hex');
      this.conflictAlerts.set(alertId, {
        id: alertId,
        timestamp: new Date().toISOString(),
        ...conflict,
      });

      // Take action based on severity
      if (conflict.severity === 'high') {
        await this.resolveHighSeverityConflict(conflict);
      } else if (conflict.severity === 'medium') {
        await this.resolveMediumSeverityConflict(conflict);
      }
    }

    // Create GitHub issue for tracking
    await this.createConflictIssue(conflicts);
  }

  /**
   * Resolve high severity conflicts
   */
  async resolveHighSeverityConflict(conflict) {
    switch (conflict.type) {
      case 'file-overlap':
        // Create merge request to consolidate changes
        await this.createMergeRequest(conflict);
        break;

      case 'competing-feature':
        // Alert developers and suggest coordination
        await this.alertDevelopers(conflict);
        break;

      case 'branch-divergence':
        // Suggest rebase or merge strategy
        await this.suggestMergeStrategy(conflict);
        break;

      case 'duplicate-work':
        // Identify primary implementation and archive duplicate
        await this.resolveDuplicateWork(conflict);
        break;
    }
  }

  /**
   * Resolve medium severity conflicts
   */
  async resolveMediumSeverityConflict(conflict) {
    // Log for awareness but don't take immediate action
    await this.logConflict(conflict);

    // Schedule for review
    await this.scheduleReview(conflict);
  }

  /**
   * Create merge request for file overlaps
   */
  async createMergeRequest(conflict) {
    const pr = await this.orchestrator.createReorganizationPR(`conflict-resolution-${Date.now()}`, {
      conflicts: [conflict],
      files: conflict.modifications,
    });

    console.log(`  Created merge request: PR #${pr.number}`);
    return pr;
  }

  /**
   * Alert developers about conflicts
   */
  async alertDevelopers(conflict) {
    // Create notification file
    const alertPath = path.join(this.sessionDir, '.alerts', `conflict-${Date.now()}.json`);

    await fs.mkdir(path.dirname(alertPath), { recursive: true });
    await fs.writeFile(
      alertPath,
      JSON.stringify(
        {
          type: 'conflict-alert',
          conflict,
          timestamp: new Date().toISOString(),
          action: 'Please coordinate with other sessions to avoid duplicate work',
        },
        null,
        2
      )
    );

    console.log(`  Alert created: ${alertPath}`);
  }

  /**
   * Create GitHub issue for conflict tracking
   */
  async createConflictIssue(conflicts) {
    const highSeverity = conflicts.filter((c) => c.severity === 'high');
    const mediumSeverity = conflicts.filter((c) => c.severity === 'medium');

    const issueBody = `
## Session Conflict Report

ChittyChat has detected potential conflicts across parallel sessions.

### Summary
- **Total Conflicts**: ${conflicts.length}
- **High Severity**: ${highSeverity.length}
- **Medium Severity**: ${mediumSeverity.length}

### High Severity Conflicts
${highSeverity
  .map(
    (c) => `
#### ${c.type.replace('-', ' ').toUpperCase()}
- **Description**: ${c.description}
- **Sessions**: ${c.sessions.join(', ')}
- **Action Required**: Immediate coordination needed
`
  )
  .join('\n')}

### Medium Severity Conflicts
${mediumSeverity
  .map(
    (c) => `
- ${c.description} (Sessions: ${c.sessions.join(', ')})`
  )
  .join('\n')}

### Recommended Actions
1. Review overlapping work in affected sessions
2. Coordinate feature development to avoid duplication
3. Consider merging similar implementations
4. Update session boundaries to prevent future conflicts

---
*Generated by ChittyChat Session Conflict Detector*
    `;

    try {
      const issue = await this.orchestrator.createProjectIssue({
        name: 'Session Conflicts',
        metadata: {
          created: new Date().toISOString(),
          type: 'conflict-report',
          conflicts,
        },
      });

      console.log(`  GitHub issue created: #${issue.number}`);
    } catch (error) {
      console.error('  Could not create GitHub issue:', error.message);
    }
  }

  /**
   * Helper functions
   */

  async scanSessionFiles(sessionPath) {
    const files = [];

    try {
      const entries = await fs.readdir(sessionPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(sessionPath, entry.name);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8').catch(() => '');

          files.push({
            path: filePath,
            name: entry.name,
            modified: stats.mtime,
            size: stats.size,
            hash: crypto.createHash('md5').update(content).digest('hex'),
          });
        }
      }
    } catch {
      // Session directory not accessible
    }

    return files;
  }

  async extractFeatures(session) {
    const features = [];

    // Extract from file names and content patterns
    for (const file of session.files || []) {
      // Check for common feature patterns
      const patterns = [
        /feat[ure]*[_-]?([a-z0-9]+)/i,
        /add[_-]?([a-z0-9]+)/i,
        /implement[_-]?([a-z0-9]+)/i,
        /new[_-]?([a-z0-9]+)/i,
      ];

      for (const pattern of patterns) {
        const match = file.name?.match(pattern) || file.path?.match(pattern);
        if (match) {
          features.push({
            pattern: match[1].toLowerCase(),
            file: file.path,
            type: 'feature',
          });
        }
      }
    }

    return features;
  }

  areBranchesRelated(branch1, branch2) {
    // Check if branches are related (same feature, different sessions)
    const b1Parts = branch1.split(/[-_]/);
    const b2Parts = branch2.split(/[-_]/);

    // Check for common parts
    const common = b1Parts.filter((p) => b2Parts.includes(p));

    return (
      common.length >= 2 ||
      (branch1.includes('session') && branch2.includes('session')) ||
      (branch1.includes('claude') && branch2.includes('claude'))
    );
  }

  async checkBranchDivergence(branch1, branch2) {
    try {
      const divergence = execSync(`git rev-list --left-right --count ${branch1}...${branch2}`, {
        cwd: this.projectsDir,
        encoding: 'utf-8',
      }).trim();

      const [ahead, behind] = divergence.split('\t').map(Number);

      return {
        isDiverged: ahead > 0 && behind > 0,
        ahead,
        behind,
        commits: ahead + behind,
      };
    } catch {
      return { isDiverged: false, commits: 0 };
    }
  }

  async generateCodeSignatures(session) {
    const signatures = [];

    for (const file of session.files || []) {
      if (file.hash) {
        signatures.push({
          hash: file.hash,
          file: file.path,
          size: file.size,
        });
      }
    }

    return signatures;
  }

  calculateSimilarity(hash1, hash2) {
    // Simple similarity based on hash comparison
    // In practice, would use more sophisticated comparison
    if (hash1 === hash2) return 1.0;

    // Calculate character-level similarity
    let matches = 0;
    const len = Math.min(hash1.length, hash2.length);

    for (let i = 0; i < len; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }

    return matches / len;
  }

  async suggestMergeStrategy(conflict) {
    const { branches, divergence } = conflict;

    let strategy = '';
    if (divergence.ahead > divergence.behind * 2) {
      strategy = `Rebase ${branches[1]} onto ${branches[0]}`;
    } else if (divergence.behind > divergence.ahead * 2) {
      strategy = `Rebase ${branches[0]} onto ${branches[1]}`;
    } else {
      strategy = `Create merge commit to combine both branches`;
    }

    console.log(`  Suggested strategy: ${strategy}`);

    return strategy;
  }

  async resolveDuplicateWork(conflict) {
    // Identify which implementation to keep
    // For now, keep the one with more recent activity
    console.log(`  Duplicate work detected, suggesting consolidation`);

    // Create consolidation task
    await this.orchestrator.createProjectIssue({
      name: 'Duplicate Work Consolidation',
      metadata: {
        type: 'duplicate-resolution',
        sessions: conflict.sessions,
        similarity: conflict.similarity,
        action: 'consolidate',
      },
    });
  }

  async logConflict(conflict) {
    const logPath = path.join(
      this.sessionDir,
      '.logs',
      `conflicts-${new Date().toISOString().split('T')[0]}.jsonl`
    );

    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, JSON.stringify(conflict) + '\n');
  }

  async scheduleReview(conflict) {
    // Add to review queue
    const reviewPath = path.join(this.sessionDir, '.reviews', `pending-${Date.now()}.json`);

    await fs.mkdir(path.dirname(reviewPath), { recursive: true });
    await fs.writeFile(
      reviewPath,
      JSON.stringify(
        {
          conflict,
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
        null,
        2
      )
    );
  }

  /**
   * Real-time monitoring
   */
  async startRealtimeMonitoring(intervalMs = 60000) {
    console.log('🔄 Starting real-time conflict monitoring...');

    this.monitorInterval = setInterval(async () => {
      const result = await this.monitorSessions();

      if (result.conflicts > 0) {
        console.log(`⚠️ ${result.conflicts} conflicts detected`);
      }
    }, intervalMs);

    // Also watch for file changes
    await this.watchForChanges();
  }

  async watchForChanges() {
    const chokidar = require('chokidar');

    const watcher = chokidar.watch([this.sessionDir, this.projectsDir], {
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    watcher
      .on('change', async (path) => {
        // Quick conflict check on file change
        await this.quickConflictCheck(path);
      })
      .on('add', async (path) => {
        // New file added, check for overlap
        await this.checkNewFileOverlap(path);
      });
  }

  async quickConflictCheck(filePath) {
    // Check if this file is being modified in multiple sessions
    const sessions = [];

    for (const [sessionId, session] of this.activeSessions) {
      if (session.files?.some((f) => f.path === filePath)) {
        sessions.push(sessionId);
      }
    }

    if (sessions.length >= 2) {
      console.log(
        `⚠️ Quick conflict detected: ${filePath} modified in ${sessions.length} sessions`
      );

      // Create immediate alert
      await this.alertDevelopers({
        type: 'immediate-conflict',
        severity: 'high',
        file: filePath,
        sessions,
        description: `File being modified in multiple active sessions`,
      });
    }
  }

  async checkNewFileOverlap(filePath) {
    // Check if similar file exists in other sessions
    const fileName = path.basename(filePath);
    const overlaps = [];

    for (const [sessionId, session] of this.activeSessions) {
      const similar = session.files?.find(
        (f) =>
          path.basename(f.path) === fileName || this.calculateSimilarity(f.path, filePath) > 0.8
      );

      if (similar) {
        overlaps.push({ sessionId, file: similar.path });
      }
    }

    if (overlaps.length > 0) {
      console.log(`⚠️ Potential overlap detected for new file: ${fileName}`);
    }
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      console.log('🛑 Stopped conflict monitoring');
    }
  }
}

export default SessionConflictDetector;
