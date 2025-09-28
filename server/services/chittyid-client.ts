import { storage } from "../storage";

interface ChittyIDProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ChittyIDTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class ChittyIDClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.CHITTYID_API_URL || 'https://api.chittyid.com';
    this.apiKey = process.env.CHITTYID_API_KEY || '';
  }

  async syncProjects(): Promise<{ syncedProjects: number; syncedTasks: number }> {
    try {
      if (!this.apiKey) {
        throw new Error('ChittyID API key not configured');
      }

      // Update integration status
      await this.updateIntegrationStatus('active', 'Starting ChittyID sync');

      // Fetch projects from ChittyID
      const projects = await this.fetchProjects();
      let syncedProjects = 0;
      let syncedTasks = 0;

      for (const chittyProject of projects) {
        // Check if project already exists
        const existingProject = await storage.getProject(chittyProject.id);
        
        if (!existingProject) {
          // Create new project
          await storage.createProject({
            id: chittyProject.id,
            name: chittyProject.name,
            description: chittyProject.description,
            status: this.mapStatus(chittyProject.status),
            isGlobal: true, // ChittyID projects are global by default
            category: 'ChittyID Integration',
            tags: ['chittyid', 'synced'],
            metadata: {
              ...chittyProject.metadata,
              source: 'chittyid',
              original_id: chittyProject.id,
            },
          });
          syncedProjects++;

          // Log activity
          await storage.createActivity({
            type: 'project_created',
            description: `Project "${chittyProject.name}" synced from ChittyID`,
            projectId: chittyProject.id,
            metadata: { source: 'chittyid_sync' },
          });
        } else {
          // Update existing project if newer
          if (new Date(chittyProject.updated_at) > new Date(existingProject.updatedAt || '')) {
            await storage.updateProject(chittyProject.id, {
              name: chittyProject.name,
              description: chittyProject.description,
              status: this.mapStatus(chittyProject.status),
              metadata: {
                ...existingProject.metadata,
                ...chittyProject.metadata,
                last_synced: new Date().toISOString(),
              },
            });
          }
        }

        // Sync tasks for this project
        const tasks = await this.fetchProjectTasks(chittyProject.id);
        for (const chittyTask of tasks) {
          const existingTask = await storage.getTask(chittyTask.id);
          
          if (!existingTask) {
            await storage.createTask({
              id: chittyTask.id,
              title: chittyTask.title,
              description: chittyTask.description,
              status: this.mapTaskStatus(chittyTask.status),
              priority: this.mapPriority(chittyTask.priority),
              projectId: chittyProject.id,
              assignedAgent: chittyTask.assigned_to || null,
              category: 'ChittyID Sync',
              tags: ['chittyid', 'synced'],
              metadata: {
                ...chittyTask.metadata,
                source: 'chittyid',
                original_id: chittyTask.id,
              },
            });
            syncedTasks++;
          }
        }
      }

      await this.updateIntegrationStatus('active', `Sync completed: ${syncedProjects} projects, ${syncedTasks} tasks`);
      
      return { syncedProjects, syncedTasks };
    } catch (error) {
      await this.updateIntegrationStatus('error', error instanceof Error ? error.message : 'ChittyID sync failed');
      throw error;
    }
  }

  async pushProject(projectId: string): Promise<void> {
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const response = await fetch(`${this.baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-ChittyID-Source': 'chittypm',
        },
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          metadata: {
            ...project.metadata,
            source: 'chittypm',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ChittyID API error: ${response.status} ${response.statusText}`);
      }

      // Update project metadata to mark as synced
      await storage.updateProject(projectId, {
        metadata: {
          ...project.metadata,
          chittyid_synced: true,
          last_pushed: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to push project to ChittyID:', error);
      throw error;
    }
  }

  async pushTask(taskId: string): Promise<void> {
    try {
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-ChittyID-Source': 'chittypm',
        },
        body: JSON.stringify({
          id: task.id,
          project_id: task.projectId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigned_to: task.assignedAgent,
          metadata: {
            ...task.metadata,
            source: 'chittypm',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ChittyID API error: ${response.status} ${response.statusText}`);
      }

      // Update task metadata to mark as synced
      await storage.updateTask(taskId, {
        metadata: {
          ...task.metadata,
          chittyid_synced: true,
          last_pushed: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to push task to ChittyID:', error);
      throw error;
    }
  }

  private async fetchProjects(): Promise<ChittyIDProject[]> {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-ChittyID-Source': 'chittypm',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ChittyID projects: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async fetchProjectTasks(projectId: string): Promise<ChittyIDTask[]> {
    const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/tasks`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-ChittyID-Source': 'chittypm',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ChittyID tasks: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async updateIntegrationStatus(status: string, message?: string): Promise<void> {
    try {
      const integration = await storage.getIntegration('chittyid');
      if (integration) {
        await storage.updateIntegration(integration.id, {
          status,
          errorMessage: status === 'error' ? message : null,
          lastSync: new Date(),
        });
      } else {
        await storage.createIntegration({
          name: 'chittyid',
          type: 'chittyid',
          status,
          config: {
            baseUrl: this.baseUrl,
            hasApiKey: !!this.apiKey,
          },
          errorMessage: status === 'error' ? message : null,
        });
      }
    } catch (error) {
      console.error('Failed to update ChittyID integration status:', error);
    }
  }

  private mapStatus(chittyStatus: string): string {
    const statusMap: Record<string, string> = {
      'active': 'active',
      'inactive': 'archived',
      'completed': 'completed',
      'pending': 'active',
    };
    return statusMap[chittyStatus] || 'active';
  }

  private mapTaskStatus(chittyStatus: string): string {
    const statusMap: Record<string, string> = {
      'todo': 'pending',
      'in_progress': 'in_progress',
      'done': 'completed',
      'blocked': 'blocked',
    };
    return statusMap[chittyStatus] || 'pending';
  }

  private mapPriority(chittyPriority: string): string {
    const priorityMap: Record<string, string> = {
      '1': 'urgent',
      '2': 'high',
      '3': 'medium',
      '4': 'low',
      'urgent': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };
    return priorityMap[chittyPriority] || 'medium';
  }
}

export const chittyidClient = new ChittyIDClient();
