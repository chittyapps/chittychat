# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChittyPM is a **universal todowrite replacement** for all AI agents - providing a single, centralized project management board that replaces individual agent todo lists. Instead of each agent maintaining its own isolated todo list, ChittyPM enables all agents (Claude, GPT, custom agents) to collaborate on a unified PM board for each project.

### Core Purpose
- **Replaces todowrite**: This system supersedes individual agent todo tracking tools
- **Universal PM Board**: One centralized board per project, accessible by all agents
- **Cross-Agent Collaboration**: Multiple AI agents can work on the same project simultaneously
- **Persistent State**: Tasks and projects persist across sessions and agent instances

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite, TanStack Query, Tailwind CSS, and shadcn/ui components
- **Backend**: Express.js with TypeScript, WebSocket server, and Drizzle ORM
- **Database**: PostgreSQL (Neon serverless) with Drizzle migrations
- **Real-time**: WebSocket connections for agent communication and live updates

## Common Development Commands

```bash
# Start development server (runs both frontend and backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run check

# Push database schema changes
npm run db:push

# Run QA test suite
./run-qa-tests.sh
```

## Architecture

### Core Services
- **MCP Server** (`server/services/mcp-server.ts`): Handles Model Context Protocol requests from AI agents
- **ChittyID Client** (`server/services/chittyid-client.ts`): Synchronizes projects with external ChittyID system
- **Registry Client** (`server/services/registry-client.ts`): Discovers MCP tools from registry.chitty.cc
- **Background Jobs** (`server/services/background-jobs.ts`): Handles automated sync and data maintenance
- **ChittyBeacon** (`server/services/chitty-beacon.ts`): Application monitoring and tracking
- **Smart Recommendations** (`server/services/smart-recommendations.ts`): AI-powered task suggestions
- **Reputation System** (`server/services/reputation-system.ts`): Agent performance tracking

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

### Frontend Components
- **UI Components**: shadcn/ui components in `client/src/components/ui/`
- **Pages**: Main views in `client/src/pages/`
- **Hooks**: Custom React hooks including WebSocket connection in `client/src/hooks/`
- **MCP Client**: Frontend MCP integration in `client/src/lib/mcp-client.ts`

## Key Integration Points

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

### MCP Protocol
- Project creation: `POST /api/mcp/projects`
- Task creation: `POST /api/mcp/tasks`
- Tool discovery: `GET /api/mcp/discovery`
- Agent registration: `POST /api/mcp/agents/register`

## Environment Variables

Optional integrations configured via environment:
- `CHITTYID_API_URL`: ChittyID service endpoint
- `CHITTYID_API_KEY`: ChittyID authentication
- `REGISTRY_URL`: Registry service endpoint
- `REGISTRY_API_KEY`: Registry authentication
- `DATABASE_URL`: PostgreSQL connection string (auto-provisioned in Replit)
- `PORT`: Server port (default: 5000)

## Testing

The project includes a comprehensive QA test suite (`run-qa-tests.sh`) that validates:
- API endpoints functionality
- WebSocket connections
- MCP protocol operations
- Project and task management
- Integration status
- Error handling

Run tests with: `./run-qa-tests.sh`

## Development Notes

- The application runs on a single port (default 5000) serving both API and client
- Vite development server is automatically configured in development mode
- Database migrations use Drizzle Kit with PostgreSQL
- Real-time updates broadcast to all connected WebSocket clients
- Background jobs run for ChittyID sync (30 min) and Registry sync (1 hour)
- All file paths in the codebase should be absolute, not relative