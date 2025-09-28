/**
 * ChittyChat Cross-Platform Sync
 * "GitHub for AI Project Management"
 * Synchronizes projects across machines, servers, and AI models
 */

import { UnifiedProjectManager } from "./unified-project-manager.js";

export class CrossPlatformSync {
  constructor(config = {}) {
    this.localManager = new UnifiedProjectManager(config.local);

    // Remote endpoints for different platforms
    this.platforms = {
      github: {
        url: "https://api.github.com",
        repo: "chittyos/chittychat-data",
        token: config.githubToken,
      },
      cloudflare: {
        url: "https://sync.chitty.cc",
        accountId: config.cloudflareAccountId,
      },
      notion: {
        url: "https://api.notion.com/v1",
        databaseId: config.notionDatabaseId,
        token: config.notionToken,
      },
      openai: {
        url: "https://api.openai.com/v1",
        apiKey: config.openaiApiKey,
      },
      anthropic: {
        url: "https://api.anthropic.com/v1",
        apiKey: config.anthropicApiKey,
      },
    };

    // Track sync state across platforms
    this.syncState = new Map();
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Full cross-platform synchronization
   */
  async syncAcrossAll() {
    console.log("🌐 Starting cross-platform sync...");

    // Step 1: Gather state from all platforms
    const platformStates = await this.gatherPlatformStates();

    // Step 2: Resolve conflicts and merge
    const unifiedState = await this.resolveAndMerge(platformStates);

    // Step 3: Push unified state to all platforms
    await this.pushToAllPlatforms(unifiedState);

    // Step 4: Update local state
    await this.updateLocalState(unifiedState);

    console.log("✅ Cross-platform sync complete");
    return unifiedState;
  }

  /**
   * Gather project states from all platforms
   */
  async gatherPlatformStates() {
    const states = new Map();

    // GitHub - Main source of truth
    console.log("📥 Fetching from GitHub...");
    states.set("github", await this.fetchGitHubState());

    // Cloudflare Workers KV
    console.log("☁️ Fetching from Cloudflare...");
    states.set("cloudflare", await this.fetchCloudflareState());

    // Notion Database
    console.log("📝 Fetching from Notion...");
    states.set("notion", await this.fetchNotionState());

    // OpenAI Assistant files
    console.log("🤖 Fetching from OpenAI...");
    states.set("openai", await this.fetchOpenAIState());

    // Anthropic Claude Projects
    console.log("🧠 Fetching from Anthropic...");
    states.set("anthropic", await this.fetchAnthropicState());

    // Local file system
    console.log("💻 Scanning local projects...");
    await this.localManager.initialize();
    states.set("local", this.localManager.getStatus());

    return states;
  }

  /**
   * Fetch state from GitHub
   */
  async fetchGitHubState() {
    const { url, repo, token } = this.platforms.github;

    try {
      // Get repository content
      const response = await fetch(`${url}/repos/${repo}/contents`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const content = await response.json();

      // Get commits for history
      const commitsResponse = await fetch(`${url}/repos/${repo}/commits`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const commits = await commitsResponse.json();

      // Get branches and worktrees
      const branchesResponse = await fetch(`${url}/repos/${repo}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const branches = await branchesResponse.json();

      return {
        files: content,
        commits: commits.slice(0, 10), // Last 10 commits
        branches,
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error("GitHub fetch failed:", error);
      return null;
    }
  }

  /**
   * Fetch state from Cloudflare Workers KV
   */
  async fetchCloudflareState() {
    const { url } = this.platforms.cloudflare;

    try {
      const response = await fetch(`${url}/api/projects`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      return await response.json();
    } catch (error) {
      console.error("Cloudflare fetch failed:", error);
      return null;
    }
  }

  /**
   * Fetch state from Notion
   */
  async fetchNotionState() {
    const { url, databaseId, token } = this.platforms.notion;

    try {
      const response = await fetch(`${url}/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "Type",
            select: {
              equals: "AI Project",
            },
          },
        }),
      });

      const data = await response.json();
      return {
        projects: data.results,
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Notion fetch failed:", error);
      return null;
    }
  }

  /**
   * Fetch OpenAI Assistant state
   */
  async fetchOpenAIState() {
    const { url, apiKey } = this.platforms.openai;

    try {
      // Get assistant files
      const filesResponse = await fetch(`${url}/files`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const files = await filesResponse.json();

      // Get assistants
      const assistantsResponse = await fetch(`${url}/assistants`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      const assistants = await assistantsResponse.json();

      return {
        files: files.data,
        assistants: assistants.data,
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error("OpenAI fetch failed:", error);
      return null;
    }
  }

  /**
   * Fetch Anthropic Claude state
   */
  async fetchAnthropicState() {
    // Note: Anthropic doesn't have a direct project API yet
    // This would integrate with Claude's future project management features
    return {
      projects: [],
      conversations: [],
      lastSync: new Date().toISOString(),
    };
  }

  /**
   * Resolve conflicts and merge states
   */
  async resolveAndMerge(platformStates) {
    console.log("🔀 Resolving conflicts and merging...");

    const unified = {
      projects: new Map(),
      files: new Map(),
      todos: new Map(),
      history: [],
      platforms: {},
    };

    // GitHub as primary source of truth
    const githubState = platformStates.get("github");
    if (githubState) {
      // Use GitHub as base
      unified.base = githubState;
    }

    // Merge each platform's state
    for (const [platform, state] of platformStates) {
      if (state) {
        unified.platforms[platform] = state;

        // Merge projects
        if (state.projects) {
          for (const project of state.projects) {
            const key = project.name || project.id;
            if (unified.projects.has(key)) {
              // Conflict - resolve
              const resolved = await this.conflictResolver.resolve(
                unified.projects.get(key),
                project,
                platform,
              );
              unified.projects.set(key, resolved);
            } else {
              unified.projects.set(key, project);
            }
          }
        }
      }
    }

    return unified;
  }

  /**
   * Push unified state to all platforms
   */
  async pushToAllPlatforms(unifiedState) {
    console.log("📤 Pushing to all platforms...");

    const results = new Map();

    // Push to GitHub (main repository)
    results.set("github", await this.pushToGitHub(unifiedState));

    // Push to Cloudflare KV
    results.set("cloudflare", await this.pushToCloudflare(unifiedState));

    // Update Notion
    results.set("notion", await this.pushToNotion(unifiedState));

    // Update OpenAI files
    results.set("openai", await this.pushToOpenAI(unifiedState));

    return results;
  }

  /**
   * Push to GitHub
   */
  async pushToGitHub(state) {
    const { url, repo, token } = this.platforms.github;

    try {
      // Create commit with unified state
      const content = btoa(JSON.stringify(state, null, 2));

      const response = await fetch(
        `${url}/repos/${repo}/contents/unified-state.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `ChittyChat sync: ${new Date().toISOString()}`,
            content,
            sha: state.base?.sha, // If updating existing file
          }),
        },
      );

      return await response.json();
    } catch (error) {
      console.error("GitHub push failed:", error);
      return null;
    }
  }

  /**
   * Push to Cloudflare Workers KV
   */
  async pushToCloudflare(state) {
    const { url } = this.platforms.cloudflare;

    try {
      const response = await fetch(`${url}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state,
          timestamp: new Date().toISOString(),
        }),
      });

      return await response.json();
    } catch (error) {
      console.error("Cloudflare push failed:", error);
      return null;
    }
  }

  /**
   * Push to Notion
   */
  async pushToNotion(state) {
    const { url, databaseId, token } = this.platforms.notion;

    try {
      // Update or create pages for each project
      const results = [];

      for (const [key, project] of state.projects) {
        const response = await fetch(`${url}/pages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
              Name: { title: [{ text: { content: project.name } }] },
              Type: { select: { name: "AI Project" } },
              Status: { select: { name: "Active" } },
              "Last Sync": { date: { start: new Date().toISOString() } },
            },
          }),
        });

        results.push(await response.json());
      }

      return results;
    } catch (error) {
      console.error("Notion push failed:", error);
      return null;
    }
  }

  /**
   * Push to OpenAI
   */
  async pushToOpenAI(state) {
    const { url, apiKey } = this.platforms.openai;

    try {
      // Upload unified state as a file
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(state)], {
        type: "application/json",
      });
      formData.append("file", blob, "chittychat-state.json");
      formData.append("purpose", "assistants");

      const response = await fetch(`${url}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      return await response.json();
    } catch (error) {
      console.error("OpenAI push failed:", error);
      return null;
    }
  }

  /**
   * Update local state
   */
  async updateLocalState(unifiedState) {
    console.log("💾 Updating local state...");

    // Update local projects based on unified state
    await this.localManager.syncProjects();

    // Save unified state locally
    const statePath = "/Users/nb/.claude/projects/.chittychat-state.json";
    await require("fs").promises.writeFile(
      statePath,
      JSON.stringify(unifiedState, null, 2),
    );

    console.log("  Local state updated");
  }

  /**
   * Real-time sync on changes
   */
  async watchAndSync() {
    console.log("👁️ Watching for changes...");

    // Set up file watchers
    const chokidar = require("chokidar");

    const watcher = chokidar.watch("/Users/nb/.claude/projects", {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
    });

    watcher
      .on("add", (path) => this.handleFileChange("add", path))
      .on("change", (path) => this.handleFileChange("change", path))
      .on("unlink", (path) => this.handleFileChange("remove", path));

    // Periodic sync every 5 minutes
    setInterval(
      () => {
        this.syncAcrossAll();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Handle file changes
   */
  async handleFileChange(event, path) {
    console.log(`📝 File ${event}: ${path}`);

    // Debounce changes
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(async () => {
      await this.syncAcrossAll();
    }, 5000); // Wait 5 seconds after last change
  }
}

/**
 * Conflict Resolution
 */
class ConflictResolver {
  resolve(existing, incoming, source) {
    // Resolution strategies
    const strategies = {
      github: () => incoming, // GitHub always wins
      local: () => this.mergeWithLocal(existing, incoming),
      notion: () => this.mergeMetadata(existing, incoming),
      openai: () => this.mergeAIContext(existing, incoming),
      cloudflare: () => this.mergeLatest(existing, incoming),
    };

    const strategy = strategies[source] || strategies.cloudflare;
    return strategy();
  }

  mergeWithLocal(existing, incoming) {
    // Prefer local changes for recent modifications
    if (incoming.lastModified > existing.lastModified) {
      return { ...existing, ...incoming };
    }
    return existing;
  }

  mergeMetadata(existing, incoming) {
    // Merge metadata from Notion
    return {
      ...existing,
      metadata: { ...existing.metadata, ...incoming.metadata },
    };
  }

  mergeAIContext(existing, incoming) {
    // Preserve AI context and training data
    return {
      ...existing,
      aiContext: [...(existing.aiContext || []), ...(incoming.aiContext || [])],
    };
  }

  mergeLatest(existing, incoming) {
    // Use most recent
    return incoming.lastModified > existing.lastModified ? incoming : existing;
  }
}

export default CrossPlatformSync;
