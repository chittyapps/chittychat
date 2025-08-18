// MCP Client for todowrite replacement functionality
export interface MCPMessage {
  id: string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface TodoWriteRequest {
  content: string;
  project?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  assignTo?: string;
  dueDate?: string;
  tags?: string[];
}

export interface TodoWriteResponse {
  task: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    projectId?: string;
    tags: string[];
    createdAt: string;
  };
  autoAssigned: {
    project?: string;
    priority: string;
    tags: string[];
  };
  recommendations: Array<{
    type: string;
    name: string;
    reason: string;
  }>;
  message: string;
}

class MCPClient {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, (response: MCPMessage) => void> = new Map();
  private connectionPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Fix WebSocket connection issues
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/mcp`;
      console.log('Connecting to MCP server at:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('MCP Client connected for todowrite replacement');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: MCPMessage = JSON.parse(event.data);
          
          if (message.id === 'welcome') {
            console.log('MCP Server capabilities:', message.result);
            return;
          }

          const callback = this.callbacks.get(message.id);
          if (callback) {
            callback(message);
            this.callbacks.delete(message.id);
          }
        } catch (error) {
          console.error('Error parsing MCP message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('MCP WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('MCP Client disconnected');
        this.ws = null;
        this.connectionPromise = null;
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          this.connect();
        }, 5000);
      };
    });

    return this.connectionPromise;
  }

  private async sendMessage(message: MCPMessage): Promise<MCPMessage> {
    await this.connect();

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('MCP connection not available'));
        return;
      }

      this.callbacks.set(message.id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response);
        }
      });

      this.ws.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.callbacks.has(message.id)) {
          this.callbacks.delete(message.id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  private generateId(): string {
    return 'mcp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Replace Claude's todowrite function
  async todowrite(request: TodoWriteRequest): Promise<TodoWriteResponse> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'todowrite.create',
      params: request
    };

    const response = await this.sendMessage(message);
    return response.result as TodoWriteResponse;
  }

  async listTodos(filters?: {
    projectId?: string;
    status?: string;
    limit?: number;
  }): Promise<{ tasks: any[]; total: number; filtered: boolean }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'todowrite.list',
      params: filters || {}
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  async updateTodo(taskId: string, updates: any): Promise<{ task: any; message: string }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'todowrite.update',
      params: { taskId, updates }
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  async deleteTodo(taskId: string): Promise<{ message: string }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'todowrite.delete',
      params: { taskId }
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  async createProject(name: string, description?: string, category?: string): Promise<{ project: any; message: string }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'project.create',
      params: { name, description, category }
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  async getRecommendations(type: string, targetId: string): Promise<{ recommendations: any[] }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'recommendations.get',
      params: { type, targetId }
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  async getReputation(agentAddress: string): Promise<{ reputation: any }> {
    const message: MCPMessage = {
      id: this.generateId(),
      method: 'reputation.get',
      params: { agentAddress }
    };

    const response = await this.sendMessage(message);
    return response.result;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
    this.callbacks.clear();
  }
}

// Global MCP client instance for todowrite replacement
export const mcpClient = new MCPClient();

// Auto-connect when module loads
mcpClient.connect().catch(console.error);

// Export todowrite function to replace Claude's native function
export const todowrite = (content: string, options?: Partial<TodoWriteRequest>) => 
  mcpClient.todowrite({ content, ...options });