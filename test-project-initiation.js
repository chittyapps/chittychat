/**
 * Integration tests for ChittyOS Project Initiation Service
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'test-token';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper to print colored output
function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test counter
let passed = 0;
let failed = 0;

// Helper for assertions
function assert(condition, message) {
  if (condition) {
    passed++;
    log('green', `✓ ${message}`);
  } else {
    failed++;
    log('red', `✗ ${message}`);
  }
}

// Helper for HTTP requests
async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    data: data ? JSON.parse(data) : null,
  };
}

// Test 1: Health Check
async function testHealthCheck() {
  log('cyan', '\n=== Test 1: Health Check ===');

  const response = await request('GET', '/health');

  assert(response.status === 200, 'Health endpoint returns 200');
  assert(response.data.status === 'healthy', 'Status is healthy');
  assert(response.data.service === 'ChittyOS Project Initiation', 'Correct service name');
  assert(response.data.version === '1.0.0', 'Version is 1.0.0');
  assert(Array.isArray(response.data.features), 'Features array exists');
  assert(
    response.data.features.includes('github-projects-v2'),
    'GitHub Projects v2 feature listed'
  );
  assert(
    response.data.features.includes('workerai-task-gen'),
    'WorkerAI task generation feature listed'
  );
}

// Test 2: Secure Health Check
async function testSecureHealthCheck() {
  log('cyan', '\n=== Test 2: Secure Health Check ===');

  const response = await request('GET', '/health/secure');

  assert(response.status === 200 || response.status === 503, 'Secure health endpoint accessible');
  assert(response.data.bindings, 'Bindings status present');
  assert(response.data.github, 'GitHub status present');

  if (response.data.github.authenticated) {
    log('green', `GitHub authenticated as: ${response.data.github.user}`);
    log('yellow', `Scopes: ${response.data.github.scopes.join(', ')}`);

    if (response.data.github.missing.length > 0) {
      log('red', `Missing scopes: ${response.data.github.missing.join(', ')}`);
    }
  } else {
    log('yellow', 'GitHub not authenticated (expected in local testing)');
  }
}

// Test 3: Unauthorized Access
async function testUnauthorized() {
  log('cyan', '\n=== Test 3: Unauthorized Access ===');

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No Authorization header
    },
    body: JSON.stringify({ projectName: 'Test' }),
  };

  const response = await fetch(`${BASE_URL}/api/initiate/kickoff`, options);

  assert(response.status === 401, 'Returns 401 without auth token');
}

// Test 4: Request Body Size Limit
async function testBodySizeLimit() {
  log('cyan', '\n=== Test 4: Request Body Size Limit ===');

  // Create a payload larger than 64KB
  const largePayload = {
    projectName: 'Test',
    description: 'x'.repeat(70000),
  };

  const response = await request('POST', '/api/initiate/kickoff', largePayload);

  assert(response.status === 413, 'Rejects oversized requests with 413');
}

// Test 5: Project Kickoff Validation
async function testProjectKickoffValidation() {
  log('cyan', '\n=== Test 5: Project Kickoff Validation ===');

  // Test with minimal valid configuration
  const projectConfig = {
    projectName: 'Test Project Integration',
    description: 'Integration test project for ChittyOS',
    repos: [
      {
        owner: 'chittyos-test',
        repo: 'test-project',
        isOrg: true,
        role: 'primary',
      },
    ],
    owners: [
      {
        username: 'test-user',
        role: 'lead',
      },
    ],
    estimatedDuration: 30,
    priority: 'medium',
    tags: ['test', 'integration'],
  };

  const response = await request('POST', '/api/initiate/kickoff', projectConfig);

  // In test environment without real GitHub token, expect failure
  // but validate the structure of the response
  assert(
    response.status === 202 || response.status === 500,
    'Kickoff endpoint responds (202 success or 500 if missing credentials)'
  );

  if (response.status === 202) {
    assert(response.data.success === true, 'Success flag is true');
    assert(response.data.ctxId, 'Context ID is present');
    assert(response.data.projectId, 'Project ChittyID is present');
    assert(response.data.projectName === 'Test Project Integration', 'Project name matches');
    assert(response.data.phase === 'kickoff', 'Phase is kickoff');
    assert(response.data.results, 'Results object present');
    assert(response.data.summary, 'Summary object present');

    log('green', `Context ID: ${response.data.ctxId}`);
    log('green', `Project ID: ${response.data.projectId}`);
  } else {
    // Validate error structure
    assert(response.data.error, 'Error object present on failure');
    assert(response.data.error.stage, 'Error stage specified');
    assert(response.data.error.message, 'Error message present');

    log('yellow', `Expected failure: ${response.data.error.message}`);
  }
}

// Test 6: Invalid Endpoint
async function testInvalidEndpoint() {
  log('cyan', '\n=== Test 6: Invalid Endpoint ===');

  const response = await request('GET', '/api/initiate/invalid');

  assert(response.status === 404, 'Invalid endpoint returns 404');
  assert(response.data.error === 'Not Found', 'Error message is "Not Found"');
  assert(Array.isArray(response.data.availableEndpoints), 'Available endpoints listed');
}

// Test 7: CORS Preflight
async function testCORSPreflight() {
  log('cyan', '\n=== Test 7: CORS Preflight ===');

  const options = {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Authorization',
    },
  };

  const response = await fetch(`${BASE_URL}/api/initiate/kickoff`, options);

  assert(response.status === 200, 'OPTIONS request returns 200');

  const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
  const allowMethods = response.headers.get('Access-Control-Allow-Methods');

  assert(allowOrigin, 'CORS Allow-Origin header present');
  assert(allowMethods, 'CORS Allow-Methods header present');
  assert(
    allowMethods.includes('POST'),
    'POST method allowed in CORS'
  );
}

// Test 8: Routing (Path-based vs Subdomain)
async function testRouting() {
  log('cyan', '\n=== Test 8: Routing Test ===');

  // Test path-based routing
  const pathResponse = await request('GET', '/api/initiate/health');
  assert(pathResponse.status === 200, 'Path-based routing (/api/initiate/health) works');

  // Test root health
  const rootResponse = await request('GET', '/health');
  assert(rootResponse.status === 200, 'Root health endpoint (/health) works');
}

// Test 9: Platform Headers
async function testPlatformHeaders() {
  log('cyan', '\n=== Test 9: Platform Headers ===');

  const response = await fetch(`${BASE_URL}/health`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
  });

  const platformVersion = response.headers.get('X-Platform-Version');
  const serviceHost = response.headers.get('X-Service-Host');

  if (platformVersion || serviceHost) {
    log('green', 'Platform headers present');
    if (platformVersion) log('yellow', `  Platform Version: ${platformVersion}`);
    if (serviceHost) log('yellow', `  Service Host: ${serviceHost}`);
  } else {
    log('yellow', 'Platform headers not set (may be expected in dev)');
  }
}

// Test 10: Response Time
async function testResponseTime() {
  log('cyan', '\n=== Test 10: Response Time ===');

  const start = Date.now();
  await request('GET', '/health');
  const duration = Date.now() - start;

  assert(duration < 1000, `Response time under 1s (${duration}ms)`);
  log('yellow', `Response time: ${duration}ms`);
}

// Run all tests
async function runTests() {
  log('blue', '\n╔═══════════════════════════════════════════════════════╗');
  log('blue', '║   ChittyOS Project Initiation Service - Test Suite   ║');
  log('blue', '╚═══════════════════════════════════════════════════════╝');

  log('yellow', `\nBase URL: ${BASE_URL}`);
  log('yellow', `Auth Token: ${AUTH_TOKEN ? '***' + AUTH_TOKEN.slice(-4) : 'not set'}\n`);

  try {
    await testHealthCheck();
    await testSecureHealthCheck();
    await testUnauthorized();
    await testBodySizeLimit();
    await testProjectKickoffValidation();
    await testInvalidEndpoint();
    await testCORSPreflight();
    await testRouting();
    await testPlatformHeaders();
    await testResponseTime();
  } catch (error) {
    log('red', `\n✗ Test suite error: ${error.message}`);
    log('red', error.stack);
    failed++;
  }

  // Summary
  log('blue', '\n╔═══════════════════════════════════════════════════════╗');
  log('blue', '║                    Test Summary                       ║');
  log('blue', '╚═══════════════════════════════════════════════════════╝');

  log('green', `Passed: ${passed}`);
  if (failed > 0) {
    log('red', `Failed: ${failed}`);
  } else {
    log('green', `Failed: ${failed}`);
  }

  const total = passed + failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  log('cyan', `Success Rate: ${percentage}%`);

  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log('red', `Fatal error: ${error.message}`);
  process.exit(1);
});
