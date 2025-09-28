#!/usr/bin/env node

/**
 * Unified .claude Configuration Service
 *
 * Pulls configurations from registry.chitty.cc (or migrated Neon database)
 * and ensures hierarchical updates are applied using canonical logic.
 *
 * Registry Integration:
 * - registry.chitty.cc serves as the single source of truth
 * - All ChittyOS services register their configurations
 * - Hierarchical inheritance from registry categories
 * - Real-time sync with registry updates
 *
 * Hierarchy:
 * 1. Registry Global Config
 * 2. Registry Category (services, tools, connectors)
 * 3. Registry Service Config (chittychat, chittyid, etc.)
 * 4. Local Environment Overrides
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { pgTable, text, json, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';
import { eq, and, or, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';

// Database schema for .claude configurations
const claudeConfigs = pgTable('claude_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  level: text('level').notNull(), // global, org, category, project, env
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  path: text('path').notNull(), // filesystem path
  config: json('config').notNull(), // the actual configuration
  version: integer('version').default(1),
  active: boolean('active').default(true),
  checksum: text('checksum'), // SHA256 of config for integrity
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  appliedAt: timestamp('applied_at'),
  chittyId: text('chitty_id') // ChittyID for audit trail
});

const configUpdates = pgTable('config_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  configId: uuid('config_id').notNull(),
  field: text('field').notNull(),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  reason: text('reason'),
  appliedBy: text('applied_by'),
  timestamp: timestamp('timestamp').defaultNow(),
  chittyId: text('chitty_id')
});

class ClaudeConfigService {
  constructor(databaseUrl) {
    const sql = neon(databaseUrl || process.env.DATABASE_URL);
    this.db = drizzle(sql);
    this.basePath = process.env.CLAUDE_BASE_PATH || '/Users/nb/.claude';
    this.registryUrl = process.env.REGISTRY_URL || 'https://registry.chitty.cc';
    this.canonUrl = process.env.CANON_URL || 'https://canon.chitty.cc';
    this.registryApiKey = process.env.REGISTRY_API_KEY;
  }

  /**
   * Fetch canonical merge rules from canon.chitty.cc
   */
  async fetchCanonicalRules() {
    try {
      const response = await fetch(`${this.canonUrl}/api/merge-rules`, {
        headers: {
          'Authorization': `Bearer ${this.registryApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Canon service returned ${response.status}`);
      }

      const rules = await response.json();

      // Canon.chitty.cc defines the authoritative merge strategies
      return {
        preserve: rules.preserve || [
          'context.CRITICAL_RULE',
          'context.generation_policy',
          'context.mothership_authority'
        ],
        union: rules.union || [
          'permissions',
          'tools',
          'capabilities',
          'allowed_operations'
        ],
        merge: rules.merge || [
          'services',
          'integrations',
          'dependencies'
        ],
        override: rules.override || [
          'env',
          'local_overrides',
          'development_settings'
        ],
        customStrategies: rules.customStrategies || {}
      };
    } catch (error) {
      console.warn(`Failed to fetch canonical rules: ${error.message}`);
      // Fallback to default rules if canon.chitty.cc is unavailable
      return this.getDefaultCanonicalRules();
    }
  }

  /**
   * Default canonical rules (used as fallback)
   */
  getDefaultCanonicalRules() {
    return {
      preserve: [
        'context.CRITICAL_RULE',
        'context.generation_policy',
        'context.mothership_authority'
      ],
      union: [
        'permissions',
        'tools'
      ],
      merge: [
        'services'
      ],
      override: [
        'env'
      ]
    };
  }

  /**
   * Fetch configuration from registry.chitty.cc
   */
  async fetchFromRegistry(serviceName) {
    try {
      const response = await fetch(`${this.registryUrl}/api/services/${serviceName}/config`, {
        headers: {
          'Authorization': `Bearer ${this.registryApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Registry returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch from registry: ${error.message}`);
      // Fall back to database
      return this.fetchFromDatabase(serviceName);
    }
  }

  /**
   * Migrate registry data to Neon database for unified storage
   */
  async migrateRegistryToNeon() {
    console.log('Migrating registry data to Neon database...');

    // Fetch all services from registry
    const response = await fetch(`${this.registryUrl}/api/services`, {
      headers: {
        'Authorization': `Bearer ${this.registryApiKey}`
      }
    });

    const services = await response.json();

    for (const service of services) {
      // Fetch full config for each service
      const config = await this.fetchFromRegistry(service.name);

      // Store in Neon database
      await this.db.insert(claudeConfigs).values({
        level: 'service',
        name: service.name,
        path: service.path || path.join(this.basePath, 'projects', '-', service.name),
        config: {
          ...config,
          registryId: service.id,
          category: service.category,
          tools: service.tools || [],
          permissions: service.permissions || [],
          dependencies: service.dependencies || []
        },
        checksum: this.generateChecksum(config),
        chittyId: service.chittyId
      }).onConflictDoUpdate({
        target: [claudeConfigs.name, claudeConfigs.level],
        set: {
          config: config,
          updatedAt: new Date()
        }
      });
    }

    console.log(`Migrated ${services.length} services to Neon database`);
    return services.length;
  }

  /**
   * Generate canonical configuration by merging hierarchical configs
   * Higher levels override lower levels using canonical merge logic
   */
  async generateCanonicalConfig(projectPath) {
    // Determine hierarchy levels for this project
    const levels = this.determineLevels(projectPath);

    // Fetch all applicable configs in hierarchical order
    const configs = await this.fetchHierarchicalConfigs(levels);

    // Apply canonical merge logic
    const canonical = this.mergeWithCanonicalLogic(configs);

    // Validate against schema
    this.validateCanonicalConfig(canonical);

    // Generate checksum for integrity
    canonical.checksum = this.generateChecksum(canonical);

    return canonical;
  }

  /**
   * Determine hierarchy levels from project path
   */
  determineLevels(projectPath) {
    const relativePath = path.relative(this.basePath, projectPath);
    const parts = relativePath.split(path.sep);

    const levels = [
      { level: 'global', path: this.basePath },
      { level: 'org', path: path.join(this.basePath, 'ChittyOS') }
    ];

    // Determine category from path structure
    if (parts.includes('projects')) {
      levels.push({ level: 'category', path: path.join(this.basePath, 'projects') });
    } else if (parts.includes('tools')) {
      levels.push({ level: 'category', path: path.join(this.basePath, 'tools') });
    } else if (parts.includes('connectors')) {
      levels.push({ level: 'category', path: path.join(this.basePath, 'connectors') });
    }

    // Add project level
    levels.push({ level: 'project', path: projectPath });

    // Add environment if specified
    const env = process.env.NODE_ENV || 'development';
    levels.push({ level: 'env', path: projectPath, env });

    return levels;
  }

  /**
   * Fetch configurations from database in hierarchical order
   */
  async fetchHierarchicalConfigs(levels) {
    const configs = [];

    for (const level of levels) {
      const config = await this.db
        .select()
        .from(claudeConfigs)
        .where(
          and(
            eq(claudeConfigs.level, level.level),
            eq(claudeConfigs.path, level.path),
            eq(claudeConfigs.active, true)
          )
        )
        .orderBy(desc(claudeConfigs.version))
        .limit(1);

      if (config[0]) {
        configs.push(config[0]);
      }
    }

    return configs;
  }

  /**
   * Merge configurations using canonical logic from canon.chitty.cc
   * The canonical service defines authoritative merge strategies
   */
  async mergeWithCanonicalLogic(configs) {
    // Fetch canonical rules from canon.chitty.cc
    const rules = await this.fetchCanonicalRules();

    const canonical = {
      name: 'ChittyOS Unified Configuration',
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      canonicalRulesVersion: rules.version || '1.0.0',
      canonicalRulesSource: this.canonUrl,
      hierarchy: []
    };

    // Build strategy map from canonical rules
    const strategies = {};

    // Map each rule type to its strategy
    rules.preserve.forEach(field => strategies[field] = 'preserve');
    rules.union.forEach(field => strategies[field] = 'union');
    rules.merge.forEach(field => strategies[field] = 'merge');
    rules.override.forEach(field => strategies[field] = 'override');

    // Apply custom strategies from canon.chitty.cc
    Object.assign(strategies, rules.customStrategies);

    for (const config of configs) {
      canonical.hierarchy.push({
        level: config.level,
        name: config.name,
        version: config.version,
        chittyId: config.chittyId
      });

      // Apply merge strategies defined by canon.chitty.cc
      this.deepMerge(canonical, config.config, strategies);
    }

    return canonical;
  }

  /**
   * Deep merge with custom strategies
   */
  deepMerge(target, source, strategies = {}) {
    for (const key in source) {
      const strategy = strategies[key] || 'default';

      switch (strategy) {
        case 'preserve':
          // Don't override if target already has value
          if (!target[key]) {
            target[key] = source[key];
          }
          break;

        case 'union':
          // Union arrays, deduplicate
          if (Array.isArray(target[key]) && Array.isArray(source[key])) {
            target[key] = [...new Set([...target[key], ...source[key]])];
          } else {
            target[key] = source[key];
          }
          break;

        case 'override':
          // Always use source value
          target[key] = source[key];
          break;

        case 'merge':
        case 'default':
          // Deep merge objects
          if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            this.deepMerge(target[key], source[key], strategies);
          } else {
            target[key] = source[key];
          }
          break;
      }
    }
  }

  /**
   * Validate canonical configuration against schema
   */
  validateCanonicalConfig(config) {
    // Ensure critical fields exist
    const requiredFields = [
      'name',
      'version',
      'context',
      'context.CRITICAL_RULE',
      'context.generation_policy'
    ];

    for (const field of requiredFields) {
      const value = field.split('.').reduce((obj, key) => obj?.[key], config);
      if (!value) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate ChittyID generation policy
    if (!config.context.generation_policy.sole_authority?.includes('id.chitty.cc')) {
      throw new Error('Invalid generation policy: mothership must be sole authority');
    }
  }

  /**
   * Generate SHA256 checksum for configuration
   */
  generateChecksum(config) {
    const content = JSON.stringify(config, null, 2);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Apply configuration to filesystem
   */
  async applyConfiguration(projectPath, config) {
    const configPath = path.join(projectPath, '.claude');

    // Create directory if it doesn't exist
    await fs.mkdir(configPath, { recursive: true });

    // Write individual configuration files
    const files = {
      'project.json': config.project || config,
      'CLAUDE.md': this.generateClaudeMd(config),
      'TODO.md': config.todo || '',
      'config.checksum': config.checksum
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = path.join(configPath, filename);
      const fileContent = typeof content === 'string'
        ? content
        : JSON.stringify(content, null, 2);

      await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    // Record update in database
    await this.recordUpdate(projectPath, config);
  }

  /**
   * Generate CLAUDE.md from configuration
   */
  generateClaudeMd(config) {
    let content = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`;

    // Add critical rules
    if (config.context?.CRITICAL_RULE) {
      content += `## CRITICAL RULES

${config.context.CRITICAL_RULE}

`;
    }

    // Add generation policy
    if (config.context?.generation_policy) {
      content += `## ChittyID Generation Policy

- ${config.context.generation_policy.sole_authority}
- ${config.context.generation_policy.mothership_capability}
- ${config.context.generation_policy.no_local_generation}
- ${config.context.generation_policy.no_fallback}

`;
    }

    // Add other sections dynamically
    if (config.commands) {
      content += `## Commands

\`\`\`bash
${Object.entries(config.commands)
  .map(([cmd, desc]) => `${cmd.padEnd(30)} # ${desc}`)
  .join('\n')}
\`\`\`

`;
    }

    return content;
  }

  /**
   * Record configuration update in database
   */
  async recordUpdate(projectPath, config) {
    const existing = await this.db
      .select()
      .from(claudeConfigs)
      .where(eq(claudeConfigs.path, projectPath))
      .limit(1);

    if (existing[0]) {
      // Update existing record
      await this.db
        .update(claudeConfigs)
        .set({
          config,
          version: existing[0].version + 1,
          checksum: config.checksum,
          updatedAt: new Date(),
          appliedAt: new Date()
        })
        .where(eq(claudeConfigs.id, existing[0].id));
    } else {
      // Create new record
      await this.db
        .insert(claudeConfigs)
        .values({
          level: 'project',
          name: path.basename(projectPath),
          path: projectPath,
          config,
          checksum: config.checksum,
          appliedAt: new Date()
        });
    }
  }

  /**
   * Sync all projects with canonical configurations
   */
  async syncAllProjects() {
    const projectDirs = await this.findAllProjects();
    const results = [];

    for (const projectDir of projectDirs) {
      try {
        const config = await this.generateCanonicalConfig(projectDir);
        await this.applyConfiguration(projectDir, config);
        results.push({ project: projectDir, status: 'success', checksum: config.checksum });
      } catch (error) {
        results.push({ project: projectDir, status: 'error', error: error.message });
      }
    }

    return results;
  }

  /**
   * Find all project directories
   */
  async findAllProjects() {
    const projects = [];
    const searchDirs = [
      path.join(this.basePath, 'projects'),
      path.join(this.basePath, 'tools'),
      path.join(this.basePath, 'connectors')
    ];

    for (const dir of searchDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            projects.push(path.join(dir, entry.name));
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    return projects;
  }

  /**
   * Watch for changes and auto-sync
   */
  async watchAndSync(interval = 60000) {
    console.log('Starting .claude configuration sync service...');

    // Initial sync
    const results = await this.syncAllProjects();
    console.log(`Initial sync complete: ${results.length} projects synchronized`);

    // Set up interval for periodic sync
    setInterval(async () => {
      const results = await this.syncAllProjects();
      const successful = results.filter(r => r.status === 'success').length;
      console.log(`[${new Date().toISOString()}] Synced ${successful}/${results.length} projects`);
    }, interval);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new ClaudeConfigService();

  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      // Migrate registry to Neon database
      service.migrateRegistryToNeon().then(count => {
        console.log(`Successfully migrated ${count} services from registry to Neon`);
      });
      break;

    case 'sync':
      service.syncAllProjects().then(results => {
        console.log('Sync results:', results);
      });
      break;

    case 'watch':
      service.watchAndSync();
      break;

    case 'apply':
      const projectPath = process.argv[3];
      service.generateCanonicalConfig(projectPath).then(config => {
        return service.applyConfiguration(projectPath, config);
      }).then(() => {
        console.log(`Configuration applied to ${projectPath}`);
      });
      break;

    case 'registry':
      // Fetch and display registry configuration
      const serviceName = process.argv[3];
      if (!serviceName) {
        console.error('Please specify a service name');
        process.exit(1);
      }
      service.fetchFromRegistry(serviceName).then(config => {
        console.log(JSON.stringify(config, null, 2));
      });
      break;

    default:
      console.log(`
Usage: node claude-config-service.js <command> [options]

Commands:
  migrate           Migrate registry data to Neon database
  sync              Synchronize all projects with canonical configs
  watch             Watch and auto-sync configurations
  apply <path>      Apply canonical config to specific project
  registry <name>   Fetch config from registry for a service
      `);
  }
}

export default ClaudeConfigService;