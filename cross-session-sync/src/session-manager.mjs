#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SessionManager {
  constructor(config = {}) {
    this.baseDir = config.baseDir || path.join(process.cwd(), '.ai-coordination');
    this.sessionsDir = path.join(this.baseDir, 'sessions');
    this.heartbeatInterval = config.heartbeatInterval || 5000;
    this.sessionTimeout = config.sessionTimeout || 30000;
    this.sessionId = null;
    this.sessionData = null;
    this.heartbeatTimer = null;
  }

  async initialize() {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await this.cleanupStaleSessions();
  }

  async registerSession(name, metadata = {}) {
    this.sessionId = this.generateSessionId();
    this.sessionData = {
      id: this.sessionId,
      name: name || `session-${this.sessionId.slice(0, 8)}`,
      pid: process.pid,
      hostname: os.hostname(),
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: metadata,
      tasks: [],
      locks: []
    };

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(this.sessionData, null, 2));

    this.startHeartbeat();

    process.on('exit', () => this.unregisterSession());
    process.on('SIGINT', () => this.unregisterSession());
    process.on('SIGTERM', () => this.unregisterSession());

    return this.sessionData;
  }

  async unregisterSession() {
    if (!this.sessionId) return;

    this.stopHeartbeat();

    try {
      const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
      const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
      data.status = 'terminated';
      data.endTime = Date.now();
      await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));

      await this.releaseLocks();
      await this.unclaimTasks();

      setTimeout(async () => {
        try {
          await fs.unlink(sessionFile);
        } catch (e) {}
      }, 60000);
    } catch (error) {
      console.error('Error unregistering session:', error);
    }
  }

  async getActiveSessions() {
    const sessions = [];
    const files = await fs.readdir(this.sessionsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const sessionFile = path.join(this.sessionsDir, file);
        const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));

        const isActive =
          data.status === 'active' &&
          (Date.now() - data.lastHeartbeat) < this.sessionTimeout;

        if (isActive) {
          sessions.push(data);
        }
      } catch (error) {
        console.error(`Error reading session ${file}:`, error);
      }
    }

    return sessions;
  }

  async updateSession(updates) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);

    try {
      const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
      Object.assign(data, updates);
      data.lastUpdate = Date.now();
      await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));
      this.sessionData = data;
      return data;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  async claimTask(taskId) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const lockDir = path.join(this.baseDir, 'locks');
    await fs.mkdir(lockDir, { recursive: true });
    const taskLockFile = path.join(lockDir, `task-${taskId}.lock`);

    try {
      await fs.writeFile(taskLockFile, JSON.stringify({
        sessionId: this.sessionId,
        taskId: taskId,
        timestamp: Date.now()
      }), { flag: 'wx' });

      if (!this.sessionData.tasks) {
        this.sessionData.tasks = [];
      }
      this.sessionData.tasks.push(taskId);
      await this.updateSession({ tasks: this.sessionData.tasks });

      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        const lock = JSON.parse(await fs.readFile(taskLockFile, 'utf8'));
        return false;
      }
      throw error;
    }
  }

  async releaseTask(taskId) {
    if (!this.sessionId) return;

    const taskLockFile = path.join(this.baseDir, 'locks', `task-${taskId}.lock`);

    try {
      const lock = JSON.parse(await fs.readFile(taskLockFile, 'utf8'));
      if (lock.sessionId === this.sessionId) {
        await fs.unlink(taskLockFile);

        if (this.sessionData.tasks) {
          this.sessionData.tasks = this.sessionData.tasks.filter(t => t !== taskId);
          await this.updateSession({ tasks: this.sessionData.tasks });
        }
      }
    } catch (error) {
      console.error(`Error releasing task ${taskId}:`, error);
    }
  }

  async acquireLock(resource) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const lockDir = path.join(this.baseDir, 'locks');
    await fs.mkdir(lockDir, { recursive: true });
    const lockFile = path.join(lockDir, `${resource}.lock`);

    const maxRetries = 10;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.writeFile(lockFile, JSON.stringify({
          sessionId: this.sessionId,
          resource: resource,
          timestamp: Date.now()
        }), { flag: 'wx' });

        if (!this.sessionData.locks) {
          this.sessionData.locks = [];
        }
        this.sessionData.locks.push(resource);
        await this.updateSession({ locks: this.sessionData.locks });

        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          try {
            const lock = JSON.parse(await fs.readFile(lockFile, 'utf8'));
            const sessions = await this.getActiveSessions();
            const lockOwnerActive = sessions.some(s => s.id === lock.sessionId);

            if (!lockOwnerActive) {
              await fs.unlink(lockFile);
              continue;
            }
          } catch (e) {}

          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
            continue;
          }
          return false;
        }
        throw error;
      }
    }

    return false;
  }

  async releaseLock(resource) {
    if (!this.sessionId) return;

    const lockFile = path.join(this.baseDir, 'locks', `${resource}.lock`);

    try {
      const lock = JSON.parse(await fs.readFile(lockFile, 'utf8'));
      if (lock.sessionId === this.sessionId) {
        await fs.unlink(lockFile);

        if (this.sessionData.locks) {
          this.sessionData.locks = this.sessionData.locks.filter(l => l !== resource);
          await this.updateSession({ locks: this.sessionData.locks });
        }
      }
    } catch (error) {
      console.error(`Error releasing lock ${resource}:`, error);
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.sessionId) {
        try {
          await this.updateSession({ lastHeartbeat: Date.now() });
        } catch (error) {
          console.error('Heartbeat error:', error);
        }
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async cleanupStaleSessions() {
    try {
      const files = await fs.readdir(this.sessionsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const sessionFile = path.join(this.sessionsDir, file);
          const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));

          const isStale =
            data.status === 'terminated' ||
            (Date.now() - data.lastHeartbeat) > this.sessionTimeout * 2;

          if (isStale) {
            await fs.unlink(sessionFile);

            const lockDir = path.join(this.baseDir, 'locks');
            if (data.locks) {
              for (const lock of data.locks) {
                const lockFile = path.join(lockDir, `${lock}.lock`);
                try {
                  const lockData = JSON.parse(await fs.readFile(lockFile, 'utf8'));
                  if (lockData.sessionId === data.id) {
                    await fs.unlink(lockFile);
                  }
                } catch (e) {}
              }
            }

            if (data.tasks) {
              for (const task of data.tasks) {
                const taskLockFile = path.join(lockDir, `task-${task}.lock`);
                try {
                  const lockData = JSON.parse(await fs.readFile(taskLockFile, 'utf8'));
                  if (lockData.sessionId === data.id) {
                    await fs.unlink(taskLockFile);
                  }
                } catch (e) {}
              }
            }
          }
        } catch (error) {
          console.error(`Error cleaning up session ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }
  }

  async releaseLocks() {
    if (!this.sessionData || !this.sessionData.locks) return;

    for (const lock of this.sessionData.locks) {
      await this.releaseLock(lock);
    }
  }

  async unclaimTasks() {
    if (!this.sessionData || !this.sessionData.tasks) return;

    for (const task of this.sessionData.tasks) {
      await this.releaseTask(task);
    }
  }
}

export default SessionManager;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new SessionManager();

  (async () => {
    await manager.initialize();

    const command = process.argv[2];

    switch (command) {
      case 'register':
        const name = process.argv[3];
        const session = await manager.registerSession(name);
        console.log('Session registered:', session);

        setInterval(() => {}, 1000);
        break;

      case 'list':
        const sessions = await manager.getActiveSessions();
        console.log('Active sessions:');
        sessions.forEach(s => {
          console.log(`  - ${s.name} (${s.id.slice(0, 8)}) - Started: ${new Date(s.startTime).toLocaleString()}`);
        });
        break;

      case 'cleanup':
        await manager.cleanupStaleSessions();
        console.log('Stale sessions cleaned up');
        break;

      default:
        console.log('Usage: session-manager.mjs [register|list|cleanup] [name]');
    }
  })();
}