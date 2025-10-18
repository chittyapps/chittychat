/**
 * ChittyContext Service
 * Contextual data aggregation and session state management
 * Provides unified context across ChittyOS services
 */

export async function handleContext(context) {
  const { request, env, cache } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/context", "");

  // Health check
  if (path === "/health") {
    return new Response(
      JSON.stringify({
        service: "context",
        status: "healthy",
        features: [
          "session-context",
          "aggregation",
          "state-management",
          "cross-service",
        ],
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Get session context
  if (path === "/session" && request.method === "GET") {
    const sessionId =
      url.searchParams.get("id") || request.headers.get("x-session-id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: "Session ID required",
          message: "Provide session ID via ?id= or X-Session-ID header",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    try {
      // Fetch from cache or generate new context
      const cacheKey = `context:session:${sessionId}`;
      let sessionContext = await cache.get(cacheKey);

      if (!sessionContext) {
        // Generate new session context
        sessionContext = {
          sessionId,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          services: [],
          metadata: {},
        };

        await cache.put(cacheKey, JSON.stringify(sessionContext), {
          expirationTtl: 3600, // 1 hour
        });
      } else {
        sessionContext = JSON.parse(sessionContext);
        sessionContext.lastAccessed = Date.now();
        await cache.put(cacheKey, JSON.stringify(sessionContext), {
          expirationTtl: 3600,
        });
      }

      return new Response(JSON.stringify(sessionContext), {
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Failed to retrieve session context",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // Update session context
  if (path === "/session" && request.method === "POST") {
    const sessionId = request.headers.get("x-session-id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: "Session ID required in X-Session-ID header",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    try {
      const updates = await request.json();
      const cacheKey = `context:session:${sessionId}`;

      let sessionContext = await cache.get(cacheKey);
      sessionContext = sessionContext
        ? JSON.parse(sessionContext)
        : {
            sessionId,
            createdAt: Date.now(),
            services: [],
            metadata: {},
          };

      // Merge updates
      sessionContext = {
        ...sessionContext,
        ...updates,
        lastAccessed: Date.now(),
        updatedAt: Date.now(),
      };

      await cache.put(cacheKey, JSON.stringify(sessionContext), {
        expirationTtl: 3600,
      });

      return new Response(
        JSON.stringify({
          success: true,
          context: sessionContext,
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Failed to update session context",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // Aggregate context from multiple services
  if (path === "/aggregate" && request.method === "POST") {
    try {
      const { sessionId, services = [] } = await request.json();

      if (!sessionId) {
        return new Response(
          JSON.stringify({
            error: "Session ID required",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      const aggregatedContext = {
        sessionId,
        timestamp: Date.now(),
        services: {},
        unified: {},
      };

      // Fetch context from each service
      for (const service of services) {
        const serviceKey = `context:${service}:${sessionId}`;
        const serviceContext = await cache.get(serviceKey);

        if (serviceContext) {
          aggregatedContext.services[service] = JSON.parse(serviceContext);
        }
      }

      return new Response(JSON.stringify(aggregatedContext), {
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Failed to aggregate context",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // List all active sessions
  if (path === "/sessions" && request.method === "GET") {
    return new Response(
      JSON.stringify({
        message: "Session listing requires KV list capability",
        note: "Use specific session ID for retrieval",
      }),
      {
        status: 501,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Default response
  return new Response(
    JSON.stringify({
      service: "ChittyContext",
      version: "1.0.0",
      endpoints: {
        "/health": "GET - Service health check",
        "/session (GET)": "Retrieve session context (?id= or X-Session-ID)",
        "/session (POST)": "Update session context (X-Session-ID header)",
        "/aggregate": "POST - Aggregate context from multiple services",
        "/sessions": "GET - List active sessions (not implemented)",
      },
    }),
    {
      headers: { "content-type": "application/json" },
    },
  );
}
