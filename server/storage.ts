import { 
  users, projects, tasks, agents, activities, integrations, mcpTools, smartRecommendations, ethRegistryEntries,
  workflows, workflowRuns, incidents, metrics, events,
  type User, type InsertUser, type Project, type InsertProject,
  type Task, type InsertTask, type Agent, type InsertAgent,
  type Activity, type InsertActivity, type Integration, type InsertIntegration,
  type McpTool, type InsertMcpTool, type SmartRecommendation, type InsertSmartRecommendation,
  type EthRegistryEntry, type InsertEthRegistryEntry,
  type Workflow, type InsertWorkflow, type WorkflowRun, type InsertWorkflowRun,
  type Incident, type InsertIncident, type Metric, type InsertMetric,
  type Event, type InsertEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, count, gt, inArray } from "drizzle-orm";

// Helper to convert readonly arrays to mutable string arrays for JSON fields
const toStringArray = (a: any): string[] => 
  Array.isArray(a) ? [...a] : [];

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjects(userId?: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProjectStats(projectId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    progress: number;
  }>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasks(projectId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTasksByAgent(agentName: string): Promise<Task[]>;

  // Agents
  getAgent(id: string): Promise<Agent | undefined>;
  getAgents(): Promise<Agent[]>;
  getActiveAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent>;
  updateAgentLastSeen(id: string): Promise<void>;

  // Activities
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivities(projectId?: string): Promise<Activity[]>;
  getRecentActivities(limit?: number): Promise<Activity[]>;

  // Integrations
  getIntegrations(): Promise<Integration[]>;
  getIntegration(name: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration>;

  // MCP Tools
  getMcpTools(): Promise<McpTool[]>;
  createMcpTool(tool: InsertMcpTool): Promise<McpTool>;
  updateMcpTool(id: string, updates: Partial<McpTool>): Promise<McpTool>;
  syncMcpTools(tools: InsertMcpTool[]): Promise<void>;

  // Smart Recommendations
  getSmartRecommendations(type: string, targetId: string): Promise<SmartRecommendation[]>;
  createSmartRecommendation(recommendation: InsertSmartRecommendation): Promise<SmartRecommendation>;
  getRecommendationStats(): Promise<{
    totalRecommendations: number;
    activeRecommendations: number;
    recentGenerations: number;
    ethRegistryEntries: number;
  }>;

  // ETH Registry
  getEthRegistryEntries(): Promise<EthRegistryEntry[]>;
  upsertEthRegistryEntry(entry: InsertEthRegistryEntry): Promise<EthRegistryEntry>;
  
  // Universal PM Board methods
  getTasksByProject(projectId: string): Promise<Task[]>;
  getAgentsByProject(projectId: string): Promise<Agent[]>;
  
  // Additional methods
  getUserProjects(userId: string): Promise<Project[]>;

  // Premium Dashboard Analytics
  getDashboardMetrics(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
    activeAgents: number;
    totalIntegrations: number;
    activeIntegrations: number;
    recentActivities: Activity[];
    agentMetrics: Array<{
      id: string;
      name: string;
      status: string;
      taskCount: number;
      lastSeen: Date | null;
    }>;
    projectStats: Array<{
      id: string;
      name: string;
      progress: number;
      taskCount: number;
      status: string;
    }>;
  }>;
  
  getAgentMeshData(): Promise<{
    nodes: Array<{
      id: string;
      name: string;
      type: 'agent' | 'tool' | 'integration';
      status: string;
      capabilities?: string[];
      metadata?: any;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: 'mcp' | 'task' | 'integration';
      weight: number;
    }>;
  }>;

  getIntegrationHealth(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    lastSync: Date | null;
    errorMessage?: string;
    healthScore: number;
  }>>;

  // New methods for enhanced features
  getAgentTasks(agentId: string, limit: number): Promise<Task[]>;
  getIncidents(): Promise<Incident[]>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident>;
  getWorkflows(): Promise<Workflow[]>;
  getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]>;
  getPerformanceMetrics(timeRange: string): Promise<Metric[]>;
  getEvents(params: { page: number; limit: number; type?: string }): Promise<Event[]>;
  getMCPTrace(traceId: string): Promise<Event[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjects(userId?: string): Promise<Project[]> {
    const query = db.select().from(projects);
    if (userId) {
      return await query.where(eq(projects.ownerId, userId)).orderBy(desc(projects.updatedAt));
    }
    return await query.orderBy(desc(projects.updatedAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values([{
      ...project,
      tags: toStringArray(project.tags)
    }]).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjectStats(projectId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    progress: number;
  }> {
    const [stats] = await db
      .select({
        totalTasks: count(),
        completedTasks: count(sql`case when ${tasks.status} = 'completed' then 1 end`),
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const progress = stats.totalTasks > 0 
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;

    return {
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      progress,
    };
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasks(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values([{
      ...task,
      tags: toStringArray(task.tags),
      dependencies: toStringArray(task.dependencies),
      blockingTasks: toStringArray(task.blockingTasks)
    }]).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const updateData = { ...updates, updatedAt: new Date() };
    if (updates.status === 'completed' && !updates.completedAt) {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTasksByAgent(agentName: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.assignedAgent, agentName))
      .orderBy(desc(tasks.createdAt));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(desc(agents.lastSeen));
  }

  async getActiveAgents(): Promise<Agent[]> {
    return await db.select().from(agents)
      .where(eq(agents.status, 'active'))
      .orderBy(desc(agents.lastSeen));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [newAgent] = await db.insert(agents).values([{
      ...agent,
      capabilities: toStringArray(agent.capabilities)
    }]).returning();
    return newAgent;
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    const [updated] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async updateAgentLastSeen(id: string): Promise<void> {
    await db
      .update(agents)
      .set({ lastSeen: new Date() })
      .where(eq(agents.id, id));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values([activity]).returning();
    return newActivity;
  }

  async getActivities(projectId?: string): Promise<Activity[]> {
    const query = db.select().from(activities);
    if (projectId) {
      return await query
        .where(eq(activities.projectId, projectId))
        .orderBy(desc(activities.createdAt));
    }
    return await query.orderBy(desc(activities.createdAt));
  }

  async getRecentActivities(limit = 10): Promise<Activity[]> {
    return await db.select().from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async getIntegrations(): Promise<Integration[]> {
    return await db.select().from(integrations).orderBy(desc(integrations.updatedAt));
  }

  async getIntegration(name: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.name, name));
    return integration;
  }

  async createIntegration(integration: InsertIntegration): Promise<Integration> {
    const [newIntegration] = await db.insert(integrations).values([integration]).returning();
    return newIntegration;
  }

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    const [updated] = await db
      .update(integrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return updated;
  }

  async getMcpTools(): Promise<McpTool[]> {
    return await db.select().from(mcpTools)
      .where(eq(mcpTools.isActive, true))
      .orderBy(desc(mcpTools.updatedAt));
  }

  async createMcpTool(tool: InsertMcpTool): Promise<McpTool> {
    const [newTool] = await db.insert(mcpTools).values([{
      ...tool,
      capabilities: toStringArray(tool.capabilities)
    }]).returning();
    return newTool;
  }

  async updateMcpTool(id: string, updates: Partial<McpTool>): Promise<McpTool> {
    const [updated] = await db
      .update(mcpTools)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mcpTools.id, id))
      .returning();
    return updated;
  }

  async syncMcpTools(tools: InsertMcpTool[]): Promise<void> {
    // Deactivate all current tools
    await db.update(mcpTools).set({ isActive: false });
    
    // Insert or update tools
    for (const tool of tools) {
      const [existing] = await db.select().from(mcpTools)
        .where(and(eq(mcpTools.name, tool.name), eq(mcpTools.version, tool.version || '')));
      
      if (existing) {
        await db.update(mcpTools)
          .set({ 
            ...tool, 
            isActive: true, 
            updatedAt: new Date(),
            capabilities: toStringArray(tool.capabilities)
          })
          .where(eq(mcpTools.id, existing.id));
      } else {
        await db.insert(mcpTools).values([{ 
          ...tool, 
          isActive: true,
          capabilities: toStringArray(tool.capabilities)
        }]);
      }
    }
  }

  // Smart Recommendations
  async getSmartRecommendations(type: string, targetId: string): Promise<SmartRecommendation[]> {
    return await db.select()
      .from(smartRecommendations)
      .where(and(
        eq(smartRecommendations.type, type as any),
        eq(smartRecommendations.targetId, targetId)
      ))
      .orderBy(desc(smartRecommendations.generatedAt));
  }

  async createSmartRecommendation(recommendation: InsertSmartRecommendation): Promise<SmartRecommendation> {
    const [result] = await db.insert(smartRecommendations).values([{
      ...recommendation,
      recommendations: [...recommendation.recommendations]
    }]).returning();
    return result;
  }

  async getRecommendationStats(): Promise<{
    totalRecommendations: number;
    activeRecommendations: number;
    recentGenerations: number;
    ethRegistryEntries: number;
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalResult] = await db.select({ count: count() }).from(smartRecommendations);
    const [activeResult] = await db.select({ count: count() })
      .from(smartRecommendations)
      .where(gt(smartRecommendations.expiresAt, now));
    const [recentResult] = await db.select({ count: count() })
      .from(smartRecommendations)
      .where(gt(smartRecommendations.generatedAt, dayAgo));
    const [ethResult] = await db.select({ count: count() }).from(ethRegistryEntries);

    return {
      totalRecommendations: totalResult.count,
      activeRecommendations: activeResult.count,
      recentGenerations: recentResult.count,
      ethRegistryEntries: ethResult.count
    };
  }

  // ETH Registry
  async getEthRegistryEntries(): Promise<EthRegistryEntry[]> {
    return await db.select().from(ethRegistryEntries).orderBy(desc(ethRegistryEntries.reputation));
  }

  async upsertEthRegistryEntry(entry: InsertEthRegistryEntry): Promise<EthRegistryEntry> {
    const existing = await db.select()
      .from(ethRegistryEntries)
      .where(eq(ethRegistryEntries.address, entry.address));

    if (existing.length > 0) {
      const [result] = await db.update(ethRegistryEntries)
        .set({ 
          ...entry, 
          updatedAt: new Date(),
          capabilities: toStringArray(entry.capabilities),
          tags: toStringArray(entry.tags),
          mcpTools: toStringArray(entry.mcpTools)
        })
        .where(eq(ethRegistryEntries.address, entry.address))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(ethRegistryEntries).values([{
        ...entry,
        capabilities: toStringArray(entry.capabilities),
        tags: toStringArray(entry.tags),
        mcpTools: toStringArray(entry.mcpTools)
      }]).returning();
      return result;
    }
  }

  // Universal PM Board methods
  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }

  async getAgentsByProject(projectId: string): Promise<Agent[]> {
    // Get unique agent names from tasks in this project
    const agentNames = await db.selectDistinct({ name: agents.name })
      .from(agents)
      .innerJoin(tasks, eq(tasks.assignedAgent, agents.name))
      .where(eq(tasks.projectId, projectId));
    
    if (agentNames.length === 0) return [];
    
    return await db.select().from(agents)
      .where(inArray(agents.name, agentNames.map(a => a.name)));
  }

  // Additional methods
  async getUserProjects(userId: string): Promise<Project[]> {
    return await db.select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt));
  }

  // Premium Dashboard Analytics Implementation
  async getDashboardMetrics() {
    // Get basic counts
    const [proj] = await db.select({ total: count() }).from(projects);
    const [activeProj] = await db.select({ total: count() }).from(projects).where(eq(projects.status, 'active'));
    const [task] = await db.select({ total: count() }).from(tasks);
    const [completed] = await db.select({ total: count() }).from(tasks).where(eq(tasks.status, 'completed'));
    const [activeAgents] = await db.select({ total: count() }).from(agents).where(eq(agents.status, 'active'));
    const [ints] = await db.select({ total: count() }).from(integrations);
    const [activeInts] = await db.select({ total: count() }).from(integrations).where(eq(integrations.status, 'active'));

    // Get recent activities
    const recentActivities = await db.select().from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(10);

    // Get agent metrics with task counts
    const taskCounts = db.select({ 
      agentName: tasks.assignedAgent, 
      taskCount: count() 
    }).from(tasks).groupBy(tasks.assignedAgent).as('tc');
    
    const agentRows = await db.select({
      id: agents.id,
      name: agents.name,
      status: agents.status,
      lastSeen: agents.lastSeen,
      taskCount: sql<number>`coalesce(${taskCounts.taskCount}, 0)`
    })
    .from(agents)
    .leftJoin(taskCounts, eq(agents.name, taskCounts.agentName));

    // Get project stats with task counts
    const projCounts = db.select({ 
      projectId: tasks.projectId, 
      taskCount: count(), 
      completed: count(sql`case when ${tasks.status} = 'completed' then 1 end`) 
    }).from(tasks).groupBy(tasks.projectId).as('pc');
    
    const projectRows = await db.select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      taskCount: sql<number>`coalesce(${projCounts.taskCount}, 0)`,
      progress: sql<number>`case when ${projCounts.taskCount} > 0 then round(${projCounts.completed}::decimal / nullif(${projCounts.taskCount}, 0) * 100) else 0 end`
    })
    .from(projects)
    .leftJoin(projCounts, eq(projects.id, projCounts.projectId));

    return {
      totalProjects: proj.total,
      activeProjects: activeProj.total,
      totalTasks: task.total,
      completedTasks: completed.total,
      activeAgents: activeAgents.total,
      totalIntegrations: ints.total,
      activeIntegrations: activeInts.total,
      recentActivities,
      agentMetrics: agentRows,
      projectStats: projectRows
    };
  }

  async getAgentMeshData() {
    // Get nodes from different entity types
    const agentNodes = await db.select().from(agents);
    const toolNodes = await db.select().from(mcpTools);
    const integrationNodes = await db.select().from(integrations);

    const nodes = [
      ...agentNodes.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: 'agent' as const,
        status: agent.status,
        capabilities: agent.capabilities || [],
        metadata: agent.metadata
      })),
      ...toolNodes.map(tool => ({
        id: tool.id,
        name: tool.name,
        type: 'tool' as const,
        status: tool.isActive ? 'active' : 'inactive',
        capabilities: tool.capabilities || [],
        metadata: tool.metadata
      })),
      ...integrationNodes.map(integration => ({
        id: integration.id,
        name: integration.name,
        type: 'integration' as const,
        status: integration.status,
        capabilities: [] as string[],
        metadata: integration.config
      }))
    ];

    // Generate edges based on capability overlap (simplified approach)
    const edges: Array<{
      source: string;
      target: string;
      type: 'mcp' | 'task' | 'integration';
      weight: number;
    }> = [];

    // Add agent-tool connections based on capability overlap
    for (const agent of agentNodes) {
      for (const tool of toolNodes) {
        const agentCaps = agent.capabilities || [];
        const toolCaps = tool.capabilities || [];
        const overlap = agentCaps.filter(cap => toolCaps.includes(cap));
        
        if (overlap.length > 0) {
          edges.push({
            source: agent.id,
            target: tool.id,
            type: 'mcp',
            weight: overlap.length
          });
        }
      }
    }

    return { nodes, edges };
  }

  async getIntegrationHealth() {
    try {
      const integrationRows = await db.select().from(integrations);
      
      return integrationRows.map(integration => {
        // Calculate health score based on status and last sync
        const baseScore = integration.status === 'active' ? 80 : 
                         integration.status === 'inactive' ? 50 : 20;
        
        let recencyBonus = 0;
        if (integration.lastSync) {
          const hoursSinceSync = (Date.now() - integration.lastSync.getTime()) / (1000 * 60 * 60);
          recencyBonus = Math.max(0, 20 - Math.min(20, Math.floor(hoursSinceSync)));
        }
        
        const healthScore = Math.max(0, Math.min(100, baseScore + recencyBonus));

        return {
          id: integration.id,
          name: integration.name,
          type: integration.type,
          status: integration.status,
          lastSync: integration.lastSync,
          errorMessage: integration.errorMessage ?? undefined,
          healthScore
        };
      });
    } catch (error) {
      // If integrations table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('relation "integrations" does not exist')) {
        console.warn('Integrations table does not exist, returning empty array');
        return [];
      }
      throw error;
    }
  }

  // New methods for enhanced features
  async getAgentTasks(agentId: string, limit: number): Promise<Task[]> {
    const agent = await this.getAgent(agentId);
    if (!agent) return [];
    
    return db.select()
      .from(tasks)
      .where(eq(tasks.assignedAgent, agent.name))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
  }

  async getIncidents(): Promise<Incident[]> {
    try {
      return await db.select().from(incidents).orderBy(desc(incidents.createdAt));
    } catch (error) {
      // If incidents table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('relation "incidents" does not exist')) {
        console.warn('Incidents table does not exist, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    const [updated] = await db.update(incidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updated;
  }

  async getWorkflows(): Promise<Workflow[]> {
    return db.select().from(workflows).orderBy(desc(workflows.createdAt));
  }

  async getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    return db.select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId))
      .orderBy(desc(workflowRuns.startedAt));
  }

  async getPerformanceMetrics(timeRange: string): Promise<Metric[]> {
    // Calculate time window based on timeRange
    const now = new Date();
    const startTime = new Date();
    
    switch(timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default:
        startTime.setDate(now.getDate() - 1);
    }

    return db.select()
      .from(metrics)
      .where(gt(metrics.timestamp, startTime))
      .orderBy(desc(metrics.timestamp));
  }

  async getEvents(params: { page: number; limit: number; type?: string }): Promise<Event[]> {
    const offset = (params.page - 1) * params.limit;
    
    let query = db.select().from(events);
    
    if (params.type) {
      query = query.where(eq(events.type, params.type));
    }
    
    return query
      .orderBy(desc(events.timestamp))
      .limit(params.limit)
      .offset(offset);
  }

  async getMCPTrace(traceId: string): Promise<Event[]> {
    return db.select()
      .from(events)
      .where(eq(events.traceId, traceId))
      .orderBy(events.timestamp);
  }
}

export const storage = new DatabaseStorage();
