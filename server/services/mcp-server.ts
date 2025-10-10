import { WebSocketServer } from 'ws';
import { storage } from '../storage';
import { reputationSystem } from './reputation-system';
import { smartRecommendationsService } from './smart-recommendations';

interface MCPMessage {
  id: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

interface TodoWriteRequest {
  content: string;
  project?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  assignTo?: string;
  dueDate?: string;
  tags?: string[];
}

class MCPServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, any> = new Map();

  initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/mcp' // Use specific path to avoid conflicts
    });
    
    this.wss.on('connection', (ws, req) => {
      const connectionId = this.generateConnectionId();
      this.connections.set(connectionId, ws);
      
      console.log(`MCP Client connected: ${connectionId}`);
      
      ws.on('message', async (data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          await this.handleMessage(connectionId, message);
        } catch (error) {
          console.error('MCP message parsing error:', error);
          this.sendError(ws, 'parse_error', 'Invalid JSON message');
        }
      });
      
      ws.on('close', () => {
        this.connections.delete(connectionId);
        console.log(`MCP Client disconnected: ${connectionId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`MCP WebSocket error for ${connectionId}:`, error);
        this.connections.delete(connectionId);
      });
      
      // Send welcome message
      this.sendMessage(ws, {
        id: 'welcome',
        method: 'server.initialized',
        result: {
          capabilities: {
            todowrite: true,
            projectManagement: true,
            smartRecommendations: true,
            blockchainReputation: true,
            selfOrganizing: true
          },
          version: '1.0.0'
        }
      });
    });
  }

  private async handleMessage(connectionId: string, message: MCPMessage) {
    const ws = this.connections.get(connectionId);
    if (!ws) return;

    try {
      switch (message.method) {
        case 'todowrite.create':
          await this.handleUniversalTodoWrite(ws, message);
          break;
          
        case 'universal.board.get':
          await this.handleUniversalBoardGet(ws, message);
          break;
          
        case 'todowrite.list':
          await this.handleListTodos(ws, message);
          break;
          
        case 'todowrite.update':
          await this.handleUpdateTodo(ws, message);
          break;
          
        case 'todowrite.delete':
          await this.handleDeleteTodo(ws, message);
          break;
          
        case 'project.create':
          await this.handleCreateProject(ws, message);
          break;
          
        case 'recommendations.get':
          await this.handleGetRecommendations(ws, message);
          break;
          
        case 'reputation.get':
          await this.handleGetReputation(ws, message);
          break;
          
        default:
          this.sendError(ws, 'method_not_found', `Unknown method: ${message.method}`);
      }
    } catch (error) {
      console.error(`Error handling MCP message ${message.method}:`, error);
      this.sendError(ws, 'internal_error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Universal todowrite functionality - replaces Claude's todowrite for ALL agents
  private async handleUniversalTodoWrite(ws: any, message: MCPMessage) {
    const params: TodoWriteRequest = message.params;
    
    if (!params.content) {
      return this.sendError(ws, 'invalid_params', 'Content is required');
    }

    try {
      // Auto-categorize and organize the todo
      const category = await this.autoCategorizeTodo(params.content);
      const priority = params.priority || await this.autoPrioritizeTodo(params.content);
      const project = params.project || await this.autoAssignProject(params.content);
      
      // Create the task
      const task = {
        id: await this.generateId(),
        title: this.extractTitle(params.content),
        description: params.content,
        status: 'todo' as const,
        priority,
        category,
        projectId: project,
        assignedTo: params.assignTo,
        dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
        tags: params.tags || await this.autoGenerateTags(params.content),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store the task
      await storage.createTask(task);
      
      // Get smart recommendations for the task
      const recommendations = await smartRecommendationsService.getTaskRecommendations(task.id);
      
      // Send success response
      this.sendMessage(ws, {
        id: message.id,
        result: {
          task,
          category,
          autoAssigned: {
            project,
            priority,
            tags: task.tags
          },
          recommendations: recommendations.slice(0, 3), // Top 3 recommendations
          message: 'Task added to universal PM board - replaces todowrite for all agents',
          universalBoard: true,
          projectId: project
        }
      });

      // Broadcast to other connected clients
      this.broadcast('task.created', { task });
      
    } catch (error) {
      this.sendError(ws, 'creation_failed', error instanceof Error ? error.message : 'Failed to create todo');
    }
  }

  private async handleListTodos(ws: any, message: MCPMessage) {
    try {
      const { projectId, status, limit = 50 } = message.params || {};
      
      let tasks;
      if (projectId) {
        tasks = await storage.getTasksByProject(projectId);
      } else {
        tasks = await storage.getAllTasks();
      }
      
      // Filter by status if provided
      if (status) {
        tasks = tasks.filter(task => task.status === status);
      }
      
      // Limit results
      tasks = tasks.slice(0, limit);
      
      this.sendMessage(ws, {
        id: message.id,
        result: {
          tasks,
          total: tasks.length,
          filtered: !!status || !!projectId
        }
      });
      
    } catch (error) {
      this.sendError(ws, 'list_failed', error instanceof Error ? error.message : 'Failed to list todos');
    }
  }

  private async handleUpdateTodo(ws: any, message: MCPMessage) {
    try {
      const { taskId, updates } = message.params;
      
      if (!taskId) {
        return this.sendError(ws, 'invalid_params', 'Task ID is required');
      }
      
      const updatedTask = await storage.updateTask(taskId, {
        ...updates,
        updatedAt: new Date()
      });
      
      this.sendMessage(ws, {
        id: message.id,
        result: {
          task: updatedTask,
          message: 'Todo updated successfully'
        }
      });
      
      // Broadcast update
      this.broadcast('task.updated', { task: updatedTask });
      
    } catch (error) {
      this.sendError(ws, 'update_failed', error instanceof Error ? error.message : 'Failed to update todo');
    }
  }

  private async handleDeleteTodo(ws: any, message: MCPMessage) {
    try {
      const { taskId } = message.params;
      
      if (!taskId) {
        return this.sendError(ws, 'invalid_params', 'Task ID is required');
      }
      
      await storage.deleteTask(taskId);
      
      this.sendMessage(ws, {
        id: message.id,
        result: {
          message: 'Todo deleted successfully'
        }
      });
      
      // Broadcast deletion
      this.broadcast('task.deleted', { taskId });
      
    } catch (error) {
      this.sendError(ws, 'delete_failed', error instanceof Error ? error.message : 'Failed to delete todo');
    }
  }

  private async handleCreateProject(ws: any, message: MCPMessage) {
    try {
      const { name, description, category } = message.params;
      
      if (!name) {
        return this.sendError(ws, 'invalid_params', 'Project name is required');
      }
      
      const project = {
        id: await this.generateId(),
        name,
        description: description || '',
        status: 'active' as const,
        category: category || 'general',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await storage.createProject(project);
      
      this.sendMessage(ws, {
        id: message.id,
        result: {
          project,
          message: 'Project created successfully'
        }
      });
      
    } catch (error) {
      this.sendError(ws, 'creation_failed', error instanceof Error ? error.message : 'Failed to create project');
    }
  }

  private async handleGetRecommendations(ws: any, message: MCPMessage) {
    try {
      const { type, targetId } = message.params;
      const recommendations = await smartRecommendationsService.getRecommendations(type, targetId);
      
      this.sendMessage(ws, {
        id: message.id,
        result: { recommendations }
      });
      
    } catch (error) {
      this.sendError(ws, 'recommendations_failed', error instanceof Error ? error.message : 'Failed to get recommendations');
    }
  }

  private async handleGetReputation(ws: any, message: MCPMessage) {
    try {
      const { agentAddress } = message.params;
      const reputation = await reputationSystem.getAgentReputation(agentAddress);
      
      this.sendMessage(ws, {
        id: message.id,
        result: { reputation }
      });
      
    } catch (error) {
      this.sendError(ws, 'reputation_failed', error instanceof Error ? error.message : 'Failed to get reputation');
    }
  }

  // AI-powered auto-categorization
  private async autoCategorizeTodo(content: string): Promise<string> {
    const contentLower = content.toLowerCase();
    
    // Simple keyword-based categorization (would be enhanced with ML)
    if (contentLower.includes('bug') || contentLower.includes('fix') || contentLower.includes('error')) {
      return 'bug-fix';
    }
    if (contentLower.includes('feature') || contentLower.includes('add') || contentLower.includes('implement')) {
      return 'feature';
    }
    if (contentLower.includes('doc') || contentLower.includes('write') || contentLower.includes('readme')) {
      return 'documentation';
    }
    if (contentLower.includes('test') || contentLower.includes('spec')) {
      return 'testing';
    }
    if (contentLower.includes('deploy') || contentLower.includes('release')) {
      return 'deployment';
    }
    
    return 'general';
  }

  private async autoPrioritizeTodo(content: string): Promise<'low' | 'medium' | 'high'> {
    const contentLower = content.toLowerCase();
    
    // High priority keywords
    if (contentLower.includes('urgent') || contentLower.includes('critical') || 
        contentLower.includes('asap') || contentLower.includes('immediately')) {
      return 'high';
    }
    
    // Low priority keywords
    if (contentLower.includes('later') || contentLower.includes('nice to have') || 
        contentLower.includes('someday') || contentLower.includes('optional')) {
      return 'low';
    }
    
    return 'medium';
  }

  private async autoAssignProject(content: string): Promise<string | undefined> {
    // Get existing projects and try to match
    const projects = await storage.getAllProjects();
    const contentLower = content.toLowerCase();
    
    for (const project of projects) {
      if (contentLower.includes(project.name.toLowerCase())) {
        return project.id;
      }
    }
    
    return undefined;
  }

  private async autoGenerateTags(content: string): Promise<string[]> {
    const tags: string[] = [];
    const contentLower = content.toLowerCase();
    
    // Extract common technical tags
    const tagPatterns = {
      'frontend': ['frontend', 'ui', 'react', 'vue', 'angular'],
      'backend': ['backend', 'api', 'server', 'database'],
      'mobile': ['mobile', 'ios', 'android', 'react-native'],
      'security': ['security', 'auth', 'login', 'encryption'],
      'performance': ['performance', 'optimize', 'speed', 'cache'],
      'testing': ['test', 'spec', 'qa', 'coverage']
    };
    
    for (const [tag, keywords] of Object.entries(tagPatterns)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  private extractTitle(content: string): string {
    // Extract first line or first sentence as title
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    if (firstLine.length > 0 && firstLine.length <= 100) {
      return firstLine;
    }
    
    // If first line is too long, take first 100 chars
    return content.substring(0, 100).trim() + (content.length > 100 ? '...' : '');
  }

  private async await generateId(): Promise<string> {
    // FIXED: Replaced local generation with ChittyID service call
    const { generateChittyID } = await import('../lib/chittyid-service.js');
    return await generateChittyID('INFO', { source: 'mcp-protocol', auto: true });
  }

  private generateConnectionId(): string {
    return 'mcp_' + Math.random().toString(36).substring(2);
  }

  private sendMessage(ws: any, message: MCPMessage) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: any, code: string, message: string) {
    this.sendMessage(ws, {
      id: 'error',
      error: { code, message }
    });
  }

  private broadcast(event: string, data: any) {
    const message = {
      id: 'broadcast',
      method: event,
      params: data
    };
    
    this.connections.forEach((ws) => {
      this.sendMessage(ws, message);
    });
  }
}

export const mcpServer = new MCPServer();