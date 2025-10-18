# ChittyOS Project Initiation Service - Deployment Checklist

**Version**: 1.0.0
**Service**: Project Initiation (initiate.chitty.cc)

## Pre-Deployment

### 1. Credentials & Secrets

- [ ] GitHub Personal Access Token created with scopes:
  - [ ] `repo` (full control of repositories)
  - [ ] `admin:org` (full control of organizations)
  - [ ] `write:org` (read and write org data)
  - [ ] `project` (full control of projects)

- [ ] ChittyID Service Token obtained from id.chitty.cc

- [ ] Secrets configured in Cloudflare:
  ```bash
  wrangler secret put GITHUB_TOKEN --env production
  wrangler secret put CHITTY_ID_TOKEN --env production
  ```

### 2. Repository Access

- [ ] chittychat-data repository exists and accessible
- [ ] Repository owner/name configured in wrangler.toml:
  - DATA_REPO_OWNER: `chitcommit`
  - DATA_REPO_NAME: `chittychat-data`

- [ ] GitHub token has write access to data repository

### 3. Environment Configuration

- [ ] wrangler.optimized.toml reviewed and updated:
  - [ ] AI binding configured
  - [ ] PLATFORM_KV namespace exists
  - [ ] Environment variables set
  - [ ] Routes added for initiate.chitty.cc

- [ ] Environment variables validated:
  ```bash
  CHITTYID_URL=https://id.chitty.cc
  DATA_REPO_OWNER=chitcommit
  DATA_REPO_NAME=chittychat-data
  CHITTYROUTER_URL=https://router.chitty.cc
  ```

### 4. Dependencies

- [ ] ChittyID service (id.chitty.cc) is operational
  ```bash
  curl https://id.chitty.cc/health
  ```

- [ ] ChittyRouter service (router.chitty.cc) is operational
  ```bash
  curl https://router.chitty.cc/health
  ```

- [ ] ChittyLedger available (optional but recommended)

- [ ] ChittySync configured (optional)

### 5. Code Review

- [ ] src/services/project-initiation.js reviewed
- [ ] platform-worker.js routing added
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive
- [ ] All TODOs resolved

### 6. Testing

- [ ] Local testing completed:
  ```bash
  npm run dev
  node test-project-initiation.js
  ```

- [ ] All tests passing locally

- [ ] Health check endpoints verified:
  ```bash
  curl http://localhost:8787/health
  curl http://localhost:8787/health/secure
  ```

## Deployment

### 1. Deploy to Production

```bash
# From chittyos-services/chittychat directory
npm run deploy

# Or specifically for production
wrangler deploy --env production
```

- [ ] Deployment successful
- [ ] No errors in deployment output
- [ ] Worker deployed to Cloudflare

### 2. DNS Configuration

- [ ] DNS record for initiate.chitty.cc points to worker
- [ ] Route pattern `initiate.chitty.cc/*` configured
- [ ] Path-based route `/api/initiate/*` works on gateway.chitty.cc

### 3. Verification

- [ ] Production health check:
  ```bash
  curl https://initiate.chitty.cc/health
  ```

- [ ] Secure health check:
  ```bash
  curl https://initiate.chitty.cc/health/secure \
    -H "Authorization: Bearer $CHITTY_ID_TOKEN"
  ```

- [ ] Verify GitHub authentication in health response

- [ ] Check all required scopes present

### 4. Smoke Test

- [ ] Create test project kickoff:
  ```bash
  curl -X POST https://initiate.chitty.cc/api/initiate/kickoff \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
    -d @test-project.json
  ```

- [ ] Verify response structure
- [ ] Check GitHub for created items:
  - [ ] Project created
  - [ ] Milestones created
  - [ ] Issues created
  - [ ] Roadmap files in chittychat-data repo

## Post-Deployment

### 1. Service Registration

- [ ] Register in ChittyRegistry:
  ```bash
  curl -X POST https://registry.chitty.cc/api/register \
    -H "Content-Type: application/json" \
    -d '{
      "serviceId": "chittychat.project.initiation",
      "name": "Project Initiation Service",
      "version": "1.0.0",
      "endpoint": "https://initiate.chitty.cc",
      "capabilities": ["github", "ai", "chittysync", "ledger"],
      "healthEndpoint": "https://initiate.chitty.cc/health"
    }'
  ```

### 2. Monitoring Setup

- [ ] Cloudflare Analytics dashboard reviewed
- [ ] Alert thresholds configured:
  - GitHub rate limit < 100 (warning)
  - GitHub rate limit < 10 (critical)
  - AI generation failure rate > 20% (warning)
  - Project initiation failure rate > 10% (critical)

- [ ] Log retention configured
- [ ] Error tracking enabled

### 3. Documentation

- [ ] Service documented in ChittyOS docs
- [ ] API reference published
- [ ] Examples added to docs
- [ ] GitHub templates copied to target repos

### 4. Integration Testing

- [ ] Full end-to-end test with real project
- [ ] Verify all integrations:
  - [ ] ChittyID minting working
  - [ ] GitHub Projects v2 created
  - [ ] WorkerAI task generation
  - [ ] ChittyLedger writes
  - [ ] ChittySync pushes (if configured)
  - [ ] Cross-repo dependencies linked

### 5. Performance Baseline

- [ ] Response time measured:
  ```bash
  time curl https://initiate.chitty.cc/health
  ```

- [ ] Full kickoff duration measured
- [ ] Cost per project calculated
- [ ] Rate limit usage tracked

## Rollback Plan

If issues occur after deployment:

### 1. Immediate Rollback

```bash
# Rollback to previous deployment
wrangler rollback --env production

# Or deploy previous version
git checkout <previous-commit>
wrangler deploy --env production
```

### 2. Disable Service

If critical issues:

```bash
# Remove routes temporarily
wrangler routes delete <route-id> --env production

# Or update DNS to point away from worker
```

### 3. Investigate

- [ ] Check Cloudflare logs
- [ ] Review error rates
- [ ] Verify credentials
- [ ] Test dependencies
- [ ] Check GitHub API status

## Post-Rollback

- [ ] Incident documented
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Testing repeated
- [ ] Redeploy when ready

## Success Criteria

Deployment is successful when:

- [x] All health checks passing
- [x] GitHub authentication verified
- [x] Smoke test completes successfully
- [x] Service registered in ChittyRegistry
- [x] Monitoring configured
- [x] Documentation updated
- [x] No critical errors in logs
- [x] Response times acceptable (<1s for health check)

## Contacts

- **Primary**: ChittyOS Platform Team
- **GitHub Issues**: https://github.com/chittyos/chittychat/issues
- **Service Health**: https://initiate.chitty.cc/health
- **Documentation**: https://docs.chitty.cc

## Notes

Add deployment-specific notes here:

- Deployment Date:
- Deployed By:
- Deployment ID:
- Special Considerations:

---

**Checklist Version**: 1.0.0
**Last Updated**: 2025-10-18
**Service**: ChittyOS Project Initiation v1.0.0
