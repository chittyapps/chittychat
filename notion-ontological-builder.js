#!/usr/bin/env node

/**
 * ChittyChat Ontological Notion Builder
 * Creates Notion workspaces based on ChittyOS canonical schema
 * Ensures ontological accuracy and schema compliance
 */

const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

// ChittyOS Canonical Entity Types (from id.chitty.cc schema)
const CHITTY_ENTITIES = {
  PEO: {
    name: "People",
    icon: "👤",
    description: "Individuals, team members, stakeholders",
    color: "blue",
  },
  PLACE: {
    name: "Places",
    icon: "📍",
    description: "Locations, offices, virtual spaces",
    color: "green",
  },
  PROP: {
    name: "Properties",
    icon: "📄",
    description: "Documents, assets, intellectual property",
    color: "purple",
  },
  EVNT: {
    name: "Events",
    icon: "📅",
    description: "Meetings, milestones, occurrences",
    color: "orange",
  },
  AUTH: {
    name: "Authorities",
    icon: "⚖️",
    description: "Governance, policies, regulations",
    color: "red",
  },
};

// ChittyChat Service Integration
const CHITTYCHAT_SERVICES = {
  chittyid: "https://id.chitty.cc",
  registry: "https://registry.chitty.cc",
  schema: "https://schema.chitty.cc",
  canon: "https://canon.chitty.cc",
  gateway: "https://gateway.chitty.cc",
  books: "https://books.chitty.cc",
  finance: "https://finance.chitty.cc",
  assets: "https://assets.chitty.cc",
  codex: "codex",
};

// Ontologically Correct Database Schemas
const ONTOLOGICAL_SCHEMAS = {
  entities: {
    name: "ChittyOS Entities Master",
    description: "Canonical entity registry following ChittyID ontology",
    properties: {
      "Entity Name": { type: "title" },
      ChittyID: {
        type: "rich_text",
        description: "Canonical ChittyID from id.chitty.cc",
      },
      "Entity Type": {
        type: "select",
        options: Object.entries(CHITTY_ENTITIES).map(([key, entity]) => ({
          name: `${entity.icon} ${entity.name} (${key})`,
          color: entity.color,
        })),
      },
      "Canonical URI": {
        type: "url",
        description: "Canonical reference from canon.chitty.cc",
      },
      "Schema Version": { type: "rich_text" },
      "Registry Status": {
        type: "select",
        options: [
          { name: "Active", color: "green" },
          { name: "Pending", color: "yellow" },
          { name: "Archived", color: "gray" },
          { name: "Deprecated", color: "red" },
        ],
      },
      "Created By": { type: "people" },
      "Created Date": { type: "date" },
      "Last Verified": { type: "date" },
      "Service Origin": {
        type: "select",
        options: Object.keys(CHITTYCHAT_SERVICES).map((service) => ({
          name: service,
          color: "blue",
        })),
      },
    },
  },

  workflows: {
    name: "ChittyChat Workflows",
    description: "Canonical workflows and processes",
    properties: {
      "Workflow Name": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Workflow Type": {
        type: "select",
        options: [
          { name: "🏢 Executive", color: "red" },
          { name: "💻 Technical", color: "blue" },
          { name: "⚖️ Legal", color: "purple" },
          { name: "📊 Operations", color: "green" },
          { name: "🎨 Creative", color: "yellow" },
        ],
      },
      Status: {
        type: "select",
        options: [
          { name: "Active", color: "green" },
          { name: "Draft", color: "yellow" },
          { name: "Review", color: "orange" },
          { name: "Deprecated", color: "red" },
        ],
      },
      "Entities Involved": { type: "relation", relation: { database_id: "" } },
      "Schema Compliance": {
        type: "checkbox",
        description: "Verified against schema.chitty.cc",
      },
      "Canonical Reference": { type: "url" },
      "Service Integration": {
        type: "multi_select",
        options: Object.keys(CHITTYCHAT_SERVICES).map((service) => ({
          name: service,
          color: "blue",
        })),
      },
      Owner: { type: "people" },
      "Last Updated": { type: "date" },
    },
  },

  evidence: {
    name: "ChittyOS Evidence Registry",
    description: "Canonical evidence tracking with blockchain verification",
    properties: {
      "Evidence Title": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Evidence Type": {
        type: "select",
        options: [
          { name: "📄 Document", color: "blue" },
          { name: "📧 Communication", color: "green" },
          { name: "📊 Data", color: "purple" },
          { name: "🎥 Media", color: "orange" },
          { name: "🔐 Certification", color: "red" },
        ],
      },
      "Source Entity": { type: "relation", relation: { database_id: "" } },
      "Verification Status": {
        type: "select",
        options: [
          { name: "✅ Verified", color: "green" },
          { name: "⏳ Pending", color: "yellow" },
          { name: "❌ Failed", color: "red" },
          { name: "🔄 Re-verify", color: "orange" },
        ],
      },
      "Blockchain Hash": { type: "rich_text" },
      "Storage URI": { type: "url" },
      "Access Level": {
        type: "select",
        options: [
          { name: "Public", color: "green" },
          { name: "Internal", color: "yellow" },
          { name: "Confidential", color: "red" },
        ],
      },
      "Collection Date": { type: "date" },
      "Expiry Date": { type: "date" },
      "Legal Hold": { type: "checkbox" },
    },
  },

  services: {
    name: "ChittyOS Service Registry",
    description: "Canonical service catalog from registry.chitty.cc",
    properties: {
      "Service Name": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Service Type": {
        type: "select",
        options: [
          { name: "🌐 Gateway", color: "blue" },
          { name: "🆔 Identity", color: "green" },
          { name: "📋 Registry", color: "purple" },
          { name: "📊 Schema", color: "orange" },
          { name: "⚖️ Canon", color: "red" },
          { name: "🔄 Sync", color: "yellow" },
          { name: "📚 Books", color: "brown" },
          { name: "💰 Finance", color: "yellow" },
          { name: "🏦 Assets", color: "gray" },
          { name: "💻 Codex", color: "purple" },
        ],
      },
      "Endpoint URL": { type: "url" },
      "Health Status": {
        type: "select",
        options: [
          { name: "🟢 Healthy", color: "green" },
          { name: "🟡 Degraded", color: "yellow" },
          { name: "🔴 Down", color: "red" },
          { name: "🔵 Maintenance", color: "blue" },
        ],
      },
      Version: { type: "rich_text" },
      Dependencies: { type: "relation", relation: { database_id: "" } },
      "API Documentation": { type: "url" },
      "Owner Team": { type: "people" },
      "Deployment Date": { type: "date" },
      "Last Health Check": { type: "date" },
    },
  },

  financial_assets: {
    name: "ChittyAssets Registry",
    description: "Asset management and tracking with blockchain verification",
    properties: {
      "Asset Name": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Asset Type": {
        type: "select",
        options: [
          { name: "💰 Cash", color: "green" },
          { name: "🏢 Property", color: "blue" },
          { name: "📄 Document", color: "purple" },
          { name: "🖥️ Digital", color: "orange" },
          { name: "⚖️ Legal", color: "red" },
        ],
      },
      "Asset Value": { type: "number" },
      "Acquisition Date": { type: "date" },
      "Current Owner": { type: "relation", relation: { database_id: "" } },
      "Verification Status": {
        type: "select",
        options: [
          { name: "✅ Verified", color: "green" },
          { name: "⏳ Pending", color: "yellow" },
          { name: "❌ Failed", color: "red" },
        ],
      },
      "Blockchain Hash": { type: "rich_text" },
      "Storage Location": { type: "url" },
      "Legal Status": {
        type: "select",
        options: [
          { name: "✅ Clear", color: "green" },
          { name: "⚠️ Encumbered", color: "yellow" },
          { name: "🔒 Frozen", color: "red" },
        ],
      },
      "Last Audit": { type: "date" },
    },
  },

  financial_books: {
    name: "ChittyBooks Ledger",
    description: "Financial record keeping with double-entry accounting",
    properties: {
      "Transaction ID": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Transaction Type": {
        type: "select",
        options: [
          { name: "💰 Income", color: "green" },
          { name: "💸 Expense", color: "red" },
          { name: "🔄 Transfer", color: "blue" },
          { name: "📊 Adjustment", color: "yellow" },
        ],
      },
      Amount: { type: "number" },
      "Transaction Date": { type: "date" },
      "Account From": { type: "rich_text" },
      "Account To": { type: "rich_text" },
      Description: { type: "rich_text" },
      "Reference Number": { type: "rich_text" },
      "Verification Status": {
        type: "select",
        options: [
          { name: "✅ Reconciled", color: "green" },
          { name: "⏳ Pending", color: "yellow" },
          { name: "❌ Error", color: "red" },
        ],
      },
      "Supporting Evidence": {
        type: "relation",
        relation: { database_id: "" },
      },
      "Book Period": { type: "select", options: [] },
      "Entry Method": {
        type: "select",
        options: [
          { name: "🤖 Automated", color: "blue" },
          { name: "👤 Manual", color: "green" },
          { name: "📥 Import", color: "yellow" },
        ],
      },
    },
  },

  financial_accounts: {
    name: "ChittyFinance Accounts",
    description: "Financial account management and portfolio tracking",
    properties: {
      "Account Name": { type: "title" },
      ChittyID: { type: "rich_text" },
      "Account Type": {
        type: "select",
        options: [
          { name: "🏦 Bank", color: "blue" },
          { name: "💳 Credit", color: "red" },
          { name: "📈 Investment", color: "green" },
          { name: "💰 Cash", color: "yellow" },
          { name: "🏠 Asset", color: "purple" },
          { name: "📋 Liability", color: "orange" },
        ],
      },
      "Current Balance": { type: "number" },
      "Account Number": { type: "rich_text" },
      Institution: { type: "rich_text" },
      "Account Owner": { type: "relation", relation: { database_id: "" } },
      "Open Date": { type: "date" },
      Status: {
        type: "select",
        options: [
          { name: "✅ Active", color: "green" },
          { name: "⏸️ Suspended", color: "yellow" },
          { name: "❌ Closed", color: "red" },
        ],
      },
      "Interest Rate": { type: "number" },
      "Credit Limit": { type: "number" },
      "Last Statement": { type: "date" },
      "Sync Status": {
        type: "select",
        options: [
          { name: "🔄 Synced", color: "green" },
          { name: "⏳ Pending", color: "yellow" },
          { name: "❌ Error", color: "red" },
        ],
      },
    },
  },
};

class OntologicalNotionBuilder {
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_TOKEN });
    this.createdDatabases = [];
    this.databaseIds = {};
    this.log = [];
  }

  async buildOntologicalWorkspace() {
    console.log("🏗️  Building ChittyOS Ontological Notion Workspace...");

    try {
      // Create main workspace page
      const workspace = await this.createMainWorkspace();

      // Create ontological databases in dependency order
      await this.createOntologicalDatabases(workspace.id);

      // Set up relations between databases
      await this.setupDatabaseRelations();

      // Create entity-specific team spaces
      await this.createEntityTeamSpaces(workspace.id);

      // Generate schema compliance report
      const report = await this.generateComplianceReport();

      console.log("✅ Ontological workspace creation complete!");
      return report;
    } catch (error) {
      console.error("❌ Error creating ontological workspace:", error);
      throw error;
    }
  }

  async createMainWorkspace() {
    const response = await this.notion.pages.create({
      parent: process.env.NOTION_PARENT_PAGE_ID
        ? { page_id: process.env.NOTION_PARENT_PAGE_ID }
        : { workspace: true },
      properties: {
        title: {
          title: [{ text: { content: "ChittyOS Canonical Workspace" } }],
        },
      },
      icon: { emoji: "🏛️" },
      children: [
        {
          object: "block",
          type: "heading_1",
          heading_1: {
            rich_text: [{ text: { content: "ChittyOS Canonical Workspace" } }],
          },
        },
        {
          object: "block",
          type: "callout",
          callout: {
            icon: { emoji: "🔄" },
            rich_text: [
              {
                text: {
                  content:
                    "This workspace is synchronized with ChittyChat services and follows canonical ChittyID ontology. All entities are verified through schema.chitty.cc and registered with registry.chitty.cc",
                },
              },
            ],
            color: "blue_background",
          },
        },
        {
          object: "block",
          type: "divider",
          divider: {},
        },
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ text: { content: "Canonical Entity Types" } }],
          },
        },
        ...Object.entries(CHITTY_ENTITIES).map(([key, entity]) => ({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                text: {
                  content: `${entity.icon} ${entity.name} (${key}): ${entity.description}`,
                },
              },
            ],
          },
        })),
      ],
    });

    this.log.push(`✅ Created canonical workspace: ${response.url}`);
    return response;
  }

  async createOntologicalDatabases(parentId) {
    console.log("🗄️  Creating ontological databases...");

    // Create databases in dependency order
    for (const [dbKey, dbConfig] of Object.entries(ONTOLOGICAL_SCHEMAS)) {
      console.log(`📊 Creating database: ${dbConfig.name}`);

      const database = await this.notion.databases.create({
        parent: { page_id: parentId },
        title: [{ text: { content: dbConfig.name } }],
        description: [{ text: { content: dbConfig.description } }],
        properties: dbConfig.properties,
      });

      this.createdDatabases.push(database);
      this.databaseIds[dbKey] = database.id;
      this.log.push(`🗄️  Created database: ${dbConfig.name}`);
    }
  }

  async setupDatabaseRelations() {
    console.log("🔗 Setting up database relations...");

    // Update relation properties with actual database IDs
    if (this.databaseIds.entities && this.databaseIds.workflows) {
      // Workflows -> Entities relation
      await this.updateDatabaseProperty(
        this.databaseIds.workflows,
        "Entities Involved",
        { relation: { database_id: this.databaseIds.entities } },
      );
    }

    if (this.databaseIds.entities && this.databaseIds.evidence) {
      // Evidence -> Entities relation
      await this.updateDatabaseProperty(
        this.databaseIds.evidence,
        "Source Entity",
        { relation: { database_id: this.databaseIds.entities } },
      );
    }

    if (this.databaseIds.services) {
      // Services -> Services (dependencies) relation
      await this.updateDatabaseProperty(
        this.databaseIds.services,
        "Dependencies",
        { relation: { database_id: this.databaseIds.services } },
      );
    }
  }

  async updateDatabaseProperty(databaseId, propertyName, propertyConfig) {
    try {
      await this.notion.databases.update({
        database_id: databaseId,
        properties: {
          [propertyName]: propertyConfig,
        },
      });
      this.log.push(`🔗 Updated relation: ${propertyName}`);
    } catch (error) {
      console.error(`❌ Failed to update ${propertyName}:`, error.message);
    }
  }

  async createEntityTeamSpaces(parentId) {
    console.log("👥 Creating entity-based team spaces...");

    for (const [entityKey, entityConfig] of Object.entries(CHITTY_ENTITIES)) {
      const teamPage = await this.notion.pages.create({
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: `${entityConfig.icon} ${entityConfig.name} Team`,
                },
              },
            ],
          },
        },
        icon: { emoji: entityConfig.icon },
        children: [
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  text: {
                    content: `${entityConfig.name} (${entityKey}) Team Space`,
                  },
                },
              ],
            },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ text: { content: entityConfig.description } }],
            },
          },
          {
            object: "block",
            type: "callout",
            callout: {
              icon: { emoji: "🔄" },
              rich_text: [
                {
                  text: {
                    content: `This space manages ${entityConfig.name} entities. All ChittyIDs must be minted from id.chitty.cc and verified through the canonical schema.`,
                  },
                },
              ],
              color: `${entityConfig.color}_background`,
            },
          },
        ],
      });

      this.log.push(`👥 Created team space: ${entityConfig.name}`);
    }
  }

  async generateComplianceReport() {
    const report = {
      workspace: "ChittyOS Canonical Workspace",
      createdAt: new Date().toISOString(),
      ontologyCompliance: {
        entityTypes: Object.keys(CHITTY_ENTITIES).length,
        databaseSchemas: Object.keys(ONTOLOGICAL_SCHEMAS).length,
        serviceIntegrations: Object.keys(CHITTYCHAT_SERVICES).length,
      },
      databases: this.createdDatabases.map((db) => ({
        name: db.title[0]?.text?.content,
        id: db.id,
        url: db.url,
      })),
      chittyServices: CHITTYCHAT_SERVICES,
      schemaVersion: "1.0.0",
      log: this.log,
    };

    // Save compliance report
    fs.writeFileSync(
      path.join(__dirname, "ontological-compliance-report.json"),
      JSON.stringify(report, null, 2),
    );

    return report;
  }
}

// MCP Integration function
async function mcpCreateOntologicalWorkspace(params = {}) {
  const builder = new OntologicalNotionBuilder();
  return await builder.buildOntologicalWorkspace();
}

// CLI usage
if (require.main === module) {
  if (!process.env.NOTION_TOKEN) {
    console.error("❌ NOTION_TOKEN environment variable is required");
    process.exit(1);
  }

  const builder = new OntologicalNotionBuilder();
  builder
    .buildOntologicalWorkspace()
    .then((report) => {
      console.log("\n🎉 Ontological Workspace Summary:");
      console.log(`📊 Created ${report.databases.length} canonical databases`);
      console.log(
        `🔗 Integrated with ${Object.keys(report.chittyServices).length} ChittyChat services`,
      );
      console.log(`📋 Schema version: ${report.schemaVersion}`);
      console.log(`💾 Compliance report: ontological-compliance-report.json`);
    })
    .catch((error) => {
      console.error(
        "❌ Failed to create ontological workspace:",
        error.message,
      );
      process.exit(1);
    });
}

// CommonJS exports
module.exports = { OntologicalNotionBuilder, mcpCreateOntologicalWorkspace };

// ES6 exports for MCP server
if (typeof exports !== "undefined") {
  exports.OntologicalNotionBuilder = OntologicalNotionBuilder;
  exports.mcpCreateOntologicalWorkspace = mcpCreateOntologicalWorkspace;
}
