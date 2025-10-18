# ChittyOS Project Initiation - Automatic Deployment

**Version**: 1.0.0
**Status**: Production Ready

## Overview

Automated deployment system for ChittyOS Project Initiation Service with GitHub Actions CI/CD, Aspire monitoring, and zero-downtime deployments.

## Deployment Methods

### 1. GitHub Actions (Recommended)

**Automatic deployment on every push to main/production branches.**

#### Workflows

##### Main Deployment Workflow
`.github/workflows/deploy-project-initiation.yml`

**Triggers**:
- Push to `main` branch → Deploy to staging
- Push to `production` branch → Deploy to production
- Manual trigger via GitHub UI

**Jobs**:
1. **Validate** - Lint, type check, config validation
2. **Test** - Unit tests + integration tests
3. **Deploy Staging** - Auto-deploy to staging
4. **Deploy Production** - Deploy to production (requires approval)
5. **Rollback** - Auto-rollback on failure

##### Auto-Deploy on Push
`.github/workflows/auto-deploy-on-push.yml`

**Triggers**:
- Any push to `main` affecting `src/**`
- Automatic, no manual approval needed

**Fast deployment** (<2 minutes):
- Quick validation
- Deploy to staging
- Basic health checks

#### Setup GitHub Actions

1. **Add Repository Secrets**:
   ```
   Settings → Secrets and variables → Actions → New repository secret
   ```

   Required secrets:
   - `CLOUDFLARE_API_TOKEN` - Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` - Account ID
   - `GH_PROJECT_TOKEN` - GitHub token for Projects API
   - `CHITTY_ID_TOKEN` - Production ChittyID token
   - `CHITTY_ID_TOKEN_STAGING` - Staging ChittyID token

2. **Configure Environments**:
   ```
   Settings → Environments
   ```

   Create:
   - `staging` - Auto-deploy, no approval
   - `production` - Requires approval from admins
   - `production-rollback` - Auto-triggered on failures

3. **Enable Workflows**:
   ```bash
   # Commit workflow files
   git add .github/workflows/
   git commit -m "Add automated deployment workflows"
   git push origin main
   ```

4. **Test Deployment**:
   - Push to `main` → Auto-deploy to staging
   - Create PR to `production` → Merge triggers production deploy

### 2. Script-Based Deployment

**Local automated deployment script.**

#### Usage

```bash
# Deploy to staging
./scripts/auto-deploy.sh staging

# Deploy to production (requires confirmation)
./scripts/auto-deploy.sh production
```

#### What It Does

1. ✅ Pre-deployment checks (files, deps, secrets)
2. ✅ Service health checks (ChittyID, ChittyRouter)
3. ✅ Runs integration tests locally
4. ✅ Deploys to Cloudflare Workers
5. ✅ Post-deployment verification
6. ✅ Smoke tests
7. ✅ Registry registration (production only)

#### Setup

```bash
# 1. Make script executable (already done)
chmod +x scripts/auto-deploy.sh

# 2. Set environment variables
export CLOUDFLARE_API_TOKEN=your-token
export CHITTY_ID_TOKEN=your-chitty-token

# 3. Configure wrangler secrets
wrangler secret put GITHUB_TOKEN --env staging
wrangler secret put CHITTY_ID_TOKEN --env staging

wrangler secret put GITHUB_TOKEN --env production
wrangler secret put CHITTY_ID_TOKEN --env production

# 4. Run deployment
./scripts/auto-deploy.sh staging
```

### 3. Manual Deployment

**Traditional wrangler deployment.**

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# View deployment
wrangler deployments list --env production
```

## Aspire Integration

**Aspire dashboard for monitoring and observability.**

### Configuration

`aspire.config.json` defines:
- Resources (workers, services)
- Endpoints (health checks)
- Monitoring (metrics, logs)
- Deployment strategy

### Features

1. **Health Monitoring**
   - `/health` endpoint every 30s
   - `/health/secure` every 60s
   - Auto-alerts on failures

2. **Metrics Collection**
   - Cloudflare Workers metrics
   - Request rates, latency, errors
   - AI invocation success rates

3. **Log Aggregation**
   - Centralized logging
   - Error tracking
   - Audit trail

4. **Deployment Tracking**
   - Blue-green deployments
   - Auto-rollback on failures
   - Minimum healthy duration: 120s

### Access Aspire Dashboard

```bash
# View in browser (if Aspire installed)
aspire run --config aspire.config.json

# Or access via Cloudflare dashboard
open https://dash.cloudflare.com
```

## Deployment Environments

### Staging

**URL**: https://staging-initiate.chitty.cc

**Purpose**:
- Test deployments before production
- Integration testing
- Breaking changes acceptable

**Auto-deploy**: Yes (on push to `main`)

**Secrets**:
- `CHITTY_ID_TOKEN_STAGING`
- `GITHUB_TOKEN` (staging-safe token)

### Production

**URL**: https://initiate.chitty.cc

**Purpose**:
- Live production service
- High availability required
- Breaking changes NOT acceptable

**Auto-deploy**: No (requires manual approval)

**Secrets**:
- `CHITTY_ID_TOKEN` (production token)
- `GITHUB_TOKEN` (full permissions)

## Deployment Workflow

### Typical Flow

```
Developer pushes to main
    ↓
GitHub Actions triggered
    ↓
Validate + Test (2 min)
    ↓
Deploy to Staging (1 min)
    ↓
Smoke Tests (30s)
    ↓
[Manual approval for production]
    ↓
Deploy to Production (1 min)
    ↓
Verification + Registration (30s)
    ↓
Success! 🎉
```

### Total Time

- **Staging**: ~4 minutes (fully automated)
- **Production**: ~5 minutes (includes approval wait)

## Rollback Procedures

### Automatic Rollback

If production deployment fails health checks:
```
GitHub Actions automatically:
  1. Runs rollback job
  2. Reverts to previous version
  3. Verifies rollback successful
  4. Notifies team
```

### Manual Rollback

```bash
# Via wrangler
wrangler rollback --env production

# Via GitHub Actions
# Go to Actions → Deploy Project Initiation Service
# Click "Re-run jobs" on last successful deployment

# Via script
./scripts/auto-deploy.sh production
# (deploys current code, effectively rolling back if you've checked out old commit)
```

### Rollback Steps

1. **Identify Issue**
   ```bash
   # Check health
   curl https://initiate.chitty.cc/health

   # Check logs
   wrangler tail --env production
   ```

2. **Execute Rollback**
   ```bash
   wrangler rollback --env production
   ```

3. **Verify**
   ```bash
   curl https://initiate.chitty.cc/health
   ```

4. **Investigate**
   - Review deployment logs
   - Check Cloudflare Analytics
   - Review error logs
   - Test locally

5. **Fix and Redeploy**
   - Fix issue in code
   - Test locally
   - Deploy to staging first
   - Then deploy to production

## Monitoring & Alerts

### Health Checks

**Automated**:
- GitHub Actions checks health after each deploy
- Aspire monitors every 30s (basic) / 60s (secure)
- Cloudflare health checks

**Manual**:
```bash
# Basic health
curl https://initiate.chitty.cc/health

# Secure health (with auth)
curl https://initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN"

# Check GitHub token scopes
curl https://initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" | jq '.github'
```

### Metrics

**Available via**:
- Cloudflare Workers Analytics
- Aspire dashboard
- ChittyLedger (audit events)

**Key Metrics**:
- Request rate
- Error rate
- Response time (p50, p95, p99)
- AI success rate
- GitHub rate limit remaining

### Alerts

**Configured in**:
- GitHub Actions (deployment failures)
- Cloudflare (error rate thresholds)
- Aspire (custom alerts)

**Alert Channels**:
- GitHub notifications
- Email (configured in Cloudflare)
- Slack (via webhooks)

## Security

### Secrets Management

**Never commit**:
- API tokens
- Service credentials
- Environment secrets

**Use**:
- GitHub Secrets for CI/CD
- Wrangler secrets for runtime
- 1Password for team sharing

### GitHub Token Scopes

Required for `GITHUB_TOKEN`:
- ✅ `repo` - Full repository access
- ✅ `admin:org` - Organization management
- ✅ `write:org` - Organization data
- ✅ `project` - Projects v2 management

**Verify scopes**:
```bash
curl -I -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user \
  | grep x-oauth-scopes
```

### Access Control

**GitHub Actions**:
- Limit who can approve production deploys
- Use branch protection rules
- Require reviews before merge

**Cloudflare**:
- Use API tokens (not Global API Key)
- Scope tokens to specific permissions
- Rotate tokens regularly

## Troubleshooting

### Deployment Fails

**Check**:
```bash
# View GitHub Actions logs
# Go to repository → Actions → Failed workflow

# View wrangler logs
wrangler tail --env production

# Check syntax
npm run lint
```

**Common Issues**:
- Missing secrets → Set in GitHub/wrangler
- Syntax errors → Run linter locally
- Config errors → Validate wrangler.toml
- Rate limits → Wait and retry

### Health Check Fails

**Check**:
```bash
# Service status
curl https://initiate.chitty.cc/health

# Dependencies
curl https://id.chitty.cc/health
curl https://router.chitty.cc/health

# Logs
wrangler tail --env production --format pretty
```

**Common Issues**:
- ChittyID service down → Wait for recovery
- Missing secrets → Check wrangler secrets
- GitHub token invalid → Regenerate token
- Rate limit exceeded → Wait for reset

### Smoke Tests Fail

**Check**:
```bash
# Run tests locally
BASE_URL=https://initiate.chitty.cc \
AUTH_TOKEN=$CHITTY_ID_TOKEN \
node test-project-initiation.js

# Check specific endpoint
curl https://initiate.chitty.cc/api/initiate/kickoff \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -d @test-project.json
```

## Best Practices

### Development

1. ✅ Always test locally first
2. ✅ Deploy to staging before production
3. ✅ Run full test suite before deploy
4. ✅ Review Cloudflare logs after deploy
5. ✅ Monitor for 5 minutes post-deploy

### Deployment

1. ✅ Use automatic deployments (GitHub Actions)
2. ✅ Deploy during low-traffic windows
3. ✅ Have rollback plan ready
4. ✅ Monitor health checks closely
5. ✅ Update documentation

### Rollback

1. ✅ Don't panic - rollback is quick
2. ✅ Document the issue
3. ✅ Fix before redeploying
4. ✅ Test fix in staging first
5. ✅ Communicate with team

## Quick Reference

### Deploy Commands

```bash
# Auto-deploy script (staging)
./scripts/auto-deploy.sh staging

# Auto-deploy script (production)
./scripts/auto-deploy.sh production

# Manual wrangler
wrangler deploy --env production

# Rollback
wrangler rollback --env production

# View deployments
wrangler deployments list --env production
```

### Health Check URLs

```bash
# Staging
https://staging-initiate.chitty.cc/health
https://staging-initiate.chitty.cc/health/secure

# Production
https://initiate.chitty.cc/health
https://initiate.chitty.cc/health/secure
```

### Monitoring URLs

```bash
# Cloudflare Dashboard
https://dash.cloudflare.com

# GitHub Actions
https://github.com/chittyos/chittychat/actions

# ChittyRegistry
https://registry.chitty.cc
```

## Support

- **Documentation**: [docs/](../docs/)
- **GitHub Issues**: https://github.com/chittyos/chittychat/issues
- **Deployment Logs**: GitHub Actions → Workflow runs
- **Service Logs**: `wrangler tail --env production`

---

**ChittyOS Project Initiation Service - Auto Deployment v1.0.0**
**Powered by GitHub Actions, Cloudflare Workers, and Aspire**
