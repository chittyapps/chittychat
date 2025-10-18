ChittyOS Platform Orchestrators

Overview
- `src/platform-worker.js`: Primary Cloudflare Workers orchestrator for production. Handles subdomain-based routing (e.g., ai.chitty.cc), status integration, and platform headers. Uses namespaced cache via `createKVCache`.
- `src/platform.js`: Path-based orchestrator using `itty-router`, useful for consolidated routing or alternative deployments. Uses a composite cache via `createCompositeCache` to route namespaces to different stores.

Shared Conventions
- Cache operations follow the same contract across orchestrators:
  - `get(key, namespace?)` prefixes with `namespace:` and falls back to the raw key if not found.
  - `set(key, value, namespaceOrTtl?, ttl?)` treats `null`/`undefined` as delete; supports both `(ttl)` and `('namespace', ttl)` forms.
  - `delete(key, namespace?)` and `put(key, value, options?)` are available.
- Status routes are added through `src/services/status-integration.js` and rely on the same cache semantics.

Deployment Guidance
- Prefer `platform-worker.js` for production where subdomains map to services.
- Use `platform.js` for environments where a single worker handles path-based routing (e.g., `/api/ai`, `/api/auth`).

Notes
- Both orchestrators share the same service handlers (in `src/services/`).
- If adding new cache behavior, update `src/lib/cache.js` and rely on it from both orchestrators to avoid divergence.

