/**
 * ChittyChat Universal Native Application
 * Integrates AI agents, Notion sync, and native macOS features
 */

import { NeonAICoordinator } from '../ai/neon-ai-coordinator.js';
import { NotionAIIntegration } from '../ai/notion-ai-integration.js';
import { NeonAuthIntegration } from '../ai/neon-auth-integration.js';
import { spawn } from 'child_process';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';

export class ChittyChatUniversalApp {
  constructor(config = {}) {
    this.mode = config.mode || 'native';
    this.dataPath = config.dataPath || './data';
    this.configPath = config.configPath || './config';
    this.logPath = config.logPath || './logs';

    this.services = {
      syncService: null,
      viewerService: null,
      aiCoordinator: null,
      notionAI: null,
      authService: null
    };

    this.webServer = null;
    this.isRunning = false;
  }

  async initialize() {
    console.log('🔧 Initializing ChittyChat Universal App...');

    // Create necessary directories
    await this.createDirectories();

    // Load configuration
    await this.loadConfiguration();

    // Initialize services
    await this.initializeServices();

    // Setup web interface
    await this.setupWebInterface();

    console.log('✅ ChittyChat Universal App initialized');
  }

  async createDirectories() {
    const dirs = [this.dataPath, this.configPath, this.logPath];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Warning: Could not create directory ${dir}:`, error.message);
      }
    }
  }

  async loadConfiguration() {
    const configFile = path.join(this.configPath, 'chittychat.json');

    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Create default configuration
      this.config = {
        services: {
          sync: { port: 3006, enabled: true },
          viewer: { port: 3007, enabled: true },
          web: { port: 3008, enabled: true }
        },
        ai: {
          maxAgents: 100,
          autoCleanup: true,
          cleanupHours: 168
        },
        notion: {
          syncInterval: 300000, // 5 minutes
          batchSize: 50,
          enableRealtimeSync: true
        },
        database: {
          enableBranching: true,
          enableVectorSearch: true,
          connectionPoolSize: 10
        }
      };

      await fs.writeFile(configFile, JSON.stringify(this.config, null, 2));
    }
  }

  async initializeServices() {
    // Load environment from 1Password
    const env = await this.loadEnvironment();

    // Initialize AI Coordinator
    this.services.aiCoordinator = new NeonAICoordinator({
      DATABASE_URL: env.NEON_DATABASE_URL,
      REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
      NEON_API_KEY: env.NEON_API_KEY,
      NEON_PROJECT_ID: env.NEON_PROJECT_ID
    });

    // Initialize Notion AI Integration
    this.services.notionAI = new NotionAIIntegration({
      DATABASE_URL: env.NEON_DATABASE_URL,
      REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
      NEON_API_KEY: env.NEON_API_KEY,
      NEON_PROJECT_ID: env.NEON_PROJECT_ID,
      NOTION_TOKEN: env.NOTION_TOKEN,
      NOTION_ENTITIES_DB: env.NOTION_ENTITIES_DB,
      NOTION_INFORMATION_DB: env.NOTION_INFORMATION_DB,
      NOTION_FACTS_DB: env.NOTION_FACTS_DB,
      NOTION_CONNECTIONS_DB: env.NOTION_CONNECTIONS_DB,
      NOTION_EVIDENCE_DB: env.NOTION_EVIDENCE_DB
    });

    // Initialize Auth Service
    this.services.authService = new NeonAuthIntegration({
      DATABASE_URL: env.NEON_DATABASE_URL,
      JWT_SECRET: env.JWT_SECRET || 'chittychat-native-secret',
      NEON_AUTH_URL: env.NEON_AUTH_URL,
      NEON_PROJECT_ID: env.NEON_PROJECT_ID
    });

    // Setup database schemas
    await this.services.aiCoordinator.setupAIDatabase();
    await this.services.authService.setupAuthSchema();
    await this.services.authService.setupAppRLS();
    await this.services.notionAI.setupAINotionIntegration();

    console.log('✅ All services initialized');
  }

  async loadEnvironment() {
    // Load from 1Password if available, otherwise use environment variables
    try {
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);

      // Try to load from 1Password
      const result = await exec('op', ['run', '--env-file=.env.1password', '--', 'node', '-e', 'console.log(JSON.stringify(process.env))']);
      return JSON.parse(result.stdout);
    } catch (error) {
      console.warn('1Password not available, using environment variables');
      return process.env;
    }
  }

  async setupWebInterface() {
    const app = express();

    app.use(express.json());
    app.use(express.static('public'));

    // Serve the dashboard
    app.get('/', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
    });

    // API routes
    app.use('/api/ai', this.createAIRoutes());
    app.use('/api/notion', this.createNotionRoutes());
    app.use('/api/auth', this.createAuthRoutes());
    app.use('/api/system', this.createSystemRoutes());

    this.webServer = app;
  }

  createAIRoutes() {
    const router = express.Router();

    router.post('/agents/create', async (req, res) => {
      try {
        const agent = await this.services.aiCoordinator.createAIAgent(req.body);
        res.json({ success: true, agent });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    router.get('/agents/list', async (req, res) => {
      try {
        const health = await this.services.aiCoordinator.getCoordinatorHealth();
        res.json({ success: true, health });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    router.post('/coordination/start', async (req, res) => {
      try {
        const { taskDescription, maxAgents } = req.body;
        const coordination = await this.services.aiCoordinator.coordinateAgents(taskDescription, maxAgents);
        res.json({ success: true, coordination });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    return router;
  }

  createNotionRoutes() {
    const router = express.Router();

    router.post('/entity/analyze', async (req, res) => {
      try {
        const { entityData, agentId } = req.body;
        const analysis = await this.services.notionAI.analyzeNotionEntity(entityData, agentId);
        res.json({ success: true, analysis });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    router.post('/insights/generate', async (req, res) => {
      try {
        const { entityIds, agentId } = req.body;
        const insights = await this.services.notionAI.generateInsightsFromNotionData(entityIds, agentId);
        res.json({ success: true, insights });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    router.get('/analytics', async (req, res) => {
      try {
        // Default tenant for native app
        const analytics = await this.services.notionAI.getNotionAIAnalytics('default-tenant');
        res.json({ success: true, analytics });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  createAuthRoutes() {
    const router = express.Router();

    router.post('/register', async (req, res) => {
      try {
        const { email, password, tenantName } = req.body;
        const result = await this.services.authService.registerUser(email, password, tenantName);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    router.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const result = await this.services.authService.authenticateUser(email, password);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(401).json({ error: error.message });
      }
    });

    return router;
  }

  createSystemRoutes() {
    const router = express.Router();

    router.get('/status', (req, res) => {
      res.json({
        status: this.isRunning ? 'running' : 'stopped',
        services: {
          sync: this.services.syncService ? 'running' : 'stopped',
          viewer: this.services.viewerService ? 'running' : 'stopped',
          ai: this.services.aiCoordinator ? 'initialized' : 'not_initialized',
          notion: this.services.notionAI ? 'initialized' : 'not_initialized'
        },
        config: this.config,
        uptime: process.uptime()
      });
    });

    router.post('/restart', async (req, res) => {
      try {
        await this.restart();
        res.json({ success: true, message: 'System restarted' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    return router;
  }

  async startSyncService() {
    if (this.config.services.sync.enabled) {
      console.log('🔄 Starting sync service...');

      this.services.syncService = spawn('node', ['neon-universal-sync.js'], {
        env: { ...process.env, SYNC_PORT: this.config.services.sync.port },
        stdio: 'pipe'
      });

      this.services.syncService.stdout.on('data', (data) => {
        console.log(`[Sync] ${data}`);
      });

      this.services.syncService.stderr.on('data', (data) => {
        console.error(`[Sync Error] ${data}`);
      });
    }
  }

  async startViewerService() {
    if (this.config.services.viewer.enabled) {
      console.log('👁️ Starting viewer service...');

      this.services.viewerService = spawn('node', ['chittyos-immutable-viewer.js'], {
        env: { ...process.env, VIEWER_PORT: this.config.services.viewer.port },
        stdio: 'pipe'
      });

      this.services.viewerService.stdout.on('data', (data) => {
        console.log(`[Viewer] ${data}`);
      });

      this.services.viewerService.stderr.on('data', (data) => {
        console.error(`[Viewer Error] ${data}`);
      });
    }
  }

  async startWebServer() {
    if (this.config.services.web.enabled) {
      const port = this.config.services.web.port;

      const server = createServer(this.webServer);

      server.listen(port, () => {
        console.log(`🌐 Web interface running on http://localhost:${port}`);
      });

      return server;
    }
  }

  async start() {
    console.log('🚀 Starting ChittyChat Universal App...');

    this.isRunning = true;

    // Start all services
    await this.startSyncService();
    await this.startViewerService();
    await this.startWebServer();

    console.log('✅ ChittyChat Universal App is running');
    console.log(`📱 Dashboard: http://localhost:${this.config.services.web.port}`);
    console.log(`🔄 Sync API: http://localhost:${this.config.services.sync.port}`);
    console.log(`👁️ Viewer: http://localhost:${this.config.services.viewer.port}`);
  }

  async stop() {
    console.log('🛑 Stopping ChittyChat Universal App...');

    this.isRunning = false;

    // Stop services
    if (this.services.syncService) {
      this.services.syncService.kill();
    }

    if (this.services.viewerService) {
      this.services.viewerService.kill();
    }

    console.log('✅ ChittyChat Universal App stopped');
  }

  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
  }

  // Native app interface methods
  async openDashboard() {
    const { spawn } = await import('child_process');
    spawn('open', [`http://localhost:${this.config.services.web.port}`]);
  }

  async openAgentsPanel() {
    const { spawn } = await import('child_process');
    spawn('open', [`http://localhost:${this.config.services.web.port}/agents`]);
  }

  async openNotionSync() {
    const { spawn } = await import('child_process');
    spawn('open', [`http://localhost:${this.config.services.web.port}/notion`]);
  }

  async openSettings() {
    const { spawn } = await import('child_process');
    spawn('open', [`http://localhost:${this.config.services.web.port}/settings`]);
  }

  async getStatus() {
    return {
      isRunning: this.isRunning,
      services: this.services,
      config: this.config,
      uptime: process.uptime()
    };
  }
}

export default ChittyChatUniversalApp;