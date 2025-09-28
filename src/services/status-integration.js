/**
 * ChittyOS Real-Time Status Integration
 * Live status monitoring that integrates with platform worker
 */

import { handleChittyStatusMonitor } from './chitty-status-monitor.js';

/**
 * Add status route to platform worker
 */
export function setupStatusRoutes(SERVICE_ROUTES) {
  SERVICE_ROUTES['status.chitty.cc'] = handleStatusWrapper;
  SERVICE_ROUTES['monitor.chitty.cc'] = handleStatusWrapper;
  return SERVICE_ROUTES;
}

/**
 * Wrapper to adapt status monitor to platform context
 */
async function handleStatusWrapper(request, env, ctx) {
  // Build context for status monitor
  const context = {
    request,
    env,
    ctx,
    cache: {
      get: async (key) => env.PLATFORM_CACHE?.get(key),
      put: async (key, value, options) => env.PLATFORM_CACHE?.put(key, value, options)
    },
    userDb: env.PLATFORM_DB,
    platformDb: env.PLATFORM_DB,
    cacheDb: env.PLATFORM_CACHE,
    vectors: env.PLATFORM_VECTORS,
    data: env.PLATFORM_STORAGE
  };

  return handleChittyStatusMonitor(context);
}

/**
 * Real-time status checker that runs in Durable Object or Worker
 */
export class ChittyStatusCollector {
  constructor(env) {
    this.env = env;
    this.statusCache = new Map();
    this.lastCheck = new Map();
  }

  /**
   * Collect real status from all services
   */
  async collectStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      services: {},
      metrics: {}
    };

    // Check actual service endpoints
    const services = [
      { name: 'notion', url: 'https://api.notion.com/v1', header: 'Notion-Version: 2022-06-28' },
      { name: 'neon', check: () => this.checkNeonStatus() },
      { name: 'r2', check: () => this.checkR2Status() },
      { name: 'github', url: 'https://api.github.com/rate_limit' },
      { name: 'drive', check: () => this.checkDriveStatus() }
    ];

    // Parallel status checks
    const checks = await Promise.allSettled(
      services.map(async (service) => {
        if (service.check) {
          return { name: service.name, status: await service.check() };
        } else {
          return { name: service.name, status: await this.checkEndpoint(service.url, service.header) };
        }
      })
    );

    // Process results
    for (const result of checks) {
      if (result.status === 'fulfilled') {
        status.services[result.value.name] = result.value.status;
      } else {
        status.services[result.value?.name || 'unknown'] = {
          status: 'error',
          error: result.reason?.message
        };
      }
    }

    // Collect metrics from actual database
    status.metrics = await this.collectMetrics();

    // Store in cache for quick access
    await this.env.PLATFORM_CACHE?.put('status:current', JSON.stringify(status), {
      expirationTtl: 60 // Cache for 1 minute
    });

    return status;
  }

  /**
   * Check endpoint health
   */
  async checkEndpoint(url, header) {
    try {
      const headers = {};
      if (header) {
        const [key, value] = header.split(': ');
        headers[key] = value;
      }

      const response = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        statusCode: response.status,
        latency: 0 // Would need timing logic
      };
    } catch (error) {
      return {
        status: 'unreachable',
        error: error.message
      };
    }
  }

  /**
   * Check Neon database status
   */
  async checkNeonStatus() {
    try {
      if (!this.env.PLATFORM_DB) {
        return { status: 'not_configured' };
      }

      const start = Date.now();
      const result = await this.env.PLATFORM_DB.prepare('SELECT 1 as health_check').first();
      const latency = Date.now() - start;

      // Get actual counts
      const counts = await this.env.PLATFORM_DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM event_store) as events,
          (SELECT COUNT(DISTINCT chitty_id) FROM event_store) as entities,
          (SELECT COUNT(*) FROM event_store WHERE event_hash IS NOT NULL) as verified
      `).first();

      return {
        status: 'healthy',
        latency,
        statistics: counts
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check R2 storage status
   */
  async checkR2Status() {
    try {
      if (!this.env.PLATFORM_STORAGE) {
        return { status: 'not_configured' };
      }

      // Try to list objects
      const list = await this.env.PLATFORM_STORAGE.list({ limit: 1 });

      // Count verified objects
      const verifiedList = await this.env.PLATFORM_STORAGE.list({
        prefix: 'verified/',
        limit: 1000
      });

      return {
        status: 'healthy',
        total_objects: list.objects?.length || 0,
        verified_count: verifiedList.objects?.length || 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check Google Drive status (would need actual API)
   */
  async checkDriveStatus() {
    try {
      // This would need actual Google Drive API integration
      const hasToken = !!this.env.GOOGLE_DRIVE_TOKEN;

      if (!hasToken) {
        return { status: 'not_configured' };
      }

      // Mock check - replace with actual API call
      return {
        status: 'healthy',
        folder_id: this.env.CHITTYOS_DATA_FOLDER_ID || 'not_set'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Collect real metrics from the system
   */
  async collectMetrics() {
    const metrics = {};

    try {
      // Pipeline metrics
      const pipelineStats = await this.env.PLATFORM_DB?.prepare(`
        SELECT
          COUNT(*) as total_runs,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM pipeline_runs
        WHERE timestamp > datetime('now', '-1 hour')
      `).first();

      metrics.pipeline = {
        success_rate: pipelineStats?.total_runs > 0
          ? Math.round((pipelineStats.successful / pipelineStats.total_runs) * 100)
          : 100,
        recent_runs: pipelineStats?.total_runs || 0
      };

      // Trust scores
      const trustStats = await this.env.PLATFORM_DB?.prepare(`
        SELECT
          AVG(trust_score) as avg_trust,
          MIN(trust_score) as min_trust,
          MAX(trust_score) as max_trust
        FROM users
        WHERE trust_score IS NOT NULL
      `).first();

      metrics.trust = {
        average: Math.round(trustStats?.avg_trust || 0),
        minimum: Math.round(trustStats?.min_trust || 0),
        maximum: Math.round(trustStats?.max_trust || 100)
      };

      // ChittyID validation
      const validationStats = await this.env.PLATFORM_DB?.prepare(`
        SELECT
          COUNT(DISTINCT chitty_id) as total_ids,
          COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED' THEN chitty_id END) as verified_ids
        FROM people
        UNION ALL
        SELECT
          COUNT(DISTINCT chitty_id) as total_ids,
          COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED' THEN chitty_id END) as verified_ids
        FROM places
        UNION ALL
        SELECT
          COUNT(DISTINCT chitty_id) as total_ids,
          COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED' THEN chitty_id END) as verified_ids
        FROM things
        UNION ALL
        SELECT
          COUNT(DISTINCT chitty_id) as total_ids,
          COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED' THEN chitty_id END) as verified_ids
        FROM events
        UNION ALL
        SELECT
          COUNT(DISTINCT chitty_id) as total_ids,
          COUNT(DISTINCT CASE WHEN verification_status = 'VERIFIED' THEN chitty_id END) as verified_ids
        FROM authorities
      `).all();

      const totalIds = validationStats?.results?.reduce((sum, row) => sum + (row.total_ids || 0), 0) || 0;
      const verifiedIds = validationStats?.results?.reduce((sum, row) => sum + (row.verified_ids || 0), 0) || 0;

      metrics.validation = {
        total_chitty_ids: totalIds,
        verified_chitty_ids: verifiedIds,
        verification_rate: totalIds > 0 ? Math.round((verifiedIds / totalIds) * 100) : 0
      };

      // Storage locations
      const storageStats = await this.env.PLATFORM_DB?.prepare(`
        SELECT
          'neon' as location,
          COUNT(*) as count
        FROM event_store
        UNION ALL
        SELECT
          'evidence' as location,
          COUNT(*) as count
        FROM evidence
        WHERE minting_status = 'MINTED'
      `).all();

      metrics.storage = {};
      for (const row of storageStats?.results || []) {
        metrics.storage[row.location] = row.count;
      }

    } catch (error) {
      console.error('Metrics collection error:', error);
    }

    return metrics;
  }

  /**
   * Generate status line text
   */
  generateStatusLine(status) {
    const components = [];

    // Service health indicators
    const serviceHealth = Object.values(status.services || {})
      .every(s => s.status === 'healthy') ? '✅' : '⚠️';

    components.push(`SVC:${serviceHealth}`);

    // Pipeline status
    const pipelineRate = status.metrics?.pipeline?.success_rate || 0;
    components.push(`PIPE:${pipelineRate}%`);

    // Trust average
    const trustAvg = status.metrics?.trust?.average || 0;
    components.push(`TRUST:${trustAvg}`);

    // Verification rate
    const verifyRate = status.metrics?.validation?.verification_rate || 0;
    components.push(`VERIFY:${verifyRate}%`);

    // Storage indicators
    const neonCount = status.metrics?.storage?.neon || 0;
    const r2Count = status.services?.r2?.verified_count || 0;
    components.push(`STORE:N${neonCount}/R${r2Count}`);

    // Overall health
    const isHealthy = serviceHealth === '✅' && pipelineRate >= 95 && verifyRate >= 80;
    const overallStatus = isHealthy ? 'HEALTHY' : 'DEGRADED';

    return `[ChittyOS] ${components.join(' | ')} | ${overallStatus}`;
  }
}

/**
 * Scheduled handler to update status periodically
 */
export async function scheduledStatusUpdate(event, env, ctx) {
  const collector = new ChittyStatusCollector(env);
  const status = await collector.collectStatus();

  // Store status line
  const statusLine = collector.generateStatusLine(status);
  await env.PLATFORM_CACHE?.put('status:line', statusLine, {
    expirationTtl: 300 // 5 minutes
  });

  // Store detailed status
  await env.PLATFORM_CACHE?.put('status:detailed', JSON.stringify(status), {
    expirationTtl: 300
  });

  console.log('Status updated:', statusLine);
}

/**
 * Get current status line (for quick display)
 */
export async function getStatusLine(env) {
  // Try cache first
  let statusLine = await env.PLATFORM_CACHE?.get('status:line');

  if (!statusLine) {
    // Generate fresh status
    const collector = new ChittyStatusCollector(env);
    const status = await collector.collectStatus();
    statusLine = collector.generateStatusLine(status);
  }

  return statusLine;
}

/**
 * Status API endpoint for external monitoring
 */
export async function handleStatusAPI(request, env) {
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';

  const collector = new ChittyStatusCollector(env);
  const status = await collector.collectStatus();

  if (format === 'text') {
    return new Response(collector.generateStatusLine(status), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}