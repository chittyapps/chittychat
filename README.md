# ChittyPM - MCP-Based AI Project Management System

## Overview

ChittyPM is a comprehensive, centralized project management system designed specifically for AI agents using the Model Context Protocol (MCP). It serves as a universal "todowrite" replacement that works seamlessly across various channels (code/desktop/online/app) and allows both GPT and Claude agents to log, track, and manage projects collaboratively.

## Key Features

### 🤖 MCP Protocol Integration
- **Universal Agent Support**: Compatible with Claude, GPT-4, and custom AI agents
- **Real-time Communication**: WebSocket-based connections for live updates
- **Standardized API**: MCP-compliant endpoints for consistent agent interactions
- **Cross-Platform**: Works across desktop, web, mobile, and API integrations

### 🔄 External Integrations
- **ChittyID Integration**: Automatic synchronization with ChittyID for broader project context
- **Registry.chitty.cc**: Universal registry for MCP tools and capabilities discovery
- **Background Sync**: Automated data integrity and cross-system synchronization

### 📊 Project Management Features
- **Global vs Local Projects**: Choose between centralized tracking or isolated project management
- **Self-Organizing**: AI-powered auto-categorization and project organization
- **Self-Repairing**: Automated data consistency checks and repairs
- **Real-time Updates**: Live project status, task completion, and agent activity

### 🎯 Task Management
- **AI-Enhanced Creation**: Automatic categorization, priority estimation, and tagging
- **Agent Assignment**: Smart task assignment to available AI agents
- **Progress Tracking**: Real-time completion status and progress indicators
- **Workflow Enforcement**: Structured processes for creating, updating, and completing tasks

## Architecture

### Backend Services
```
├── MCP Server          # Model Context Protocol implementation
├── ChittyID Client     # External project synchronization
├── Registry Client     # Tool/MCP discovery from registry.chitty.cc
├── Background Jobs     # Automated sync and data organization
├── WebSocket Server    # Real-time agent communication
└── REST API           # Traditional HTTP endpoints
```

### Database Schema
```
├── Projects           # Global and local project management
├── Tasks             # Task tracking with AI agent assignments
├── Agents            # AI agent registration and capabilities
├── Activities        # Audit trail and activity feed
├── Integrations      # External service status and configuration
└── MCP Tools         # Registry of available tools and capabilities
```

### Frontend Components
```
├── Dashboard         # Main project overview and management
├── Task Management   # Task creation, editing, and tracking
├── Agent Monitor     # AI agent status and activity
├── Integration Hub   # External service management
└── Activity Feed     # Real-time system activity
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Environment variables for integrations (optional)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd chittypm

# Install dependencies
npm install

# Set up database
# Database is automatically provisioned in Replit environment

# Start the application
npm run dev
```

### Environment Configuration
```bash
# Optional: ChittyID Integration
CHITTYID_API_URL=https://api.chittyid.com
CHITTYID_API_KEY=your_chittyid_api_key

# Optional: Registry Integration
REGISTRY_URL=https://registry.chitty.cc
REGISTRY_API_KEY=your_registry_api_key
```

## Usage for AI Agents

### MCP Connection
AI agents can connect via WebSocket:
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

// Register as an agent
ws.send(JSON.stringify({
  type: 'agent_register',
  name: 'Claude Assistant',
  agentType: 'claude',
  capabilities: ['task_management', 'project_organization'],
  sessionId: 'unique_session_id'
}));
```

### Common MCP Operations

#### Create a Project
```javascript
// Via MCP endpoint
POST /api/mcp/projects
{
  "agentId": "agent_id",
  "projectData": {
    "name": "Website Redesign",
    "description": "Complete overhaul of company website",
    "isGlobal": true,
    "category": "Frontend Development"
  }
}
```

#### Add a Task
```javascript
// Via MCP endpoint
POST /api/mcp/tasks
{
  "agentId": "agent_id",
  "taskData": {
    "projectId": "project_id",
    "title": "Implement responsive navigation",
    "description": "Create mobile-friendly navigation menu",
    "priority": "high"
  }
}
```

#### Update Task Status
```javascript
// Via REST API
PATCH /api/tasks/{taskId}
{
  "status": "completed",
  "updatedBy": "agent_id"
}
```

### Project Modes

#### Global Mode (Default)
- Projects are shared across all agents and systems
- Synchronized with ChittyID and external systems
- Visible to all connected agents
- Ideal for team collaboration

#### Local Mode
- Projects are isolated to specific agents or sessions
- No external synchronization
- Private project management
- Ideal for personal or sensitive projects

## Integration with External Systems

### ChittyID Integration
The system automatically synchronizes with ChittyID every 30 minutes:
- Imports new projects and tasks from ChittyID
- Exports local projects to ChittyID (when configured)
- Maintains bidirectional synchronization
- Preserves metadata and relationships

### Registry.chitty.cc Integration
Discovers and manages MCP tools every hour:
- Fetches available tools and MCPs from the universal registry
- Updates local tool database
- Provides tool suggestions based on project context
- Enables dynamic capability discovery

## Self-Organization Features

### Automatic Project Organization
- **Auto-categorization**: Projects are automatically categorized based on tasks and content
- **Tag generation**: Relevant tags are generated from project and task content
- **Progress calculation**: Real-time progress based on task completion
- **Metadata enrichment**: Additional context and relationships are automatically discovered

### Self-Repairing Data
- **Orphaned task cleanup**: Removes tasks without valid project references
- **Status validation**: Ensures task statuses are consistent with completion dates
- **Data integrity checks**: Validates relationships and references
- **Activity cleanup**: Maintains activity history within reasonable limits

## API Reference

### MCP Endpoints
- `POST /api/mcp/projects` - Create project via MCP
- `POST /api/mcp/tasks` - Create task via MCP
- `GET /api/mcp/discovery` - Discover available tools
- `POST /api/mcp/agents/register` - Register AI agent

### REST API
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project
- `PATCH /api/projects/:id` - Update project
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `GET /api/agents` - List all agents
- `GET /api/agents/active` - List active agents
- `GET /api/activities` - Get activity feed
- `GET /api/integrations` - Get integration status

### WebSocket Events
- `agent_register` - Register new agent
- `project_created` - Project creation notification
- `task_updated` - Task status change
- `agent_connected` - Agent connection status
- `chittyid_sync_completed` - ChittyID sync notification
- `registry_sync_completed` - Registry sync notification

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Structure
```
├── client/                 # React frontend
│   ├── src/components/    # Reusable UI components
│   ├── src/pages/        # Page components
│   ├── src/hooks/        # Custom React hooks
│   └── src/lib/          # Utility libraries
├── server/                # Express backend
│   ├── services/         # Business logic services
│   ├── routes.ts         # API route definitions
│   └── storage.ts        # Database abstraction
├── shared/               # Shared types and schemas
└── drizzle.config.ts     # Database configuration
```

## License

MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include logs and error messages when applicable

## Roadmap

### Planned Features
- [ ] Advanced analytics and reporting
- [ ] Custom workflow definitions
- [ ] Enhanced agent collaboration features
- [ ] Plugin system for custom integrations
- [ ] Mobile app for project monitoring
- [ ] Advanced AI-powered project insights

### Integration Roadmap
- [ ] Slack/Discord bot integration
- [ ] GitHub/GitLab project synchronization
- [ ] Calendar integration for task scheduling
- [ ] Email notifications and digests
- [ ] Advanced MCP protocol features