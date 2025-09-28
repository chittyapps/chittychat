/**
 * ChittyOS Cloudflare Agent Client Integration
 * Connects local Claude sessions to the Cloudflare coordination agent
 */

class ChittyOSCloudflareClient {
  constructor(agentUrl = 'wss://chittyos-coordination-agent.workers.dev') {
    this.agentUrl = agentUrl;
    this.sessionId = this.generateSessionId();
    this.websocket = null;
    this.isConnected = false;
    this.heartbeatInterval = null;

    // Local fallback coordination
    this.localCoordination = new LocalCoordination();
    this.useLocalFallback = false;
  }

  generateSessionId() {
    return Math.random().toString(36).substr(2, 8);
  }

  async connect(model = 'claude', capabilities = {}) {
    try {
      // Try Cloudflare Agent first
      await this.connectToAgent(model, capabilities);
    } catch (error) {
      console.warn('Cloudflare Agent unavailable, using local coordination:', error);
      this.useLocalFallback = true;
      await this.localCoordination.initialize();
    }
  }

  async connectToAgent(model, capabilities) {
    // WebSocket connection
    this.websocket = new WebSocket(`${this.agentUrl}/coordination`);

    return new Promise((resolve, reject) => {
      this.websocket.onopen = async () => {
        this.isConnected = true;

        // Register session
        const response = await fetch(`${this.agentUrl.replace('wss:', 'https:').replace('ws:', 'http:')}/coordination/session/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionId,
            model,
            capabilities: {
              maxConcurrentTasks: 2,
              specializations: ['code', 'analysis'],
              ...capabilities
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Session registered:', data.session);
          this.startHeartbeat();
          resolve(data);
        } else {
          reject(new Error('Failed to register session'));
        }
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.websocket.onerror = reject;
      this.websocket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
      };

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  handleMessage(message) {
    const { type } = message;

    switch (type) {
      case 'task_claim_response':
        console.log(`Task claim ${message.success ? 'successful' : 'failed'}:`, message.taskId);
        break;
      case 'task_completed':
        console.log('Task completed by another session:', message);
        break;
      case 'session_registered':
        console.log('New session registered:', message.session);
        break;
      case 'state_update':
        console.log('State update from session:', message.sessionId);
        break;
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.websocket.send(JSON.stringify({
          type: 'heartbeat',
          sessionId: this.sessionId
        }));
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  async claimTask(taskId) {
    if (this.useLocalFallback) {
      return this.localCoordination.claimTask(taskId);
    }

    if (!this.isConnected) {
      throw new Error('Not connected to coordination agent');
    }

    const response = await fetch(`${this.agentUrl.replace('wss:', 'https:').replace('ws:', 'http:')}/coordination/task/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        taskId
      })
    });

    const data = await response.json();
    return data.success;
  }

  async completeTask(taskId, result) {
    if (this.useLocalFallback) {
      return this.localCoordination.completeTask(taskId, result);
    }

    if (!this.isConnected) {
      throw new Error('Not connected to coordination agent');
    }

    const response = await fetch(`${this.agentUrl.replace('wss:', 'https:').replace('ws:', 'http:')}/coordination/task/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        taskId,
        result
      })
    });

    const data = await response.json();
    return data.success;
  }

  async getStatus() {
    if (this.useLocalFallback) {
      return this.localCoordination.getStatus();
    }

    const response = await fetch(`${this.agentUrl.replace('wss:', 'https:').replace('ws:', 'http:')}/coordination/status`);
    return response.json();
  }

  updateState(stateData) {
    if (this.useLocalFallback) {
      return this.localCoordination.updateState(stateData);
    }

    if (this.isConnected) {
      this.websocket.send(JSON.stringify({
        type: 'state_update',
        sessionId: this.sessionId,
        data: stateData
      }));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.websocket) {
      this.websocket.close();
    }
  }
}

// Local coordination fallback
class LocalCoordination {
  constructor() {
    this.coordinationDir = `${process.env.HOME}/.claude/projects/.ai-coordination`;
  }

  async initialize() {
    // Use existing file-based coordination as fallback
    const fs = require('fs').promises;
    await fs.mkdir(`${this.coordinationDir}/sessions`, { recursive: true });
    await fs.mkdir(`${this.coordinationDir}/tasks`, { recursive: true });
    await fs.mkdir(`${this.coordinationDir}/locks`, { recursive: true });
  }

  async claimTask(taskId) {
    // Implement local file-based task claiming
    const fs = require('fs').promises;
    const lockFile = `${this.coordinationDir}/locks/task-${taskId}.lock`;

    try {
      await fs.writeFile(lockFile, JSON.stringify({
        session: this.sessionId,
        time: Date.now(),
        ttl: 300000 // 5 minutes
      }), { flag: 'wx' }); // Fail if exists
      return true;
    } catch (error) {
      return false;
    }
  }

  async completeTask(taskId, result) {
    const fs = require('fs').promises;
    const lockFile = `${this.coordinationDir}/locks/task-${taskId}.lock`;

    try {
      await fs.unlink(lockFile);

      // Log completion
      const eventLog = `${this.coordinationDir}/events.jsonl`;
      await fs.appendFile(eventLog, JSON.stringify({
        event: 'task_completed',
        session: this.sessionId,
        task: taskId,
        result,
        time: Date.now()
      }) + '\n');

      return true;
    } catch (error) {
      return false;
    }
  }

  async getStatus() {
    return {
      coordinationActive: true,
      mode: 'local-fallback',
      activeSessions: 1,
      lastSync: Date.now()
    };
  }

  updateState(stateData) {
    // Local state updates
    console.log('Local state update:', stateData);
  }
}

// Export for use in Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChittyOSCloudflareClient, LocalCoordination };
}

// Example usage
async function initializeCoordination() {
  const client = new ChittyOSCloudflareClient();

  try {
    await client.connect('claude', {
      specializations: ['typescript', 'react', 'coordination']
    });

    // Try to claim a high-priority task
    const taskClaimed = await client.claimTask('sync-001');
    if (taskClaimed) {
      console.log('Successfully claimed sync task');

      // Simulate work
      setTimeout(async () => {
        await client.completeTask('sync-001', {
          status: 'completed',
          details: 'Neon sync implemented'
        });
      }, 5000);
    }

    // Get current status
    const status = await client.getStatus();
    console.log('Coordination status:', status);

  } catch (error) {
    console.error('Coordination initialization failed:', error);
  }
}

// Auto-initialize if running directly
if (typeof window === 'undefined' && require.main === module) {
  initializeCoordination();
}