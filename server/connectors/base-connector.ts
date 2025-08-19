import { db } from '../db';
import { agents, activities, tasks, projects } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Agent, Task, Project } from '../../shared/schema';

export interface ConnectorConfig {
  name: string;
  type: 'claude' | 'claude-code' | 'gpt' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  customSchema?: any;
  metadata?: Record<string, any>;
}

export interface ConnectorMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

export interface ConnectorResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface TaskRequest {
  title: string;
  description?: string;
  projectId: string;
  priority?: string;
  estimatedHours?: number;
  metadata?: Record<string, any>;
}

export interface ProjectRequest {
  name: string;
  description?: string;
  isGlobal?: boolean;
  category?: string;
  tags?: string[];
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected agentId?: string;
  protected isConnected: boolean = false;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  abstract connect(): Promise<ConnectorResponse>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(messages: ConnectorMessage[]): Promise<ConnectorResponse>;
  abstract createTask(task: TaskRequest): Promise<Task | null>;
  abstract updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null>;
  abstract createProject(project: ProjectRequest): Promise<Project | null>;
  abstract getCapabilities(): string[];

  async registerAgent(): Promise<string> {
    const [agent] = await db.insert(agents).values({
      name: this.config.name,
      type: this.config.type,
      status: 'active',
      capabilities: this.getCapabilities(),
      sessionId: `${this.config.type}_${Date.now()}`,
      metadata: {
        ...this.config.metadata,
        connectorType: this.config.type,
        model: this.config.model
      }
    }).returning();

    this.agentId = agent.id;
    
    await this.logActivity('agent_connected', `${this.config.name} connected`);
    
    return agent.id;
  }

  async unregisterAgent(): Promise<void> {
    if (!this.agentId) return;

    await db
      .update(agents)
      .set({ 
        status: 'inactive',
        lastSeen: new Date()
      })
      .where(eq(agents.id, this.agentId));

    await this.logActivity('agent_disconnected', `${this.config.name} disconnected`);
  }

  protected async logActivity(
    type: string,
    description: string,
    taskId?: string,
    projectId?: string
  ): Promise<void> {
    await db.insert(activities).values({
      type,
      description,
      agentId: this.agentId,
      taskId,
      projectId,
      metadata: {
        connector: this.config.type,
        timestamp: new Date().toISOString()
      }
    });
  }

  async getTasks(projectId?: string): Promise<Task[]> {
    if (projectId) {
      return await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId));
    }
    
    return await db.select().from(tasks);
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  protected formatErrorResponse(error: any): ConnectorResponse {
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      data: error
    };
  }

  protected formatSuccessResponse(data?: any, message?: string): ConnectorResponse {
    return {
      success: true,
      message,
      data
    };
  }

  isActive(): boolean {
    return this.isConnected;
  }

  getConfig(): ConnectorConfig {
    return this.config;
  }
}