#!/usr/bin/env node

/**
 * ChittyChat Native macOS Application Entry Point
 * Integrates with ChittyOS Standard Framework for native deployment
 */

import { ChittyChatUniversalApp } from './src/native/ChittyChatApp.js';
import { ChittyOSFramework } from '@chittyos/standard-installer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ChittyChatNativeApp {
  constructor() {
    this.appName = 'ChittyChat';
    this.appVersion = '1.0.0';
    this.appDirectory = __dirname;
    this.framework = new ChittyOSFramework({
      appName: this.appName,
      appPath: this.appDirectory,
      enableNativeIntegration: true,
      enableMenuBar: true,
      enableSystemTray: true
    });
  }

  async initialize() {
    console.log(`🚀 Initializing ${this.appName} v${this.appVersion}`);

    // Register with ChittyOS ecosystem
    await this.framework.registerApp({
      name: this.appName,
      type: 'ai-coordination',
      capabilities: [
        'notion-sync',
        'ai-agents',
        'multi-tenant',
        'database-branching',
        'vector-search'
      ],
      endpoints: {
        ai: 'agents.chitty.cc',
        unified: 'unified.chitty.cc',
        local: 'localhost:3006'
      }
    });

    // Setup native macOS integration
    await this.setupNativeIntegration();

    // Initialize services
    await this.initializeServices();

    console.log('✅ ChittyChat Native App initialized successfully');
  }

  async setupNativeIntegration() {
    // Create native application bundle structure
    await this.framework.createAppBundle({
      bundleIdentifier: 'cc.chitty.chittychat',
      displayName: 'ChittyChat AI Coordination',
      iconPath: './assets/chittychat-icon.icns',
      category: 'productivity'
    });

    // Setup menu bar integration
    await this.framework.setupMenuBar({
      title: 'ChittyChat',
      icon: './assets/menubar-icon.png',
      menu: [
        { label: 'Open Dashboard', action: 'openDashboard' },
        { label: 'AI Agents', action: 'openAgents' },
        { label: 'Notion Sync', action: 'openNotionSync' },
        { type: 'separator' },
        { label: 'Settings', action: 'openSettings' },
        { label: 'Quit', action: 'quit' }
      ]
    });

    // Setup system tray
    await this.framework.setupSystemTray({
      icon: './assets/tray-icon.png',
      tooltip: 'ChittyChat AI Coordination'
    });
  }

  async initializeServices() {
    const app = new ChittyChatUniversalApp({
      mode: 'native',
      dataPath: this.framework.getDataPath(),
      configPath: this.framework.getConfigPath(),
      logPath: this.framework.getLogPath()
    });

    await app.initialize();

    // Register native handlers
    this.framework.on('openDashboard', () => app.openDashboard());
    this.framework.on('openAgents', () => app.openAgentsPanel());
    this.framework.on('openNotionSync', () => app.openNotionSync());
    this.framework.on('openSettings', () => app.openSettings());

    return app;
  }

  async start() {
    try {
      await this.initialize();

      // Start the native application
      await this.framework.start();

      console.log('🎯 ChittyChat Native App is running');
      console.log('📱 Access via menu bar or system tray');

    } catch (error) {
      console.error('❌ Failed to start ChittyChat Native App:', error);
      process.exit(1);
    }
  }
}

// Start the native application
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new ChittyChatNativeApp();
  app.start();
}

export default ChittyChatNativeApp;