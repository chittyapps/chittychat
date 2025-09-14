# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChittyChat is the **ultimate middleware platform for AI coordination** - a GitHub-like project management system for AI agents that runs as an MCP (Model Context Protocol) server directly integrated with Claude Code. It replaces individual agent todo lists with a unified, blockchain-verified project management system that appears as native Claude Code functionality.

This is a multi-workspace monorepo containing several interconnected Chitty services, with ChittyChat as the main project providing comprehensive AI agent coordination and human collaboration features.

### Core Purpose
- **MCP Server Integration**: Runs as a native MCP server that Claude Code directly interacts with
- **GitHub for AI**: Provides GitHub-style project management for AI agents and human collaboration
- **Blockchain Verification**: All actions are cryptographically signed and audit-trailed via ChittyChain
- **Universal Middleware**: Coordinates between multiple AI agents (Claude, GPT, custom) and services
- **Native Tool Extension**: Adds 20+ custom tools that appear as native Claude Code functions

### Enhanced Capabilities
- **Direct Command Execution**: Special permissions for bash commands and process management
- **Full Filesystem Access**: Read/write access to project files and user directories
- **Process Control**: Manages background services, daemons (pm2, launchctl, kill)
- **Network Services**: API access on ports 3003, 3005, 8080
- **Distributed Task Management**: Redis-backed agent runtime for scalable task distribution

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query, Tailwind CSS, and shadcn/ui components
- **Backend**: Express.js with TypeScript, WebSocket server, and Drizzle ORM
- **Database**: PostgreSQL (Neon serverless) with Drizzle migrations
- **Real-time**: WebSocket connections for agent communication and live updates
- **MCP Integration**: Model Context Protocol server for native Claude Code integration
- **Blockchain**: ChittyChain for immutable audit trails and evidence tracking
- **Identity**: ChittyID for cryptographic signing of all project actions
- **Queue System**: Redis for distributed task management
- **Agent Coordination**: Multi-agent orchestration with service discovery

## Common Development Commands

```bash
# Start development server (runs both frontend and backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking (ALWAYS run before committing)
npm run check

# Push database schema changes
npm run db:push

# Run QA test suite
./run-qa-tests.sh

# Database migrations (when schema changes)
npm run db:push
```

### Testing
Run the comprehensive QA test suite to validate all functionality:
```bash
./run-qa-tests.sh
```

This tests:
- API endpoints
- WebSocket connections  
- MCP protocol operations
- Project/task management
- Integration status
- Error handling

## Architecture

### Monorepo Structure
The repository contains multiple Chitty services that create a comprehensive AI coordination ecosystem:
- **chittychat** (root): Ultimate middleware platform for AI coordination and project management
- **chittyid**: Cryptographic identity service for signing all project actions
- **chittychain**: Blockchain service for immutable audit trails and evidence tracking
- **chittycan**: CDN and tunnel service for network infrastructure
- **chittyflow**: Task automation and workflow orchestration
- **chittyintel**: Analytics dashboard (ChittyInsight) for performance metrics
- **chittybeacon**: Application monitoring and tracking
- **chittyops**: DevOps and CI/CD pipeline configurations

**Service Integration**: 
- ChittyChat orchestrates all services as a unified middleware platform
- ChittyID provides cryptographic signing for every action
- ChittyChain maintains immutable project history
- ChittyFlow enables GitHub-like workflows and automation
- All services auto-discover and coordinate through service discovery

### Core Services
- **MCP Server** (`server/services/mcp-server.ts`): Handles Model Context Protocol requests from AI agents
- **ChittyID Client** (`server/services/chittyid-client.ts`): Synchronizes projects with external ChittyID system
- **Registry Client** (`server/services/registry-client.ts`): Discovers MCP tools from registry.chitty.cc
- **Background Jobs** (`server/services/background-jobs.ts`): Handles automated sync and data maintenance
- **ChittyBeacon** (`server/services/chitty-beacon.ts`): Application monitoring and tracking
- **Smart Recommendations** (`server/services/smart-recommendations.ts`): AI-powered task suggestions
- **Reputation System** (`server/services/reputation-system.ts`): Blockchain-powered agent performance tracking

### API Structure
- **REST API**: Traditional HTTP endpoints in `server/routes.ts`
- **WebSocket**: Real-time communication at `/ws` endpoint
- **MCP Endpoints**: Specialized routes for AI agent interactions (`/api/mcp/*`)

### Database Schema
Located in `shared/schema.ts` using Drizzle ORM:
- Projects (global/local management)
- Tasks (with AI agent assignments)
- Agents (registration and capabilities)
- Activities (audit trail)
- Integrations (external service configurations)
- MCPTools (registry of available tools)

### Frontend Components
- **UI Components**: shadcn/ui components in `client/src/components/ui/`
- **Pages**: Main views in `client/src/pages/`
- **Hooks**: Custom React hooks including WebSocket connection in `client/src/hooks/`
- **MCP Client**: Frontend MCP integration in `client/src/lib/mcp-client.ts`
- **API Client**: TanStack Query setup in `client/src/lib/api.ts`

## MCP Server Native Tools

### Enhanced Tool Suite
ChittyChat extends Claude Code with 20+ custom tools that appear as native functions:

#### Blockchain Tools
- `blockchain_add_evidence`: Add immutable evidence to project history
- `blockchain_get_audit_trail`: Retrieve complete audit trail for verification
- `blockchain_verify_integrity`: Validate blockchain integrity

#### Identity Tools  
- `identity_create`: Create cryptographic identities for agents/users
- `identity_sign`: Sign actions with cryptographic proof
- `identity_verify`: Verify signatures and identity authenticity

#### Finance Tools
- `finance_create_transaction`: Create financial transactions
- `finance_get_balance`: Query account balances
- `finance_audit_ledger`: Audit financial records

#### Agent Coordination
- `agent_submit_task`: Submit tasks to distributed queue
- `agent_get_status`: Get agent operational status
- `agent_coordinate`: Orchestrate multi-agent workflows

## GitHub-Like Project Management

ChittyChat provides GitHub-style features for AI project management:

### Repository Management
- **Template Repositories**: Start projects from predefined templates
- **Migration Workflows**: Staging environments for testing changes
- **Organization Structure**: Team management with role-based access
- **Automated Workflows**: CI/CD-like pipelines for document processing
- **Security Policies**: Vulnerability reporting and compliance tracking

### Native Integration Points
- **Direct MCP Communication**: Tools appear as native Claude Code functions
- **Filesystem Permissions**: Full read/write access to project files
- **Process Control**: Manage background services and daemons (pm2, launchctl, kill)
- **Network Services**: API access on ports 3003, 3005, 8080

## Key Integration Points

### Agent Task Management Workflow
When AI agents need to manage tasks through ChittyChat:
1. MCP server auto-connects when Claude Code launches
2. **Native tool access** - Use ChittyChat tools as if they're built into Claude Code
3. **Search for existing projects** before creating new ones:
   - Check if a similar project already exists (`GET /api/projects`)
   - Review project status (active/inactive) and last activity
   - Examine where previous work left off by checking task completion status
   - Continue existing projects when appropriate rather than creating duplicates
4. If no suitable project exists, create a new one with blockchain verification
5. All actions are cryptographically signed via ChittyID
6. Tasks distributed through Redis queue for scalable execution
7. All agents see real-time updates through service discovery

### Project Discovery Best Practices
- **Always search first**: Use project name, description, and tags to find related work
- **Check activity status**: Look at `lastActivityAt` to see if project is actively being worked on
- **Review task progress**: Examine completed vs pending tasks to understand current state
- **Avoid duplication**: Only create new projects when genuinely new work, not continuation
- **Smart Recommendations**: The system provides AI-powered suggestions for similar projects

### WebSocket Agent Registration
Agents connect and register via WebSocket with:
```javascript
{
  type: 'agent_register',
  name: 'Agent Name',
  agentType: 'claude',
  capabilities: ['task_management'],
  sessionId: 'unique_id'
}
```

### MCP Protocol Endpoints
- **Project search/list**: `GET /api/projects` - Search existing projects first
- **Project details**: `GET /api/projects/:id` - Check project status and progress
- **Project creation**: `POST /api/mcp/projects` - Only after confirming no duplicates
- **Task list**: `GET /api/tasks?projectId=:id` - Review existing tasks and their status
- **Task creation**: `POST /api/mcp/tasks` - Add new tasks to existing projects
- **Tool discovery**: `GET /api/mcp/discovery` - Find available tools and capabilities
- **Agent registration**: `POST /api/mcp/agents/register` - Register agent with the system
- **Activity feed**: `GET /api/activities?projectId=:id` - See recent project activity

## Environment Variables

Required and optional environment configurations:

### Core Services
- `PORT`: Server port (default: 5000)
- `MCP_PORT`: MCP server port (default: 3003)
- `API_PORT`: API server port (default: 8080)
- `WS_PORT`: WebSocket port (default: 3005)
- `DATABASE_URL`: PostgreSQL connection string (auto-provisioned in Replit)
- `REDIS_URL`: Redis connection for distributed task queue

### Service Integration
- `CHITTYID_API_URL`: ChittyID service endpoint for cryptographic signing
- `CHITTYID_API_KEY`: ChittyID authentication token
- `CHITTYCHAIN_API_URL`: Blockchain service endpoint
- `CHITTYCHAIN_API_KEY`: Blockchain authentication
- `REGISTRY_URL`: Registry service endpoint (registry.chitty.cc)
- `REGISTRY_API_KEY`: Registry authentication

### MCP Configuration
- `MCP_SERVER_PATH`: Path to ChittyChat MCP binary (/bin/chittychat)
- `MCP_PERMISSIONS`: JSON permissions config for Claude Code integration
- `CLAUDE_SETTINGS_PATH`: Path to .claude/settings.local.json

## Testing

The project includes a comprehensive QA test suite (`run-qa-tests.sh`) that validates:
- API endpoints functionality
- WebSocket connections
- MCP protocol operations
- Project and task management
- Integration status
- Error handling
- Data consistency

Run tests with: `./run-qa-tests.sh`

Test categories include:
1. Basic connectivity tests
2. Project management tests
3. Task management tests
4. MCP protocol tests
5. WebSocket connection tests
6. Integration tests
7. Data validation tests
8. Error handling tests

## Development Notes

### MCP Server Architecture
- **Native Integration**: ChittyChat runs as an MCP server alongside Claude Code
- **Tool Injection**: Custom tools appear as native Claude Code functions
- **Permission Model**: Special bash permissions for status commands and process control
- **Parallel System**: Creates a parallel project management system intercepting Claude Code operations

### Service Ports & Endpoints
- **Main Application**: Port 5000 - serves both API and client
- **MCP Server**: Port 3003 - Model Context Protocol server
- **WebSocket**: Port 3005 - Real-time communication
- **API Gateway**: Port 8080 - External API access
- **Redis Queue**: Port 6379 - Distributed task management

### Technical Implementation
- Vite development server is automatically configured in development mode
- Database migrations use Drizzle Kit with PostgreSQL (Neon serverless)
- Real-time updates broadcast to all connected WebSocket clients
- Background jobs run for ChittyID sync (30 min) and Registry sync (1 hour)
- All file paths in the codebase should be absolute, not relative
- TypeScript strict mode is enabled - ensure proper type annotations
- The system uses Drizzle ORM for database operations - check `shared/schema.ts` for schema definitions
- WebSocket server provides real-time updates at `/ws` endpoint
- MCP protocol WebSocket endpoint is available at `/mcp`
- Redis queues handle distributed task execution across agents
- ChittyChain provides immutable audit trails for all operations
- ChittyID cryptographically signs every action for verification

## Code Quality Standards

- **Type Safety**: Always provide proper TypeScript types, avoid `any`
- **Error Handling**: Wrap async operations in try-catch blocks
- **Database Operations**: Use Drizzle ORM methods, never raw SQL
- **Real-time Updates**: Broadcast relevant events to WebSocket clients
- **Agent Integration**: Follow MCP protocol standards for agent communication
- **API Responses**: Use consistent response formats with proper status codes

## Debugging Tips

- Check server logs for MCP/WebSocket connection issues
- Use `./run-qa-tests.sh` to validate all endpoints
- Monitor background job logs for sync failures
- Database issues: Check `DATABASE_URL` environment variable
- WebSocket issues: Verify port 5000 is accessible
- Integration failures: Check API keys in environment variables