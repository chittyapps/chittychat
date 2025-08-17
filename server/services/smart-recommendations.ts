import { storage } from "../storage";
import { ethRegistryClient } from "./eth-registry-client";
import { chittyidClient } from "./chittyid-client";
import type { SmartRecommendation, Project, Agent, User } from "@shared/schema";
import { nanoid } from 'nanoid';

interface RecommendationContext {
  projects?: Project[];
  agents?: Agent[];
  userPreferences?: Record<string, any>;
  chittyIdData?: any[];
  tags?: string[];
  category?: string;
}

class SmartRecommendationsService {
  async generateProjectRecommendations(projectId: string): Promise<SmartRecommendation> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const context: RecommendationContext = {
      tags: project.tags || [],
      category: project.category || '',
    };

    // Get ETH registry recommendations
    const ethRecommendation = await ethRegistryClient.generateSmartRecommendations(
      'project',
      projectId,
      context
    );

    // Store in database
    const stored = await storage.createSmartRecommendation({
      type: 'project',
      targetId: projectId,
      recommendations: ethRecommendation.recommendations,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    return stored;
  }

  async generateAgentRecommendations(agentId: string): Promise<SmartRecommendation> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const context: RecommendationContext = {
      userPreferences: {
        preferredAgentTypes: [agent.type],
        capabilities: agent.capabilities || []
      }
    };

    // Get ETH registry recommendations for complementary agents
    const ethRecommendation = await ethRegistryClient.generateSmartRecommendations(
      'agent',
      agentId,
      context
    );

    // Store in database
    const stored = await storage.createSmartRecommendation({
      type: 'agent',
      targetId: agentId,
      recommendations: ethRecommendation.recommendations,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return stored;
  }

  async generateUserRecommendations(userId: string): Promise<SmartRecommendation> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get user's project history for context
    const userProjects = await storage.getUserProjects(userId);
    
    // Get ChittyID data for enhanced recommendations
    let chittyIdData: any[] = [];
    try {
      if (user.chittyId) {
        // For now, use project data as ChittyID context
        chittyIdData = userProjects.map(p => ({
          id: p.id,
          type: 'project',
          name: p.name,
          description: p.description,
          relevanceScore: 0.8,
          metadata: p.metadata || {}
        }));
      }
    } catch (error) {
      console.warn('ChittyID recommendations failed:', error);
    }

    const context: RecommendationContext = {
      projects: userProjects,
      chittyIdData,
      userPreferences: {}
    };

    // Generate recommendations based on user history and ChittyID data
    const ethRecommendation = await ethRegistryClient.generateSmartRecommendations(
      'user',
      userId,
      context
    );

    // Enhance with ChittyID-based recommendations
    const enhancedRecommendations = await this.enhanceWithChittyIdRecommendations(
      ethRecommendation.recommendations,
      chittyIdData
    );

    // Store in database
    const stored = await storage.createSmartRecommendation({
      type: 'user',
      targetId: userId,
      recommendations: enhancedRecommendations,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return stored;
  }

  private async enhanceWithChittyIdRecommendations(
    ethRecommendations: Array<{
      itemId: string;
      itemType: string;
      title: string;
      description: string;
      score: number;
      reason: string;
      metadata: Record<string, any>;
    }>,
    chittyIdData: any[]
  ): Promise<Array<{
    itemId: string;
    itemType: string;
    title: string;
    description: string;
    score: number;
    reason: string;
    metadata: Record<string, any>;
  }>> {
    const enhanced = [...ethRecommendations];

    // Add ChittyID-based recommendations
    for (const chittyItem of chittyIdData) {
      if (chittyItem.type === 'agent' || chittyItem.type === 'project') {
        enhanced.push({
          itemId: chittyItem.id,
          itemType: chittyItem.type,
          title: chittyItem.name || chittyItem.title,
          description: chittyItem.description || 'Recommended based on ChittyID analysis',
          score: chittyItem.relevanceScore || 0.7,
          reason: 'Recommended based on your ChittyID profile and usage patterns',
          metadata: {
            source: 'chittyid',
            ...chittyItem.metadata
          }
        });
      }
    }

    // Sort by score and remove duplicates
    const uniqueRecommendations = enhanced.reduce((acc, current) => {
      const existing = acc.find((item: any) => item.itemId === current.itemId);
      if (!existing) {
        acc.push(current);
      } else if (current.score > existing.score) {
        // Replace with higher scoring recommendation
        const index = acc.indexOf(existing);
        acc[index] = current;
      }
      return acc;
    }, [] as Array<{
      itemId: string;
      itemType: string;
      title: string;
      description: string;
      score: number;
      reason: string;
      metadata: Record<string, any>;
    }>);

    return uniqueRecommendations
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 15); // Top 15 recommendations
  }

  async getRecommendations(
    type: 'agent' | 'project' | 'user',
    targetId: string,
    forceRefresh = false
  ): Promise<SmartRecommendation | null> {
    // Check for existing valid recommendations
    if (!forceRefresh) {
      const existing = await storage.getSmartRecommendations(type, targetId);
      if (existing && existing.length > 0) {
        const latest = existing[0];
        if (new Date(latest.expiresAt) > new Date()) {
          return latest;
        }
      }
    }

    // Generate new recommendations
    switch (type) {
      case 'project':
        return await this.generateProjectRecommendations(targetId);
      case 'agent':
        return await this.generateAgentRecommendations(targetId);
      case 'user':
        return await this.generateUserRecommendations(targetId);
      default:
        throw new Error(`Unsupported recommendation type: ${type}`);
    }
  }

  async searchRegistry(query: string, filters: Record<string, any> = {}): Promise<Array<{
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
  }>> {
    return await ethRegistryClient.searchRegistry(query, filters);
  }

  async syncEthRegistryData(): Promise<void> {
    try {
      const registryData = await ethRegistryClient.getAgentRegistry();
      
      // Update local ETH registry cache
      for (const entry of registryData) {
        await storage.upsertEthRegistryEntry({
          address: entry.address,
          ensName: entry.ensName,
          agentType: entry.agentType,
          capabilities: entry.capabilities,
          reputation: entry.reputation,
          lastActive: new Date(entry.lastActive),
          description: entry.description,
          tags: entry.tags,
          verified: entry.verified,
          mcpTools: entry.mcpTools,
          metadata: {}
        });
      }

      console.log(`Synced ${registryData.length} ETH registry entries`);
    } catch (error) {
      console.error('Failed to sync ETH registry data:', error);
      throw error;
    }
  }

  async getRecommendationStats(): Promise<{
    totalRecommendations: number;
    activeRecommendations: number;
    recentGenerations: number;
    ethRegistryEntries: number;
  }> {
    const stats = await storage.getRecommendationStats();
    return stats;
  }
}

export const smartRecommendationsService = new SmartRecommendationsService();