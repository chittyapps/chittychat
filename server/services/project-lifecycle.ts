import { db } from '../db';
import { projects, projectLifecycle, activities, tasks } from '../../shared/schema';
import { eq, and, lt, gte, isNull, sql } from 'drizzle-orm';
import type { Project, ProjectLifecycle } from '../../shared/schema';

export class ProjectLifecycleService {
  private static instance: ProjectLifecycleService;
  private archivalCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): ProjectLifecycleService {
    if (!ProjectLifecycleService.instance) {
      ProjectLifecycleService.instance = new ProjectLifecycleService();
    }
    return ProjectLifecycleService.instance;
  }

  async initializeAutomation() {
    this.startArchivalCheck();
    this.startLifecycleTransitionCheck();
  }

  private startArchivalCheck() {
    if (this.archivalCheckInterval) {
      clearInterval(this.archivalCheckInterval);
    }

    this.archivalCheckInterval = setInterval(async () => {
      await this.checkAndArchiveProjects();
    }, 60 * 60 * 1000); // Check every hour

    this.checkAndArchiveProjects();
  }

  private startLifecycleTransitionCheck() {
    setInterval(async () => {
      await this.checkLifecycleTransitions();
    }, 30 * 60 * 1000); // Check every 30 minutes
  }

  async checkAndArchiveProjects() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Find projects scheduled for archival
      const projectsToArchive = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.status, 'active'),
            lt(projects.archivalScheduledAt, new Date()),
            isNull(projects.archivedAt)
          )
        );

      for (const project of projectsToArchive) {
        await this.archiveProject(project.id);
      }

      // Auto-schedule archival for inactive projects
      const inactiveProjects = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.status, 'active'),
            lt(projects.lastActivityAt, thirtyDaysAgo),
            isNull(projects.archivalScheduledAt)
          )
        );

      for (const project of inactiveProjects) {
        await this.scheduleArchival(project.id, sevenDaysAgo);
      }
    } catch (error) {
      console.error('Error in archival check:', error);
    }
  }

  async checkLifecycleTransitions() {
    try {
      const activeProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.status, 'active'));

      for (const project of activeProjects) {
        await this.evaluateAndTransitionLifecycle(project);
      }
    } catch (error) {
      console.error('Error in lifecycle transition check:', error);
    }
  }

  private async evaluateAndTransitionLifecycle(project: Project) {
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id));

    const completedTasks = projectTasks.filter(t => t.status === 'completed');
    const completionRate = projectTasks.length > 0 
      ? (completedTasks.length / projectTasks.length) * 100 
      : 0;

    let newStage = project.lifecycleStage;
    const triggers: string[] = [];

    // Determine appropriate lifecycle stage
    if (completionRate === 100 && project.lifecycleStage !== 'maintenance') {
      newStage = 'maintenance';
      triggers.push('all_tasks_completed');
    } else if (completionRate >= 80 && project.lifecycleStage === 'development') {
      newStage = 'review';
      triggers.push('high_completion_rate');
    } else if (completionRate >= 50 && project.lifecycleStage === 'planning') {
      newStage = 'development';
      triggers.push('significant_progress');
    } else if (projectTasks.some(t => t.status === 'blocked') && project.lifecycleStage === 'development') {
      newStage = 'testing';
      triggers.push('blocked_tasks_detected');
    }

    if (newStage !== project.lifecycleStage) {
      await this.transitionLifecycleStage(project.id, newStage, triggers);
    }

    // Update project progress
    if (Math.abs(project.progress - completionRate) > 5) {
      await db
        .update(projects)
        .set({ 
          progress: Math.round(completionRate),
          updatedAt: new Date()
        })
        .where(eq(projects.id, project.id));
    }
  }

  async transitionLifecycleStage(
    projectId: string, 
    newStage: string, 
    triggers: string[] = []
  ) {
    // Close current stage
    const currentStages = await db
      .select()
      .from(projectLifecycle)
      .where(
        and(
          eq(projectLifecycle.projectId, projectId),
          isNull(projectLifecycle.exitedAt)
        )
      );

    for (const stage of currentStages) {
      await db
        .update(projectLifecycle)
        .set({ exitedAt: new Date() })
        .where(eq(projectLifecycle.id, stage.id));
    }

    // Create new stage entry
    await db.insert(projectLifecycle).values({
      projectId,
      stage: newStage,
      triggers,
      metrics: await this.calculateStageMetrics(projectId),
      automatedActions: await this.determineAutomatedActions(newStage, projectId)
    });

    // Update project
    await db
      .update(projects)
      .set({ 
        lifecycleStage: newStage,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    // Log activity
    await db.insert(activities).values({
      type: 'lifecycle_transition',
      description: `Project transitioned to ${newStage} stage`,
      projectId,
      metadata: { 
        newStage, 
        triggers,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async calculateStageMetrics(projectId: string): Promise<Record<string, any>> {
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId)) as Task[];

    const now = new Date();
    const overdueTasks = projectTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
    );

    return {
      totalTasks: projectTasks.length,
      completedTasks: projectTasks.filter(t => t.status === 'completed').length,
      inProgressTasks: projectTasks.filter(t => t.status === 'in_progress').length,
      blockedTasks: projectTasks.filter(t => t.status === 'blocked').length,
      overdueTasks: overdueTasks.length,
      avgCompletionTime: await this.calculateAvgCompletionTime(projectTasks),
      velocity: await this.calculateVelocity(projectId)
    };
  }

  private async calculateAvgCompletionTime(projectTasks: any[]): Promise<number> {
    const completedTasks = projectTasks.filter(t => 
      t.status === 'completed' && t.completedAt && t.createdAt
    );

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const duration = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
      return sum + duration;
    }, 0);

    return Math.round(totalTime / completedTasks.length / (1000 * 60 * 60)); // in hours
  }

  private async calculateVelocity(projectId: string): Promise<number> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentCompletions = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.status, 'completed'),
          gte(tasks.completedAt, oneWeekAgo)
        )
      );

    return recentCompletions.length;
  }

  private async determineAutomatedActions(
    stage: string, 
    projectId: string
  ): Promise<string[]> {
    const actions: string[] = [];

    switch (stage) {
      case 'planning':
        actions.push('enable_brainstorming_tools');
        actions.push('suggest_similar_projects');
        break;
      case 'development':
        actions.push('enable_code_review_automation');
        actions.push('activate_ci_cd_pipeline');
        break;
      case 'testing':
        actions.push('run_automated_tests');
        actions.push('generate_test_coverage_report');
        break;
      case 'review':
        actions.push('notify_reviewers');
        actions.push('generate_completion_report');
        break;
      case 'maintenance':
        actions.push('enable_monitoring');
        actions.push('schedule_periodic_reviews');
        break;
      case 'archived':
        actions.push('compress_project_data');
        actions.push('generate_archive_summary');
        break;
    }

    return actions;
  }

  async scheduleArchival(projectId: string, scheduledDate: Date) {
    await db
      .update(projects)
      .set({ 
        archivalScheduledAt: scheduledDate,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    await db.insert(activities).values({
      type: 'archival_scheduled',
      description: `Project scheduled for archival on ${scheduledDate.toISOString()}`,
      projectId,
      metadata: { scheduledDate: scheduledDate.toISOString() }
    });
  }

  async archiveProject(projectId: string) {
    const now = new Date();

    await db
      .update(projects)
      .set({ 
        status: 'archived',
        archivedAt: now,
        updatedAt: now
      })
      .where(eq(projects.id, projectId));

    await this.transitionLifecycleStage(projectId, 'archived', ['auto_archived']);

    await db.insert(activities).values({
      type: 'project_archived',
      description: 'Project has been archived',
      projectId,
      metadata: { archivedAt: now.toISOString() }
    });
  }

  async restoreProject(projectId: string) {
    await db
      .update(projects)
      .set({ 
        status: 'active',
        archivedAt: null,
        archivalScheduledAt: null,
        lastActivityAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    await this.transitionLifecycleStage(projectId, 'development', ['restored_from_archive']);

    await db.insert(activities).values({
      type: 'project_restored',
      description: 'Project has been restored from archive',
      projectId,
      metadata: { restoredAt: new Date().toISOString() }
    });
  }

  async getProjectLifecycleHistory(projectId: string): Promise<ProjectLifecycle[]> {
    return await db
      .select()
      .from(projectLifecycle)
      .where(eq(projectLifecycle.projectId, projectId))
      .orderBy(projectLifecycle.enteredAt);
  }

  stop() {
    if (this.archivalCheckInterval) {
      clearInterval(this.archivalCheckInterval);
      this.archivalCheckInterval = null;
    }
  }
}