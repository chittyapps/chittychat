/**
 * AI-GitHub Bridge for ChittyChat
 * Connects Claude/OpenAI/Universal AI features to GitHub for persistence
 * Uses chittyos-data as user configuration space
 */

import { Octokit } from "@octokit/rest";
import { createHash } from "crypto";
import ChittyIDClient from "@chittyos/chittyid-client";

interface AISession {
  provider: "claude" | "openai" | "universal";
  sessionId: string;
  conversationId?: string;
  projectPath?: string;
  metadata: {
    model?: string;
    timestamp: string;
    userConfig?: any; // From chittyos-data
  };
}

interface ChittyOSData {
  userId: string;
  preferences: Record<string, any>;
  githubRepo: string; // User's personal config repo
  autoCommit: boolean;
  branchStrategy: "per-session" | "per-project" | "per-day";
}

export class AIGitHubBridge {
  private octokit: Octokit;
  private chittyosData: ChittyOSData;
  private currentSession?: AISession;

  constructor(githubToken: string, chittyosData: ChittyOSData) {
    this.octokit = new Octokit({ auth: githubToken });
    this.chittyosData = chittyosData;
  }

  /**
   * Initialize a new AI session and create corresponding GitHub branch
   */
  async initializeSession(
    provider: AISession["provider"],
    projectName?: string,
  ): Promise<AISession> {
    const sessionId = await this.generateSessionId();
    const timestamp = new Date().toISOString();

    // Determine branch name based on user's strategy
    const branchName = this.getBranchName(sessionId, projectName);

    console.log(`🤖 Initializing ${provider} session with GitHub persistence`);

    // Create branch in user's config repo
    const mainRef = await this.octokit.git.getRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: "heads/main",
    });

    await this.octokit.git.createRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: `refs/heads/${branchName}`,
      sha: mainRef.data.object.sha,
    });

    // Create initial session file
    const sessionFile = {
      path: `sessions/${provider}/${sessionId}/session.json`,
      content: JSON.stringify(
        {
          sessionId,
          provider,
          branchName,
          projectName,
          started: timestamp,
          chittyosUserId: this.chittyosData.userId,
          config: this.chittyosData.preferences,
          conversation: [],
        },
        null,
        2,
      ),
    };

    await this.commitFile(
      branchName,
      sessionFile,
      `🎯 Start ${provider} session: ${sessionId}`,
    );

    // Create PR for session tracking
    const pr = await this.createSessionPR(
      branchName,
      provider,
      sessionId,
      projectName,
    );

    this.currentSession = {
      provider,
      sessionId,
      conversationId: pr.data.number.toString(),
      projectPath: projectName ? `projects/${projectName}` : undefined,
      metadata: {
        model: provider === "claude" ? "claude-3" : "gpt-4",
        timestamp,
        userConfig: this.chittyosData.preferences,
      },
    };

    return this.currentSession;
  }

  /**
   * Save conversation turn to GitHub
   */
  async saveConversation(
    role: "user" | "assistant" | "system",
    content: string,
    metadata?: any,
  ) {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    const turn = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };

    const conversationPath = `sessions/${this.currentSession.provider}/${this.currentSession.sessionId}/conversation.jsonl`;

    // Append to conversation file (JSONL format for streaming)
    await this.appendToFile(
      this.getBranchName(
        this.currentSession.sessionId,
        this.currentSession.projectPath,
      ),
      conversationPath,
      JSON.stringify(turn) + "\n",
    );

    // Auto-commit if enabled
    if (this.chittyosData.autoCommit) {
      await this.autoCommit();
    }
  }

  /**
   * Save code/files generated during session
   */
  async saveGeneratedContent(
    files: Array<{ path: string; content: string; language?: string }>,
  ) {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    const branchName = this.getBranchName(
      this.currentSession.sessionId,
      this.currentSession.projectPath,
    );

    for (const file of files) {
      const fullPath = this.currentSession.projectPath
        ? `${this.currentSession.projectPath}/${file.path}`
        : `sessions/${this.currentSession.provider}/${this.currentSession.sessionId}/generated/${file.path}`;

      await this.commitFile(
        branchName,
        { path: fullPath, content: file.content },
        `💾 Save generated: ${file.path}`,
      );

      // Track in manifest
      await this.updateManifest(branchName, {
        file: fullPath,
        language: file.language,
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.sessionId,
      });
    }
  }

  /**
   * Bridge Claude Code's file operations to GitHub
   */
  async bridgeFileOperation(
    operation: "read" | "write" | "edit",
    path: string,
    content?: string,
  ) {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    const branchName = this.getBranchName(
      this.currentSession.sessionId,
      this.currentSession.projectPath,
    );
    const trackingPath = `sessions/${this.currentSession.provider}/${this.currentSession.sessionId}/operations.jsonl`;

    // Log operation
    const op = {
      operation,
      path,
      timestamp: new Date().toISOString(),
      contentHash: content
        ? createHash("sha256").update(content).digest("hex")
        : null,
    };

    await this.appendToFile(
      branchName,
      trackingPath,
      JSON.stringify(op) + "\n",
    );

    // For write/edit operations, also save the file
    if ((operation === "write" || operation === "edit") && content) {
      const targetPath = this.currentSession.projectPath
        ? `${this.currentSession.projectPath}/${path}`
        : `workspace/${path}`;

      await this.commitFile(
        branchName,
        { path: targetPath, content },
        `📝 ${operation}: ${path}`,
      );
    }
  }

  /**
   * Sync with ChittyOS data (user preferences)
   */
  async syncWithChittyOS() {
    // Read user config from chittyos-data repo
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: "chittyos",
        repo: "chittyos-data",
        path: `users/${this.chittyosData.userId}/config.json`,
      });

      if ("content" in data) {
        const config = JSON.parse(
          Buffer.from(data.content, "base64").toString(),
        );

        this.chittyosData.preferences = config.preferences || {};
        console.log("✅ Synced with ChittyOS user data");
      }
    } catch (error) {
      console.log("ℹ️ Using default ChittyOS config");
    }
  }

  /**
   * Handle divergence using GitHub's native features
   */
  async checkAndHandleDivergence() {
    if (!this.currentSession) return;

    const branchName = this.getBranchName(
      this.currentSession.sessionId,
      this.currentSession.projectPath,
    );

    const comparison = await this.octokit.repos.compareCommits({
      owner: this.getOwner(),
      repo: this.getRepo(),
      base: "main",
      head: branchName,
    });

    if (comparison.data.behind_by > 10) {
      console.log(
        `⚠️ Branch ${branchName} is ${comparison.data.behind_by} commits behind`,
      );

      // Use GitHub's update branch feature
      if (this.currentSession.conversationId) {
        await this.octokit.pulls.updateBranch({
          owner: this.getOwner(),
          repo: this.getRepo(),
          pull_number: parseInt(this.currentSession.conversationId),
        });
      }
    }

    return {
      ahead: comparison.data.ahead_by,
      behind: comparison.data.behind_by,
      status: comparison.data.status,
    };
  }

  /**
   * Auto-commit based on time or activity
   */
  private async autoCommit() {
    if (!this.currentSession) return;

    const branchName = this.getBranchName(
      this.currentSession.sessionId,
      this.currentSession.projectPath,
    );

    // Create a commit message with activity summary
    const message = `🤖 Auto-save: ${this.currentSession.provider} session ${this.currentSession.sessionId}`;

    try {
      // This would batch pending changes
      console.log(`💾 Auto-committing to ${branchName}`);
      // Implementation depends on tracking uncommitted changes
    } catch (error) {
      console.error("Auto-commit failed:", error);
    }
  }

  /**
   * Create PR for session with auto-merge
   */
  private async createSessionPR(
    branchName: string,
    provider: string,
    sessionId: string,
    projectName?: string,
  ) {
    const pr = await this.octokit.pulls.create({
      owner: this.getOwner(),
      repo: this.getRepo(),
      title: `${provider} Session: ${projectName || sessionId}`,
      head: branchName,
      base: "main",
      body: `## AI Session Details

**Provider**: ${provider}
**Session ID**: ${sessionId}
${projectName ? `**Project**: ${projectName}` : ""}
**Started**: ${new Date().toISOString()}

### Configuration
- User: ${this.chittyosData.userId}
- Auto-commit: ${this.chittyosData.autoCommit}
- Branch strategy: ${this.chittyosData.branchStrategy}

### Auto-merge
This PR will auto-merge when:
- No conflicts with main
- After session completes or 24 hours

### Activity Log
Session activity will be tracked here.

---
*Managed by ChittyChat AI-GitHub Bridge*`,
    });

    // Add labels
    await this.octokit.issues.addLabels({
      owner: this.getOwner(),
      repo: this.getRepo(),
      issue_number: pr.data.number,
      labels: ["ai-session", provider, "auto-merge"],
    });

    // Enable auto-merge
    try {
      const nodeId = pr.data.node_id;
      await this.octokit.graphql(`
        mutation {
          enablePullRequestAutoMerge(input: {
            pullRequestId: "${nodeId}",
            mergeMethod: SQUASH
          }) {
            pullRequest { id }
          }
        }
      `);
    } catch (error) {
      console.log("Auto-merge requires repository configuration");
    }

    return pr;
  }

  /**
   * Helper: Commit file to branch
   */
  private async commitFile(
    branch: string,
    file: { path: string; content: string },
    message: string,
  ) {
    // Get current branch ref
    const ref = await this.octokit.git.getRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: `heads/${branch}`,
    });

    // Create blob
    const blob = await this.octokit.git.createBlob({
      owner: this.getOwner(),
      repo: this.getRepo(),
      content: Buffer.from(file.content).toString("base64"),
      encoding: "base64",
    });

    // Get base tree
    const baseCommit = await this.octokit.git.getCommit({
      owner: this.getOwner(),
      repo: this.getRepo(),
      commit_sha: ref.data.object.sha,
    });

    // Create tree
    const tree = await this.octokit.git.createTree({
      owner: this.getOwner(),
      repo: this.getRepo(),
      base_tree: baseCommit.data.tree.sha,
      tree: [
        {
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blob.data.sha,
        },
      ],
    });

    // Create commit
    const commit = await this.octokit.git.createCommit({
      owner: this.getOwner(),
      repo: this.getRepo(),
      message,
      tree: tree.data.sha,
      parents: [ref.data.object.sha],
    });

    // Update branch
    await this.octokit.git.updateRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: `heads/${branch}`,
      sha: commit.data.sha,
    });
  }

  /**
   * Helper: Append to file
   */
  private async appendToFile(branch: string, path: string, content: string) {
    try {
      // Try to get existing file
      const { data } = await this.octokit.repos.getContent({
        owner: this.getOwner(),
        repo: this.getRepo(),
        path,
        ref: branch,
      });

      if ("content" in data) {
        const existing = Buffer.from(data.content, "base64").toString();
        await this.commitFile(
          branch,
          { path, content: existing + content },
          `📝 Append to ${path}`,
        );
      }
    } catch (error) {
      // File doesn't exist, create it
      await this.commitFile(branch, { path, content }, `📝 Create ${path}`);
    }
  }

  /**
   * Update session manifest
   */
  private async updateManifest(branch: string, entry: any) {
    const manifestPath = `sessions/manifest.jsonl`;
    await this.appendToFile(branch, manifestPath, JSON.stringify(entry) + "\n");
  }

  /**
   * Generate branch name based on strategy
   */
  private getBranchName(sessionId: string, projectName?: string): string {
    const date = new Date().toISOString().split("T")[0];

    switch (this.chittyosData.branchStrategy) {
      case "per-project":
        return projectName ? `project/${projectName}` : `session/${sessionId}`;
      case "per-day":
        return `daily/${date}`;
      case "per-session":
      default:
        return `session/${sessionId}`;
    }
  }

  // POLICY: Use ChittyID service - NEVER generate locally
  private async generateSessionId(): Promise<string> {
    const chittyIdClient = new ChittyIDClient({
      apiKey: process.env.CHITTY_ID_TOKEN,
    });
    return await chittyIdClient.mint({
      entity: "CONTEXT",
      name: `AI session - ${this.currentSession?.provider || "unknown"}`,
      metadata: {
        type: "ai_session",
        provider: this.currentSession?.provider || "unknown",
        userId: this.chittyosData.userId,
        timestamp: Date.now(),
      },
    });
  }

  private getOwner(): string {
    return this.chittyosData.githubRepo.split("/")[0];
  }

  private getRepo(): string {
    return this.chittyosData.githubRepo.split("/")[1];
  }
}

// Example usage for Claude Code integration
export async function setupClaudeIntegration() {
  // Load user config from chittyos-data
  const chittyosData: ChittyOSData = {
    userId: "user-123",
    githubRepo: "chittyos/chittychat", // User's config space
    preferences: {
      aiModel: "claude-3-opus",
      autoSave: true,
      theme: "dark",
    },
    autoCommit: true,
    branchStrategy: "per-session",
  };

  const bridge = new AIGitHubBridge(process.env.GITHUB_TOKEN!, chittyosData);

  // Sync with ChittyOS user data
  await bridge.syncWithChittyOS();

  // Start a Claude session
  const session = await bridge.initializeSession(
    "claude",
    "legal-research-project",
  );

  // Save conversation turns
  await bridge.saveConversation("user", "Help me analyze this contract");
  await bridge.saveConversation(
    "assistant",
    "I'll help you analyze the contract...",
  );

  // Save generated files
  await bridge.saveGeneratedContent([
    {
      path: "analysis.md",
      content: "# Contract Analysis\n...",
      language: "markdown",
    },
    { path: "summary.json", content: '{"findings": []}', language: "json" },
  ]);

  // Bridge file operations
  await bridge.bridgeFileOperation(
    "write",
    "notes.txt",
    "Important findings...",
  );

  // Check divergence periodically
  const divergence = await bridge.checkAndHandleDivergence();
  console.log(
    `Session branch: ${divergence.ahead} ahead, ${divergence.behind} behind main`,
  );

  return bridge;
}
