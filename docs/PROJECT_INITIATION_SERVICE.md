# ChittyOS Project Initiation Service

**Version**: 1.0.0
**Status**: Production Ready
**Deployed**: initiate.chitty.cc, gateway.chitty.cc/api/initiate/*

## Overview

Automates GitHub project setup, issue creation, milestone management, and roadmap generation when projects reach kickoff phase.

### Features

- ✅ GitHub Projects v2 creation and configuration
- ✅ AI-powered task breakdown (WorkerAI)
- ✅ ChittyID minting for all entities
- ✅ ChittyLedger audit trail
- ✅ ChittySync integration (Notion/To-Do Hub)
- ✅ Dual roadmap outputs (Markdown + JSON)
- ✅ Cross-repo dependency linking
- ✅ Concurrency control and rate limiting
- ✅ Budget gates and cost estimation

## Quick Start

### 1. Configure Secrets

```bash
# Set GitHub token (requires: repo, admin:org, write:org, project scopes)
wrangler secret put GITHUB_TOKEN --env production

# Set ChittyID token
wrangler secret put CHITTY_ID_TOKEN --env production
```

### 2. Deploy Service

```bash
cd chittyos-services/chittychat
npm run deploy
```

### 3. Verify Deployment

```bash
# Basic health check
curl https://initiate.chitty.cc/health

# Secure health check (validates GitHub token scopes)
curl https://initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN"
```

### 4. Initiate First Project

```bash
curl -X POST https://initiate.chitty.cc/api/initiate/kickoff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -d '{
    "projectName": "My Awesome Project",
    "description": "Building something amazing",
    "repos": [
      {
        "owner": "myorg",
        "repo": "my-project",
        "isOrg": true,
        "role": "primary"
      }
    ],
    "owners": [
      {
        "username": "johndoe",
        "role": "lead"
      }
    ],
    "estimatedDuration": 90,
    "priority": "high",
    "tags": ["typescript", "cloudflare", "api"]
  }'
```

## API Reference

### Endpoints

#### `POST /api/initiate/kickoff`

Main orchestration endpoint. Returns `202 Accepted` with context ID for tracking.

**Request Body**:
```typescript
{
  projectName: string;
  description: string;
  repos: Array<{
    owner: string;
    repo: string;
    isOrg?: boolean;
    role?: string;
  }>;
  owners: Array<{
    username: string;
    role?: string;
  }>;
  milestones?: Array<{
    title: string;
    description: string;
    dueDate: string; // ISO 8601
  }>;
  estimatedDuration?: number; // days (default: 90)
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
}
```

**Response**:
```typescript
{
  success: boolean;
  ctxId: string;
  projectId: string; // ChittyID
  projectName: string;
  phase: 'kickoff';
  kickoffDate: string;
  results: {
    dataRepoUpdate: { filePath, url },
    githubProjects: { projects: [...], count },
    milestones: { milestones: [...], count },
    issues: { issues: [...], count, aiGenerated, fallback },
    roadmap: { mdPath, jsonPath, mdUrl, jsonUrl },
    dependencies: { dependencies: [...], count }
  };
  summary: {
    totalRepos: number;
    totalProjects: number;
    totalMilestones: number;
    totalIssues: number;
    roadmapUrl: string;
    duration: number; // ms
  }
}
```

#### `GET /health`

Basic health check.

#### `GET /health/secure`

Validates all bindings and GitHub token scopes.

**Response**:
```json
{
  "status": "healthy",
  "bindings": {
    "AI": true,
    "PLATFORM_KV": true,
    "GITHUB_TOKEN": true,
    "CHITTY_ID_TOKEN": true
  },
  "github": {
    "authenticated": true,
    "scopes": ["repo", "admin:org", "write:org", "project"],
    "missing": [],
    "user": "chitcommit"
  }
}
```

## Architecture

### Data Flow

```
User → ChittyAuth.verify
  ↓
ChittyConnect.ensureContext → ctxId
  ↓
ProjectInitiationService.run(ctxId)
  ├─ GitHub (milestones, issues, projects)
  ├─ WorkerAI (task generation)
  ├─ ChittyLedger.record (audit)
  └─ ChittySync.push (Notion/To-Do Hub)
```

### Integration Points

1. **ChittyAuth**: Authorization and scope validation
2. **ChittyConnect**: Context envelope for tracking
3. **ChittyID**: Entity identification (id.chitty.cc)
4. **ChittyLedger**: Audit trail for all operations
5. **ChittySync**: Push to Notion and To-Do Hub
6. **WorkerAI**: Task generation (Llama 3.3 70B)
7. **GitHub API**: Projects v2, Issues, Milestones

### Cost Breakdown

| Operation | Cost | Volume | Total |
|-----------|------|--------|-------|
| GitHub API calls | $0.001/call | ~50/repo | ~$0.05/repo |
| WorkerAI invocations | $0.01/call | 1/repo | $0.01/repo |
| ChittyID minting | $0.005/ID | ~25/repo | ~$0.13/repo |
| **Total per repo** | | | **~$0.19** |

Typical 3-repo project: **~$0.60**

## Configuration

### Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_...          # GitHub personal access token
CHITTY_ID_TOKEN=mcp_auth_...  # ChittyID service token

# Optional (defaults shown)
CHITTYID_URL=https://id.chitty.cc
DATA_REPO_OWNER=chitcommit
DATA_REPO_NAME=chittychat-data
CHITTYROUTER_URL=https://router.chitty.cc
```

### GitHub Token Scopes

Required scopes for `GITHUB_TOKEN`:
- `repo` - Full control of private repositories
- `admin:org` - Full control of orgs and teams
- `write:org` - Read and write org data
- `project` - Full control of projects

### Bindings

- `AI` - Cloudflare WorkerAI
- `PLATFORM_KV` - KV namespace for idempotency keys

## Operational Patterns

### Budget Gates

Before executing, service checks:
```typescript
const estimatedCost = calculateCost(projectConfig);
const allowed = await BudgetDAO.allow(userId, 'project:initiate', estimatedCost);
```

Fails with `402 Payment Required` if budget exceeded.

### Idempotency

Supports `Idempotency-Key` header:
```bash
curl -X POST https://initiate.chitty.cc/api/initiate/kickoff \
  -H "Idempotency-Key: unique-key-123" \
  -H "Authorization: Bearer $TOKEN" \
  -d @project.json
```

Keys stored in KV for 24 hours.

### Rate Limiting

- Monitors GitHub `x-ratelimit-remaining` header
- Backs off when remaining < 100
- Alerts when remaining < 10
- Automatic retry on 409 conflicts

### Concurrency Control

- Parallel milestone creation across repos
- Parallel issue creation with semaphore
- Parallel label creation
- Max 6 concurrent GitHub operations

### Error Handling

Structured error responses:
```json
{
  "stage": "milestone_creation",
  "message": "GitHub API error",
  "cause": "...",
  "ctxId": "ctx_abc123",
  "ts": 1234567890
}
```

All failures logged to ChittyLedger with `INIT_FAILED` event.

## AI Task Generation

### WorkerAI Integration

Model: `@cf/meta/llama-3.3-70b-instruct`
Temperature: 0.4 (deterministic)
Max tokens: 4096

### Prompt Template

```
Generate granular development tasks for this project. Return ONLY valid JSON.

PROJECT: My Project
DESCRIPTION: Project description

MILESTONES:
1. Setup & Planning (Due: 2025-11-01)
2. Core Development (Due: 2025-12-01)

REQUIREMENTS:
- Each task must be completable in 1-3 days
- Include specific acceptance criteria
- Assign to appropriate milestone
- Set priority: critical, high, medium, or low
- Add technology labels

Return ONLY the JSON array, no markdown, no explanation.
```

### Schema Validation

All AI outputs validated against schema:
```typescript
{
  title: string,
  description: string,
  milestoneTitle: string,
  priority: 'critical' | 'high' | 'medium' | 'low',
  labels: string[],
  estimatedDays: 1 | 2 | 3
}
```

Invalid outputs trigger fallback task generator.

### Fallback Tasks

6 predefined task templates:
1. Setup development environment
2. Design architecture
3. Implement core logic
4. Write unit tests
5. Integration testing
6. Documentation

## Monitoring

### Health Checks

```bash
# Basic
curl https://initiate.chitty.cc/health

# Secure (validates everything)
curl https://initiate.chitty.cc/health/secure \
  -H "Authorization: Bearer $TOKEN"
```

### Metrics

Tracked via ChittyLedger:
- `PROJECT_INITIATED` - New project kickoff
- `MILESTONE_CREATED` - Milestones created
- `ISSUE_CREATED` - Issues created
- `ROADMAP_GENERATED` - Roadmap files written
- `XREPO_LINKED` - Cross-repo dependencies
- `INIT_FAILED` - Any failure
- `AI_TASK_GEN_SUCCESS` - AI succeeded
- `AI_TASK_GEN_FAILED` - AI failed, used fallback
- `EXEC_METRIC` - Execution metrics (duration, counts)

### Alerts

Monitor these thresholds:
- GitHub rate limit < 100 (warning)
- GitHub rate limit < 10 (critical)
- AI generation success rate < 80% (degraded)
- Project initiation failure rate > 10% (critical)
- ChittyID service failures > 5% (critical)

## Troubleshooting

### GitHub Token Invalid

**Symptom**: 401 errors from GitHub API

**Solution**:
1. Check token: `curl -H "Authorization: Bearer $TOKEN" https://api.github.com/user`
2. Verify scopes: Check `x-oauth-scopes` header
3. Regenerate if needed and update secret:
   ```bash
   wrangler secret put GITHUB_TOKEN --env production
   ```

### ChittyID Service Down

**Symptom**: "ChittyID service unavailable" error

**Solution**:
1. Check id.chitty.cc health: `curl https://id.chitty.cc/health`
2. Verify CHITTY_ID_TOKEN: `echo $CHITTY_ID_TOKEN`
3. Service fails fast - cannot proceed without ChittyID

### AI Generation Failures

**Symptom**: All tasks from fallback generator

**Solution**:
1. Check WorkerAI binding: `wrangler deployments list`
2. Review AI invocation logs in dashboard
3. Fallback tasks still functional, no service impact

### Rate Limit Exceeded

**Symptom**: 403 responses from GitHub

**Solution**:
1. Check remaining: `/health/secure` endpoint
2. Wait for reset (shown in response)
3. Service auto-backs-off when low

## Development

### Local Testing

```bash
# Start wrangler dev
npm run dev

# Test locally
curl -X POST http://localhost:8787/api/initiate/kickoff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d @test-project.json
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
node test-project-initiation.js

# End-to-end
npm run test:e2e
```

### Deployment Checklist

- [ ] GitHub token configured with correct scopes
- [ ] CHITTY_ID_TOKEN secret set
- [ ] WorkerAI binding verified
- [ ] PLATFORM_KV namespace exists
- [ ] chittychat-data repo accessible
- [ ] Environment variables set
- [ ] Routes configured in wrangler.toml
- [ ] DNS records point to worker
- [ ] Health checks pass
- [ ] Registered in ChittyRegistry

## Examples

### Simple Single-Repo Project

```json
{
  "projectName": "Simple API",
  "description": "REST API with TypeScript",
  "repos": [{
    "owner": "myorg",
    "repo": "simple-api",
    "isOrg": true
  }],
  "owners": [{
    "username": "alice"
  }],
  "priority": "medium"
}
```

### Multi-Repo Monorepo Project

```json
{
  "projectName": "Full Stack App",
  "description": "React + Node.js application",
  "repos": [
    {
      "owner": "myorg",
      "repo": "frontend",
      "isOrg": true,
      "role": "frontend"
    },
    {
      "owner": "myorg",
      "repo": "backend",
      "isOrg": true,
      "role": "backend"
    },
    {
      "owner": "myorg",
      "repo": "shared",
      "isOrg": true,
      "role": "library"
    }
  ],
  "owners": [
    {"username": "alice", "role": "frontend-lead"},
    {"username": "bob", "role": "backend-lead"}
  ],
  "milestones": [
    {
      "title": "MVP Launch",
      "description": "Minimum viable product",
      "dueDate": "2025-12-01T00:00:00Z"
    }
  ],
  "estimatedDuration": 120,
  "priority": "high",
  "tags": ["typescript", "react", "nodejs", "api"]
}
```

### Custom Milestones

```json
{
  "projectName": "AI Platform",
  "description": "Machine learning platform",
  "repos": [{
    "owner": "aiorg",
    "repo": "ml-platform",
    "isOrg": true
  }],
  "owners": [{"username": "datascientist"}],
  "milestones": [
    {
      "title": "Data Pipeline",
      "description": "Build data ingestion and preprocessing",
      "dueDate": "2025-11-15T00:00:00Z"
    },
    {
      "title": "Model Training",
      "description": "Implement training infrastructure",
      "dueDate": "2025-12-15T00:00:00Z"
    },
    {
      "title": "Model Deployment",
      "description": "Deploy models to production",
      "dueDate": "2026-01-15T00:00:00Z"
    },
    {
      "title": "Monitoring & Optimization",
      "description": "Setup monitoring and optimize performance",
      "dueDate": "2026-02-15T00:00:00Z"
    }
  ],
  "priority": "critical",
  "tags": ["python", "ml", "ai", "data-science"]
}
```

## Roadmap Outputs

### Markdown (ROADMAP.md)

Stored in `projects/{projectName}/ROADMAP.md` in chittychat-data repo.

Contains:
- Project overview with ChittyID
- Milestones with tasks
- Tasks organized by priority
- Links to GitHub issues

### JSON (ROADMAP.json)

Machine-readable format for sync systems.

```json
{
  "projectId": "CHITTY-PROP-...",
  "projectName": "My Project",
  "ctxId": "ctx_...",
  "generatedAt": "2025-10-18T...",
  "milestones": [
    {
      "chittyId": "CHITTY-EVNT-...",
      "title": "Setup & Planning",
      "dueDate": "2025-11-01T...",
      "url": "https://github.com/.../milestone/1",
      "repo": "owner/repo",
      "tasks": [...]
    }
  ],
  "summary": {
    "totalMilestones": 4,
    "totalIssues": 24,
    "byPriority": {
      "critical": 3,
      "high": 8,
      "medium": 10,
      "low": 3
    }
  }
}
```

## Support

- **Documentation**: https://docs.chitty.cc
- **Service Health**: https://initiate.chitty.cc/health
- **GitHub Issues**: https://github.com/chittyos/chittychat/issues
- **ChittyOS Registry**: https://registry.chitty.cc

---

**ChittyOS Project Initiation Service v1.0.0**
**Part of the ChittyOS Framework**
