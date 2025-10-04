/**
 * ChittyChat GitHub Session Manager
 * Leverages GitHub's native features for project/session management
 */

import { Octokit } from "@octokit/rest";
import { createHash } from "crypto";
import ChittyIDClient from "@chittyos/chittyid-client";

interface ProjectConfig {
  name: string;
  description?: string;
  baseRepo: string;
  userRepo: string; // chittyos/chittychat for user config
}

interface SessionConfig {
  projectId: string;
  sessionId: string;
  branchName: string;
  prNumber?: number;
}

export class ChittyChatGitHubManager {
  private octokit: Octokit;
  private userRepo = "chittyos/chittychat"; // User's config repo
  private chittyIdClient: ChittyIDClient;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });

    // Initialize official ChittyID client
    // SERVICE OR FAIL: throws if service unavailable
    this.chittyIdClient = new ChittyIDClient({
      apiKey: process.env.CHITTY_ID_TOKEN,
    });
  }

  /**
   * Create a new project with its own directory structure
   * Each project gets a dedicated folder in the repo
   */
  async createProject(config: ProjectConfig): Promise<string> {
    // CRITICAL: Mint ChittyID from service - NEVER generate locally
    const projectId = await this.chittyIdClient.mint({
      entity: "CONTEXT",
      name: config.name,
      metadata: {
        type: "PROJECT",
        description: config.description,
        baseRepo: config.baseRepo,
        userRepo: config.userRepo,
      },
    });
    const projectPath = `projects/${projectId}`;

    console.log(`📁 Creating new project: ${config.name} (ID: ${projectId})`);

    // Create project structure in main branch
    const files = [
      {
        path: `${projectPath}/README.md`,
        content: Buffer.from(
          `# ${config.name}\n\n${config.description || ""}\n\nProject ID: ${projectId}`,
        ).toString("base64"),
      },
      {
        path: `${projectPath}/.chittychat/config.json`,
        content: Buffer.from(
          JSON.stringify(
            {
              projectId,
              name: config.name,
              created: new Date().toISOString(),
              type: "legal-case",
              settings: {
                autoMerge: true,
                requireApproval: false,
                mergAfterDays: 3,
                preserveHistory: true,
              },
            },
            null,
            2,
          ),
        ).toString("base64"),
      },
      {
        path: `${projectPath}/evidence/.gitkeep`,
        content: "",
      },
      {
        path: `${projectPath}/processed/.gitkeep`,
        content: "",
      },
      {
        path: `${projectPath}/chain-of-custody/.gitkeep`,
        content: "",
      },
    ];

    // Create tree with all files
    const tree = await this.octokit.git.createTree({
      owner: this.getOwner(),
      repo: this.getRepo(),
      tree: files.map((f) => ({
        path: f.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: f.content,
      })),
    });

    // Create commit
    const latestCommit = await this.getLatestCommit();
    const commit = await this.octokit.git.createCommit({
      owner: this.getOwner(),
      repo: this.getRepo(),
      message: `🎯 Create project: ${config.name}`,
      tree: tree.data.sha,
      parents: [latestCommit],
    });

    // Update main branch
    await this.octokit.git.updateRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: "heads/main",
      sha: commit.data.sha,
    });

    return projectId;
  }

  /**
   * Start a new session for a project
   * Creates a feature branch and PR
   */
  async startSession(projectId: string): Promise<SessionConfig> {
    // CRITICAL: Mint ChittyID from service - NEVER generate locally
    const sessionId = await this.chittyIdClient.mint({
      entity: "CONTEXT",
      name: `Session for ${projectId}`,
      metadata: {
        type: "SESSION",
        projectId,
        platform: process.platform,
        timestamp: new Date().toISOString(),
      },
    });
    const branchName = `session/${projectId}/${sessionId}`;

    console.log(`🌿 Starting session: ${sessionId}`);

    // Create branch from main
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

    // Create PR with auto-merge enabled
    const pr = await this.octokit.pulls.create({
      owner: this.getOwner(),
      repo: this.getRepo(),
      title: `Session: ${projectId} - ${new Date().toLocaleDateString()}`,
      head: branchName,
      base: "main",
      body: `## Session Details

- **Project**: ${projectId}
- **Session**: ${sessionId}
- **Started**: ${new Date().toISOString()}

### Auto-merge Configuration
This PR will automatically merge when:
- ✅ All checks pass
- ✅ No conflicts with main
- ✅ After 3 days (or manual approval)

### Session Activity
Work in this session will be tracked here.

---
*Managed by ChittyChat Session Manager*`,
      draft: false,
    });

    // Add labels using GitHub's native features
    await this.octokit.issues.addLabels({
      owner: this.getOwner(),
      repo: this.getRepo(),
      issue_number: pr.data.number,
      labels: ["session-branch", "auto-merge", projectId],
    });

    // Enable auto-merge (GitHub native feature)
    await this.enableAutoMerge(pr.data.number);

    return {
      projectId,
      sessionId,
      branchName,
      prNumber: pr.data.number,
    };
  }

  /**
   * Add work to current session
   */
  async addToSession(
    session: SessionConfig,
    files: Array<{ path: string; content: string }>,
  ) {
    console.log(`📝 Adding ${files.length} files to session`);

    // Get current branch
    const branch = await this.octokit.git.getRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: `heads/${session.branchName}`,
    });

    // Create blobs for files
    const blobs = await Promise.all(
      files.map((f) =>
        this.octokit.git.createBlob({
          owner: this.getOwner(),
          repo: this.getRepo(),
          content: Buffer.from(f.content).toString("base64"),
          encoding: "base64",
        }),
      ),
    );

    // Get base tree
    const baseTree = await this.octokit.git.getCommit({
      owner: this.getOwner(),
      repo: this.getRepo(),
      commit_sha: branch.data.object.sha,
    });

    // Create new tree
    const tree = await this.octokit.git.createTree({
      owner: this.getOwner(),
      repo: this.getRepo(),
      base_tree: baseTree.data.tree.sha,
      tree: files.map((f, i) => ({
        path: `projects/${session.projectId}/${f.path}`,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blobs[i].data.sha,
      })),
    });

    // Create commit
    const commit = await this.octokit.git.createCommit({
      owner: this.getOwner(),
      repo: this.getRepo(),
      message: `📄 Add files to session ${session.sessionId}`,
      tree: tree.data.sha,
      parents: [branch.data.object.sha],
    });

    // Update branch
    await this.octokit.git.updateRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: `heads/${session.branchName}`,
      sha: commit.data.sha,
    });

    // Update PR description with activity
    if (session.prNumber) {
      await this.updatePRActivity(session.prNumber, files.length);
    }
  }

  /**
   * Check if branches are diverging (GitHub native)
   */
  async checkDivergence(
    session: SessionConfig,
  ): Promise<{ ahead: number; behind: number }> {
    const comparison = await this.octokit.repos.compareCommits({
      owner: this.getOwner(),
      repo: this.getRepo(),
      base: "main",
      head: session.branchName,
    });

    // If too far behind, GitHub will show warning in PR
    if (comparison.data.behind_by > 10) {
      console.warn(
        `⚠️ Session ${session.sessionId} is ${comparison.data.behind_by} commits behind main`,
      );

      // GitHub's native "Update branch" button handles this
      // Or use the API to sync
      if (comparison.data.behind_by > 50) {
        await this.syncWithMain(session);
      }
    }

    return {
      ahead: comparison.data.ahead_by,
      behind: comparison.data.behind_by,
    };
  }

  /**
   * Sync session branch with main (GitHub native)
   */
  async syncWithMain(session: SessionConfig) {
    console.log(`🔄 Syncing session ${session.sessionId} with main`);

    // Use GitHub's update branch feature
    await this.octokit.pulls.updateBranch({
      owner: this.getOwner(),
      repo: this.getRepo(),
      pull_number: session.prNumber!,
    });
  }

  /**
   * Enable auto-merge for PR (GitHub native feature)
   */
  private async enableAutoMerge(prNumber: number) {
    try {
      // GraphQL mutation for auto-merge (GitHub native)
      await this.octokit.graphql(
        `
        mutation EnableAutoMerge($pullRequestId: ID!) {
          enablePullRequestAutoMerge(input: {
            pullRequestId: $pullRequestId,
            mergeMethod: SQUASH
          }) {
            pullRequest {
              autoMergeRequest {
                enabledAt
              }
            }
          }
        }
      `,
        {
          pullRequestId: await this.getPRNodeId(prNumber),
        },
      );

      console.log(`✅ Auto-merge enabled for PR #${prNumber}`);
    } catch (error) {
      console.log(`ℹ️ Auto-merge may require repository settings`);
    }
  }

  /**
   * Get PR node ID for GraphQL
   */
  private async getPRNodeId(prNumber: number): Promise<string> {
    const pr = await this.octokit.pulls.get({
      owner: this.getOwner(),
      repo: this.getRepo(),
      pull_number: prNumber,
    });
    return pr.data.node_id;
  }

  /**
   * Update PR with session activity
   */
  private async updatePRActivity(prNumber: number, fileCount: number) {
    const pr = await this.octokit.pulls.get({
      owner: this.getOwner(),
      repo: this.getRepo(),
      pull_number: prNumber,
    });

    const currentBody = pr.data.body || "";
    const activitySection = `\n- ${new Date().toLocaleTimeString()}: Added ${fileCount} file(s)`;

    await this.octokit.pulls.update({
      owner: this.getOwner(),
      repo: this.getRepo(),
      pull_number: prNumber,
      body: currentBody + activitySection,
    });
  }

  /**
   * Get latest commit on main
   */
  private async getLatestCommit(): Promise<string> {
    const ref = await this.octokit.git.getRef({
      owner: this.getOwner(),
      repo: this.getRepo(),
      ref: "heads/main",
    });
    return ref.data.object.sha;
  }

  /**
   * DEPRECATED: Use ChittyID service instead
   * @deprecated All IDs must come from id.chitty.cc
   */
  private generateProjectId(name: string): string {
    throw new Error(
      "POLICY VIOLATION: Use chittyIdClient.mintProjectId() instead of local generation",
    );
  }

  /**
   * DEPRECATED: Use ChittyID service instead
   * @deprecated All IDs must come from id.chitty.cc
   */
  private generateSessionId(): string {
    throw new Error(
      "POLICY VIOLATION: Use chittyIdClient.mintSessionId() instead of local generation",
    );
  }

  private getOwner(): string {
    return this.userRepo.split("/")[0];
  }

  private getRepo(): string {
    return this.userRepo.split("/")[1];
  }
}

// Example usage:
async function example() {
  const manager = new ChittyChatGitHubManager(process.env.GITHUB_TOKEN!);

  // Create a new project
  const projectId = await manager.createProject({
    name: "Smith vs Jones Case",
    description: "Patent litigation case files",
    baseRepo: "chittyos/chittychat",
    userRepo: "chittyos/chittychat",
  });

  // Start a session
  const session = await manager.startSession(projectId);

  // Add files to session
  await manager.addToSession(session, [
    {
      path: "evidence/document1.pdf.metadata",
      content: JSON.stringify({ chittyId: "CHITTY-123" }),
    },
    {
      path: "processed/analysis.json",
      content: JSON.stringify({ findings: [] }),
    },
  ]);

  // Check divergence
  const divergence = await manager.checkDivergence(session);
  console.log(
    `Branch is ${divergence.ahead} ahead, ${divergence.behind} behind main`,
  );
}
