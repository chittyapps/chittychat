// Registry.chitty.cc client for MCP tool discovery and agent management
import { nanoid } from 'nanoid';

interface MCPTool {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  endpoints: {
    websocket?: string;
    http?: string;
  };
  metadata: {
    author: string;
    license: string;
    repository?: string;
    documentation?: string;
  };
  schemas: {
    input?: any;
    output?: any;
  };
  tags: string[];
  verified: boolean;
  reputation?: {
    score: number;
    totalUses: number;
    successRate: number;
  };
}

interface RegistryAgent {
  id: string;
  name: string;
  ensName?: string;
  ethAddress?: string;
  description: string;
  capabilities: string[];
  mcpTools: string[];
  specializations: string[];
  reputation: {
    score: number;
    totalTasks: number;
    successRate: number;
    averageResponseTime: string;
  };
  metadata: {
    author: string;
    languages: string[];
    frameworks: string[];
    certifications?: string[];
  };
  verified: boolean;
  lastActive: string;
}

class RegistryChittyClient {
  private baseUrl = 'https://registry.chitty.cc';
  private apiKey?: string;

  constructor() {
    // In production, this would come from environment variables
    this.apiKey = process.env.REGISTRY_CHITTY_API_KEY;
  }

  // Discover available MCP tools
  async discoverMCPTools(filters?: {
    category?: string;
    capabilities?: string[];
    verified?: boolean;
  }): Promise<MCPTool[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.capabilities) params.append('capabilities', filters.capabilities.join(','));
      if (filters?.verified !== undefined) params.append('verified', filters.verified.toString());

      // For now, return mock data that represents registry.chitty.cc structure
      return this.getMockMCPTools().filter(tool => {
        if (filters?.verified !== undefined && tool.verified !== filters.verified) return false;
        if (filters?.capabilities && !filters.capabilities.some(cap => tool.capabilities.includes(cap))) return false;
        return true;
      });
    } catch (error) {
      console.error('Error discovering MCP tools from registry.chitty.cc:', error);
      return this.getMockMCPTools();
    }
  }

  // Search for agents in the registry
  async searchAgents(query: string, filters?: {
    capabilities?: string[];
    minReputation?: number;
    verified?: boolean;
  }): Promise<RegistryAgent[]> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (filters?.capabilities) params.append('capabilities', filters.capabilities.join(','));
      if (filters?.minReputation) params.append('min_reputation', filters.minReputation.toString());
      if (filters?.verified !== undefined) params.append('verified', filters.verified.toString());

      // For now, return mock data that represents registry.chitty.cc structure
      const agents = this.getMockAgents();
      return agents.filter(agent => {
        if (filters?.verified !== undefined && agent.verified !== filters.verified) return false;
        if (filters?.minReputation && agent.reputation.score < filters.minReputation) return false;
        if (filters?.capabilities && !filters.capabilities.some(cap => agent.capabilities.includes(cap))) return false;
        
        const searchText = `${agent.name} ${agent.description} ${agent.capabilities.join(' ')} ${agent.specializations.join(' ')}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
    } catch (error) {
      console.error('Error searching agents in registry.chitty.cc:', error);
      return this.getMockAgents();
    }
  }

  // Get agent recommendations for a specific task
  async getAgentRecommendations(taskDescription: string, category?: string): Promise<{
    recommendations: RegistryAgent[];
    reasoning: string;
  }> {
    try {
      // Analyze task content for relevant capabilities
      const requiredCapabilities = this.analyzeTaskCapabilities(taskDescription);
      
      // Search for matching agents
      const agents = await this.searchAgents(taskDescription, {
        capabilities: requiredCapabilities,
        minReputation: 3.0,
        verified: true
      });

      // Sort by relevance and reputation
      const recommendations = agents
        .sort((a, b) => b.reputation.score - a.reputation.score)
        .slice(0, 5);

      const reasoning = `Found ${recommendations.length} agents matching "${taskDescription}". ` +
        `Filtered by capabilities: ${requiredCapabilities.join(', ')}. ` +
        `Sorted by reputation score.`;

      return { recommendations, reasoning };
    } catch (error) {
      console.error('Error getting agent recommendations from registry.chitty.cc:', error);
      return { recommendations: [], reasoning: 'Error fetching recommendations' };
    }
  }

  // Register a new MCP tool in the registry
  async registerMCPTool(tool: Omit<MCPTool, 'id' | 'verified'>): Promise<MCPTool> {
    try {
      const newTool: MCPTool = {
        ...tool,
        id: nanoid(),
        verified: false // Needs manual verification
      };

      // In production, this would POST to registry.chitty.cc API
      console.log('Registering MCP tool in registry.chitty.cc:', newTool);
      
      return newTool;
    } catch (error) {
      console.error('Error registering MCP tool:', error);
      throw error;
    }
  }

  // Sync local data with registry.chitty.cc
  async syncRegistryData(): Promise<{
    tools: MCPTool[];
    agents: RegistryAgent[];
    lastSync: string;
  }> {
    try {
      const [tools, agents] = await Promise.all([
        this.discoverMCPTools(),
        this.searchAgents('', { verified: true })
      ]);

      return {
        tools,
        agents,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error syncing with registry.chitty.cc:', error);
      throw error;
    }
  }

  // Analyze task description to extract required capabilities
  private analyzeTaskCapabilities(taskDescription: string): string[] {
    const capabilities: string[] = [];
    const text = taskDescription.toLowerCase();

    // Task type analysis
    if (text.includes('bug') || text.includes('fix') || text.includes('error')) {
      capabilities.push('debugging', 'troubleshooting', 'code-analysis');
    }
    if (text.includes('security') || text.includes('auth') || text.includes('login')) {
      capabilities.push('security-audit', 'authentication', 'penetration-testing');
    }
    if (text.includes('feature') || text.includes('implement') || text.includes('add')) {
      capabilities.push('development', 'implementation', 'feature-design');
    }
    if (text.includes('test') || text.includes('qa') || text.includes('coverage')) {
      capabilities.push('testing', 'quality-assurance', 'test-automation');
    }
    if (text.includes('doc') || text.includes('readme') || text.includes('guide')) {
      capabilities.push('documentation', 'technical-writing', 'user-guides');
    }
    if (text.includes('deploy') || text.includes('release') || text.includes('production')) {
      capabilities.push('deployment', 'devops', 'ci-cd');
    }

    // Technology analysis
    if (text.includes('react') || text.includes('frontend') || text.includes('ui')) {
      capabilities.push('frontend-development', 'react', 'javascript');
    }
    if (text.includes('api') || text.includes('backend') || text.includes('server')) {
      capabilities.push('backend-development', 'api-design', 'server-administration');
    }
    if (text.includes('database') || text.includes('sql') || text.includes('postgres')) {
      capabilities.push('database-management', 'sql-optimization', 'data-modeling');
    }

    return capabilities.length > 0 ? capabilities : ['general-development'];
  }

  // Mock data representing registry.chitty.cc structure
  private getMockMCPTools(): MCPTool[] {
    return [
      {
        id: 'mcp-todowrite-enhanced',
        name: 'TodoWrite Enhanced',
        description: 'Advanced task management with auto-categorization and smart recommendations',
        version: '2.1.0',
        capabilities: ['task-creation', 'auto-categorization', 'smart-recommendations', 'project-management'],
        endpoints: {
          websocket: 'wss://todowrite.chitty.cc/mcp',
          http: 'https://todowrite.chitty.cc/api'
        },
        metadata: {
          author: 'ChittyPM Team',
          license: 'MIT',
          repository: 'https://github.com/chittypm/todowrite-enhanced',
          documentation: 'https://docs.chitty.cc/todowrite'
        },
        schemas: {
          input: { type: 'object', properties: { content: { type: 'string' } } },
          output: { type: 'object', properties: { task: { type: 'object' } } }
        },
        tags: ['productivity', 'task-management', 'ai-powered'],
        verified: true,
        reputation: {
          score: 4.9,
          totalUses: 15420,
          successRate: 98.7
        }
      },
      {
        id: 'mcp-security-scanner',
        name: 'Security Scanner MCP',
        description: 'Automated security vulnerability scanning and analysis',
        version: '1.5.2',
        capabilities: ['vulnerability-scanning', 'security-analysis', 'code-audit', 'compliance-check'],
        endpoints: {
          websocket: 'wss://security.chitty.cc/mcp'
        },
        metadata: {
          author: 'Security Collective',
          license: 'Apache-2.0',
          repository: 'https://github.com/security-collective/mcp-scanner'
        },
        schemas: {},
        tags: ['security', 'scanning', 'compliance'],
        verified: true,
        reputation: {
          score: 4.7,
          totalUses: 8934,
          successRate: 96.3
        }
      },
      {
        id: 'mcp-code-reviewer',
        name: 'AI Code Reviewer',
        description: 'Intelligent code review with style checking and optimization suggestions',
        version: '3.0.1',
        capabilities: ['code-review', 'style-checking', 'optimization', 'best-practices'],
        endpoints: {
          http: 'https://codereview.chitty.cc/mcp'
        },
        metadata: {
          author: 'DevTools Inc',
          license: 'MIT'
        },
        schemas: {},
        tags: ['code-quality', 'review', 'optimization'],
        verified: false,
        reputation: {
          score: 4.3,
          totalUses: 3421,
          successRate: 94.1
        }
      }
    ];
  }

  private getMockAgents(): RegistryAgent[] {
    return [
      {
        id: 'agent-security-expert',
        name: 'Security Expert Pro',
        ensName: 'security-expert.chitty.eth',
        ethAddress: '0x742d35Cc6659C2532B5F6D7a780FC491CD2d6b5',
        description: 'Specialized in web application security and authentication systems',
        capabilities: ['security-audit', 'authentication', 'penetration-testing', 'vulnerability-analysis'],
        mcpTools: ['mcp-security-scanner', 'mcp-auth-validator'],
        specializations: ['OAuth implementations', 'JWT security', 'SQL injection prevention', 'OWASP compliance'],
        reputation: {
          score: 4.8,
          totalTasks: 127,
          successRate: 94.5,
          averageResponseTime: '2.3 hours'
        },
        metadata: {
          author: 'CyberSec Labs',
          languages: ['JavaScript', 'Python', 'Go'],
          frameworks: ['Express.js', 'Django', 'Gin'],
          certifications: ['CISSP', 'CEH', 'OSCP']
        },
        verified: true,
        lastActive: '2025-01-17T22:00:00Z'
      },
      {
        id: 'agent-fullstack-dev',
        name: 'FullStack Developer AI',
        ensName: 'fullstack-dev.chitty.eth',
        ethAddress: '0x1234567890123456789012345678901234567890',
        description: 'Complete full-stack development with modern frameworks and best practices',
        capabilities: ['frontend-development', 'backend-development', 'database-design', 'api-development'],
        mcpTools: ['mcp-code-reviewer', 'mcp-todowrite-enhanced', 'mcp-deployment-manager'],
        specializations: ['React/TypeScript', 'Node.js/Express', 'PostgreSQL', 'GraphQL'],
        reputation: {
          score: 4.6,
          totalTasks: 89,
          successRate: 92.1,
          averageResponseTime: '3.1 hours'
        },
        metadata: {
          author: 'DevCorp Solutions',
          languages: ['TypeScript', 'JavaScript', 'Python'],
          frameworks: ['React', 'Next.js', 'Express.js', 'FastAPI'],
          certifications: ['AWS Certified', 'React Advanced']
        },
        verified: true,
        lastActive: '2025-01-17T21:45:00Z'
      },
      {
        id: 'agent-documentation-specialist',
        name: 'Documentation Master',
        ensName: 'docs-master.chitty.eth',
        description: 'Technical documentation, API docs, and user guides specialist',
        capabilities: ['technical-writing', 'documentation', 'api-documentation', 'user-guides'],
        mcpTools: ['mcp-docs-generator', 'mcp-api-scanner'],
        specializations: ['OpenAPI/Swagger', 'README optimization', 'Tutorial creation', 'Documentation automation'],
        reputation: {
          score: 4.9,
          totalTasks: 156,
          successRate: 97.8,
          averageResponseTime: '1.8 hours'
        },
        metadata: {
          author: 'TechWrite Pro',
          languages: ['Markdown', 'ReStructuredText', 'AsciiDoc'],
          frameworks: ['Sphinx', 'GitBook', 'Docusaurus']
        },
        verified: true,
        lastActive: '2025-01-17T23:30:00Z'
      }
    ];
  }
}

export const registryChittyClient = new RegistryChittyClient();