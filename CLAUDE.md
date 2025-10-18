<!-- SYNCED WITH: registry.chitty.cc -->
<!-- LAST SYNC: 2025-10-18T08:10:58Z -->

# GLOBAL CONFIGURATION (from registry.chitty.cc)

null

# LOCAL CONFIGURATION

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
ChittyChat - A single unified Cloudflare Worker platform that consolidates 34+ microservices into one optimized worker. Features database synchronization, immutable data viewing, AI integration, and real-time messaging capabilities. Deployed to ChittyCorp LLC Cloudflare account (ending in 121).

## 🚨 SLASH COMMANDS - EXECUTE IMMEDIATELY 🚨

**When user types these, RUN THEM with Bash tool, DO NOT describe them:**

### **EXECUTABLE COMMANDS:**
- **`/chittycheck`** or **`/check`** → Execute: `/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh`
- **`/health`** → Execute: `/Users/nb/.claude/projects/-/chittychat/project-health-check.sh`
- **`/chittyid`** → Execute: `/Users/nb/.claude/projects/-/chittychat/chittyid-command.sh`

**DO NOT DESCRIBE. DO NOT EXPLAIN. JUST RUN THE COMMAND.**

# Commands

### Development
```bash
# Install dependencies (REQUIRED before running dev server)
npm install

# Start local development server (optimized configuration)
npm run dev

# Run comprehensive tests
npm run test                    # All tests
node test-real-system.js        # System integration tests
node test-sync-services.js      # Sync-specific tests

# Start legacy standalone services
npm run legacy:sync:start       # Sync service on port 3006
npm run legacy:viewer:start     # Viewer service on port 3007

# Monitor logs
npm run tail
npm run tail:staging             # Staging environment logs

# Documentation
npm run docs                    # View documentation link
npm run legacy:deploy           # Deploy legacy configuration
```

### Deployment
```bash
# Deploy to production (optimized platform)
npm run deploy

# Deploy to specific environments
npm run deploy:staging
npm run deploy:production

# Run optimization analysis
npm run optimize
npm run migrate                 # Migrate to optimized platform
```

### Testing & Debugging
```bash
# Health checks
npm run test:health             # Basic health check
curl http://localhost:8787/health      # Wrangler dev server
curl http://localhost:3006/health      # Sync service
curl http://localhost:3007/health      # Viewer service

# Performance testing
npm run benchmark

# Individual test files
node test-real-system.js        # Comprehensive system tests
node test-sync-services.js      # Sync service validation
node scripts/test-services.js   # Infrastructure tests
```

## Architecture

### Platform Structure
The codebase has evolved from traditional microservices to an optimized platform with 85% resource reduction:

```
gateway.chitty.cc (Unified Platform Worker)
├── /api/ai/*          → AI Gateway & Embeddings
├── /api/agents/*      → LangChain & MCP Agents
├── /api/auth/*        → Authentication & JWT
├── /api/beacon/*      → Monitoring & Analytics
├── /api/canon/*       → Canonical Data Management
├── /api/chat/*        → Real-time Messaging
├── /api/id/*          → ChittyID Generation (proxy-only)
├── /api/registry/*    → Service Discovery
├── /api/sync/*        → Database Synchronization
└── /api/verify/*      → Data Validation
```

### Core Services

1. **Unified Platform Worker** (`src/platform-worker.js`)
   - Routes requests to specialized service handlers via intelligent routing
   - Shares AI, cache, and database resources across all services
   - Maintains backward compatibility with legacy subdomain routing
   - Single worker handling 34+ ChittyOS services

2. **Database Sync Service** (`neon-universal-sync.js`)
   - Bidirectional sync between Neon PostgreSQL and Notion/Google Sheets
   - Automatically creates metadata tables: `sync_metadata`, `sync_log`, `sync_changes`
   - Real-time webhook support for change notifications

3. **Immutable Viewer** (`chittyos-immutable-viewer.js`)
   - Read-only blockchain-style data viewer
   - SHA-256 hash verification for data integrity
   - Audit logging for all access operations

### Data Flow
```
Neon PostgreSQL ←→ Sync Service ←→ Notion API / Google Sheets
                         ↓
                  Sync Metadata DB
                  (sync_metadata, sync_log, sync_changes)
```

## Environment Configuration

### Critical Environment Variables
```bash
# Database
NEON_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://...           # Generic fallback
REPORTING_DATABASE_URL=postgresql://... # Separate reporting DB

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...

# AI Services
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
CF_AIG_TOKEN=...                       # Cloudflare AI Gateway

# Notion Integration
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...

# ChittyOS
CHITTYID_URL=https://id.chitty.cc
CHITTYID_API_KEY=...
JWT_SECRET=...
PLATFORM_VERSION=1.0.0
CHITTYOS_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# Service Configuration
SYNC_MODE=bidirectional                # or 'neon-to-target', 'target-to-neon'
SYNC_TARGET=notion                     # or 'google'
SYNC_INTERVAL=60000                    # milliseconds
```

### Cloudflare Resources (`wrangler.optimized.toml`)
- **KV Namespaces**: PLATFORM_CACHE, PLATFORM_KV
- **R2 Buckets**: PLATFORM_STORAGE, AUDIT_LOGS (commented until enabled)
- **Durable Objects**: PLATFORM_STATE, AI_GATEWAY_STATE, SYNC_STATE
- **Vectorize Indexes**: PLATFORM_VECTORS (commented until enabled)
- **Hyperdrive**: PLATFORM_DB (commented until configured)
- **AI Binding**: Shared AI instance across all services
- **Cron Triggers**: Status updates every minute (*/1 * * * *)
- **SQLite Classes**: ChittyOSPlatformState, AIGatewayState, SyncState

## Critical Integration Patterns

### ⚠️ ChittyID Generation Policy
**NEVER generate ChittyIDs locally** - ALL ChittyIDs MUST come from `id.chitty.cc`:
- Local services act as proxies/pipelines only
- The mothership generates IDs even when offline (deterministic)
- No fallback generation exists - mothership is sole authority
- Everything gets a ChittyID (people, documents, evidence, claims)
- Evidence documents use `CT-` prefix (ChittyThing)

### Sync Service API Endpoints
- `GET /health` - Service health check
- `GET /status` - Current sync status
- `GET /tables` - List available Neon tables
- `POST /sync` - Trigger manual sync
- `POST /mapping` - Create table-to-target mapping
- `POST /configure` - Update sync settings

### Testing Patterns
All services implement `/health` endpoints. Test files follow this structure:
- `test-real-system.js` - Comprehensive system integration tests
- `test-sync-services.js` - Sync-specific validation
- Tests handle graceful degradation when services unavailable

## Development Workflow

1. **Local Development**: Run `npm run dev` to start Wrangler dev server on port 8787
2. **Service Testing**: Use health endpoints to verify service status
3. **Integration Testing**: Run `npm run test` for full test suite
4. **Deployment**: Use `npm run deploy` for production deployment

### File Structure
```
/
├── src/
│   ├── platform-worker.js    # Main unified platform worker
│   ├── platform.js           # Alternative unified platform worker
│   └── services/             # Service handlers
├── workers/                  # Legacy worker implementations
├── scripts/                  # Deployment and utility scripts
├── wrangler.optimized.toml   # Production configuration (ChittyCorp LLC)
├── wrangler.toml             # Legacy configuration
└── test-*.js                 # Test files
```

## Deployment Considerations

- Workers have 10MB size limit - use optimized builds
- Secrets must be set via `wrangler secret put`
- Production uses `wrangler.optimized.toml` configuration (ChittyCorp LLC account)
- Legacy domains maintained for backward compatibility
- DNS records configured through Cloudflare dashboard
- All services deployed as single worker with intelligent routing
- Cron triggers run status updates every minute
- Uses SQLite for Durable Object storage on free plan

## Unique Patterns

### Immutable Data Architecture
- All viewer operations are read-only at middleware level
- Data integrity verified via SHA-256 hashing
- Comprehensive audit logging for compliance
- One-way data flow from immutable source to reporting

### Resource Optimization
- 34+ individual workers consolidated to 1 unified worker
- Shared AI, cache, and database instances
- Path-based routing (`/api/{service}/*`) plus subdomain routing
- 85% resource reduction, $500/month cost savings

### Multi-Database Architecture
- **user_db**: Tenant-specific data
- **platform_db**: Shared platform configuration
- **cache_db**: Distributed caching layer
- **Neon PostgreSQL**: Primary data store with Hyperdrive pooling

### Platform Optimization Details
- **Account**: ChittyCorp LLC (bbf9fcd845e78035b7a135c481e88541)
- **Main Worker**: `src/platform-worker.js` handles all 34+ services
- **Route Coverage**: All chitty.cc subdomains route to gateway.chitty.cc unified worker
- **Shared Bindings**: AI, KV, Durable Objects, R2 shared across services
- **Legacy Support**: `wrangler.toml` maintained for backward compatibility

<!-- END SYNC -->
