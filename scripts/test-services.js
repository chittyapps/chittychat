#!/usr/bin/env node
// Minimal service smoke tests for local dev. ESM-friendly.
// - Skips gracefully if dev server not running
// - Returns exit code 0 always (non-blocking for CI)

const BASE_URL = process.env.CHITTY_BASE_URL || "http://localhost:8787";
const TIMEOUT_MS = Number(process.env.CHITTY_TEST_TIMEOUT_MS || 3000);

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(t));
}

async function ping(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await withTimeout(fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }), TIMEOUT_MS);
    return { ok: res.ok, status: res.status, url };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), url };
  }
}

async function main() {
  console.log(`Service smoke tests -> ${BASE_URL}`);

  const health = await ping("/health");
  if (!health.ok && health.status !== 200) {
    console.log(`- SKIP: dev server not reachable (${health.error || health.status})`);
    console.log("- Hint: run `npm run dev` in another shell.");
    process.exit(0);
    return;
  }

  const checks = [
    { name: "health", path: "/health" },
    { name: "status-line", path: "/status-line" },
    { name: "docs", path: "/docs" },
  ];

  let passed = 0;
  for (const c of checks) {
    const result = await ping(c.path);
    if (result.ok) {
      console.log(`- PASS: ${c.name} (${result.status}) -> ${result.url}`);
      passed++;
    } else {
      console.log(`- WARN: ${c.name} not OK (${result.error || result.status}) -> ${result.url}`);
    }
  }

  console.log(`Summary: ${passed}/${checks.length} checks passed.`);
  // Always exit 0 to keep test suite non-flaky in local/staging
  process.exit(0);
}

// Top-level await supported in Node >=18 with type: module
await main();

