#!/usr/bin/env node

import SessionManager from './src/session-manager.mjs';
import ChittyChatIntegration from './src/chittychat-integration.mjs';
import TopicAnalyzer, { registerTopicHooks } from './src/topic-analyzer.mjs';
import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Complete Cross-Session Sync System
 *
 * Integrates:
 * - Session management with heartbeat
 * - ChittyChat project integration
 * - Topic analysis with automatic tagging
 * - Relevant session discovery
 * - Smart synchronization
 */
class CrossSessionSync {
  constructor() {
    this.sessionManager = new SessionManager();
    this.chittychat = null;
    this.topicAnalyzer = null;
    this.sessionId = null;
    this.isRunning = false;
  }

  async initialize() {
    console.log('🚀 Initializing Cross-Session Sync System');
    console.log('=========================================');

    // Initialize session manager
    await this.sessionManager.initialize();

    // Register session
    const sessionName = `sync-${Date.now().toString(36)}`;
    const session = await this.sessionManager.registerSession(sessionName, {
      model: process.env.AI_MODEL || 'claude',
      crossSessionSync: true,
      startTime: Date.now()
    });

    this.sessionId = session.id;
    console.log(`✅ Session registered: ${session.name} (${session.id.slice(0, 8)})`);

    // Initialize ChittyChat integration
    this.chittychat = new ChittyChatIntegration({
      sessionId: this.sessionId,
      chittychatUrl: process.env.CHITTYCHAT_URL || 'http://localhost:5000'
    });

    // Load saved project context
    await this.chittychat.loadProjectContext();

    // Register with ChittyChat if available
    const chittychatResult = await this.chittychat.registerWithChittyChat(session);
    if (chittychatResult) {
      console.log('✅ Connected to ChittyChat');
    } else {
      console.log('⚠️ ChittyChat not available - using local coordination');
    }

    // Initialize topic analyzer
    this.topicAnalyzer = new TopicAnalyzer({
      sessionId: this.sessionId
    });

    // Register topic hooks
    registerTopicHooks(this.topicAnalyzer);

    // Additional hook for ChittyChat integration
    this.topicAnalyzer.registerHook('after_tags', async (tags) => {
      this.chittychat.setTopicTags(tags);
      await this.chittychat.findRelevantSessions();
    });

    console.log('✅ Topic analyzer initialized');

    // Display status
    this.displayStatus();

    this.isRunning = true;
  }

  displayStatus() {
    console.log('\n📊 Sync Status:');
    console.log('==============');

    const syncStatus = this.chittychat.getSyncStatus();
    console.log(`ChittyChat: ${syncStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`Project: ${syncStatus.project || 'None'}`);
    console.log(`Relevant Sessions: ${syncStatus.relevantSessions}`);
    console.log(`Topic Tags: ${syncStatus.topicTags.join(', ') || 'None'}`);

    const analytics = this.topicAnalyzer.getAnalytics();
    console.log(`\n📈 Session Analytics:`);
    console.log(`Dominant Topics: ${analytics.dominantTopics.slice(0, 3).map(t => t[0]).join(', ')}`);
    console.log(`Topic Diversity: ${analytics.topicDiversity}`);
  }

  async processInput(input) {
    // Analyze input for topics
    const analysis = await this.topicAnalyzer.analyzeInput(input);

    console.log(`\n🏷️ Detected Topics: ${analysis.tags.join(', ')}`);
    console.log(`Dominant: ${analysis.dominant} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);

    // Check if we need to create/update ChittyChat project
    if (analysis.dominant && !this.chittychat.currentProject) {
      await this.chittychat.ensureProject({
        name: `Session: ${analysis.dominant}`,
        description: `Cross-session coordination for ${analysis.dominant}`,
        tags: analysis.tags
      });
    }

    // Sync with relevant sessions only
    await this.chittychat.syncWithRelevantSessions({
      input: input.substring(0, 500),
      tags: analysis.tags,
      analysis: analysis
    });

    // Check for tasks in the input
    if (input.toLowerCase().includes('task:') || input.toLowerCase().includes('todo:')) {
      await this.createTaskFromInput(input, analysis.tags);
    }
  }

  async createTaskFromInput(input, tags) {
    // Extract task from input
    const taskMatch = input.match(/(?:task|todo):\s*(.+?)(?:\n|$)/i);
    if (taskMatch) {
      const taskName = taskMatch[1].trim();

      console.log(`\n📝 Creating task: ${taskName}`);

      const task = await this.chittychat.createTask({
        name: taskName,
        description: input,
        tags: tags,
        priority: this.detectPriority(input)
      });

      if (task) {
        console.log(`✅ Task created in ChittyChat: ${task.id}`);

        // Claim the task for this session
        await this.sessionManager.claimTask(task.id);
      }
    }
  }

  detectPriority(input) {
    if (input.match(/urgent|critical|asap|immediately/i)) return 'high';
    if (input.match(/important|priority/i)) return 'medium';
    return 'low';
  }

  async checkIncomingSyncs() {
    // Read sync data from other relevant sessions
    const syncData = await this.chittychat.readRelevantSyncData();

    if (syncData.length > 0) {
      console.log(`\n📥 Incoming syncs: ${syncData.length}`);

      for (const sync of syncData.slice(-5)) {
        console.log(`  - Session ${sync.sessionId.slice(0, 8)}: ${sync.data.tags?.join(', ')}`);
      }
    }
  }

  async startInteractiveMode() {
    console.log('\n💬 Interactive Mode Started');
    console.log('Commands:');
    console.log('  /status - Show sync status');
    console.log('  /sessions - List active sessions');
    console.log('  /tasks - Show current tasks');
    console.log('  /sync - Force sync check');
    console.log('  /exit - Exit sync system');
    console.log('\nOr type any text to analyze topics and sync\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'sync> '
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (input.startsWith('/')) {
        await this.handleCommand(input);
      } else if (input) {
        await this.processInput(input);
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      console.log('\n👋 Shutting down sync system...');
      await this.shutdown();
      process.exit(0);
    });

    // Periodic sync check
    setInterval(() => this.checkIncomingSyncs(), 10000);
  }

  async handleCommand(command) {
    switch (command) {
      case '/status':
        this.displayStatus();
        break;

      case '/sessions':
        const sessions = await this.sessionManager.getActiveSessions();
        console.log(`\n👥 Active Sessions: ${sessions.length}`);
        sessions.forEach(s => {
          const isRelevant = this.chittychat.isRelevantSession(s.id);
          const marker = isRelevant ? '✅' : '  ';
          console.log(`${marker} ${s.name} (${s.id.slice(0, 8)}) - ${s.status}`);
        });
        break;

      case '/tasks':
        console.log(`\n📋 Current Tasks:`);
        if (this.sessionManager.sessionData?.tasks?.length > 0) {
          this.sessionManager.sessionData.tasks.forEach(t => {
            console.log(`  - ${t}`);
          });
        } else {
          console.log('  No tasks claimed');
        }
        break;

      case '/sync':
        console.log('🔄 Forcing sync check...');
        await this.checkIncomingSyncs();
        await this.chittychat.syncProjectContext();
        break;

      case '/exit':
        await this.shutdown();
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${command}`);
    }
  }

  async shutdown() {
    this.isRunning = false;

    // Save current state
    await this.chittychat.saveProjectContext();

    // Unregister session
    await this.sessionManager.unregisterSession();

    console.log('✅ Sync system shutdown complete');
  }
}

// Main execution
async function main() {
  const sync = new CrossSessionSync();

  try {
    await sync.initialize();

    // Start interactive mode or daemon mode
    if (process.argv.includes('--daemon')) {
      console.log('Running in daemon mode...');
      // Keep running
      setInterval(() => {}, 1000);
    } else {
      await sync.startInteractiveMode();
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default CrossSessionSync;