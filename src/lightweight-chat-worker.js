/**
 * ChittyChat Lightweight Worker
 * Focused on chat, MCP, and session management only
 * Delegates heavy processing to ChittyRouter
 */

import { handleChat } from "./services/chat-service.js";
import { handleMCP } from "./services/mcp-service.js";
import { SessionManager } from "./cross-session-sync/src/session-manager.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Initialize session manager
    const sessionManager = new SessionManager(env);

    try {
      // Health check
      if (pathname === "/health") {
        return new Response(
          JSON.stringify({
            service: "ChittyChat Lightweight",
            status: "healthy",
            version: "2.0.0",
            features: ["chat", "mcp", "cross-session-sync"],
            uptime: process.uptime ? process.uptime() : "N/A",
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // MCP endpoints for Claude Desktop
      if (pathname.startsWith("/mcp")) {
        return await handleMCP(request, env, ctx);
      }

      // Chat WebSocket upgrade
      if (pathname === "/ws" || pathname === "/chat/ws") {
        return await handleWebSocket(request, env, ctx, sessionManager);
      }

      // Session management
      if (pathname.startsWith("/session")) {
        return await handleSession(request, env, sessionManager);
      }

      // Chat API endpoints
      if (pathname.startsWith("/chat") || pathname === "/") {
        return await handleChat(request, env, ctx, sessionManager);
      }

      // Proxy heavy operations to ChittyRouter
      if (pathname.startsWith("/ai") || pathname.startsWith("/api/ai")) {
        return await proxyToChittyRouter(request, env);
      }

      return new Response("ChittyChat - Lightweight Chat Platform", {
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error) {
      console.error("ChittyChat error:", error);
      return new Response(
        JSON.stringify({
          error: error.message,
          service: "ChittyChat",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};

/**
 * Handle WebSocket connections for real-time chat
 */
async function handleWebSocket(request, env, ctx, sessionManager) {
  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Handle WebSocket messages
  server.accept();

  server.addEventListener("message", async (event) => {
    const data = JSON.parse(event.data);

    // Track message in session
    await sessionManager.addEvent(data.sessionId, {
      type: "message",
      content: data.message,
      timestamp: new Date().toISOString(),
    });

    // For AI requests, proxy to ChittyRouter
    if (data.type === "ai_request") {
      const response = await proxyToChittyRouter(
        new Request("https://router.chitty.cc/ai/chat", {
          method: "POST",
          body: JSON.stringify(data),
          headers: { "Content-Type": "application/json" },
        }),
        env,
      );

      const result = await response.json();
      server.send(
        JSON.stringify({
          type: "ai_response",
          ...result,
        }),
      );
    } else {
      // Echo for now (would connect to chat backend)
      server.send(
        JSON.stringify({
          type: "message",
          content: `Echo: ${data.message}`,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Handle session management endpoints
 */
async function handleSession(request, env, sessionManager) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/session/create" && request.method === "POST") {
    const sessionId = await sessionManager.createSession();
    return new Response(JSON.stringify({ sessionId }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pathname.startsWith("/session/") && request.method === "GET") {
    const sessionId = pathname.split("/")[2];
    const session = await sessionManager.getSession(sessionId);
    return new Response(JSON.stringify(session || {}), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (pathname === "/session/sync" && request.method === "POST") {
    const data = await request.json();
    await sessionManager.syncSession(data.sessionId, data.events);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Invalid session endpoint", { status: 404 });
}

/**
 * Proxy heavy AI operations to ChittyRouter
 */
async function proxyToChittyRouter(request, env) {
  const routerUrl = env.CHITTYROUTER_URL || "https://router.chitty.cc";
  const url = new URL(request.url);

  // Forward request to ChittyRouter
  const proxyUrl = `${routerUrl}${url.pathname}${url.search}`;

  const proxyRequest = new Request(proxyUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  try {
    const response = await fetch(proxyRequest);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error("ChittyRouter proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "ChittyRouter unavailable",
        fallback: true,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Simple chat handler (can be expanded)
 */
async function handleChatService(request, env, ctx, sessionManager) {
  const method = request.method;

  if (method === "GET") {
    // Return chat UI or chat history
    return new Response(
      JSON.stringify({
        service: "ChittyChat",
        message: "Chat service ready",
        sessions: await sessionManager.listSessions(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (method === "POST") {
    const data = await request.json();

    // Store message in session
    await sessionManager.addEvent(data.sessionId, {
      type: "chat_message",
      ...data,
    });

    // For simple messages, respond directly
    // For AI requests, proxy to ChittyRouter
    if (data.requiresAI) {
      return await proxyToChittyRouter(request, env);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message received",
        sessionId: data.sessionId,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response("Method not allowed", { status: 405 });
}

/**
 * MCP handler for Claude Desktop integration
 */
async function handleMCPService(request, env, ctx) {
  // Basic MCP protocol implementation
  const data = await request.json();

  if (data.method === "initialize") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
          },
        },
        id: data.id,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (data.method === "tools/list") {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "chat",
              description: "Send a chat message",
              inputSchema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                },
              },
            },
          ],
        },
        id: data.id,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method not found",
      },
      id: data.id,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// Export handlers for use in platform-worker if needed
export { handleChatService as handleChat, handleMCPService as handleMCP };
