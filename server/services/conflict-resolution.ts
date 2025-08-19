import { db } from '../db';
import { conflicts, tasks, projects, activities, agents } from '../../shared/schema';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
import type { Conflict, Task, Project } from '../../shared/schema';

interface ConflictDetector {
  type: string;
  detect: () => Promise<ConflictData[]>;
}

interface ConflictData {
  type: string;
  affectedAgents: string[];
  projectId?: string;
  taskId?: string;
  data: Record<string, any>;
}

interface ResolutionStrategy {
  type: string;
  resolve: (conflict: Conflict) => Promise<any>;
  canAutoResolve: (conflict: Conflict) => boolean;
}

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;
  private detectors: Map<string, ConflictDetector> = new Map();
  private strategies: Map<string, ResolutionStrategy> = new Map();
  private selfRepairInterval: NodeJS.Timeout | null = null;

  static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  constructor() {
    this.registerDefaultDetectors();
    this.registerDefaultStrategies();
  }

  private registerDefaultDetectors() {
    // Task dependency conflicts
    this.detectors.set('dependency', {
      type: 'dependency_conflict',
      detect: async () => this.detectDependencyConflicts()
    });

    // Resource allocation conflicts
    this.detectors.set('resource', {
      type: 'resource_conflict',
      detect: async () => this.detectResourceConflicts()
    });

    // Schedule conflicts
    this.detectors.set('schedule', {
      type: 'schedule_conflict',
      detect: async () => this.detectScheduleConflicts()
    });

    // Agent assignment conflicts
    this.detectors.set('assignment', {
      type: 'assignment_conflict',
      detect: async () => this.detectAssignmentConflicts()
    });

    // Data consistency conflicts
    this.detectors.set('consistency', {
      type: 'consistency_conflict',
      detect: async () => this.detectConsistencyConflicts()
    });
  }

  private registerDefaultStrategies() {
    // First-come-first-served strategy
    this.strategies.set('fcfs', {
      type: 'fcfs',
      canAutoResolve: (conflict) => conflict.type === 'resource_conflict',
      resolve: async (conflict) => this.resolveFCFS(conflict)
    });

    // Priority-based resolution
    this.strategies.set('priority', {
      type: 'priority',
      canAutoResolve: (conflict) => ['resource_conflict', 'schedule_conflict'].includes(conflict.type),
      resolve: async (conflict) => this.resolvePriority(conflict)
    });

    // AI-suggested resolution
    this.strategies.set('ai_suggested', {
      type: 'ai_suggested',
      canAutoResolve: (conflict) => true,
      resolve: async (conflict) => this.resolveWithAI(conflict)
    });

    // Manual resolution placeholder
    this.strategies.set('manual', {
      type: 'manual',
      canAutoResolve: () => false,
      resolve: async (conflict) => ({ status: 'requires_manual_intervention' })
    });
  }

  async initializeSelfRepair() {
    if (this.selfRepairInterval) {
      clearInterval(this.selfRepairInterval);
    }

    // Run self-repair check every 5 minutes
    this.selfRepairInterval = setInterval(async () => {
      await this.runSelfRepair();
    }, 5 * 60 * 1000);

    // Run initial check
    await this.runSelfRepair();
  }

  async runSelfRepair() {
    try {
      console.log('Running self-repair and conflict detection...');
      
      // Detect new conflicts
      for (const [key, detector] of this.detectors) {
        const detectedConflicts = await detector.detect();
        
        for (const conflictData of detectedConflicts) {
          await this.createConflict(conflictData);
        }
      }

      // Attempt to auto-resolve pending conflicts
      const pendingConflicts = await db
        .select()
        .from(conflicts)
        .where(eq(conflicts.status, 'pending'));

      for (const conflict of pendingConflicts) {
        await this.attemptAutoResolution(conflict);
      }

      console.log(`Self-repair completed. Processed ${pendingConflicts.length} conflicts.`);
    } catch (error) {
      console.error('Error during self-repair:', error);
    }
  }

  private async detectDependencyConflicts(): Promise<ConflictData[]> {
    const allTasks = await db.select().from(tasks);
    const conflicts: ConflictData[] = [];

    for (const task of allTasks) {
      if (!task.dependencies || task.dependencies.length === 0) continue;

      const dependencies = task.dependencies as string[];
      const dependentTasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, dependencies));

      // Check for circular dependencies
      for (const depTask of dependentTasks) {
        const depDependencies = depTask.dependencies as string[] || [];
        if (depDependencies.includes(task.id)) {
          conflicts.push({
            type: 'dependency_conflict',
            taskId: task.id,
            projectId: task.projectId,
            affectedAgents: [task.assignedAgent, depTask.assignedAgent].filter(Boolean) as string[],
            data: {
              circularDependency: true,
              task1: task.id,
              task2: depTask.id,
              task1Title: task.title,
              task2Title: depTask.title
            }
          });
        }
      }

      // Check for blocked dependencies
      const blockedDeps = dependentTasks.filter(t => t.status === 'blocked');
      if (blockedDeps.length > 0 && task.status === 'in_progress') {
        conflicts.push({
          type: 'dependency_conflict',
          taskId: task.id,
          projectId: task.projectId,
          affectedAgents: [task.assignedAgent].filter(Boolean) as string[],
          data: {
            blockedDependencies: true,
            taskId: task.id,
            taskTitle: task.title,
            blockedTasks: blockedDeps.map(t => ({ id: t.id, title: t.title }))
            }
        });
      }
    }

    return conflicts;
  }

  private async detectResourceConflicts(): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];
    
    // Detect multiple agents working on the same task
    const inProgressTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'in_progress'));

    const agentTaskMap = new Map<string, Task[]>();
    
    for (const task of inProgressTasks) {
      if (task.assignedAgent) {
        if (!agentTaskMap.has(task.assignedAgent)) {
          agentTaskMap.set(task.assignedAgent, []);
        }
        agentTaskMap.get(task.assignedAgent)!.push(task);
      }
    }

    // Check for agent overload (more than 3 concurrent tasks)
    for (const [agentName, agentTasks] of agentTaskMap) {
      if (agentTasks.length > 3) {
        conflicts.push({
          type: 'resource_conflict',
          affectedAgents: [agentName],
          data: {
            conflictType: 'agent_overload',
            agent: agentName,
            taskCount: agentTasks.length,
            tasks: agentTasks.map(t => ({ id: t.id, title: t.title, projectId: t.projectId }))
          }
        });
      }
    }

    return conflicts;
  }

  private async detectScheduleConflicts(): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];
    
    const tasksWithDueDates = await db
      .select()
      .from(tasks)
      .where(
        and(
          tasks.dueDate !== null,
          tasks.status !== 'completed'
        )
      );

    const now = new Date();
    
    for (const task of tasksWithDueDates) {
      if (!task.dueDate) continue;
      
      const dueDate = new Date(task.dueDate);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Check if task is overdue
      if (hoursUntilDue < 0) {
        conflicts.push({
          type: 'schedule_conflict',
          taskId: task.id,
          projectId: task.projectId,
          affectedAgents: [task.assignedAgent].filter(Boolean) as string[],
          data: {
            conflictType: 'overdue',
            taskId: task.id,
            taskTitle: task.title,
            dueDate: task.dueDate,
            hoursOverdue: Math.abs(hoursUntilDue)
          }
        });
      }
      // Check if task is at risk (less than 24 hours and not in progress)
      else if (hoursUntilDue < 24 && task.status === 'pending') {
        conflicts.push({
          type: 'schedule_conflict',
          taskId: task.id,
          projectId: task.projectId,
          affectedAgents: [task.assignedAgent].filter(Boolean) as string[],
          data: {
            conflictType: 'at_risk',
            taskId: task.id,
            taskTitle: task.title,
            dueDate: task.dueDate,
            hoursRemaining: hoursUntilDue
          }
        });
      }
    }

    return conflicts;
  }

  private async detectAssignmentConflicts(): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];
    
    // Find tasks that have been pending for too long without assignment
    const unassignedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'pending'),
          isNull(tasks.assignedAgent),
          isNull(tasks.assigneeId)
        )
      );

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    for (const task of unassignedTasks) {
      if (new Date(task.createdAt) < twoDaysAgo) {
        conflicts.push({
          type: 'assignment_conflict',
          taskId: task.id,
          projectId: task.projectId,
          affectedAgents: [],
          data: {
            conflictType: 'unassigned_too_long',
            taskId: task.id,
            taskTitle: task.title,
            createdAt: task.createdAt,
            daysPending: Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          }
        });
      }
    }

    return conflicts;
  }

  private async detectConsistencyConflicts(): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];
    
    // Check for projects with inconsistent progress
    const projectsWithTasks = await db
      .select()
      .from(projects)
      .where(eq(projects.status, 'active'));

    for (const project of projectsWithTasks) {
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, project.id));

      if (projectTasks.length === 0) continue;

      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const actualProgress = Math.round((completedTasks / projectTasks.length) * 100);
      
      if (Math.abs(actualProgress - project.progress) > 10) {
        conflicts.push({
          type: 'consistency_conflict',
          projectId: project.id,
          affectedAgents: [],
          data: {
            conflictType: 'progress_mismatch',
            projectId: project.id,
            projectName: project.name,
            reportedProgress: project.progress,
            actualProgress,
            difference: Math.abs(actualProgress - project.progress)
          }
        });
      }
    }

    return conflicts;
  }

  private async createConflict(conflictData: ConflictData): Promise<void> {
    // Check if similar conflict already exists
    const existingConflicts = await db
      .select()
      .from(conflicts)
      .where(
        and(
          eq(conflicts.type, conflictData.type),
          eq(conflicts.status, 'pending'),
          conflictData.taskId ? eq(conflicts.taskId, conflictData.taskId) : undefined,
          conflictData.projectId ? eq(conflicts.projectId, conflictData.projectId) : undefined
        )
      );

    if (existingConflicts.length > 0) {
      return; // Similar conflict already exists
    }

    await db.insert(conflicts).values({
      type: conflictData.type,
      status: 'pending',
      projectId: conflictData.projectId,
      taskId: conflictData.taskId,
      affectedAgents: conflictData.affectedAgents,
      conflictData: conflictData.data,
      resolutionStrategy: 'automatic'
    });

    await db.insert(activities).values({
      type: 'conflict_detected',
      description: `${conflictData.type} detected`,
      projectId: conflictData.projectId,
      taskId: conflictData.taskId,
      metadata: conflictData.data
    });
  }

  private async attemptAutoResolution(conflict: Conflict): Promise<void> {
    // Try strategies in order of preference
    const strategyOrder = ['ai_suggested', 'priority', 'fcfs', 'manual'];
    
    for (const strategyType of strategyOrder) {
      const strategy = this.strategies.get(strategyType);
      
      if (strategy && strategy.canAutoResolve(conflict)) {
        try {
          const resolution = await strategy.resolve(conflict);
          
          if (resolution.status !== 'requires_manual_intervention') {
            await this.applyResolution(conflict, resolution, strategyType);
            return;
          }
        } catch (error) {
          console.error(`Failed to apply ${strategyType} strategy:`, error);
        }
      }
    }

    // If no auto-resolution worked, escalate
    await this.escalateConflict(conflict);
  }

  private async resolveFCFS(conflict: Conflict): Promise<any> {
    const data = conflict.conflictData as any;
    
    if (conflict.type === 'resource_conflict' && data.conflictType === 'agent_overload') {
      // Pause newer tasks to free up the agent
      const tasks = data.tasks as any[];
      const sortedTasks = tasks.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      const tasksToKeep = sortedTasks.slice(0, 3);
      const tasksToPause = sortedTasks.slice(3);
      
      return {
        action: 'pause_tasks',
        tasksToKeep: tasksToKeep.map((t: any) => t.id),
        tasksToPause: tasksToPause.map((t: any) => t.id),
        resolution: 'Applied first-come-first-served strategy'
      };
    }
    
    return { status: 'requires_manual_intervention' };
  }

  private async resolvePriority(conflict: Conflict): Promise<any> {
    const data = conflict.conflictData as any;
    
    if (conflict.type === 'schedule_conflict' && data.conflictType === 'at_risk') {
      // Increase task priority
      return {
        action: 'increase_priority',
        taskId: data.taskId,
        newPriority: 'urgent',
        resolution: 'Increased task priority due to approaching deadline'
      };
    }
    
    if (conflict.type === 'resource_conflict' && data.conflictType === 'agent_overload') {
      // Reassign lower priority tasks
      const tasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, data.tasks.map((t: any) => t.id)));
      
      const sortedByPriority = tasks.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] || 4);
      });
      
      const highPriorityTasks = sortedByPriority.slice(0, 3);
      const tasksToReassign = sortedByPriority.slice(3);
      
      return {
        action: 'reassign_tasks',
        keepTasks: highPriorityTasks.map(t => t.id),
        reassignTasks: tasksToReassign.map(t => t.id),
        resolution: 'Kept high priority tasks, reassigning others'
      };
    }
    
    return { status: 'requires_manual_intervention' };
  }

  private async resolveWithAI(conflict: Conflict): Promise<any> {
    // Simulate AI-based resolution
    const data = conflict.conflictData as any;
    
    switch (conflict.type) {
      case 'dependency_conflict':
        if (data.circularDependency) {
          return {
            action: 'break_circular_dependency',
            suggestion: 'Remove dependency from task with lower priority',
            task1: data.task1,
            task2: data.task2,
            resolution: 'AI suggests breaking circular dependency'
          };
        }
        break;
        
      case 'consistency_conflict':
        if (data.conflictType === 'progress_mismatch') {
          return {
            action: 'update_progress',
            projectId: data.projectId,
            newProgress: data.actualProgress,
            resolution: 'AI corrected progress mismatch'
          };
        }
        break;
        
      case 'assignment_conflict':
        if (data.conflictType === 'unassigned_too_long') {
          // Find best available agent
          const activeAgents = await db
            .select()
            .from(agents)
            .where(eq(agents.status, 'active'));
          
          if (activeAgents.length > 0) {
            return {
              action: 'auto_assign',
              taskId: data.taskId,
              suggestedAgent: activeAgents[0].name,
              resolution: 'AI assigned task to available agent'
            };
          }
        }
        break;
    }
    
    return { status: 'requires_manual_intervention' };
  }

  private async applyResolution(
    conflict: Conflict,
    resolution: any,
    strategyUsed: string
  ): Promise<void> {
    // Apply the resolution based on the action
    switch (resolution.action) {
      case 'pause_tasks':
        for (const taskId of resolution.tasksToPause) {
          await db
            .update(tasks)
            .set({ status: 'blocked', updatedAt: new Date() })
            .where(eq(tasks.id, taskId));
        }
        break;
        
      case 'increase_priority':
        await db
          .update(tasks)
          .set({ 
            priority: resolution.newPriority,
            priorityScore: 100,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, resolution.taskId));
        break;
        
      case 'update_progress':
        await db
          .update(projects)
          .set({ 
            progress: resolution.newProgress,
            updatedAt: new Date()
          })
          .where(eq(projects.id, resolution.projectId));
        break;
        
      case 'auto_assign':
        await db
          .update(tasks)
          .set({ 
            assignedAgent: resolution.suggestedAgent,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, resolution.taskId));
        break;
    }

    // Update conflict status
    await db
      .update(conflicts)
      .set({
        status: 'resolved',
        resolution: resolution,
        resolutionStrategy: strategyUsed,
        resolvedBy: 'system',
        resolvedAt: new Date()
      })
      .where(eq(conflicts.id, conflict.id));

    // Log activity
    await db.insert(activities).values({
      type: 'conflict_resolved',
      description: `${conflict.type} resolved using ${strategyUsed} strategy`,
      projectId: conflict.projectId,
      taskId: conflict.taskId,
      metadata: {
        conflictId: conflict.id,
        resolution,
        strategyUsed
      }
    });
  }

  private async escalateConflict(conflict: Conflict): Promise<void> {
    await db
      .update(conflicts)
      .set({
        status: 'escalated',
        resolutionStrategy: 'manual'
      })
      .where(eq(conflicts.id, conflict.id));

    await db.insert(activities).values({
      type: 'conflict_escalated',
      description: `${conflict.type} escalated for manual resolution`,
      projectId: conflict.projectId,
      taskId: conflict.taskId,
      metadata: {
        conflictId: conflict.id,
        conflictData: conflict.conflictData
      }
    });
  }

  async getConflicts(
    status?: string,
    projectId?: string
  ): Promise<Conflict[]> {
    let query = db.select().from(conflicts);
    
    const conditions = [];
    if (status) conditions.push(eq(conflicts.status, status));
    if (projectId) conditions.push(eq(conflicts.projectId, projectId));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async resolveConflictManually(
    conflictId: string,
    resolution: any,
    resolvedBy: string
  ): Promise<void> {
    await db
      .update(conflicts)
      .set({
        status: 'resolved',
        resolution,
        resolutionStrategy: 'manual',
        resolvedBy,
        resolvedAt: new Date()
      })
      .where(eq(conflicts.id, conflictId));

    const [conflict] = await db
      .select()
      .from(conflicts)
      .where(eq(conflicts.id, conflictId));

    if (conflict) {
      await db.insert(activities).values({
        type: 'conflict_resolved_manually',
        description: `${conflict.type} resolved manually`,
        projectId: conflict.projectId,
        taskId: conflict.taskId,
        metadata: {
          conflictId,
          resolution,
          resolvedBy
        }
      });
    }
  }

  stop() {
    if (this.selfRepairInterval) {
      clearInterval(this.selfRepairInterval);
      this.selfRepairInterval = null;
    }
  }
}