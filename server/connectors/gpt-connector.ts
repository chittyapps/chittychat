import { BaseConnector, ConnectorConfig, ConnectorMessage, ConnectorResponse, TaskRequest, ProjectRequest } from './base-connector';
import { db } from '../db';
import { tasks, projects } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Task, Project } from '../../shared/schema';

interface GPTConfig extends ConnectorConfig {
  type: 'gpt';
  apiKey: string;
  model?: string;
  baseUrl?: string;
  organization?: string;
  maxTokens?: number;
  temperature?: number;
}

interface GPTMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GPTResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GPTConnector extends BaseConnector {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private organization?: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: GPTConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4-turbo-preview';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.organization = config.organization;
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
  }

  async connect(): Promise<ConnectorResponse> {
    try {
      // Test connection with a simple request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      this.isConnected = true;
      await this.registerAgent();
      
      return this.formatSuccessResponse(
        { model: this.model },
        'Connected to OpenAI GPT API'
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
      return this.formatErrorResponse(new Error('Not connected to GPT API'));
    }

    try {
      const gptMessages: GPTMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: gptMessages,
          max_tokens: this.maxTokens,
          temperature: this.temperature
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data: GPTResponse = await response.json();
      
      const responseText = data.choices[0]?.message?.content || '';

      await this.logActivity(
        'message_sent',
        `Sent message to GPT (${data.usage.total_tokens} tokens)`
      );

      return this.formatSuccessResponse({
        response: responseText,
        usage: data.usage,
        model: data.model,
        finishReason: data.choices[0]?.finish_reason
      });
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async createTask(taskRequest: TaskRequest): Promise<Task | null> {
    try {
      // Use GPT to enhance the task
      const enhancePrompt = `Given this task: "${taskRequest.title}"
Description: ${taskRequest.description || 'None provided'}

Please provide a JSON response with:
{
  "description": "clear, actionable task description",
  "priority": "low|medium|high|urgent",
  "estimatedHours": number,
  "tags": ["tag1", "tag2"],
  "subtasks": ["subtask1", "subtask2"] 
}`;

      const response = await this.sendMessage([
        { role: 'system', content: 'You are a project management assistant. Respond only with valid JSON.' },
        { role: 'user', content: enhancePrompt }
      ]);

      let enhancement = {
        description: taskRequest.description,
        priority: taskRequest.priority || 'medium',
        estimatedHours: taskRequest.estimatedHours || 4,
        tags: [],
        subtasks: []
      };

      if (response.success && response.data?.response) {
        try {
          enhancement = JSON.parse(response.data.response);
        } catch (e) {
          console.warn('Failed to parse GPT enhancement:', e);
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
          createdBy: 'gpt-connector',
          enhanced: true,
          subtasks: enhancement.subtasks
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
      // Use GPT to enhance the project
      const enhancePrompt = `Given this project: "${projectRequest.name}"
Description: ${projectRequest.description || 'None provided'}

Please provide a JSON response with:
{
  "description": "comprehensive project description",
  "category": "project category",
  "milestones": ["milestone1", "milestone2"],
  "tasks": ["task1", "task2", "task3"],
  "tags": ["tag1", "tag2"],
  "estimatedDuration": "duration estimate"
}`;

      const response = await this.sendMessage([
        { role: 'system', content: 'You are a project planning assistant. Respond only with valid JSON.' },
        { role: 'user', content: enhancePrompt }
      ]);

      let enhancement = {
        description: projectRequest.description,
        category: 'general',
        milestones: [],
        tasks: [],
        tags: projectRequest.tags || [],
        estimatedDuration: 'TBD'
      };

      if (response.success && response.data?.response) {
        try {
          enhancement = JSON.parse(response.data.response);
        } catch (e) {
          console.warn('Failed to parse GPT enhancement:', e);
        }
      }

      const [project] = await db.insert(projects).values({
        name: projectRequest.name,
        description: enhancement.description || projectRequest.description,
        isGlobal: projectRequest.isGlobal ?? true,
        category: enhancement.category || projectRequest.category,
        tags: enhancement.tags,
        metadata: {
          createdBy: 'gpt-connector',
          enhanced: true,
          milestones: enhancement.milestones,
          estimatedDuration: enhancement.estimatedDuration,
          suggestedTasks: enhancement.tasks
        }
      }).returning();

      await this.logActivity(
        'project_created',
        `Created project: ${project.name}`,
        undefined,
        project.id
      );

      // Create suggested tasks
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
      'task-generation',
      'project-planning',
      'code-generation',
      'analysis',
      'reasoning',
      'conversation',
      'translation',
      'summarization'
    ];
  }

  async generateCode(prompt: string, language: string = 'javascript'): Promise<ConnectorResponse> {
    try {
      const codePrompt = `Generate ${language} code for: ${prompt}

Requirements:
1. Include proper error handling
2. Add comments for clarity
3. Follow best practices
4. Make it production-ready

Respond with only the code, no explanations.`;

      const response = await this.sendMessage([
        { role: 'system', content: `You are an expert ${language} developer. Generate clean, efficient code.` },
        { role: 'user', content: codePrompt }
      ]);

      if (response.success) {
        await this.logActivity(
          'code_generated',
          `Generated ${language} code for: ${prompt.substring(0, 50)}...`
        );
      }

      return response;
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async reviewCode(code: string, language: string = 'javascript'): Promise<ConnectorResponse> {
    try {
      const reviewPrompt = `Review this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. Security issues
2. Performance concerns
3. Best practice violations
4. Suggestions for improvement
5. Overall quality score (1-10)`;

      const response = await this.sendMessage([
        { role: 'system', content: 'You are a senior code reviewer. Be thorough but constructive.' },
        { role: 'user', content: reviewPrompt }
      ]);

      if (response.success) {
        await this.logActivity(
          'code_reviewed',
          `Reviewed ${language} code (${code.length} chars)`
        );
      }

      return response;
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }
}