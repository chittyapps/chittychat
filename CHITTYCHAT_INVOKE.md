# ChittyChat Universal Invocation

ChittyChat is your traffic controller and project lifeguard for AI-leveraged projects. Call it from anywhere to manage sessions, prevent duplication, and maintain pipeline integrity.

## Traffic Control Endpoints

```bash
# Pipeline safety check
curl https://sync.chitty.cc/pipeline/status

# Check for duplicates before creation
curl -X POST https://sync.chitty.cc/validate/unique \
  -H "Content-Type: application/json" \
  -d '{"type":"project","identifier":"project-name"}'

# Session management
curl -X POST https://sync.chitty.cc/session/fork \
  -d '{"base_session":"session-id","branch":"feature-branch"}'

# Conflict resolution
curl -X POST https://sync.chitty.cc/resolve/conflicts \
  -d '{"session_a":"id1","session_b":"id2","strategy":"merge"}'
```

## Project Management Operations

### GitHub Integration
```bash
# Sync with GitHub repo
curl -X POST https://sync.chitty.cc/github/sync \
  -d '{"repo":"owner/repo","branch":"main"}'

# Create AI-managed branch
curl -X POST https://sync.chitty.cc/github/ai-branch \
  -d '{"repo":"owner/repo","ai_session":"session-id"}'
```

### Notion Integration
```bash
# Sync project to Notion
curl -X POST https://sync.chitty.cc/notion/sync \
  -d '{"project_id":"proj-123","database_id":"notion-db-id"}'

# AI workflow tracking
curl -X POST https://sync.chitty.cc/notion/ai-workflow \
  -d '{"workflow_id":"wf-123","status":"in_progress"}'
```

### Session Control
```bash
# Fork AI session
curl -X POST https://sync.chitty.cc/session/fork

# Merge sessions
curl -X POST https://sync.chitty.cc/session/merge

# Rebase session
curl -X POST https://sync.chitty.cc/session/rebase

# Resolve conflicts
curl -X POST https://sync.chitty.cc/session/resolve
```

## Traffic Controller Functions

### Duplication Prevention
```bash
# Check if exists
curl -X GET https://sync.chitty.cc/registry/exists/{resource-id}

# Register new resource
curl -X POST https://sync.chitty.cc/registry/register \
  -d '{"type":"component","id":"comp-123","location":"github/repo"}'

# Deregister resource
curl -X DELETE https://sync.chitty.cc/registry/{resource-id}
```

### Pipeline Safety
```bash
# Emergency stop
curl -X POST https://sync.chitty.cc/emergency/stop

# Clear pipeline
curl -X POST https://sync.chitty.cc/pipeline/clear

# Resume operations
curl -X POST https://sync.chitty.cc/pipeline/resume

# Check pipeline health
curl -X GET https://sync.chitty.cc/pipeline/health
```

### Coordination with Core Services
```bash
# Registry coordination
curl -X POST https://sync.chitty.cc/coordinate/registry \
  -d '{"action":"validate","resource":"proj-123"}'

# Canon compliance check
curl -X POST https://sync.chitty.cc/coordinate/canon \
  -d '{"data":"payload","schema":"project-v1"}'

# Schema validation
curl -X POST https://sync.chitty.cc/coordinate/schema \
  -d '{"schema_id":"proj-schema","version":"1.0"}'

# Router coordination
curl -X POST https://sync.chitty.cc/coordinate/router \
  -d '{"route":"destination","load":"high"}'
```

## Environment Setup

```bash
export CHITTYCHAT_URL="https://sync.chitty.cc"
export CHITTYCHAT_AUTH_TOKEN="your-auth-token"
export CHITTYID_URL="https://id.chitty.cc"
export CHITTYROUTER_URL="https://gateway.chitty.cc"
export NEON_DATABASE_URL="postgresql://..."
export NOTION_TOKEN="secret_..."
export GITHUB_TOKEN="ghp_EXAMPLE_REPLACE_WITH_REAL_TOKEN"
```

## Emergency Protocols

### Code Brown (System Contamination)
```bash
#!/bin/bash
echo "EMERGENCY: Code Brown - System Contamination Detected"
curl -X POST https://sync.chitty.cc/emergency/code-brown
echo "All operations halted. System in quarantine mode."
```

### Lightning Protocol (Infrastructure Threat)
```bash
#!/bin/bash
echo "EMERGENCY: Lightning Sighted - Infrastructure Threat"
curl -X POST https://sync.chitty.cc/emergency/lightning
echo "All processes evacuated. System in shelter mode."
```

### Flow Violations
```bash
# Report backwards flow
curl -X POST https://sync.chitty.cc/violations/backwards-flow \
  -d '{"session":"sess-123","violation":"reverse-write"}'

# Report tube jumping
curl -X POST https://sync.chitty.cc/violations/tube-jumping \
  -d '{"process":"proc-456","violation":"cross-contamination"}'

# Report lollygagging
curl -X POST https://sync.chitty.cc/violations/lollygagging \
  -d '{"resource":"res-789","violation":"resource-hogging"}'
```

## AI Project Workflows

### Session Management
```bash
# Start AI session
curl -X POST https://sync.chitty.cc/ai/session/start \
  -d '{"project":"proj-123","model":"claude-3","context":"development"}'

# Track AI contributions
curl -X POST https://sync.chitty.cc/ai/contributions/track \
  -d '{"session":"sess-123","type":"code","lines":50}'

# Version AI outputs
curl -X POST https://sync.chitty.cc/ai/version/create \
  -d '{"session":"sess-123","output":"generated-code","hash":"abc123"}'
```

### Collaboration Tracking
```bash
# Human-AI collaboration
curl -X POST https://sync.chitty.cc/collaboration/log \
  -d '{"human":"user-123","ai":"claude","action":"code-review"}'

# Multi-user AI sessions
curl -X POST https://sync.chitty.cc/collaboration/join \
  -d '{"session":"sess-123","user":"user-456","role":"reviewer"}'
```

## Integration Scripts

### Full System Health Check
```bash
#!/bin/bash
echo "ChittyChat System Health Check"
echo "============================="

# Check ChittyChat traffic controller
echo "Traffic Controller: $(curl -s https://sync.chitty.cc/health)"

# Check coordination with core services
echo "Registry Coordination: $(curl -s https://sync.chitty.cc/coordinate/registry/health)"
echo "Canon Coordination: $(curl -s https://sync.chitty.cc/coordinate/canon/health)"
echo "Schema Coordination: $(curl -s https://sync.chitty.cc/coordinate/schema/health)"
echo "Router Coordination: $(curl -s https://sync.chitty.cc/coordinate/router/health)"

# Check pipeline status
echo "Pipeline Status: $(curl -s https://sync.chitty.cc/pipeline/status)"
```

### Project Initialization
```bash
#!/bin/bash
PROJECT_NAME=$1
echo "Initializing AI-leveraged project: $PROJECT_NAME"

# Register with ChittyChat
curl -X POST https://sync.chitty.cc/project/init \
  -d "{\"name\":\"$PROJECT_NAME\",\"type\":\"ai-leveraged\"}"

# Setup GitHub integration
curl -X POST https://sync.chitty.cc/github/setup \
  -d "{\"project\":\"$PROJECT_NAME\",\"repo\":\"owner/$PROJECT_NAME\"}"

# Setup Notion tracking
curl -X POST https://sync.chitty.cc/notion/setup \
  -d "{\"project\":\"$PROJECT_NAME\",\"workspace\":\"team-workspace\"}"

echo "Project $PROJECT_NAME ready for AI-assisted development"
```