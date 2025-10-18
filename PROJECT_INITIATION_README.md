# ChittyOS Project Initiation Service

**Automate GitHub project setup when projects reach kickoff.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://initiate.chitty.cc)
[![Status](https://img.shields.io/badge/status-production-green.svg)](https://initiate.chitty.cc/health)

## 🚀 Quick Start

```bash
# Deploy
cd chittyos-services/chittychat
npm run deploy

# Test
curl https://initiate.chitty.cc/health

# Initiate project
curl -X POST https://initiate.chitty.cc/api/initiate/kickoff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -d @project.json
```

## 📋 What It Does

When a project reaches kickoff, this service:

1. ✅ **Mints ChittyIDs** for project, milestones, and issues
2. ✅ **Creates GitHub Projects v2** with custom fields
3. ✅ **Generates milestones** with due dates
4. ✅ **AI-powered task breakdown** using WorkerAI (Llama 3.3 70B)
5. ✅ **Creates issues** with proper labels and assignments
6. ✅ **Generates roadmap** (Markdown + JSON)
7. ✅ **Links cross-repo dependencies**
8. ✅ **Writes to ChittyLedger** for audit trail
9. ✅ **Syncs to Notion/To-Do Hub** via ChittySync

## 🏗️ Architecture

```
User Request
    ↓
ChittyAuth (verify)
    ↓
ChittyConnect (context)
    ↓
ProjectInitiationService
    ├─ GitHub API (Projects v2, Issues, Milestones)
    ├─ WorkerAI (Task generation)
    ├─ ChittyID (Entity identification)
    ├─ ChittyLedger (Audit trail)
    └─ ChittySync (Notion/To-Do Hub)
    ↓
202 Accepted (with ctxId)
```

## 📦 Key Features

### Edge-Native Implementation
- ✅ **No Octokit** - Direct fetch to GitHub API
- ✅ **No Buffer** - Uses btoa/TextEncoder
- ✅ **WorkerAI** - Native Cloudflare AI binding
- ✅ **Concurrency control** - Parallel operations with limits
- ✅ **Rate limiting** - Auto-backoff when GitHub limits low

### Production-Ready
- ✅ **Budget gates** - Cost estimation before execution
- ✅ **Idempotency** - Supports Idempotency-Key header
- ✅ **Retry logic** - Handles 409 conflicts automatically
- ✅ **Structured errors** - Clear error responses with stage info
- ✅ **Comprehensive logging** - All operations logged to ChittyLedger

### AI-Powered
- ✅ **Task generation** - Llama 3.3 70B breaks down projects
- ✅ **Schema validation** - Validates AI output structure
- ✅ **Fallback tasks** - 6 predefined templates if AI fails
- ✅ **Deterministic** - Temperature 0.4 for consistency

## 📁 Project Structure

```
src/services/
  └── project-initiation.js          # Main service implementation

docs/
  └── PROJECT_INITIATION_SERVICE.md  # Comprehensive documentation

github-templates/
  ├── ISSUE_TEMPLATE/
  │   └── project_task.yml           # Issue template
  ├── PULL_REQUEST_TEMPLATE.md       # PR template
  └── README.md                       # Templates guide

test-project-initiation.js           # Integration tests
DEPLOYMENT_CHECKLIST.md              # Deployment guide
PROJECT_INITIATION_README.md         # This file
```

## 🔧 Configuration

### Required Secrets

```bash
# GitHub token (repo, admin:org, write:org, project scopes)
wrangler secret put GITHUB_TOKEN --env production

# ChittyID service token
wrangler secret put CHITTY_ID_TOKEN --env production
```

### Environment Variables

Already configured in `wrangler.optimized.toml`:

```bash
CHITTYID_URL=https://id.chitty.cc
DATA_REPO_OWNER=chitcommit
DATA_REPO_NAME=chittychat-data
CHITTYROUTER_URL=https://router.chitty.cc
```

### Required Bindings

- `AI` - Cloudflare WorkerAI
- `PLATFORM_KV` - KV namespace for idempotency

## 🧪 Testing

### Run Tests Locally

```bash
# Start dev server
npm run dev

# In another terminal
node test-project-initiation.js

# Or set custom base URL
BASE_URL=http://localhost:8787 node test-project-initiation.js
```

### Run Tests Against Production

```bash
BASE_URL=https://initiate.chitty.cc \
AUTH_TOKEN=$CHITTY_ID_TOKEN \
node test-project-initiation.js
```

### Test Coverage

- ✅ Health checks (basic and secure)
- ✅ Authorization validation
- ✅ Request size limits
- ✅ Project kickoff validation
- ✅ Invalid endpoints
- ✅ CORS preflight
- ✅ Routing (path-based vs subdomain)
- ✅ Platform headers
- ✅ Response time benchmarking

## 📖 API Reference

### `POST /api/initiate/kickoff`

Main orchestration endpoint. Returns `202 Accepted`.

**Request**:
```json
{
  "projectName": "My Project",
  "description": "Project description",
  "repos": [
    {
      "owner": "myorg",
      "repo": "my-repo",
      "isOrg": true,
      "role": "primary"
    }
  ],
  "owners": [
    {
      "username": "alice",
      "role": "lead"
    }
  ],
  "estimatedDuration": 90,
  "priority": "high",
  "tags": ["typescript", "cloudflare"]
}
```

**Response**:
```json
{
  "success": true,
  "ctxId": "ctx_abc123",
  "projectId": "CHITTY-PROP-...",
  "projectName": "My Project",
  "phase": "kickoff",
  "kickoffDate": "2025-10-18T...",
  "results": { ... },
  "summary": {
    "totalRepos": 1,
    "totalProjects": 1,
    "totalMilestones": 4,
    "totalIssues": 24,
    "roadmapUrl": "...",
    "duration": 5432
  }
}
```

### `GET /health`

Basic health check.

### `GET /health/secure`

Validates all bindings and GitHub token scopes.

## 📊 Cost Breakdown

| Operation | Cost | Volume | Per Repo |
|-----------|------|--------|----------|
| GitHub API | $0.001/call | ~50 | $0.05 |
| WorkerAI | $0.01/call | 1 | $0.01 |
| ChittyID | $0.005/ID | ~25 | $0.13 |
| **Total** | | | **~$0.19** |

Typical 3-repo project: **~$0.60**

## 🚢 Deployment

Follow the comprehensive [Deployment Checklist](DEPLOYMENT_CHECKLIST.md).

Quick deployment:

```bash
# 1. Set secrets
wrangler secret put GITHUB_TOKEN --env production
wrangler secret put CHITTY_ID_TOKEN --env production

# 2. Deploy
npm run deploy

# 3. Verify
curl https://initiate.chitty.cc/health
```

## 📚 Documentation

- **Full Documentation**: [docs/PROJECT_INITIATION_SERVICE.md](docs/PROJECT_INITIATION_SERVICE.md)
- **Deployment Guide**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- **GitHub Templates**: [github-templates/README.md](github-templates/README.md)
- **Integration Tests**: [test-project-initiation.js](test-project-initiation.js)

## 🔗 Integration Points

- **ChittyAuth**: Authorization and scope validation
- **ChittyConnect**: Context tracking
- **ChittyID**: Entity identification (id.chitty.cc)
- **ChittyLedger**: Audit trail
- **ChittySync**: Notion/To-Do Hub sync
- **WorkerAI**: Task generation
- **GitHub API**: Projects v2, Issues, Milestones

## 🛠️ Troubleshooting

### GitHub Token Invalid

```bash
# Verify token
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user

# Check scopes in x-oauth-scopes header
curl -I -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user

# Regenerate and update
wrangler secret put GITHUB_TOKEN --env production
```

### ChittyID Service Down

```bash
# Check service health
curl https://id.chitty.cc/health

# Service cannot proceed without ChittyID
```

### Rate Limit Exceeded

```bash
# Check remaining rate limit
curl https://initiate.chitty.cc/health/secure

# Service auto-backs-off when low
# Wait for reset time shown in response
```

## 📈 Monitoring

### Health Endpoints

```bash
# Basic
curl https://initiate.chitty.cc/health

# Detailed (requires auth)
curl https://initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN"
```

### Metrics (via ChittyLedger)

- `PROJECT_INITIATED` - New kickoffs
- `MILESTONE_CREATED` - Milestones
- `ISSUE_CREATED` - Issues
- `ROADMAP_GENERATED` - Roadmaps
- `AI_TASK_GEN_SUCCESS` - AI succeeded
- `AI_TASK_GEN_FAILED` - AI failed (used fallback)
- `INIT_FAILED` - Any failure
- `EXEC_METRIC` - Execution metrics

### Alert Thresholds

- GitHub rate limit < 100 → Warning
- GitHub rate limit < 10 → Critical
- AI success rate < 80% → Degraded
- Failure rate > 10% → Critical

## 🤝 Contributing

1. Create feature branch
2. Implement changes
3. Run tests: `node test-project-initiation.js`
4. Update documentation
5. Create PR with ChittyID reference

## 📄 License

Part of ChittyOS Framework - © 2025

## 🔗 Links

- **Service**: https://initiate.chitty.cc
- **Health**: https://initiate.chitty.cc/health
- **Documentation**: https://docs.chitty.cc
- **GitHub**: https://github.com/chittyos/chittychat
- **ChittyOS**: https://chitty.cc

---

**ChittyOS Project Initiation Service v1.0.0**
Built with Cloudflare Workers, WorkerAI, and GitHub API
