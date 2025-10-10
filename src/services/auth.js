/**
 * Authentication Service Module
 * Consolidated from auth.chitty.cc worker
 * Handles JWT tokens and authentication
 */

export async function handleAuth(context) {
  try {
    const { request, cache, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace("/api/auth", "");

    // Health check (handles both /health and /api/auth/health)
    if (path === "/health" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          service: "auth",
          status: "healthy",
          features: ["jwt-tokens", "rbac", "session-management"],
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Create auth token endpoint
    if (path === "/token" && request.method === "POST") {
      try {
        const body = await request.json();
        const { chittyId, permissions = [], expiresIn = 3600 } = body;

        if (!chittyId) {
          return new Response(
            JSON.stringify({
              error: "ChittyID required",
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }

        // Create JWT payload
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          sub: chittyId,
          iat: now,
          exp: now + expiresIn,
          permissions,
          issuer: "chittyos-auth",
        };

        // For demo purposes, create a simple token
        // In production, this would use proper JWT signing
        const token = btoa(JSON.stringify(payload));

        // Cache the session
        await cache.set(
          `session:${token}`,
          JSON.stringify({
            chittyId,
            permissions,
            created: now,
            expires: now + expiresIn,
          }),
          "auth",
          expiresIn,
        );

        return new Response(
          JSON.stringify({
            access_token: token,
            token_type: "Bearer",
            expires_in: expiresIn,
            scope: permissions.join(" "),
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Token creation failed",
            message: error.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // Verify token endpoint
    if (path === "/verify" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token) {
          return new Response(
            JSON.stringify({
              valid: false,
              error: "Token required",
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        // Check if session exists in cache
        const sessionData = await cache.get(`session:${token}`, "auth");

        if (!sessionData) {
          return new Response(
            JSON.stringify({
              valid: false,
              error: "Invalid or expired token",
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const session = JSON.parse(sessionData);

        // Check if token is expired
        if (session.expires < Math.floor(Date.now() / 1000)) {
          return new Response(
            JSON.stringify({
              valid: false,
              error: "Token expired",
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            valid: true,
            chittyId: session.chittyId,
            permissions: session.permissions,
            expires: session.expires,
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Token verification failed",
            message: error.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // Refresh token endpoint
    if (path === "/refresh" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("authorization");
        const oldToken = authHeader?.replace("Bearer ", "");

        if (!oldToken) {
          return new Response(
            JSON.stringify({
              error: "Token required",
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        // Get existing session
        const sessionData = await cache.get(`session:${oldToken}`, "auth");

        if (!sessionData) {
          return new Response(
            JSON.stringify({
              error: "Invalid token",
            }),
            {
              status: 401,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const session = JSON.parse(sessionData);

        // Create new token
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = 3600;
        const payload = {
          sub: session.chittyId,
          iat: now,
          exp: now + expiresIn,
          permissions: session.permissions,
          issuer: "chittyos-auth",
        };

        const newToken = btoa(JSON.stringify(payload));

        // Store new session
        await cache.set(
          `session:${newToken}`,
          JSON.stringify({
            chittyId: session.chittyId,
            permissions: session.permissions,
            created: now,
            expires: now + expiresIn,
          }),
          "auth",
          expiresIn,
        );

        // Invalidate old session
        await cache.set(`session:${oldToken}`, null, "auth", 1);

        return new Response(
          JSON.stringify({
            access_token: newToken,
            token_type: "Bearer",
            expires_in: expiresIn,
            scope: session.permissions.join(" "),
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Token refresh failed",
            message: error.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // Revoke session endpoint
    if (path.startsWith("/session/") && request.method === "DELETE") {
      const sessionId = path.replace("/session/", "");

      try {
        await cache.set(`session:${sessionId}`, null, "auth", 1);

        return new Response(
          JSON.stringify({
            revoked: true,
            sessionId,
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Session revocation failed",
            message: error.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        available: [
          "/health",
          "/token",
          "/verify",
          "/refresh",
          "/session/{id}",
        ],
      }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Auth service error",
        message: error.message || String(error),
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
