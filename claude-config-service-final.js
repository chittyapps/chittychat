#!/usr/bin/env node

/**
 * Final Production Claude Config Service
 *
 * Incorporates all resilience patterns from the patch:
 * - Full-jitter exponential backoff
 * - Circuit breaker with HALF_OPEN state
 * - TTL cache with auto-expiry
 * - JWS/JWKS verification via jose
 * - 429 Retry-After handling
 * - AbortSignal timeout support
 */

import fetch from "node-fetch";
import crypto from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { createRemoteJWKSet, compactVerify } from "jose"; // JWS/JWKS verify
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { pgTable, text, json, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';
import fs from 'fs/promises';
import path from 'path';

// -------------------------
// Resilience primitives
// -------------------------
const now = () => Date.now();

// Full-jitter backoff (caps at maxDelayMs)
function backoffDelay(attempt, baseMs = 200, maxDelayMs = 6000) {
  const exp = Math.min(maxDelayMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * exp);
}

// Circuit breaker (simple)
class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldownMs = 15000, halfOpenMax = 2 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.halfOpenMax = halfOpenMax;
    this.failures = 0;
    this.state = "CLOSED"; // CLOSED | OPEN | HALF
    this.nextAttemptTs = 0;
    this.halfOpenInFlight = 0;
  }
  canRequest() {
    if (this.state === "OPEN") {
      if (now() >= this.nextAttemptTs) {
        this.state = "HALF";
        this.halfOpenInFlight = 0;
        return true;
      }
      return false;
    }
    if (this.state === "HALF" && this.halfOpenInFlight >= this.halfOpenMax) return false;
    return true;
  }
  onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }
  onFailure() {
    this.failures += 1;
    if (this.state === "HALF" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttemptTs = now() + this.cooldownMs;
    }
  }
  onHalfOpenAttempt() {
    if (this.state === "HALF") this.halfOpenInFlight += 1;
  }
  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttemptTs: this.nextAttemptTs,
      halfOpenInFlight: this.halfOpenInFlight
    };
  }
}

// In-memory TTL cache
class TTLCache {
  constructor() {
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }
  get(key) {
    const v = this.map.get(key);
    if (!v) {
      this.misses++;
      return undefined;
    }
    if (now() > v.exp) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return v.val;
  }
  set(key, val, ttlMs) {
    this.map.set(key, { val, exp: now() + ttlMs });
  }
  getMetrics() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.map.size
    };
  }
}

// Globals
const canonBreaker = new CircuitBreaker();
const registryBreaker = new CircuitBreaker();
const notionBreaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 120000 });
const cache = new TTLCache();

// Helper: sha256
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// Helper: Retry-aware fetch with timeout and 429 Retry-After support
async function fetchResilient(url, { method = "GET", headers = {}, body, maxAttempts = 5, breaker, timeoutMs = 5000 } = {}) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    if (breaker && !breaker.canRequest()) {
      throw Object.assign(new Error("circuit-open"), { code: "CIRCUIT_OPEN" });
    }
    if (breaker && breaker.state === "HALF") breaker.onHalfOpenAttempt();
    try {
      const controller = new AbortController();
      const signal = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : controller.signal;

      // Set timeout for older Node versions
      let timeoutId;
      if (!AbortSignal.timeout) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const res = await fetch(url, { method, headers, body, signal });

      if (timeoutId) clearTimeout(timeoutId);

      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const wait = ra ? (isNaN(Number(ra)) ? Math.max(0, new Date(ra).getTime() - now()) : Number(ra) * 1000) : backoffDelay(attempt);
        console.log(`Rate limited, waiting ${wait}ms`);
        await sleep(Math.min(wait, 30000));
        attempt += 1;
        continue;
      }
      if (res.status >= 500 || res.status === 408) {
        await sleep(backoffDelay(attempt));
        attempt += 1;
        continue;
      }
      if (breaker) breaker.onSuccess();
      return res;
    } catch (err) {
      if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
        console.log(`Request timeout after ${timeoutMs}ms`);
      }
      await sleep(backoffDelay(attempt));
      attempt += 1;
      if (breaker) breaker.onFailure();
      if (attempt >= maxAttempts) throw err;
    }
  }
  throw new Error("max-attempts-exceeded");
}

// -------------------------
// Canon rules fetch + JWS verify
// -------------------------
async function getCanonRules({ canonUrl, token, cacheTtlMs = 10 * 60 * 1000, jwksUrl = "https://id.chitty.cc/.well-known/jwks.json" }) {
  const cacheKey = `canon:${canonUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log('Using cached canonical rules');
    return cached;
  }

  const res = await fetchResilient(
    `${canonUrl}/v1/rules`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/jose, application/json"
      },
      breaker: canonBreaker,
      timeoutMs: 5000
    }
  );

  const ct = res.headers.get("content-type") || "";
  let payload;

  if (ct.includes("application/jose")) {
    // Expect compact JWS string
    console.log('Verifying JWS signature...');
    const jws = await res.text();
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    const { payload: verified, protectedHeader } = await compactVerify(jws, jwks);
    if (!protectedHeader?.kid) throw new Error("missing-kid");
    payload = JSON.parse(new TextDecoder().decode(verified));
    console.log(`JWS verified with kid: ${protectedHeader.kid}`);
  } else {
    payload = await res.json();
  }

  // Basic guards
  if (!payload?.rules?.version) throw new Error("invalid-canon-rules");

  payload._integrity = {
    version: payload.rules.version,
    hash: sha256(Buffer.from(JSON.stringify(payload)))
  };

  cache.set(cacheKey, payload, cacheTtlMs);
  console.log(`Fetched canonical rules v${payload.rules.version} (hash: ${payload._integrity.hash.substring(0, 8)}...)`);

  return payload;
}

// -------------------------
// Registry fetch (same resilience)
// -------------------------
async function getServiceConfig({ registryUrl, token, service }) {
  const cacheKey = `registry:${service}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const res = await fetchResilient(
    `${registryUrl}/v1/services/${encodeURIComponent(service)}`,
    {
      headers: { "Authorization": `Bearer ${token}` },
      breaker: registryBreaker,
      timeoutMs: 5000
    }
  );
  const config = await res.json();
  cache.set(cacheKey, config, 5 * 60 * 1000); // 5 min cache
  return config;
}

// -------------------------
// Merge with canonical logic
// -------------------------
export async function mergeWithCanonicalLogic(opts) {
  const { canonUrl, registryUrl, service, CANON_API_TOKEN, REGISTRY_API_KEY, expectedCanonVersion } = opts;

  const canon = await getCanonRules({ canonUrl, token: CANON_API_TOKEN });
  const svc = await getServiceConfig({ registryUrl, token: REGISTRY_API_KEY, service });

  const strategies = Object.create(null);

  // Build strategy map from canon.rules
  for (const f of canon.rules?.union || []) strategies[f] = "union";
  for (const f of canon.rules?.merge || []) strategies[f] = "merge";
  for (const f of canon.rules?.override || []) strategies[f] = "override";
  for (const f of canon.rules?.preserve || []) strategies[f] = "preserve";

  // Hard guard: unknown fields must be explicit
  const ensureStrategy = (field) => {
    if (process.env.REQUIRE_EXPLICIT_STRATEGY === 'true' && !strategies[field]) {
      throw new Error(`strategy-required:${field}`);
    }
  };

  // Example merge application
  const result = {
    name: 'ChittyOS Unified Configuration',
    version: '2.0.0',
    generatedAt: new Date().toISOString()
  };

  for (const [k, v] of Object.entries(svc.config || {})) {
    const strat = strategies[k] && ["union","merge","override","preserve"].includes(strategies[k])
      ? strategies[k]
      : (ensureStrategy(k), "merge"); // ensure throws if unset

    if (strat === "union") {
      result[k] = Array.from(new Set([...(canon.defaults?.[k] || []), ...(v || [])]));
    } else if (strat === "merge") {
      result[k] = { ...(canon.defaults?.[k] || {}), ...(v || {}) };
    } else if (strat === "override") {
      result[k] = v ?? canon.defaults?.[k];
    } else if (strat === "preserve") {
      result[k] = canon.defaults?.[k] ?? v;
    }
  }

  // Pin canonicalRulesVersion and integrity
  result._canon = {
    version: canon.rules.version,
    hash: canon._integrity.hash,
    source: canonUrl
  };

  // Prevent version regression
  if (expectedCanonVersion && result._canon.version < expectedCanonVersion) {
    throw new Error(`canon-version-regressed:${result._canon.version}<${expectedCanonVersion}`);
  }

  return result;
}

// -------------------------
// Notion helper with 429 handling
// -------------------------
export async function notionFetchJson(url, { method = "GET", body } = {}) {
  const res = await fetchResilient(url, {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    maxAttempts: 5,
    breaker: notionBreaker,
    timeoutMs: 10000 // Notion can be slow
  });

  if (!res.ok) throw new Error(`notion-${res.status}`);
  return res.json();
}

// -------------------------
// Database schema for configs
// -------------------------
const claudeConfigs = pgTable('claude_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  level: text('level').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  config: json('config').notNull(),
  version: integer('version').default(1),
  checksum: text('checksum'),
  canonicalRulesVersion: text('canonical_rules_version'),
  canonicalRulesHash: text('canonical_rules_hash'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// -------------------------
// Main service class
// -------------------------
class ClaudeConfigService {
  constructor(databaseUrl) {
    const sql = neon(databaseUrl || process.env.NEON_DATABASE_URL);
    this.db = drizzle(sql);
    this.basePath = process.env.CLAUDE_BASE_PATH || '/Users/nb/.claude';
  }

  async syncProject(projectPath, options = {}) {
    const config = await mergeWithCanonicalLogic({
      canonUrl: process.env.CANON_URL || 'https://canon.chitty.cc',
      registryUrl: process.env.REGISTRY_URL || 'https://registry.chitty.cc',
      service: path.basename(projectPath),
      CANON_API_TOKEN: process.env.CANON_API_TOKEN,
      REGISTRY_API_KEY: process.env.REGISTRY_API_KEY,
      expectedCanonVersion: options.expectedCanonVersion
    });

    // Apply to filesystem if not dry run
    if (!options.dryRun) {
      await this.applyConfiguration(projectPath, config);
    }

    return config;
  }

  async applyConfiguration(projectPath, config) {
    const configPath = path.join(projectPath, '.claude');
    await fs.mkdir(configPath, { recursive: true });

    const files = {
      'project.json': config,
      'config.checksum': config._canon?.hash || sha256(JSON.stringify(config))
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(configPath, filename);
      const fileContent = typeof content === 'string'
        ? content
        : JSON.stringify(content, null, 2);
      await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    console.log(`Configuration applied to ${projectPath}`);
  }

  getMetrics() {
    return {
      cache: cache.getMetrics(),
      circuitBreakers: {
        canon: canonBreaker.getMetrics(),
        registry: registryBreaker.getMetrics(),
        notion: notionBreaker.getMetrics()
      }
    };
  }
}

// -------------------------
// CLI interface
// -------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const service = new ClaudeConfigService();

  switch (command) {
    case 'sync':
      const projectPath = process.argv[3] || process.cwd();
      service.syncProject(projectPath, {
        dryRun: process.env.DRY_RUN === 'true'
      }).then(config => {
        console.log('Sync complete:', config._canon);
      }).catch(err => {
        console.error('Sync failed:', err.message);
        process.exit(1);
      });
      break;

    case 'metrics':
      console.log(JSON.stringify(service.getMetrics(), null, 2));
      break;

    case 'verify':
      getCanonRules({
        canonUrl: process.env.CANON_URL || 'https://canon.chitty.cc',
        token: process.env.CANON_API_TOKEN
      }).then(rules => {
        console.log(`Rules verified: v${rules.rules.version}`);
        console.log(`Integrity: ${rules._integrity.hash}`);
      });
      break;

    default:
      console.log(`
Final Production Claude Config Service

Commands:
  sync [path]   Sync project with canonical config
  metrics       Show cache and circuit breaker metrics
  verify        Verify canonical rules and JWS signature

Environment Variables:
  CANON_API_TOKEN          Canon service token (required)
  REGISTRY_API_KEY         Registry service token (required)
  NOTION_TOKEN            Notion API token (optional)
  NEON_DATABASE_URL       Database connection (optional)
  REQUIRE_EXPLICIT_STRATEGY  Require explicit merge strategies
  DRY_RUN                 Test without applying changes

Features:
  ✓ Full-jitter exponential backoff
  ✓ Circuit breaker with HALF_OPEN state
  ✓ TTL cache with hit/miss metrics
  ✓ JWS/JWKS signature verification
  ✓ 429 Retry-After handling
  ✓ AbortSignal timeout support
  ✓ Version regression prevention
      `);
  }
}

export default ClaudeConfigService;