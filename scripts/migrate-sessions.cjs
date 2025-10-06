#!/usr/bin/env node
/**
 * migrate-sessions.js
 * Mint ChittyIDs for all legacy UUID-based sessions
 */

const fs = require("fs");
const path = require("path");
const ChittyIDClient = require("@chittyos/chittyid-client").default;

const TODOS_DIR = "/Users/nb/.claude/todos";
const MAPPING_FILE = "/Users/nb/.chittyos/session-id-mapping.json";

async function main() {
  console.log("=".repeat(50));
  console.log("ChittyOS Session ID Migration");
  console.log("=".repeat(50));

  // Validate prerequisites
  if (!process.env.CHITTY_ID_TOKEN) {
    console.error("❌ CHITTY_ID_TOKEN not set");
    process.exit(1);
  }

  const client = new ChittyIDClient({
    serviceUrl: "https://id.chitty.cc",
    apiKey: process.env.CHITTY_ID_TOKEN,
  });

  // Find all UUID session files
  const files = fs.readdirSync(TODOS_DIR);
  const uuidPattern =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const sessions = new Set();

  files.forEach((file) => {
    const match = file.match(uuidPattern);
    if (match) {
      sessions.add(match[1]);
    }
  });

  console.log(`\n📋 Found ${sessions.size} unique UUID sessions\n`);

  // Load existing mapping
  let mapping = {
    sessions: {},
    version: "1.0",
    migrationDate: new Date().toISOString(),
  };
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
    } catch (e) {
      console.log("⚠️  Could not load existing mapping, creating new");
    }
  }

  // Migrate each session
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const uuid of sessions) {
    if (mapping.sessions[uuid]) {
      console.log(`⏭️  Skipping ${uuid} (already migrated)`);
      skipped++;
      continue;
    }

    try {
      console.log(`🔄 Minting ChittyID for ${uuid}...`);
      const chittyId = await client.mint({
        entity: "CONTEXT",
        name: "Retroactive Session Migration",
        metadata: {
          type: "session_retroactive_migration",
          legacyUuid: uuid,
          migrationTimestamp: Date.now(),
          migrationReason: "ChittyOS compliance - P0 violation remediation",
        },
      });

      console.log(`✅ ${uuid} → ${chittyId}`);

      mapping.sessions[uuid] = {
        chittyId,
        migratedAt: new Date().toISOString(),
        status: "completed",
      };

      migrated++;

      // Save after each successful migration
      fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));

      // Rate limit: 1 per second
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to mint for ${uuid}: ${error.message}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("Migration Complete");
  console.log("=".repeat(50));
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📁 Mapping file: ${MAPPING_FILE}`);
  console.log("=".repeat(50));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
