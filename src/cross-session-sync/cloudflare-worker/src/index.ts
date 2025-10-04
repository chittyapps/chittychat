import { Router } from "itty-router";
import { SessionCoordinator } from "./session-coordinator";
import { generateChittyID } from "../../../lib/chittyid-service.js";

export interface Env {
  SESSIONS: KVNamespace;
  TASKS: KVNamespace;
  LOCKS: KVNamespace;
  DB: D1Database;
  SESSION_COORDINATOR: DurableObjectNamespace;
  NEON_DATABASE_URL: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
}

const router = Router();

router.post("/session/register", async (request: Request, env: Env) => {
  const { name, metadata } = await request.json();

  // POLICY: Use ChittyID service - NEVER generate locally
  const sessionId = await generateChittyID("CONTEXT", {
    type: "sync_session",
    name,
    ...metadata,
  });
  const session = {
    id: sessionId,
    name: name || `session-${sessionId.slice(0, 12)}`,
    startTime: Date.now(),
    lastHeartbeat: Date.now(),
    status: "active",
    metadata,
    tasks: [],
    locks: [],
    worktree: null,
  };

  await env.SESSIONS.put(sessionId, JSON.stringify(session), {
    expirationTtl: 3600,
  });

  const coordinatorId = env.SESSION_COORDINATOR.idFromName("global");
  const coordinator = env.SESSION_COORDINATOR.get(coordinatorId);
  await coordinator.fetch(
    new Request("http://internal/register", {
      method: "POST",
      body: JSON.stringify(session),
    }),
  );

  return new Response(JSON.stringify(session), {
    headers: { "Content-Type": "application/json" },
  });
});

router.post(
  "/session/:id/heartbeat",
  async (request: Request, env: Env, ctx: any) => {
    const { id } = ctx.params;

    const sessionData = await env.SESSIONS.get(id);
    if (!sessionData) {
      return new Response("Session not found", { status: 404 });
    }

    const session = JSON.parse(sessionData);
    session.lastHeartbeat = Date.now();

    await env.SESSIONS.put(id, JSON.stringify(session), {
      expirationTtl: 3600,
    });

    return new Response(
      JSON.stringify({ success: true, timestamp: session.lastHeartbeat }),
    );
  },
);

router.get("/sessions/active", async (request: Request, env: Env) => {
  const sessions = [];
  const list = await env.SESSIONS.list();

  for (const key of list.keys) {
    const sessionData = await env.SESSIONS.get(key.name);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (
        session.status === "active" &&
        Date.now() - session.lastHeartbeat < 30000
      ) {
        sessions.push(session);
      }
    }
  }

  return new Response(JSON.stringify(sessions), {
    headers: { "Content-Type": "application/json" },
  });
});

router.post("/task/claim", async (request: Request, env: Env) => {
  const { sessionId, taskId } = await request.json();

  const lockKey = `task:${taskId}`;
  const existingLock = await env.LOCKS.get(lockKey);

  if (existingLock) {
    const lock = JSON.parse(existingLock);
    if (Date.now() - lock.timestamp < 600000) {
      return new Response(
        JSON.stringify({
          success: false,
          owner: lock.sessionId,
        }),
        { status: 409 },
      );
    }
  }

  const lock = {
    sessionId,
    taskId,
    timestamp: Date.now(),
  };

  await env.LOCKS.put(lockKey, JSON.stringify(lock), {
    expirationTtl: 600,
  });

  const sessionData = await env.SESSIONS.get(sessionId);
  if (sessionData) {
    const session = JSON.parse(sessionData);
    session.tasks.push(taskId);
    await env.SESSIONS.put(sessionId, JSON.stringify(session), {
      expirationTtl: 3600,
    });
  }

  return new Response(JSON.stringify({ success: true, lock }));
});

router.post("/task/release", async (request: Request, env: Env) => {
  const { sessionId, taskId } = await request.json();

  const lockKey = `task:${taskId}`;
  const existingLock = await env.LOCKS.get(lockKey);

  if (existingLock) {
    const lock = JSON.parse(existingLock);
    if (lock.sessionId === sessionId) {
      await env.LOCKS.delete(lockKey);

      const sessionData = await env.SESSIONS.get(sessionId);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.tasks = session.tasks.filter((t: string) => t !== taskId);
        await env.SESSIONS.put(sessionId, JSON.stringify(session), {
          expirationTtl: 3600,
        });
      }

      return new Response(JSON.stringify({ success: true }));
    }
  }

  return new Response(JSON.stringify({ success: false }), { status: 403 });
});

router.post("/lock/acquire", async (request: Request, env: Env) => {
  const { sessionId, resource } = await request.json();

  const lockKey = `resource:${resource}`;
  const existingLock = await env.LOCKS.get(lockKey);

  if (existingLock) {
    const lock = JSON.parse(existingLock);
    if (Date.now() - lock.timestamp < 30000) {
      return new Response(
        JSON.stringify({
          success: false,
          owner: lock.sessionId,
        }),
        { status: 409 },
      );
    }
  }

  const lock = {
    sessionId,
    resource,
    timestamp: Date.now(),
  };

  await env.LOCKS.put(lockKey, JSON.stringify(lock), {
    expirationTtl: 30,
  });

  return new Response(JSON.stringify({ success: true, lock }));
});

router.post("/lock/release", async (request: Request, env: Env) => {
  const { sessionId, resource } = await request.json();

  const lockKey = `resource:${resource}`;
  const existingLock = await env.LOCKS.get(lockKey);

  if (existingLock) {
    const lock = JSON.parse(existingLock);
    if (lock.sessionId === sessionId) {
      await env.LOCKS.delete(lockKey);
      return new Response(JSON.stringify({ success: true }));
    }
  }

  return new Response(JSON.stringify({ success: false }), { status: 403 });
});

router.post("/github/worktree/create", async (request: Request, env: Env) => {
  const { sessionId, branch } = await request.json();

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: "main",
      }),
    },
  );

  if (response.ok) {
    const sessionData = await env.SESSIONS.get(sessionId);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.worktree = branch;
      await env.SESSIONS.put(sessionId, JSON.stringify(session), {
        expirationTtl: 3600,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        branch,
      }),
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: await response.text(),
    }),
    { status: response.status },
  );
});

router.post("/neon/state/save", async (request: Request, env: Env) => {
  const { sessionId, state } = await request.json();

  const timestamp = Date.now();
  // POLICY: Use ChittyID service - NEVER generate locally
  const version = await generateChittyID("INFO", {
    type: "state_version",
    sessionId,
    timestamp,
  });
  const stateRecord = {
    session_id: sessionId,
    state: JSON.stringify(state),
    timestamp,
    version,
  };

  await env.DB.prepare(
    "INSERT INTO session_states (session_id, state, timestamp, version) VALUES (?, ?, ?, ?)",
  )
    .bind(
      stateRecord.session_id,
      stateRecord.state,
      stateRecord.timestamp,
      stateRecord.version,
    )
    .run();

  return new Response(
    JSON.stringify({
      success: true,
      version: stateRecord.version,
    }),
  );
});

router.get(
  "/neon/state/:sessionId",
  async (request: Request, env: Env, ctx: any) => {
    const { sessionId } = ctx.params;

    const result = await env.DB.prepare(
      "SELECT * FROM session_states WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1",
    )
      .bind(sessionId)
      .first();

    if (result) {
      return new Response(
        JSON.stringify({
          state: JSON.parse(result.state as string),
          version: result.version,
          timestamp: result.timestamp,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("State not found", { status: 404 });
  },
);

router.get("/sync/status", async (request: Request, env: Env) => {
  const coordinatorId = env.SESSION_COORDINATOR.idFromName("global");
  const coordinator = env.SESSION_COORDINATOR.get(coordinatorId);

  const response = await coordinator.fetch(
    new Request("http://internal/status"),
  );
  const status = await response.json();

  return new Response(JSON.stringify(status), {
    headers: { "Content-Type": "application/json" },
  });
});

router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return router.handle(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const sessions = await env.SESSIONS.list();

    for (const key of sessions.keys) {
      const sessionData = await env.SESSIONS.get(key.name);
      if (sessionData) {
        const session = JSON.parse(sessionData);

        if (Date.now() - session.lastHeartbeat > 60000) {
          session.status = "stale";
          await env.SESSIONS.put(key.name, JSON.stringify(session), {
            expirationTtl: 300,
          });

          for (const taskId of session.tasks) {
            await env.LOCKS.delete(`task:${taskId}`);
          }
          for (const lock of session.locks) {
            await env.LOCKS.delete(`resource:${lock}`);
          }
        }
      }
    }
  },
};

export { SessionCoordinator };
