/**
 * ChittyChat Session State Manager
 * Minimal working implementation for cross-session persistence
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class SessionState {
  constructor(sessionId = null) {
    this.sessionId = sessionId || this.generateSessionId();
    this.stateDir = '/Users/nb/.claude/sessions';
    this.sessionFile = path.join(this.stateDir, `${this.sessionId}.json`);

    // Current session state
    this.state = {
      id: this.sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      context: '',
      files: new Map(),
      todos: [],
      intent: '',
      nextSteps: [],
      platform: this.detectPlatform(),
      parentSession: null,
      childSessions: [],
    };
  }

  /**
   * Initialize session - load existing or create new
   */
  async initialize() {
    await this.ensureStateDir();

    // Try to load existing session
    try {
      const data = await fs.readFile(this.sessionFile, 'utf-8');
      const savedState = JSON.parse(data);

      // Convert files Map back from JSON
      this.state = {
        ...savedState,
        files: new Map(savedState.files || []),
      };

      console.log(`📂 Loaded session: ${this.sessionId}`);
    } catch {
      // New session
      await this.save();
      console.log(`🆕 Created session: ${this.sessionId}`);
    }

    return this.state;
  }

  /**
   * Update session context (what you're working on)
   */
  async updateContext(context, intent = '') {
    this.state.context = context;
    this.state.intent = intent;
    this.state.lastActivity = new Date().toISOString();

    await this.save();

    console.log(`📝 Updated context: ${context.substring(0, 100)}...`);
  }

  /**
   * Track file operation
   */
  async trackFile(filePath, operation, content = null) {
    const fileKey = path.resolve(filePath);

    this.state.files.set(fileKey, {
      path: fileKey,
      operation,
      content: content?.substring(0, 1000), // Store first 1000 chars
      timestamp: new Date().toISOString(),
      hash: content ? crypto.createHash('md5').update(content).digest('hex') : null,
    });

    this.state.lastActivity = new Date().toISOString();
    await this.save();

    console.log(`📁 Tracked ${operation}: ${path.basename(filePath)}`);
  }

  /**
   * Add todo/next step
   */
  async addTodo(todo, priority = 'normal') {
    this.state.todos.push({
      text: todo,
      priority,
      added: new Date().toISOString(),
      completed: false,
    });

    await this.save();
    console.log(`✅ Added todo: ${todo}`);
  }

  /**
   * Set next steps for future sessions
   */
  async setNextSteps(steps) {
    this.state.nextSteps = steps.map((step) => ({
      text: step,
      timestamp: new Date().toISOString(),
    }));

    await this.save();
    console.log(`🎯 Set ${steps.length} next steps`);
  }

  /**
   * Create child session (hand off to new session)
   */
  async createChildSession(reason = 'context limit') {
    const childId = this.generateSessionId();

    // Create handoff context
    const handoffContext = {
      parentSession: this.sessionId,
      reason,
      context: this.state.context,
      intent: this.state.intent,
      recentFiles: Array.from(this.state.files.values()).slice(-5),
      pendingTodos: this.state.todos.filter((t) => !t.completed),
      nextSteps: this.state.nextSteps,
      timestamp: new Date().toISOString(),
    };

    // Create child session with handoff context
    const childSession = new SessionState(childId);
    await childSession.initialize();

    childSession.state.parentSession = this.sessionId;
    childSession.state.context = `Continuing from session ${this.sessionId}: ${this.state.context}`;
    childSession.state.intent = this.state.intent;
    childSession.state.todos = [...this.state.todos.filter((t) => !t.completed)];

    // Update parent session
    this.state.childSessions.push(childId);

    await Promise.all([
      this.save(),
      childSession.save(),
      this.saveHandoffContext(childId, handoffContext),
    ]);

    console.log(`🔄 Created child session: ${childId}`);
    return childSession;
  }

  /**
   * Get session summary for handoff
   */
  getHandoffSummary() {
    return {
      sessionId: this.sessionId,
      platform: this.state.platform,
      context: this.state.context,
      intent: this.state.intent,
      filesWorkedOn: Array.from(this.state.files.keys()).length,
      recentFiles: Array.from(this.state.files.values())
        .slice(-3)
        .map((f) => ({ path: f.path, operation: f.operation })),
      pendingTodos: this.state.todos.filter((t) => !t.completed).length,
      nextSteps: this.state.nextSteps,
      lastActivity: this.state.lastActivity,
    };
  }

  /**
   * List all sessions for discovery
   */
  static async listSessions(limit = 10) {
    const stateDir = '/Users/nb/.claude/sessions';

    try {
      const files = await fs.readdir(stateDir);
      const sessions = [];

      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('handoff')) {
          try {
            const data = await fs.readFile(path.join(stateDir, file), 'utf-8');
            const session = JSON.parse(data);
            sessions.push({
              id: session.id,
              platform: session.platform,
              context: session.context?.substring(0, 100),
              lastActivity: session.lastActivity,
              filesCount: session.files?.length || 0,
            });
          } catch {
            // Skip invalid session files
          }
        }
      }

      // Sort by last activity
      sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      return sessions.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Get recent sessions for handoff options
   */
  static async getRecentSessions(maxAge = 24 * 60 * 60 * 1000) {
    const sessions = await SessionState.listSessions(20);
    const cutoff = new Date(Date.now() - maxAge);

    return sessions.filter((s) => new Date(s.lastActivity) > cutoff);
  }

  /**
   * Save current state
   */
  async save() {
    // Convert Map to Array for JSON serialization
    const stateToSave = {
      ...this.state,
      files: Array.from(this.state.files.entries()),
    };

    await fs.writeFile(this.sessionFile, JSON.stringify(stateToSave, null, 2));
  }

  /**
   * Save handoff context for child session
   */
  async saveHandoffContext(childId, context) {
    const handoffFile = path.join(this.stateDir, `handoff-${this.sessionId}-${childId}.json`);
    await fs.writeFile(handoffFile, JSON.stringify(context, null, 2));
  }

  /**
   * Helper methods
   */
  generateSessionId() {
    return `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  detectPlatform() {
    // Simple platform detection
    if (process.env.CLAUDE_CODE) return 'claude-code';
    if (process.env.REPLIT_DB_URL) return 'replit';
    if (typeof window !== 'undefined') return 'web';
    return 'unknown';
  }

  async ensureStateDir() {
    await fs.mkdir(this.stateDir, { recursive: true });
  }
}

/**
 * Global session manager for easy access
 */
export class SessionManager {
  static currentSession = null;

  /**
   * Start or resume a session
   */
  static async start(sessionId = null) {
    this.currentSession = new SessionState(sessionId);
    await this.currentSession.initialize();
    return this.currentSession;
  }

  /**
   * Get current session
   */
  static current() {
    if (!this.currentSession) {
      throw new Error('No active session. Call SessionManager.start() first.');
    }
    return this.currentSession;
  }

  /**
   * Hand off to new session (for context limits)
   */
  static async handoff(reason = 'context limit') {
    if (!this.currentSession) {
      throw new Error('No active session to hand off from.');
    }

    const newSession = await this.currentSession.createChildSession(reason);
    this.currentSession = newSession;
    return newSession;
  }

  /**
   * Continue from existing session
   */
  static async continueFrom(sessionId) {
    this.currentSession = new SessionState(sessionId);
    await this.currentSession.initialize();
    return this.currentSession;
  }

  /**
   * List available sessions to continue
   */
  static async listAvailable() {
    return await SessionState.getRecentSessions();
  }
}

export default SessionState;
