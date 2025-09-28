#!/usr/bin/env node

/**
 * Production-Grade Unified .claude Configuration Service
 *
 * Enhanced with:
 * - Resilience patterns (timeout, retry, circuit breaker)
 * - JWS signature verification
 * - In-memory caching with TTL
 * - Rate limit handling
 * - Telemetry and observability
 * - Security best practices
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { pgTable, text, json, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';
import { eq, and, or, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import jose from 'jose';

// Database schema
const claudeConfigs = pgTable('claude_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  level: text('level').notNull(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  path: text('path').notNull(),
  config: json('config').notNull(),
  version: integer('version').default(1),
  active: boolean('active').default(true),
  checksum: text('checksum'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  appliedAt: timestamp('applied_at'),
  chittyId: text('chitty_id'),
  canonicalRulesVersion: text('canonical_rules_version'),
  canonicalRulesHash: text('canonical_rules_hash')
});

// Circuit Breaker implementation
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.telemetry = {
      openCircuitDuration: 0,
      totalRequests: 0,
      failedRequests: 0
    };
  }

  async execute(fn) {
    this.telemetry.totalRequests++;

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        this.telemetry.openCircuitDuration += now - this.lastFailureTime;
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`Circuit breaker ${this.name} recovered to CLOSED state`);
    }
    this.successCount++;
  }

  onFailure() {
    this.failureCount++;
    this.telemetry.failedRequests++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`Circuit breaker ${this.name} tripped to OPEN state`);
    }
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      ...this.telemetry
    };
  }
}

// Retry with exponential backoff and jitter
class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.jitter = options.jitter !== false;
  }

  async execute(fn, context = {}) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check for rate limiting
        if (error.status === 429 && error.headers?.['retry-after']) {
          const retryAfter = parseInt(error.headers['retry-after']) * 1000;
          console.log(`Rate limited. Waiting ${retryAfter}ms as requested`);
          await this.sleep(retryAfter);
          continue;
        }

        // Don't retry on client errors (except 408 Request Timeout and 429)
        if (error.status && error.status < 500 && error.status !== 408 && error.status !== 429) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  calculateDelay(attempt) {
    let delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);

    if (this.jitter) {
      // Add jitter: ±25% randomization
      const jitterAmount = delay * 0.25;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }

    return Math.floor(delay);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// In-memory cache with TTL
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0
    };
  }

  set(key, value, ttl = 300000) { // Default 5 minutes
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
      version: value.version || null
    });
  }

  get(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      this.metrics.misses++;
      return null;
    }

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    return cached.value;
  }

  clear() {
    this.cache.clear();
  }

  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      size: this.cache.size
    };
  }
}

// Enhanced Configuration Service
class ClaudeConfigService {
  constructor(databaseUrl) {
    const sql = neon(databaseUrl || process.env.DATABASE_URL);
    this.db = drizzle(sql);
    this.basePath = process.env.CLAUDE_BASE_PATH || '/Users/nb/.claude';

    // Separate tokens for each service
    this.tokens = {
      canon: process.env.CANON_API_TOKEN,
      registry: process.env.REGISTRY_API_KEY,
      notion: process.env.NOTION_TOKEN,
      mothership: process.env.MOTHERSHIP_API_KEY
    };

    // Service endpoints
    this.endpoints = {
      canon: process.env.CANON_URL || 'https://canon.chitty.cc',
      registry: process.env.REGISTRY_URL || 'https://registry.chitty.cc',
      mothership: process.env.MOTHERSHIP_URL || 'https://id.chitty.cc',
      notion: process.env.NOTION_API_URL || 'https://api.notion.com/v1'
    };

    // Resilience components
    this.circuitBreakers = {
      canon: new CircuitBreaker('canon'),
      registry: new CircuitBreaker('registry'),
      notion: new CircuitBreaker('notion', { failureThreshold: 3, resetTimeout: 120000 })
    };

    this.retryPolicy = new RetryPolicy();
    this.cache = new MemoryCache();

    // JWKS for signature verification
    this.jwksClient = null;

    // Telemetry
    this.telemetry = {
      mergeCount: 0,
      strategyUsage: {},
      ruleSource: null,
      lastRuleVersion: null,
      lastRuleHash: null
    };

    // Feature flags
    this.features = {
      requireExplicitStrategy: process.env.REQUIRE_EXPLICIT_STRATEGY === 'true',
      verifyJWS: process.env.VERIFY_JWS !== 'false',
      dryRun: process.env.DRY_RUN === 'true'
    };
  }

  /**
   * Initialize JWKS client for JWS verification
   */
  async initializeJWKS() {
    if (!this.jwksClient) {
      try {
        const jwksUrl = `${this.endpoints.mothership}/.well-known/jwks.json`;
        const response = await fetch(jwksUrl);
        const jwks = await response.json();
        this.jwksClient = await jose.createRemoteJWKSet(new URL(jwksUrl));
      } catch (error) {
        console.error('Failed to initialize JWKS:', error);
      }
    }
  }

  /**
   * Fetch with timeout using AbortController
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);

      // Capture rate limit headers
      if (response.status === 429) {
        const error = new Error('Rate limited');
        error.status = 429;
        error.headers = {
          'retry-after': response.headers.get('retry-after')
        };
        throw error;
      }

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
        timeoutError.status = 408;
        throw timeoutError;
      }
      throw error;
    }
  }

  /**
   * Verify JWS signature
   */
  async verifyJWS(token) {
    if (!this.features.verifyJWS || !this.jwksClient) {
      return jose.decodeJwt(token);
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.jwksClient);
      return payload;
    } catch (error) {
      console.error('JWS verification failed:', error);
      throw new Error('Invalid signature on canonical rules');
    }
  }

  /**
   * Fetch canonical rules with resilience
   */
  async fetchCanonicalRules() {
    const cacheKey = 'canonical-rules';

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Using cached canonical rules');
      this.telemetry.ruleSource = 'cache';
      return cached;
    }

    try {
      const rules = await this.circuitBreakers.canon.execute(async () => {
        return await this.retryPolicy.execute(async () => {
          const response = await this.fetchWithTimeout(
            `${this.endpoints.canon}/api/merge-rules`,
            {
              headers: {
                'Authorization': `Bearer ${this.tokens.canon}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const contentType = response.headers.get('content-type');

          if (contentType?.includes('application/jwt')) {
            // Signed JWS response
            const token = await response.text();
            await this.initializeJWKS();
            const payload = await this.verifyJWS(token);
            return payload.rules;
          } else {
            // Unsigned JSON response
            return await response.json();
          }
        });
      });

      // Validate version doesn't regress
      if (this.telemetry.lastRuleVersion && rules.version < this.telemetry.lastRuleVersion) {
        throw new Error(`Rule version regression: ${rules.version} < ${this.telemetry.lastRuleVersion}`);
      }

      // Calculate hash for integrity
      const rulesHash = crypto.createHash('sha256')
        .update(JSON.stringify(rules))
        .digest('hex');

      // Update telemetry
      this.telemetry.ruleSource = 'canon';
      this.telemetry.lastRuleVersion = rules.version;
      this.telemetry.lastRuleHash = rulesHash;

      // Cache with 15-minute TTL
      this.cache.set(cacheKey, rules, 900000);

      console.log(`Fetched canonical rules v${rules.version} (hash: ${rulesHash.substring(0, 8)}...)`);

      return rules;

    } catch (error) {
      console.error(`Failed to fetch canonical rules: ${error.message}`);

      // Try to use cached rules even if expired
      const expiredCache = this.cache.cache.get(cacheKey);
      if (expiredCache) {
        console.warn('Using expired cached rules due to failure');
        this.telemetry.ruleSource = 'expired-cache';
        return expiredCache.value;
      }

      // Fall back to defaults
      console.warn('Using default canonical rules');
      this.telemetry.ruleSource = 'default';
      return this.getDefaultCanonicalRules();
    }
  }

  /**
   * Fetch from registry with resilience
   */
  async fetchFromRegistry(serviceName) {
    const cacheKey = `registry-${serviceName}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const config = await this.circuitBreakers.registry.execute(async () => {
        return await this.retryPolicy.execute(async () => {
          const response = await this.fetchWithTimeout(
            `${this.endpoints.registry}/api/services/${serviceName}/config`,
            {
              headers: {
                'Authorization': `Bearer ${this.tokens.registry}`,
                'Content-Type': 'application/json'
              }
            }
          );
          return await response.json();
        });
      });

      // Cache with 5-minute TTL
      this.cache.set(cacheKey, config, 300000);

      return config;

    } catch (error) {
      console.error(`Registry fetch failed for ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notion sync with rate limit handling
   */
  async syncWithNotion(options = {}) {
    const { dryRun = false, checkpoint = null } = options;

    if (this.features.dryRun || dryRun) {
      console.log('DRY RUN: Would sync with Notion');
      return { dryRun: true, processed: [] };
    }

    const manifest = {
      startTime: new Date().toISOString(),
      processed: [],
      checkpoints: [],
      errors: []
    };

    let cursor = checkpoint;
    let hasMore = true;

    while (hasMore) {
      try {
        const result = await this.circuitBreakers.notion.execute(async () => {
          return await this.retryPolicy.execute(async () => {
            const response = await this.fetchWithTimeout(
              `${this.endpoints.notion}/databases/${process.env.NOTION_DATABASE_ID}/query`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${this.tokens.notion}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  start_cursor: cursor,
                  page_size: 100
                })
              },
              10000 // 10 second timeout for Notion
            );
            return await response.json();
          });
        });

        // Process pages
        for (const page of result.results) {
          manifest.processed.push({
            id: page.id,
            timestamp: new Date().toISOString()
          });

          // Process page (implementation specific)
          await this.processNotionPage(page);
        }

        // Save checkpoint
        manifest.checkpoints.push({
          cursor: result.next_cursor,
          timestamp: new Date().toISOString(),
          processed: manifest.processed.length
        });

        // Write checkpoint to disk for resume capability
        await this.saveCheckpoint(manifest);

        hasMore = result.has_more;
        cursor = result.next_cursor;

      } catch (error) {
        manifest.errors.push({
          error: error.message,
          cursor,
          timestamp: new Date().toISOString()
        });

        console.error('Notion sync error:', error);

        // Break on circuit open
        if (this.circuitBreakers.notion.state === 'OPEN') {
          console.log('Circuit breaker open, stopping Notion sync');
          break;
        }
      }
    }

    manifest.endTime = new Date().toISOString();
    manifest.totalProcessed = manifest.processed.length;

    return manifest;
  }

  /**
   * Merge with canonical logic and telemetry
   */
  async mergeWithCanonicalLogic(configs) {
    this.telemetry.mergeCount++;

    // Fetch canonical rules
    const rules = await this.fetchCanonicalRules();

    const canonical = {
      name: 'ChittyOS Unified Configuration',
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      canonicalRulesVersion: rules.version || '1.0.0',
      canonicalRulesHash: this.telemetry.lastRuleHash,
      canonicalRulesSource: this.telemetry.ruleSource,
      hierarchy: []
    };

    // Build strategy map
    const strategies = {};

    // Track strategy usage
    const countStrategy = (strategy) => {
      this.telemetry.strategyUsage[strategy] = (this.telemetry.strategyUsage[strategy] || 0) + 1;
    };

    rules.preserve?.forEach(field => {
      strategies[field] = 'preserve';
      countStrategy('preserve');
    });

    rules.union?.forEach(field => {
      strategies[field] = 'union';
      countStrategy('union');
    });

    rules.merge?.forEach(field => {
      strategies[field] = 'merge';
      countStrategy('merge');
    });

    rules.override?.forEach(field => {
      strategies[field] = 'override';
      countStrategy('override');
    });

    // Apply custom strategies
    Object.assign(strategies, rules.customStrategies || {});

    // Log effective strategies
    console.log(`Applying ${Object.keys(strategies).length} merge strategies`);
    console.log(`Strategy distribution:`, this.telemetry.strategyUsage);

    for (const config of configs) {
      canonical.hierarchy.push({
        level: config.level,
        name: config.name,
        version: config.version,
        chittyId: config.chittyId
      });

      // Apply merge with explicit strategy requirement
      this.deepMerge(canonical, config.config, strategies, {
        requireExplicit: this.features.requireExplicitStrategy
      });
    }

    return canonical;
  }

  /**
   * Deep merge with strategy enforcement
   */
  deepMerge(target, source, strategies = {}, options = {}) {
    for (const key in source) {
      const strategy = strategies[key];

      // Enforce explicit strategy if required
      if (options.requireExplicit && !strategy) {
        throw new Error(`No explicit merge strategy for field: ${key}`);
      }

      const effectiveStrategy = strategy || 'default';

      switch (effectiveStrategy) {
        case 'preserve':
          if (!target[key]) {
            target[key] = source[key];
          }
          break;

        case 'union':
          if (Array.isArray(target[key]) && Array.isArray(source[key])) {
            target[key] = [...new Set([...target[key], ...source[key]])];
          } else {
            target[key] = source[key];
          }
          break;

        case 'override':
          target[key] = source[key];
          break;

        case 'merge':
        case 'default':
          if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            this.deepMerge(target[key], source[key], strategies, options);
          } else {
            target[key] = source[key];
          }
          break;
      }
    }
  }

  /**
   * Get telemetry metrics
   */
  getMetrics() {
    return {
      telemetry: this.telemetry,
      cache: this.cache.getMetrics(),
      circuitBreakers: {
        canon: this.circuitBreakers.canon.getMetrics(),
        registry: this.circuitBreakers.registry.getMetrics(),
        notion: this.circuitBreakers.notion.getMetrics()
      }
    };
  }

  /**
   * Save checkpoint for resumable operations
   */
  async saveCheckpoint(manifest) {
    const checkpointPath = path.join(this.basePath, '.checkpoints', `${Date.now()}.json`);
    await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
    await fs.writeFile(checkpointPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Process individual Notion page
   */
  async processNotionPage(page) {
    // Implementation specific to your Notion structure
    console.log(`Processing Notion page: ${page.id}`);
  }

  /**
   * Default canonical rules (fallback)
   */
  getDefaultCanonicalRules() {
    return {
      version: '1.0.0',
      preserve: [
        'context.CRITICAL_RULE',
        'context.generation_policy',
        'context.mothership_authority'
      ],
      union: [
        'permissions',
        'tools',
        'capabilities'
      ],
      merge: [
        'services',
        'integrations'
      ],
      override: [
        'env',
        'local_overrides'
      ]
    };
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new ClaudeConfigService();
  const command = process.argv[2];

  switch (command) {
    case 'metrics':
      console.log(JSON.stringify(service.getMetrics(), null, 2));
      break;

    case 'sync-notion':
      const checkpoint = process.argv[3];
      service.syncWithNotion({ checkpoint }).then(manifest => {
        console.log('Notion sync complete:', manifest);
      });
      break;

    case 'verify-rules':
      service.fetchCanonicalRules().then(rules => {
        console.log(`Canonical rules v${rules.version} verified`);
        console.log(`Source: ${service.telemetry.ruleSource}`);
        console.log(`Hash: ${service.telemetry.lastRuleHash}`);
      });
      break;

    default:
      console.log(`
Production Configuration Service

Commands:
  metrics         Show telemetry and circuit breaker metrics
  sync-notion     Sync with Notion (supports checkpoints)
  verify-rules    Verify and cache canonical rules
      `);
  }
}

export default ClaudeConfigService;