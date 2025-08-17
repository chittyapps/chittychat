# ChittyPM: TodoWrite Replacement

ChittyPM serves as a comprehensive replacement for Claude's "todowrite" function, providing enhanced project management and task organization capabilities through the Model Context Protocol (MCP).

## Overview

This system replaces Claude's native todowrite functionality with a powerful, self-organizing project management platform that includes:

- **Smart Auto-Categorization**: Automatically categorizes tasks based on content analysis
- **Intelligent Project Assignment**: Auto-assigns tasks to relevant projects
- **Blockchain-Powered Reputation**: Agent reputation scoring and verification
- **Real-time Collaboration**: WebSocket-based live updates across all clients
- **Mobile-First Design**: Responsive interface with glass morphism effects

## MCP Integration

### Protocol Implementation

ChittyPM implements the Model Context Protocol (MCP) to enable seamless integration with Claude and other AI systems. The MCP server runs alongside the main application and provides the following capabilities:

#### Available Methods

1. **todowrite.create** - Create new tasks with auto-categorization
2. **todowrite.list** - List and filter existing tasks
3. **todowrite.update** - Update task status and properties
4. **todowrite.delete** - Remove tasks from the system
5. **project.create** - Create new projects for task organization
6. **recommendations.get** - Get smart recommendations for tasks/projects
7. **reputation.get** - Retrieve agent reputation scores

### Usage Examples

#### Creating a Todo (Replacing Claude's todowrite)

```javascript
// MCP Message to create a todo
{
  "id": "create-task-1",
  "method": "todowrite.create",
  "params": {
    "content": "Fix the urgent bug in the user authentication system that's causing login failures",
    "priority": "high", // optional - will be auto-detected if not provided
    "project": "auth-system", // optional - will be auto-assigned if not provided
    "dueDate": "2025-01-20"
  }
}

// Response with smart categorization
{
  "id": "create-task-1",
  "result": {
    "task": {
      "id": "task_abc123",
      "title": "Fix the urgent bug in the user authentication system",
      "description": "Fix the urgent bug in the user authentication system that's causing login failures",
      "status": "todo",
      "priority": "high",
      "category": "bug-fix",
      "projectId": "proj_auth_xyz",
      "tags": ["security", "backend", "urgent"],
      "createdAt": "2025-01-17T23:40:00Z"
    },
    "autoAssigned": {
      "project": "proj_auth_xyz",
      "priority": "high",
      "tags": ["security", "backend", "urgent"]
    },
    "recommendations": [
      {
        "type": "agent",
        "name": "Security Expert Bot",
        "reason": "Specializes in authentication and security fixes"
      }
    ],
    "message": "Todo created successfully with smart categorization"
  }
}
```

#### Listing Todos

```javascript
// List all todos with optional filtering
{
  "id": "list-todos-1",
  "method": "todowrite.list",
  "params": {
    "projectId": "proj_auth_xyz", // optional filter
    "status": "todo", // optional filter
    "limit": 20
  }
}
```

#### Updating Todo Status

```javascript
// Update a todo (mark as completed)
{
  "id": "update-task-1",
  "method": "todowrite.update",
  "params": {
    "taskId": "task_abc123",
    "updates": {
      "status": "completed",
      "completedAt": "2025-01-17T23:45:00Z"
    }
  }
}
```

## Smart Features

### Auto-Categorization Engine

The system automatically categorizes tasks based on content analysis:

- **Bug Fix**: Detects keywords like "bug", "fix", "error", "issue"
- **Feature**: Identifies "feature", "add", "implement", "new"
- **Documentation**: Recognizes "doc", "write", "readme", "guide"
- **Testing**: Finds "test", "spec", "qa", "coverage"
- **Deployment**: Catches "deploy", "release", "production"

### Intelligent Prioritization

Tasks are automatically prioritized based on urgency indicators:

- **High Priority**: "urgent", "critical", "asap", "immediately"
- **Low Priority**: "later", "nice to have", "someday", "optional"
- **Medium Priority**: Default for all other tasks

### Project Auto-Assignment

The system attempts to match task content with existing project names and automatically assigns tasks to the most relevant project.

### Tag Generation

Automatically generates relevant tags based on content analysis:

- **Technical Tags**: frontend, backend, mobile, security, performance
- **Process Tags**: testing, documentation, deployment
- **Domain Tags**: ui, api, database, auth

## Real-time Collaboration

All todowrite operations are broadcast to connected clients in real-time:

- Task creation notifications
- Status update alerts
- Project assignment changes
- Smart recommendation updates

## Integration Benefits

### Advantages Over Native TodoWrite

1. **Persistent Storage**: All todos are stored in PostgreSQL database
2. **Project Organization**: Tasks are automatically organized into projects
3. **Smart Recommendations**: AI-powered suggestions for agents and tools
4. **Reputation Tracking**: Blockchain-verified agent performance metrics
5. **Collaboration**: Real-time updates across multiple users/sessions
6. **Mobile Access**: Full mobile-responsive interface
7. **Advanced Filtering**: Search and filter by multiple criteria
8. **Activity Tracking**: Complete audit trail of all changes

### Cross-Platform Compatibility

The MCP protocol ensures ChittyPM can replace todowrite functionality across:

- Claude conversations (direct replacement)
- External applications via WebSocket connections
- API integrations for third-party tools
- Mobile applications and web interfaces

## Configuration

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)

### WebSocket Endpoint

The MCP server is accessible via WebSocket at:
```
ws://localhost:5000/mcp
```

### Capabilities Response

When clients connect, they receive a capabilities message:

```javascript
{
  "id": "welcome",
  "method": "server.initialized",
  "result": {
    "capabilities": {
      "todowrite": true,
      "projectManagement": true,
      "smartRecommendations": true,
      "blockchainReputation": true,
      "selfOrganizing": true
    },
    "version": "1.0.0"
  }
}
```

## Error Handling

The MCP server provides comprehensive error responses:

- `parse_error`: Invalid JSON message format
- `method_not_found`: Unknown MCP method
- `invalid_params`: Missing or invalid parameters
- `creation_failed`: Task/project creation errors
- `update_failed`: Task update errors
- `delete_failed`: Task deletion errors
- `internal_error`: General server errors

## Security

- All WebSocket connections are logged and monitored
- Task operations include user authentication context
- Blockchain reputation system provides transparent verification
- Activity logging ensures complete audit trail

This implementation provides a robust, feature-rich replacement for Claude's todowrite function while adding significant value through smart organization, collaboration features, and cross-platform compatibility.