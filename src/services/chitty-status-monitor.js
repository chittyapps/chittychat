/**
 * ChittyOS Status Monitor
 * Real-time monitoring of trust, verification, and certification status
 */

export async function handleChittyStatusMonitor(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Real-time status line
  if (pathname === '/status-line' || pathname === '/') {
    return generateStatusLine(context);
  }

  // Detailed status dashboard
  if (pathname === '/dashboard') {
    return generateStatusDashboard(context);
  }

  // WebSocket for live updates
  if (pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
    return handleWebSocketConnection(context);
  }

  // Individual component status
  if (pathname.startsWith('/status/')) {
    const component = pathname.split('/')[2];
    return getComponentStatus(context, component);
  }

  return new Response(JSON.stringify({
    service: 'ChittyOS Status Monitor',
    version: '1.0.0',
    endpoints: ['/status-line', '/dashboard', '/ws', '/status/{component}']
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Generate real-time status line
 */
async function generateStatusLine(context) {
  const { env } = context;

  try {
    // Gather all status indicators
    const status = await gatherSystemStatus(env);

    // Format as compact status line
    const statusLine = formatStatusLine(status);

    // Return as text for terminal display or JSON for web
    const acceptHeader = context.request.headers.get('Accept');

    if (acceptHeader?.includes('text/plain')) {
      return new Response(statusLine.text, {
        headers: {
          'Content-Type': 'text/plain',
          'X-ChittyOS-Status': statusLine.code,
          'Cache-Control': 'no-cache'
        }
      });
    }

    return new Response(JSON.stringify({
      status_line: statusLine.text,
      status_code: statusLine.code,
      components: status,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Status generation failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Gather system-wide status
 */
async function gatherSystemStatus(env) {
  const status = {
    storage: await getStorageLocationStatus(env),
    pipeline: await getPipelineStatus(env),
    trust: await getChittyTrustStatus(env),
    score: await getChittyScoreStatus(env),
    verify: await getChittyVerifyStatus(env),
    certify: await getChittyCertifyStatus(env),
    validator: await getChittyIDValidatorStatus(env),
    health: await getSystemHealthStatus(env)
  };

  return status;
}

/**
 * Get storage location status for all data
 */
async function getStorageLocationStatus(env) {
  try {
    // Check storage across all systems
    const storageStats = await env.PLATFORM_DB?.prepare(`
      SELECT
        (SELECT COUNT(*) FROM event_store) as neon_records,
        (SELECT COUNT(*) FROM event_store WHERE event_hash IS NOT NULL) as hash_validated,
        (SELECT COUNT(DISTINCT chitty_id) FROM event_store) as unique_entities
    `).first();

    // Check R2 storage
    const r2Stats = await env.PLATFORM_CACHE?.get('storage:r2:stats');
    const r2Data = r2Stats ? JSON.parse(r2Stats) : {};

    // Check external sync status
    const syncStats = await env.PLATFORM_DB?.prepare(`
      SELECT
        SUM(CASE WHEN notion_synced = 1 THEN 1 ELSE 0 END) as notion_synced,
        SUM(CASE WHEN drive_synced = 1 THEN 1 ELSE 0 END) as drive_synced,
        SUM(CASE WHEN github_synced = 1 THEN 1 ELSE 0 END) as github_synced,
        COUNT(*) as total
      FROM sync_status
      WHERE updated_at > datetime('now', '-24 hours')
    `).first();

    const verificationSteps = {
      registration: storageStats?.neon_records || 0,
      immutable: r2Data.verified_count || 0,
      hash_chain: storageStats?.hash_validated || 0
    };

    const pipelineSteps = {
      chitty_ids: storageStats?.unique_entities || 0,
      validated: r2Data.validated_count || 0,
      files_processed: r2Data.files_count || 0,
      r2_stored: r2Data.total_objects || 0,
      neon_recorded: storageStats?.neon_records || 0,
      notion_synced: syncStats?.notion_synced || 0,
      drive_synced: syncStats?.drive_synced || 0,
      github_tracked: syncStats?.github_synced || 0
    };

    // Calculate verification percentage
    const verificationRate = storageStats?.neon_records > 0
      ? Math.round((storageStats.hash_validated / storageStats.neon_records) * 100)
      : 0;

    return {
      status: verificationRate >= 95 ? 'verified' :
              verificationRate >= 80 ? 'partial' : 'unverified',
      indicator: `📍${verificationRate}%`,
      symbol: '💾',
      label: 'STORAGE',
      verification_checks: verificationSteps,
      pipeline_status: pipelineSteps,
      metrics: {
        total_entities: storageStats?.unique_entities || 0,
        verified_percentage: verificationRate,
        storage_locations: {
          neon: storageStats?.neon_records || 0,
          r2: r2Data.total_objects || 0,
          notion: syncStats?.notion_synced || 0,
          drive: syncStats?.drive_synced || 0,
          github: syncStats?.github_synced || 0
        }
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '💾',
      label: 'STORAGE',
      error: error.message
    };
  }
}

/**
 * Get pipeline verification status
 */
async function getPipelineStatus(env) {
  try {
    // Check last pipeline runs
    const pipelineStats = await env.PLATFORM_CACHE?.get('pipeline:stats');
    const stats = pipelineStats ? JSON.parse(pipelineStats) : {};

    const recentRuns = await env.PLATFORM_DB?.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM pipeline_runs
      WHERE timestamp > datetime('now', '-1 hour')
    `).first();

    return {
      status: recentRuns?.failed > 0 ? 'warning' : 'healthy',
      indicator: recentRuns?.failed > 0 ? '⚠️' : '✅',
      symbol: '🔄',
      label: 'PIPELINE',
      metrics: {
        total_runs: recentRuns?.total || 0,
        successful: recentRuns?.successful || 0,
        failed: recentRuns?.failed || 0,
        success_rate: recentRuns?.total > 0
          ? Math.round((recentRuns.successful / recentRuns.total) * 100)
          : 100
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '🔄',
      label: 'PIPELINE',
      error: error.message
    };
  }
}

/**
 * Get ChittyTrust status
 */
async function getChittyTrustStatus(env) {
  try {
    // Calculate trust score based on verification history
    const trustData = await env.PLATFORM_DB?.prepare(`
      SELECT AVG(trust_score) as avg_trust,
             MIN(trust_score) as min_trust,
             COUNT(*) as total_entities
      FROM entity_trust_scores
      WHERE updated_at > datetime('now', '-24 hours')
    `).first();

    const avgTrust = trustData?.avg_trust || 0;
    const trustLevel =
      avgTrust >= 90 ? 'high' :
      avgTrust >= 70 ? 'medium' :
      avgTrust >= 50 ? 'low' : 'critical';

    return {
      status: trustLevel,
      indicator: trustLevel === 'high' ? '🟢' :
                 trustLevel === 'medium' ? '🟡' :
                 trustLevel === 'low' ? '🟠' : '🔴',
      symbol: '🛡️',
      label: 'TRUST',
      metrics: {
        average_trust: Math.round(avgTrust),
        minimum_trust: Math.round(trustData?.min_trust || 0),
        total_entities: trustData?.total_entities || 0,
        level: trustLevel
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '🛡️',
      label: 'TRUST',
      error: error.message
    };
  }
}

/**
 * Get ChittyScore status
 */
async function getChittyScoreStatus(env) {
  try {
    // Calculate system-wide ChittyScore
    const scoreData = await env.PLATFORM_DB?.prepare(`
      SELECT AVG(score) as avg_score,
             COUNT(*) as total_scored,
             SUM(CASE WHEN score >= 800 THEN 1 ELSE 0 END) as excellent,
             SUM(CASE WHEN score >= 700 AND score < 800 THEN 1 ELSE 0 END) as good,
             SUM(CASE WHEN score >= 600 AND score < 700 THEN 1 ELSE 0 END) as fair,
             SUM(CASE WHEN score < 600 THEN 1 ELSE 0 END) as poor
      FROM entity_scores
      WHERE calculated_at > datetime('now', '-1 hour')
    `).first();

    const avgScore = scoreData?.avg_score || 0;

    return {
      status: avgScore >= 700 ? 'excellent' :
              avgScore >= 600 ? 'good' :
              avgScore >= 500 ? 'fair' : 'poor',
      indicator: `${Math.round(avgScore)}`,
      symbol: '📊',
      label: 'SCORE',
      metrics: {
        average: Math.round(avgScore),
        distribution: {
          excellent: scoreData?.excellent || 0,
          good: scoreData?.good || 0,
          fair: scoreData?.fair || 0,
          poor: scoreData?.poor || 0
        },
        total: scoreData?.total_scored || 0
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '---',
      symbol: '📊',
      label: 'SCORE',
      error: error.message
    };
  }
}

/**
 * Get ChittyVerify status
 */
async function getChittyVerifyStatus(env) {
  try {
    // Check recent verification activities
    const verifyData = await env.PLATFORM_DB?.prepare(`
      SELECT COUNT(*) as total_verifications,
             SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM verification_log
      WHERE created_at > datetime('now', '-1 hour')
    `).first();

    const verificationRate = verifyData?.total_verifications > 0
      ? (verifyData.verified / verifyData.total_verifications) * 100
      : 0;

    return {
      status: verifyData?.failed > 0 ? 'warning' :
              verifyData?.pending > 10 ? 'busy' : 'healthy',
      indicator: verifyData?.failed > 0 ? '⚠️' :
                 verifyData?.pending > 10 ? '🔄' : '✓',
      symbol: '☑️',
      label: 'VERIFY',
      metrics: {
        total: verifyData?.total_verifications || 0,
        verified: verifyData?.verified || 0,
        pending: verifyData?.pending || 0,
        failed: verifyData?.failed || 0,
        success_rate: Math.round(verificationRate)
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '☑️',
      label: 'VERIFY',
      error: error.message
    };
  }
}

/**
 * Get ChittyCertify status
 */
async function getChittyCertifyStatus(env) {
  try {
    // Check certification status
    const certData = await env.PLATFORM_DB?.prepare(`
      SELECT COUNT(*) as total_certs,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
             SUM(CASE WHEN expires_at < datetime('now', '+30 days') THEN 1 ELSE 0 END) as expiring_soon,
             SUM(CASE WHEN expires_at < datetime('now') THEN 1 ELSE 0 END) as expired
      FROM certifications
    `).first();

    return {
      status: certData?.expired > 0 ? 'critical' :
              certData?.expiring_soon > 0 ? 'warning' : 'healthy',
      indicator: certData?.expired > 0 ? '❌' :
                 certData?.expiring_soon > 0 ? '⚠️' : '🏆',
      symbol: '📜',
      label: 'CERTIFY',
      metrics: {
        total: certData?.total_certs || 0,
        active: certData?.active || 0,
        expiring_soon: certData?.expiring_soon || 0,
        expired: certData?.expired || 0
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '📜',
      label: 'CERTIFY',
      error: error.message
    };
  }
}

/**
 * Get ChittyID Validator status
 */
async function getChittyIDValidatorStatus(env) {
  try {
    // Check ChittyID validation statistics
    const validatorData = await env.PLATFORM_CACHE?.get('validator:stats');
    const stats = validatorData ? JSON.parse(validatorData) : {};

    // Real-time validation check
    const recentValidations = await env.PLATFORM_DB?.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid,
             SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates
      FROM chittyid_validations
      WHERE validated_at > datetime('now', '-5 minutes')
    `).first();

    const validationRate = recentValidations?.total > 0
      ? (recentValidations.valid / recentValidations.total) * 100
      : 100;

    return {
      status: recentValidations?.duplicates > 0 ? 'warning' :
              validationRate < 95 ? 'degraded' : 'healthy',
      indicator: validationRate >= 99 ? '💚' :
                 validationRate >= 95 ? '🟢' :
                 validationRate >= 90 ? '🟡' : '🔴',
      symbol: '🆔',
      label: 'ID-VALID',
      metrics: {
        total_validated: recentValidations?.total || 0,
        valid: recentValidations?.valid || 0,
        duplicates: recentValidations?.duplicates || 0,
        validation_rate: Math.round(validationRate),
        last_check: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '🆔',
      label: 'ID-VALID',
      error: error.message
    };
  }
}

/**
 * Get overall system health
 */
async function getSystemHealthStatus(env) {
  try {
    // Check critical services
    const services = ['neon', 'r2', 'notion', 'github', 'drive'];
    const healthChecks = {};

    for (const service of services) {
      const cacheKey = `health:${service}`;
      const health = await env.PLATFORM_CACHE?.get(cacheKey);
      healthChecks[service] = health ? JSON.parse(health).status : 'unknown';
    }

    const unhealthyCount = Object.values(healthChecks).filter(s => s !== 'healthy').length;

    return {
      status: unhealthyCount === 0 ? 'healthy' :
              unhealthyCount <= 1 ? 'degraded' : 'unhealthy',
      indicator: unhealthyCount === 0 ? '💚' :
                 unhealthyCount <= 1 ? '🟡' : '🔴',
      symbol: '❤️',
      label: 'HEALTH',
      services: healthChecks,
      metrics: {
        healthy_services: Object.values(healthChecks).filter(s => s === 'healthy').length,
        total_services: services.length
      }
    };
  } catch (error) {
    return {
      status: 'unknown',
      indicator: '❓',
      symbol: '❤️',
      label: 'HEALTH',
      error: error.message
    };
  }
}

/**
 * Format status line for display
 */
function formatStatusLine(status) {
  const components = [
    // Storage location status
    `${status.storage.symbol}${status.storage.indicator}`,

    // Pipeline status
    `${status.pipeline.symbol}${status.pipeline.indicator}`,

    // Trust level
    `${status.trust.symbol}${status.trust.indicator}`,

    // ChittyScore
    `${status.score.symbol}${status.score.indicator}`,

    // Verification
    `${status.verify.symbol}${status.verify.indicator}`,

    // Certification
    `${status.certify.symbol}${status.certify.indicator}`,

    // ID Validator
    `${status.validator.symbol}${status.validator.indicator}`,

    // System Health
    `${status.health.symbol}${status.health.indicator}`
  ];

  // Determine overall status code
  const criticalCount = Object.values(status).filter(s =>
    s.status === 'critical' || s.status === 'unhealthy'
  ).length;

  const warningCount = Object.values(status).filter(s =>
    s.status === 'warning' || s.status === 'degraded'
  ).length;

  const statusCode = criticalCount > 0 ? 'CRITICAL' :
                     warningCount > 0 ? 'WARNING' : 'HEALTHY';

  // Color coding for terminal display
  const colorCode = criticalCount > 0 ? '\x1b[31m' :  // Red
                    warningCount > 0 ? '\x1b[33m' :   // Yellow
                    '\x1b[32m';                        // Green

  const resetColor = '\x1b[0m';

  return {
    text: `${colorCode}[ChittyOS]${resetColor} ${components.join(' | ')} | ${statusCode}`,
    code: statusCode,
    components: components.join(' | ')
  };
}

/**
 * Generate detailed status dashboard
 */
async function generateStatusDashboard(context) {
  const { env } = context;

  try {
    const status = await gatherSystemStatus(env);

    const dashboard = {
      title: 'ChittyOS Status Dashboard',
      timestamp: new Date().toISOString(),
      overall_status: calculateOverallStatus(status),
      components: status,
      recent_events: await getRecentEvents(env),
      alerts: await getActiveAlerts(env),
      metrics: await getSystemMetrics(env)
    };

    // Return HTML dashboard or JSON based on Accept header
    const acceptHeader = context.request.headers.get('Accept');

    if (acceptHeader?.includes('text/html')) {
      return new Response(generateHTMLDashboard(dashboard), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }

    return new Response(JSON.stringify(dashboard, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Dashboard generation failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Calculate overall system status
 */
function calculateOverallStatus(status) {
  const statuses = Object.values(status).map(s => s.status);

  if (statuses.includes('critical') || statuses.includes('unhealthy')) {
    return 'CRITICAL';
  }
  if (statuses.includes('warning') || statuses.includes('degraded')) {
    return 'WARNING';
  }
  if (statuses.includes('unknown')) {
    return 'UNKNOWN';
  }
  return 'HEALTHY';
}

/**
 * Get recent system events
 */
async function getRecentEvents(env) {
  try {
    const events = await env.PLATFORM_DB?.prepare(`
      SELECT event_type, message, severity, timestamp
      FROM system_events
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();

    return events?.results || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get active alerts
 */
async function getActiveAlerts(env) {
  try {
    const alerts = await env.PLATFORM_CACHE?.get('active:alerts');
    return alerts ? JSON.parse(alerts) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Get system metrics
 */
async function getSystemMetrics(env) {
  try {
    return {
      entities_processed: await getMetric(env, 'entities:processed:today'),
      files_stored: await getMetric(env, 'files:stored:today'),
      verifications_completed: await getMetric(env, 'verifications:completed:today'),
      pipeline_runs: await getMetric(env, 'pipeline:runs:today'),
      api_requests: await getMetric(env, 'api:requests:today')
    };
  } catch (error) {
    return {};
  }
}

async function getMetric(env, key) {
  const value = await env.PLATFORM_CACHE?.get(`metric:${key}`);
  return value ? parseInt(value) : 0;
}

/**
 * Generate HTML dashboard
 */
function generateHTMLDashboard(dashboard) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChittyOS Status Dashboard</title>
  <style>
    body {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: #0a0a0a;
      color: #00ff00;
      padding: 20px;
      margin: 0;
    }
    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid #00ff00;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .status-line {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      text-shadow: 0 0 10px #00ff00;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #111;
      border: 1px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.1);
    }
    .card h3 {
      margin: 0 0 15px 0;
      color: #00ff00;
      text-transform: uppercase;
      font-size: 14px;
      letter-spacing: 2px;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      padding: 5px;
      background: #0a0a0a;
      border-radius: 4px;
    }
    .metric-label {
      color: #888;
    }
    .metric-value {
      font-weight: bold;
      color: #00ff00;
    }
    .status-healthy { color: #00ff00; }
    .status-warning { color: #ffaa00; }
    .status-critical { color: #ff0000; }
    .status-unknown { color: #888888; }
    .refresh-timer {
      position: fixed;
      top: 20px;
      right: 20px;
      color: #888;
      font-size: 12px;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .live-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #00ff00;
      border-radius: 50%;
      margin-right: 5px;
      animation: pulse 2s infinite;
    }
  </style>
  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <div class="status-line">
        <span class="live-indicator"></span>
        ChittyOS Platform Status: <span class="status-${dashboard.overall_status.toLowerCase()}">${dashboard.overall_status}</span>
      </div>
      <div>Last Updated: ${dashboard.timestamp}</div>
    </div>

    <div class="grid">
      ${Object.entries(dashboard.components).map(([key, component]) => `
        <div class="card">
          <h3>${component.symbol} ${component.label}</h3>
          <div class="metric">
            <span class="metric-label">Status:</span>
            <span class="metric-value status-${component.status}">${component.status.toUpperCase()}</span>
          </div>
          ${component.metrics ? Object.entries(component.metrics).map(([mKey, mValue]) => `
            <div class="metric">
              <span class="metric-label">${mKey.replace(/_/g, ' ')}:</span>
              <span class="metric-value">${typeof mValue === 'object' ? JSON.stringify(mValue) : mValue}</span>
            </div>
          `).join('') : ''}
        </div>
      `).join('')}
    </div>

    <div class="grid">
      <div class="card">
        <h3>📊 System Metrics</h3>
        ${Object.entries(dashboard.metrics || {}).map(([key, value]) => `
          <div class="metric">
            <span class="metric-label">${key.replace(/_/g, ' ')}:</span>
            <span class="metric-value">${value.toLocaleString()}</span>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h3>🔔 Active Alerts</h3>
        ${dashboard.alerts?.length > 0 ? dashboard.alerts.map(alert => `
          <div class="metric">
            <span class="metric-label status-${alert.severity}">${alert.type}:</span>
            <span class="metric-value">${alert.message}</span>
          </div>
        `).join('') : '<div style="color: #888;">No active alerts</div>'}
      </div>
    </div>

    <div class="refresh-timer">
      Auto-refresh in 5 seconds
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Handle WebSocket connections for live updates
 */
async function handleWebSocketConnection(context) {
  const { request, env } = context;

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // Accept the WebSocket connection
  server.accept();

  // Send status updates every second
  const interval = setInterval(async () => {
    try {
      const status = await gatherSystemStatus(env);
      const statusLine = formatStatusLine(status);

      server.send(JSON.stringify({
        type: 'status_update',
        status_line: statusLine.text,
        components: status,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      server.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }, 1000);

  // Clean up on disconnect
  server.addEventListener('close', () => {
    clearInterval(interval);
  });

  return new Response(null, {
    status: 101,
    webSocket: client
  });
}

/**
 * Get individual component status
 */
async function getComponentStatus(context, component) {
  const { env } = context;

  try {
    const statusFunctions = {
      'pipeline': getPipelineStatus,
      'trust': getChittyTrustStatus,
      'score': getChittyScoreStatus,
      'verify': getChittyVerifyStatus,
      'certify': getChittyCertifyStatus,
      'validator': getChittyIDValidatorStatus,
      'health': getSystemHealthStatus
    };

    const getStatus = statusFunctions[component];

    if (!getStatus) {
      return new Response(JSON.stringify({
        error: 'Unknown component',
        available: Object.keys(statusFunctions)
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const status = await getStatus(env);

    return new Response(JSON.stringify({
      component,
      ...status,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Component status failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}