import { db } from '../db';
import { mcpTools, agents, activities } from '../../shared/schema';
import { eq, and, or, inArray, like } from 'drizzle-orm';
import { registryClient } from './registry-client';
import type { McpTool } from '../../shared/schema';

interface ToolDiscoveryResult {
  tool: McpTool;
  source: 'registry' | 'local' | 'discovered';
  compatibility: number;
  recommendations: string[];
}

export class EnhancedRegistryClient {
  private static instance: EnhancedRegistryClient;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private toolCache: Map<string, McpTool> = new Map();
  private compatibilityMatrix: Map<string, Map<string, number>> = new Map();

  static getInstance(): EnhancedRegistryClient {
    if (!EnhancedRegistryClient.instance) {
      EnhancedRegistryClient.instance = new EnhancedRegistryClient();
    }
    return EnhancedRegistryClient.instance;
  }

  async initializeDynamicDiscovery() {
    await this.discoverAndSyncTools();
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    // Run discovery every 30 minutes
    this.discoveryInterval = setInterval(async () => {
      await this.discoverAndSyncTools();
    }, 30 * 60 * 1000);
  }

  async discoverAndSyncTools(): Promise<void> {
    try {
      console.log('Starting dynamic MCP tool discovery...');
      
      // Discover from registry
      const registryTools = await this.discoverFromRegistry();
      
      // Discover from active agents
      const agentTools = await this.discoverFromAgents();
      
      // Discover from project patterns
      const patternTools = await this.discoverFromPatterns();
      
      // Merge and deduplicate discoveries
      const allTools = this.mergeToolDiscoveries([
        ...registryTools,
        ...agentTools,
        ...patternTools
      ]);
      
      // Sync to database
      await this.syncToolsToDatabase(allTools);
      
      // Update compatibility matrix
      await this.updateCompatibilityMatrix();
      
      console.log(`Tool discovery completed. Found ${allTools.length} tools.`);
    } catch (error) {
      console.error('Error during tool discovery:', error);
    }
  }

  private async discoverFromRegistry(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    
    try {
      // Get agent registry data
      const registryAgents = await registryClient.getAgentRegistry();
      
      for (const agent of registryAgents) {
        if (agent.mcpTools && agent.mcpTools.length > 0) {
          for (const toolName of agent.mcpTools) {
            const tool: McpTool = {
              id: `registry_${agent.id}_${toolName}`,
              name: toolName,
              description: `Tool from ${agent.ensName || agent.address}`,
              version: '1.0.0',
              category: this.inferToolCategory(toolName, agent.agentType),
              capabilities: this.inferToolCapabilities(toolName, agent.capabilities),
              registryUrl: `registry://chitty.cc/${agent.ensName || agent.address}/${toolName}`,
              metadata: {
                source: 'registry',
                agentId: agent.id,
                agentType: agent.agentType,
                verified: agent.verified
              },
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            tools.push(tool);
            this.toolCache.set(tool.name, tool);
          }
        }
      }
    } catch (error) {
      console.error('Error discovering from registry:', error);
    }
    
    return tools;
  }

  private async discoverFromAgents(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    
    try {
      // Get active agents from database
      const activeAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.status, 'active'));
      
      for (const agent of activeAgents) {
        const agentCapabilities = agent.capabilities as string[] || [];
        const agentMetadata = agent.metadata as any || {};
        
        // Infer tools from capabilities
        for (const capability of agentCapabilities) {
          if (this.isToolCapability(capability)) {
            const toolName = this.capabilityToToolName(capability);
            
            const tool: McpTool = {
              id: `agent_${agent.id}_${toolName}`,
              name: toolName,
              description: `Discovered from ${agent.name}'s capabilities`,
              version: '1.0.0',
              category: this.inferToolCategory(toolName, agent.type),
              capabilities: [capability],
              registryUrl: `agent://${agent.id}/${toolName}`,
              metadata: {
                source: 'agent',
                agentId: agent.id,
                agentName: agent.name,
                discoveredAt: new Date().toISOString()
              },
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            tools.push(tool);
          }
        }
        
        // Check for explicitly declared tools in metadata
        if (agentMetadata.tools && Array.isArray(agentMetadata.tools)) {
          for (const declaredTool of agentMetadata.tools) {
            const tool: McpTool = {
              id: `declared_${agent.id}_${declaredTool.name || declaredTool}`,
              name: declaredTool.name || declaredTool,
              description: declaredTool.description || `Tool declared by ${agent.name}`,
              version: declaredTool.version || '1.0.0',
              category: declaredTool.category || 'general',
              capabilities: declaredTool.capabilities || [],
              registryUrl: `agent://${agent.id}/${declaredTool.name || declaredTool}`,
              metadata: {
                source: 'agent_declared',
                agentId: agent.id,
                agentName: agent.name,
                ...declaredTool
              },
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            tools.push(tool);
          }
        }
      }
    } catch (error) {
      console.error('Error discovering from agents:', error);
    }
    
    return tools;
  }

  private async discoverFromPatterns(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    
    try {
      // Analyze recent activities for tool usage patterns
      const recentActivities = await db
        .select()
        .from(activities)
        .where(
          and(
            activities.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            or(
              eq(activities.type, 'tool_used'),
              eq(activities.type, 'mcp_action'),
              like(activities.description, '%tool%'),
              like(activities.description, '%MCP%')
            )
          )
        )
        .limit(1000);
      
      const toolPatterns = new Map<string, number>();
      
      for (const activity of recentActivities) {
        const metadata = activity.metadata as any || {};
        
        // Extract tool references from metadata
        if (metadata.toolName) {
          const count = toolPatterns.get(metadata.toolName) || 0;
          toolPatterns.set(metadata.toolName, count + 1);
        }
        
        // Extract from description using patterns
        const toolMatches = activity.description.match(/(?:tool|MCP):\s*(\w+)/gi);
        if (toolMatches) {
          for (const match of toolMatches) {
            const toolName = match.replace(/(?:tool|MCP):\s*/i, '');
            const count = toolPatterns.get(toolName) || 0;
            toolPatterns.set(toolName, count + 1);
          }
        }
      }
      
      // Create tool entries for frequently used patterns
      for (const [toolName, usageCount] of toolPatterns) {
        if (usageCount >= 3 && !this.toolCache.has(toolName)) {
          const tool: McpTool = {
            id: `pattern_${toolName}_${Date.now()}`,
            name: toolName,
            description: `Discovered from usage patterns (${usageCount} uses)`,
            version: '1.0.0',
            category: 'discovered',
            capabilities: [],
            registryUrl: `pattern://${toolName}`,
            metadata: {
              source: 'pattern_discovery',
              usageCount,
              discoveredAt: new Date().toISOString()
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          tools.push(tool);
        }
      }
    } catch (error) {
      console.error('Error discovering from patterns:', error);
    }
    
    return tools;
  }

  private mergeToolDiscoveries(tools: McpTool[]): McpTool[] {
    const mergedMap = new Map<string, McpTool>();
    
    for (const tool of tools) {
      const key = tool.name.toLowerCase();
      
      if (mergedMap.has(key)) {
        // Merge with existing tool
        const existing = mergedMap.get(key)!;
        
        // Combine capabilities
        const allCapabilities = new Set([
          ...(existing.capabilities || []),
          ...(tool.capabilities || [])
        ]);
        existing.capabilities = Array.from(allCapabilities);
        
        // Merge metadata
        existing.metadata = {
          ...existing.metadata,
          ...tool.metadata,
          sources: [
            ...(existing.metadata?.sources || [existing.metadata?.source]),
            tool.metadata?.source
          ].filter(Boolean)
        };
        
        // Update if newer version
        if (tool.version && existing.version) {
          if (this.compareVersions(tool.version, existing.version) > 0) {
            existing.version = tool.version;
          }
        }
      } else {
        mergedMap.set(key, { ...tool });
      }
    }
    
    return Array.from(mergedMap.values());
  }

  private async syncToolsToDatabase(tools: McpTool[]): Promise<void> {
    for (const tool of tools) {
      try {
        // Check if tool exists
        const existing = await db
          .select()
          .from(mcpTools)
          .where(eq(mcpTools.name, tool.name))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing tool
          await db
            .update(mcpTools)
            .set({
              description: tool.description,
              version: tool.version,
              category: tool.category,
              capabilities: tool.capabilities,
              registryUrl: tool.registryUrl,
              metadata: tool.metadata,
              updatedAt: new Date()
            })
            .where(eq(mcpTools.name, tool.name));
        } else {
          // Insert new tool
          await db.insert(mcpTools).values(tool);
        }
      } catch (error) {
        console.error(`Error syncing tool ${tool.name}:`, error);
      }
    }
  }

  private async updateCompatibilityMatrix(): Promise<void> {
    // Build compatibility matrix between tools and agents
    const allTools = await db.select().from(mcpTools);
    const allAgents = await db.select().from(agents);
    
    for (const tool of allTools) {
      const toolCompat = new Map<string, number>();
      
      for (const agent of allAgents) {
        const compatibility = this.calculateCompatibility(tool, agent);
        toolCompat.set(agent.id, compatibility);
      }
      
      this.compatibilityMatrix.set(tool.id, toolCompat);
    }
  }

  private calculateCompatibility(tool: McpTool, agent: any): number {
    let score = 0.5; // Base compatibility
    
    const toolCaps = tool.capabilities || [];
    const agentCaps = agent.capabilities as string[] || [];
    
    // Check capability overlap
    const overlap = toolCaps.filter(tc => 
      agentCaps.some(ac => 
        ac.toLowerCase().includes(tc.toLowerCase()) ||
        tc.toLowerCase().includes(ac.toLowerCase())
      )
    );
    
    score += (overlap.length / Math.max(toolCaps.length, 1)) * 0.3;
    
    // Check category match
    if (tool.category && agent.type) {
      if (tool.category.toLowerCase().includes(agent.type.toLowerCase()) ||
          agent.type.toLowerCase().includes(tool.category.toLowerCase())) {
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  async searchTools(
    query: string,
    filters?: {
      category?: string;
      capabilities?: string[];
      isActive?: boolean;
      source?: string;
    }
  ): Promise<ToolDiscoveryResult[]> {
    let tools = await db.select().from(mcpTools);
    
    // Apply filters
    if (filters?.category) {
      tools = tools.filter(t => t.category === filters.category);
    }
    
    if (filters?.isActive !== undefined) {
      tools = tools.filter(t => t.isActive === filters.isActive);
    }
    
    if (filters?.capabilities && filters.capabilities.length > 0) {
      tools = tools.filter(t => {
        const toolCaps = t.capabilities || [];
        return filters.capabilities!.some(fc => 
          toolCaps.some(tc => tc.toLowerCase().includes(fc.toLowerCase()))
        );
      });
    }
    
    // Search query
    if (query) {
      const searchTerms = query.toLowerCase().split(/\s+/);
      tools = tools.filter(t => {
        const searchContent = [
          t.name,
          t.description || '',
          t.category || '',
          ...(t.capabilities || [])
        ].join(' ').toLowerCase();
        
        return searchTerms.every(term => searchContent.includes(term));
      });
    }
    
    // Build results with recommendations
    const results: ToolDiscoveryResult[] = tools.map(tool => {
      const metadata = tool.metadata as any || {};
      const source = metadata.source || 'local';
      
      const recommendations: string[] = [];
      
      if (tool.isActive) {
        recommendations.push('Tool is active and ready to use');
      }
      
      if (metadata.verified) {
        recommendations.push('Verified by registry');
      }
      
      if (metadata.usageCount && metadata.usageCount > 10) {
        recommendations.push(`Popular tool (${metadata.usageCount} uses)`);
      }
      
      // Calculate average compatibility
      const compatMap = this.compatibilityMatrix.get(tool.id);
      if (compatMap && compatMap.size > 0) {
        const avgCompat = Array.from(compatMap.values()).reduce((a, b) => a + b, 0) / compatMap.size;
        
        return {
          tool,
          source: source as 'registry' | 'local' | 'discovered',
          compatibility: avgCompat,
          recommendations
        };
      }
      
      return {
        tool,
        source: source as 'registry' | 'local' | 'discovered',
        compatibility: 0.5,
        recommendations
      };
    });
    
    // Sort by compatibility and relevance
    results.sort((a, b) => b.compatibility - a.compatibility);
    
    return results;
  }

  async getToolRecommendations(
    context: {
      projectId?: string;
      agentId?: string;
      taskType?: string;
    }
  ): Promise<ToolDiscoveryResult[]> {
    const recommendations: ToolDiscoveryResult[] = [];
    const allTools = await db.select().from(mcpTools).where(eq(mcpTools.isActive, true));
    
    for (const tool of allTools) {
      let score = 0.3; // Base score
      const reasons: string[] = [];
      
      // Check agent compatibility
      if (context.agentId) {
        const compatMap = this.compatibilityMatrix.get(tool.id);
        if (compatMap && compatMap.has(context.agentId)) {
          const compat = compatMap.get(context.agentId)!;
          score += compat * 0.4;
          if (compat > 0.7) {
            reasons.push('High compatibility with agent');
          }
        }
      }
      
      // Check task type alignment
      if (context.taskType && tool.category) {
        if (tool.category.toLowerCase().includes(context.taskType.toLowerCase()) ||
            context.taskType.toLowerCase().includes(tool.category.toLowerCase())) {
          score += 0.3;
          reasons.push('Matches task type');
        }
      }
      
      // Check recent usage
      const metadata = tool.metadata as any || {};
      if (metadata.usageCount && metadata.usageCount > 5) {
        score += 0.1;
        reasons.push('Frequently used tool');
      }
      
      if (score > 0.5) {
        recommendations.push({
          tool,
          source: (metadata.source || 'local') as any,
          compatibility: score,
          recommendations: reasons
        });
      }
    }
    
    // Sort by score
    recommendations.sort((a, b) => b.compatibility - a.compatibility);
    
    return recommendations.slice(0, 10);
  }

  private inferToolCategory(toolName: string, agentType?: string): string {
    const name = toolName.toLowerCase();
    
    if (name.includes('task') || name.includes('schedule')) return 'task-management';
    if (name.includes('code') || name.includes('review')) return 'development';
    if (name.includes('data') || name.includes('analyz')) return 'analytics';
    if (name.includes('test') || name.includes('qa')) return 'testing';
    if (name.includes('deploy') || name.includes('ci')) return 'deployment';
    if (name.includes('monitor') || name.includes('log')) return 'monitoring';
    if (name.includes('security') || name.includes('audit')) return 'security';
    
    return agentType || 'general';
  }

  private inferToolCapabilities(toolName: string, agentCapabilities?: string[]): string[] {
    const capabilities: string[] = [];
    const name = toolName.toLowerCase();
    
    if (name.includes('create')) capabilities.push('creation');
    if (name.includes('read') || name.includes('view')) capabilities.push('reading');
    if (name.includes('update') || name.includes('edit')) capabilities.push('updating');
    if (name.includes('delete') || name.includes('remove')) capabilities.push('deletion');
    if (name.includes('analyze')) capabilities.push('analysis');
    if (name.includes('generate')) capabilities.push('generation');
    if (name.includes('validate')) capabilities.push('validation');
    
    // Add agent capabilities if relevant
    if (agentCapabilities) {
      for (const cap of agentCapabilities) {
        if (cap.toLowerCase().includes(name) || name.includes(cap.toLowerCase())) {
          capabilities.push(cap);
        }
      }
    }
    
    return capabilities.length > 0 ? capabilities : ['general'];
  }

  private isToolCapability(capability: string): boolean {
    const toolIndicators = [
      'tool', 'mcp', 'integration', 'api', 'service',
      'analyzer', 'generator', 'validator', 'processor'
    ];
    
    const cap = capability.toLowerCase();
    return toolIndicators.some(indicator => cap.includes(indicator));
  }

  private capabilityToToolName(capability: string): string {
    // Convert capability to tool name
    return capability
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\s+/g, '')
      .replace(/Tool$|Service$|Integration$/i, '');
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  stop() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    this.toolCache.clear();
    this.compatibilityMatrix.clear();
  }
}