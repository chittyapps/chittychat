/**
 * @chittycorp/app-beacon
 * Zero-config app tracker
 * 
 * Usage: require('@chittycorp/app-beacon')
 * That's it! No configuration needed.
 */

const https = require('https');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Configuration (can be overridden with env vars)
const CONFIG = {
  endpoint: process.env.BEACON_ENDPOINT || 'https://beacon.cloudeto.com',
  interval: parseInt(process.env.BEACON_INTERVAL) || 300000, // 5 minutes
  enabled: process.env.BEACON_DISABLED !== 'true',
  silent: process.env.BEACON_VERBOSE !== 'true'
};

// Auto-detect app information
function detectApp() {
  const app = {
    // Identity
    id: generateAppId(),
    name: detectAppName(),
    version: detectVersion(),
    
    // Platform
    platform: detectPlatform(),
    environment: process.env.NODE_ENV || 'production',
    
    // System
    hostname: os.hostname(),
    node_version: process.version,
    os: `${os.type()} ${os.release()}`,
    
    // Features
    has_claude_code: detectClaudeCode(),
    has_git: fs.existsSync('.git'),
    
    // Metadata
    started_at: new Date().toISOString(),
    pid: process.pid
  };
  
  // Add git info if available
  if (app.has_git) {
    try {
      app.git = {
        branch: execSync('git branch --show-current', { encoding: 'utf8' }).trim(),
        commit: execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(),
        remote: execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
      };
    } catch (e) {}
  }
  
  // Platform-specific info
  if (process.env.REPL_ID) {
    app.replit = {
      id: process.env.REPL_ID,
      slug: process.env.REPL_SLUG,
      owner: process.env.REPL_OWNER,
      url: `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    };
  }
  
  if (process.env.GITHUB_REPOSITORY) {
    app.github = {
      repository: process.env.GITHUB_REPOSITORY,
      workflow: process.env.GITHUB_WORKFLOW,
      run_id: process.env.GITHUB_RUN_ID,
      actor: process.env.GITHUB_ACTOR
    };
  }
  
  if (process.env.VERCEL) {
    app.vercel = {
      url: process.env.VERCEL_URL,
      env: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION
    };
  }
  
  return app;
}

function generateAppId() {
  if (process.env.REPL_ID) return `replit-${process.env.REPL_ID}`;
  if (process.env.GITHUB_REPOSITORY) return `github-${process.env.GITHUB_REPOSITORY.replace('/', '-')}`;
  if (process.env.VERCEL_URL) return `vercel-${process.env.VERCEL_URL}`;
  if (process.env.HEROKU_APP_NAME) return `heroku-${process.env.HEROKU_APP_NAME}`;
  
  // Generate from package.json or hostname
  try {
    const pkg = require(process.cwd() + '/package.json');
    return `npm-${pkg.name}`;
  } catch (e) {
    return `host-${os.hostname()}`;
  }
}

function detectAppName() {
  return process.env.REPL_SLUG ||
         process.env.GITHUB_REPOSITORY ||
         process.env.VERCEL_URL ||
         process.env.HEROKU_APP_NAME ||
         process.env.npm_package_name ||
         (() => {
           try {
             return require(process.cwd() + '/package.json').name;
           } catch (e) {
             return 'unnamed-app';
           }
         })();
}

function detectVersion() {
  try {
    return require(process.cwd() + '/package.json').version;
  } catch (e) {
    return '0.0.0';
  }
}

function detectPlatform() {
  if (process.env.REPL_ID) return 'replit';
  if (process.env.GITHUB_ACTIONS) return 'github-actions';
  if (process.env.VERCEL) return 'vercel';
  if (process.env.NETLIFY) return 'netlify';
  if (process.env.RENDER) return 'render';
  if (process.env.HEROKU_APP_NAME) return 'heroku';
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return 'aws-lambda';
  if (process.env.GOOGLE_CLOUD_PROJECT) return 'google-cloud';
  if (process.env.WEBSITE_INSTANCE_ID) return 'azure';
  return 'unknown';
}

function detectClaudeCode() {
  return process.env.CLAUDE_CODE === 'true' || 
         fs.existsSync('.claude') ||
         fs.existsSync('claude.json') ||
         (() => {
           try {
             const pkg = require(process.cwd() + '/package.json');
             return pkg.devDependencies?.['@anthropic/claude'] || 
                    pkg.dependencies?.['@anthropic/claude'];
           } catch (e) {
             return false;
           }
         })();
}

// Send beacon
function sendBeacon(data) {
  if (!CONFIG.enabled) return;
  
  const payload = JSON.stringify(data);
  const url = new URL(CONFIG.endpoint);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + '/track',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
      'User-Agent': '@chittycorp/app-beacon/1.0.0'
    }
  };
  
  const req = https.request(options, (res) => {
    if (!CONFIG.silent && res.statusCode !== 200) {
      console.log(`[@chittycorp/app-beacon] Response: ${res.statusCode}`);
    }
  });
  
  req.on('error', (error) => {
    if (!CONFIG.silent) {
      console.log(`[@chittycorp/app-beacon] Error: ${error.message}`);
    }
  });
  
  req.write(payload);
  req.end();
}

// Initialize
function init() {
  if (!CONFIG.enabled) {
    if (!CONFIG.silent) {
      console.log('[@chittycorp/app-beacon] Disabled');
    }
    return;
  }
  
  const appInfo = detectApp();
  
  // Send initial beacon
  sendBeacon({
    ...appInfo,
    event: 'startup',
    timestamp: new Date().toISOString()
  });
  
  // Send periodic heartbeats
  const interval = setInterval(() => {
    sendBeacon({
      id: appInfo.id,
      name: appInfo.name,
      event: 'heartbeat',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }, CONFIG.interval);
  
  // Don't keep process alive just for beacon
  interval.unref();
  
  // Send shutdown beacon
  const shutdown = () => {
    sendBeacon({
      id: appInfo.id,
      name: appInfo.name,
      event: 'shutdown',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  };
  
  process.once('exit', shutdown);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  
  if (!CONFIG.silent) {
    console.log(`[@chittycorp/app-beacon] Tracking ${appInfo.name} on ${appInfo.platform}`);
  }
}

// Auto-initialize on require
init();

// Export for programmatic use
module.exports = {
  detectApp,
  sendBeacon,
  config: CONFIG
};
