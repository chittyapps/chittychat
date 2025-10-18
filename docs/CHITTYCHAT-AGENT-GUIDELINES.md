# ChittyChat Agent Guidelines

## Commands
- **Dev**: `npm run dev` (Wrangler on :8787, uses `wrangler.optimized.toml`)
- **Test All**: `npm run test` (runs chittyid, connection, health, services tests)
- **Test Single**: `node --experimental-vm-modules node_modules/jest/bin/jest.js test/<filename>.test.js` (e.g., `test/chittyid-integration.test.js`)
- **Test Watch**: `npm run test:chittyid:watch` or `npm run test:connection:watch`
- **Deploy**: `npm run deploy` (production), `npm run deploy:staging` (staging)
- **Health**: `npm run test:health` or `curl http://localhost:8787/health`
- **Lint**: `npm run lint` (ESLint with auto-fix)
- **Logs**: `npm run tail` (production), `npm run tail:staging`

## Architecture
- **Unified Platform**: Single Cloudflare Worker (`src/platform-worker.js`) consolidates 34+ microservices
- **Service Routing**: Path-based (`/api/{service}/*`) + subdomain routing (`{service}.chitty.cc`)
- **Core Services**: AI Gateway, Auth, ChittyID (proxy-only), Sync, LangChain, ChittyCases, Beacon, MCP, Registry
- **Databases**: Neon PostgreSQL (primary), Durable Objects (state), KV (cache), R2 (storage/audit logs)
- **ChittyID Policy**: NEVER generate ChittyIDs locally—ALL IDs come from `id.chitty.cc` (mothership is sole authority)
- **Entry Points**: `src/platform-worker.js` (main), `src/platform.js` (alt), service handlers in `src/services/`
- **Tests**: `test/*.test.js` (Jest with ES modules), `test-*.js` (standalone integration tests)

## Code Style
- **Modules**: ES modules only (`import`/`export`), 2-space indentation, prefer `.js` over `.ts` for workers
- **Imports**: Use relative paths (`../lib/`, `./services/`), named exports preferred
- **Naming**: Services = `handle{ServiceName}`, workers = `*-worker.js`, managers = `*-manager.ts`
- **Types**: TypeScript for client/shared (`tsconfig.json`), strict mode enabled, prefer explicit types
- **Error Handling**: Try/catch with graceful degradation, return proper HTTP status codes (200/400/500)
- **Secrets**: Load via Wrangler secrets (`wrangler secret put`), NEVER commit `.env` files
- **Comments**: JSDoc for functions/classes, inline comments sparingly, prefer self-documenting code
- **Async**: Use `async/await`, avoid callbacks, handle promises properly

## CLAUDE.md Integration
Refer to [CLAUDE.md](../CLAUDE.md) for detailed slash commands (`/chittycheck`, `/health`, `/chittyid`), environment variables, Cloudflare resource bindings, deployment considerations, and optimization details (85% resource reduction, ChittyCorp LLC account).

