/**
 * ChittyOS Unified Platform Worker
 *
 * This consolidated worker replaces 15+ individual workers with unified routing
 * Implements the optimization strategy with path-based routing and shared resources
 */

import { Router } from "itty-router";

// Initialize router with base path handling
const router = Router();

// Service modules
import { handleAIGateway } from "./services/ai-gateway.js";
import { handleLangChain } from "./services/langchain.js";
import { handleAuth } from "./services/auth.js";
import { handleID } from "./services/id.js";
import { handleBeacon } from "./services/beacon.js";

// Service stubs (basic implementations)
import {
  handleMCP,
  handleAgents,
  handleUnified,
  handleRegistry,
  handleSync,
  handleCanon,
  handleChat,
} from "./services/stubs.js";

// Shared cache utilities
class SharedCache {
  constructor(env) {
    this.cache = env.CACHE;
    this.memory = env.MEMORY;
    this.metrics = env.METRICS;
  }

  // Intelligent caching with prefixes
  async get(key, namespace = "default") {
    const prefixedKey = `${namespace}:${key}`;

    // Try cache first, then memory for different data types
    if (
      namespace.startsWith("session:") ||
      namespace.startsWith("auth:") ||
      namespace.startsWith("api:")
    ) {
      return await this.cache.get(prefixedKey);
    } else if (
      namespace.startsWith("agent:") ||
      namespace.startsWith("memory:") ||
      namespace.startsWith("vector:")
    ) {
      return await this.memory.get(prefixedKey);
    } else if (
      namespace.startsWith("metric:") ||
      namespace.startsWith("beacon:")
    ) {
      return await this.metrics.get(prefixedKey);
    }

    return await this.cache.get(prefixedKey);
  }

  async set(key, value, namespace = "default", ttl = 3600) {
    const prefixedKey = `${namespace}:${key}`;

    if (
      namespace.startsWith("session:") ||
      namespace.startsWith("auth:") ||
      namespace.startsWith("api:")
    ) {
      return await this.cache.put(prefixedKey, value, { expirationTtl: ttl });
    } else if (
      namespace.startsWith("agent:") ||
      namespace.startsWith("memory:") ||
      namespace.startsWith("vector:")
    ) {
      return await this.memory.put(prefixedKey, value, { expirationTtl: ttl });
    } else if (
      namespace.startsWith("metric:") ||
      namespace.startsWith("beacon:")
    ) {
      return await this.metrics.put(prefixedKey, value, { expirationTtl: ttl });
    }

    return await this.cache.put(prefixedKey, value, { expirationTtl: ttl });
  }
}

// Shared AI instance for all services
class SharedAI {
  constructor(env) {
    this.ai = env.AI;
    this.cache = new SharedCache(env);
    this.defaultModel = env.DEFAULT_LLM_MODEL || "@cf/meta/llama-3-8b-instruct";
    this.embeddingModel = env.EMBEDDINGS_MODEL || "@cf/baai/bge-base-en-v1.5";
  }

  async chat(messages, model = null, useCache = true) {
    const modelToUse = model || this.defaultModel;
    const cacheKey = this.hashMessages(messages, modelToUse);

    if (useCache) {
      const cached = await this.cache.get(cacheKey, "ai");
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const response = await this.ai.run(modelToUse, {
      messages: messages,
    });

    if (useCache) {
      await this.cache.set(cacheKey, JSON.stringify(response), "ai", 3600);
    }

    return response;
  }

  async embeddings(text, useCache = true) {
    const cacheKey = this.hashText(text);

    if (useCache) {
      const cached = await this.cache.get(cacheKey, "vector");
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const response = await this.ai.run(this.embeddingModel, {
      text: text,
    });

    if (useCache) {
      await this.cache.set(cacheKey, JSON.stringify(response), "vector", 86400); // 24h cache for embeddings
    }

    return response;
  }

  hashMessages(messages, model) {
    const content = JSON.stringify(messages) + model;
    return btoa(content).substring(0, 32);
  }

  hashText(text) {
    return btoa(text).substring(0, 32);
  }
}

// Schema Registry Integration
class SchemaRegistry {
  constructor() {
    this.schemaBaseUrl = "https://schema.chitty.cc/api";
    this.cache = new Map();
  }

  async getSchema(serviceName, version = "current") {
    const cacheKey = `${serviceName}:${version}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `${this.schemaBaseUrl}/schemas/v1/${serviceName}?version=${version}`,
      );
      const schema = await response.json();

      this.cache.set(cacheKey, schema);
      return schema;
    } catch (error) {
      console.warn(
        `Schema registry fetch failed for ${serviceName}:${version}`,
        error,
      );
      return null;
    }
  }

  async validateData(serviceName, data) {
    const schema = await this.getSchema(serviceName);
    if (!schema) return { valid: false, error: "Schema not found" };

    try {
      const response = await fetch(`${this.schemaBaseUrl}/validate/v1/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: serviceName, data }),
      });

      return await response.json();
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getMigrationScript(serviceName, fromVersion, toVersion) {
    try {
      const response = await fetch(
        `${this.schemaBaseUrl}/migrations/v1/${serviceName}/${fromVersion}/${toVersion}`,
      );
      return await response.text();
    } catch (error) {
      console.warn(`Migration script fetch failed`, error);
      return null;
    }
  }
}

// Database abstraction with schema validation
class DatabaseManager {
  constructor(env, schemaRegistry) {
    this.userDb = env.USER_DB;
    this.platformDb = env.PLATFORM_DB;
    this.cacheDb = env.CACHE_DB;
    this.schemaRegistry = schemaRegistry;
  }

  async queryUser(sql, params, options = {}) {
    if (options.validate && options.schema) {
      const validation = await this.schemaRegistry.validateData(
        options.schema,
        params,
      );
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.error}`);
      }
    }

    return await this.userDb
      .prepare(sql)
      .bind(...params)
      .all();
  }

  async queryPlatform(sql, params) {
    return await this.platformDb
      .prepare(sql)
      .bind(...params)
      .all();
  }

  async cacheGet(key) {
    return await this.cacheDb.get(key);
  }

  async cacheSet(key, value, ttl = 3600) {
    return await this.cacheDb.put(key, value, { expirationTtl: ttl });
  }
}

// Request context builder with schema registry
function buildContext(request, env, ctx) {
  const schemaRegistry = new SchemaRegistry();
  const db = new DatabaseManager(env, schemaRegistry);

  return {
    request,
    env,
    ctx,
    cache: new SharedCache(env),
    ai: new SharedAI(env),
    db,
    userDb: env.USER_DB,
    platformDb: env.PLATFORM_DB,
    cacheDb: env.CACHE_DB,
    vectors: env.VECTORS,
    data: env.DATA,
    schemaRegistry,
  };
}

// Main routing logic with optimized path-based routing
router
  // Health check endpoint
  .get("/health", () => {
    return new Response(
      JSON.stringify({
        status: "healthy",
        services: [
          "ai",
          "agents",
          "langchain",
          "mcp",
          "unified",
          "auth",
          "id",
          "registry",
          "sync",
          "canon",
          "chat",
          "beacon",
        ],
        version: "1.0.0",
        platform: "chittyos-optimized",
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  })

  // AI Gateway routes (consolidated from ai.chitty.cc)
  .all("/api/ai/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleAIGateway(context);
  })

  // Agent routes (consolidated from agents.chitty.cc)
  .all("/api/agents/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleAgents(context);
  })

  // LangChain routes (consolidated from langchain.chitty.cc)
  .all("/api/langchain/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleLangChain(context);
  })

  // MCP routes (consolidated from mcp.chitty.cc)
  .all("/api/mcp/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleMCP(context);
  })

  // Unified AI-Notion routes (consolidated from unified.chitty.cc)
  .all("/api/unified/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleUnified(context);
  })

  // Auth routes (consolidated from auth.chitty.cc)
  .all("/api/auth/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleAuth(context);
  })

  // ID routes (consolidated from id.chitty.cc)
  .all("/api/id/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleID(context);
  })

  // Registry routes (consolidated from registry.chitty.cc)
  .all("/api/registry/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleRegistry(context);
  })

  // Sync routes (consolidated from sync.chitty.cc)
  .all("/api/sync/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleSync(context);
  })

  // Canon routes (consolidated from canon.chitty.cc)
  .all("/api/canon/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleCanon(context);
  })

  // Chat routes (consolidated from chat.chitty.cc)
  .all("/api/chat/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleChat(context);
  })

  // Beacon routes (consolidated from beacon.chitty.cc)
  .all("/api/beacon/*", (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handleBeacon(context);
  })

  // Legacy domain routing for backward compatibility
  .all("*", (request, env, ctx) => {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Route based on subdomain for backward compatibility
    if (hostname.includes("ai.chitty.cc")) {
      return handleAIGateway(buildContext(request, env, ctx));
    } else if (hostname.includes("langchain.chitty.cc")) {
      return handleLangChain(buildContext(request, env, ctx));
    } else if (hostname.includes("mcp.chitty.cc")) {
      return handleMCP(buildContext(request, env, ctx));
    } else if (hostname.includes("agents.chitty.cc")) {
      return handleAgents(buildContext(request, env, ctx));
    } else if (hostname.includes("unified.chitty.cc")) {
      return handleUnified(buildContext(request, env, ctx));
    } else if (hostname.includes("auth.chitty.cc")) {
      return handleAuth(buildContext(request, env, ctx));
    } else if (hostname.includes("id.chitty.cc")) {
      return handleID(buildContext(request, env, ctx));
    } else if (hostname.includes("registry.chitty.cc")) {
      return handleRegistry(buildContext(request, env, ctx));
    } else if (hostname.includes("sync.chitty.cc")) {
      return handleSync(buildContext(request, env, ctx));
    } else if (hostname.includes("canon.chitty.cc")) {
      return handleCanon(buildContext(request, env, ctx));
    } else if (hostname.includes("chat.chitty.cc")) {
      return handleChat(buildContext(request, env, ctx));
    } else if (hostname.includes("beacon.chitty.cc")) {
      return handleBeacon(buildContext(request, env, ctx));
    }

    // Default to API gateway
    return new Response(
      JSON.stringify({
        error: "Service not found",
        available_routes: [
          "/api/ai",
          "/api/agents",
          "/api/langchain",
          "/api/mcp",
          "/api/unified",
          "/api/auth",
          "/api/id",
          "/api/registry",
          "/api/sync",
          "/api/canon",
          "/api/chat",
          "/api/beacon",
        ],
        platform: "chittyos-optimized",
      }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      },
    );
  });

// Durable Object classes for consolidated state management
export class PlatformState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/state") {
      const state = (await this.state.storage.get("platform-state")) || {};
      return new Response(JSON.stringify(state));
    }

    if (path === "/set-state" && request.method === "POST") {
      const newState = await request.json();
      await this.state.storage.put("platform-state", newState);
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }
}

export class ChatSessions {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/websocket") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      this.handleWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleWebSocket(websocket) {
    websocket.accept();

    const sessionId = await this.generateChittyId();
    this.sessions.set(sessionId, websocket);

    websocket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data);
        // Handle different message types
        await this.processMessage(sessionId, message);
      } catch (error) {
        websocket.send(JSON.stringify({ error: error.message }));
      }
    });

    websocket.addEventListener("close", () => {
      this.sessions.delete(sessionId);
    });
  }

  async processMessage(sessionId, message) {
    // Message processing logic will be implemented here
    const websocket = this.sessions.get(sessionId);
    if (websocket) {
      websocket.send(
        JSON.stringify({
          type: "response",
          sessionId,
          message: `Processed: ${message.type}`,
        }),
      );
    }
  }
}

export class MCPAgents {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/agent" && request.method === "POST") {
      const agentConfig = await request.json();
      const agentId = await this.generateChittyId();

      await this.state.storage.put(`agent:${agentId}`, agentConfig);

      return new Response(JSON.stringify({ agentId, status: "created" }));
    }

    return new Response("Not found", { status: 404 });
  }
}

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error("Platform worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error.message,
          platform: "chittyos-optimized",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  },
};
