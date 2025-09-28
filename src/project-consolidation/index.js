/**
 * ChittyChat Project Consolidation System
 * "GitHub for AI Project Management"
 *
 * Main entry point for project consolidation, system file reorganization,
 * and parallel session conflict detection
 */

import { UnifiedProjectManager } from './unified-project-manager.js';
import { CrossPlatformSync } from './cross-platform-sync.js';
import { GitHubOrchestrator } from './github-orchestrator.js';
import { ProjectRouter } from './project-router.js';
import { SessionConflictDetector } from './session-conflict-detector.js';

export class ChittyChatConsolidation {
  constructor(config = {}) {
    // Configuration
    this.config = {
      githubToken: config.githubToken || process.env.GITHUB_TOKEN,
      chittyIdToken: config.chittyIdToken || process.env.CHITTY_ID_TOKEN,
      notionToken: config.notionToken || process.env.NOTION_TOKEN,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      cloudflareAccountId: config.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID,
      ...config,
    };

    // Initialize all components
    this.projectManager = new UnifiedProjectManager(this.config);
    this.platformSync = new CrossPlatformSync(this.config);
    this.githubOrchestrator = new GitHubOrchestrator(this.config);
    this.projectRouter = new ProjectRouter(this.config);
    this.conflictDetector = new SessionConflictDetector(this.config);

    // Track consolidation state
    this.isRunning = false;
    this.lastSync = null;
    this.syncInterval = null;
  }

  /**
   * Initialize the consolidation system
   */
  async initialize() {
    console.log('🚀 Initializing ChittyChat Consolidation System...');
    console.log('   "GitHub for AI Project Management"');

    // Initialize all components
    const results = await Promise.all([
      this.projectManager.initialize(),
      this.projectRouter.initialize(),
      this.githubOrchestrator.initialize(),
    ]);

    // Start conflict monitoring
    await this.conflictDetector.startRealtimeMonitoring();

    console.log('✅ ChittyChat Consolidation System initialized');

    return {
      projectManager: results[0],
      projectRouter: results[1],
      githubOrchestrator: 'ready',
      conflictMonitoring: 'active',
    };
  }

  /**
   * Run full consolidation cycle
   */
  async consolidate() {
    if (this.isRunning) {
      console.log('⚠️ Consolidation already in progress');
      return null;
    }

    this.isRunning = true;
    console.log('🔄 Starting full consolidation cycle...');

    try {
      // Step 1: Check for conflicts first
      const conflicts = await this.conflictDetector.monitorSessions();
      if (conflicts.conflicts > 0) {
        console.log(
          `⚠️ ${conflicts.conflicts} conflicts detected - resolving before consolidation`
        );
      }

      // Step 2: Local project consolidation
      console.log('📁 Consolidating local projects...');
      const localResults = await this.projectManager.consolidateProjects();

      // Step 3: Route files to appropriate repositories
      console.log('🚀 Routing files to project repositories...');
      const routingResults = await this.projectRouter.reorganizeSystemFiles();

      // Step 4: Cross-platform synchronization
      console.log('🌐 Synchronizing across platforms...');
      const syncResults = await this.platformSync.syncAcrossAll();

      // Step 5: GitHub orchestration
      console.log('🐙 Orchestrating via GitHub...');
      const orchestrationResults = await this.githubOrchestrator.orchestrateSystemFiles();

      // Update last sync time
      this.lastSync = new Date().toISOString();

      const summary = {
        timestamp: this.lastSync,
        conflicts: conflicts.conflicts,
        localProjects: localResults.projects,
        filesRouted: routingResults.length,
        platformsSynced: Object.keys(syncResults.platforms).length,
        githubPR: orchestrationResults?.number,
        status: 'success',
      };

      console.log('✅ Consolidation complete:', summary);

      return summary;
    } catch (error) {
      console.error('❌ Consolidation failed:', error);
      return {
        timestamp: new Date().toISOString(),
        status: 'failed',
        error: error.message,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync specific topic across all projects
   */
  async syncTopic(topic) {
    console.log(`🎯 Syncing topic: ${topic}`);

    // Find all projects related to topic
    const relatedProjects = await this.projectManager.syncByTopic(topic);

    // Route topic-specific files
    const topicFiles = [];
    for (const project of relatedProjects) {
      for (const file of project.files) {
        if (file.content?.includes(topic)) {
          const result = await this.projectRouter.routeFile(file.path, file.content, {
            topic,
            project: project.name,
          });
          if (result?.success) {
            topicFiles.push(result);
          }
        }
      }
    }

    // Create topic-specific GitHub issue for tracking
    await this.githubOrchestrator.createProjectIssue({
      name: `Topic: ${topic}`,
      metadata: {
        type: 'topic-sync',
        projects: relatedProjects.map((p) => p.name),
        files: topicFiles.length,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      topic,
      projects: relatedProjects.length,
      files: topicFiles.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle file modification across sessions
   */
  async handleFileModification(filePath, content, sessionId) {
    console.log(`📝 File modified in session ${sessionId}: ${filePath}`);

    // Quick conflict check
    const conflicts = await this.conflictDetector.quickConflictCheck(filePath);

    if (conflicts) {
      console.log('⚠️ Conflict detected - coordinating sessions');
      // Conflict detected, handle appropriately
      return {
        status: 'conflict',
        message: 'File being modified in multiple sessions',
      };
    }

    // Route file to appropriate repository
    const routing = await this.projectRouter.routeFile(filePath, content, {
      sessionId,
      action: 'modify',
    });

    return routing;
  }

  /**
   * Start automatic consolidation
   */
  async startAutoConsolidation(intervalMinutes = 30) {
    console.log(`⏰ Starting automatic consolidation every ${intervalMinutes} minutes`);

    // Initial consolidation
    await this.consolidate();

    // Set up interval
    this.syncInterval = setInterval(
      async () => {
        console.log('⏰ Running scheduled consolidation...');
        await this.consolidate();
      },
      intervalMinutes * 60 * 1000
    );

    // Also watch for changes
    await this.watchForChanges();

    return {
      status: 'started',
      interval: `${intervalMinutes} minutes`,
      nextRun: new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString(),
    };
  }

  /**
   * Stop automatic consolidation
   */
  stopAutoConsolidation() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Stopped automatic consolidation');
    }

    this.conflictDetector.stopMonitoring();

    return { status: 'stopped' };
  }

  /**
   * Watch for changes and trigger consolidation
   */
  async watchForChanges() {
    const chokidar = require('chokidar');

    const watcher = chokidar.watch('/Users/nb/.claude/projects', {
      ignored: /(^|[\/\\])\..|node_modules/,
      persistent: true,
      depth: 3,
    });

    let changeTimeout;

    watcher.on('change', (path) => {
      // Debounce changes
      clearTimeout(changeTimeout);
      changeTimeout = setTimeout(async () => {
        console.log(`📝 Changes detected, triggering consolidation...`);
        await this.consolidate();
      }, 5000); // Wait 5 seconds after last change
    });

    console.log('👁️ Watching for changes...');
  }

  /**
   * Get consolidation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      autoSync: this.syncInterval ? 'active' : 'inactive',
      components: {
        projectManager: this.projectManager.getStatus(),
        conflictDetector: {
          activeSessions: this.conflictDetector.activeSessions.size,
          alerts: this.conflictDetector.conflictAlerts.size,
        },
        projectRouter: {
          projects: this.projectRouter.projectRepos.size,
        },
      },
    };
  }

  /**
   * Generate consolidation report
   */
  async generateReport() {
    const status = this.getStatus();
    const conflicts = await this.conflictDetector.monitorSessions();

    const report = {
      title: 'ChittyChat Consolidation Report',
      generated: new Date().toISOString(),
      status,
      conflicts: conflicts.alerts,
      summary: {
        totalProjects: status.components.projectManager.projects,
        totalWorktrees: status.components.projectManager.worktrees,
        activeSessions: status.components.conflictDetector.activeSessions,
        pendingAlerts: status.components.conflictDetector.alerts,
        lastSync: this.lastSync,
      },
      recommendations: [],
    };

    // Add recommendations based on current state
    if (conflicts.conflicts > 0) {
      report.recommendations.push('Resolve session conflicts before next consolidation');
    }

    if (status.components.projectManager.duplicates > 5) {
      report.recommendations.push('High number of duplicates detected - consider cleanup');
    }

    if (!this.syncInterval) {
      report.recommendations.push('Enable automatic consolidation for continuous sync');
    }

    return report;
  }

  /**
   * Export for Cloudflare Worker integration
   */
  async handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/consolidate' && request.method === 'POST') {
      const result = await this.consolidate();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/status' && request.method === 'GET') {
      const status = this.getStatus();
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/report' && request.method === 'GET') {
      const report = await this.generateReport();
      return new Response(JSON.stringify(report), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname.startsWith('/topic/') && request.method === 'POST') {
      const topic = pathname.replace('/topic/', '');
      const result = await this.syncTopic(topic);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('ChittyChat Consolidation System', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Export all components for individual use
export {
  UnifiedProjectManager,
  CrossPlatformSync,
  GitHubOrchestrator,
  ProjectRouter,
  SessionConflictDetector,
};

// Default export
export default ChittyChatConsolidation;
