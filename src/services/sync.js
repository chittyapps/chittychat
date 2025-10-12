/**
 * ChittyOS Sync Service
 * Platform Integration Hub - Reconnect and sync platform data
 *
 * Architecture:
 * - Platform-specific sync endpoints: /neon, /notion, /github, /drive, /cloudflare, /local
 * - Unified resource APIs: /api/project, /api/session, /api/topic
 * - ChittyChat orchestration provides GitHub overlay
 * - Each platform contributes data that gets synthesized into resources
 *
 * Platform Endpoints:
 * - /neon - Sync with Neon PostgreSQL database
 * - /notion - Sync with Notion workspaces
 * - /github - Sync with GitHub repositories
 * - /drive - Sync with Google Drive
 * - /cloudflare - Sync Cloudflare R2/KV/D1
 * - /local - Sync local Claude files
 *
 * Resource Endpoints:
 * - /api/project - Projects (synthesized from all platforms)
 * - /api/session - Sessions (synthesized from all platforms)
 * - /api/topic - Topics (synthesized from all platforms)
 * - /api/status - Overall sync status
 */

// Import ChittyChat orchestration layer
import { ProjectOrchestrator } from "./project-orchestrator.js";

// NOTE: Local-only services (LocalConsolidator, TodoOrchestrator) are NOT imported
// in Workers build. These require Node.js APIs (fs, path, os) and only work locally.
// The /local/* endpoints will return 501 Not Implemented when called on deployed worker.
// For local consolidation, use the local Node.js server instead.

// Import platform-specific handlers
import { handleNotionDataPipeline } from "./notion-data-pipeline.js";

/**
 * Build intelligent compaction instructions based on project state
 */
function buildCompactionInstructions(projectState) {
  if (!projectState) {
    return "Preserve project context, todos, and recent file operations";
  }

  const instructions = [
    "Preserve all consolidated todos and task context",
    `Keep context for ${projectState.consolidatedTodos?.length || 0} active tasks`,
    "Maintain file operation history and session continuity",
  ];

  if (projectState.filesWorked?.length > 0) {
    instructions.push(
      `Preserve context for ${projectState.filesWorked.length} files worked`,
    );
  }

  return instructions.join(". ");
}

/**
 * Main Sync Handler
 */
export async function handleSync(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ============================================
  // PLATFORM-SPECIFIC SYNC ENDPOINTS
  // ============================================

  // Notion platform sync
  if (path.startsWith("/notion") || request.headers.get("X-Notion-Webhook")) {
    return handleNotionDataPipeline(context);
  }

  // Neon database sync
  if (path.startsWith("/neon")) {
    return handleNeonSync(context);
  }

  // GitHub sync
  if (path.startsWith("/github")) {
    return handleGitHubSync(context);
  }

  // Google Drive sync
  if (path.startsWith("/drive")) {
    return handleDriveSync(context);
  }

  // Cloudflare (R2/KV/D1) sync
  if (path.startsWith("/cloudflare")) {
    return handleCloudflareSync(context);
  }

  // Local Claude files sync
  if (path.startsWith("/local")) {
    return handleLocalSync(context);
  }

  // ============================================
  // UNIFIED RESOURCE APIs
  // ============================================

  // Health check
  if (path === "/health") {
    return new Response(
      JSON.stringify({
        service: "sync",
        status: "healthy",
        version: "2.0.0",
        architecture: "Platform Integration Hub",
        platforms: ["neon", "notion", "github", "drive", "cloudflare", "local"],
        resources: ["project", "session", "topic", "todos", "orchestration"],
        endpoints: {
          platforms: {
            neon: "/neon",
            notion: "/notion",
            github: "/github",
            drive: "/drive",
            cloudflare: "/cloudflare",
            local: "/local",
          },
          resources: {
            project: "/api/project",
            session: "/api/session",
            topic: "/api/topic",
            todos: "/api/todos",
            orchestrate: "/api/orchestrate",
            status: "/api/status",
          },
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Resource APIs
  if (path.startsWith("/api/project") || path.startsWith("/project")) {
    return handleProject(context);
  }

  if (path.startsWith("/api/session") || path.startsWith("/session")) {
    return handleSession(context);
  }

  if (path.startsWith("/api/topic") || path.startsWith("/topic")) {
    return handleTopic(context);
  }

  if (path === "/api/status" || path === "/status") {
    return handleStatus(context);
  }

  // Unified todos (parallel session synchronization)
  // Route to ChittySync Hub via Service Binding (D1 backend with merge engine)
  if (path.startsWith("/api/todos") || path.startsWith("/todos")) {
    // Check if CHITTYSYNC_HUB service binding is available
    if (env.CHITTYSYNC_HUB) {
      try {
        // Proxy request to ChittySync Hub (D1 backend)
        return await env.CHITTYSYNC_HUB.fetch(request);
      } catch (error) {
        console.error("ChittySync Hub service binding error:", error);
        // Fall through to KV fallback
      }
    }

    // Fallback to KV if service binding unavailable (dev mode or binding failure)
    console.warn(
      "CHITTYSYNC_HUB binding not available, falling back to KV storage",
    );
    return handleTodos(context);
  }

  // Todo orchestration (distribution across sessions)
  // NOTE: Disabled in Workers - requires Node.js filesystem access
  if (path.startsWith("/api/orchestrate") || path.startsWith("/orchestrate")) {
    return new Response(
      JSON.stringify({
        error: "Todo orchestration only available via Node.js server",
        message: "This endpoint requires filesystem access",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  }

  // Default response
  return new Response(
    JSON.stringify({
      service: "ChittyOS Sync Service",
      version: "2.0.0",
      architecture: "Platform Integration Hub",
      documentation: "https://docs.chitty.cc/sync",
      platforms: {
        neon: "/neon - PostgreSQL database sync",
        notion: "/notion - Notion workspace sync",
        github: "/github - Repository sync",
        drive: "/drive - Google Drive sync",
        cloudflare: "/cloudflare - R2/KV/D1 sync",
        local: "/local - Local Claude files sync",
      },
      resources: {
        project: "/api/project - Unified project data",
        session: "/api/session - Unified session data",
        topic: "/api/topic - Unified topic categorization",
        todos: "/api/todos - Unified todo synchronization across sessions",
        orchestrate:
          "/api/orchestrate - Todo distribution and session guidance",
        status: "/api/status - Overall sync status",
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * PROJECT SYNC
 * Handles project file synchronization across AI instances
 */
async function handleProject(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Extract project ID from path
  const pathParts = url.pathname.split("/").filter(Boolean);
  const projectId = pathParts[pathParts.indexOf("project") + 1];

  // GET /api/project - List all projects
  if (method === "GET" && !projectId) {
    const projects = await listProjects(env);
    return new Response(
      JSON.stringify({
        projects,
        total: projects.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // GET /api/project/:id - Get specific project
  if (method === "GET" && projectId) {
    const project = await getProject(env, projectId);

    if (!project) {
      return new Response(
        JSON.stringify({
          error: "Project not found",
          projectId,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(project), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/project - Create/sync a project
  if (method === "POST") {
    const body = await request.json();
    const result = await createOrSyncProject(env, body);

    return new Response(JSON.stringify(result), {
      status: result.created ? 201 : 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/project/:id - Update project state
  if (method === "PUT" && projectId) {
    const body = await request.json();
    const result = await updateProject(env, projectId, body);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // DELETE /api/project/:id - Remove project from sync
  if (method === "DELETE" && projectId) {
    const result = await deleteProject(env, projectId);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return methodNotAllowed(method);
}

/**
 * SESSION SYNC
 * Handles session state continuity across AI instances
 */
async function handleSession(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const sessionId = pathParts[pathParts.indexOf("session") + 1];

  // GET /api/session - List all active sessions
  if (method === "GET" && !sessionId) {
    const sessions = await listSessions(env);
    return new Response(
      JSON.stringify({
        sessions,
        total: sessions.length,
        active: sessions.filter((s) => s.active).length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // GET /api/session/:id - Get specific session
  if (method === "GET" && sessionId) {
    const session = await getSession(env, sessionId);

    if (!session) {
      return new Response(
        JSON.stringify({
          error: "Session not found",
          sessionId,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(session), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/session - Register new session
  if (method === "POST") {
    const body = await request.json();
    const result = await createSession(env, body);

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/session/:id - Update session (heartbeat)
  if (method === "PUT" && sessionId) {
    const body = await request.json();
    const result = await updateSession(env, sessionId, body);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // DELETE /api/session/:id - End session
  if (method === "DELETE" && sessionId) {
    const result = await deleteSession(env, sessionId);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return methodNotAllowed(method);
}

/**
 * TOPIC SYNC
 * Handles semantic conversation categorization
 */
async function handleTopic(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const topicParam = pathParts[pathParts.indexOf("topic") + 1];

  // GET /api/topic - List all topics/categories
  if (method === "GET" && !topicParam) {
    const topics = await listTopics(env);
    return new Response(
      JSON.stringify({
        topics,
        total: topics.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // GET /api/topic/:category - Get conversations in topic
  if (method === "GET" && topicParam) {
    const conversations = await getTopicConversations(env, topicParam);

    return new Response(
      JSON.stringify({
        category: topicParam,
        conversations,
        count: conversations.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // POST /api/topic - Categorize conversation
  if (method === "POST") {
    const body = await request.json();
    const result = await categorizeConversation(env, body);

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/topic/:id - Update conversation categorization
  if (method === "PUT" && topicParam) {
    const body = await request.json();
    const result = await updateTopicCategorization(env, topicParam, body);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // DELETE /api/topic/:id - Remove from topic index
  if (method === "DELETE" && topicParam) {
    const result = await deleteTopicEntry(env, topicParam);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return methodNotAllowed(method);
}

/**
 * TODO SYNC
 * Unified todo synchronization across parallel sessions
 */
async function handleTodos(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const projectId = pathParts[pathParts.indexOf("todos") + 1];

  // GET /api/todos - List all projects with todos
  if (method === "GET" && !projectId) {
    const projects = await listProjectsWithTodos(env);
    return new Response(
      JSON.stringify({
        projects,
        total: projects.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // GET /api/todos/:projectId - Get unified todos for project
  if (method === "GET" && projectId) {
    const todos = await getUnifiedTodos(env, projectId);

    if (!todos) {
      return new Response(
        JSON.stringify({
          error: "Project todos not found",
          projectId,
          todos: [],
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(todos), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/todos/:projectId - Update unified todos
  if (method === "POST" && projectId) {
    const body = await request.json();
    const result = await updateUnifiedTodos(env, projectId, body.todos);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/todos/:projectId/sync - Sync session todos to unified list
  if (method === "PUT" && projectId && url.pathname.includes("/sync")) {
    const body = await request.json();
    const { sessionId, todos } = body;

    if (!sessionId || !todos) {
      return new Response(
        JSON.stringify({
          error: "sessionId and todos required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const result = await syncSessionTodos(env, projectId, sessionId, todos);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // DELETE /api/todos/:projectId - Clear project todos
  if (method === "DELETE" && projectId) {
    try {
      await env.PLATFORM_KV.delete(`sync:todos:${projectId}`);
      return new Response(
        JSON.stringify({
          success: true,
          projectId,
          message: "Todos cleared",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return methodNotAllowed(method);
}

/**
 * STATUS
 * Overall sync status across all resources
 */
async function handleStatus(context) {
  const { env } = context;

  const [projects, sessions, topics] = await Promise.all([
    listProjects(env),
    listSessions(env),
    listTopics(env),
  ]);

  return new Response(
    JSON.stringify({
      service: "sync",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      projects: {
        total: projects.length,
        synced: projects.filter((p) => p.lastSync).length,
      },
      sessions: {
        total: sessions.length,
        active: sessions.filter((s) => s.active).length,
      },
      topics: {
        categories: topics.length,
        total_conversations: topics.reduce((sum, t) => sum + (t.count || 0), 0),
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

// ============================================
// PROJECT OPERATIONS
// Delegates to ChittyChat ProjectOrchestrator
// ============================================

async function listProjects(env) {
  try {
    const orchestrator = new ProjectOrchestrator(env);
    const result = await orchestrator.getProjectReferences();

    return result.projects || [];
  } catch (error) {
    console.error("Error listing projects:", error);
    return [];
  }
}

async function getProject(env, projectId) {
  try {
    const orchestrator = new ProjectOrchestrator(env);
    const result = await orchestrator.getConsolidatedStateFromGitHub(projectId);

    if (result.success) {
      return {
        id: projectId,
        ...result.state,
        fromGitHub: true,
      };
    }

    // Fallback: check project status
    const status = await orchestrator.getProjectStatus(projectId);

    if (status && !status.error) {
      return {
        id: projectId,
        ...status,
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
}

async function createOrSyncProject(env, projectData) {
  const { id, name } = projectData;

  if (!id && !name) {
    return { success: false, error: "Project ID or name required" };
  }

  const projectName = name || id;

  try {
    const orchestrator = new ProjectOrchestrator(env);

    // Consolidate local project state and sync to GitHub
    const result = await orchestrator.consolidateAndSync(projectName);

    // If this is chittyos-services project, trigger service registration
    if (
      projectName === "chittyos-services" ||
      projectName.includes("ChittyOS")
    ) {
      await syncServiceRegistrations(env);
    }

    return {
      success: result.success,
      created: !result.consolidatedState?.lastSync,
      project: {
        id: projectName,
        name: projectName,
        ...result.consolidatedState,
        syncedToGitHub: result.syncResult?.synced || false,
      },
      servicesRegistered: projectName === "chittyos-services",
    };
  } catch (error) {
    console.error("Error creating/syncing project:", error);
    return { success: false, error: error.message };
  }
}

async function updateProject(env, projectId, updates) {
  // For updates, just re-sync the project
  return createOrSyncProject(env, {
    id: projectId,
    name: projectId,
    ...updates,
  });
}

async function deleteProject(env, projectId) {
  // Projects are managed by GitHub - deletion would require GitHub API call
  // For now, just return success (project will expire from cache naturally)
  return {
    success: true,
    deleted: projectId,
    note: "Project removed from sync index (GitHub data preserved)",
  };
}

// ============================================
// SESSION OPERATIONS
// Delegates to ChittyChat ProjectOrchestrator
// ============================================

async function listSessions(env) {
  try {
    const list = await env.PLATFORM_KV.list({ prefix: "sessions:" });
    const allSessions = [];

    // Get all sessions across all projects
    for (const key of list.keys) {
      const sessions = await env.PLATFORM_KV.get(key.name, { type: "json" });
      if (Array.isArray(sessions)) {
        allSessions.push(...sessions);
      }
    }

    return allSessions.sort(
      (a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0),
    );
  } catch (error) {
    console.error("Error listing sessions:", error);
    return [];
  }
}

async function getSession(env, sessionId) {
  try {
    // Search across all project sessions
    const list = await env.PLATFORM_KV.list({ prefix: "sessions:" });

    for (const key of list.keys) {
      const sessions = await env.PLATFORM_KV.get(key.name, { type: "json" });
      if (Array.isArray(sessions)) {
        const session = sessions.find((s) => s.sessionId === sessionId);
        if (session) {
          return session;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

async function createSession(env, sessionData) {
  const { id, projectId, aiPlatform, machineId, metadata } = sessionData;

  if (!id) {
    return { success: false, error: "Session ID required" };
  }

  try {
    const orchestrator = new ProjectOrchestrator(env);

    // Register session with project orchestrator
    const result = await orchestrator.registerSession({
      sessionId: id,
      projectId: projectId || "default",
      machineId: machineId || "unknown",
      platform: aiPlatform || "unknown",
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    });

    if (result.success) {
      return {
        success: true,
        session: {
          id,
          projectId: projectId || "default",
          aiPlatform,
          created: new Date().toISOString(),
          active: true,
          ...result,
        },
      };
    }

    return result;
  } catch (error) {
    console.error("Error creating session:", error);
    return { success: false, error: error.message };
  }
}

async function updateSession(env, sessionId, updates) {
  // Session updates are handled via heartbeat in the orchestrator
  // Just return success since sessions auto-update
  return {
    success: true,
    sessionId,
    updated: new Date().toISOString(),
    note: "Sessions auto-update via heartbeat mechanism",
  };
}

async function deleteSession(env, sessionId) {
  try {
    // Find which project the session belongs to
    const session = await getSession(env, sessionId);

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const orchestrator = new ProjectOrchestrator(env);
    const result = await orchestrator.endSession(
      session.projectId || "default",
      sessionId,
    );

    return result;
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// TOPIC OPERATIONS
// ============================================

async function listTopics(env) {
  try {
    const list = await env.PLATFORM_KV.list({ prefix: "sync:topic:category:" });
    const topics = [];

    for (const key of list.keys) {
      const data = await env.PLATFORM_KV.get(key.name, { type: "json" });
      if (data) {
        topics.push(data);
      }
    }

    return topics.sort((a, b) => (b.count || 0) - (a.count || 0));
  } catch (error) {
    console.error("Error listing topics:", error);
    return [];
  }
}

async function getTopicConversations(env, category) {
  try {
    const list = await env.PLATFORM_KV.list({
      prefix: `sync:topic:${category}:`,
    });
    const conversations = [];

    for (const key of list.keys) {
      const data = await env.PLATFORM_KV.get(key.name, { type: "json" });
      if (data) {
        conversations.push(data);
      }
    }

    return conversations.sort(
      (a, b) => new Date(b.categorized || 0) - new Date(a.categorized || 0),
    );
  } catch (error) {
    console.error("Error getting topic conversations:", error);
    return [];
  }
}

async function categorizeConversation(env, data) {
  const { id, content, file, category, subcategories, confidence } = data;

  if (!id || !category) {
    return { success: false, error: "Conversation ID and category required" };
  }

  const timestamp = new Date().toISOString();

  const conversation = {
    id,
    file: file || null,
    category,
    subcategories: subcategories || [],
    confidence: confidence || 0.5,
    categorized: timestamp,
    content_preview: content ? content.substring(0, 200) : null,
  };

  // Store conversation in topic index
  await env.PLATFORM_KV.put(
    `sync:topic:${category}:${id}`,
    JSON.stringify(conversation),
    { expirationTtl: 86400 * 90 }, // 90 days
  );

  // Update category metadata
  await updateCategoryMetadata(env, category);

  return {
    success: true,
    conversation,
  };
}

async function updateCategoryMetadata(env, category) {
  const conversations = await getTopicConversations(env, category);

  const metadata = {
    category,
    count: conversations.length,
    avgConfidence:
      conversations.reduce((sum, c) => sum + (c.confidence || 0), 0) /
        conversations.length || 0,
    lastUpdated: new Date().toISOString(),
  };

  await env.PLATFORM_KV.put(
    `sync:topic:category:${category}`,
    JSON.stringify(metadata),
    {
      expirationTtl: 86400 * 90,
    },
  );
}

async function updateTopicCategorization(env, conversationId, updates) {
  // Find the conversation across all categories
  const list = await env.PLATFORM_KV.list({ prefix: "sync:topic:" });

  for (const key of list.keys) {
    if (key.name.includes(conversationId)) {
      const existing = await env.PLATFORM_KV.get(key.name, { type: "json" });

      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          categorized: new Date().toISOString(),
        };

        await env.PLATFORM_KV.put(key.name, JSON.stringify(updated), {
          expirationTtl: 86400 * 90,
        });

        return { success: true, conversation: updated };
      }
    }
  }

  return { success: false, error: "Conversation not found" };
}

async function deleteTopicEntry(env, conversationId) {
  const list = await env.PLATFORM_KV.list({ prefix: "sync:topic:" });
  let deleted = false;

  for (const key of list.keys) {
    if (key.name.includes(conversationId)) {
      await env.PLATFORM_KV.delete(key.name);
      deleted = true;
    }
  }

  if (!deleted) {
    return { success: false, error: "Conversation not found" };
  }

  return { success: true, conversationId };
}

// ============================================
// TODO OPERATIONS
// Unified todo synchronization across parallel sessions
// ============================================

async function getUnifiedTodos(env, projectId) {
  try {
    const data = await env.PLATFORM_KV.get(`sync:todos:${projectId}`, {
      type: "json",
    });

    if (!data) {
      return {
        projectId,
        todos: [],
        lastSync: null,
        sessions: [],
      };
    }

    return data;
  } catch (error) {
    console.error("Error getting unified todos:", error);
    return null;
  }
}

async function updateUnifiedTodos(env, projectId, todos) {
  try {
    const existing = await getUnifiedTodos(env, projectId);

    const updated = {
      projectId,
      todos: Array.isArray(todos) ? todos : [],
      lastSync: new Date().toISOString(),
      sessions: existing.sessions || [],
      totalUpdates: (existing.totalUpdates || 0) + 1,
    };

    // Store in KV
    await env.PLATFORM_KV.put(
      `sync:todos:${projectId}`,
      JSON.stringify(updated),
      {
        expirationTtl: 86400 * 30, // 30 days
      },
    );

    // Sync to GitHub via ProjectOrchestrator
    const orchestrator = new ProjectOrchestrator(env);
    const githubSync = await orchestrator.syncConsolidatedState(projectId, {
      consolidatedTodos: todos,
      lastTodoSync: updated.lastSync,
    });

    return {
      success: true,
      projectId,
      todos: updated.todos,
      lastSync: updated.lastSync,
      githubSynced: githubSync.success,
    };
  } catch (error) {
    console.error("Error updating unified todos:", error);
    return { success: false, error: error.message };
  }
}

async function syncSessionTodos(env, projectId, sessionId, sessionTodos) {
  try {
    const unified = await getUnifiedTodos(env, projectId);

    // Merge strategy: Keep latest updates, deduplicate by content
    const todoMap = new Map();

    // Add existing unified todos
    for (const todo of unified.todos || []) {
      const key = `${todo.content}`;
      todoMap.set(key, todo);
    }

    // Merge session todos (newer updates override)
    for (const todo of sessionTodos || []) {
      const key = `${todo.content}`;
      const existing = todoMap.get(key);

      if (!existing) {
        // New todo from this session
        todoMap.set(key, {
          ...todo,
          addedBy: sessionId,
          addedAt: new Date().toISOString(),
        });
      } else {
        // Update existing todo if status changed
        if (existing.status !== todo.status) {
          todoMap.set(key, {
            ...existing,
            ...todo,
            updatedBy: sessionId,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const mergedTodos = Array.from(todoMap.values());

    // Track which sessions have contributed
    const sessions = unified.sessions || [];
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
    }

    const updated = {
      projectId,
      todos: mergedTodos,
      lastSync: new Date().toISOString(),
      sessions,
      totalUpdates: (unified.totalUpdates || 0) + 1,
    };

    // Store in KV
    await env.PLATFORM_KV.put(
      `sync:todos:${projectId}`,
      JSON.stringify(updated),
      {
        expirationTtl: 86400 * 30,
      },
    );

    // Sync to GitHub
    const orchestrator = new ProjectOrchestrator(env);
    await orchestrator.syncConsolidatedState(projectId, {
      consolidatedTodos: mergedTodos,
      lastTodoSync: updated.lastSync,
      activeSessions: sessions,
    });

    return {
      success: true,
      projectId,
      sessionId,
      todos: mergedTodos,
      totalTodos: mergedTodos.length,
      added: mergedTodos.filter((t) => t.addedBy === sessionId).length,
      updated: mergedTodos.filter((t) => t.updatedBy === sessionId).length,
      lastSync: updated.lastSync,
    };
  } catch (error) {
    console.error("Error syncing session todos:", error);
    return { success: false, error: error.message };
  }
}

async function listProjectsWithTodos(env) {
  try {
    const list = await env.PLATFORM_KV.list({ prefix: "sync:todos:" });
    const projects = [];

    for (const key of list.keys) {
      const data = await env.PLATFORM_KV.get(key.name, { type: "json" });
      if (data) {
        projects.push({
          projectId: data.projectId,
          todoCount: data.todos?.length || 0,
          lastSync: data.lastSync,
          sessions: data.sessions?.length || 0,
          pendingTodos:
            data.todos?.filter((t) => t.status === "pending").length || 0,
          inProgressTodos:
            data.todos?.filter((t) => t.status === "in_progress").length || 0,
          completedTodos:
            data.todos?.filter((t) => t.status === "completed").length || 0,
        });
      }
    }

    return projects.sort(
      (a, b) => new Date(b.lastSync || 0) - new Date(a.lastSync || 0),
    );
  } catch (error) {
    console.error("Error listing projects with todos:", error);
    return [];
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function methodNotAllowed(method) {
  return new Response(
    JSON.stringify({
      error: "Method not allowed",
      method,
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET, POST, PUT, DELETE",
      },
    },
  );
}

/**
 * Proxy ALL /api/todos/* requests to dedicated chittysync-hub-production worker
 * This fixes ChittyGateway routing conflict where POST/PUT/DELETE were blocked
 *
 * Solution: ChittyGateway (this worker) proxies todos requests to dedicated ChittySync worker
 * Alternative: Could use Service Bindings, but direct fetch provides explicit routing control
 */
async function proxyToChittySyncHub(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Target: dedicated ChittySync Hub worker (already deployed at gateway.chitty.cc/api/todos/*)
  // Since ChittySync routes are MORE SPECIFIC than gateway.chitty.cc/*, they should take precedence
  // BUT Cloudflare Workers routing doesn't work that way - first deployed worker wins
  //
  // WORKAROUND: Explicitly proxy to the ChittySync worker via internal fetch
  // This bypasses routing priority issues and sends requests directly to chittysync-hub-production

  try {
    // Construct the target URL for the dedicated ChittySync worker
    // We preserve the original path and query string
    const targetUrl = `https://chittysync-hub-production.chittycorp-llc.workers.dev${url.pathname}${url.search}`;

    // Clone the request with the new URL
    // CRITICAL: Preserve method, headers, and body for POST/PUT/DELETE
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    // Forward to dedicated ChittySync worker
    const response = await fetch(proxyRequest);

    // Clone response to add platform headers
    const responseBody = await response.text();
    const newResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Add routing metadata headers for debugging
    newResponse.headers.set("X-Proxied-By", "ChittyGateway");
    newResponse.headers.set("X-Proxy-Target", "chittysync-hub-production");
    newResponse.headers.set("X-Proxy-Method", request.method);

    return newResponse;
  } catch (error) {
    console.error("ChittySync proxy error:", error);

    return new Response(
      JSON.stringify({
        error: "ChittySync proxy failed",
        message: error.message,
        path: url.pathname,
        method: request.method,
        note: "Failed to reach chittysync-hub-production worker",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// ============================================
// PLATFORM-SPECIFIC SYNC HANDLERS
// ============================================

async function handleNeonSync(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/neon", "");

  if (path === "/health" || path === "") {
    return new Response(
      JSON.stringify({
        platform: "neon",
        status: "healthy",
        features: ["postgresql", "event-store", "evidence-ledger"],
        endpoint: "sync.chitty.cc/neon",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      platform: "neon",
      message: "Neon PostgreSQL sync - implementation pending",
      features: [
        "Sync ChittySchema event store",
        "Evidence ledger",
        "Entity relationships",
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleGitHubSync(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/github", "");

  if (path === "/health" || path === "") {
    return new Response(
      JSON.stringify({
        platform: "github",
        status: "healthy",
        features: [
          "repository-sync",
          "worktree-management",
          "consolidated-state",
        ],
        endpoint: "sync.chitty.cc/github",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Delegate to ProjectOrchestrator for GitHub sync
  return new Response(
    JSON.stringify({
      platform: "github",
      message: "GitHub repository sync via ProjectOrchestrator",
      features: [
        "chittychat-data repo",
        "Consolidated state",
        "Session history",
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleDriveSync(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/drive", "");

  // ChittyOS Data Directory - Primary sync location
  const CHITTYOS_DATA =
    "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data";

  if (path === "/health" || path === "") {
    return new Response(
      JSON.stringify({
        platform: "drive",
        status: "healthy",
        features: ["chittyos-data", "evidence-storage", "cross-session-sync"],
        endpoint: "sync.chitty.cc/drive",
        chittyosData: CHITTYOS_DATA,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Sync chittyos-data directory
  if (path === "/chittyos-data" || path === "/sync") {
    const orchestrator = new ProjectOrchestrator(env);

    // Use ProjectOrchestrator to sync to GitHub
    // This maintains the "GitHub overlay" architecture
    try {
      const result = await orchestrator.syncConsolidatedState("chittyos-data", {
        syncedFrom: "drive",
        dataDirectory: CHITTYOS_DATA,
        timestamp: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          platform: "drive",
          synced: result.success,
          chittyosData: CHITTYOS_DATA,
          githubSync: result,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          platform: "drive",
          error: error.message,
          chittyosData: CHITTYOS_DATA,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(
    JSON.stringify({
      platform: "drive",
      message: "Google Drive sync via chittyos-data",
      features: [
        "Shared drives",
        "Evidence vault",
        "Cross-session file access",
      ],
      chittyosData: CHITTYOS_DATA,
      endpoints: {
        sync: "/drive/chittyos-data",
        health: "/drive/health",
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleCloudflareSync(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/cloudflare", "");

  if (path === "/health" || path === "") {
    return new Response(
      JSON.stringify({
        platform: "cloudflare",
        status: "healthy",
        features: ["r2-storage", "kv-cache", "d1-database"],
        endpoint: "sync.chitty.cc/cloudflare",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      platform: "cloudflare",
      message: "Cloudflare storage sync - implementation pending",
      features: ["R2 evidence files", "KV session cache", "D1 metadata"],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleLocalSync(context) {
  // Local sync requires Node.js runtime (fs, path, os APIs)
  // Not available in Cloudflare Workers
  return new Response(
    JSON.stringify({
      error: "Local sync only available via Node.js server",
      message:
        "The /local endpoints require filesystem access and are not available in Workers runtime",
      alternatives: [
        "Use cross-session-sync Node.js server for local file operations",
        "Use /api/project, /api/session for remote coordination",
        "Use platform-specific endpoints (/github, /notion, /drive) for platform sync",
      ],
    }),
    {
      status: 501,
      headers: { "Content-Type": "application/json" },
    },
  );

  /* LOCAL-ONLY CODE - Disabled in Workers build
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/local', '');
  const method = request.method;

  // Initialize consolidator
  const consolidator = new LocalConsolidator();
  const orchestrator = new ProjectOrchestrator(env);

  // Health check
  if (path === '/health' || path === '') {
    return new Response(
      JSON.stringify({
        platform: 'local',
        status: 'healthy',
        features: ['claude-projects', 'session-files', 'consolidation', 'todo-sync'],
        endpoint: 'sync.chitty.cc/local',
        availableEndpoints: [
          'POST /local/consolidate/:projectName',
          'POST /local/merge/:projectName',
          'POST /local/compact/:projectName',
          'GET /local/projects',
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // POST /local/consolidate/:projectName - Full workflow: merge + archive + sync to GitHub + orchestrate todos
  if (method === 'POST' && path.match(/^\/consolidate\/(.+)$/)) {
    const projectName = decodeURIComponent(path.split('/').pop());

    // Step 1: Consolidate session files and sync to GitHub
    const result = await orchestrator.consolidateAndSync(projectName);

    // Step 2: If successful and we have consolidated todos, orchestrate them to active sessions
    if (result.success && result.consolidatedState?.consolidatedTodos) {
      try {
        // Get active sessions for this project
        const projectId = `-/${projectName}`;
        const sessions = await env.PLATFORM_KV.get(`sessions:${projectId}`, { type: 'json' }) || [];
        const activeSessions = Array.isArray(sessions) ? sessions.filter(s => s.active) : [];

        if (activeSessions.length > 0) {
          // Orchestrate todos to active sessions
          const todoOrch = new TodoOrchestrator(env);
          const orchestrationResult = await todoOrch.orchestrateFromConsolidated(
            projectId,
            result.consolidatedState.consolidatedTodos,
            activeSessions
          );

          result.todoOrchestration = orchestrationResult;
        }
      } catch (orchError) {
        console.error('Error orchestrating todos:', orchError);
        result.todoOrchestrationError = orchError.message;
      }
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST /local/merge/:projectName - Local merge + archive only (no GitHub sync)
  if (method === 'POST' && path.match(/^\/merge\/(.+)$/)) {
    const projectName = decodeURIComponent(path.split('/').pop());
    const result = await consolidator.consolidateAndMerge(projectName);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // POST /local/compact/:projectName - Orchestrate native /compact with our consolidation
  // This endpoint runs our consolidation first, then returns instructions to run native /compact
  if (method === 'POST' && path.match(/^\/compact\/(.+)$/)) {
    const projectName = decodeURIComponent(path.split('/').pop());

    // Parse optional instructions from request body
    let instructions = null;
    let preservePatterns = [];

    try {
      const body = await request.json();
      instructions = body.instructions || body.direction || null;
      preservePatterns = body.preserve || body.keep || [];
    } catch (e) {
      // No body or invalid JSON - proceed without instructions
    }

    // Build compaction guidance from our consolidated state
    const projectState = await consolidator.getProjectConsolidatedState(projectName);

    // Create preservation instructions for native /compact
    const compactionInstructions = instructions || buildCompactionInstructions(projectState);

    // First run our consolidation with preservation hints
    const consolidateResult = await consolidator.consolidateAndMerge(projectName, {
      preservePatterns,
      compactionGuidance: compactionInstructions,
    });

    if (!consolidateResult.success) {
      return new Response(JSON.stringify(consolidateResult), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Then sync consolidated todos to unified list
    if (projectState?.consolidatedTodos) {
      await updateUnifiedTodos(env, projectName, projectState.consolidatedTodos);
    }

    // Return result with instructions to trigger native /compact
    return new Response(
      JSON.stringify({
        success: true,
        projectName,
        compacted: false, // Our consolidation done, native compact not yet triggered
        consolidated: consolidateResult.consolidated,
        archived: consolidateResult.archived,
        todosSynced: projectState?.consolidatedTodos?.length || 0,

        // Instructions for native /compact command
        nativeCompactInstructions: {
          command: '/compact',
          arguments: compactionInstructions,
          triggerNow: true,
          guidance: 'Preserve consolidated todos, active session context, and recent file operations',
        },

        // Patterns to preserve during native compaction
        preserveInNativeCompact: [
          ...preservePatterns,
          'TodoWrite',
          'consolidated',
          'ChittyID',
          projectState?.consolidatedTodos?.map((t) => t.content) || [],
        ].flat(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // GET /local/projects - List initialized projects
  if (method === 'GET' && path === '/projects') {
    const projects = await consolidator.getProjectDirectories();
    const initialized = [];

    for (const project of projects) {
      const isInit = await consolidator.isProjectInitialized(project.name);
      if (isInit) {
        initialized.push(project);
      }
    }

    return new Response(
      JSON.stringify({
        projects: initialized,
        count: initialized.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'Not Found',
      message: 'Local sync endpoint not found',
      available: [
        'POST /local/consolidate/:projectName',
        'POST /local/merge/:projectName',
        'POST /local/compact/:projectName',
        'GET /local/projects',
      ],
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }
  );
  */
}

/**
 * Sync Service Registrations
 * Registers services with ChittyFoundation Register (canonical)
 * Then syncs to ChittyCorp Registry (discovery)
 */
async function syncServiceRegistrations(env) {
  const REGISTER_URL = "https://register.chitty.cc"; // ChittyFoundation - Canonical
  const REGISTRY_URL = "https://registry.chitty.cc"; // ChittyCorp - Discovery

  const services = [
    {
      name: "identity",
      url: "https://id.chitty.cc",
      type: "core",
      provider: "ChittyFoundation",
      health_endpoint: "https://id.chitty.cc/health",
      features: ["chittyid-minting", "verification", "blockchain"],
    },
    {
      name: "sync",
      url: "https://sync.chitty.cc",
      type: "core",
      provider: "ChittyCorp",
      health_endpoint: "https://sync.chitty.cc/health",
      features: [
        "platform-integration",
        "project-sync",
        "session-sync",
        "topic-sync",
      ],
    },
    {
      name: "register",
      url: "https://register.chitty.cc",
      type: "core",
      provider: "ChittyFoundation",
      health_endpoint: "https://register.chitty.cc/health",
      features: ["canonical-registration", "authority"],
    },
    {
      name: "registry",
      url: "https://registry.chitty.cc",
      type: "core",
      provider: "ChittyCorp",
      health_endpoint: "https://registry.chitty.cc/health",
      features: ["service-discovery", "health-monitoring"],
    },
    {
      name: "auth",
      url: "https://auth.chitty.cc",
      type: "core",
      provider: "ChittyCorp",
      health_endpoint: "https://auth.chitty.cc/health",
      features: ["authentication", "authorization", "oauth"],
    },
    {
      name: "gateway",
      url: "https://gateway.chitty.cc",
      type: "core",
      provider: "ChittyCorp",
      health_endpoint: "https://gateway.chitty.cc/health",
      features: ["unified-entry", "routing", "load-balancing"],
    },
    {
      name: "canon",
      url: "https://canon.chitty.cc",
      type: "core",
      provider: "ChittyFoundation",
      health_endpoint: "https://canon.chitty.cc/health",
      features: ["canonical-data", "entity-resolution"],
    },
    {
      name: "schema",
      url: "https://schema.chitty.cc",
      type: "data",
      provider: "ChittyCorp",
      health_endpoint: "https://schema.chitty.cc/health",
      features: ["universal-schema", "event-store", "neon-db"],
    },
  ];

  const registeredToRegister = [];
  const registeredToRegistry = [];
  const failed = [];

  // Step 1: Register with ChittyFoundation Register (canonical authority)
  for (const service of services) {
    try {
      const response = await fetch(`${REGISTER_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service),
      });

      if (response.ok) {
        registeredToRegister.push(service.name);
      } else {
        console.error(
          `Failed to register ${service.name} with Register:`,
          response.status,
        );
      }
    } catch (error) {
      console.error(`Failed to register ${service.name} with Register:`, error);
    }
  }

  // Step 2: Sync to ChittyCorp Registry (discovery layer)
  for (const service of services) {
    try {
      const response = await fetch(`${REGISTRY_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service),
      });

      if (response.ok) {
        registeredToRegistry.push(service.name);
      } else {
        failed.push(service.name);
      }
    } catch (error) {
      console.error(`Failed to sync ${service.name} to Registry:`, error);
      failed.push(service.name);
    }
  }

  return {
    register: {
      registered: registeredToRegister,
      total: services.length,
      url: REGISTER_URL,
    },
    registry: {
      registered: registeredToRegistry,
      failed: failed,
      total: services.length,
      url: REGISTRY_URL,
    },
  };
}
