import { BaseConnector, ConnectorConfig, ConnectorMessage, ConnectorResponse, TaskRequest, ProjectRequest } from './base-connector';
import { db } from '../db';
import { tasks, projects, activities } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Task, Project } from '../../shared/schema';
import { WebSocket } from 'ws';

interface ClaudeCodeConfig extends ConnectorConfig {
  type: 'claude-code';
  workspaceUrl?: string;
  sessionToken?: string;
  autoSync?: boolean;
  mcpEndpoint?: string;
}

interface ClaudeCodeTask {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: number;
  metadata?: Record<string, any>;
}

interface ClaudeCodeContext {
  workspace: string;
  currentFile?: string;
  recentFiles?: string[];
  gitBranch?: string;
  projectPath?: string;
}

export class ClaudeCodeConnector extends BaseConnector {
  private ws?: WebSocket;
  private context: ClaudeCodeContext;
  private syncInterval?: NodeJS.Timeout;
  private todoList: ClaudeCodeTask[] = [];
  private mcpEndpoint: string;

  constructor(config: ClaudeCodeConfig) {
    super(config);
    this.context = {
      workspace: config.workspaceUrl || 'local'
    };
    this.mcpEndpoint = config.mcpEndpoint || 'ws://localhost:3000/mcp';
    
    if (config.autoSync) {
      this.startAutoSync();
    }
  }

  async connect(): Promise<ConnectorResponse> {
    try {
      // Connect via WebSocket for real-time sync
      this.ws = new WebSocket(this.mcpEndpoint);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws!.on('open', async () => {
          clearTimeout(timeout);
          this.isConnected = true;
          
          // Register as Claude Code agent
          this.ws!.send(JSON.stringify({
            type: 'register',
            agent: 'claude-code',
            capabilities: this.getCapabilities(),
            context: this.context
          }));

          await this.registerAgent();
          
          // Set up message handlers
          this.setupMessageHandlers();
          
          resolve(this.formatSuccessResponse(
            { context: this.context },
            'Connected to Claude Code MCP'
          ));
        });

        this.ws!.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  private setupMessageHandlers(): void {
    if (!this.ws) return;

    this.ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'todowrite':
            await this.handleTodoWrite(message.todos);
            break;
            
          case 'context_update':
            this.updateContext(message.context);
            break;
            
          case 'task_request':
            await this.handleTaskRequest(message);
            break;
            
          case 'sync_request':
            await this.syncWithDatabase();
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to handle message:', error);
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      // Attempt reconnection after 5 seconds
      setTimeout(() => this.connect(), 5000);
    });
  }

  private async handleTodoWrite(todos: ClaudeCodeTask[]): Promise<void> {
    this.todoList = todos;
    
    // Sync todos with ChittyPM database
    for (const todo of todos) {
      if (todo.status === 'pending' && !todo.metadata?.syncedToDb) {
        // Create task in database
        const task = await this.createTask({
          title: todo.content,
          projectId: await this.getOrCreateProject(),
          priority: this.mapPriorityToDb(todo.priority),
          metadata: {
            claudeCodeId: todo.id,
            fromTodoWrite: true
          }
        });

        if (task) {
          todo.metadata = { ...todo.metadata, syncedToDb: true, taskId: task.id };
        }
      } else if (todo.metadata?.taskId) {
        // Update existing task
        await this.updateTask(todo.metadata.taskId, {
          status: this.mapStatusToDb(todo.status)
        });
      }
    }

    await this.logActivity(
      'todowrite_sync',
      `Synced ${todos.length} todos from Claude Code`
    );
  }

  private async getOrCreateProject(): Promise<string> {
    // Look for existing Claude Code project
    const projects = await db
      .select()
      .from(projects)
      .where(eq(projects.name, `Claude Code - ${this.context.workspace}`))
      .limit(1);

    if (projects.length > 0) {
      return projects[0].id;
    }

    // Create new project
    const project = await this.createProject({
      name: `Claude Code - ${this.context.workspace}`,
      description: `Auto-created project for Claude Code workspace: ${this.context.workspace}`,
      tags: ['claude-code', 'auto-created'],
      isGlobal: false
    });

    return project?.id || '';
  }

  private mapPriorityToDb(priority?: number): string {
    if (!priority) return 'medium';
    if (priority >= 80) return 'urgent';
    if (priority >= 60) return 'high';
    if (priority >= 40) return 'medium';
    return 'low';
  }

  private mapStatusToDb(status: string): string {
    switch (status) {
      case 'in_progress': return 'in_progress';
      case 'completed': return 'completed';
      case 'pending': 
      default: return 'pending';
    }
  }

  private updateContext(context: Partial<ClaudeCodeContext>): void {
    this.context = { ...this.context, ...context };
    
    // Send context update to database
    if (this.agentId) {
      db.update(agents)
        .set({
          metadata: {
            context: this.context,
            lastUpdate: new Date().toISOString()
          }
        })
        .where(eq(agents.id, this.agentId));
    }
  }

  private async handleTaskRequest(message: any): Promise<void> {
    const { taskId, action, data } = message;
    
    switch (action) {
      case 'create':
        await this.createTask(data);
        break;
        
      case 'update':
        await this.updateTask(taskId, data);
        break;
        
      case 'complete':
        await this.updateTask(taskId, { status: 'completed' });
        break;
        
      default:
        console.log('Unknown task action:', action);
    }
  }

  private async syncWithDatabase(): Promise<void> {
    // Get all tasks for current project
    const projectId = await this.getOrCreateProject();
    const dbTasks = await this.getTasks(projectId);
    
    // Send tasks to Claude Code
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'tasks_sync',
        tasks: dbTasks.map(task => ({
          id: task.id,
          content: task.title,
          status: task.status,
          priority: task.priorityScore,
          metadata: task.metadata
        }))
      }));
    }
  }

  private startAutoSync(): void {
    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      if (this.isConnected) {
        this.syncWithDatabase();
      }
    }, 30000);
  }

  async disconnect(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
    await this.unregisterAgent();
  }

  async sendMessage(messages: ConnectorMessage[]): Promise<ConnectorResponse> {
    if (!this.isConnected || !this.ws) {
      return this.formatErrorResponse(new Error('Not connected to Claude Code'));
    }

    try {
      // Send message through WebSocket
      this.ws.send(JSON.stringify({
        type: 'message',
        messages
      }));

      // Wait for response (with timeout)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(this.formatErrorResponse(new Error('Response timeout')));
        }, 30000);

        const handler = (data: string) => {
          const message = JSON.parse(data);
          if (message.type === 'message_response') {
            clearTimeout(timeout);
            this.ws!.off('message', handler);
            resolve(this.formatSuccessResponse(message.data));
          }
        };

        this.ws!.on('message', handler);
      });
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async createTask(taskRequest: TaskRequest): Promise<Task | null> {
    try {
      const [task] = await db.insert(tasks).values({
        title: taskRequest.title,
        description: taskRequest.description,
        projectId: taskRequest.projectId,
        priority: taskRequest.priority || 'medium',
        estimatedHours: taskRequest.estimatedHours,
        assignedAgent: this.config.name,
        metadata: {
          ...taskRequest.metadata,
          createdBy: 'claude-code-connector',
          context: this.context
        }
      }).returning();

      // Notify Claude Code about new task
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'task_created',
          task: {
            id: task.id,
            content: task.title,
            status: task.status,
            priority: task.priorityScore
          }
        }));
      }

      await this.logActivity(
        'task_created',
        `Created task: ${task.title}`,
        task.id,
        task.projectId
      );

      return task;
    } catch (error) {
      console.error('Failed to create task:', error);
      return null;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    try {
      const [task] = await db
        .update(tasks)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, taskId))
        .returning();

      // Notify Claude Code about task update
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'task_updated',
          taskId,
          updates
        }));
      }

      await this.logActivity(
        'task_updated',
        `Updated task: ${task.title}`,
        task.id,
        task.projectId
      );

      return task;
    } catch (error) {
      console.error('Failed to update task:', error);
      return null;
    }
  }

  async createProject(projectRequest: ProjectRequest): Promise<Project | null> {
    try {
      const [project] = await db.insert(projects).values({
        name: projectRequest.name,
        description: projectRequest.description,
        isGlobal: projectRequest.isGlobal ?? false,
        category: projectRequest.category || 'development',
        tags: [...(projectRequest.tags || []), 'claude-code'],
        metadata: {
          createdBy: 'claude-code-connector',
          workspace: this.context.workspace,
          context: this.context
        }
      }).returning();

      await this.logActivity(
        'project_created',
        `Created project: ${project.name}`,
        undefined,
        project.id
      );

      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  }

  getCapabilities(): string[] {
    return [
      'todowrite-replacement',
      'real-time-sync',
      'code-context-awareness',
      'workspace-integration',
      'file-awareness',
      'git-integration',
      'task-management',
      'project-tracking'
    ];
  }

  // Get current Claude Code todos
  getTodoList(): ClaudeCodeTask[] {
    return this.todoList;
  }

  // Get current context
  getContext(): ClaudeCodeContext {
    return this.context;
  }

  // Send custom command to Claude Code
  async sendCommand(command: string, args?: any): Promise<ConnectorResponse> {
    if (!this.ws || !this.isConnected) {
      return this.formatErrorResponse(new Error('Not connected'));
    }

    try {
      this.ws.send(JSON.stringify({
        type: 'command',
        command,
        args
      }));

      return this.formatSuccessResponse(undefined, `Command sent: ${command}`);
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }
}