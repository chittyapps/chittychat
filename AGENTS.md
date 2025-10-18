# Repository Guidelines

## Project Structure & Modules
- Source: `src/` (entry: `src/platform-worker.js`, alt: `src/platform.js`), services in `src/services/`, shared utilities in `src/lib/`.
- Tests: `test/*.test.js` (Jest ES modules). Config: `jest.config.js`.
- Config: `wrangler.optimized.toml`, `package.json` scripts. Client/shared types live in `client/` and `shared/`.

## Build, Test, and Dev
- Dev: `npm run dev` (Wrangler on :8787). Health: `curl http://localhost:8787/health`.
- Test all: `npm run test` (chittyid, connection, health, services).
- Test single: `node --experimental-vm-modules node_modules/jest/bin/jest.js test/<file>.test.js`.
- Lint: `npm run lint` (ESLint with auto-fix). Logs: `npm run tail`, `npm run tail:staging`.
- Deploy: `npm run deploy` (prod) or `npm run deploy:staging`.
 - Claude watcher (local): set `CLAUDE_BASE_PATH` (defaults to `$HOME/.claude`); requires `chokidar`.

## Coding Style & Naming
- ES modules only; 2-space indent; prefer `.js` for workers; TS strict for client/shared (`tsconfig.json`).
- Relative imports and named exports (e.g., `import { handleAuth } from "./services/auth.js"`).
- Handlers: `handle{ServiceName}`; workers: `*-worker.js`; managers: `*-manager.ts`.
- Errors return proper HTTP codes; fail gracefully. Secrets via `wrangler secret put` — never commit secrets.
- ChittyID policy: never generate locally; all IDs come from `id.chitty.cc`.

## Testing Guidelines
- Framework: Jest (ESM). Place tests under `test/` and name `*.test.js`.
- Coverage targets (jest.config.js): ≥80% lines, ≥70% branches. Use focused runs for long tests.
- For ChittyID tests, set `CHITTY_ID_TOKEN` (Wrangler secret or env). Use service URL only; no local minting.
 - Optional: set `CHITTYID_HEALTH_PATH` if your ID service exposes `/v1/health`.

## Commit & PRs
- Use Conventional Commits: `feat:`, `fix:`, `perf:`, `docs:`, `test:`, `chore:`. Example: `perf: optimize platform routing`.
- PRs must include: clear description, linked issues, test plan/output, and any relevant logs/screenshots. Lint/tests must pass.

## Security & Architecture Notes
- Bind Cloudflare resources (KV, R2, Durable Objects, Neon Postgres) via `wrangler.optimized.toml` and Wrangler secrets.
- Avoid logging sensitive data. Validate inputs; prefer `async/await` with try/catch.
- Platform is a single Cloudflare Worker routing by subdomain/path (e.g., `ai.chitty.cc`, `/docs`). See `src/platform-worker.js`.

See `CLAUDE.md` for slash commands, environment variables, and deployment tips.
