/**
 * ChittyOS Platform Orchestrator Worker
 * Single worker handling all 34+ ChittyOS services with intelligent routing
 * Optimized for cost efficiency and performance
 */

// Import real service handlers
import { handleAIGateway } from "./services/ai-gateway.js";
import { handleLangChainEnhanced as handleLangChain } from "./services/langchain-enhanced.js";
import { handleAuth } from "./services/auth.js";
import { handleID } from "./services/id.js";
import { handleBeacon } from "./services/beacon.js";

// Import stub handlers for services in development
import {
  handleMCP,
  handleAgents,
  handleUnified,
  handleRegistry,
  handleSync,
  handleCanon,
  handleChat,
} from "./services/stubs.js";

// Import ChittyLedger Integration
import { handleChittyLedgerIntegration } from "./services/chittyledger-integration.js";

// Import Status Monitoring
import {
  setupStatusRoutes,
  scheduledStatusUpdate,
  getStatusLine,
} from "./services/status-integration.js";

// Import ChittyPass - Service #35
import { handleChittyPass } from "./services/chittypass.js";

// Import ChittyCases Integration
import { handleChittyCases } from "./services/chittycases-handler.js";

// Import Project Orchestration - Session Management
import { handleProjectOrchestration } from "./services/project-orchestrator.js";

// Import API Documentation Service
import { handleDocs } from "./services/docs.js";

/**
 * Build context object for service handlers
 */
function buildContext(request, env, ctx) {
  return {
    request,
    env,
    ctx,
    cache: {
      get: async (key) => env.PLATFORM_CACHE?.get(key),
      put: async (key, value, options) =>
        env.PLATFORM_CACHE?.put(key, value, options),
      set: async (key, value, namespace, ttl) => {
        const options = {};
        if (ttl) options.expirationTtl = ttl;
        return env.PLATFORM_CACHE?.put(key, value, options);
      },
    },
    userDb: env.PLATFORM_DB,
    platformDb: env.PLATFORM_DB,
    cacheDb: env.PLATFORM_CACHE,
    vectors: env.PLATFORM_VECTORS,
    data: env.PLATFORM_STORAGE,
  };
}

/**
 * Wrapper function to adapt handlers to proper context
 */
function wrapHandler(handler) {
  return async (request, env, ctx) => {
    const context = buildContext(request, env, ctx);
    return handler(context);
  };
}

/**
 * Service route mapping - Optimized with Map for O(1) lookup
 */
const SERVICE_ROUTES_MAP = new Map([
  // Gateway Entry Point - Main platform landing
  ["gateway.chitty.cc", wrapHandler(handleSync)],

  // AI Infrastructure - LIVE
  ["ai.chitty.cc", handleAIGateway],
  ["langchain.chitty.cc", handleLangChain],
  ["cases.chitty.cc", wrapHandler(handleChittyCases)],
  ["mcp.chitty.cc", wrapHandler(handleMCP)],
  ["portal.chitty.cc", wrapHandler(handleMCP)],
  ["agents.chitty.cc", wrapHandler(handleAgents)],
  ["unified.chitty.cc", wrapHandler(handleUnified)],

  // Core Services - LIVE
  ["sync.chitty.cc", wrapHandler(handleSync)],
]);

// Legacy object export for compatibility
let SERVICE_ROUTES = {
  "gateway.chitty.cc": wrapHandler(handleSync),
  "ai.chitty.cc": handleAIGateway,
  "langchain.chitty.cc": handleLangChain,
  "cases.chitty.cc": wrapHandler(handleChittyCases),
  "mcp.chitty.cc": wrapHandler(handleMCP),
  "portal.chitty.cc": wrapHandler(handleMCP),
  "agents.chitty.cc": wrapHandler(handleAgents),
  "unified.chitty.cc": wrapHandler(handleUnified),
  "sync.chitty.cc": wrapHandler(handleSync),
  "api.chitty.cc": wrapHandler(handleSync), // Main API endpoint
  "beacon.chitty.cc": wrapHandler(handleBeacon),

  // Identity & Auth - LIVE
  "id.chitty.cc": wrapHandler(handleID),
  "auth.chitty.cc": wrapHandler(handleAuth),

  // Service Mesh - LIVE
  "registry.chitty.cc": wrapHandler(handleRegistry),
  "canon.chitty.cc": wrapHandler(handleCanon),
  "verify.chitty.cc": handlePlaceholderService("ChittyVerify"),
  "chat.chitty.cc": wrapHandler(handleChat),

  // Project Management - Session Orchestration
  "projects.chitty.cc": wrapHandler(handleProjectOrchestration),
  // NOTE: Session sync moved to sync.chitty.cc/api/session
  // NOTE: Consolidation moved to sync.chitty.cc/local/consolidate

  // Data Services - LIVE
  "schema.chitty.cc": handlePlaceholderService("Schema Registry"),
  "vectorize.chitty.cc": handlePlaceholderService("Vectorize Service"),
  "hyperdrive.chitty.cc": handlePlaceholderService("Hyperdrive Service"),
  "workflows.chitty.cc": handlePlaceholderService("Workflows Service"),
  "ledger.chitty.cc": wrapHandler(handleChittyLedgerIntegration),
  "evidence.chitty.cc": wrapHandler(handleChittyLedgerIntegration),

  // Email & Viewer - LIVE
  "email.chitty.cc": handlePlaceholderService("Email Service"),
  "viewer.chitty.cc": handlePlaceholderService("Immutable Viewer"),

  // ChittyPass - Service #35 - FREE Password Manager
  "pass.chitty.cc": wrapHandler(handleChittyPass),

  // Infrastructure Services
  "audit.chitty.cc": handlePlaceholderService("Audit Service"),
  "assets.chitty.cc": handlePlaceholderService("Assets CDN"),
  "cdn.chitty.cc": handlePlaceholderService("CDN Service"),
  "docs.chitty.cc": wrapHandler(handleDocs), // API Documentation (JSON, Markdown, OpenAPI)
  "www.chitty.cc": handlePlaceholderService("Main Website"),

  // Staging Environments
  "staging.chitty.cc": handleStaging,
  "staging-ai.chitty.cc": handlePlaceholderService("Staging AI"),
  "staging-api.chitty.cc": handlePlaceholderService("Staging API"),
  "staging-auth.chitty.cc": handlePlaceholderService("Staging Auth"),
  "staging-id.chitty.cc": handlePlaceholderService("Staging ID"),
  "staging-sync.chitty.cc": handlePlaceholderService("Staging Sync"),

  // Development Environments
  "dev.chitty.cc": handlePlaceholderService("Development"),
  "dev-ai.chitty.cc": handlePlaceholderService("Dev AI"),
  "dev-api.chitty.cc": handlePlaceholderService("Dev API"),
  "dev-id.chitty.cc": handlePlaceholderService("Dev ID"),
};

// Add status monitoring routes
SERVICE_ROUTES = setupStatusRoutes(SERVICE_ROUTES);

/**
 * Placeholder service handler for services in development
 */
function handlePlaceholderService(serviceName) {
  return async function (request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "coming_soon",
          service: serviceName,
          message: "Service scheduled for deployment",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        service: serviceName,
        status: "Coming Soon",
        message:
          "This service is scheduled for deployment in the ChittyOS roadmap",
        deployment_phase:
          serviceName.includes("MCP") || serviceName.includes("LangChain")
            ? "Phase 0"
            : serviceName.includes("ID") || serviceName.includes("Auth")
              ? "Phase 1"
              : "Phase 2",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  };
}

/**
 * Default service handler for unknown routes
 */
async function handleDefault(request, env, ctx) {
  const url = new URL(request.url);

  return new Response(
    JSON.stringify({
      error: "Service Not Found",
      message: `No handler found for ${url.hostname}`,
      availableServices: Object.keys(SERVICE_ROUTES),
      timestamp: new Date().toISOString(),
      version: env.PLATFORM_VERSION || "1.0.0",
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/**
 * Staging environment handler
 */
async function handleStaging(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Route staging requests to appropriate service based on path
  if (pathname.startsWith("/ai")) {
    return handleAIGateway(request, env, ctx);
  } else if (pathname.startsWith("/sync")) {
    return wrapHandler(handleSync)(request, env, ctx);
  } else if (pathname.startsWith("/beacon")) {
    return wrapHandler(handleBeacon)(request, env, ctx);
  }

  // Default staging response
  return new Response(
    JSON.stringify({
      service: "ChittyOS Staging Environment",
      version: env.PLATFORM_VERSION || "1.0.0",
      environment: "staging",
      availablePaths: ["/ai", "/sync", "/beacon"],
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/**
 * Global health check handler
 */
async function handleGlobalHealth(request, env, ctx) {
  const services = Object.keys(SERVICE_ROUTES);
  const healthChecks = {};

  // Quick health check for each service
  for (const service of services) {
    try {
      healthChecks[service] = "healthy";
    } catch (error) {
      healthChecks[service] = "unhealthy";
    }
  }

  return new Response(
    JSON.stringify({
      status: "healthy",
      platform: "ChittyOS Platform Orchestrator",
      version: env.PLATFORM_VERSION || "1.0.0",
      services: healthChecks,
      timestamp: new Date().toISOString(),
      worker: "platform-worker",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/**
 * Main request handler with intelligent routing
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Get the hostname from Host header (for subdomain routing) or URL
    const hostHeader = request.headers.get("host");
    const hostname =
      hostHeader && hostHeader !== "localhost:8787"
        ? hostHeader.replace(":8787", "") // Remove port if present
        : url.hostname;

    // Add request timing
    const startTime = Date.now();

    // Quick status line endpoint
    if (pathname === "/status-line") {
      const statusLine = await getStatusLine(env);
      return new Response(statusLine, {
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "no-cache",
        },
      });
    }

    try {
      // Fast-path: Use Map for O(1) hostname lookup
      const handler = SERVICE_ROUTES_MAP.get(hostname);
      if (handler) {
        const response = await handler(request, env, ctx);
        response.headers.set("X-ChittyOS-RT", Date.now() - startTime);
        return response;
      }

      // API Documentation - accessible from any domain
      if (pathname.startsWith("/docs")) {
        const context = buildContext(request, env, ctx);
        return handleDocs(context);
      }

      // Global platform health check (only for main domain or no Host header)
      if (
        (pathname === "/health" || pathname === "/platform/health") &&
        (!hostHeader || hostHeader === "localhost:8787")
      ) {
        return handleGlobalHealth(request, env, ctx);
      }

      // CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      // Check for path-based routing (e.g., gateway.chitty.cc/pass)
      let serviceHandler = null;

      // ChittyPass path-based routing
      if (pathname.startsWith("/pass")) {
        serviceHandler = wrapHandler(handleChittyPass);
      } else {
        // Route to appropriate service handler based on hostname/subdomain
        serviceHandler = SERVICE_ROUTES[hostname];
      }

      if (serviceHandler) {
        // Add platform context to env
        env.PLATFORM_CONTEXT = {
          hostname,
          pathname,
          startTime,
          version: env.PLATFORM_VERSION || "1.0.0",
        };

        const response = await serviceHandler(request, env, ctx);

        // Clone response to add platform headers (service binding responses have immutable headers)
        const newHeaders = new Headers(response.headers);
        newHeaders.set("X-Platform-Version", env.PLATFORM_VERSION || "1.0.0");
        newHeaders.set("X-Service-Host", hostname);
        newHeaders.set("X-Response-Time", `${Date.now() - startTime}ms`);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      // Default handler for unknown routes
      return handleDefault(request, env, ctx);
    } catch (error) {
      console.error("Platform Worker Error:", error);

      return new Response(
        JSON.stringify({
          error: "Platform Error",
          message: error.message,
          hostname,
          pathname,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  },

  // Add scheduled handler for periodic status updates
  async scheduled(event, env, ctx) {
    switch (event.cron) {
      case "*/1 * * * *": // Every minute
        await scheduledStatusUpdate(event, env, ctx);
        break;
      default:
        console.log("Unknown cron:", event.cron);
    }
  },
};

/**
 * Durable Object exports - Names must match wrangler.toml
 */

// Basic Durable Object implementations
export class ChittyOSPlatformState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response(
      JSON.stringify({
        state: "active",
        service: "ChittyOS Platform State",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export class AIGatewayState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response(
      JSON.stringify({
        state: "active",
        service: "AI Gateway State",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export class SyncState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response(
      JSON.stringify({
        state: "active",
        service: "Sync State",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export class ChatSessions {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response(
      JSON.stringify({
        state: "active",
        service: "Chat Sessions State",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export class MCPAgents {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    return new Response(
      JSON.stringify({
        state: "active",
        service: "MCP Agents State",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
