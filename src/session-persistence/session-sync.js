/**
 * ChittyChat Session Sync
 * Simple cross-platform synchronization for session state
 */

import { SessionState } from './session-state.js';

export class SessionSync {
  constructor(config = {}) {
    // Simple sync backends
    this.backends = {
      // GitHub as the sync backend (free, reliable, always available)
      github: {
        owner: config.githubOwner || 'chittyos',
        repo: config.githubRepo || 'chittychat-sessions',
        token: config.githubToken || process.env.GITHUB_TOKEN,
        enabled: !!config.githubToken || !!process.env.GITHUB_TOKEN,
      },

      // Local file backup (always available)
      local: {
        enabled: true,
        path: config.localSyncPath || '/Users/nb/.claude/sessions/.sync',
      },
    };

    this.octokit = null;
    if (this.backends.github.enabled) {
      import('@octokit/rest').then(({ Octokit }) => {
        this.octokit = new Octokit({
          auth: this.backends.github.token,
          userAgent: 'ChittyChat/1.0.0',
        });
      });
    }
  }

  /**
   * Sync session to all available backends
   */
  async syncSession(session) {
    const results = {};

    // Always sync locally first (fastest, most reliable)
    results.local = await this.syncToLocal(session);

    // Sync to GitHub if available
    if (this.backends.github.enabled && this.octokit) {
      try {
        results.github = await this.syncToGitHub(session);
      } catch (error) {
        console.warn('GitHub sync failed:', error.message);
        results.github = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Sync to local file system (immediate backup)
   */
  async syncToLocal(session) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const syncDir = this.backends.local.path;
      await fs.mkdir(syncDir, { recursive: true });

      const sessionFile = path.join(syncDir, `${session.sessionId}.json`);
      const syncData = {
        session: session.state,
        lastSync: new Date().toISOString(),
        syncSource: 'local',
      };

      await fs.writeFile(sessionFile, JSON.stringify(syncData, null, 2));

      return { success: true, location: sessionFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync to GitHub (cross-platform access)
   */
  async syncToGitHub(session) {
    const { owner, repo } = this.backends.github;
    const filePath = `sessions/${session.sessionId}.json`;

    const syncData = {
      session: session.state,
      lastSync: new Date().toISOString(),
      syncSource: 'github',
      platform: session.state.platform,
    };

    try {
      // Check if file exists
      let existingFile;
      try {
        existingFile = await this.octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
        });
      } catch {
        // File doesn't exist, will create
      }

      // Create or update file
      const content = Buffer.from(JSON.stringify(syncData, null, 2)).toString('base64');

      await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `Sync session ${session.sessionId} from ${session.state.platform}`,
        content,
        sha: existingFile?.data?.sha,
      });

      return {
        success: true,
        location: `https://github.com/${owner}/${repo}/blob/main/${filePath}`,
      };
    } catch (error) {
      throw new Error(`GitHub sync failed: ${error.message}`);
    }
  }

  /**
   * Load session from sync backends
   */
  async loadSession(sessionId) {
    // Try GitHub first (most up-to-date)
    if (this.backends.github.enabled && this.octokit) {
      try {
        const githubSession = await this.loadFromGitHub(sessionId);
        if (githubSession) {
          console.log(`📥 Loaded session from GitHub: ${sessionId}`);
          return githubSession;
        }
      } catch (error) {
        console.warn('GitHub load failed:', error.message);
      }
    }

    // Fall back to local
    try {
      const localSession = await this.loadFromLocal(sessionId);
      if (localSession) {
        console.log(`📁 Loaded session from local: ${sessionId}`);
        return localSession;
      }
    } catch (error) {
      console.warn('Local load failed:', error.message);
    }

    return null;
  }

  /**
   * Load from GitHub
   */
  async loadFromGitHub(sessionId) {
    const { owner, repo } = this.backends.github;
    const filePath = `sessions/${sessionId}.json`;

    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
      });

      const content = Buffer.from(response.data.content, 'base64').toString();
      const syncData = JSON.parse(content);

      return this.createSessionFromSyncData(syncData);
    } catch (error) {
      if (error.status === 404) {
        return null; // Session not found
      }
      throw error;
    }
  }

  /**
   * Load from local file system
   */
  async loadFromLocal(sessionId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const sessionFile = path.join(this.backends.local.path, `${sessionId}.json`);
      const content = await fs.readFile(sessionFile, 'utf-8');
      const syncData = JSON.parse(content);

      return this.createSessionFromSyncData(syncData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Session not found
      }
      throw error;
    }
  }

  /**
   * List all synced sessions
   */
  async listSyncedSessions() {
    const sessions = new Set();

    // Get from GitHub
    if (this.backends.github.enabled && this.octokit) {
      try {
        const githubSessions = await this.listFromGitHub();
        githubSessions.forEach((s) => sessions.add(JSON.stringify(s)));
      } catch (error) {
        console.warn('Failed to list GitHub sessions:', error.message);
      }
    }

    // Get from local
    try {
      const localSessions = await this.listFromLocal();
      localSessions.forEach((s) => sessions.add(JSON.stringify(s)));
    } catch (error) {
      console.warn('Failed to list local sessions:', error.message);
    }

    // Deduplicate and parse
    return Array.from(sessions)
      .map((s) => JSON.parse(s))
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  /**
   * List sessions from GitHub
   */
  async listFromGitHub() {
    const { owner, repo } = this.backends.github;

    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'sessions',
      });

      const sessions = [];
      for (const file of response.data) {
        if (file.name.endsWith('.json')) {
          const sessionId = file.name.replace('.json', '');

          // Get basic info without downloading full content
          sessions.push({
            id: sessionId,
            source: 'github',
            lastSync: file.sha, // Use SHA as version identifier
            url: file.download_url,
          });
        }
      }

      return sessions;
    } catch (error) {
      if (error.status === 404) {
        return []; // Sessions directory doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * List sessions from local
   */
  async listFromLocal() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const syncDir = this.backends.local.path;
      const files = await fs.readdir(syncDir);

      const sessions = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const filePath = path.join(syncDir, file);
          const stats = await fs.stat(filePath);

          sessions.push({
            id: sessionId,
            source: 'local',
            lastSync: stats.mtime.toISOString(),
            path: filePath,
          });
        }
      }

      return sessions;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // Sync directory doesn't exist
      }
      throw error;
    }
  }

  /**
   * Create session object from sync data
   */
  createSessionFromSyncData(syncData) {
    const session = new SessionState(syncData.session.id);

    // Restore state
    session.state = {
      ...syncData.session,
      files: new Map(syncData.session.files || []),
    };

    return session;
  }

  /**
   * Auto-sync setup (sync every few minutes)
   */
  startAutoSync(intervalMinutes = 5) {
    // Get current session and sync it
    const syncCurrentSession = async () => {
      try {
        const { SessionManager } = await import('./session-state.js');
        const currentSession = SessionManager.current();

        if (currentSession) {
          await this.syncSession(currentSession);
          console.log(`🔄 Auto-synced session: ${currentSession.sessionId}`);
        }
      } catch (error) {
        console.warn('Auto-sync failed:', error.message);
      }
    };

    // Initial sync
    syncCurrentSession();

    // Set up interval
    const interval = setInterval(syncCurrentSession, intervalMinutes * 60 * 1000);

    console.log(`⏰ Auto-sync enabled: every ${intervalMinutes} minutes`);

    return {
      stop: () => {
        clearInterval(interval);
        console.log('⏹️ Auto-sync stopped');
      },
    };
  }

  /**
   * Cross-platform session discovery
   */
  async discoverSessions(platform = null) {
    const allSessions = await this.listSyncedSessions();

    // Filter by platform if specified
    if (platform) {
      return allSessions.filter((s) => {
        // Load session to check platform
        // For now, just return all - would need to load each to check platform
        return true;
      });
    }

    return allSessions;
  }

  /**
   * Emergency recovery - get the most recent session
   */
  async getLatestSession() {
    const sessions = await this.listSyncedSessions();

    if (sessions.length === 0) {
      return null;
    }

    const latestSessionInfo = sessions[0]; // Already sorted by lastActivity
    return await this.loadSession(latestSessionInfo.id);
  }
}

export default SessionSync;
