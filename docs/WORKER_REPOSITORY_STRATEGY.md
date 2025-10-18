# Worker Repository Strategy

**ChittyOS Architecture Decision: One Worker = One Repository**

## Problem Statement

Currently, all ChittyOS workers are managed in a single monorepo (`chittychat`). This creates several challenges:

1. ❌ **Difficult Auditing** - Hard to track changes to individual workers
2. ❌ **Complex CI/CD** - All workers deploy together, increasing blast radius
3. ❌ **Poor Visibility** - Can't see deployment history per worker in Cloudflare
4. ❌ **Version Confusion** - Single version number for 34+ services
5. ❌ **Permission Issues** - Can't grant granular access to specific workers
6. ❌ **Large PRs** - Changes across multiple workers in one PR

## Solution: One Worker = One Repository

Each worker gets its own dedicated GitHub repository with:

✅ Independent versioning
✅ Dedicated CI/CD pipeline
✅ Clear audit trail
✅ Granular access control
✅ Smaller, focused PRs
✅ Easy rollback per worker

## Repository Structure

### Naming Convention

```
chittyos-{service}-worker
```

**Examples**:
- `chittyos-project-initiation-worker`
- `chittyos-ai-gateway-worker`
- `chittyos-langchain-worker`
- `chittyos-auth-worker`
- `chittyos-id-worker`

### Repository Template

Each worker repo contains:

```
chittyos-{service}-worker/
├── src/
│   └── index.js                 # Worker entry point
├── test/
│   └── integration.test.js      # Integration tests
├── .github/
│   └── workflows/
│       └── deploy.yml           # Auto-deployment
├── wrangler.toml                # Worker configuration
├── package.json                 # Dependencies
├── README.md                    # Service documentation
├── CHANGELOG.md                 # Version history
└── .env.example                 # Environment template
```

## Migration Plan

### Phase 1: Extract Core Workers

**Priority workers** (critical path):

1. ✅ **project-initiation-worker**
   - Service: Project Initiation
   - Domain: initiate.chitty.cc
   - File: `src/services/project-initiation.js`

2. **chittyid-worker** (Already separate)
   - Service: ChittyID
   - Domain: id.chitty.cc
   - Status: ✅ Already in own repo

3. **chittyauth-worker** (Already separate)
   - Service: ChittyAuth
   - Domain: auth.chitty.cc
   - Status: ✅ Already in own repo

4. **ai-gateway-worker**
   - Service: AI Gateway
   - Domain: ai.chitty.cc
   - File: `src/services/ai-gateway.js`

5. **langchain-worker**
   - Service: LangChain Integration
   - Domain: langchain.chitty.cc
   - File: `src/services/langchain-enhanced.js`

### Phase 2: Extract Supporting Workers

6. **registry-worker**
   - Service: ChittyRegistry
   - Domain: registry.chitty.cc

7. **canon-worker**
   - Service: ChittyCanon
   - Domain: canon.chitty.cc

8. **chittyledger-worker**
   - Service: ChittyLedger
   - Domain: ledger.chitty.cc

9. **beacon-worker**
   - Service: ChittyBeacon
   - Domain: beacon.chitty.cc

10. **sync-worker**
    - Service: ChittySync
    - Domain: sync.chitty.cc

### Phase 3: Extract Remaining Workers

11-34. All other services

## Automation

### Auto-Create Repositories

Script: `scripts/create-worker-repo.sh`

```bash
./scripts/create-worker-repo.sh project-initiation
```

Creates:
- ✅ GitHub repository
- ✅ Initial structure
- ✅ GitHub Actions workflow
- ✅ Cloudflare Worker
- ✅ DNS configuration
- ✅ Secrets setup

### Sync from Monorepo

Script: `scripts/sync-worker-to-repo.sh`

```bash
./scripts/sync-worker-to-repo.sh project-initiation
```

Automatically:
- Extracts worker code
- Copies to dedicated repo
- Commits and pushes
- Triggers deployment

## Benefits

### 1. Clear Audit Trail

**Before** (monorepo):
```bash
git log src/services/project-initiation.js
# Mixed with all other changes
```

**After** (dedicated repo):
```bash
git log
# Only project-initiation changes
# Clear version history
```

### 2. Independent Deployments

**Before**:
```
Push to main → All 34 workers redeploy
```

**After**:
```
Push to project-initiation repo → Only that worker redeploys
```

### 3. Easier Rollback

**Before**:
```bash
wrangler rollback
# Rolls back ALL workers
```

**After**:
```bash
# In project-initiation-worker repo
wrangler rollback
# Only rolls back project-initiation
```

### 4. Cloudflare Dashboard Visibility

**Before**:
- Single "chittyos-platform" worker
- Can't see which service changed

**After**:
- Separate "chittyos-project-initiation-worker" entry
- Clear deployment history per service
- Separate metrics per worker

### 5. Granular Permissions

**Before**:
- Access to monorepo = access to all workers

**After**:
- Grant access per worker repo
- Contractors can work on specific workers
- Better security isolation

## Repository Metadata

Each repo includes:

### README.md

```markdown
# ChittyOS Project Initiation Worker

**Service**: Project Initiation
**Domain**: initiate.chitty.cc
**Version**: 1.0.0

## Quick Start

\`\`\`bash
npm install
wrangler dev
wrangler deploy
\`\`\`

## Documentation

- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)

## Links

- **Production**: https://initiate.chitty.cc
- **Health**: https://initiate.chitty.cc/health
- **Cloudflare**: [Worker Dashboard](https://dash.cloudflare.com/...)
- **ChittyRegistry**: https://registry.chitty.cc/services/project-initiation
```

### CHANGELOG.md

```markdown
# Changelog

## [1.0.0] - 2025-10-18

### Added
- Initial release
- AI-powered task generation
- GitHub Projects v2 integration
- ChittyID minting
```

### package.json

```json
{
  "name": "@chittyos/project-initiation-worker",
  "version": "1.0.0",
  "description": "ChittyOS Project Initiation Service Worker",
  "repository": "github:chittyos/chittyos-project-initiation-worker",
  "private": true
}
```

## GitHub Topics

Each repo tagged with:
- `chittyos`
- `cloudflare-workers`
- `worker`
- `{service-name}` (e.g., `project-initiation`)

Makes discovery easy:
```
https://github.com/topics/chittyos
```

## CI/CD Integration

### Per-Worker Workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy Worker

on:
  push:
    branches: [main, production]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

### Cross-Worker Dependencies

If Worker A depends on Worker B:

```yaml
# In worker-a/.github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - name: Wait for dependencies
        run: |
          curl -f https://worker-b.chitty.cc/health || exit 1
```

## Monorepo vs Multi-Repo

### Keep Monorepo For

✅ **Shared libraries** (`src/lib/*`)
✅ **Documentation** (cross-service docs)
✅ **Infrastructure** (Terraform, scripts)
✅ **GitHub templates** (issue/PR templates)

### Extract to Dedicated Repos

✅ **Individual workers** (`src/services/*`)
✅ **Worker-specific tests**
✅ **Worker configurations** (`wrangler.toml` per worker)

## Implementation Steps

### 1. Create First Worker Repo

```bash
# Run script
./scripts/create-worker-repo.sh project-initiation

# Verify
# Go to: https://github.com/chittyos/chittyos-project-initiation-worker
```

### 2. Extract and Sync Code

```bash
# Sync from monorepo
./scripts/sync-worker-to-repo.sh project-initiation

# Verify sync
cd ../chittyos-project-initiation-worker
git log
```

### 3. Configure CI/CD

```bash
# Add secrets to new repo
# Settings → Secrets → Add:
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID
# - CHITTY_ID_TOKEN
```

### 4. Deploy from New Repo

```bash
# Push to main → auto-deploy
git push origin main

# Or manual
wrangler deploy
```

### 5. Update Monorepo

```bash
# In monorepo, mark as extracted
echo "Migrated to: chittyos-project-initiation-worker" > src/services/project-initiation.MIGRATED

# Update platform-worker.js routing to use service binding
```

## Maintaining Both During Transition

**Dual-deploy strategy** during migration:

1. Monorepo still deploys (backward compat)
2. New repo deploys to same worker name
3. Both push to same Cloudflare worker
4. Once stable, remove from monorepo

## Tooling

### Repository Management

```bash
# List all worker repos
gh repo list chittyos --topic chittyos-worker

# Clone all worker repos
./scripts/clone-all-workers.sh

# Sync all workers from monorepo
./scripts/sync-all-workers.sh
```

### Health Monitoring

```bash
# Check all workers
./scripts/health-check-all-workers.sh

# Output:
✅ project-initiation (200) https://initiate.chitty.cc/health
✅ ai-gateway (200) https://ai.chitty.cc/health
❌ registry (503) https://registry.chitty.cc/health
```

## Documentation Updates

### ChittyRegistry

Update service registry with repo links:

```json
{
  "serviceId": "project-initiation",
  "name": "Project Initiation Service",
  "repository": "https://github.com/chittyos/chittyos-project-initiation-worker",
  "cloudflareWorker": "chittyos-project-initiation-worker",
  "domain": "initiate.chitty.cc"
}
```

### Service Documentation

Each repo's README links to:
- Monorepo (for shared libs)
- Other worker repos (for dependencies)
- ChittyRegistry (for service mesh)

## Migration Checklist

Per worker:

- [ ] Create dedicated repository
- [ ] Extract worker code
- [ ] Copy tests
- [ ] Set up GitHub Actions
- [ ] Configure secrets
- [ ] Deploy from new repo
- [ ] Verify health checks
- [ ] Update ChittyRegistry
- [ ] Update documentation
- [ ] Mark as migrated in monorepo

## Rollout Timeline

- **Week 1**: Project Initiation Worker (✅ You are here)
- **Week 2**: AI Gateway, LangChain
- **Week 3**: Registry, Canon, Ledger
- **Week 4**: Beacon, Sync, remaining workers

## Success Metrics

- ✅ Each worker has dedicated repo
- ✅ Independent deployment per worker
- ✅ Clear audit trail per service
- ✅ Reduced monorepo complexity
- ✅ Faster CI/CD per service
- ✅ Better Cloudflare dashboard visibility

---

**ChittyOS Worker Repository Strategy v1.0.0**
**Microservices Architecture with Independent Repositories**
