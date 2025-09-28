import {
  users,
  tasks,
  energyLogs,
  celebrations,
  autoActivities,
  connectedServices,
  agentActions,
  automationRules,
  transitionRituals,
  transitionSessions,
  focusSessions,
  timeEstimates,
  decisionSupport,
  userPatterns,
  smartSuggestions,
  contextualNudges,
  type User,
  type UpsertUser,
  type Task,
  type InsertTask,
  type EnergyLog,
  type InsertEnergyLog,
  type Celebration,
  type InsertCelebration,
  type AutoActivity,
  type InsertAutoActivity,
  type ConnectedService,
  type InsertConnectedService,
  type AgentAction,
  type InsertAgentAction,
  type AutomationRule,
  type InsertAutomationRule,
  type TransitionRitual,
  type InsertTransitionRitual,
  type TransitionSession,
  type InsertTransitionSession,
  type FocusSession,
  type InsertFocusSession,
  type TimeEstimate,
  type InsertTimeEstimate,
  type DecisionSupport,
  type InsertDecisionSupport,
  type UserPattern,
  type InsertUserPattern,
  type SmartSuggestion,
  type InsertSmartSuggestion,
  type ContextualNudge,
  type InsertContextualNudge,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Task operations
  getTasks(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  completeTask(id: string): Promise<Task>;
  
  // Energy tracking operations
  getEnergyLogs(userId: string, limit?: number): Promise<EnergyLog[]>;
  createEnergyLog(energyLog: InsertEnergyLog): Promise<EnergyLog>;
  getCurrentEnergyLevel(userId: string): Promise<string>;
  
  // Celebration operations
  getCelebrations(userId: string, limit?: number): Promise<Celebration[]>;
  createCelebration(celebration: InsertCelebration): Promise<Celebration>;
  
  // Auto-activity operations
  getAutoActivities(userId: string): Promise<AutoActivity[]>;
  createAutoActivity(activity: InsertAutoActivity): Promise<AutoActivity>;
  updateAutoActivity(id: string, updates: Partial<AutoActivity>): Promise<AutoActivity>;
  
  // Analytics
  getTaskCompletionStreak(userId: string): Promise<number>;
  getTodaysWins(userId: string): Promise<{ tasks: Task[], celebrations: Celebration[] }>;
  
  // Connected services operations
  getConnectedServices(userId: string): Promise<ConnectedService[]>;
  createConnectedService(service: InsertConnectedService): Promise<ConnectedService>;
  updateConnectedService(id: string, updates: Partial<ConnectedService>): Promise<ConnectedService>;
  deleteConnectedService(id: string): Promise<void>;
  
  // Agent actions operations
  getAgentActions(userId: string, limit?: number): Promise<AgentAction[]>;
  createAgentAction(action: InsertAgentAction): Promise<AgentAction>;
  updateAgentAction(id: string, updates: Partial<AgentAction>): Promise<AgentAction>;
  approveAgentAction(id: string): Promise<AgentAction>;
  rejectAgentAction(id: string): Promise<AgentAction>;
  
  // Automation rules operations
  getAutomationRules(userId: string, ruleType?: string): Promise<AutomationRule[]>;
  createAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: string, updates: Partial<AutomationRule>): Promise<AutomationRule>;
  deleteAutomationRule(id: string): Promise<void>;

  // Transition rituals operations
  getTransitionRituals(userId: string, ritualType?: string): Promise<TransitionRitual[]>;
  createTransitionRitual(ritual: InsertTransitionRitual): Promise<TransitionRitual>;
  updateTransitionRitual(id: string, updates: Partial<TransitionRitual>): Promise<TransitionRitual>;
  deleteTransitionRitual(id: string): Promise<void>;
  getTransitionRitual(id: string): Promise<TransitionRitual | undefined>;

  // Transition sessions operations
  createTransitionSession(session: InsertTransitionSession): Promise<TransitionSession>;
  updateTransitionSession(id: string, updates: Partial<TransitionSession>): Promise<TransitionSession>;
  getTransitionSessions(userId: string, limit?: number): Promise<TransitionSession[]>;
  getActiveTransitionSession(userId: string): Promise<TransitionSession | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Task operations
  async getTasks(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.isCompleted, false)))
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async completeTask(id: string): Promise<Task> {
    const [completedTask] = await db
      .update(tasks)
      .set({ 
        isCompleted: true, 
        completedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(tasks.id, id))
      .returning();
    
    // Create a celebration for task completion
    await this.createCelebration({
      userId: completedTask.userId,
      title: `Completed: ${completedTask.title}`,
      description: "Great job finishing this task!",
      type: "task_completed",
      isAutoGenerated: true,
    });
    
    return completedTask;
  }

  // Energy tracking operations
  async getEnergyLogs(userId: string, limit = 10): Promise<EnergyLog[]> {
    return await db
      .select()
      .from(energyLogs)
      .where(eq(energyLogs.userId, userId))
      .orderBy(desc(energyLogs.timestamp))
      .limit(limit);
  }

  async createEnergyLog(energyLog: InsertEnergyLog): Promise<EnergyLog> {
    const [newLog] = await db.insert(energyLogs).values(energyLog).returning();
    return newLog;
  }

  async getCurrentEnergyLevel(userId: string): Promise<string> {
    const [latestLog] = await db
      .select()
      .from(energyLogs)
      .where(eq(energyLogs.userId, userId))
      .orderBy(desc(energyLogs.timestamp))
      .limit(1);
    
    return latestLog?.energyLevel || "medium";
  }

  // Celebration operations
  async getCelebrations(userId: string, limit = 10): Promise<Celebration[]> {
    return await db
      .select()
      .from(celebrations)
      .where(eq(celebrations.userId, userId))
      .orderBy(desc(celebrations.createdAt))
      .limit(limit);
  }

  async createCelebration(celebration: InsertCelebration): Promise<Celebration> {
    const [newCelebration] = await db.insert(celebrations).values(celebration).returning();
    return newCelebration;
  }

  // Auto-activity operations
  async getAutoActivities(userId: string): Promise<AutoActivity[]> {
    return await db
      .select()
      .from(autoActivities)
      .where(eq(autoActivities.userId, userId))
      .orderBy(desc(autoActivities.updatedAt));
  }

  async createAutoActivity(activity: InsertAutoActivity): Promise<AutoActivity> {
    const [newActivity] = await db.insert(autoActivities).values(activity).returning();
    return newActivity;
  }

  async updateAutoActivity(id: string, updates: Partial<AutoActivity>): Promise<AutoActivity> {
    const [updatedActivity] = await db
      .update(autoActivities)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(autoActivities.id, id))
      .returning();
    return updatedActivity;
  }

  // Analytics
  async getTaskCompletionStreak(userId: string): Promise<number> {
    // This is a simplified version - in production, you'd want more sophisticated streak calculation
    const completedTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.isCompleted, true),
        gte(tasks.completedAt, sql`NOW() - INTERVAL '7 days'`)
      ));
    
    return completedTasks.length;
  }

  async getTodaysWins(userId: string): Promise<{ tasks: Task[], celebrations: Celebration[] }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const completedTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.isCompleted, true),
        gte(tasks.completedAt, today)
      ));
    
    const todaysCelebrations = await db
      .select()
      .from(celebrations)
      .where(and(
        eq(celebrations.userId, userId),
        gte(celebrations.createdAt, today)
      ))
      .orderBy(desc(celebrations.createdAt));
    
    return {
      tasks: completedTasks,
      celebrations: todaysCelebrations,
    };
  }

  // Connected services operations
  async getConnectedServices(userId: string): Promise<ConnectedService[]> {
    return await db
      .select()
      .from(connectedServices)
      .where(eq(connectedServices.userId, userId))
      .orderBy(desc(connectedServices.createdAt));
  }

  async createConnectedService(service: InsertConnectedService): Promise<ConnectedService> {
    const [newService] = await db.insert(connectedServices).values(service).returning();
    return newService;
  }

  async updateConnectedService(id: string, updates: Partial<ConnectedService>): Promise<ConnectedService> {
    const [updatedService] = await db
      .update(connectedServices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(connectedServices.id, id))
      .returning();
    return updatedService;
  }

  async deleteConnectedService(id: string): Promise<void> {
    await db.delete(connectedServices).where(eq(connectedServices.id, id));
  }

  // Agent actions operations
  async getAgentActions(userId: string, limit = 50): Promise<AgentAction[]> {
    return await db
      .select()
      .from(agentActions)
      .where(eq(agentActions.userId, userId))
      .orderBy(desc(agentActions.createdAt))
      .limit(limit);
  }

  async createAgentAction(action: InsertAgentAction): Promise<AgentAction> {
    const [newAction] = await db.insert(agentActions).values(action).returning();
    return newAction;
  }

  async updateAgentAction(id: string, updates: Partial<AgentAction>): Promise<AgentAction> {
    const [updatedAction] = await db
      .update(agentActions)
      .set(updates)
      .where(eq(agentActions.id, id))
      .returning();
    return updatedAction;
  }

  async approveAgentAction(id: string): Promise<AgentAction> {
    const [approvedAction] = await db
      .update(agentActions)
      .set({ isApproved: true })
      .where(eq(agentActions.id, id))
      .returning();
    return approvedAction;
  }

  async rejectAgentAction(id: string): Promise<AgentAction> {
    const [rejectedAction] = await db
      .update(agentActions)
      .set({ isApproved: false })
      .where(eq(agentActions.id, id))
      .returning();
    return rejectedAction;
  }

  // Automation rules operations
  async getAutomationRules(userId: string, ruleType?: string): Promise<AutomationRule[]> {
    const query = db
      .select()
      .from(automationRules)
      .where(eq(automationRules.userId, userId));
    
    if (ruleType) {
      query.where(eq(automationRules.ruleType, ruleType as any));
    }
    
    return await query.orderBy(desc(automationRules.createdAt));
  }

  async createAutomationRule(rule: InsertAutomationRule): Promise<AutomationRule> {
    const [newRule] = await db.insert(automationRules).values(rule).returning();
    return newRule;
  }

  async updateAutomationRule(id: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    const [updatedRule] = await db
      .update(automationRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(automationRules.id, id))
      .returning();
    return updatedRule;
  }

  // Transition rituals operations
  async getTransitionRituals(userId: string, ritualType?: string): Promise<TransitionRitual[]> {
    const query = db
      .select()
      .from(transitionRituals)
      .where(eq(transitionRituals.userId, userId));
    
    if (ritualType) {
      query.where(eq(transitionRituals.ritualType, ritualType));
    }
    
    return await query.orderBy(desc(transitionRituals.createdAt));
  }

  async createTransitionRitual(ritualData: InsertTransitionRitual): Promise<TransitionRitual> {
    const [ritual] = await db
      .insert(transitionRituals)
      .values(ritualData)
      .returning();
    return ritual;
  }

  async updateTransitionRitual(id: string, updates: Partial<InsertTransitionRitual>): Promise<TransitionRitual> {
    const [ritual] = await db
      .update(transitionRituals)
      .set(updates)
      .where(eq(transitionRituals.id, id))
      .returning();
    return ritual;
  }

  async deleteTransitionRitual(id: string): Promise<void> {
    await db.delete(transitionRituals).where(eq(transitionRituals.id, id));
  }

  // Transition sessions operations
  async createTransitionSession(sessionData: InsertTransitionSession): Promise<TransitionSession> {
    const [session] = await db
      .insert(transitionSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateTransitionSession(id: string, updates: Partial<InsertTransitionSession>): Promise<TransitionSession> {
    const [session] = await db
      .update(transitionSessions)
      .set(updates)
      .where(eq(transitionSessions.id, id))
      .returning();
    return session;
  }

  async getActiveTransitionSession(userId: string): Promise<TransitionSession | undefined> {
    const [session] = await db
      .select()
      .from(transitionSessions)
      .where(and(
        eq(transitionSessions.userId, userId),
        isNull(transitionSessions.completedAt)
      ))
      .orderBy(desc(transitionSessions.startedAt))
      .limit(1);
    return session;
  }

  // Executive Function Support operations
  async getCurrentFocusSession(userId: string): Promise<FocusSession | undefined> {
    const [session] = await db
      .select()
      .from(focusSessions)
      .where(and(
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt)
      ))
      .orderBy(desc(focusSessions.startedAt))
      .limit(1);
    return session;
  }

  async createFocusSession(sessionData: InsertFocusSession): Promise<FocusSession> {
    const [session] = await db
      .insert(focusSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async endFocusSession(userId: string, updates: Partial<FocusSession>): Promise<FocusSession> {
    const [session] = await db
      .update(focusSessions)
      .set({ ...updates, endedAt: new Date() })
      .where(and(
        eq(focusSessions.userId, userId),
        isNull(focusSessions.endedAt)
      ))
      .returning();
    return session;
  }

  async getTimeEstimates(userId: string, limit = 10): Promise<TimeEstimate[]> {
    return await db
      .select()
      .from(timeEstimates)
      .where(eq(timeEstimates.userId, userId))
      .orderBy(desc(timeEstimates.createdAt))
      .limit(limit);
  }

  async createTimeEstimate(estimateData: InsertTimeEstimate): Promise<TimeEstimate> {
    const [estimate] = await db
      .insert(timeEstimates)
      .values(estimateData)
      .returning();
    return estimate;
  }

  async getRecentDecisions(userId: string, limit = 5): Promise<DecisionSupport[]> {
    return await db
      .select()
      .from(decisionSupport)
      .where(eq(decisionSupport.userId, userId))
      .orderBy(desc(decisionSupport.createdAt))
      .limit(limit);
  }

  async createDecision(decisionData: InsertDecisionSupport): Promise<DecisionSupport> {
    const [decision] = await db
      .insert(decisionSupport)
      .values(decisionData)
      .returning();
    return decision;
  }

  async updateDecision(id: string, updates: Partial<DecisionSupport>): Promise<DecisionSupport> {
    const [decision] = await db
      .update(decisionSupport)
      .set(updates)
      .where(eq(decisionSupport.id, id))
      .returning();
    return decision;
  }

  // Smart Automation operations
  async getUserPatterns(userId: string, patternType?: string): Promise<UserPattern[]> {
    const query = db
      .select()
      .from(userPatterns)
      .where(eq(userPatterns.userId, userId));
    
    if (patternType) {
      query.where(eq(userPatterns.patternType, patternType));
    }
    
    return await query.orderBy(desc(userPatterns.confidence));
  }

  async createUserPattern(patternData: InsertUserPattern): Promise<UserPattern> {
    const [pattern] = await db
      .insert(userPatterns)
      .values(patternData)
      .returning();
    return pattern;
  }

  async updateUserPattern(id: string, updates: Partial<UserPattern>): Promise<UserPattern> {
    const [pattern] = await db
      .update(userPatterns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userPatterns.id, id))
      .returning();
    return pattern;
  }

  async getSmartSuggestions(userId: string, limit = 5): Promise<SmartSuggestion[]> {
    return await db
      .select()
      .from(smartSuggestions)
      .where(and(
        eq(smartSuggestions.userId, userId),
        eq(smartSuggestions.isAcknowledged, false),
        or(
          isNull(smartSuggestions.expiresAt),
          gte(smartSuggestions.expiresAt, new Date())
        )
      ))
      .orderBy(desc(smartSuggestions.priority), desc(smartSuggestions.createdAt))
      .limit(limit);
  }

  async createSmartSuggestion(suggestionData: InsertSmartSuggestion): Promise<SmartSuggestion> {
    const [suggestion] = await db
      .insert(smartSuggestions)
      .values(suggestionData)
      .returning();
    return suggestion;
  }

  async acknowledgeSuggestion(id: string, wasHelpful?: boolean): Promise<SmartSuggestion> {
    const [suggestion] = await db
      .update(smartSuggestions)
      .set({ isAcknowledged: true, wasHelpful })
      .where(eq(smartSuggestions.id, id))
      .returning();
    return suggestion;
  }

  async getContextualNudges(userId: string, triggerType?: string): Promise<ContextualNudge[]> {
    const query = db
      .select()
      .from(contextualNudges)
      .where(eq(contextualNudges.userId, userId));
    
    if (triggerType) {
      query.where(eq(contextualNudges.triggerType, triggerType));
    }
    
    return await query.orderBy(desc(contextualNudges.createdAt));
  }

  async createContextualNudge(nudgeData: InsertContextualNudge): Promise<ContextualNudge> {
    const [nudge] = await db
      .insert(contextualNudges)
      .values(nudgeData)
      .returning();
    return nudge;
  }

  async deleteAutomationRule(id: string): Promise<void> {
    await db.delete(automationRules).where(eq(automationRules.id, id));
  }

  // Transition rituals operations
  async getTransitionRituals(userId: string, ritualType?: string): Promise<TransitionRitual[]> {
    let query = db
      .select()
      .from(transitionRituals)
      .where(eq(transitionRituals.userId, userId));
    
    if (ritualType) {
      query = query.where(eq(transitionRituals.ritualType, ritualType as any));
    }
    
    return await query.orderBy(desc(transitionRituals.createdAt));
  }

  async createTransitionRitual(ritual: InsertTransitionRitual): Promise<TransitionRitual> {
    const [newRitual] = await db.insert(transitionRituals).values(ritual).returning();
    return newRitual;
  }

  async updateTransitionRitual(id: string, updates: Partial<TransitionRitual>): Promise<TransitionRitual> {
    const [updatedRitual] = await db
      .update(transitionRituals)
      .set(updates)
      .where(eq(transitionRituals.id, id))
      .returning();
    return updatedRitual;
  }

  async deleteTransitionRitual(id: string): Promise<void> {
    await db.delete(transitionRituals).where(eq(transitionRituals.id, id));
  }

  async getTransitionRitual(id: string): Promise<TransitionRitual | undefined> {
    const [ritual] = await db.select().from(transitionRituals).where(eq(transitionRituals.id, id));
    return ritual;
  }

  // Transition sessions operations
  async createTransitionSession(session: InsertTransitionSession): Promise<TransitionSession> {
    const [newSession] = await db.insert(transitionSessions).values(session).returning();
    return newSession;
  }

  async updateTransitionSession(id: string, updates: Partial<TransitionSession>): Promise<TransitionSession> {
    const [updatedSession] = await db
      .update(transitionSessions)
      .set(updates)
      .where(eq(transitionSessions.id, id))
      .returning();
    return updatedSession;
  }

  async getTransitionSessions(userId: string, limit: number = 20): Promise<TransitionSession[]> {
    return await db
      .select()
      .from(transitionSessions)
      .where(eq(transitionSessions.userId, userId))
      .orderBy(desc(transitionSessions.startedAt))
      .limit(limit);
  }

  async getActiveTransitionSession(userId: string): Promise<TransitionSession | undefined> {
    const [session] = await db
      .select()
      .from(transitionSessions)
      .where(and(
        eq(transitionSessions.userId, userId),
        eq(transitionSessions.completedAt, null as any)
      ))
      .orderBy(desc(transitionSessions.startedAt))
      .limit(1);
    return session;
  }
}

export const storage = new DatabaseStorage();
