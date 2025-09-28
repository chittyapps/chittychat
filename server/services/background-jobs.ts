import { storage } from "../storage";
import { chittyidClient } from "./chittyid-client";
import { registryClient } from "./registry-client";

export class BackgroundJobs {
  private intervals: NodeJS.Timeout[] = [];
  private broadcastFn?: (message: any) => void;

  start(broadcastFn: (message: any) => void) {
    this.broadcastFn = broadcastFn;
    
    // Start periodic sync jobs
    this.startChittySyncJob();
    this.startRegistrySyncJob();
    this.startProjectOrganizationJob();
    this.startDataIntegrityJob();
    this.startInactiveAgentCleanup();
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  private startChittySyncJob() {
    // Sync with ChittyID every 30 minutes
    const interval = setInterval(async () => {
      try {
        console.log('Starting ChittyID sync job...');
        const result = await chittyidClient.syncProjects();
        
        if (this.broadcastFn) {
          this.broadcastFn({
            type: 'chittyid_sync_completed',
            data: result,
          });
        }
        
        console.log(`ChittyID sync completed: ${result.syncedProjects} projects, ${result.syncedTasks} tasks`);
      } catch (error) {
        console.error('ChittyID sync job failed:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    this.intervals.push(interval);
  }

  private startRegistrySyncJob() {
    // Sync with registry.chitty.cc every hour
    const interval = setInterval(async () => {
      try {
        console.log('Starting registry sync job...');
        const result = await registryClient.syncTools();
        
        if (this.broadcastFn) {
          this.broadcastFn({
            type: 'registry_sync_completed',
            data: result,
          });
        }
        
        console.log(`Registry sync completed: ${result.syncedTools} tools/MCPs`);
      } catch (error) {
        console.error('Registry sync job failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    this.intervals.push(interval);
  }

  private startProjectOrganizationJob() {
    // Self-organizing project structure every 2 hours
    const interval = setInterval(async () => {
      try {
        console.log('Starting project organization job...');
        await this.organizeProjects();
        console.log('Project organization completed');
      } catch (error) {
        console.error('Project organization job failed:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours
    
    this.intervals.push(interval);
  }

  private startDataIntegrityJob() {
    // Self-repairing data consistency checks every 6 hours
    const interval = setInterval(async () => {
      try {
        console.log('Starting data integrity job...');
        await this.repairDataInconsistencies();
        console.log('Data integrity check completed');
      } catch (error) {
        console.error('Data integrity job failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    this.intervals.push(interval);
  }

  private startInactiveAgentCleanup() {
    // Clean up inactive agents every 15 minutes
    const interval = setInterval(async () => {
      try {
        await this.cleanupInactiveAgents();
      } catch (error) {
        console.error('Agent cleanup job failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    this.intervals.push(interval);
  }

  private async organizeProjects() {
    try {
      const projects = await storage.getProjects();
      
      for (const project of projects) {
        // Auto-categorization based on tasks and activities
        const tasks = await storage.getTasks(project.id);
        const activities = await storage.getActivities(project.id);
        
        const suggestedCategory = this.suggestProjectCategory(project, tasks, activities);
        const suggestedTags = this.suggestProjectTags(project, tasks, activities);
        
        // Update project if suggestions differ significantly
        if (suggestedCategory !== project.category || 
            this.shouldUpdateTags(project.tags || [], suggestedTags)) {
          
          await storage.updateProject(project.id, {
            category: suggestedCategory,
            tags: suggestedTags,
            metadata: {
              ...project.metadata,
              auto_organized: true,
              last_organized: new Date().toISOString(),
            },
          });
          
          // Log activity
          await storage.createActivity({
            type: 'project_organized',
            description: `Project "${project.name}" was auto-organized`,
            projectId: project.id,
            metadata: {
              old_category: project.category,
              new_category: suggestedCategory,
              old_tags: project.tags,
              new_tags: suggestedTags,
            },
          });
        }
        
        // Update project progress based on completed tasks
        const stats = await storage.getProjectStats(project.id);
        if (stats.progress !== project.progress) {
          await storage.updateProject(project.id, {
            progress: stats.progress,
          });
        }
      }
    } catch (error) {
      console.error('Project organization failed:', error);
    }
  }

  private async repairDataInconsistencies() {
    try {
      // Check for orphaned tasks
      const projects = await storage.getProjects();
      const projectIds = new Set(projects.map(p => p.id));
      
      for (const project of projects) {
        const tasks = await storage.getTasks(project.id);
        
        // Check for tasks with invalid project references
        for (const task of tasks) {
          if (!projectIds.has(task.projectId)) {
            console.log(`Repairing orphaned task: ${task.id}`);
            await storage.deleteTask(task.id);
            
            await storage.createActivity({
              type: 'data_repair',
              description: `Orphaned task "${task.title}" was removed`,
              metadata: {
                repair_type: 'orphaned_task',
                task_id: task.id,
                invalid_project_id: task.projectId,
              },
            });
          }
        }
        
        // Validate task statuses and fix inconsistencies
        await this.validateTaskStatuses(tasks, project.id);
      }
      
      // Clean up old activities (keep last 1000 per project)
      await this.cleanupOldActivities();
      
    } catch (error) {
      console.error('Data repair failed:', error);
    }
  }

  private async validateTaskStatuses(tasks: any[], projectId: string) {
    for (const task of tasks) {
      let needsUpdate = false;
      const updates: any = {};
      
      // If task is marked completed but has no completion date
      if (task.status === 'completed' && !task.completedAt) {
        updates.completedAt = new Date();
        needsUpdate = true;
      }
      
      // If task has completion date but is not marked completed
      if (task.completedAt && task.status !== 'completed') {
        updates.status = 'completed';
        needsUpdate = true;
      }
      
      // Validate priority values
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(task.priority)) {
        updates.priority = 'medium';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await storage.updateTask(task.id, updates);
        
        await storage.createActivity({
          type: 'data_repair',
          description: `Task "${task.title}" data was repaired`,
          projectId: projectId,
          taskId: task.id,
          metadata: {
            repair_type: 'task_validation',
            updates: updates,
          },
        });
      }
    }
  }

  private async cleanupOldActivities() {
    // Implementation would clean up activities older than a certain threshold
    // while keeping the most recent 1000 activities per project
    console.log('Activity cleanup would run here');
  }

  private async cleanupInactiveAgents() {
    try {
      const agents = await storage.getAgents();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      for (const agent of agents) {
        if (agent.status === 'active' && agent.lastSeen && 
            new Date(agent.lastSeen) < fiveMinutesAgo) {
          
          await storage.updateAgent(agent.id, { status: 'inactive' });
          
          if (this.broadcastFn) {
            this.broadcastFn({
              type: 'agent_inactive',
              agentId: agent.id,
              agent: { ...agent, status: 'inactive' },
            });
          }
        }
      }
    } catch (error) {
      console.error('Agent cleanup failed:', error);
    }
  }

  private suggestProjectCategory(project: any, tasks: any[], activities: any[]): string {
    // Analyze tasks and activities to suggest category
    const taskCategories = tasks.map(t => t.category).filter(Boolean);
    const categoryCount = taskCategories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Return most common category or keep existing
    const mostCommon = Object.keys(categoryCount).sort((a, b) => 
      categoryCount[b] - categoryCount[a])[0];
    
    return mostCommon || project.category || 'General';
  }

  private suggestProjectTags(project: any, tasks: any[], activities: any[]): string[] {
    const allTags = new Set<string>();
    
    // Collect tags from tasks
    tasks.forEach(task => {
      if (task.tags) {
        task.tags.forEach((tag: string) => allTags.add(tag));
      }
    });
    
    // Add project-specific tags
    if (project.tags) {
      project.tags.forEach((tag: string) => allTags.add(tag));
    }
    
    // Add category-based tag
    if (project.category) {
      allTags.add(project.category.toLowerCase().replace(/\s+/g, '-'));
    }
    
    return Array.from(allTags).slice(0, 8); // Limit to 8 tags
  }

  private shouldUpdateTags(currentTags: string[], suggestedTags: string[]): boolean {
    if (currentTags.length !== suggestedTags.length) return true;
    
    const currentSet = new Set(currentTags);
    const suggestedSet = new Set(suggestedTags);
    
    for (const tag of suggestedTags) {
      if (!currentSet.has(tag)) return true;
    }
    
    return false;
  }
}

export const backgroundJobs = new BackgroundJobs();
