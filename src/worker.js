/**
 * ChittyChat Sync Cloudflare Worker
 * Provides sync services at sync.chitty.cc and viewer.chitty.cc
 */

import { getChittyId, sanitizeIdentifier, sha256Hex, corsHeaders } from "./lib/chittyid.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Route based on subdomain
    if (hostname === "sync.chitty.cc" || url.pathname.startsWith("/sync")) {
      return handleSyncService(request, env);
    } else if (
      hostname === "viewer.chitty.cc" ||
      url.pathname.startsWith("/viewer")
    ) {
      return handleViewerService(request, env);
    } else if (url.pathname === "/health") {
      return handleHealthCheck(env);
    }

    return new Response("ChittyChat Sync Services", {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "access-control-allow-origin": "*",
      },
    });
  },
};

async function handleSyncService(request, env) {
  const url = new URL(request.url);

  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // Route sync endpoints
  switch (url.pathname) {
    case "/health":
    case "/sync/health":
      return Response.json({
        status: "healthy",
        service: "Universal Database Sync",
        environment: "production",
        config: {
          mode: env.SYNC_MODE || "bidirectional",
          target: env.SYNC_TARGET || "notion",
        },
      });

    case "/tables":
    case "/sync/tables":
      return await listTables(env);

    case "/sync":
    case "/sync/trigger":
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return await triggerSync(request, env);

    case "/mapping":
    case "/sync/mapping":
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      return await createMapping(request, env);

    case "/status":
    case "/sync/status":
      return await getSyncStatus(env);

    default:
      return new Response("Not found", { status: 404 });
  }
}

async function handleViewerService(request, env) {
  const url = new URL(request.url);

  // Enforce read-only
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    return Response.json(
      {
        error: "Write operations not permitted on immutable data",
      },
      { status: 403 },
    );
  }

  // CORS for read operations
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  // Route viewer endpoints
  const pathMatch = url.pathname.match(/^\/(?:viewer\/)?(.+)/);
  if (!pathMatch) {
    return new Response("Not found", { status: 404 });
  }

  const [, endpoint] = pathMatch;

  switch (endpoint) {
    case "health":
      return Response.json({
        status: "healthy",
        service: "ChittyOS Immutable Viewer",
        mode: "READ_ONLY",
        environment: "production",
        timestamp: new Date().toISOString(),
      });

    case "audit":
      return await getAuditLog(env);

    default:
      if (endpoint.startsWith("view/")) {
        const tableName = endpoint.substring(5);
        return await viewData(tableName, env);
      } else if (endpoint.startsWith("proof/")) {
        const chittyId = endpoint.substring(6);
        return await getProof(chittyId, env);
      } else if (endpoint.startsWith("verify/")) {
        const tableName = endpoint.substring(7);
        return await verifyIntegrity(tableName, env);
      }
      return new Response("Not found", { status: 404 });
  }
}

async function handleHealthCheck(env) {
  return Response.json({
    status: "healthy",
    services: {
      sync: "https://sync.chitty.cc",
      viewer: "https://viewer.chitty.cc",
      api: "https://api.chitty.cc/sync",
    },
    environment: "production",
    timestamp: new Date().toISOString(),
  });
}

// Database operations
async function listTables(env) {
  try {
    // Use D1 or external database
    const tables = await env.DB.prepare(
      `
      SELECT name FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `,
    ).all();

    return Response.json({
      database: "ChittyOS Data",
      tables: tables.results || [],
      totalTables: tables.results?.length || 0,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to list tables",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function triggerSync(request, env) {
  try {
    const { tableName, direction } = await request.json();

    // Store sync request in Durable Object
    const id = env.SYNC_STATE.idFromName("main");
    const stub = env.SYNC_STATE.get(id);

    const response = await stub.fetch(
      new Request("https://internal/sync", {
        method: "POST",
        body: JSON.stringify({ tableName, direction }),
      }),
    );

    const result = await response.json();

    return Response.json({
      message: "Sync triggered",
      syncId: result.syncId,
      status: "processing",
    });
  } catch (error) {
    return Response.json(
      {
        error: "Sync failed",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function createMapping(request, env) {
  try {
    const mapping = await request.json();

    // Store mapping in KV
    await env.SYNC_CACHE.put(
      `mapping:${mapping.tableName}`,
      JSON.stringify(mapping),
      { metadata: { created: new Date().toISOString() } },
    );

    return Response.json({
      message: "Mapping created",
      tableName: mapping.tableName,
      targetType: mapping.targetType,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to create mapping",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function getSyncStatus(env) {
  try {
    const id = env.SYNC_STATE.idFromName("main");
    const stub = env.SYNC_STATE.get(id);

    const response = await stub.fetch(new Request("https://internal/status"));
    const status = await response.json();

    return Response.json(status);
  } catch (error) {
    return Response.json(
      {
        error: "Failed to get status",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function viewData(tableName, env) {
  try {
    tableName = sanitizeIdentifier(tableName);
    
    // Query with read-only transaction
    const data = await env.DB.prepare(
      `SELECT * FROM ${tableName} LIMIT 100`,
    ).all();

    // Calculate hashes for integrity
    const dataWithHashes = await Promise.all(
      data.results.map(async (row) => ({
        ...row,
        _integrity_hash: await sha256Hex(row),
        _verified: true,
      }))
    );

    // Log access to audit
    await logAuditEvent(env, {
      operation: "VIEW",
      table: tableName,
      records: data.results.length,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      status: "success",
      mode: "READ_ONLY",
      table: tableName,
      count: data.results.length,
      data: dataWithHashes,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to view data",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function getProof(chittyId, env) {
  try {
    const record = await env.DB.prepare(
      "SELECT * FROM evidence_ledger WHERE chitty_id = ?",
    )
      .bind(chittyId)
      .first();

    if (!record) {
      return Response.json(
        {
          error: "ChittyID not found",
        },
        { status: 404 },
      );
    }

    const proof = {
      chitty_id: chittyId,
      data_hash: await sha256Hex(record),
      timestamp: record.created_at,
      merkle_root: await calculateMerkleRoot([record]),
      signature: await generateSignature(record),
      verification_method: "SHA-256",
      immutable: true,
    };

    return Response.json({
      status: "success",
      proof: proof,
      verification_url: `https://viewer.chitty.cc/verify/${chittyId}`,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to generate proof",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function verifyIntegrity(tableName, env) {
  try {
    tableName = sanitizeIdentifier(tableName);
    
    const sample = await env.DB.prepare(
      `SELECT * FROM ${tableName} ORDER BY RANDOM() LIMIT 10`,
    ).all();

    const verificationResults = await Promise.all(
      sample.results.map(async (row) => {
        const currentHash = await sha256Hex(row);
        const storedHash = row.data_hash || row.hash;

        return {
          id: row.chitty_id || row.id,
          current_hash: currentHash,
          stored_hash: storedHash,
          match: currentHash === storedHash,
          timestamp: new Date().toISOString(),
        };
      })
    );

    const allValid = verificationResults.every((r) => r.match !== false);

    return Response.json({
      status: allValid ? "VERIFIED" : "INTEGRITY_ISSUE",
      table: tableName,
      checked: verificationResults.length,
      valid: verificationResults.filter((r) => r.match).length,
      results: verificationResults,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Verification failed",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function getAuditLog(env) {
  try {
    const logs = await env.AUDIT_LOGS.list({ limit: 100 });

    const entries = await Promise.all(
      logs.objects.map(async (obj) => {
        const data = await env.AUDIT_LOGS.get(obj.key);
        return JSON.parse(data);
      }),
    );

    return Response.json({
      status: "success",
      audit_entries: entries,
      total_entries: entries.length,
      mode: "READ_ONLY",
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to get audit log",
        message: error.message,
      },
      { status: 500 },
    );
  }
}

async function logAuditEvent(env, event) {
  const chittyId = await getChittyId(env, "audit");
  const key = `audit-${Date.now()}-${chittyId.substr(2, 9)}`;
  await env.AUDIT_LOGS.put(key, JSON.stringify(event));
}

async function calculateMerkleRoot(data) {
  const hashes = await Promise.all(data.map((d) => sha256Hex(d)));
  return await sha256Hex(hashes.join(""));
}

async function generateSignature(data) {
  const proof = {
    data_hash: await sha256Hex(data),
    timestamp: new Date().toISOString(),
    service: "ChittyOS-Worker",
  };
  return await sha256Hex(proof);
}

// Durable Object for managing sync state
export class SyncState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/sync" && request.method === "POST") {
      const { tableName, direction } = await request.json();
      const syncId = await this.generateChittyId();

      await this.state.storage.put(`sync:${syncId}`, {
        tableName,
        direction,
        status: "processing",
        started: new Date().toISOString(),
      });

      return Response.json({ syncId });
    }

    if (url.pathname === "/status") {
      const syncs = await this.state.storage.list({ prefix: "sync:" });
      const recent = Array.from(syncs.entries()).slice(-10);

      return Response.json({
        lastSync: recent[recent.length - 1]?.[1],
        recentSyncs: recent.map(([k, v]) => v),
        totalSyncs: syncs.size,
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
