import { db } from '../db';
import { workspaces, projects, agents, users, activities } from '../../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import type { Workspace, Project, Agent } from '../../shared/schema';

export class WorkspaceIsolationService {
  private static instance: WorkspaceIsolationService;
  private workspaceCache: Map<string, Workspace> = new Map();
  private accessControlCache: Map<string, Set<string>> = new Map();

  static getInstance(): WorkspaceIsolationService {
    if (!WorkspaceIsolationService.instance) {
      WorkspaceIsolationService.instance = new WorkspaceIsolationService();
    }
    return WorkspaceIsolationService.instance;
  }

  async createWorkspace(
    name: string,
    type: 'shared' | 'isolated' | 'private',
    ownerId?: string,
    description?: string
  ): Promise<Workspace> {
    const [workspace] = await db.insert(workspaces).values({
      name,
      type,
      ownerId,
      description,
      settings: {
        maxAgents: type === 'private' ? 5 : type === 'isolated' ? 20 : 100,
        maxProjects: type === 'private' ? 10 : type === 'isolated' ? 50 : 1000,
        allowExternalAgents: type === 'shared',
        autoArchiveDays: type === 'private' ? 30 : 90,
        isolationLevel: type
      }
    }).returning();

    this.workspaceCache.set(workspace.id, workspace);
    return workspace;
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    if (this.workspaceCache.has(workspaceId)) {
      return this.workspaceCache.get(workspaceId)!;
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace) {
      this.workspaceCache.set(workspace.id, workspace);
    }

    return workspace || null;
  }

  async assignProjectToWorkspace(projectId: string, workspaceId: string): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check workspace limits
    const projectCount = await this.getWorkspaceProjectCount(workspaceId);
    const maxProjects = workspace.settings?.maxProjects || 1000;
    
    if (projectCount >= maxProjects) {
      throw new Error(`Workspace has reached its project limit (${maxProjects})`);
    }

    await db
      .update(projects)
      .set({ 
        workspaceId,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    await db.insert(activities).values({
      type: 'workspace_assignment',
      description: `Project assigned to workspace ${workspace.name}`,
      projectId,
      metadata: { workspaceId, workspaceName: workspace.name }
    });
  }

  async getWorkspaceProjectCount(workspaceId: string): Promise<number> {
    const result = await db
      .select({ count: projects.id })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));
    
    return result.length;
  }

  async checkAgentAccess(
    agentId: string,
    projectId: string
  ): Promise<boolean> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return false;
    }

    // If no workspace, allow access (backward compatibility)
    if (!project.workspaceId) {
      return true;
    }

    const workspace = await this.getWorkspace(project.workspaceId);
    if (!workspace) {
      return false;
    }

    // Check workspace type
    switch (workspace.type) {
      case 'shared':
        return true; // All agents can access shared workspaces
      
      case 'isolated':
        return await this.isAgentInWorkspace(agentId, workspace.id);
      
      case 'private':
        return await this.isAgentOwnerOrAuthorized(agentId, workspace);
      
      default:
        return false;
    }
  }

  private async isAgentInWorkspace(agentId: string, workspaceId: string): Promise<boolean> {
    const cacheKey = `${workspaceId}:agents`;
    
    if (!this.accessControlCache.has(cacheKey)) {
      const workspaceProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId));

      const projectIds = workspaceProjects.map(p => p.id);
      
      if (projectIds.length === 0) {
        this.accessControlCache.set(cacheKey, new Set());
        return false;
      }

      const workspaceActivities = await db
        .select({ agentId: activities.agentId })
        .from(activities)
        .where(
          and(
            inArray(activities.projectId, projectIds),
            activities.agentId !== null
          )
        );

      const agentIds = new Set(workspaceActivities.map(a => a.agentId).filter(Boolean) as string[]);
      this.accessControlCache.set(cacheKey, agentIds);
    }

    const authorizedAgents = this.accessControlCache.get(cacheKey)!;
    return authorizedAgents.has(agentId);
  }

  private async isAgentOwnerOrAuthorized(
    agentId: string,
    workspace: Workspace
  ): Promise<boolean> {
    // Check if agent belongs to workspace owner
    if (workspace.ownerId) {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (agent?.metadata?.ownerId === workspace.ownerId) {
        return true;
      }
    }

    // Check explicit authorization list in workspace settings
    const authorizedAgents = workspace.settings?.authorizedAgents as string[] || [];
    return authorizedAgents.includes(agentId);
  }

  async enforceWorkspaceIsolation(
    agentId: string,
    requestedProjects: string[]
  ): Promise<string[]> {
    const allowedProjects: string[] = [];

    for (const projectId of requestedProjects) {
      if (await this.checkAgentAccess(agentId, projectId)) {
        allowedProjects.push(projectId);
      }
    }

    return allowedProjects;
  }

  async getAgentWorkspaces(agentId: string): Promise<Workspace[]> {
    // Get all projects the agent has accessed
    const agentActivities = await db
      .select({ projectId: activities.projectId })
      .from(activities)
      .where(
        and(
          eq(activities.agentId, agentId),
          activities.projectId !== null
        )
      );

    const projectIds = [...new Set(agentActivities.map(a => a.projectId).filter(Boolean) as string[])];
    
    if (projectIds.length === 0) {
      return [];
    }

    // Get workspaces for these projects
    const projectsWithWorkspaces = await db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(
        and(
          inArray(projects.id, projectIds),
          projects.workspaceId !== null
        )
      );

    const workspaceIds = [...new Set(projectsWithWorkspaces.map(p => p.workspaceId).filter(Boolean) as string[])];
    
    if (workspaceIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(workspaces)
      .where(inArray(workspaces.id, workspaceIds));
  }

  async updateWorkspaceSettings(
    workspaceId: string,
    settings: Record<string, any>
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const updatedSettings = {
      ...workspace.settings,
      ...settings
    };

    await db
      .update(workspaces)
      .set({ 
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceId));

    // Clear cache
    this.workspaceCache.delete(workspaceId);
    this.clearAccessControlCache(workspaceId);
  }

  async addAgentToWorkspace(
    agentId: string,
    workspaceId: string
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const authorizedAgents = workspace.settings?.authorizedAgents as string[] || [];
    
    if (!authorizedAgents.includes(agentId)) {
      authorizedAgents.push(agentId);
      await this.updateWorkspaceSettings(workspaceId, { 
        authorizedAgents 
      });
    }

    await db.insert(activities).values({
      type: 'agent_workspace_access',
      description: `Agent granted access to workspace ${workspace.name}`,
      agentId,
      metadata: { workspaceId, workspaceName: workspace.name }
    });
  }

  async removeAgentFromWorkspace(
    agentId: string,
    workspaceId: string
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const authorizedAgents = workspace.settings?.authorizedAgents as string[] || [];
    const filtered = authorizedAgents.filter(id => id !== agentId);
    
    if (filtered.length !== authorizedAgents.length) {
      await this.updateWorkspaceSettings(workspaceId, { 
        authorizedAgents: filtered 
      });
    }

    await db.insert(activities).values({
      type: 'agent_workspace_removal',
      description: `Agent removed from workspace ${workspace.name}`,
      agentId,
      metadata: { workspaceId, workspaceName: workspace.name }
    });
  }

  private clearAccessControlCache(workspaceId?: string) {
    if (workspaceId) {
      const cacheKey = `${workspaceId}:agents`;
      this.accessControlCache.delete(cacheKey);
    } else {
      this.accessControlCache.clear();
    }
  }

  async getWorkspaceMetrics(workspaceId: string): Promise<Record<string, any>> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const workspaceProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));

    const projectIds = workspaceProjects.map(p => p.id);
    
    const activeProjects = workspaceProjects.filter(p => p.status === 'active').length;
    const completedProjects = workspaceProjects.filter(p => p.status === 'completed').length;
    const archivedProjects = workspaceProjects.filter(p => p.status === 'archived').length;

    let totalActivities = 0;
    let uniqueAgents = new Set<string>();

    if (projectIds.length > 0) {
      const workspaceActivities = await db
        .select()
        .from(activities)
        .where(inArray(activities.projectId, projectIds));

      totalActivities = workspaceActivities.length;
      workspaceActivities.forEach(a => {
        if (a.agentId) uniqueAgents.add(a.agentId);
      });
    }

    return {
      workspaceId,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
      totalProjects: workspaceProjects.length,
      activeProjects,
      completedProjects,
      archivedProjects,
      totalActivities,
      uniqueAgents: uniqueAgents.size,
      settings: workspace.settings,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };
  }

  clearCache() {
    this.workspaceCache.clear();
    this.accessControlCache.clear();
  }
}