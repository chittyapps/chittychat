/**
 * CloudFlare Workflows & Pipelines for Todo Management
 * Orchestrates the entire todo lifecycle using CF Workflows
 * Includes Durable Objects for state management
 */

import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";

/**
 * Main Todo Workflow - orchestrates the entire pipeline
 */
export class TodoWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    // Step 1: Ingest todos from multiple sources
    const ingested = await step.do("ingest", async () => {
      return await this.ingestTodos(event.payload);
    });

    // Step 2: Process through AI pipeline (parallel)
    const [analyzed, vectorized, enriched] = await Promise.all([
      step.do("analyze", async () => {
        return await this.analyzeWithAI(ingested);
      }),
      step.do("vectorize", async () => {
        return await this.vectorizeTodos(ingested);
      }),
      step.do("enrich", async () => {
        return await this.enrichWithContext(ingested);
      }),
    ]);

    // Step 3: Sync to multiple destinations (parallel)
    await Promise.all([
      step.do("sync-github", async () => {
        return await this.syncToGitHub(enriched);
      }),
      step.do("sync-neon", async () => {
        return await this.syncToNeon(enriched);
      }),
      step.do("sync-notion", async () => {
        return await this.syncToNotion(enriched);
      }),
    ]);

    // Step 4: Update CloudFlare state
    await step.do("update-state", async () => {
      return await this.updateDurableObjects(enriched);
    });

    // Step 5: Trigger downstream workflows
    await step.do("trigger-downstream", async () => {
      return await this.triggerDownstream(enriched);
    });

    return {
      success: true,
      processed: ingested.length,
      analysis: analyzed,
      vectors: vectorized,
    };
  }

  /**
   * Ingest todos from multiple sources
   */
  async ingestTodos(payload) {
    const sources = [
      this.ingestFromLocal(payload),
      this.ingestFromGitHub(payload),
      this.ingestFromNeon(payload),
      this.ingestFromClaudeAPI(payload),
    ];

    const todos = await Promise.all(sources);
    return this.deduplicateTodos(todos.flat());
  }

  /**
   * AI Analysis Pipeline
   */
  async analyzeWithAI(todos) {
    const pipeline = this.env.AI_PIPELINE;

    // Run through AI Gateway for unified processing
    const analysis = await pipeline.run([
      {
        provider: "workers-ai",
        model: "@cf/meta/llama-3-8b-instruct",
        input: { todos },
        task: "analyze_patterns",
      },
      {
        provider: "openai",
        model: "gpt-4-turbo",
        input: { todos },
        task: "suggest_optimizations",
      },
      {
        provider: "anthropic",
        model: "claude-3-opus",
        input: { todos },
        task: "detect_conflicts",
      },
    ]);

    return analysis;
  }

  /**
   * Vectorization Pipeline
   */
  async vectorizeTodos(todos) {
    const vectors = [];

    for (const todo of todos) {
      // Generate embeddings
      const embedding = await this.env.AI.run("@cf/baai/bge-large-en-v1.5", {
        text: todo.content,
      });

      // Store in Vectorize
      await this.env.VECTORIZE_INDEX.upsert([
        {
          id: todo.id,
          values: embedding.data[0],
          metadata: {
            session_id: todo.session_id,
            status: todo.status,
            chitty_id: todo.chitty_id,
          },
        },
      ]);

      vectors.push({
        id: todo.id,
        vector: embedding.data[0],
      });
    }

    return vectors;
  }
}

/**
 * CloudFlare Pipeline for real-time todo processing
 */
export class TodoPipeline {
  constructor(env) {
    this.env = env;
    this.stages = this.configurePipeline();
  }

  /**
   * Configure the pipeline stages
   */
  configurePipeline() {
    return [
      // Stage 1: Validation
      {
        name: "validate",
        handler: this.validateStage.bind(this),
        parallel: false,
      },
      // Stage 2: Transform (parallel)
      {
        name: "transform",
        handler: this.transformStage.bind(this),
        parallel: true,
        workers: 3,
      },
      // Stage 3: Enrich (parallel)
      {
        name: "enrich",
        handler: this.enrichStage.bind(this),
        parallel: true,
        workers: 5,
      },
      // Stage 4: Store
      {
        name: "store",
        handler: this.storeStage.bind(this),
        parallel: false,
      },
      // Stage 5: Notify
      {
        name: "notify",
        handler: this.notifyStage.bind(this),
        parallel: true,
        workers: 2,
      },
    ];
  }

  /**
   * Process todos through pipeline
   */
  async process(todos) {
    let data = todos;

    for (const stage of this.stages) {
      if (stage.parallel) {
        data = await this.processParallel(data, stage);
      } else {
        data = await stage.handler(data);
      }
    }

    return data;
  }

  /**
   * Process stage in parallel
   */
  async processParallel(data, stage) {
    const chunks = this.chunkArray(data, stage.workers);
    const results = await Promise.all(
      chunks.map((chunk) => stage.handler(chunk)),
    );
    return results.flat();
  }

  /**
   * Validation stage
   */
  async validateStage(todos) {
    // Use for...of to support async operations in filter
    const validatedTodos = [];
    for (const todo of todos) {
      // Validate structure
      if (!todo.id || !todo.content) continue;

      // Check for ChittyID
      if (!todo.chitty_id) {
        todo.chitty_id = await this.generateChittyID(todo);
      }

      validatedTodos.push(todo);
    }
    return validatedTodos;
  }

  /**
   * Transform stage
   */
  async transformStage(todos) {
    return todos.map((todo) => ({
      ...todo,
      normalized_content: this.normalizeContent(todo.content),
      tags: this.extractTags(todo.content),
      priority: this.calculatePriority(todo),
      estimated_hours: this.estimateHours(todo),
    }));
  }

  /**
   * Enrichment stage
   */
  async enrichStage(todos) {
    const enriched = [];

    for (const todo of todos) {
      // Add AI insights
      const insights = await this.getAIInsights(todo);

      // Add related todos
      const related = await this.findRelatedTodos(todo);

      // Add GitHub context
      const githubContext = await this.getGitHubContext(todo);

      enriched.push({
        ...todo,
        insights,
        related,
        github_context: githubContext,
      });
    }

    return enriched;
  }

  /**
   * Storage stage
   */
  async storeStage(todos) {
    // Store in multiple destinations
    await Promise.all([
      this.storeInKV(todos),
      this.storeInD1(todos),
      this.storeInR2(todos),
      this.storeInDurableObject(todos),
    ]);

    return todos;
  }

  /**
   * Notification stage
   */
  async notifyStage(todos) {
    // Send notifications through various channels
    await Promise.all([
      this.notifyWebhook(todos),
      this.notifyEmail(todos),
      this.notifyQueue(todos),
    ]);

    return todos;
  }
}

/**
 * Durable Object for stateful todo management
 */
export class TodoStateDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    // Initialize WebSocket connections for real-time updates
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for real-time todo updates
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    switch (url.pathname) {
      case "/state":
        return this.getState();
      case "/update":
        return this.updateState(request);
      case "/merge":
        return this.mergeStates(request);
      case "/conflict":
        return this.resolveConflict(request);
      default:
        return new Response("Todo State Durable Object", { status: 200 });
    }
  }

  /**
   * Handle WebSocket connections for real-time updates
   */
  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    server.addEventListener("message", async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "subscribe":
          this.sessions.set(data.sessionId, server);
          break;
        case "update":
          await this.broadcastUpdate(data);
          break;
        case "merge":
          await this.handleMergeRequest(data);
          break;
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Broadcast todo updates to all connected sessions
   */
  async broadcastUpdate(data) {
    const update = {
      type: "todo_update",
      todos: data.todos,
      timestamp: new Date().toISOString(),
      chitty_id: data.chitty_id,
    };

    for (const [sessionId, ws] of this.sessions) {
      ws.send(JSON.stringify(update));
    }
  }

  /**
   * Get current state
   */
  async getState() {
    const state = (await this.state.storage.get("todos")) || [];
    return Response.json(state);
  }

  /**
   * Update state with conflict detection
   */
  async updateState(request) {
    const newTodos = await request.json();
    const currentTodos = (await this.state.storage.get("todos")) || [];

    // Detect conflicts
    const conflicts = this.detectConflicts(currentTodos, newTodos);

    if (conflicts.length > 0) {
      return Response.json(
        {
          error: "Conflicts detected",
          conflicts,
        },
        { status: 409 },
      );
    }

    // Merge and store
    const merged = this.mergeTodos(currentTodos, newTodos);
    await this.state.storage.put("todos", merged);

    // Broadcast update
    await this.broadcastUpdate({ todos: merged });

    return Response.json({ success: true, todos: merged });
  }

  /**
   * Detect conflicts between todo states
   */
  detectConflicts(current, incoming) {
    const conflicts = [];

    for (const incomingTodo of incoming) {
      const currentTodo = current.find((t) => t.id === incomingTodo.id);

      if (currentTodo && currentTodo.version !== incomingTodo.version) {
        conflicts.push({
          id: incomingTodo.id,
          current: currentTodo,
          incoming: incomingTodo,
          type: "version_mismatch",
        });
      }
    }

    return conflicts;
  }

  /**
   * Merge todo states
   */
  mergeTodos(current, incoming) {
    const merged = new Map();

    // Add all current todos
    for (const todo of current) {
      merged.set(todo.id, todo);
    }

    // Merge incoming todos
    for (const todo of incoming) {
      const existing = merged.get(todo.id);

      if (!existing || todo.version > existing.version) {
        merged.set(todo.id, todo);
      }
    }

    return Array.from(merged.values());
  }
}

/**
 * CloudFlare Queue consumer for async todo processing
 */
export class TodoQueueConsumer {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const todo = message.body;

        // Process through pipeline
        const pipeline = new TodoPipeline(env);
        const processed = await pipeline.process([todo]);

        // Trigger workflow
        const workflow = env.TODO_WORKFLOW.get(
          env.TODO_WORKFLOW.idFromName("main"),
        );
        await workflow.create({
          params: { todos: processed },
        });

        // Acknowledge message
        message.ack();
      } catch (error) {
        // Retry or DLQ
        message.retry();
      }
    }
  }
}

// Export handlers
export default {
  async fetch(request, env) {
    // Route to appropriate handler
    const url = new URL(request.url);

    if (url.pathname.startsWith("/workflow")) {
      return new Response("Workflow triggered", { status: 200 });
    }

    if (url.pathname.startswith("/pipeline")) {
      const todos = await request.json();
      const pipeline = new TodoPipeline(env);
      const result = await pipeline.process(todos);
      return Response.json(result);
    }

    return new Response("CloudFlare Todo Workflow & Pipeline", { status: 200 });
  },

  async queue(batch, env) {
    const consumer = new TodoQueueConsumer();
    return consumer.queue(batch, env);
  },
};
