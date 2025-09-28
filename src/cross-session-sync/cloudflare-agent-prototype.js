/**
 * ChittyOS Cross-Session Coordination Agent
 * Cloudflare Durable Object for managing distributed AI session coordination
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route to appropriate Durable Object
    if (url.pathname.startsWith('/coordination')) {
      const id = env.CHITTYOS_COORDINATOR.idFromName('global');
      const stub = env.CHITTYOS_COORDINATOR.get(id);
      return stub.fetch(request);
    }

    return new Response('ChittyOS Coordination Agent', { status: 200 });
  }
};

export class ChittyOSCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.tasks = new Map();
    this.locks = new Map();

    // Initialize WebSocket connections
    this.websockets = new Set();

    // Load persisted state on initialization
    this.initializeState();
  }

  async initializeState() {
    // Load persisted sessions
    const storedSessions = await this.state.storage.list({ prefix: 'session:' });
    for (const [key, value] of storedSessions) {
      const sessionId = key.replace('session:', '');
      this.sessions.set(sessionId, value);
    }

    // Load persisted tasks
    const storedTasks = await this.state.storage.list({ prefix: 'task:' });
    for (const [key, value] of storedTasks) {
      const taskId = key.replace('task:', '');
      this.tasks.set(taskId, value);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrades
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // API endpoints
    switch (url.pathname) {
      case '/coordination/session/register':
        return this.registerSession(request);
      case '/coordination/task/claim':
        return this.claimTask(request);
      case '/coordination/task/complete':
        return this.completeTask(request);
      case '/coordination/status':
        return this.getStatus(request);
      case '/coordination/sync':
        return this.syncState(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  async handleWebSocket(request) {
    const [client, server] = Object.values(new WebSocketPair());

    server.accept();
    this.websockets.add(server);

    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleMessage(message, server);
      } catch (error) {
        server.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    });

    server.addEventListener('close', () => {
      this.websockets.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(message, websocket) {
    const { type, sessionId, data } = message;

    switch (type) {
      case 'heartbeat':
        await this.updateHeartbeat(sessionId);
        break;
      case 'task_claim':
        const claimed = await this.claimTaskForSession(sessionId, data.taskId);
        websocket.send(JSON.stringify({
          type: 'task_claim_response',
          success: claimed,
          taskId: data.taskId
        }));
        break;
      case 'state_update':
        await this.updateSessionState(sessionId, data);
        this.broadcastStateUpdate(sessionId, data);
        break;
    }
  }

  async registerSession(request) {
    try {
      const { sessionId, model, capabilities } = await request.json();

      const session = {
        id: sessionId,
        model,
        capabilities,
        status: 'active',
        lastHeartbeat: Date.now(),
        tasks: [],
        branch: `session-${sessionId}`
      };

      this.sessions.set(sessionId, session);

      // Persist to durable storage
      await this.state.storage.put(`session:${sessionId}`, session);

      this.broadcastToAll({
        type: 'session_registered',
        session
      });

      return new Response(JSON.stringify({
        success: true,
        session,
        availableTasks: Array.from(this.tasks.values()).filter(t => t.status === 'pending')
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async claimTaskForSession(sessionId, taskId) {
    const task = this.tasks.get(taskId);
    const session = this.sessions.get(sessionId);

    if (!task || task.status !== 'pending' || !session) {
      return false;
    }

    // Check if session has capacity
    if (session.tasks.length >= session.capabilities?.maxConcurrentTasks || 2) {
      return false;
    }

    // Atomic claim operation
    task.status = 'claimed';
    task.owner = sessionId;
    task.claimedAt = Date.now();

    session.tasks.push(taskId);

    // Persist updates
    await this.state.storage.put(`task:${taskId}`, task);
    await this.state.storage.put(`session:${sessionId}`, session);

    this.broadcastToAll({
      type: 'task_claimed',
      taskId,
      sessionId,
      task
    });

    return true;
  }

  async claimTask(request) {
    try {
      const { sessionId, taskId } = await request.json();
      const success = await this.claimTaskForSession(sessionId, taskId);

      return new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async completeTask(request) {
    try {
      const { sessionId, taskId, result } = await request.json();

      const task = this.tasks.get(taskId);
      const session = this.sessions.get(sessionId);

      if (!task || task.owner !== sessionId || !session) {
        return new Response(JSON.stringify({ error: 'Invalid task completion' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Complete task
      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;

      // Remove from session
      session.tasks = session.tasks.filter(id => id !== taskId);

      // Persist updates
      await this.state.storage.put(`task:${taskId}`, task);
      await this.state.storage.put(`session:${sessionId}`, session);

      this.broadcastToAll({
        type: 'task_completed',
        taskId,
        sessionId,
        result
      });

      // Check for dependent tasks
      const dependentTasks = Array.from(this.tasks.values())
        .filter(t => t.dependencies?.includes(taskId));

      for (const depTask of dependentTasks) {
        if (this.areAllDependenciesComplete(depTask)) {
          depTask.status = 'pending';
          await this.state.storage.put(`task:${depTask.id}`, depTask);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async getStatus(request) {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active');

    const taskStats = {
      pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      claimed: Array.from(this.tasks.values()).filter(t => t.status === 'claimed').length,
      completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length
    };

    return new Response(JSON.stringify({
      activeSessions: activeSessions.length,
      sessions: activeSessions,
      taskStats,
      lastSync: await this.state.storage.get('lastSync'),
      coordinationActive: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async syncState(request) {
    try {
      const { sessions: incomingSessions, tasks: incomingTasks } = await request.json();

      // Merge state updates
      for (const session of incomingSessions || []) {
        this.sessions.set(session.id, session);
        await this.state.storage.put(`session:${session.id}`, session);
      }

      for (const task of incomingTasks || []) {
        this.tasks.set(task.id, task);
        await this.state.storage.put(`task:${task.id}`, task);
      }

      // Load persisted tasks on startup
      const storedTasks = await this.state.storage.list({ prefix: 'task:' });
      for (const [key, value] of storedTasks) {
        const taskId = key.replace('task:', '');
        this.tasks.set(taskId, value);
      }

      await this.state.storage.put('lastSync', Date.now());

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async updateHeartbeat(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastHeartbeat = Date.now();
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  async updateSessionState(sessionId, stateData) {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, stateData);
      await this.state.storage.put(`session:${sessionId}`, session);
    }
  }

  broadcastToAll(message) {
    const data = JSON.stringify(message);
    this.websockets.forEach(ws => {
      try {
        ws.send(data);
      } catch (error) {
        // Remove broken connections
        this.websockets.delete(ws);
      }
    });
  }

  broadcastStateUpdate(sessionId, data) {
    this.broadcastToAll({
      type: 'state_update',
      sessionId,
      data
    });
  }

  areAllDependenciesComplete(task) {
    if (!task.dependencies) return true;

    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  async cleanup() {
    // Remove stale sessions (no heartbeat for 10 minutes)
    const staleThreshold = Date.now() - (10 * 60 * 1000);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastHeartbeat < staleThreshold) {
        // Release claimed tasks
        for (const taskId of session.tasks) {
          const task = this.tasks.get(taskId);
          if (task && task.status === 'claimed') {
            task.status = 'pending';
            task.owner = null;
            await this.state.storage.put(`task:${taskId}`, task);
          }
        }

        this.sessions.delete(sessionId);
        await this.state.storage.delete(`session:${sessionId}`);
      }
    }
  }
}

// Task management utilities
export function createTask(id, description, priority = 'medium', dependencies = []) {
  return {
    id,
    description,
    priority,
    dependencies,
    status: dependencies.length > 0 ? 'blocked' : 'pending',
    createdAt: Date.now(),
    owner: null
  };
}