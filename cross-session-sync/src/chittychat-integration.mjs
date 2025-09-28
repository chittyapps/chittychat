#!/usr/bin/env node

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * ChittyChat Integration for Cross-Session Sync
 *
 * This integrates with ChittyChat's central project registry
 * and only syncs between relevant sessions based on:
 * - Same project context
 * - Similar topics/tags
 * - Explicit session relationships
 */
class ChittyChatIntegration {
  constructor(config = {}) {
    this.chittychatUrl = config.chittychatUrl || 'http://localhost:5000';
    this.sessionId = config.sessionId;
    this.baseDir = config.baseDir || path.join(process.cwd(), '.ai-coordination');
    this.currentProject = null;
    this.relevantSessions = new Set();
    this.topicTags = new Set();
  }

  /**
   * Register session with ChittyChat and get project context
   */
  async registerWithChittyChat(sessionData) {
    try {
      // Register this session with ChittyChat
      const response = await fetch(`${this.chittychatUrl}/api/mcp/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionData.name,
          sessionId: sessionData.id,
          agentType: sessionData.model || 'claude',
          capabilities: ['cross-session-sync'],
          metadata: {
            ...sessionData.metadata,
            crossSessionSync: true
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to register with ChittyChat:', response.statusText);
        return null;
      }

      const result = await response.json();
      console.log('Registered with ChittyChat:', result);

      // Get current project context
      await this.syncProjectContext();

      return result;
    } catch (error) {
      console.error('ChittyChat registration error:', error);
      // Continue with local coordination if ChittyChat is unavailable
      return null;
    }
  }

  /**
   * Sync with ChittyChat's project registry
   */
  async syncProjectContext() {
    try {
      // Get active projects from ChittyChat
      const projectsResponse = await fetch(`${this.chittychatUrl}/api/projects?status=active`);

      if (!projectsResponse.ok) {
        console.error('Failed to fetch projects from ChittyChat');
        return;
      }

      const projects = await projectsResponse.json();

      // Find the most relevant project based on recent activity
      const recentProjects = projects
        .filter(p => {
          const lastActivity = new Date(p.lastActivityAt);
          const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);
          return hoursSinceActivity < 24; // Active in last 24 hours
        })
        .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));

      if (recentProjects.length > 0) {
        this.currentProject = recentProjects[0];
        console.log(`Working on project: ${this.currentProject.name}`);

        // Extract tags from project
        if (this.currentProject.tags) {
          this.currentProject.tags.forEach(tag => this.topicTags.add(tag));
        }

        // Find relevant sessions working on same project
        await this.findRelevantSessions();
      }

      // Store project context locally
      await this.saveProjectContext();

    } catch (error) {
      console.error('Project sync error:', error);
    }
  }

  /**
   * Find sessions that should sync based on project/topic relevance
   */
  async findRelevantSessions() {
    try {
      // Get all active agents from ChittyChat
      const agentsResponse = await fetch(`${this.chittychatUrl}/api/agents`);

      if (!agentsResponse.ok) {
        console.error('Failed to fetch agents from ChittyChat');
        return;
      }

      const agents = await agentsResponse.json();

      // Clear previous relevant sessions
      this.relevantSessions.clear();

      // Find agents working on same project or similar topics
      for (const agent of agents) {
        if (agent.sessionId === this.sessionId) continue; // Skip self

        // Check if working on same project
        if (agent.currentProjectId === this.currentProject?.id) {
          this.relevantSessions.add(agent.sessionId);
          console.log(`Found relevant session (same project): ${agent.sessionId}`);
          continue;
        }

        // Check for topic overlap
        if (agent.metadata?.tags) {
          const sharedTags = agent.metadata.tags.filter(tag => this.topicTags.has(tag));
          if (sharedTags.length > 0) {
            this.relevantSessions.add(agent.sessionId);
            console.log(`Found relevant session (shared tags: ${sharedTags.join(', ')}): ${agent.sessionId}`);
          }
        }
      }

      console.log(`Total relevant sessions for sync: ${this.relevantSessions.size}`);

    } catch (error) {
      console.error('Error finding relevant sessions:', error);
    }
  }

  /**
   * Create or update task in ChittyChat
   */
  async createTask(taskData) {
    if (!this.currentProject) {
      // First try to find or create a project
      await this.ensureProject(taskData);
    }

    try {
      const response = await fetch(`${this.chittychatUrl}/api/mcp/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.currentProject?.id,
          title: taskData.name,
          description: taskData.description,
          priority: taskData.priority || 'medium',
          status: 'pending',
          assignedTo: taskData.assignedTo || this.sessionId,
          tags: Array.from(this.topicTags),
          metadata: {
            ...taskData.metadata,
            crossSessionTask: true,
            sessionId: this.sessionId
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to create task in ChittyChat:', response.statusText);
        return null;
      }

      const task = await response.json();
      console.log('Task created in ChittyChat:', task.id);

      // Notify relevant sessions only
      await this.notifyRelevantSessions('task_created', task);

      return task;

    } catch (error) {
      console.error('Task creation error:', error);
      return null;
    }
  }

  /**
   * Ensure we have a project context
   */
  async ensureProject(context = {}) {
    try {
      // Search for existing relevant project
      const searchParams = new URLSearchParams({
        search: context.name || 'Cross-Session Coordination',
        status: 'active'
      });

      const searchResponse = await fetch(`${this.chittychatUrl}/api/projects?${searchParams}`);

      if (searchResponse.ok) {
        const projects = await searchResponse.json();
        if (projects.length > 0) {
          this.currentProject = projects[0];
          return this.currentProject;
        }
      }

      // Create new project if none exists
      const response = await fetch(`${this.chittychatUrl}/api/mcp/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: context.name || `Cross-Session: ${new Date().toLocaleDateString()}`,
          description: context.description || 'AI cross-session coordination project',
          tags: Array.from(this.topicTags),
          status: 'active',
          isGlobal: true,
          metadata: {
            crossSessionProject: true,
            initiatingSession: this.sessionId
          }
        })
      });

      if (response.ok) {
        this.currentProject = await response.json();
        console.log('Created new project in ChittyChat:', this.currentProject.name);
      }

      return this.currentProject;

    } catch (error) {
      console.error('Project ensure error:', error);
      return null;
    }
  }

  /**
   * Only sync with relevant sessions, not all sessions
   */
  async syncWithRelevantSessions(data) {
    const syncData = {
      sessionId: this.sessionId,
      projectId: this.currentProject?.id,
      tags: Array.from(this.topicTags),
      data: data,
      timestamp: Date.now()
    };

    // Only write sync files for relevant sessions
    for (const relevantSessionId of this.relevantSessions) {
      const syncFile = path.join(this.baseDir, 'sync', `${relevantSessionId}.json`);
      await fs.mkdir(path.dirname(syncFile), { recursive: true });

      try {
        // Append to session's sync queue
        let queue = [];
        try {
          const existing = await fs.readFile(syncFile, 'utf8');
          queue = JSON.parse(existing);
        } catch (e) {
          // File doesn't exist yet
        }

        queue.push(syncData);

        // Keep only last 100 sync items
        if (queue.length > 100) {
          queue = queue.slice(-100);
        }

        await fs.writeFile(syncFile, JSON.stringify(queue, null, 2));
        console.log(`Synced with relevant session: ${relevantSessionId}`);

      } catch (error) {
        console.error(`Failed to sync with session ${relevantSessionId}:`, error);
      }
    }
  }

  /**
   * Read sync data from other relevant sessions only
   */
  async readRelevantSyncData() {
    const syncData = [];

    for (const relevantSessionId of this.relevantSessions) {
      const syncFile = path.join(this.baseDir, 'sync', `${this.sessionId}.json`);

      try {
        const data = await fs.readFile(syncFile, 'utf8');
        const queue = JSON.parse(data);

        // Filter for data from relevant sessions only
        const relevantData = queue.filter(item =>
          this.relevantSessions.has(item.sessionId) ||
          item.projectId === this.currentProject?.id
        );

        syncData.push(...relevantData);

      } catch (error) {
        // No sync data yet
      }
    }

    // Sort by timestamp
    syncData.sort((a, b) => a.timestamp - b.timestamp);

    return syncData;
  }

  /**
   * Notify only relevant sessions of events
   */
  async notifyRelevantSessions(eventType, data) {
    const notification = {
      type: eventType,
      sessionId: this.sessionId,
      projectId: this.currentProject?.id,
      tags: Array.from(this.topicTags),
      data: data,
      timestamp: Date.now()
    };

    // Write to shared event log (only relevant sessions will read)
    const eventFile = path.join(this.baseDir, 'events', 'relevant-events.jsonl');
    await fs.mkdir(path.dirname(eventFile), { recursive: true });

    await fs.appendFile(eventFile, JSON.stringify(notification) + '\n');

    // Also update ChittyChat activity feed
    try {
      await fetch(`${this.chittychatUrl}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.currentProject?.id,
          type: eventType,
          description: `Session ${this.sessionId}: ${eventType}`,
          metadata: notification
        })
      });
    } catch (error) {
      console.error('Failed to update ChittyChat activity:', error);
    }
  }

  /**
   * Save project context for persistence
   */
  async saveProjectContext() {
    const contextFile = path.join(this.baseDir, 'project-context.json');

    await fs.writeFile(contextFile, JSON.stringify({
      currentProject: this.currentProject,
      relevantSessions: Array.from(this.relevantSessions),
      topicTags: Array.from(this.topicTags),
      lastSync: Date.now()
    }, null, 2));
  }

  /**
   * Load saved project context
   */
  async loadProjectContext() {
    const contextFile = path.join(this.baseDir, 'project-context.json');

    try {
      const data = JSON.parse(await fs.readFile(contextFile, 'utf8'));

      this.currentProject = data.currentProject;
      this.relevantSessions = new Set(data.relevantSessions || []);
      this.topicTags = new Set(data.topicTags || []);

      console.log('Loaded project context:', {
        project: this.currentProject?.name,
        relevantSessions: this.relevantSessions.size,
        tags: Array.from(this.topicTags)
      });

    } catch (error) {
      // No saved context yet
    }
  }

  /**
   * Set topic tags for this session
   */
  setTopicTags(tags) {
    tags.forEach(tag => this.topicTags.add(tag));
    console.log('Session topic tags:', Array.from(this.topicTags));
  }

  /**
   * Check if a session is relevant for sync
   */
  isRelevantSession(sessionId) {
    return this.relevantSessions.has(sessionId);
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      connected: this.currentProject !== null,
      project: this.currentProject?.name,
      projectId: this.currentProject?.id,
      relevantSessions: this.relevantSessions.size,
      topicTags: Array.from(this.topicTags),
      chittychatUrl: this.chittychatUrl
    };
  }
}

export default ChittyChatIntegration;