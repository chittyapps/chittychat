import { db } from '../db';
import { tasks, projects, agents, activities } from '../../shared/schema';
import { eq, and, or, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import type { Task, Project } from '../../shared/schema';

interface PriorityFactors {
  urgency: number;
  importance: number;
  effort: number;
  dependencies: number;
  businessValue: number;
  risk: number;
  agentAvailability: number;
}

interface ScheduleSlot {
  startTime: Date;
  endTime: Date;
  taskId?: string;
  agentId?: string;
  confidence: number;
}

export class TaskPrioritizationService {
  private static instance: TaskPrioritizationService;
  private prioritizationInterval: NodeJS.Timeout | null = null;
  private scheduleCache: Map<string, ScheduleSlot[]> = new Map();

  static getInstance(): TaskPrioritizationService {
    if (!TaskPrioritizationService.instance) {
      TaskPrioritizationService.instance = new TaskPrioritizationService();
    }
    return TaskPrioritizationService.instance;
  }

  async initializeSmartScheduling() {
    await this.recalculateAllPriorities();
    await this.generateOptimalSchedule();

    if (this.prioritizationInterval) {
      clearInterval(this.prioritizationInterval);
    }

    // Recalculate priorities every 15 minutes
    this.prioritizationInterval = setInterval(async () => {
      await this.recalculateAllPriorities();
      await this.generateOptimalSchedule();
    }, 15 * 60 * 1000);
  }

  async recalculateAllPriorities(): Promise<void> {
    try {
      console.log('Recalculating task priorities...');
      
      const allTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            tasks.status !== 'completed',
            tasks.status !== 'cancelled'
          )
        );

      for (const task of allTasks) {
        const priorityScore = await this.calculatePriorityScore(task);
        
        // Update task with new priority score
        await db
          .update(tasks)
          .set({
            priorityScore,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.id));
      }

      console.log(`Updated priorities for ${allTasks.length} tasks`);
    } catch (error) {
      console.error('Error recalculating priorities:', error);
    }
  }

  async calculatePriorityScore(task: Task): Promise<number> {
    const factors = await this.analyzePriorityFactors(task);
    
    // Weighted scoring algorithm
    const weights = {
      urgency: 0.25,
      importance: 0.20,
      effort: 0.10,
      dependencies: 0.15,
      businessValue: 0.15,
      risk: 0.10,
      agentAvailability: 0.05
    };

    let score = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      score += factors[factor as keyof PriorityFactors] * weight;
    }

    // Apply priority boost based on task priority level
    const priorityMultipliers = {
      urgent: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.8,
      critical: 2.0
    };

    score *= priorityMultipliers[task.priority as keyof typeof priorityMultipliers] || 1.0;

    // Normalize to 0-100 scale
    return Math.min(Math.round(score * 100), 100);
  }

  private async analyzePriorityFactors(task: Task): Promise<PriorityFactors> {
    const now = new Date();
    
    // Urgency: Based on due date
    let urgency = 0.5;
    if (task.dueDate) {
      const hoursUntilDue = (new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        urgency = 1.0; // Overdue
      } else if (hoursUntilDue < 24) {
        urgency = 0.9;
      } else if (hoursUntilDue < 72) {
        urgency = 0.7;
      } else if (hoursUntilDue < 168) {
        urgency = 0.5;
      } else {
        urgency = 0.3;
      }
    }

    // Importance: Based on project status and task category
    let importance = 0.5;
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .limit(1);

    if (project) {
      if (project.lifecycleStage === 'review' || project.lifecycleStage === 'testing') {
        importance += 0.2;
      }
      if (project.collaborationScore && project.collaborationScore > 70) {
        importance += 0.1;
      }
    }

    if (task.category === 'bug' || task.category === 'security') {
      importance += 0.3;
    } else if (task.category === 'feature') {
      importance += 0.1;
    }

    importance = Math.min(importance, 1.0);

    // Effort: Based on estimated hours
    let effort = 0.5;
    if (task.estimatedHours) {
      if (task.estimatedHours <= 1) {
        effort = 0.9; // Quick wins
      } else if (task.estimatedHours <= 4) {
        effort = 0.7;
      } else if (task.estimatedHours <= 8) {
        effort = 0.5;
      } else {
        effort = 0.3;
      }
    }

    // Dependencies: Check blocking and blocked tasks
    const dependencies = task.dependencies as string[] || [];
    const blockingTasks = task.blockingTasks as string[] || [];
    
    let dependencyFactor = 0.5;
    if (dependencies.length === 0 && blockingTasks.length > 0) {
      dependencyFactor = 0.8; // Unblocks other tasks
    } else if (dependencies.length > 0) {
      // Check if dependencies are completed
      const depTasks = await db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, dependencies));
      
      const completedDeps = depTasks.filter(t => t.status === 'completed').length;
      dependencyFactor = completedDeps / dependencies.length;
    }

    // Business Value: Inferred from project and task metadata
    let businessValue = 0.5;
    const metadata = task.metadata as any || {};
    if (metadata.businessValue) {
      businessValue = metadata.businessValue / 100;
    } else if (project) {
      // Infer from project progress and status
      if (project.progress > 80) {
        businessValue = 0.7; // Near completion tasks are valuable
      }
    }

    // Risk: Based on task age and blockers
    let risk = 0.3;
    const taskAge = (now.getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (taskAge > 7 && task.status === 'pending') {
      risk = 0.7;
    } else if (taskAge > 14) {
      risk = 0.9;
    }
    if (task.status === 'blocked') {
      risk = Math.min(risk + 0.3, 1.0);
    }

    // Agent Availability
    let agentAvailability = 0.5;
    if (task.assignedAgent) {
      const agentTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.assignedAgent, task.assignedAgent),
            eq(tasks.status, 'in_progress')
          )
        );
      
      if (agentTasks.length === 0) {
        agentAvailability = 1.0;
      } else if (agentTasks.length < 3) {
        agentAvailability = 0.7;
      } else {
        agentAvailability = 0.3;
      }
    }

    return {
      urgency,
      importance,
      effort,
      dependencies: dependencyFactor,
      businessValue,
      risk,
      agentAvailability
    };
  }

  async generateOptimalSchedule(): Promise<void> {
    try {
      console.log('Generating optimal task schedule...');
      
      // Get all active agents
      const activeAgents = await db
        .select()
        .from(agents)
        .where(eq(agents.status, 'active'));

      // Get high-priority unscheduled tasks
      const unscheduledTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            tasks.status === 'pending',
            tasks.autoScheduled !== true
          )
        )
        .orderBy(desc(tasks.priorityScore));

      // Clear existing schedule
      this.scheduleCache.clear();

      // Generate schedule for each agent
      for (const agent of activeAgents) {
        const agentSchedule = await this.generateAgentSchedule(
          agent.id,
          agent.name,
          unscheduledTasks.filter(t => 
            !t.assignedAgent || t.assignedAgent === agent.name
          )
        );
        
        this.scheduleCache.set(agent.id, agentSchedule);
      }

      // Apply schedule to tasks
      await this.applySchedule();
      
      console.log('Schedule generation completed');
    } catch (error) {
      console.error('Error generating schedule:', error);
    }
  }

  private async generateAgentSchedule(
    agentId: string,
    agentName: string,
    availableTasks: Task[]
  ): Promise<ScheduleSlot[]> {
    const schedule: ScheduleSlot[] = [];
    const now = new Date();
    let currentTime = new Date(now);
    
    // Get agent's current workload
    const inProgressTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedAgent, agentName),
          eq(tasks.status, 'in_progress')
        )
      );

    // Account for in-progress tasks
    for (const task of inProgressTasks) {
      const estimatedHours = task.estimatedHours || 4;
      const endTime = new Date(currentTime.getTime() + estimatedHours * 60 * 60 * 1000);
      
      schedule.push({
        startTime: new Date(currentTime),
        endTime,
        taskId: task.id,
        agentId,
        confidence: 0.9
      });
      
      currentTime = endTime;
    }

    // Schedule new tasks using bin packing algorithm
    const sortedTasks = await this.sortTasksForScheduling(availableTasks);
    
    for (const task of sortedTasks) {
      // Check dependencies
      if (!(await this.areDependenciesSatisfied(task))) {
        continue;
      }

      const estimatedHours = task.estimatedHours || 4;
      const startTime = new Date(currentTime);
      const endTime = new Date(startTime.getTime() + estimatedHours * 60 * 60 * 1000);
      
      // Check if task fits before due date
      if (task.dueDate && endTime > new Date(task.dueDate)) {
        // Try to fit it earlier in the schedule
        const earlierSlot = this.findEarlierSlot(schedule, estimatedHours, task.dueDate);
        if (earlierSlot) {
          schedule.push({
            ...earlierSlot,
            taskId: task.id,
            agentId,
            confidence: 0.7
          });
          continue;
        }
      }

      // Add to schedule
      schedule.push({
        startTime,
        endTime,
        taskId: task.id,
        agentId,
        confidence: this.calculateScheduleConfidence(task, startTime, endTime)
      });
      
      currentTime = endTime;
      
      // Limit schedule to 1 week ahead
      if (currentTime.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) {
        break;
      }
    }

    return schedule;
  }

  private async sortTasksForScheduling(tasks: Task[]): Promise<Task[]> {
    // Multi-criteria sorting for optimal scheduling
    return tasks.sort((a, b) => {
      // First by priority score
      const priorityDiff = (b.priorityScore || 0) - (a.priorityScore || 0);
      if (Math.abs(priorityDiff) > 10) return priorityDiff;
      
      // Then by due date
      if (a.dueDate && b.dueDate) {
        const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dueDiff !== 0) return dueDiff;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }
      
      // Then by estimated effort (prefer quick wins)
      const effortA = a.estimatedHours || 4;
      const effortB = b.estimatedHours || 4;
      return effortA - effortB;
    });
  }

  private async areDependenciesSatisfied(task: Task): Promise<boolean> {
    const dependencies = task.dependencies as string[] || [];
    if (dependencies.length === 0) return true;

    const depTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, dependencies));

    return depTasks.every(t => 
      t.status === 'completed' || 
      this.isTaskScheduledBefore(t.id, task.id)
    );
  }

  private isTaskScheduledBefore(taskId1: string, taskId2: string): boolean {
    for (const [, schedule] of this.scheduleCache) {
      const slot1 = schedule.find(s => s.taskId === taskId1);
      const slot2 = schedule.find(s => s.taskId === taskId2);
      
      if (slot1 && slot2) {
        return slot1.endTime <= slot2.startTime;
      }
    }
    return false;
  }

  private findEarlierSlot(
    schedule: ScheduleSlot[],
    durationHours: number,
    dueDate: string
  ): ScheduleSlot | null {
    const dueDateObj = new Date(dueDate);
    const duration = durationHours * 60 * 60 * 1000;
    
    // Look for gaps in the schedule
    for (let i = 0; i < schedule.length - 1; i++) {
      const gap = schedule[i + 1].startTime.getTime() - schedule[i].endTime.getTime();
      
      if (gap >= duration) {
        const startTime = schedule[i].endTime;
        const endTime = new Date(startTime.getTime() + duration);
        
        if (endTime <= dueDateObj) {
          return { startTime, endTime, confidence: 0.6 };
        }
      }
    }
    
    // Check if it can fit before the first task
    if (schedule.length > 0) {
      const firstTask = schedule[0];
      const now = new Date();
      const availableTime = firstTask.startTime.getTime() - now.getTime();
      
      if (availableTime >= duration) {
        const endTime = new Date(now.getTime() + duration);
        if (endTime <= dueDateObj) {
          return { startTime: now, endTime, confidence: 0.5 };
        }
      }
    }
    
    return null;
  }

  private calculateScheduleConfidence(
    task: Task,
    startTime: Date,
    endTime: Date
  ): number {
    let confidence = 0.7; // Base confidence
    
    // Adjust based on how well it fits constraints
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const buffer = dueDate.getTime() - endTime.getTime();
      
      if (buffer < 0) {
        confidence -= 0.3; // Doesn't meet deadline
      } else if (buffer < 24 * 60 * 60 * 1000) {
        confidence -= 0.1; // Tight deadline
      } else {
        confidence += 0.1; // Comfortable buffer
      }
    }
    
    // Adjust based on priority
    if (task.priorityScore && task.priorityScore > 80) {
      confidence += 0.1;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async applySchedule(): Promise<void> {
    const updates: Promise<any>[] = [];
    
    for (const [agentId, schedule] of this.scheduleCache) {
      for (const slot of schedule) {
        if (slot.taskId && slot.confidence > 0.5) {
          // Get agent name
          const [agent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, agentId))
            .limit(1);

          if (agent) {
            updates.push(
              db
                .update(tasks)
                .set({
                  assignedAgent: agent.name,
                  autoScheduled: true,
                  metadata: sql`
                    COALESCE(${tasks.metadata}, '{}'::jsonb) || 
                    jsonb_build_object(
                      'scheduledStart', ${slot.startTime.toISOString()},
                      'scheduledEnd', ${slot.endTime.toISOString()},
                      'scheduleConfidence', ${slot.confidence}
                    )
                  `,
                  updatedAt: new Date()
                })
                .where(eq(tasks.id, slot.taskId))
            );
          }
        }
      }
    }
    
    await Promise.all(updates);
  }

  async getTaskSchedule(taskId: string): Promise<ScheduleSlot | null> {
    for (const [, schedule] of this.scheduleCache) {
      const slot = schedule.find(s => s.taskId === taskId);
      if (slot) return slot;
    }
    return null;
  }

  async getAgentSchedule(agentId: string): Promise<ScheduleSlot[]> {
    return this.scheduleCache.get(agentId) || [];
  }

  async adjustTaskPriority(
    taskId: string,
    adjustment: 'boost' | 'reduce',
    reason?: string
  ): Promise<void> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return;

    const currentScore = task.priorityScore || 50;
    const newScore = adjustment === 'boost' 
      ? Math.min(100, currentScore + 20)
      : Math.max(0, currentScore - 20);

    await db
      .update(tasks)
      .set({
        priorityScore: newScore,
        metadata: sql`
          COALESCE(${tasks.metadata}, '{}'::jsonb) || 
          jsonb_build_object(
            'lastPriorityAdjustment', ${JSON.stringify({
              type: adjustment,
              reason,
              timestamp: new Date().toISOString(),
              oldScore: currentScore,
              newScore
            })}
          )
        `,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    await db.insert(activities).values({
      type: 'priority_adjusted',
      description: `Task priority ${adjustment}ed: ${reason || 'Manual adjustment'}`,
      taskId,
      projectId: task.projectId,
      metadata: {
        adjustment,
        reason,
        oldScore: currentScore,
        newScore
      }
    });
  }

  async getOptimizedTaskList(
    projectId?: string,
    agentName?: string,
    limit: number = 20
  ): Promise<Task[]> {
    let query = db
      .select()
      .from(tasks)
      .where(
        and(
          tasks.status !== 'completed',
          tasks.status !== 'cancelled'
        )
      );

    const conditions = [];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (agentName) conditions.push(eq(tasks.assignedAgent, agentName));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(tasks.priorityScore))
      .limit(limit);

    return results;
  }

  stop() {
    if (this.prioritizationInterval) {
      clearInterval(this.prioritizationInterval);
      this.prioritizationInterval = null;
    }
    this.scheduleCache.clear();
  }
}