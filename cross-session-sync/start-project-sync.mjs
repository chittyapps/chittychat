#!/usr/bin/env node

import SessionManager from './src/session-manager.mjs';
import ProjectBasedSync from './src/project-based-sync.mjs';
import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Project-Based Cross-Session Sync
 *
 * Sessions sync ONLY when working on the SAME project in ChittyChat
 * NOT based on topic similarity
 */
class ProjectSync {
  constructor() {
    this.sessionManager = new SessionManager();
    this.projectSync = null;
    this.sessionId = null;
    this.heartbeatInterval = null;
  }

  async initialize() {
    console.log('🚀 Initializing Project-Based Cross-Session Sync');
    console.log('================================================');

    // Initialize session manager
    await this.sessionManager.initialize();

    // Register session
    const sessionName = `project-sync-${Date.now().toString(36)}`;
    const session = await this.sessionManager.registerSession(sessionName, {
      model: process.env.AI_MODEL || 'claude',
      type: 'project-sync'
    });

    this.sessionId = session.id;
    console.log(`✅ Session registered: ${session.name} (${session.id.slice(0, 8)})`);

    // Initialize project-based sync
    this.projectSync = new ProjectBasedSync({
      sessionId: this.sessionId,
      chittychatUrl: process.env.CHITTYCHAT_URL || 'http://localhost:5000'
    });

    // Try to find and register to active project
    const project = await this.projectSync.registerSessionToProject();

    if (project) {
      console.log(`✅ Working on project: ${project.name} (${project.id})`);
    } else {
      console.log('⚠️ No active project found - sync disabled until project selected');
    }

    // Start heartbeat for project registration
    this.heartbeatInterval = setInterval(() => {
      this.projectSync.updateHeartbeat();
    }, 30000); // Every 30 seconds

    this.displayStatus();
  }

  displayStatus() {
    console.log('\n📊 Project Sync Status:');
    console.log('======================');

    const status = this.projectSync.getSyncStatus();

    if (status.connected) {
      console.log(`✅ Project: ${status.project}`);
      console.log(`   ID: ${status.projectId}`);
      console.log(`   Sessions on project: ${status.sessionsOnProject}`);
      console.log(`   Sync: ENABLED`);
    } else {
      console.log(`❌ No project selected`);
      console.log(`   Sync: DISABLED`);
    }
  }

  async selectProject(projectIdOrName) {
    console.log(`\n🔍 Searching for project: ${projectIdOrName}`);

    try {
      // Try to find project by name or ID
      const response = await fetch(
        `${this.projectSync.chittychatUrl}/api/projects?search=${encodeURIComponent(projectIdOrName)}`
      );

      if (!response.ok) {
        console.log('❌ Cannot connect to ChittyChat');
        return;
      }

      const projects = await response.json();

      if (projects.length === 0) {
        console.log('❌ No matching projects found');
        return;
      }

      if (projects.length === 1) {
        // Auto-select if only one match
        await this.projectSync.registerSessionToProject(projects[0].id);
        console.log(`✅ Switched to project: ${projects[0].name}`);
      } else {
        // Show options if multiple matches
        console.log('\nMultiple projects found:');
        projects.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.name} (${p.id})`);
        });
        console.log('Use /project <number> to select');
      }
    } catch (error) {
      console.error('Error selecting project:', error.message);
    }
  }

  async syncData(data) {
    if (!this.projectSync.currentProject) {
      console.log('⚠️ No project selected - cannot sync');
      return;
    }

    await this.projectSync.syncWithProject(data);
  }

  async checkIncomingSync() {
    if (!this.projectSync.currentProject) {
      return [];
    }

    const syncData = await this.projectSync.readProjectSync();

    if (syncData.length > 0) {
      console.log(`\n📥 Incoming sync from project sessions:`);
      syncData.slice(0, 5).forEach(sync => {
        console.log(`  - Session ${sync.sessionId.slice(0, 8)}: ${sync.data.type || 'data'}`);
      });
    }

    return syncData;
  }

  async createTask(taskName, description) {
    const task = await this.projectSync.createProjectTask({
      name: taskName,
      description: description || ''
    });

    if (task) {
      // Claim the task
      await this.sessionManager.claimTask(task.id);
    }

    return task;
  }

  async listProjectTasks() {
    const tasks = await this.projectSync.getProjectTasks();

    if (tasks.length === 0) {
      console.log('No tasks in current project');
      return;
    }

    console.log('\n📋 Project Tasks:');
    tasks.forEach(task => {
      const status = task.status === 'completed' ? '✅' : '⏳';
      const assigned = task.assignedTo ? `(${task.assignedTo.slice(0, 8)})` : '';
      console.log(`  ${status} ${task.title} ${assigned}`);
    });
  }

  async startInteractiveMode() {
    console.log('\n💬 Project Sync Interactive Mode');
    console.log('================================');
    console.log('Commands:');
    console.log('  /project <name>  - Select project to sync');
    console.log('  /status         - Show sync status');
    console.log('  /sessions       - List sessions on current project');
    console.log('  /tasks          - Show project tasks');
    console.log('  /task <name>    - Create a task');
    console.log('  /sync           - Check for incoming sync');
    console.log('  /exit           - Exit');
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'project-sync> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (input.startsWith('/')) {
        await this.handleCommand(input);
      } else if (input) {
        // Regular input - sync as data
        await this.syncData({ type: 'message', content: input });
        console.log('✅ Synced to project sessions');
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      await this.shutdown();
      process.exit(0);
    });

    // Check for incoming sync every 10 seconds
    setInterval(() => this.checkIncomingSync(), 10000);
  }

  async handleCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case '/project':
        if (args) {
          await this.selectProject(args);
        } else {
          console.log('Usage: /project <name or id>');
        }
        break;

      case '/status':
        this.displayStatus();
        break;

      case '/sessions':
        if (this.projectSync.currentProject) {
          const sessions = await this.projectSync.findProjectSessions();
          console.log(`\n👥 Sessions on project ${this.projectSync.currentProject.name}:`);
          sessions.forEach(s => {
            console.log(`  - ${s.sessionId.slice(0, 8)} (${s.model})`);
          });
        } else {
          console.log('No project selected');
        }
        break;

      case '/tasks':
        await this.listProjectTasks();
        break;

      case '/task':
        if (args) {
          const task = await this.createTask(args);
          if (task) {
            console.log(`✅ Task created: ${task.title}`);
          }
        } else {
          console.log('Usage: /task <task name>');
        }
        break;

      case '/sync':
        await this.checkIncomingSync();
        break;

      case '/exit':
        await this.shutdown();
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${cmd}`);
    }
  }

  async shutdown() {
    console.log('\n👋 Shutting down project sync...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await this.projectSync.unregisterFromProject();
    await this.sessionManager.unregisterSession();

    console.log('✅ Shutdown complete');
  }
}

// Main execution
async function main() {
  const sync = new ProjectSync();

  try {
    await sync.initialize();

    if (process.argv.includes('--daemon')) {
      console.log('Running in daemon mode...');
      // Keep checking for sync
      setInterval(async () => {
        await sync.checkIncomingSync();
      }, 10000);
    } else {
      await sync.startInteractiveMode();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ProjectSync;