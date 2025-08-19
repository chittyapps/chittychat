import { BaseConnector, ConnectorConfig, ConnectorMessage, ConnectorResponse, TaskRequest, ProjectRequest } from './base-connector';
import { db } from '../db';
import { tasks, projects } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Task, Project } from '../../shared/schema';

interface CustomGPTConfig extends ConnectorConfig {
  type: 'custom';
  schemaUrl: string;
  apiKey?: string;
  authType?: 'bearer' | 'api-key' | 'basic' | 'custom';
  authHeader?: string;
  customHeaders?: Record<string, string>;
  requestFormat?: 'openai' | 'anthropic' | 'custom';
  responseFormat?: 'openai' | 'anthropic' | 'custom';
  customSchema?: {
    endpoints?: {
      chat?: string;
      completions?: string;
      embeddings?: string;
      [key: string]: string | undefined;
    };
    requestMapping?: Record<string, string>;
    responseMapping?: Record<string, string>;
  };
}

interface SchemaDefinition {
  name: string;
  version: string;
  baseUrl: string;
  authentication: {
    type: string;
    header?: string;
    prefix?: string;
  };
  endpoints: Record<string, {
    path: string;
    method: string;
    headers?: Record<string, string>;
    requestSchema?: any;
    responseSchema?: any;
  }>;
  capabilities?: string[];
  models?: string[];
  limits?: {
    maxTokens?: number;
    rateLimit?: number;
    concurrency?: number;
  };
}

export class CustomGPTConnector extends BaseConnector {
  private schema?: SchemaDefinition;
  private schemaUrl: string;
  private apiKey?: string;
  private authType: string;
  private authHeader: string;
  private customHeaders: Record<string, string>;
  private requestFormat: string;
  private responseFormat: string;

  constructor(config: CustomGPTConfig) {
    super(config);
    this.schemaUrl = config.schemaUrl;
    this.apiKey = config.apiKey;
    this.authType = config.authType || 'bearer';
    this.authHeader = config.authHeader || 'Authorization';
    this.customHeaders = config.customHeaders || {};
    this.requestFormat = config.requestFormat || 'openai';
    this.responseFormat = config.responseFormat || 'openai';
  }

  async connect(): Promise<ConnectorResponse> {
    try {
      // Fetch and parse schema
      const schemaResponse = await fetch(this.schemaUrl);
      if (!schemaResponse.ok) {
        throw new Error(`Failed to fetch schema: ${schemaResponse.status}`);
      }

      this.schema = await schemaResponse.json();
      
      // Validate schema
      if (!this.validateSchema(this.schema)) {
        throw new Error('Invalid schema format');
      }

      // Test connection with a simple request if chat endpoint exists
      if (this.schema.endpoints.chat) {
        const testResponse = await this.makeRequest('chat', {
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        });

        if (!testResponse.success) {
          throw new Error(`Connection test failed: ${testResponse.error}`);
        }
      }

      this.isConnected = true;
      await this.registerAgent();
      
      return this.formatSuccessResponse(
        { 
          schema: {
            name: this.schema.name,
            version: this.schema.version,
            capabilities: this.schema.capabilities
          }
        },
        `Connected to custom GPT: ${this.schema.name}`
      );
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  private validateSchema(schema: any): schema is SchemaDefinition {
    return !!(
      schema &&
      schema.name &&
      schema.baseUrl &&
      schema.endpoints &&
      typeof schema.endpoints === 'object'
    );
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.customHeaders };

    if (this.apiKey) {
      switch (this.authType) {
        case 'bearer':
          headers[this.authHeader] = `Bearer ${this.apiKey}`;
          break;
        case 'api-key':
          headers[this.authHeader] = this.apiKey;
          break;
        case 'basic':
          headers[this.authHeader] = `Basic ${Buffer.from(this.apiKey).toString('base64')}`;
          break;
        case 'custom':
          if (this.schema?.authentication?.prefix) {
            headers[this.authHeader] = `${this.schema.authentication.prefix} ${this.apiKey}`;
          } else {
            headers[this.authHeader] = this.apiKey;
          }
          break;
      }
    }

    return headers;
  }

  private async makeRequest(endpoint: string, data: any): Promise<ConnectorResponse> {
    if (!this.schema || !this.schema.endpoints[endpoint]) {
      return this.formatErrorResponse(new Error(`Endpoint ${endpoint} not found in schema`));
    }

    try {
      const endpointConfig = this.schema.endpoints[endpoint];
      const url = `${this.schema.baseUrl}${endpointConfig.path}`;
      
      const headers = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...endpointConfig.headers
      };

      // Transform request based on format
      const requestBody = this.transformRequest(data, endpoint);

      const response = await fetch(url, {
        method: endpointConfig.method || 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${error}`);
      }

      const responseData = await response.json();
      
      // Transform response based on format
      const transformedResponse = this.transformResponse(responseData, endpoint);

      return this.formatSuccessResponse(transformedResponse);
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  private transformRequest(data: any, endpoint: string): any {
    const mapping = this.config.customSchema?.requestMapping || {};
    
    switch (this.requestFormat) {
      case 'anthropic':
        // Convert OpenAI format to Anthropic format
        if (data.messages) {
          const systemMessage = data.messages.find((m: any) => m.role === 'system');
          const otherMessages = data.messages.filter((m: any) => m.role !== 'system');
          
          return {
            ...data,
            system: systemMessage?.content,
            messages: otherMessages,
            max_tokens: data.max_tokens || 1024
          };
        }
        break;
        
      case 'custom':
        // Apply custom mapping
        let transformed: any = {};
        for (const [key, value] of Object.entries(data)) {
          const mappedKey = mapping[key] || key;
          transformed[mappedKey] = value;
        }
        return transformed;
        
      case 'openai':
      default:
        return data;
    }
    
    return data;
  }

  private transformResponse(data: any, endpoint: string): any {
    const mapping = this.config.customSchema?.responseMapping || {};
    
    switch (this.responseFormat) {
      case 'anthropic':
        // Convert Anthropic format to standard format
        if (data.content) {
          return {
            response: data.content[0]?.text || '',
            usage: data.usage,
            model: data.model
          };
        }
        break;
        
      case 'custom':
        // Apply custom mapping
        let transformed: any = {};
        for (const [key, value] of Object.entries(data)) {
          const mappedKey = mapping[key] || key;
          transformed[mappedKey] = value;
        }
        return transformed;
        
      case 'openai':
      default:
        if (data.choices) {
          return {
            response: data.choices[0]?.message?.content || data.choices[0]?.text || '',
            usage: data.usage,
            model: data.model
          };
        }
    }
    
    return data;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    await this.unregisterAgent();
  }

  async sendMessage(messages: ConnectorMessage[]): Promise<ConnectorResponse> {
    if (!this.isConnected) {
      return this.formatErrorResponse(new Error('Not connected to custom GPT'));
    }

    try {
      const response = await this.makeRequest('chat', {
        messages,
        max_tokens: this.schema?.limits?.maxTokens || 4096,
        temperature: 0.7
      });

      if (response.success) {
        await this.logActivity(
          'message_sent',
          `Sent message to ${this.schema?.name}`
        );
      }

      return response;
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }

  async createTask(taskRequest: TaskRequest): Promise<Task | null> {
    try {
      // Use custom GPT to enhance task if chat endpoint available
      let enhancement: any = {};
      
      if (this.schema?.endpoints.chat) {
        const enhancePrompt = `Enhance this task: "${taskRequest.title}". ${taskRequest.description || ''}
Return JSON: { "description": "...", "priority": "low|medium|high", "estimatedHours": number, "tags": [] }`;

        const response = await this.sendMessage([
          { role: 'user', content: enhancePrompt }
        ]);

        if (response.success && response.data?.response) {
          try {
            const jsonMatch = response.data.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              enhancement = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            console.warn('Failed to parse enhancement:', e);
          }
        }
      }

      const [task] = await db.insert(tasks).values({
        title: taskRequest.title,
        description: enhancement.description || taskRequest.description,
        projectId: taskRequest.projectId,
        priority: enhancement.priority || taskRequest.priority || 'medium',
        estimatedHours: enhancement.estimatedHours || taskRequest.estimatedHours,
        assignedAgent: this.config.name,
        tags: enhancement.tags || [],
        metadata: {
          ...taskRequest.metadata,
          createdBy: 'custom-gpt-connector',
          schema: this.schema?.name
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
      const [project] = await db.insert(projects).values({
        name: projectRequest.name,
        description: projectRequest.description,
        isGlobal: projectRequest.isGlobal ?? true,
        category: projectRequest.category || 'general',
        tags: projectRequest.tags || [],
        metadata: {
          createdBy: 'custom-gpt-connector',
          schema: this.schema?.name
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
    return this.schema?.capabilities || [
      'chat',
      'task-management',
      'custom-schema'
    ];
  }

  // Get current schema
  getSchema(): SchemaDefinition | undefined {
    return this.schema;
  }

  // Execute custom endpoint
  async executeEndpoint(endpoint: string, data: any): Promise<ConnectorResponse> {
    if (!this.isConnected) {
      return this.formatErrorResponse(new Error('Not connected'));
    }

    return await this.makeRequest(endpoint, data);
  }

  // Update schema dynamically
  async updateSchema(newSchemaUrl: string): Promise<ConnectorResponse> {
    this.schemaUrl = newSchemaUrl;
    this.isConnected = false;
    return await this.connect();
  }
}