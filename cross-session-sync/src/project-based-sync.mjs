#!/usr/bin/env node

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Project-Based Cross-Session Sync
 *
 * Sessions sync ONLY when:
 * 1. Working on the SAME ChittyChat project
 * 2. Explicitly linked projects
 * 3. Parent-child project relationships
 *
 * NOT based on random topic similarity!
 */
class ProjectBasedSync {
  constructor(config = {}) {
    this.sessionId = config.sessionId;
    this.chittychatUrl = config.chittychatUrl || 'https://chat.chitty.cc';
    this.baseDir = path.join(process.cwd(), '.ai-coordination');

    // Current project context
    this.currentProject = null;
    this.projectSessions = new Map(); // projectId -> [sessionIds]
    this.sessionProjects = new Map(); // sessionId -> projectId
  }

  /**
   * Register session with a SPECIFIC project
   */
  async registerSessionToProject(projectId) {
    if (!projectId) {
      // Try to find active project from ChittyChat
      projectId = await this.findActiveProject();
    }

    if (!projectId) {
      console.log('⚠️ No project specified - no sync will occur');
      return null;
    }

    this.currentProject = await this.getProject(projectId);

    if (!this.currentProject) {
      console.log(`❌ Project ${projectId} not found in ChittyChat`);
      return null;
    }

    console.log(`✅ Session ${this.sessionId} registered to project: ${this.currentProject.name}`);

    // Register in project-sessions mapping
    if (!this.projectSessions.has(projectId)) {
      this.projectSessions.set(projectId, new Set());
    }
    this.projectSessions.get(projectId).add(this.sessionId);
    this.sessionProjects.set(this.sessionId, projectId);

    // Write project registration
    await this.writeProjectRegistration();

    // Find other sessions on SAME project
    await this.findProjectSessions();

    return this.currentProject;
  }

  /**
   * Find the currently active project in ChittyChat
   */
  async findActiveProject() {
    try {
      // Get projects sorted by last activity
      const response = await fetch(`${this.chittychatUrl}/api/projects?status=active&sort=lastActivityAt`);

      if (!response.ok) return null;

      const projects = await response.json();

      if (projects.length > 0) {
        // Return the most recently active project
        return projects[0].id;
      }
    } catch (error) {
      console.error('Cannot connect to ChittyChat:', error.message);
    }

    return null;
  }

  /**
   * Get project details from ChittyChat
   */
  async getProject(projectId) {
    try {
      const response = await fetch(`${this.chittychatUrl}/api/projects/${projectId}`);

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      return null;
    }
  }

  /**
   * Find other sessions working on the SAME project
   */
  async findProjectSessions() {
    const projectDir = path.join(this.baseDir, 'projects');
    const projectFile = path.join(projectDir, `${this.currentProject.id}.json`);

    try {
      // Read project session registry
      const data = JSON.parse(await fs.readFile(projectFile, 'utf8'));

      const activeSessions = data.sessions.filter(s => {
        // Only include sessions that are:
        // 1. Not this session
        // 2. Still active (heartbeat within 60 seconds)
        return s.sessionId !== this.sessionId &&
               (Date.now() - s.lastHeartbeat) < 60000;
      });

      console.log(`Found ${activeSessions.length} other sessions on project ${this.currentProject.name}`);

      return activeSessions;
    } catch (error) {
      // No other sessions on this project yet
      return [];
    }
  }

  /**
   * Write project registration to shared file
   */
  async writeProjectRegistration() {
    const projectDir = path.join(this.baseDir, 'projects');
    await fs.mkdir(projectDir, { recursive: true });

    const projectFile = path.join(projectDir, `${this.currentProject.id}.json`);

    let projectData = {
      projectId: this.currentProject.id,
      projectName: this.currentProject.name,
      sessions: []
    };

    // Read existing if exists
    try {
      const existing = JSON.parse(await fs.readFile(projectFile, 'utf8'));
      projectData = existing;
    } catch (error) {
      // File doesn't exist yet
    }

    // Remove stale sessions
    projectData.sessions = projectData.sessions.filter(s =>
      (Date.now() - s.lastHeartbeat) < 300000 // 5 minutes
    );

    // Update or add this session
    const sessionIndex = projectData.sessions.findIndex(s => s.sessionId === this.sessionId);
    const sessionEntry = {
      sessionId: this.sessionId,
      lastHeartbeat: Date.now(),
      startTime: Date.now(),
      model: process.env.AI_MODEL || 'claude'
    };

    if (sessionIndex >= 0) {
      projectData.sessions[sessionIndex] = sessionEntry;
    } else {
      projectData.sessions.push(sessionEntry);
    }

    await fs.writeFile(projectFile, JSON.stringify(projectData, null, 2));
  }

  /**
   * Sync ONLY with sessions on the SAME project
   */
  async syncWithProject(data) {
    if (!this.currentProject) {
      console.log('⚠️ No project - skipping sync');
      return;
    }

    const projectSessions = await this.findProjectSessions();

    if (projectSessions.length === 0) {
      console.log('No other sessions on this project');
      return;
    }

    // Write sync data for project
    const syncDir = path.join(this.baseDir, 'project-sync', this.currentProject.id);
    await fs.mkdir(syncDir, { recursive: true });

    const syncFile = path.join(syncDir, `${Date.now()}-${this.sessionId}.json`);

    const syncData = {
      sessionId: this.sessionId,
      projectId: this.currentProject.id,
      timestamp: Date.now(),
      data: data
    };

    await fs.writeFile(syncFile, JSON.stringify(syncData, null, 2));

    console.log(`✅ Synced with ${projectSessions.length} sessions on project: ${this.currentProject.name}`);
  }

  /**
   * Read sync data from OTHER sessions on SAME project
   */
  async readProjectSync() {
    if (!this.currentProject) {
      return [];
    }

    const syncDir = path.join(this.baseDir, 'project-sync', this.currentProject.id);

    try {
      const files = await fs.readdir(syncDir);
      const syncData = [];

      for (const file of files) {
        // Skip our own sync files
        if (file.includes(this.sessionId)) continue;

        const filePath = path.join(syncDir, file);
        const stat = await fs.stat(filePath);

        // Only read recent files (last 5 minutes)
        if (Date.now() - stat.mtime < 300000) {
          const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
          syncData.push(data);
        }
      }

      return syncData.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      return [];
    }
  }

  /**
   * Update heartbeat for project registration
   */
  async updateHeartbeat() {
    if (!this.currentProject) return;

    await this.writeProjectRegistration();
  }

  /**
   * Switch to a different project
   */
  async switchProject(projectId) {
    console.log(`Switching from project ${this.currentProject?.id} to ${projectId}`);

    // Unregister from current project
    if (this.currentProject) {
      await this.unregisterFromProject();
    }

    // Register to new project
    await this.registerSessionToProject(projectId);
  }

  /**
   * Unregister from current project
   */
  async unregisterFromProject() {
    if (!this.currentProject) return;

    const projectFile = path.join(this.baseDir, 'projects', `${this.currentProject.id}.json`);

    try {
      const data = JSON.parse(await fs.readFile(projectFile, 'utf8'));

      // Remove this session
      data.sessions = data.sessions.filter(s => s.sessionId !== this.sessionId);

      await fs.writeFile(projectFile, JSON.stringify(data, null, 2));

      console.log(`Unregistered from project: ${this.currentProject.name}`);
    } catch (error) {
      // Project file might not exist
    }

    this.currentProject = null;
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const projectSessions = this.currentProject ?
      (this.projectSessions.get(this.currentProject.id)?.size || 0) : 0;

    return {
      connected: this.currentProject !== null,
      project: this.currentProject?.name,
      projectId: this.currentProject?.id,
      sessionsOnProject: projectSessions,
      syncEnabled: this.currentProject !== null
    };
  }

  /**
   * Create a task in the current project
   */
  async createProjectTask(taskData) {
    if (!this.currentProject) {
      console.log('⚠️ No project selected - cannot create task');
      return null;
    }

    try {
      const response = await fetch(`${this.chittychatUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.currentProject.id,
          title: taskData.name,
          description: taskData.description,
          status: 'pending',
          assignedTo: this.sessionId,
          metadata: {
            createdBySession: this.sessionId,
            ...taskData.metadata
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to create task in ChittyChat');
        return null;
      }

      const task = await response.json();
      console.log(`✅ Task created in project ${this.currentProject.name}: ${task.title}`);

      // Notify other sessions on same project
      await this.syncWithProject({
        type: 'task_created',
        task: task
      });

      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      return null;
    }
  }

  /**
   * Get tasks for current project
   */
  async getProjectTasks() {
    if (!this.currentProject) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.chittychatUrl}/api/tasks?projectId=${this.currentProject.id}`
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      return [];
    }
  }
}

export default ProjectBasedSync;