import { BaseConnector, ConnectorConfig, ConnectorMessage, ConnectorResponse, TaskRequest, ProjectRequest } from './base-connector';
import { db } from '../db';
import { tasks, projects } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Task, Project } from '../../shared/schema';

interface ClaudeConfig extends ConnectorConfig {
  type: 'claude';
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeConnector extends BaseConnector {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: ClaudeConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
  }

  async connect(): Promise<ConnectorResponse> {
    try {
      // Test connection with a simple request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      this.isConnected = true;
      await this.registerAgent();
      
      return this.formatSuccessResponse(
        { model: this.model },
        'Connected to Claude API'
      );
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    await this.unregisterAgent();
  }

  async sendMessage(messages: ConnectorMessage[]): Promise<ConnectorResponse> {
    if (!this.isConnected) {
      return this.formatErrorResponse(new Error('Not connected to Claude API'));
    }

    try {
      // Convert to Claude format (no system role in messages array)
      const systemMessage = messages.find(m => m.role === 'system');
      const claudeMessages: ClaudeMessage[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      const requestBody: any = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: claudeMessages
      };

      if (systemMessage) {
        requestBody.system = systemMessage.content;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${error}`);
      }

      const data: ClaudeResponse = await response.json();
      
      const responseText = data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      await this.logActivity(
        'message_sent',
        `Sent message to Claude (${data.usage.input_tokens} in, ${data.usage.output_tokens} out)`
      );

      return this.formatSuccessResponse({
        response: responseText,
        usage: data.usage,
        model: data.model,
        stopReason: data.stop_reason
      });
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async createTask(taskRequest: TaskRequest): Promise<Task | null> {
    try {
      // Use Claude to enhance the task description
      const enhancePrompt = `Given this task: "${taskRequest.title}"
Description: ${taskRequest.description || 'None provided'}

Please provide:
1. A clear, actionable task description
2. Suggested priority (low/medium/high/urgent)
3. Estimated hours to complete
4. Any relevant tags or categories

Format as JSON: { "description": "...", "priority": "...", "estimatedHours": number, "tags": [...] }`;

      const response = await this.sendMessage([
        { role: 'user', content: enhancePrompt }
      ]);

      let enhancement = { 
        description: taskRequest.description,
        priority: taskRequest.priority || 'medium',
        estimatedHours: taskRequest.estimatedHours || 4,
        tags: []
      };

      if (response.success && response.data?.response) {
        try {
          const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enhancement = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('Failed to parse Claude enhancement:', e);
        }
      }

      const [task] = await db.insert(tasks).values({
        title: taskRequest.title,
        description: enhancement.description || taskRequest.description,
        projectId: taskRequest.projectId,
        priority: enhancement.priority || 'medium',
        estimatedHours: enhancement.estimatedHours,
        assignedAgent: this.config.name,
        tags: enhancement.tags,
        metadata: {
          ...taskRequest.metadata,
          createdBy: 'claude-connector',
          enhanced: true
        }
      }).returning();

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
      // Use Claude to enhance the project description
      const enhancePrompt = `Given this project: "${projectRequest.name}"
Description: ${projectRequest.description || 'None provided'}

Please suggest:
1. A comprehensive project description
2. Relevant category
3. Initial milestone tasks (3-5 tasks)
4. Tags for organization

Format as JSON: { "description": "...", "category": "...", "tasks": [...], "tags": [...] }`;

      const response = await this.sendMessage([
        { role: 'user', content: enhancePrompt }
      ]);

      let enhancement = {
        description: projectRequest.description,
        category: 'general',
        tasks: [],
        tags: projectRequest.tags || []
      };

      if (response.success && response.data?.response) {
        try {
          const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enhancement = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('Failed to parse Claude enhancement:', e);
        }
      }

      const [project] = await db.insert(projects).values({
        name: projectRequest.name,
        description: enhancement.description || projectRequest.description,
        isGlobal: projectRequest.isGlobal ?? true,
        category: enhancement.category || projectRequest.category,
        tags: enhancement.tags,
        metadata: {
          createdBy: 'claude-connector',
          enhanced: true,
          suggestedTasks: enhancement.tasks
        }
      }).returning();

      await this.logActivity(
        'project_created',
        `Created project: ${project.name}`,
        undefined,
        project.id
      );

      // Create suggested tasks if any
      if (enhancement.tasks && enhancement.tasks.length > 0) {
        for (const taskTitle of enhancement.tasks.slice(0, 5)) {
          await this.createTask({
            title: taskTitle,
            projectId: project.id,
            priority: 'medium'
          });
        }
      }

      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  }

  getCapabilities(): string[] {
    return [
      'natural-language-processing',
      'task-enhancement',
      'project-planning',
      'code-generation',
      'analysis',
      'reasoning',
      'creative-writing',
      'conversation'
    ];
  }

  async analyzeProject(projectId: string): Promise<ConnectorResponse> {
    try {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project.length) {
        return this.formatErrorResponse(new Error('Project not found'));
      }

      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, projectId));

      const analysisPrompt = `Analyze this project:
Name: ${project[0].name}
Description: ${project[0].description}
Progress: ${project[0].progress}%
Tasks: ${projectTasks.length} total
- Completed: ${projectTasks.filter(t => t.status === 'completed').length}
- In Progress: ${projectTasks.filter(t => t.status === 'in_progress').length}
- Pending: ${projectTasks.filter(t => t.status === 'pending').length}
- Blocked: ${projectTasks.filter(t => t.status === 'blocked').length}

Provide insights on:
1. Project health and progress
2. Potential bottlenecks
3. Recommendations for improvement
4. Next priority actions`;

      const response = await this.sendMessage([
        { role: 'user', content: analysisPrompt }
      ]);

      if (response.success) {
        await this.logActivity(
          'project_analyzed',
          `Analyzed project: ${project[0].name}`,
          undefined,
          projectId
        );
      }

      return response;
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }
}