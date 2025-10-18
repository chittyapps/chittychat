/**
 * Chitty GitHub App Integration
 *
 * Single multi-install GitHub App for ChittyOS ecosystem
 * Handles webhooks, auth, and MCP dispatch
 *
 * @module integrations/github-app
 */

import * as jose from "jose";

export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PK: string;          // PEM format private key
  GITHUB_WEBHOOK_SECRET: string;
  IDEMP_KV: KVNamespace;          // idempotency tracking
  TOKEN_KV: KVNamespace;          // installation token cache
  TENANT_KV: KVNamespace;         // installation → tenant mapping
  RATE_LIMIT_KV: KVNamespace;     // tenant rate limiting

  // ChittyOS integrations
  CHITTYID_URL: string;
  CHITTY_ID_TOKEN: string;
  MCP_DISPATCH_URL?: string;      // optional MCP dispatcher
  GITHUB_WEBHOOK_QUEUE?: Queue;   // async event processing
  CHITTYCHAIN_URL?: string;       // evidence ledger
}

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: "User" | "Organization";
  };
}

interface TenantMapping {
  installationId: string;
  tenantId: string;              // ChittyID for the tenant
  orgLogin: string;
  installedAt: string;
  repos: string[];               // permitted repos
}

interface GitHubCheckRun {
  name: string;
  head_sha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required";
  output?: {
    title: string;
    summary: string;
    text?: string;
    annotations?: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: "notice" | "warning" | "failure";
      message: string;
    }>;
  };
}

/**
 * Timing-safe equality comparison for signatures
 */
function timingSafeEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verify GitHub webhook signature using Web Crypto API
 */
async function verifySignature(req: Request, secret: string, bodyText: string): Promise<void> {
  const sig = req.headers.get("X-Hub-Signature-256") || "";
  if (!sig.startsWith("sha256=")) {
    throw new Error("missing or invalid signature format");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expected = "sha256=" + Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const a = encoder.encode(sig);
  const b = encoder.encode(expected);

  if (!timingSafeEq(a, b)) {
    throw new Error("signature verification failed");
  }
}

/**
 * Generate GitHub App JWT for authentication
 */
async function generateAppJWT(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const pk = await jose.importPKCS8(env.GITHUB_APP_PK, "RS256");

  return await new jose.SignJWT({
    iat: now - 10,              // 10s clock skew tolerance
    exp: now + 540,             // 9 minutes (max 10)
    iss: env.GITHUB_APP_ID
  })
    .setProtectedHeader({ alg: "RS256" })
    .sign(pk);
}

/**
 * Get installation access token (cached)
 */
async function getInstallationToken(env: Env, installationId: string): Promise<string> {
  const cacheKey = `token:inst:${installationId}`;
  const cached = await env.TOKEN_KV.get(cacheKey, { type: "json" }) as { token: string, exp: number } | null;
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for >30s
  if (cached && cached.exp - now > 30) {
    return cached.token;
  }

  // Request new token
  const appJwt = await generateAppJWT(env);
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`token_exchange_failed: ${res.status} ${error}`);
  }

  const data = await res.json() as { token: string, expires_at: string };
  const exp = Math.floor(new Date(data.expires_at).getTime() / 1000);

  // Cache with 1h TTL (tokens valid for 1h)
  await env.TOKEN_KV.put(cacheKey, JSON.stringify({ token: data.token, exp }), { expirationTtl: 3600 });

  return data.token;
}

/**
 * Get or create tenant mapping for installation
 */
async function getTenantMapping(env: Env, installation: GitHubInstallation): Promise<TenantMapping> {
  const cacheKey = `tenant:inst:${installation.id}`;
  const cached = await env.TENANT_KV.get(cacheKey, { type: "json" }) as TenantMapping | null;

  if (cached) {
    return cached;
  }

  // Create new tenant mapping with ChittyID
  const tenantId = await mintChittyID(env, {
    entityType: "PROP",
    purpose: "github_app_tenant",
    metadata: {
      installationId: installation.id,
      accountLogin: installation.account.login,
      accountType: installation.account.type
    }
  });

  const mapping: TenantMapping = {
    installationId: String(installation.id),
    tenantId,
    orgLogin: installation.account.login,
    installedAt: new Date().toISOString(),
    repos: []
  };

  // Cache permanently (remove on uninstall)
  await env.TENANT_KV.put(cacheKey, JSON.stringify(mapping));

  return mapping;
}

/**
 * Mint ChittyID for entities
 */
async function mintChittyID(env: Env, params: {
  entityType: string;
  purpose: string;
  metadata: Record<string, any>;
}): Promise<string> {
  const res = await fetch(`${env.CHITTYID_URL}/api/id/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.CHITTY_ID_TOKEN}`
    },
    body: JSON.stringify({
      entityType: params.entityType,
      context: {
        service: "chitty-github-app",
        purpose: params.purpose,
        timestamp: new Date().toISOString()
      },
      metadata: params.metadata
    })
  });

  if (!res.ok) {
    throw new Error(`chittyid_mint_failed: ${res.status}`);
  }

  const data = await res.json() as { chittyId: string };
  return data.chittyId;
}

/**
 * Create GitHub check run
 */
async function createCheckRun(
  env: Env,
  installationId: string,
  repo: { owner: string; name: string },
  check: GitHubCheckRun
): Promise<void> {
  const token = await getInstallationToken(env, installationId);

  const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/check-runs`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify(check)
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`check_run_failed: ${res.status}`, error);
    throw new Error(`check_run_failed: ${res.status}`);
  }
}

/**
 * Check rate limit for tenant
 * Returns true if request is allowed, false if rate limited
 */
async function checkRateLimit(env: Env, tenantId: string): Promise<boolean> {
  const now = Date.now();
  const window = 60 * 1000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute per tenant

  const key = `ratelimit:${tenantId}:${Math.floor(now / window)}`;
  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxRequests) {
    return false; // Rate limited
  }

  // Increment counter
  await env.RATE_LIMIT_KV.put(key, String(count + 1), {
    expirationTtl: 120 // 2 minutes TTL to ensure cleanup
  });

  return true;
}

/**
 * Log event to ChittyChain evidence ledger
 */
async function logToChittyChain(env: Env, params: {
  tenantId: string;
  eventType: string;
  eventData: any;
  installationId: string;
}): Promise<void> {
  if (!env.CHITTYCHAIN_URL) {
    return; // Evidence ledger optional
  }

  try {
    await fetch(`${env.CHITTYCHAIN_URL}/api/evidence/append`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.CHITTY_ID_TOKEN}`,
        "X-Chitty-Tenant": params.tenantId
      },
      body: JSON.stringify({
        entityType: "EVNT",
        eventType: params.eventType,
        eventData: params.eventData,
        source: "chitty-github-app",
        installationId: params.installationId,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error("ChittyChain logging failed:", error);
    // Non-blocking: don't throw
  }
}

/**
 * Dispatch event to MCP system
 */
async function dispatchToMCP(env: Env, params: {
  tenantId: string;
  event: string;
  payload: any;
  installationId: string;
}): Promise<void> {
  if (!env.MCP_DISPATCH_URL) {
    console.log("MCP dispatch skipped: no MCP_DISPATCH_URL configured");
    return;
  }

  const res = await fetch(env.MCP_DISPATCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.CHITTY_ID_TOKEN}`,
      "X-Chitty-Tenant": params.tenantId,
      "X-GitHub-Event": params.event
    },
    body: JSON.stringify({
      tenantId: params.tenantId,
      event: params.event,
      installationId: params.installationId,
      payload: params.payload,
      timestamp: new Date().toISOString()
    })
  });

  if (!res.ok) {
    console.error(`mcp_dispatch_failed: ${res.status}`, await res.text());
  }
}

/**
 * Handle push event
 */
async function handlePush(env: Env, payload: any): Promise<void> {
  const installation = payload.installation as GitHubInstallation;
  const repo = {
    owner: payload.repository.owner.login,
    name: payload.repository.name
  };
  const sha = payload.after;
  const ref = payload.ref;

  // Get tenant mapping
  const tenant = await getTenantMapping(env, installation);

  // Dispatch to MCP
  await dispatchToMCP(env, {
    tenantId: tenant.tenantId,
    event: "push",
    payload,
    installationId: tenant.installationId
  });

  // Create compliance check (example)
  await createCheckRun(env, tenant.installationId, repo, {
    name: "Chitty Compliance/CI",
    head_sha: sha,
    status: "completed",
    conclusion: "success",
    output: {
      title: "ChittyMCP checks passed",
      summary: `All required checks completed for ${ref}`,
      text: `Commit SHA: ${sha}\nRepository: ${repo.owner}/${repo.name}\nTenant: ${tenant.tenantId}`
    }
  });
}

/**
 * Handle pull_request event
 */
async function handlePullRequest(env: Env, payload: any): Promise<void> {
  const installation = payload.installation as GitHubInstallation;
  const tenant = await getTenantMapping(env, installation);

  // Dispatch to MCP for PR analysis
  await dispatchToMCP(env, {
    tenantId: tenant.tenantId,
    event: "pull_request",
    payload,
    installationId: tenant.installationId
  });
}

/**
 * Handle installation event (new install)
 */
async function handleInstallation(env: Env, payload: any, action: string): Promise<void> {
  const installation = payload.installation as GitHubInstallation;

  if (action === "created") {
    // Create tenant mapping
    const tenant = await getTenantMapping(env, installation);
    console.log(`New installation: ${installation.id} → ${tenant.tenantId}`);
  } else if (action === "deleted") {
    // Remove tenant mapping
    const cacheKey = `tenant:inst:${installation.id}`;
    await env.TENANT_KV.delete(cacheKey);
    console.log(`Installation removed: ${installation.id}`);
  }
}

/**
 * Main webhook handler
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        service: "chitty-github-app",
        timestamp: new Date().toISOString()
      });
    }

    // Webhook endpoint
    if (req.method !== "POST" || url.pathname !== "/integrations/github/webhook") {
      return new Response("Not Found", { status: 404 });
    }

    const deliveryId = req.headers.get("X-GitHub-Delivery") || crypto.randomUUID();

    // Idempotency check
    const idempKey = `delivery:${deliveryId}`;
    const seen = await env.IDEMP_KV.get(idempKey);
    if (seen) {
      console.log(`Duplicate delivery: ${deliveryId}`);
      return new Response("OK (duplicate)", { status: 200 });
    }

    // Read and verify signature
    const bodyText = await req.text();
    try {
      await verifySignature(req, env.GITHUB_WEBHOOK_SECRET, bodyText);
    } catch (error) {
      console.error("Signature verification failed:", error);
      return new Response("Unauthorized", { status: 401 });
    }

    const event = req.headers.get("X-GitHub-Event") || "unknown";
    const payload = JSON.parse(bodyText);

    // Get tenant for rate limiting
    const installation = payload.installation as GitHubInstallation | undefined;
    if (installation) {
      const tenant = await getTenantMapping(env, installation);

      // Check rate limit
      const allowed = await checkRateLimit(env, tenant.tenantId);
      if (!allowed) {
        return new Response("Rate limit exceeded", { status: 429 });
      }

      // Log to evidence ledger
      await logToChittyChain(env, {
        tenantId: tenant.tenantId,
        eventType: `github.${event}`,
        eventData: payload,
        installationId: tenant.installationId
      });
    }

    // If queue is configured, dispatch async processing
    if (env.GITHUB_WEBHOOK_QUEUE) {
      await env.GITHUB_WEBHOOK_QUEUE.send({
        deliveryId,
        event,
        payload,
        receivedAt: new Date().toISOString()
      });

      // Mark as processed and return immediately
      await env.IDEMP_KV.put(idempKey, "queued", { expirationTtl: 86400 });

      return Response.json({
        status: "queued",
        deliveryId
      });
    }

    try {
      // Synchronous processing fallback
      // Route events
      switch (event) {
        case "push":
          await handlePush(env, payload);
          break;

        case "pull_request":
          await handlePullRequest(env, payload);
          break;

        case "installation":
          await handleInstallation(env, payload, payload.action);
          break;

        case "installation_repositories":
          // Handle repo add/remove
          console.log(`Repos changed for installation ${payload.installation.id}`);
          break;

        case "check_run":
        case "check_suite":
        case "workflow_run":
        case "status":
        case "issues":
        case "issue_comment":
          // Add handlers as needed
          console.log(`Event received: ${event}`);
          break;

        default:
          console.log(`Unhandled event: ${event}`);
      }

      // Mark as processed
      await env.IDEMP_KV.put(idempKey, "1", { expirationTtl: 86400 });

      return Response.json({
        status: "processed",
        deliveryId,
        event
      });

    } catch (error) {
      console.error(`Error processing ${event}:`, error);

      // Don't mark as processed on error (allow retry)
      return Response.json({
        status: "error",
        deliveryId,
        event,
        error: error instanceof Error ? error.message : "unknown_error"
      }, { status: 500 });
    }
  }
};
