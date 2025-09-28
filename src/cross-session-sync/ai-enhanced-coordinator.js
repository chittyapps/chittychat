/**
 * AI-Enhanced ChittyOS Coordination System
 * Combines Durable Objects coordination with AI Workers intelligence
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route AI operations to AI Worker
    if (url.pathname.startsWith('/ai/')) {
      return this.handleAIRequest(request, env);
    }

    // Route coordination to Durable Object
    if (url.pathname.startsWith('/coordination')) {
      const id = env.CHITTYOS_COORDINATOR.idFromName('global');
      const stub = env.CHITTYOS_COORDINATOR.get(id);
      return stub.fetch(request);
    }

    return new Response('ChittyOS AI-Enhanced Coordination Agent', { status: 200 });
  },

  async handleAIRequest(request, env) {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/ai/classify-task':
        return this.classifyTask(request, env);
      case '/ai/assign-task':
        return this.intelligentAssignment(request, env);
      case '/ai/resolve-conflict':
        return this.resolveConflict(request, env);
      case '/ai/optimize-queue':
        return this.optimizeTaskQueue(request, env);
      default:
        return new Response('AI endpoint not found', { status: 404 });
    }
  },

  async classifyTask(request, env) {
    try {
      const { task } = await request.json();

      // Use AI to classify task complexity and type
      const detailed = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{
          role: 'system',
          content: `You are a project manager classifying development tasks.
                   Respond with JSON: {"complexity": "simple|medium|complex",
                   "type": "coding|docs|testing|design|analysis",
                   "urgency": "low|medium|high",
                   "estimatedTime": "15min|1h|4h|1day|3days",
                   "requiredSkills": ["skill1", "skill2"],
                   "reasoning": "why this classification"}`
        }, {
          role: 'user',
          content: `Task: ${task.description}\nPriority: ${task.priority}\nDependencies: ${task.dependencies?.join(', ') || 'none'}`
        }]
      });

      return new Response(JSON.stringify({
        taskId: task.id,
        classification: detailed,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async intelligentAssignment(request, env) {
    try {
      const { task, availableSessions } = await request.json();

      // AI-powered session matching
      const assignment = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{
          role: 'system',
          content: `You are an intelligent task assignment system for AI development sessions.
                   Analyze the task and available sessions to make the optimal assignment.
                   Consider: session specializations, current workload, task complexity.
                   Respond with JSON: {"recommendedSession": "sessionId",
                   "confidence": 0.85, "reasoning": "explanation",
                   "alternatives": [{"sessionId": "alt1", "score": 0.7}]}`
        }, {
          role: 'user',
          content: `
TASK TO ASSIGN:
- ID: ${task.id}
- Description: ${task.description}
- Type: ${task.type || 'unknown'}
- Priority: ${task.priority}
- Complexity: ${task.complexity || 'unknown'}

AVAILABLE SESSIONS:
${availableSessions.map(s => `
- ${s.id} (${s.model}):
  Specializations: ${s.capabilities?.specializations?.join(', ') || 'general'}
  Current Tasks: ${s.tasks?.length || 0}/${s.capabilities?.maxConcurrentTasks || 2}
  Status: ${s.status}
`).join('')}

Choose the best session for this task.`
        }]
      });

      return new Response(JSON.stringify({
        taskId: task.id,
        assignment: assignment,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async resolveConflict(request, env) {
    try {
      const { conflictType, sessions, task, context } = await request.json();

      const resolution = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{
          role: 'system',
          content: `You are a conflict resolution system for distributed AI sessions.
                   Analyze conflicts and provide fair, efficient resolutions.
                   Consider: session capabilities, workload balance, task requirements.
                   Respond with JSON: {"resolution": "action", "assignTo": "sessionId",
                   "reasoning": "explanation", "compensationActions": []}`
        }, {
          role: 'user',
          content: `
CONFLICT: ${conflictType}

TASK IN DISPUTE:
${JSON.stringify(task, null, 2)}

COMPETING SESSIONS:
${sessions.map(s => `
- ${s.id}: ${s.model}
  Specializations: ${s.capabilities?.specializations?.join(', ')}
  Current Load: ${s.tasks?.length}/${s.capabilities?.maxConcurrentTasks}
  Recent Activity: ${s.lastAction || 'none'}
`).join('')}

CONTEXT: ${context}

Provide a fair resolution that optimizes overall system efficiency.`
        }]
      });

      return new Response(JSON.stringify({
        conflictId: `conflict-${Date.now()}`,
        resolution: resolution,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async optimizeTaskQueue(request, env) {
    try {
      const { tasks, sessions, metrics } = await request.json();

      const optimization = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages: [{
          role: 'system',
          content: `You are a task queue optimization system. Analyze current tasks and sessions
                   to recommend queue reordering and assignment changes for maximum efficiency.
                   Consider: task dependencies, session specializations, estimated completion times.
                   Respond with JSON: {"recommendations": [{"action": "reorder|reassign|split",
                   "taskId": "id", "details": "explanation"}], "expectedImprovement": "percentage"}`
        }, {
          role: 'user',
          content: `
CURRENT TASK QUEUE:
${tasks.map(t => `
- ${t.id}: ${t.description}
  Status: ${t.status}
  Priority: ${t.priority}
  Dependencies: ${t.dependencies?.join(', ') || 'none'}
  Owner: ${t.owner || 'unassigned'}
`).join('')}

ACTIVE SESSIONS:
${sessions.map(s => `
- ${s.id}: ${s.capabilities?.specializations?.join(', ')}
  Load: ${s.tasks?.length}/${s.capabilities?.maxConcurrentTasks}
`).join('')}

PERFORMANCE METRICS:
Average task completion: ${metrics?.avgCompletionTime || 'unknown'}
Queue wait time: ${metrics?.avgWaitTime || 'unknown'}

Optimize for maximum throughput and minimal wait times.`
        }]
      });

      return new Response(JSON.stringify({
        optimization: optimization,
        timestamp: Date.now(),
        nextReview: Date.now() + (15 * 60 * 1000) // 15 minutes
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// Enhanced Durable Object with AI integration
export class AIEnhancedCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.tasks = new Map();
    this.locks = new Map();
    this.websockets = new Set();
    this.aiEndpoint = '/ai/'; // AI Worker endpoint prefix

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

  // Include essential methods from base coordinator
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

  broadcastToAll(message) {
    const data = JSON.stringify(message);
    this.websockets.forEach(ws => {
      try {
        ws.send(data);
      } catch (error) {
        this.websockets.delete(ws);
      }
    });
  }

  async claimTaskWithAI(sessionId, taskId) {
    const task = this.tasks.get(taskId);
    const session = this.sessions.get(sessionId);

    if (!task || !session) return false;

    // Check if another session has a better claim via AI
    if (task.status === 'pending') {
      const allSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');

      // Ask AI for optimal assignment
      const aiResponse = await fetch(`${this.aiEndpoint}assign-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: task,
          availableSessions: allSessions
        })
      });

      if (aiResponse.ok) {
        const recommendation = await aiResponse.json();
        const recommendedSession = recommendation.assignment?.recommendedSession;

        // If AI recommends a different session and confidence is high
        if (recommendedSession !== sessionId && recommendation.assignment?.confidence > 0.8) {
          // Suggest alternative or queue for recommended session
          this.notifyBetterMatch(sessionId, taskId, recommendedSession, recommendation.assignment.reasoning);
          return false;
        }
      }
    }

    // Proceed with normal claiming if AI approves or is unavailable
    return super.claimTaskForSession(sessionId, taskId);
  }

  async handleConflictWithAI(conflictType, sessions, task) {
    try {
      const response = await fetch(`${this.aiEndpoint}resolve-conflict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictType,
          sessions,
          task,
          context: `System has ${this.sessions.size} active sessions, ${this.tasks.size} total tasks`
        })
      });

      if (response.ok) {
        const resolution = await response.json();
        this.applyConflictResolution(resolution);
        return resolution;
      }
    } catch (error) {
      console.error('AI conflict resolution failed, using fallback:', error);
    }

    // Fallback to timestamp-based resolution
    return this.handleConflictFallback(sessions, task);
  }

  notifyBetterMatch(sessionId, taskId, recommendedSession, reasoning) {
    this.broadcastToAll({
      type: 'ai_recommendation',
      sessionId,
      taskId,
      recommendedSession,
      reasoning,
      message: `AI suggests ${recommendedSession} is better suited for task ${taskId}`
    });
  }

  applyConflictResolution(resolution) {
    // Implement AI-recommended conflict resolution
    const { assignTo, compensationActions } = resolution.resolution;

    // Execute compensation actions (e.g., priority boosts, alternative tasks)
    for (const action of compensationActions || []) {
      this.executeCompensationAction(action);
    }
  }

  executeCompensationAction(action) {
    // Handle AI-suggested compensation actions
    switch (action.type) {
      case 'priority_boost':
        const task = this.tasks.get(action.taskId);
        if (task) task.priority = 'high';
        break;
      case 'alternative_assignment':
        // Suggest alternative tasks to disappointed session
        break;
    }
  }
}