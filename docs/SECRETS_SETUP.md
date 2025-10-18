# Secrets Setup for Automated Deployment

**ChittyOS Project Initiation Service**

This guide walks through configuring all required secrets for automated deployment.

## Overview

Two types of secrets are needed:
1. **GitHub Secrets** - For GitHub Actions CI/CD
2. **Wrangler Secrets** - For runtime (deployed worker)

## GitHub Repository Secrets

**Location**: Repository → Settings → Secrets and variables → Actions

### Required Secrets

#### 1. CLOUDFLARE_API_TOKEN

**Description**: Cloudflare API token for deployments

**How to create**:
```bash
# 1. Go to: https://dash.cloudflare.com/profile/api-tokens
# 2. Click "Create Token"
# 3. Use template: "Edit Cloudflare Workers"
# 4. Permissions:
#    - Account: Workers Scripts: Edit
#    - Account: Workers KV Storage: Edit
#    - Account: Workers Tail: Read
# 5. Account Resources: Include specific account
# 6. Create Token
# 7. Copy token (shown only once!)
```

**Add to GitHub**:
```
Settings → Secrets → New repository secret
Name: CLOUDFLARE_API_TOKEN
Value: <paste-token-here>
```

#### 2. CLOUDFLARE_ACCOUNT_ID

**Description**: Cloudflare account ID

**How to find**:
```bash
# Option 1: From Cloudflare dashboard
# URL when viewing Workers:
# https://dash.cloudflare.com/<ACCOUNT_ID>/workers

# Option 2: From wrangler
wrangler whoami
# Shows account ID

# For ChittyOS Production
# Account ID: 0bc21e3a5a9de1a4cc843be9c3e98121
```

**Add to GitHub**:
```
Name: CLOUDFLARE_ACCOUNT_ID
Value: 0bc21e3a5a9de1a4cc843be9c3e98121
```

#### 3. GH_PROJECT_TOKEN

**Description**: GitHub Personal Access Token for GitHub Projects API

**How to create**:
```bash
# 1. Go to: https://github.com/settings/tokens
# 2. Click "Generate new token" → "Generate new token (classic)"
# 3. Name: "ChittyOS Project Initiation"
# 4. Expiration: 90 days (or longer)
# 5. Scopes:
#    ✅ repo (full control)
#    ✅ admin:org (full control)
#    ✅ write:org
#    ✅ project (full control)
# 6. Generate token
# 7. Copy token (shown only once!)
```

**Add to GitHub**:
```
Name: GH_PROJECT_TOKEN
Value: ghp_<token>
```

**⚠️ Important**: Different from `GITHUB_TOKEN` (auto-provided by Actions)

#### 4. CHITTY_ID_TOKEN

**Description**: Production ChittyID service token

**How to get**:
```bash
# Request from ChittyID service admin
# Or generate via id.chitty.cc admin panel
```

**Format**: `mcp_auth_<hex-string>`

**Add to GitHub**:
```
Name: CHITTY_ID_TOKEN
Value: mcp_auth_<token>
```

#### 5. CHITTY_ID_TOKEN_STAGING

**Description**: Staging ChittyID service token

**Add to GitHub**:
```
Name: CHITTY_ID_TOKEN_STAGING
Value: mcp_auth_<staging-token>
```

### Verify GitHub Secrets

```bash
# View configured secrets (values are hidden)
# Go to: Settings → Secrets and variables → Actions

# Should see:
✅ CLOUDFLARE_API_TOKEN
✅ CLOUDFLARE_ACCOUNT_ID
✅ GH_PROJECT_TOKEN
✅ CHITTY_ID_TOKEN
✅ CHITTY_ID_TOKEN_STAGING
```

## Wrangler Runtime Secrets

**These are used by the deployed worker at runtime.**

### Required Secrets

#### 1. GITHUB_TOKEN

**For**: GitHub API access from worker

**Staging**:
```bash
# Use token with limited scopes for safety
wrangler secret put GITHUB_TOKEN --env staging

# When prompted, paste token
# (Can use same as GH_PROJECT_TOKEN or create separate)
```

**Production**:
```bash
wrangler secret put GITHUB_TOKEN --env production

# Use production token with full scopes
```

**Verify**:
```bash
# List secrets (values hidden)
wrangler secret list --env staging
wrangler secret list --env production

# Should show:
# GITHUB_TOKEN
```

#### 2. CHITTY_ID_TOKEN

**For**: ChittyID service authentication from worker

**Staging**:
```bash
wrangler secret put CHITTY_ID_TOKEN --env staging

# Paste staging token
```

**Production**:
```bash
wrangler secret put CHITTY_ID_TOKEN --env production

# Paste production token
```

**Verify**:
```bash
wrangler secret list --env staging
wrangler secret list --env production

# Should show:
# GITHUB_TOKEN
# CHITTY_ID_TOKEN
```

### Optional Secrets

These may be needed for additional integrations:

```bash
# Notion integration
wrangler secret put NOTION_TOKEN --env production

# ChittySync integration
wrangler secret put CHITTYSYNC_TOKEN --env production

# OpenAI (if using for fallback AI)
wrangler secret put OPENAI_API_KEY --env production
```

## Environment Variables

**Public, non-sensitive configuration.**

Already configured in `wrangler.optimized.toml`:

```toml
[vars]
CHITTYID_URL = "https://id.chitty.cc"
DATA_REPO_OWNER = "chitcommit"
DATA_REPO_NAME = "chittychat-data"
CHITTYROUTER_URL = "https://router.chitty.cc"
PLATFORM_VERSION = "1.0.0"
```

No action needed unless changing values.

## GitHub Environments

**For deployment protection and approvals.**

### Setup Environments

#### 1. Staging Environment

```bash
# Go to: Settings → Environments → New environment
# Name: staging

# Configuration:
- Deployment branches: Selected branches → main
- Environment secrets: (none needed, uses repository secrets)
- Reviewers: (none needed, auto-deploy)
- Wait timer: 0 minutes
```

#### 2. Production Environment

```bash
# Go to: Settings → Environments → New environment
# Name: production

# Configuration:
- Deployment branches: Selected branches → production
- Environment secrets: (none needed)
- Required reviewers: Add team leads/admins
- Wait timer: 0 minutes
- Prevent self-review: ✅
```

#### 3. Production Rollback Environment

```bash
# Name: production-rollback

# Configuration:
- Deployment branches: All branches
- Required reviewers: Add team leads/admins
- Wait timer: 0 minutes
```

## Validation

### Test GitHub Secrets

```bash
# Trigger a workflow manually
# Go to: Actions → Deploy Project Initiation Service → Run workflow

# Select: staging
# Run workflow

# Check logs for:
✅ Secrets loaded
✅ Deployment successful
✅ Health checks pass
```

### Test Wrangler Secrets

```bash
# Deploy and check secure health endpoint
curl https://staging-initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN_STAGING"

# Should show:
{
  "status": "healthy",
  "bindings": {
    "GITHUB_TOKEN": true,
    "CHITTY_ID_TOKEN": true
  },
  "github": {
    "authenticated": true,
    "scopes": ["repo", "admin:org", ...],
    "user": "chitcommit"
  }
}
```

## Security Best Practices

### 1. Token Rotation

```bash
# Rotate tokens every 90 days
# Set calendar reminder

# When rotating:
1. Generate new token
2. Update GitHub secret
3. Update wrangler secret
4. Test deployment
5. Revoke old token
```

### 2. Scope Minimization

```bash
# Use least privilege
# Staging: Limited scopes OK
# Production: Full scopes required

# GitHub token scopes needed:
- repo ✅ (required)
- admin:org ✅ (required for Projects v2)
- write:org ✅ (required)
- project ✅ (required for Projects v2)

# Don't add:
- delete_repo ❌
- admin:enterprise ❌
```

### 3. Access Logging

```bash
# Monitor GitHub token usage
# Go to: https://github.com/settings/tokens
# Click on token → Check "Recent activity"

# Monitor Cloudflare API token
# Go to: https://dash.cloudflare.com/profile/api-tokens
# View "Last used" column
```

### 4. Revocation Plan

**If token compromised**:

```bash
# 1. Immediately revoke in GitHub/Cloudflare

# 2. Generate new token

# 3. Update secrets
wrangler secret put GITHUB_TOKEN --env production
# Update GitHub secret too

# 4. Verify deployment works
./scripts/auto-deploy.sh staging

# 5. Monitor for suspicious activity
```

## Troubleshooting

### "Secret not found" Error

```bash
# List configured secrets
wrangler secret list --env production

# If missing, add:
wrangler secret put SECRET_NAME --env production
```

### "Invalid token" Error

```bash
# Verify token validity
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user

# Should return user info
# If 401: Token invalid, regenerate

# Verify scopes
curl -I -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user | grep x-oauth-scopes

# Should include: repo, admin:org, write:org, project
```

### "Insufficient permissions" Error

```bash
# Check GitHub token scopes
curl -I -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user

# Look at x-oauth-scopes header

# If missing scopes:
1. Go to https://github.com/settings/tokens
2. Click token
3. Add missing scopes
4. Update secret in GitHub/Wrangler
```

## Quick Setup Script

Save and run this script for initial setup:

```bash
#!/bin/bash
# setup-secrets.sh

echo "ChittyOS Project Initiation - Secrets Setup"
echo ""

# Wrangler secrets - Staging
echo "Setting up staging secrets..."
echo "Enter GITHUB_TOKEN for staging:"
wrangler secret put GITHUB_TOKEN --env staging

echo "Enter CHITTY_ID_TOKEN for staging:"
wrangler secret put CHITTY_ID_TOKEN --env staging

# Wrangler secrets - Production
echo ""
echo "Setting up production secrets..."
echo "Enter GITHUB_TOKEN for production:"
wrangler secret put GITHUB_TOKEN --env production

echo "Enter CHITTY_ID_TOKEN for production:"
wrangler secret put CHITTY_ID_TOKEN --env production

echo ""
echo "✅ Wrangler secrets configured!"
echo ""
echo "Next steps:"
echo "1. Add GitHub repository secrets:"
echo "   - CLOUDFLARE_API_TOKEN"
echo "   - CLOUDFLARE_ACCOUNT_ID"
echo "   - GH_PROJECT_TOKEN"
echo "   - CHITTY_ID_TOKEN"
echo "   - CHITTY_ID_TOKEN_STAGING"
echo ""
echo "2. Configure GitHub environments:"
echo "   - staging (auto-deploy)"
echo "   - production (requires approval)"
echo ""
echo "3. Test deployment:"
echo "   ./scripts/auto-deploy.sh staging"
```

## Checklist

### GitHub Secrets ✓

- [ ] CLOUDFLARE_API_TOKEN
- [ ] CLOUDFLARE_ACCOUNT_ID
- [ ] GH_PROJECT_TOKEN
- [ ] CHITTY_ID_TOKEN
- [ ] CHITTY_ID_TOKEN_STAGING

### Wrangler Secrets ✓

**Staging**:
- [ ] GITHUB_TOKEN
- [ ] CHITTY_ID_TOKEN

**Production**:
- [ ] GITHUB_TOKEN
- [ ] CHITTY_ID_TOKEN

### GitHub Environments ✓

- [ ] staging (created, auto-deploy)
- [ ] production (created, requires approval)
- [ ] production-rollback (created, requires approval)

### Validation ✓

- [ ] GitHub Actions workflow runs successfully
- [ ] Staging deployment works
- [ ] Production deployment works (with approval)
- [ ] Health checks pass
- [ ] Secure endpoints authenticated

## Support

- **GitHub Token Issues**: https://github.com/settings/tokens
- **Cloudflare Token Issues**: https://dash.cloudflare.com/profile/api-tokens
- **ChittyID Token**: Contact ChittyOS admin
- **Documentation**: [docs/AUTO_DEPLOYMENT.md](AUTO_DEPLOYMENT.md)

---

**ChittyOS Project Initiation Service - Secrets Setup v1.0.0**
