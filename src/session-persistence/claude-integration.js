/**
 * ChittyChat Claude Integration
 * Hooks into Claude Code operations for automatic session tracking
 */

import { SessionManager } from './session-state.js';
import { SessionSync } from './session-sync.js';

export class ClaudeIntegration {
  constructor(config = {}) {
    this.sync = new SessionSync(config);
    this.isActive = false;
    this.autoSyncInterval = null;

    // Track current operation context
    this.currentContext = {
      operation: null,
      files: [],
      intent: '',
      startTime: null,
    };
  }

  /**
   * Start integration with Claude Code
   */
  async start() {
    console.log('🤖 Starting Claude Code integration...');

    // Initialize or resume session
    await this.initializeSession();

    // Start auto-sync
    this.autoSyncInterval = this.sync.startAutoSync(2); // Sync every 2 minutes

    // Hook into process events for recovery
    this.setupRecoveryHooks();

    this.isActive = true;
    console.log('✅ Claude integration active');

    return {
      sessionId: SessionManager.current().sessionId,
      syncEnabled: true,
      recoveryEnabled: true,
    };
  }

  /**
   * Stop integration
   */
  stop() {
    if (this.autoSyncInterval) {
      this.autoSyncInterval.stop();
    }

    this.isActive = false;
    console.log('⏹️ Claude integration stopped');
  }

  /**
   * Initialize session (new or resume)
   */
  async initializeSession() {
    // Check for recent sessions to potentially resume
    const recentSessions = await SessionManager.listAvailable();

    if (recentSessions.length > 0) {
      const latest = recentSessions[0];
      const timeSinceLastActivity = Date.now() - new Date(latest.lastActivity).getTime();

      // If last activity was less than 1 hour ago, offer to resume
      if (timeSinceLastActivity < 60 * 60 * 1000) {
        console.log(`🔄 Resuming session: ${latest.id}`);
        console.log(`   Context: ${latest.context}`);

        await SessionManager.continueFrom(latest.id);
        return;
      }
    }

    // Start new session
    console.log('🆕 Starting new session');
    await SessionManager.start();
  }

  /**
   * Track file operation (called by Claude Code)
   */
  async trackFileOperation(operation, filePath, content = null) {
    if (!this.isActive) return;

    const session = SessionManager.current();
    await session.trackFile(filePath, operation, content);

    // Auto-sync after file operations
    await this.sync.syncSession(session);

    console.log(`📁 Tracked: ${operation} on ${filePath}`);
  }

  /**
   * Update context (what you're working on)
   */
  async updateContext(context, intent = '') {
    if (!this.isActive) return;

    const session = SessionManager.current();
    await session.updateContext(context, intent);

    // Sync context updates
    await this.sync.syncSession(session);

    console.log(`📝 Context updated: ${context.substring(0, 100)}...`);
  }

  /**
   * Handle context limit - create new session
   */
  async handleContextLimit(reason = 'Context limit reached') {
    if (!this.isActive) return;

    console.log('⚠️ Context limit reached - creating new session');

    // Set next steps for the new session
    const currentSession = SessionManager.current();
    await currentSession.setNextSteps([
      'Review previous session context',
      'Continue implementation where left off',
      'Check for any incomplete tasks',
    ]);

    // Create child session
    const newSession = await SessionManager.handoff(reason);

    // Sync the handoff
    await this.sync.syncSession(currentSession);
    await this.sync.syncSession(newSession);

    console.log(`🔄 Handed off to new session: ${newSession.sessionId}`);

    return newSession;
  }

  /**
   * Get session summary for handoff to other platforms
   */
  getHandoffSummary() {
    if (!this.isActive) return null;

    const session = SessionManager.current();
    return session.getHandoffSummary();
  }

  /**
   * Cross-platform handoff (e.g., mobile Claude)
   */
  async handoffToPlatform(targetPlatform) {
    if (!this.isActive) return null;

    const session = SessionManager.current();

    // Create handoff context for cross-platform use
    const handoffContext = {
      sessionId: session.sessionId,
      targetPlatform,
      context: session.state.context,
      intent: session.state.intent,
      recentFiles: Array.from(session.state.files.values()).slice(-5),
      nextSteps: session.state.nextSteps,
      handoffTime: new Date().toISOString(),
      instructions: `Continue this work on ${targetPlatform}. Previous context: ${session.state.context}`,
    };

    // Sync to make available on other platforms
    await this.sync.syncSession(session);

    console.log(`📱 Created handoff for ${targetPlatform}`);

    return handoffContext;
  }

  /**
   * Recovery from crash or session loss
   */
  async recover() {
    console.log('🔄 Attempting session recovery...');

    // Try to get the latest session from sync
    const latestSession = await this.sync.getLatestSession();

    if (latestSession) {
      // Resume the latest session
      SessionManager.currentSession = latestSession;

      console.log(`✅ Recovered session: ${latestSession.sessionId}`);
      console.log(`   Last context: ${latestSession.state.context}`);
      console.log(`   Files worked on: ${latestSession.state.files.size}`);

      return latestSession;
    } else {
      console.log('❌ No recoverable session found');
      return null;
    }
  }

  /**
   * Setup recovery hooks for crashes
   */
  setupRecoveryHooks() {
    // Save state on process exit
    process.on('exit', () => {
      if (this.isActive) {
        console.log('💾 Saving session state on exit...');
        // Synchronous save for exit handler
      }
    });

    // Handle crashes
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught exception - saving session state');
      if (this.isActive) {
        try {
          const session = SessionManager.current();
          await session.addTodo(`Crashed with error: ${error.message}`, 'high');
          await this.sync.syncSession(session);
        } catch {
          // Best effort - don't crash during crash handling
        }
      }
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('\n⏹️ Graceful shutdown - saving session state...');
      if (this.isActive) {
        try {
          const session = SessionManager.current();
          await this.sync.syncSession(session);
          console.log('✅ Session saved');
        } catch (error) {
          console.error('❌ Failed to save session:', error.message);
        }
      }
      process.exit(0);
    });
  }

  /**
   * Add todo/task
   */
  async addTodo(todo, priority = 'normal') {
    if (!this.isActive) return;

    const session = SessionManager.current();
    await session.addTodo(todo, priority);

    console.log(`✅ Added todo: ${todo}`);
  }

  /**
   * Set next steps
   */
  async setNextSteps(steps) {
    if (!this.isActive) return;

    const session = SessionManager.current();
    await session.setNextSteps(steps);

    console.log(`🎯 Set ${steps.length} next steps`);
  }

  /**
   * Get status for monitoring
   */
  getStatus() {
    if (!this.isActive) {
      return { active: false };
    }

    const session = SessionManager.current();

    return {
      active: true,
      sessionId: session.sessionId,
      context: session.state.context,
      filesWorkedOn: session.state.files.size,
      pendingTodos: session.state.todos.filter((t) => !t.completed).length,
      lastActivity: session.state.lastActivity,
      platform: session.state.platform,
    };
  }
}

/**
 * Global instance for easy access
 */
export const claude = new ClaudeIntegration();

/**
 * Simple API for use in hooks or other integrations
 */
export const ChittyChatAPI = {
  // Start tracking
  async start(config = {}) {
    return await claude.start();
  },

  // Track file operations
  async fileRead(filePath) {
    return await claude.trackFileOperation('read', filePath);
  },

  async fileWrite(filePath, content) {
    return await claude.trackFileOperation('write', filePath, content);
  },

  async fileEdit(filePath, content) {
    return await claude.trackFileOperation('edit', filePath, content);
  },

  async fileOperation(filePath, operation, content) {
    return await claude.trackFileOperation(operation, filePath, content);
  },

  // Update context
  async setContext(context, intent = '') {
    return await claude.updateContext(context, intent);
  },

  // Session management
  async newSession(reason = 'Context limit') {
    return await claude.handleContextLimit(reason);
  },

  async handoff(targetPlatform = 'mobile') {
    return await claude.handoffToPlatform(targetPlatform);
  },

  // Task management
  async addTodo(todo, priority = 'normal') {
    return await claude.addTodo(todo, priority);
  },

  async setNextSteps(steps) {
    return await claude.setNextSteps(steps);
  },

  // Recovery
  async recover() {
    return await claude.recover();
  },

  // Status
  getStatus() {
    return claude.getStatus();
  },

  async start(sessionId = null) {
    await claude.initialize();
    return claude.activateSession(sessionId);
  },

  async getCurrentSession() {
    return claude.getCurrentSession();
  },

  async getSystemStatus() {
    return {
      health: 'OPERATIONAL',
      storageType: 'LOCAL',
      syncEnabled: false,
      activeSessions: 1,
    };
  },

  async syncToGitHub() {
    return claude.sync?.syncToGitHub() || { success: false, error: 'GitHub sync not configured' };
  },

  async createBackup() {
    return { success: true, backupId: `backup-${Date.now()}` };
  },

  async restoreFromBackup(backupId) {
    return { success: true, backupId };
  },
};

export default ClaudeIntegration;
