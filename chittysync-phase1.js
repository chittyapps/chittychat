#!/usr/bin/env node
/**
 * ChittySync Phase 1 - Claude Code Integration
 * Simple bidirectional sync between local todos and ChittySync Hub
 *
 * Version: 1.0.0
 * API: https://gateway.chitty.cc/api/todos
 * Local: ~/.claude/todos/
 *
 * Features:
 * - Push new local todos to hub
 * - Pull new remote todos from hub
 * - Simple conflict resolution (last-write-wins)
 * - Logging to ~/.chittychat/sync-log.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  hubUrl: "https://gateway.chitty.cc/api/todos",
  token: process.env.CHITTY_ID_TOKEN || "",
  localTodosDir: path.join(process.env.HOME, ".claude", "todos"),
  syncLogPath: path.join(process.env.HOME, ".chittychat", "sync-log.json"),
  platform: "claude-code",
};

// Ensure directories exist
function ensureDirs() {
  [CONFIG.localTodosDir, path.dirname(CONFIG.syncLogPath)].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// HTTP request helper
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.token}`,
        ...options.headers,
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Load local todos
function loadLocalTodos() {
  const todos = [];

  if (!fs.existsSync(CONFIG.localTodosDir)) {
    return todos;
  }

  const files = fs
    .readdirSync(CONFIG.localTodosDir)
    .filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const content = fs.readFileSync(
        path.join(CONFIG.localTodosDir, file),
        "utf8",
      );
      const todo = JSON.parse(content);
      todos.push({
        ...todo,
        _localFile: file,
      });
    } catch (e) {
      console.error(`Failed to load ${file}:`, e.message);
    }
  }

  return todos;
}

// Save local todo
function saveLocalTodo(todo) {
  const filename = `${todo.id}.json`;
  const filepath = path.join(CONFIG.localTodosDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(todo, null, 2));
  return filepath;
}

// Load sync log
function loadSyncLog() {
  if (!fs.existsSync(CONFIG.syncLogPath)) {
    return { lastSync: 0, synced: [] };
  }
  return JSON.parse(fs.readFileSync(CONFIG.syncLogPath, "utf8"));
}

// Save sync log
function saveSyncLog(log) {
  fs.writeFileSync(CONFIG.syncLogPath, JSON.stringify(log, null, 2));
}

// Check hub health
async function checkHubHealth() {
  try {
    const res = await httpRequest(`${CONFIG.hubUrl}/health`);
    if (res.status === 200 && res.data.database?.connected) {
      return { healthy: true, data: res.data };
    }
    return { healthy: false, data: res.data };
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}

// Fetch remote todos (delta sync)
async function fetchRemoteTodos(since = 0) {
  try {
    const res = await httpRequest(`${CONFIG.hubUrl}/since/${since}`);
    if (res.status === 200 && res.data.success) {
      return res.data.data || [];
    }
    if (res.status === 401) {
      throw new Error(
        "Unauthorized: Check CHITTY_ID_TOKEN environment variable",
      );
    }
    throw new Error(`API error: ${JSON.stringify(res.data)}`);
  } catch (e) {
    console.error("Failed to fetch remote todos:", e.message);
    return [];
  }
}

// Push todo to hub
async function pushTodoToHub(todo) {
  try {
    const res = await httpRequest(CONFIG.hubUrl, {
      method: "POST",
      body: {
        content: todo.content,
        status: todo.status,
        active_form: todo.active_form || todo.activeForm,
        platform: CONFIG.platform,
        session_id: todo.session_id,
        agent_id: todo.agent_id,
        metadata: todo.metadata,
      },
    });

    if (res.status === 201 && res.data.success) {
      return { success: true, todo: res.data.data };
    }

    // Handle known errors
    if (res.data.error?.includes("KV put() limit exceeded")) {
      console.warn(
        "⚠️  ChittyID service at capacity (KV limit). Todo not synced:",
        todo.content,
      );
      return { success: false, error: "chittyid_kv_limit" };
    }

    throw new Error(`Failed to push: ${JSON.stringify(res.data)}`);
  } catch (e) {
    console.error("Failed to push todo:", e.message);
    return { success: false, error: e.message };
  }
}

// Update hub todo
async function updateHubTodo(id, updates) {
  try {
    const res = await httpRequest(`${CONFIG.hubUrl}/${id}`, {
      method: "PUT",
      body: updates,
    });

    if (res.status === 200 && res.data.success) {
      return { success: true, todo: res.data.data };
    }

    throw new Error(`Failed to update: ${JSON.stringify(res.data)}`);
  } catch (e) {
    console.error("Failed to update todo:", e.message);
    return { success: false, error: e.message };
  }
}

// Main sync operation
async function sync() {
  console.log("🔄 ChittySync Phase 1 - Starting sync...\n");

  ensureDirs();

  // Check hub health
  console.log("1. Checking hub health...");
  const health = await checkHubHealth();
  if (!health.healthy) {
    console.error("❌ Hub is unhealthy:", health.error || health.data);
    return process.exit(1);
  }
  console.log(`✅ Hub healthy (status: ${health.data.status})\n`);

  // Load sync state
  const syncLog = loadSyncLog();
  const localTodos = loadLocalTodos();
  console.log(`📁 Found ${localTodos.length} local todos\n`);

  // Fetch remote changes since last sync
  console.log("2. Fetching remote changes...");
  const remoteTodos = await fetchRemoteTodos(syncLog.lastSync);
  console.log(`📥 Found ${remoteTodos.length} remote changes\n`);

  // Pull: Save new remote todos locally
  let pulled = 0;
  for (const remoteTodo of remoteTodos) {
    const localExists = localTodos.find((t) => t.id === remoteTodo.id);

    if (!localExists) {
      // New remote todo - save locally
      saveLocalTodo(remoteTodo);
      pulled++;
      console.log(`⬇️  Pulled: ${remoteTodo.content} (${remoteTodo.status})`);
    } else {
      // Conflict detection: compare timestamps
      if (remoteTodo.updated_at > localExists.updated_at) {
        // Remote is newer - update local
        saveLocalTodo(remoteTodo);
        console.log(`🔄 Updated local: ${remoteTodo.content} (remote newer)`);
      } else {
        console.log(`⏭️  Skipped: ${remoteTodo.content} (local newer)`);
      }
    }
  }

  // Push: Send new local todos to hub
  console.log("\n3. Pushing local changes...");
  let pushed = 0;
  let kvLimitHit = false;

  for (const localTodo of localTodos) {
    // Skip if already synced
    if (syncLog.synced.includes(localTodo.id)) {
      continue;
    }

    const result = await pushTodoToHub(localTodo);
    if (result.success) {
      pushed++;
      syncLog.synced.push(result.todo.id);
      console.log(`⬆️  Pushed: ${localTodo.content}`);

      // Update local file with hub-assigned ID if different
      if (result.todo.id !== localTodo.id) {
        saveLocalTodo(result.todo);
        console.log(`   Updated local ID: ${localTodo.id} → ${result.todo.id}`);
      }
    } else if (result.error === "chittyid_kv_limit") {
      kvLimitHit = true;
      break; // Stop pushing to avoid repeated failures
    }
  }

  // Update sync log
  syncLog.lastSync = Date.now();
  saveSyncLog(syncLog);

  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Sync Summary:");
  console.log(`   Pulled: ${pulled} todos`);
  console.log(`   Pushed: ${pushed} todos`);
  console.log(`   Total local: ${localTodos.length}`);
  console.log(`   Last sync: ${new Date(syncLog.lastSync).toISOString()}`);

  if (kvLimitHit) {
    console.log("\n⚠️  ChittyID service capacity limit reached.");
    console.log("   New todos will sync once service resets (typically 24h).");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("✅ Sync complete!");
}

// Run sync
if (!CONFIG.token) {
  console.error("❌ Error: CHITTY_ID_TOKEN environment variable not set");
  console.error("   Export your token: export CHITTY_ID_TOKEN=mcp_auth_...");
  process.exit(1);
}

sync().catch((e) => {
  console.error("❌ Sync failed:", e);
  process.exit(1);
});
