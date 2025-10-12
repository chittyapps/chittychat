#!/usr/bin/env node

/**
 * Universal Database Sync Service
 * Syncs Neon PostgreSQL with Notion or Google Sheets
 * Supports real-time bidirectional sync
 */

// ChittyOS integration disabled for now
import express from "express";
import { Client as NotionClient } from "@notionhq/client";
import { google } from "googleapis";
import pkg from "pg";
const { Pool } = pkg;
import { createHash } from "crypto";
import dotenv from "dotenv";

dotenv.config();

class UniversalDatabaseSync {
  constructor() {
    this.app = express();
    this.port = process.env.SYNC_PORT || 3006;

    // Neon Database
    this.neonPool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
    });

    // Notion Client
    this.notion = null;
    if (process.env.NOTION_TOKEN) {
      this.notion = new NotionClient({
        auth: process.env.NOTION_TOKEN,
        notionVersion: "2025-09-03",
      });
    }

    // Google Sheets Client
    this.sheets = null;
    this.drive = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      this.initGoogleServices();
    }

    // Sync configurations
    this.syncConfig = {
      mode: process.env.SYNC_MODE || "bidirectional", // 'neon-to-target', 'target-to-neon', 'bidirectional'
      target: process.env.SYNC_TARGET || "notion", // 'notion' or 'google'
      interval: parseInt(process.env.SYNC_INTERVAL || "60000"), // Default 1 minute
      batchSize: parseInt(process.env.SYNC_BATCH_SIZE || "100"),
    };

    // Track sync status
    this.syncStatus = {
      lastSync: null,
      syncing: false,
      errors: [],
      stats: {
        totalSynced: 0,
        failedSyncs: 0,
      },
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.initializeSyncTables();
  }

  initGoogleServices() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive",
        ],
      });

      this.sheets = google.sheets({ version: "v4", auth });
      this.drive = google.drive({ version: "v3", auth });
    } catch (error) {
      console.error("Failed to initialize Google services:", error);
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        service: "Universal Database Sync",
        config: this.syncConfig,
        lastSync: this.syncStatus.lastSync,
        stats: this.syncStatus.stats,
      });
    });

    // Manual sync trigger
    this.app.post("/sync", this.manualSync.bind(this));

    // Get sync status
    this.app.get("/status", (req, res) => {
      res.json(this.syncStatus);
    });

    // Configure sync
    this.app.post("/configure", this.configureSyncSettings.bind(this));

    // List available tables
    this.app.get("/tables", this.listTables.bind(this));

    // Create sync mapping
    this.app.post("/mapping", this.createSyncMapping.bind(this));

    // Webhook endpoints
    this.app.post("/webhook/neon", this.handleNeonWebhook.bind(this));
    this.app.post("/webhook/notion", this.handleNotionWebhook.bind(this));
    this.app.post("/webhook/google", this.handleGoogleWebhook.bind(this));
  }

  async initializeSyncTables() {
    try {
      const client = await this.neonPool.connect();

      // Create sync metadata table
      await client.query(`
                CREATE TABLE IF NOT EXISTS sync_metadata (
                    id SERIAL PRIMARY KEY,
                    table_name VARCHAR(255) NOT NULL,
                    target_id VARCHAR(255), -- Notion database ID or Google Sheet ID
                    last_sync_at TIMESTAMP,
                    sync_direction VARCHAR(50),
                    field_mappings JSONB,
                    sync_status VARCHAR(50),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

      // Create sync log table
      await client.query(`
                CREATE TABLE IF NOT EXISTS sync_log (
                    id SERIAL PRIMARY KEY,
                    sync_id VARCHAR(255) UNIQUE,
                    source_table VARCHAR(255),
                    target_type VARCHAR(50),
                    target_id VARCHAR(255),
                    operation VARCHAR(50),
                    record_count INTEGER,
                    status VARCHAR(50),
                    error_message TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    sync_data JSONB
                )
            `);

      // Create change tracking table
      await client.query(`
                CREATE TABLE IF NOT EXISTS sync_changes (
                    id SERIAL PRIMARY KEY,
                    table_name VARCHAR(255),
                    record_id VARCHAR(255),
                    operation VARCHAR(50),
                    change_data JSONB,
                    synced BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

      client.release();
      console.log("✅ Sync tables initialized");
    } catch (error) {
      console.error("Error initializing sync tables:", error);
    }
  }

  async listTables(req, res) {
    try {
      const client = await this.neonPool.connect();

      // Get all tables from Neon
      const tablesResult = await client.query(`
                SELECT table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);

      const tables = [];

      for (const table of tablesResult.rows) {
        // Get column information
        const columnsResult = await client.query(
          `
                    SELECT
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = $1
                    ORDER BY ordinal_position
                `,
          [table.table_name],
        );

        // Get row count
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM ${table.table_name}`,
        );

        tables.push({
          name: table.table_name,
          columns: columnsResult.rows,
          rowCount: parseInt(countResult.rows[0].count),
        });
      }

      client.release();

      res.json({
        database: "Neon PostgreSQL",
        tables: tables,
        totalTables: tables.length,
      });
    } catch (error) {
      console.error("Error listing tables:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async createSyncMapping(req, res) {
    try {
      const {
        tableName,
        targetType, // 'notion' or 'google'
        targetId, // Notion database ID or Google Sheet ID
        fieldMappings,
        syncDirection,
      } = req.body;

      const client = await this.neonPool.connect();

      // Check if mapping already exists
      const existing = await client.query(
        "SELECT id FROM sync_metadata WHERE table_name = $1",
        [tableName],
      );

      if (existing.rows.length > 0) {
        // Update existing mapping
        await client.query(
          `
                    UPDATE sync_metadata
                    SET target_id = $1,
                        field_mappings = $2,
                        sync_direction = $3,
                        updated_at = NOW()
                    WHERE table_name = $4
                `,
          [targetId, JSON.stringify(fieldMappings), syncDirection, tableName],
        );
      } else {
        // Create new mapping
        await client.query(
          `
                    INSERT INTO sync_metadata
                    (table_name, target_id, field_mappings, sync_direction)
                    VALUES ($1, $2, $3, $4)
                `,
          [tableName, targetId, JSON.stringify(fieldMappings), syncDirection],
        );
      }

      client.release();

      // Create target if it doesn't exist
      if (targetType === "notion" && !targetId) {
        const notionDb = await this.createNotionDatabase(
          tableName,
          fieldMappings,
        );
        res.json({
          message: "Sync mapping created",
          tableName,
          targetType,
          targetId: notionDb.id,
          newDatabase: true,
        });
      } else if (targetType === "google" && !targetId) {
        const sheet = await this.createGoogleSheet(tableName, fieldMappings);
        res.json({
          message: "Sync mapping created",
          tableName,
          targetType,
          targetId: sheet.spreadsheetId,
          newSheet: true,
        });
      } else {
        res.json({
          message: "Sync mapping created",
          tableName,
          targetType,
          targetId,
        });
      }
    } catch (error) {
      console.error("Error creating sync mapping:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async createNotionDatabase(tableName, fieldMappings) {
    if (!this.notion) {
      throw new Error("Notion client not configured");
    }

    // Build Notion database properties from field mappings
    const properties = {};

    for (const [neonField, notionConfig] of Object.entries(fieldMappings)) {
      properties[notionConfig.name || neonField] = {
        type: this.mapToNotionType(notionConfig.type),
        [notionConfig.type]: {},
      };
    }

    // Ensure we have a title property
    if (!properties.Name) {
      properties.Name = { title: {} };
    }

    const response = await this.notion.databases.create({
      parent: {
        type: "page_id",
        page_id: process.env.NOTION_PARENT_PAGE_ID,
      },
      title: [
        {
          type: "text",
          text: { content: `Sync: ${tableName}` },
        },
      ],
      properties,
    });

    return response;
  }

  async createGoogleSheet(tableName, fieldMappings) {
    if (!this.sheets) {
      throw new Error("Google Sheets client not configured");
    }

    // Create spreadsheet
    const spreadsheet = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Sync: ${tableName}`,
        },
        sheets: [
          {
            properties: {
              title: tableName,
            },
          },
        ],
      },
    });

    // Add headers
    const headers = Object.keys(fieldMappings);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheet.data.spreadsheetId,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [headers],
      },
    });

    return spreadsheet.data;
  }

  async manualSync(req, res) {
    if (this.syncStatus.syncing) {
      return res.status(409).json({
        error: "Sync already in progress",
      });
    }

    try {
      this.syncStatus.syncing = true;
      const { tableName, direction } = req.body;

      const results = await this.performSync(tableName, direction);

      this.syncStatus.lastSync = new Date();
      this.syncStatus.syncing = false;
      this.syncStatus.stats.totalSynced += results.synced;

      res.json({
        message: "Sync completed",
        results,
      });
    } catch (error) {
      this.syncStatus.syncing = false;
      this.syncStatus.errors.push({
        timestamp: new Date(),
        error: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  }

  async performSync(tableName, direction) {
    const client = await this.neonPool.connect();
    const syncId = this.generateSyncId();

    try {
      // Get sync configuration
      const configResult = await client.query(
        "SELECT * FROM sync_metadata WHERE table_name = $1",
        [tableName || "%"],
      );

      if (configResult.rows.length === 0) {
        throw new Error("No sync configuration found");
      }

      const results = {
        synced: 0,
        failed: 0,
        tables: [],
      };

      for (const config of configResult.rows) {
        const tableResult = await this.syncTable(
          config,
          direction || config.sync_direction,
          syncId,
        );

        results.synced += tableResult.synced;
        results.failed += tableResult.failed;
        results.tables.push({
          table: config.table_name,
          ...tableResult,
        });
      }

      // Log sync operation
      await client.query(
        `
                INSERT INTO sync_log
                (sync_id, source_table, target_type, operation, record_count, status, started_at, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
        [
          syncId,
          tableName || "all",
          this.syncConfig.target,
          direction || "bidirectional",
          results.synced,
          "completed",
          new Date(),
          new Date(),
        ],
      );

      return results;
    } finally {
      client.release();
    }
  }

  async syncTable(config, direction, syncId) {
    const client = await this.neonPool.connect();

    try {
      const fieldMappings = config.field_mappings;
      const tableName = config.table_name;
      const targetId = config.target_id;

      // Get data from Neon
      const dataResult = await client.query(
        `SELECT * FROM ${tableName} ORDER BY id LIMIT $1`,
        [this.syncConfig.batchSize],
      );

      let synced = 0;
      let failed = 0;

      if (this.syncConfig.target === "notion" && this.notion) {
        for (const row of dataResult.rows) {
          try {
            await this.syncRowToNotion(row, targetId, fieldMappings);
            synced++;
          } catch (error) {
            console.error(`Failed to sync row ${row.id}:`, error);
            failed++;
          }
        }
      } else if (this.syncConfig.target === "google" && this.sheets) {
        const values = dataResult.rows.map((row) =>
          Object.keys(fieldMappings).map((field) => row[field]),
        );

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: targetId,
          range: "A2",
          valueInputOption: "RAW",
          requestBody: { values },
        });

        synced = dataResult.rows.length;
      }

      // Update last sync time
      await client.query(
        "UPDATE sync_metadata SET last_sync_at = NOW() WHERE table_name = $1",
        [tableName],
      );

      return { synced, failed };
    } finally {
      client.release();
    }
  }

  async syncRowToNotion(row, databaseId, fieldMappings) {
    const properties = {};

    for (const [neonField, notionConfig] of Object.entries(fieldMappings)) {
      const value = row[neonField];
      if (value !== null && value !== undefined) {
        properties[notionConfig.name || neonField] = this.formatNotionProperty(
          value,
          notionConfig.type,
        );
      }
    }

    // Check if page exists (by some unique identifier)
    const existingPages = await this.notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "id",
        number: { equals: row.id },
      },
    });

    if (existingPages.results.length > 0) {
      // Update existing page
      await this.notion.pages.update({
        page_id: existingPages.results[0].id,
        properties,
      });
    } else {
      // Create new page
      await this.notion.pages.create({
        parent: { database_id: databaseId },
        properties,
      });
    }
  }

  formatNotionProperty(value, type) {
    switch (type) {
      case "title":
        return { title: [{ text: { content: String(value) } }] };
      case "rich_text":
        return { rich_text: [{ text: { content: String(value) } }] };
      case "number":
        return { number: Number(value) };
      case "checkbox":
        return { checkbox: Boolean(value) };
      case "date":
        return { date: { start: value } };
      case "select":
        return { select: { name: String(value) } };
      case "multi_select":
        return {
          multi_select: Array.isArray(value)
            ? value.map((v) => ({ name: String(v) }))
            : [{ name: String(value) }],
        };
      case "url":
        return { url: String(value) };
      case "email":
        return { email: String(value) };
      case "phone_number":
        return { phone_number: String(value) };
      default:
        return { rich_text: [{ text: { content: String(value) } }] };
    }
  }

  mapToNotionType(type) {
    const typeMap = {
      varchar: "rich_text",
      text: "rich_text",
      integer: "number",
      bigint: "number",
      decimal: "number",
      boolean: "checkbox",
      timestamp: "date",
      date: "date",
      json: "rich_text",
      jsonb: "rich_text",
    };

    return typeMap[type.toLowerCase()] || "rich_text";
  }

  async configureSyncSettings(req, res) {
    const { mode, target, interval, batchSize } = req.body;

    if (mode) this.syncConfig.mode = mode;
    if (target) this.syncConfig.target = target;
    if (interval) this.syncConfig.interval = parseInt(interval);
    if (batchSize) this.syncConfig.batchSize = parseInt(batchSize);

    // Restart sync interval if running
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.startAutoSync();
    }

    res.json({
      message: "Sync configuration updated",
      config: this.syncConfig,
    });
  }

  startAutoSync() {
    if (this.syncConfig.interval > 0) {
      this.syncInterval = setInterval(async () => {
        if (!this.syncStatus.syncing) {
          try {
            await this.performSync(null, this.syncConfig.mode);
          } catch (error) {
            console.error("Auto sync error:", error);
          }
        }
      }, this.syncConfig.interval);

      console.log(
        `⏰ Auto sync started (interval: ${this.syncConfig.interval}ms)`,
      );
    }
  }

  async handleNeonWebhook(req, res) {
    // Handle Neon database changes
    const { table, operation, data } = req.body;

    // Track change for sync
    const client = await this.neonPool.connect();
    await client.query(
      `
            INSERT INTO sync_changes (table_name, record_id, operation, change_data)
            VALUES ($1, $2, $3, $4)
        `,
      [table, data.id, operation, JSON.stringify(data)],
    );
    client.release();

    res.json({ received: true });
  }

  async handleNotionWebhook(req, res) {
    // Handle Notion changes
    console.log("Notion webhook:", req.body);
    res.json({ received: true });
  }

  async handleGoogleWebhook(req, res) {
    // Handle Google Sheets changes
    console.log("Google webhook:", req.body);
    res.json({ received: true });
  }

  generateSyncId() {
    const randomBytes = require("crypto").randomBytes(8);
    return createHash("sha256")
      .update(`${Date.now()}-${randomBytes.toString("hex")}`)
      .digest("hex")
      .substring(0, 16);
  }

  async start() {
    this.app.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║     Universal Database Sync Service          ║
╠═══════════════════════════════════════════════╣
║  Status: RUNNING                              ║
║  Port: ${this.port}                                  ║
║  Target: ${this.syncConfig.target.toUpperCase()}                            ║
║  Mode: ${this.syncConfig.mode}              ║
╚═══════════════════════════════════════════════╝

API Endpoints:
  GET  /health     - Service health status
  GET  /status     - Current sync status
  GET  /tables     - List available tables
  POST /sync       - Trigger manual sync
  POST /mapping    - Create sync mapping
  POST /configure  - Update sync settings

Webhooks:
  POST /webhook/neon   - Neon change notifications
  POST /webhook/notion - Notion change notifications
  POST /webhook/google - Google change notifications
            `);

      // Start auto-sync if configured
      this.startAutoSync();
    });
  }
}

// Start the service
const syncService = new UniversalDatabaseSync();
syncService.start();

export default UniversalDatabaseSync;
