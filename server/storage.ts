import { 
  users, projects, tasks, agents, activities, integrations, mcpTools, smartRecommendations, ethRegistryEntries,
  type User, type InsertUser, type Project, type InsertProject,
  type Task, type InsertTask, type Agent, type InsertAgent,
  type Activity, type InsertActivity, type Integration, type InsertIntegration,
  type McpTool, type InsertMcpTool, type SmartRecommendation, type InsertSmartRecommendation,
  type EthRegistryEntry, type InsertEthRegistryEntry
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql, count } from "drizzle-orm";

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
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...updates, updatedAt: sql`now()` })
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
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const updateData = { ...updates, updatedAt: sql`now()` };
    if (updates.status === 'completed' && !updates.completedAt) {
      updateData.completedAt = sql`now()`;
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
    const [newAgent] = await db.insert(agents).values(agent).returning();
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
      .set({ lastSeen: sql`now()` })
      .where(eq(agents.id, id));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
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
    const [newIntegration] = await db.insert(integrations).values(integration).returning();
    return newIntegration;
  }

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    const [updated] = await db
      .update(integrations)
      .set({ ...updates, updatedAt: sql`now()` })
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
    const [newTool] = await db.insert(mcpTools).values(tool).returning();
    return newTool;
  }

  async updateMcpTool(id: string, updates: Partial<McpTool>): Promise<McpTool> {
    const [updated] = await db
      .update(mcpTools)
      .set({ ...updates, updatedAt: sql`now()` })
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
          .set({ ...tool, isActive: true, updatedAt: sql`now()` })
          .where(eq(mcpTools.id, existing.id));
      } else {
        await db.insert(mcpTools).values({ ...tool, isActive: true });
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
    const [result] = await db.insert(smartRecommendations).values(recommendation).returning();
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
      .where(sql`expires_at > NOW()`);
    const [recentResult] = await db.select({ count: count() })
      .from(smartRecommendations)
      .where(sql`generated_at > ${dayAgo}`);
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
        .set({ ...entry, updatedAt: sql`NOW()` })
        .where(eq(ethRegistryEntries.address, entry.address))
        .returning();
      return result;
    } else {
      const [result] = await db.insert(ethRegistryEntries).values(entry).returning();
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
    // Get agents that have worked on tasks in this project
    const projectAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        type: agents.type,
        status: agents.status,
        capabilities: agents.capabilities,
        lastSeen: agents.lastSeen,
        sessionId: agents.sessionId,
        metadata: agents.metadata,
        createdAt: agents.createdAt
      })
      .from(agents)
      .innerJoin(tasks, eq(tasks.assignedAgent, agents.name))
      .where(eq(tasks.projectId, projectId))
      .groupBy(agents.id);
    
    return projectAgents;
  }

  // Additional methods
  async getUserProjects(userId: string): Promise<Project[]> {
    return await db.select()
      .from(projects)
      .where(eq(projects.ownerId, userId))
      .orderBy(desc(projects.updatedAt));
  }
}

export const storage = new DatabaseStorage();
