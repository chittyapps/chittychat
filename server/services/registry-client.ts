import { ethers } from 'ethers';

// ENS Registry contract address on Ethereum mainnet
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const ENS_PUBLIC_RESOLVER_ADDRESS = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63';

// Mock agent registry for demonstration
const MOCK_AGENT_REGISTRY = [
  {
    id: '1',
    address: '0x1234567890123456789012345678901234567890',
    ensName: 'ai-assistant.eth',
    agentType: 'task-manager',
    capabilities: ['task-creation', 'scheduling', 'automation'],
    reputation: 95,
    lastActive: '2024-01-15T10:00:00Z',
    description: 'Advanced task management AI with scheduling capabilities',
    tags: ['productivity', 'automation', 'scheduling'],
    verified: true,
    mcpTools: ['task-scheduler', 'calendar-integration'],
    metadata: {}
  },
  {
    id: '2', 
    address: '0x2345678901234567890123456789012345678901',
    ensName: 'code-review.eth',
    agentType: 'developer',
    capabilities: ['code-analysis', 'security-audit', 'documentation'],
    reputation: 88,
    lastActive: '2024-01-14T15:30:00Z',
    description: 'Code review specialist with security focus',
    tags: ['development', 'security', 'code-quality'],
    verified: true,
    mcpTools: ['static-analyzer', 'vulnerability-scanner'],
    metadata: {}
  },
  {
    id: '3',
    address: '0x3456789012345678901234567890123456789012',
    ensName: 'data-analyst.eth', 
    agentType: 'analyst',
    capabilities: ['data-processing', 'visualization', 'reporting'],
    reputation: 92,
    lastActive: '2024-01-15T09:15:00Z',
    description: 'Data analysis expert with visualization tools',
    tags: ['analytics', 'visualization', 'reporting'],
    verified: false,
    mcpTools: ['chart-generator', 'sql-analyzer'],
    metadata: {}
  }
];

interface RecommendationContext {
  projects?: any[];
  agents?: any[];
  userPreferences?: Record<string, any>;
  chittyIdData?: any[];
  tags?: string[];
  category?: string;
}

class RegistryClient {
  private provider: ethers.JsonRpcProvider | null = null;

  constructor() {
    // Initialize provider for ENS resolution (optional)
    try {
      this.provider = new ethers.JsonRpcProvider('https://cloudflare-eth.com');
    } catch (error) {
      console.warn('ETH provider initialization failed, using mock data only');
    }
  }

  // Generate namehash for ENS domains
  private namehash(name: string): string {
    if (!name) return '0x' + '00'.repeat(32);
    
    const normalized = name.toLowerCase();
    const labels = normalized.split('.');
    let hash = '0x' + '00'.repeat(32);
    
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
      hash = ethers.keccak256(ethers.concat([hash, labelHash]));
    }
    
    return hash;
  }

  // Resolve ENS name to address
  async resolveENSName(ensName: string): Promise<string | null> {
    if (!this.provider) return null;
    
    try {
      const address = await this.provider.resolveName(ensName);
      return address;
    } catch (error) {
      console.warn(`Failed to resolve ENS name ${ensName}:`, error);
      return null;
    }
  }

  // Get agent registry data (using mock data for now)
  async getAgentRegistry(): Promise<Array<{
    id: string;
    address: string;
    ensName?: string;
    agentType: string;
    capabilities: string[];
    reputation: number;
    lastActive: string;
    description?: string;
    tags: string[];
    verified: boolean;
    mcpTools?: string[];
    metadata?: Record<string, any>;
  }>> {
    // In a real implementation, this would query blockchain contracts
    return MOCK_AGENT_REGISTRY;
  }

  // Advanced search with natural language processing and alignment
  async searchRegistry(
    query: string, 
    filters: Record<string, any> = {}
  ): Promise<Array<{
    id: string;
    address: string;
    ensName?: string;
    agentType: string;
    capabilities: string[];
    reputation: number;
    lastActive: string;
    description?: string;
    tags: string[];
    verified: boolean;
    mcpTools?: string[];
    relevanceScore?: number;
    alignmentFactors?: string[];
  }>> {
    let results = [...MOCK_AGENT_REGISTRY];

    // Enhanced text search with fuzzy matching and domain awareness
    if (query && query.length > 0) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      results = results.map(agent => {
        let relevanceScore = 0;
        const alignmentFactors: string[] = [];
        
        // Search across all searchable fields
        const searchableContent = [
          agent.ensName || '',
          agent.address,
          agent.agentType,
          agent.description || '',
          ...agent.capabilities,
          ...agent.tags,
          ...(agent.mcpTools || [])
        ].join(' ').toLowerCase();

        // Calculate relevance based on term matches
        searchTerms.forEach(term => {
          // Exact matches get higher scores
          if (searchableContent.includes(term)) {
            relevanceScore += 1;
            
            // Domain-specific scoring
            if (agent.ensName?.toLowerCase().includes(term)) {
              relevanceScore += 2;
              alignmentFactors.push(`Domain match: ${term}`);
            }
            if (agent.agentType.toLowerCase().includes(term)) {
              relevanceScore += 1.5;
              alignmentFactors.push(`Type alignment: ${term}`);
            }
            if (agent.capabilities.some(cap => cap.toLowerCase().includes(term))) {
              relevanceScore += 1.8;
              alignmentFactors.push(`Capability match: ${term}`);
            }
            if (agent.tags.some(tag => tag.toLowerCase().includes(term))) {
              relevanceScore += 1.2;
              alignmentFactors.push(`Tag relevance: ${term}`);
            }
          }
          
          // Fuzzy matching for similar terms
          if (this.fuzzyMatch(term, searchableContent)) {
            relevanceScore += 0.5;
            alignmentFactors.push(`Fuzzy match: ${term}`);
          }
        });

        return { 
          ...agent, 
          relevanceScore,
          alignmentFactors: alignmentFactors.length > 0 ? alignmentFactors : ['General match']
        };
      }).filter(agent => agent.relevanceScore > 0);
    } else {
      // No query - return all with basic scoring
      results = results.map(agent => ({
        ...agent,
        relevanceScore: agent.reputation / 100,
        alignmentFactors: ['Available agent']
      }));
    }

    // Apply filters with natural alignment
    if (filters.agentType) {
      results = results.filter(agent => {
        const typeMatch = agent.agentType.toLowerCase().includes(filters.agentType.toLowerCase());
        if (typeMatch && agent.alignmentFactors) {
          agent.alignmentFactors.push(`Type filter: ${filters.agentType}`);
        }
        return typeMatch;
      });
    }

    if (filters.minReputation) {
      results = results.filter(agent => agent.reputation >= filters.minReputation);
    }

    if (filters.verified !== undefined) {
      results = results.filter(agent => agent.verified === filters.verified);
    }

    if (filters.capabilities && filters.capabilities.length > 0) {
      results = results.filter(agent => {
        const capMatch = filters.capabilities.some((cap: string) => 
          agent.capabilities.some(agentCap => 
            agentCap.toLowerCase().includes(cap.toLowerCase())
          )
        );
        if (capMatch && agent.alignmentFactors) {
          agent.alignmentFactors.push(`Capability filter: ${filters.capabilities.join(', ')}`);
        }
        return capMatch;
      });
    }

    // Remove duplicates based on address and ENS name
    const uniqueResults = this.deduplicateResults(results);

    // Sort by relevance score and reputation
    uniqueResults.sort((a, b) => {
      const scoreA = (a.relevanceScore || 0) + (a.reputation / 200);
      const scoreB = (b.relevanceScore || 0) + (b.reputation / 200);
      return scoreB - scoreA;
    });

    return uniqueResults.slice(0, 20);
  }

  // Fuzzy matching for better search results
  private fuzzyMatch(term: string, content: string): boolean {
    if (term.length < 3) return false;
    
    // Simple Levenshtein distance approximation
    const words = content.split(/\s+/);
    return words.some(word => {
      if (word.length === 0) return false;
      const distance = this.levenshteinDistance(term, word);
      return distance <= Math.max(1, Math.floor(term.length * 0.3));
    });
  }

  // Calculate Levenshtein distance for fuzzy matching
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Deduplicate results based on address and domain
  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];
    
    for (const result of results) {
      // Create unique key from address and ENS name
      const key = `${result.address}-${result.ensName || 'no-ens'}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      } else {
        // Merge alignment factors if duplicate found
        const existing = unique.find(r => 
          r.address === result.address && r.ensName === result.ensName
        );
        if (existing && result.alignmentFactors) {
          existing.alignmentFactors = [
            ...(existing.alignmentFactors || []),
            ...result.alignmentFactors
          ];
          // Update score if higher
          if ((result.relevanceScore || 0) > (existing.relevanceScore || 0)) {
            existing.relevanceScore = result.relevanceScore;
          }
        }
      }
    }
    
    return unique;
  }

  // Generate smart recommendations based on context
  async generateSmartRecommendations(
    type: 'agent' | 'project' | 'user',
    targetId: string,
    context: RecommendationContext
  ): Promise<{
    id: string;
    type: string;
    targetId: string;
    recommendations: Array<{
      itemId: string;
      itemType: string;
      title: string;
      description: string;
      score: number;
      reason: string;
      metadata: Record<string, any>;
    }>;
    generatedAt: string;
    expiresAt: string;
  }> {
    const recommendations: Array<{
      itemId: string;
      itemType: string;
      title: string;
      description: string;
      score: number;
      reason: string;
      metadata: Record<string, any>;
    }> = [];

    // Get relevant agents from registry
    const registryAgents = await this.getAgentRegistry();

    switch (type) {
      case 'project':
        // Recommend agents based on project context
        for (const agent of registryAgents) {
          let score = 0.5; // Base score
          let reason = 'General recommendation';

          // Score based on matching capabilities with project needs
          if (context.tags && context.tags.length > 0) {
            const matchingTags = agent.tags.filter(tag => 
              context.tags!.some(projectTag => 
                tag.toLowerCase().includes(projectTag.toLowerCase()) ||
                projectTag.toLowerCase().includes(tag.toLowerCase())
              )
            );
            if (matchingTags.length > 0) {
              score += 0.3;
              reason = `Matches project tags: ${matchingTags.join(', ')}`;
            }
          }

          // Boost verified agents
          if (agent.verified) {
            score += 0.1;
          }

          // Factor in reputation
          score += (agent.reputation / 100) * 0.2;

          if (score > 0.6) {
            recommendations.push({
              itemId: agent.id,
              itemType: 'agent',
              title: agent.ensName || agent.address,
              description: agent.description || `${agent.agentType} agent`,
              score,
              reason,
              metadata: {
                address: agent.address,
                agentType: agent.agentType,
                capabilities: agent.capabilities,
                reputation: agent.reputation,
                verified: agent.verified,
                tags: agent.tags
              }
            });
          }
        }
        break;

      case 'agent':
        // Recommend complementary agents
        for (const agent of registryAgents) {
          if (agent.id === targetId) continue; // Skip self

          let score = 0.4;
          let reason = 'Complementary agent';

          // Look for different but complementary capabilities
          score += 0.3;
          reason = 'Provides complementary capabilities';

          if (agent.verified) {
            score += 0.1;
          }

          score += (agent.reputation / 100) * 0.2;

          if (score > 0.6) {
            recommendations.push({
              itemId: agent.id,
              itemType: 'agent',
              title: agent.ensName || agent.address,
              description: agent.description || `${agent.agentType} agent`,
              score,
              reason,
              metadata: {
                address: agent.address,
                agentType: agent.agentType,
                capabilities: agent.capabilities,
                reputation: agent.reputation,
                verified: agent.verified
              }
            });
          }
        }
        break;

      case 'user':
        // Recommend based on user's project history and preferences
        const userProjectTypes = context.projects?.map(p => p.category).filter(Boolean) || [];
        
        for (const agent of registryAgents) {
          let score = 0.3;
          let reason = 'Recommended for you';

          // Match agent types with user's project categories
          if (userProjectTypes.length > 0) {
            const hasMatchingType = userProjectTypes.some(type => 
              agent.agentType.toLowerCase().includes(type.toLowerCase()) ||
              agent.tags.some(tag => tag.toLowerCase().includes(type.toLowerCase()))
            );
            if (hasMatchingType) {
              score += 0.4;
              reason = 'Matches your project interests';
            }
          }

          if (agent.verified) {
            score += 0.1;
          }

          score += (agent.reputation / 100) * 0.2;

          if (score > 0.5) {
            recommendations.push({
              itemId: agent.id,
              itemType: 'agent',
              title: agent.ensName || agent.address,
              description: agent.description || `${agent.agentType} agent`,
              score,
              reason,
              metadata: {
                address: agent.address,
                agentType: agent.agentType,
                capabilities: agent.capabilities,
                reputation: agent.reputation,
                verified: agent.verified
              }
            });
          }
        }
        break;
    }

    // Sort by score and limit results
    recommendations.sort((a, b) => b.score - a.score);
    const limitedRecommendations = recommendations.slice(0, 10);

    return {
      id: `rec_${Date.now()}`,
      type,
      targetId,
      recommendations: limitedRecommendations,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
  }

  // Get ENS domain info (mock implementation)
  async getENSDomainInfo(domain: string): Promise<{
    owner: string;
    resolver: string;
    ttl: number;
  } | null> {
    if (!this.provider) return null;

    try {
      // This would query the actual ENS registry contract
      // For now, return mock data
      return {
        owner: '0x1234567890123456789012345678901234567890',
        resolver: ENS_PUBLIC_RESOLVER_ADDRESS,
        ttl: 0
      };
    } catch (error) {
      console.warn(`Failed to get ENS domain info for ${domain}:`, error);
      return null;
    }
  }
}

export const registryClient = new RegistryClient();