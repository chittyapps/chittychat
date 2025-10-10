/**
 * API Documentation Service
 * Serves comprehensive API documentation for all ChittyOS services
 */

export async function handleDocs(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === "/health") {
    return new Response(
      JSON.stringify({
        service: "docs",
        status: "healthy",
        version: "2.0.0",
        endpoints: ["/docs", "/docs/json", "/docs/openapi"],
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // JSON format
  if (path === "/docs/json" || path === "/api/docs") {
    return new Response(JSON.stringify(API_DOCS_JSON, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // OpenAPI format
  if (path === "/docs/openapi") {
    return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Markdown documentation (default)
  return new Response(MARKDOWN_DOCS, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Structured JSON documentation for LLMs
const API_DOCS_JSON = {
  version: "2.0.0",
  title: "ChittyOS Platform API",
  baseUrl: "https://{service}.chitty.cc",
  account: "ChittyCorp CI/CD",
  worker: "chittyos-platform-production",

  services: {
    chittyid: {
      name: "ChittyID Service",
      baseUrl: "https://id.chitty.cc",
      description:
        "Pipeline-only ChittyID generation proxying to central authority",
      endpoints: [
        {
          path: "/health",
          method: "GET",
          description: "Service health check",
          response: {
            service: "chitty-id",
            status: "healthy",
            mode: "pipeline-only",
          },
        },
        {
          path: "/generate",
          method: "POST",
          description: "Generate ChittyID (proxies to id.chitty.cc)",
          auth: "Bearer token required",
          request: {
            metadata: { entityType: "string" },
            sessionContext: { sessionId: "string" },
          },
          response: {
            chittyId: "VV-G-LLL-SSSS-T-YM-C-X format",
            source: "id.chitty.cc",
            pipeline: "chittychat-proxy",
          },
        },
        {
          path: "/validate/{chittyId}",
          method: "GET",
          description: "Validate ChittyID format",
          response: { valid: "boolean", format: "string" },
        },
        {
          path: "/metadata/{chittyId}",
          method: "GET",
          description: "Retrieve ChittyID metadata",
          response: { metadata: "object", created: "string" },
        },
      ],
    },

    auth: {
      name: "Authentication Service",
      baseUrl: "https://auth.chitty.cc",
      description: "JWT-based authentication with session management",
      endpoints: [
        {
          path: "/api/auth/token",
          method: "POST",
          description: "Create authentication token",
          request: {
            chittyId: "string",
            permissions: ["array"],
            expiresIn: 3600,
          },
          response: {
            access_token: "string",
            token_type: "Bearer",
            expires_in: "number",
          },
        },
        {
          path: "/api/auth/verify",
          method: "POST",
          description: "Verify token validity",
          auth: "Bearer token required",
          response: {
            valid: "boolean",
            chittyId: "string",
            permissions: ["array"],
          },
        },
        {
          path: "/api/auth/refresh",
          method: "POST",
          description: "Refresh expired token",
          auth: "Bearer token required",
          response: { access_token: "string" },
        },
        {
          path: "/api/auth/session/{sessionId}",
          method: "DELETE",
          description: "Revoke session",
          response: { revoked: "boolean" },
        },
      ],
    },

    sync: {
      name: "Sync Service",
      baseUrl: "https://sync.chitty.cc",
      aliases: ["https://api.chitty.cc"],
      description: "Platform Integration Hub for cross-session synchronization",
      architecture: {
        platforms: ["neon", "notion", "github", "drive", "cloudflare", "local"],
        resources: ["project", "session", "topic", "todos"],
      },
      endpoints: [
        {
          path: "/api/project",
          methods: ["GET", "POST", "PUT", "DELETE"],
          description: "Project management and sync",
        },
        {
          path: "/api/session",
          methods: ["GET", "POST", "PUT", "DELETE"],
          description: "Session registration and heartbeat",
        },
        {
          path: "/api/topic",
          methods: ["GET", "POST", "PUT", "DELETE"],
          description: "Conversation categorization",
        },
        {
          path: "/api/todos",
          methods: ["GET", "POST", "PUT", "DELETE"],
          description: "Unified todo synchronization",
        },
        {
          path: "/api/status",
          method: "GET",
          description: "Overall sync status",
        },
      ],
    },

    ai: {
      name: "AI Gateway",
      baseUrl: "https://ai.chitty.cc",
      description: "OpenAI-compatible API with Cloudflare Workers AI",
      endpoints: [
        {
          path: "/v1/chat/completions",
          method: "POST",
          description: "Chat completions (OpenAI compatible)",
          models: ["@cf/meta/llama-3.1-8b-instruct"],
        },
        {
          path: "/v1/embeddings",
          method: "POST",
          description: "Text embeddings",
          models: ["@cf/baai/bge-base-en-v1.5"],
        },
        {
          path: "/v1/models",
          method: "GET",
          description: "List available models",
        },
      ],
    },

    mcp: {
      name: "MCP Portal",
      baseUrl: "https://mcp.chitty.cc",
      aliases: ["https://portal.chitty.cc"],
      description: "Model Context Protocol for AI integration",
      endpoints: [
        {
          path: "/health",
          method: "GET",
          description: "Service health check",
        },
      ],
    },
  },

  errorCodes: {
    200: "OK - Request succeeded",
    201: "Created - Resource created successfully",
    400: "Bad Request - Invalid parameters",
    401: "Unauthorized - Authentication failed",
    404: "Not Found - Resource not found",
    405: "Method Not Allowed - HTTP method not supported",
    500: "Internal Server Error - Server error",
    501: "Not Implemented - Feature unavailable",
    502: "Bad Gateway - Upstream service unavailable",
  },

  examples: {
    auth_flow: {
      "1_create_token": {
        url: "POST https://auth.chitty.cc/api/auth/token",
        body: {
          chittyId: "01-P-EO-0001-T-25-C-X",
          permissions: ["read", "write"],
        },
      },
      "2_verify_token": {
        url: "POST https://auth.chitty.cc/api/auth/verify",
        headers: { Authorization: "Bearer <token>" },
      },
      "3_use_token": {
        url: "GET https://api.chitty.cc/api/project",
        headers: { Authorization: "Bearer <token>" },
      },
    },
    project_sync: {
      "1_register_session": {
        url: "POST https://api.chitty.cc/api/session",
        body: { id: "session-123", projectId: "my-app", aiPlatform: "claude" },
      },
      "2_sync_project": {
        url: "POST https://api.chitty.cc/api/project",
        body: { id: "my-app", name: "My Application" },
      },
      "3_sync_todos": {
        url: "PUT https://api.chitty.cc/api/todos/my-app/sync",
        body: { sessionId: "session-123", todos: [] },
      },
    },
  },
};

// OpenAPI 3.0 specification
const OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "ChittyOS Platform API",
    version: "2.0.0",
    description: "Comprehensive API for ChittyOS platform services",
  },
  servers: [
    { url: "https://id.chitty.cc", description: "ChittyID Service" },
    { url: "https://auth.chitty.cc", description: "Authentication Service" },
    { url: "https://api.chitty.cc", description: "Sync Service" },
    { url: "https://ai.chitty.cc", description: "AI Gateway" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// Full markdown documentation
const MARKDOWN_DOCS = `# ChittyOS Platform API Documentation

**Version**: 2.0.0
**Base URL**: \`https://{service}.chitty.cc\`
**Account**: ChittyCorp CI/CD
**Worker**: chittyos-platform-production

## Quick Links

- **JSON Format**: [/docs/json](/docs/json)
- **OpenAPI Spec**: [/docs/openapi](/docs/openapi)
- **Service Status**: [/api/status](https://api.chitty.cc/api/status)

## Services

### 1. ChittyID Service
**Base URL**: \`https://id.chitty.cc\`

Pipeline-only architecture - all ID generation proxies to central authority.

**Endpoints**:
- \`GET /health\` - Service health
- \`POST /generate\` - Generate ChittyID (auth required)
- \`GET /validate/{id}\` - Validate format
- \`GET /metadata/{id}\` - Get metadata

### 2. Authentication Service
**Base URL**: \`https://auth.chitty.cc\`

JWT-based authentication with session management.

**Endpoints**:
- \`POST /api/auth/token\` - Create token
- \`POST /api/auth/verify\` - Verify token
- \`POST /api/auth/refresh\` - Refresh token
- \`DELETE /api/auth/session/{id}\` - Revoke session

### 3. Sync Service
**Base URL**: \`https://sync.chitty.cc\` or \`https://api.chitty.cc\`

Platform Integration Hub for projects, sessions, and topics.

**Resource APIs**:
- \`/api/project\` - Project management
- \`/api/session\` - Session tracking
- \`/api/topic\` - Topic categorization
- \`/api/todos\` - Unified todos
- \`/api/status\` - Overall status

### 4. AI Gateway
**Base URL**: \`https://ai.chitty.cc\`

OpenAI-compatible API with Cloudflare Workers AI.

**Endpoints**:
- \`POST /v1/chat/completions\` - Chat (Llama 3.1)
- \`POST /v1/embeddings\` - Embeddings
- \`GET /v1/models\` - List models

### 5. MCP Portal
**Base URL**: \`https://mcp.chitty.cc\` or \`https://portal.chitty.cc\`

Model Context Protocol for AI integration.

## Authentication

Most endpoints require Bearer token authentication:

\`\`\`bash
# Create token
curl -X POST https://auth.chitty.cc/api/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"chittyId": "01-P-EO-0001-T-25-C-X", "permissions": ["read", "write"]}'

# Use token
curl https://api.chitty.cc/api/project \\
  -H "Authorization: Bearer <token>"
\`\`\`

## Examples

### Project Sync Workflow
\`\`\`bash
# 1. Register session
curl -X POST https://api.chitty.cc/api/session \\
  -d '{"id": "session-123", "projectId": "my-app", "aiPlatform": "claude"}'

# 2. Sync project
curl -X POST https://api.chitty.cc/api/project \\
  -d '{"id": "my-app", "name": "My App"}'

# 3. Sync todos
curl -X PUT https://api.chitty.cc/api/todos/my-app/sync \\
  -d '{"sessionId": "session-123", "todos": [...]}'
\`\`\`

### AI Chat
\`\`\`bash
curl -X POST https://ai.chitty.cc/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
\`\`\`

## Status & Support

- **Platform Status**: https://api.chitty.cc/api/status
- **Documentation**: https://docs.chitty.cc/api
- **Worker Logs**: \`wrangler tail chittyos-platform-production\`

**Last Updated**: 2025-10-04
`;

export { API_DOCS_JSON, OPENAPI_SPEC, MARKDOWN_DOCS };
