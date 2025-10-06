#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const ChittyIDClient = require("@chittyos/chittyid-client").default;

class SessionManager {
  constructor(config = {}) {
    this.baseDir = config.baseDir || path.join(process.cwd(), ".sync");
    this.sessionsDir = path.join(this.baseDir, "sessions");
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
    this.sessionId = await this.generateSessionId();
    this.sessionData = {
      id: this.sessionId,
      name: name || `session-${this.sessionId.slice(0, 8)}`,
      pid: process.pid,
      hostname: require("os").hostname(),
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: "active",
      metadata: metadata,
      tasks: [],
      locks: [],
    };

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(this.sessionData, null, 2));

    this.startHeartbeat();

    process.on("exit", () => this.unregisterSession());
    process.on("SIGINT", () => this.unregisterSession());
    process.on("SIGTERM", () => this.unregisterSession());

    return this.sessionData;
  }

  async unregisterSession() {
    if (!this.sessionId) return;

    this.stopHeartbeat();

    try {
      const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
      const data = JSON.parse(await fs.readFile(sessionFile, "utf8"));
      data.status = "terminated";
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
      console.error("Error unregistering session:", error);
    }
  }

  async getActiveSessions() {
    const sessions = [];
    const files = await fs.readdir(this.sessionsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const sessionFile = path.join(this.sessionsDir, file);
        const data = JSON.parse(await fs.readFile(sessionFile, "utf8"));

        const isActive =
          data.status === "active" &&
          Date.now() - data.lastHeartbeat < this.sessionTimeout;

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
      throw new Error("No active session");
    }

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);

    try {
      const data = JSON.parse(await fs.readFile(sessionFile, "utf8"));
      Object.assign(data, updates);
      data.lastUpdate = Date.now();
      await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));
      this.sessionData = data;
      return data;
    } catch (error) {
      console.error("Error updating session:", error);
      throw error;
    }
  }

  async claimTask(taskId) {
    if (!this.sessionId) {
      throw new Error("No active session");
    }

    const taskLockFile = path.join(
      this.baseDir,
      "locks",
      `task-${taskId}.lock`,
    );
    await fs.mkdir(path.dirname(taskLockFile), { recursive: true });

    try {
      await fs.writeFile(
        taskLockFile,
        JSON.stringify({
          sessionId: this.sessionId,
          taskId: taskId,
          timestamp: Date.now(),
        }),
        { flag: "wx" },
      );

      if (!this.sessionData.tasks) {
        this.sessionData.tasks = [];
      }
      this.sessionData.tasks.push(taskId);
      await this.updateSession({ tasks: this.sessionData.tasks });

      return true;
    } catch (error) {
      if (error.code === "EEXIST") {
        const lock = JSON.parse(await fs.readFile(taskLockFile, "utf8"));
        return false;
      }
      throw error;
    }
  }

  async releaseTask(taskId) {
    if (!this.sessionId) return;

    const taskLockFile = path.join(
      this.baseDir,
      "locks",
      `task-${taskId}.lock`,
    );

    try {
      const lock = JSON.parse(await fs.readFile(taskLockFile, "utf8"));
      if (lock.sessionId === this.sessionId) {
        await fs.unlink(taskLockFile);

        if (this.sessionData.tasks) {
          this.sessionData.tasks = this.sessionData.tasks.filter(
            (t) => t !== taskId,
          );
          await this.updateSession({ tasks: this.sessionData.tasks });
        }
      }
    } catch (error) {
      console.error(`Error releasing task ${taskId}:`, error);
    }
  }

  async acquireLock(resource) {
    if (!this.sessionId) {
      throw new Error("No active session");
    }

    const lockFile = path.join(this.baseDir, "locks", `${resource}.lock`);
    await fs.mkdir(path.dirname(lockFile), { recursive: true });

    const maxRetries = 10;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fs.writeFile(
          lockFile,
          JSON.stringify({
            sessionId: this.sessionId,
            resource: resource,
            timestamp: Date.now(),
          }),
          { flag: "wx" },
        );

        if (!this.sessionData.locks) {
          this.sessionData.locks = [];
        }
        this.sessionData.locks.push(resource);
        await this.updateSession({ locks: this.sessionData.locks });

        return true;
      } catch (error) {
        if (error.code === "EEXIST") {
          try {
            const lock = JSON.parse(await fs.readFile(lockFile, "utf8"));
            const sessions = await this.getActiveSessions();
            const lockOwnerActive = sessions.some(
              (s) => s.id === lock.sessionId,
            );

            if (!lockOwnerActive) {
              await fs.unlink(lockFile);
              continue;
            }
          } catch (e) {}

          if (i < maxRetries - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * (i + 1)),
            );
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

    const lockFile = path.join(this.baseDir, "locks", `${resource}.lock`);

    try {
      const lock = JSON.parse(await fs.readFile(lockFile, "utf8"));
      if (lock.sessionId === this.sessionId) {
        await fs.unlink(lockFile);

        if (this.sessionData.locks) {
          this.sessionData.locks = this.sessionData.locks.filter(
            (l) => l !== resource,
          );
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
          console.error("Heartbeat error:", error);
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

  // CHITTYOS POLICY: Session IDs MUST come from id.chitty.cc
  async generateSessionId() {
    // Validate CHITTY_ID_TOKEN environment variable
    if (!process.env.CHITTY_ID_TOKEN) {
      throw new Error(
        "CHITTY_ID_TOKEN environment variable is required for session ID generation. " +
          "Obtain token from: https://id.chitty.cc",
      );
    }

    const chittyIdClient = new ChittyIDClient({
      serviceUrl: "https://id.chitty.cc",
      apiKey: process.env.CHITTY_ID_TOKEN,
    });

    return await chittyIdClient.mint({
      entity: "CONTEXT",
      name: "Session Manager Session",
      metadata: {
        type: "session_manager_session",
        timestamp: Date.now(),
      },
    });
  }

  async cleanupStaleSessions() {
    const files = await fs.readdir(this.sessionsDir).catch(() => []);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const sessionFile = path.join(this.sessionsDir, file);
        const data = JSON.parse(await fs.readFile(sessionFile, "utf8"));

        const isStale =
          data.status === "terminated" ||
          Date.now() - data.lastHeartbeat > this.sessionTimeout * 2;

        if (isStale) {
          await fs.unlink(sessionFile);

          if (data.locks) {
            for (const lock of data.locks) {
              const lockFile = path.join(this.baseDir, "locks", `${lock}.lock`);
              try {
                const lockData = JSON.parse(
                  await fs.readFile(lockFile, "utf8"),
                );
                if (lockData.sessionId === data.id) {
                  await fs.unlink(lockFile);
                }
              } catch (e) {}
            }
          }

          if (data.tasks) {
            for (const task of data.tasks) {
              const taskLockFile = path.join(
                this.baseDir,
                "locks",
                `task-${task}.lock`,
              );
              try {
                const lockData = JSON.parse(
                  await fs.readFile(taskLockFile, "utf8"),
                );
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

module.exports = SessionManager;

if (require.main === module) {
  const manager = new SessionManager();

  (async () => {
    await manager.initialize();

    const command = process.argv[2];

    switch (command) {
      case "register":
        const name = process.argv[3];
        const session = await manager.registerSession(name);
        console.log("Session registered:", session);

        setInterval(() => {}, 1000);
        break;

      case "list":
        const sessions = await manager.getActiveSessions();
        console.log("Active sessions:");
        sessions.forEach((s) => {
          console.log(
            `  - ${s.name} (${s.id.slice(0, 8)}) - Started: ${new Date(s.startTime).toLocaleString()}`,
          );
        });
        break;

      case "cleanup":
        await manager.cleanupStaleSessions();
        console.log("Stale sessions cleaned up");
        break;

      default:
        console.log("Usage: session-manager.js [register|list|cleanup] [name]");
    }
  })();
}
