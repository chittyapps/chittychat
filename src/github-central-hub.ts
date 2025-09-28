/**
 * GitHub Central Hub for ChittyChat
 * Leverages ALL GitHub features as the central connection point
 * Like Google, but for development/legal workflow
 */

import { Octokit } from '@octokit/rest';
import { App } from '@octokit/app';
import { createAppAuth } from '@octokit/auth-app';

interface ServiceConnection {
  type: 'claude' | 'openai' | 'notion' | 'slack' | 'google' | 'custom';
  endpoint?: string;
  credentials?: any;
  githubIntegration: {
    webhook?: string;
    app?: string;
    action?: string;
  };
}

export class GitHubCentralHub {
  private octokit: Octokit;
  private app?: App;
  private userSpace = 'chittyos/chittychat';  // Central user config space
  private connections: Map<string, ServiceConnection> = new Map();

  constructor(token: string, appConfig?: any) {
    this.octokit = new Octokit({ auth: token });

    // Initialize GitHub App if configured
    if (appConfig) {
      this.app = new App({
        appId: appConfig.appId,
        privateKey: appConfig.privateKey,
        webhooks: { secret: appConfig.webhookSecret }
      });
    }
  }

  /**
   * GITHUB PROJECTS - Task and workflow management
   */
  async setupProject(name: string, aiSessionId?: string) {
    console.log(`📋 Creating GitHub Project for ${name}`);

    // Create project (Projects V2)
    const project = await this.octokit.graphql(`
      mutation CreateProject($ownerId: ID!, $title: String!) {
        createProjectV2(input: {
          ownerId: $ownerId,
          title: $title
        }) {
          projectV2 {
            id
            title
            url
          }
        }
      }
    `, {
      ownerId: await this.getOwnerId(),
      title: name
    });

    // Add custom fields for ChittyChat
    await this.addProjectFields(project.createProjectV2.projectV2.id, [
      { name: 'ChittyID', type: 'TEXT' },
      { name: 'AI Session', type: 'TEXT', value: aiSessionId },
      { name: 'Status', type: 'SINGLE_SELECT', options: ['Intake', 'Processing', 'Review', 'Complete'] },
      { name: 'Priority', type: 'SINGLE_SELECT', options: ['Low', 'Medium', 'High', 'Critical'] },
      { name: 'Due Date', type: 'DATE' }
    ]);

    // Create automation using GitHub Actions
    await this.createProjectAutomation(project.createProjectV2.projectV2.id);

    return project.createProjectV2.projectV2;
  }

  /**
   * GITHUB ACTIONS - Automated workflows
   */
  async createWorkflowForService(service: ServiceConnection) {
    const workflow = `name: ${service.type} Integration

on:
  # Triggered by webhooks
  repository_dispatch:
    types: [${service.type}_event]

  # Triggered by issues/PRs
  issues:
    types: [opened, labeled]
  pull_request:
    types: [opened, synchronize]

  # Scheduled sync
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes

  # Manual trigger
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        type: choice
        options:
          - sync
          - process
          - analyze

jobs:
  ${service.type}-integration:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup GitHub App
        if: \${{ env.APP_ID }}
        uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: \${{ vars.APP_ID }}
          private-key: \${{ secrets.APP_PRIVATE_KEY }}

      - name: Process ${service.type} Event
        env:
          SERVICE_TYPE: ${service.type}
          GITHUB_TOKEN: \${{ steps.app-token.outputs.token || secrets.GITHUB_TOKEN }}
        run: |
          echo "Processing ${service.type} event"

          # Connect to service
          ${this.getServiceScript(service.type)}

      - name: Update GitHub Project
        uses: actions/add-to-project@v0.5.0
        with:
          project-url: https://github.com/orgs/chittyos/projects/1
          github-token: \${{ steps.app-token.outputs.token }}

      - name: Sync to Branch
        run: |
          git config --global user.name 'ChittyChat Bot'
          git config --global user.email 'bot@chittychat.legal'

          BRANCH="integration/${service.type}/\$(date +%Y%m%d)"
          git checkout -b \$BRANCH

          # Add integration data
          mkdir -p integrations/${service.type}
          echo "\$(date): Synced with ${service.type}" >> integrations/${service.type}/sync.log

          git add .
          git commit -m "🔄 Sync with ${service.type}"
          git push origin \$BRANCH

          # Create PR with auto-merge
          gh pr create \\
            --title "Integration: ${service.type} sync" \\
            --body "Automated sync from ${service.type}" \\
            --label "integration,auto-merge" \\
            --head \$BRANCH
`;

    // Save workflow
    await this.commitFile(
      'main',
      `.github/workflows/${service.type}-integration.yml`,
      workflow,
      `🔧 Add ${service.type} integration workflow`
    );
  }

  /**
   * GITHUB APPS - Custom integrations
   */
  async createGitHubApp(name: string, permissions: any) {
    // This would typically be done through GitHub UI or API
    // But we can set up the manifest
    const manifest = {
      name: `ChittyChat-${name}`,
      url: 'https://chittychat.legal',
      hook_attributes: {
        url: `https://api.chittychat.legal/webhooks/github`
      },
      redirect_url: 'https://chittychat.legal/auth/callback',
      public: false,
      default_permissions: permissions,
      default_events: [
        'issues',
        'pull_request',
        'push',
        'repository_dispatch',
        'workflow_dispatch',
        'project_v2'
      ]
    };

    await this.commitFile(
      'main',
      '.github/app-manifest.json',
      JSON.stringify(manifest, null, 2),
      `📱 Add GitHub App manifest`
    );

    return manifest;
  }

  /**
   * GITHUB ISSUES - Task tracking
   */
  async createTaskFromAI(description: string, aiProvider: string, sessionId: string) {
    const issue = await this.octokit.issues.create({
      owner: this.getOwner(),
      repo: this.getRepo(),
      title: `[${aiProvider}] ${description.substring(0, 50)}...`,
      body: `## Task from AI Session

**Provider**: ${aiProvider}
**Session**: ${sessionId}
**Created**: ${new Date().toISOString()}

### Description
${description}

### Automation
- This issue will be auto-assigned to the project board
- Updates will sync back to the AI session
- Closing this issue will update the session status

---
*Created by ChittyChat Central Hub*`,
      labels: ['ai-generated', aiProvider, 'task'],
      assignees: []
    });

    // Add to project
    await this.addIssueToProject(issue.data.number);

    return issue.data;
  }

  /**
   * GITHUB DISCUSSIONS - Knowledge base
   */
  async createDiscussionFromSession(title: string, content: string, category: string) {
    const discussion = await this.octokit.graphql(`
      mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repositoryId,
          categoryId: $categoryId,
          title: $title,
          body: $body
        }) {
          discussion {
            id
            url
          }
        }
      }
    `, {
      repositoryId: await this.getRepoId(),
      categoryId: await this.getDiscussionCategoryId(category),
      title,
      body: content
    });

    return discussion.createDiscussion.discussion;
  }

  /**
   * GITHUB PACKAGES - Asset storage
   */
  async publishPackage(name: string, version: string, files: any[]) {
    // Package.json for npm package
    const packageJson = {
      name: `@chittyos/${name}`,
      version,
      description: 'ChittyChat session package',
      repository: {
        type: 'git',
        url: `https://github.com/${this.userSpace}`
      },
      files: files.map(f => f.path)
    };

    await this.commitFile(
      'main',
      `packages/${name}/package.json`,
      JSON.stringify(packageJson, null, 2),
      `📦 Create package ${name}@${version}`
    );

    // GitHub Action to publish
    const publishAction = `
      - name: Publish to GitHub Packages
        run: |
          echo "@chittyos:registry=https://npm.pkg.github.com" >> .npmrc
          npm publish packages/${name}
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
    `;

    return { name, version, registry: 'npm.pkg.github.com' };
  }

  /**
   * GITHUB CODESPACES - Development environment
   */
  async createCodespace(branch: string, config: any) {
    const devcontainer = {
      name: 'ChittyChat Development',
      image: 'mcr.microsoft.com/devcontainers/universal:2',
      features: {
        'ghcr.io/devcontainers/features/github-cli:1': {},
        'ghcr.io/devcontainers/features/node:1': { version: '18' }
      },
      customizations: {
        vscode: {
          extensions: [
            'github.copilot',
            'github.vscode-pull-request-github',
            'github.vscode-github-actions'
          ],
          settings: config
        }
      },
      postCreateCommand: 'npm install && npm run setup',
      remoteUser: 'vscode'
    };

    await this.commitFile(
      branch,
      '.devcontainer/devcontainer.json',
      JSON.stringify(devcontainer, null, 2),
      `🚀 Configure Codespace`
    );
  }

  /**
   * GITHUB PAGES - Documentation
   */
  async publishDocumentation(content: string, path: string = 'index.md') {
    await this.commitFile(
      'gh-pages',
      `docs/${path}`,
      content,
      `📚 Update documentation`
    );

    // Enable GitHub Pages if not already
    await this.octokit.repos.createPagesSite({
      owner: this.getOwner(),
      repo: this.getRepo(),
      source: { branch: 'gh-pages', path: '/docs' }
    });
  }

  /**
   * GITHUB WIKI - Knowledge repository
   */
  async createWikiPage(title: string, content: string) {
    // Wikis are separate git repos
    const wikiRepo = `${this.userSpace}.wiki`;

    await this.commitFile(
      'master',  // Wiki repos use master
      `${title.replace(/ /g, '-')}.md`,
      content,
      `📖 Create wiki: ${title}`,
      wikiRepo
    );
  }

  /**
   * GITHUB GISTS - Code snippets
   */
  async createGist(description: string, files: Record<string, {content: string}>) {
    const gist = await this.octokit.gists.create({
      description,
      public: false,
      files
    });

    // Link gist to main repo
    await this.octokit.issues.createComment({
      owner: this.getOwner(),
      repo: this.getRepo(),
      issue_number: 1,  // Or relevant issue
      body: `📌 Created gist: ${gist.data.html_url}`
    });

    return gist.data;
  }

  /**
   * GITHUB RELEASES - Version management
   */
  async createRelease(version: string, notes: string, assets?: any[]) {
    const release = await this.octokit.repos.createRelease({
      owner: this.getOwner(),
      repo: this.getRepo(),
      tag_name: `v${version}`,
      name: `ChittyChat ${version}`,
      body: notes,
      draft: false,
      prerelease: false
    });

    // Upload assets if any
    if (assets) {
      for (const asset of assets) {
        await this.octokit.repos.uploadReleaseAsset({
          owner: this.getOwner(),
          repo: this.getRepo(),
          release_id: release.data.id,
          name: asset.name,
          data: asset.data
        });
      }
    }

    return release.data;
  }

  /**
   * GITHUB SECURITY - Vulnerability management
   */
  async setupSecurity() {
    // Enable all security features
    await this.octokit.repos.update({
      owner: this.getOwner(),
      repo: this.getRepo(),
      has_vulnerability_alerts: true,
      has_automated_security_fixes: true
    });

    // Create security policy
    const securityPolicy = `# Security Policy

## Supported Versions
| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability
Please report vulnerabilities to security@chittychat.legal
`;

    await this.commitFile(
      'main',
      'SECURITY.md',
      securityPolicy,
      '🔒 Add security policy'
    );

    // Set up Dependabot
    const dependabotConfig = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "auto-merge"
`;

    await this.commitFile(
      'main',
      '.github/dependabot.yml',
      dependabotConfig,
      '🤖 Configure Dependabot'
    );
  }

  /**
   * GITHUB WEBHOOKS - Real-time events
   */
  async setupWebhook(url: string, events: string[]) {
    const webhook = await this.octokit.repos.createWebhook({
      owner: this.getOwner(),
      repo: this.getRepo(),
      config: {
        url,
        content_type: 'json',
        secret: process.env.WEBHOOK_SECRET
      },
      events
    });

    return webhook.data;
  }

  /**
   * Central connection manager
   */
  async connectService(service: ServiceConnection) {
    console.log(`🔗 Connecting ${service.type} to GitHub Central Hub`);

    this.connections.set(service.type, service);

    // Create workflow for service
    await this.createWorkflowForService(service);

    // Set up webhook if needed
    if (service.githubIntegration.webhook) {
      await this.setupWebhook(service.githubIntegration.webhook, [
        'push',
        'pull_request',
        'issues',
        'repository_dispatch'
      ]);
    }

    // Create GitHub App if needed
    if (service.githubIntegration.app) {
      await this.createGitHubApp(service.type, {
        contents: 'write',
        issues: 'write',
        pull_requests: 'write',
        actions: 'write'
      });
    }

    return true;
  }

  // Helper methods
  private getServiceScript(type: string): string {
    const scripts: Record<string, string> = {
      claude: `
          # Sync Claude session data
          curl -X POST https://api.anthropic.com/v1/sessions \\
            -H "x-api-key: \${{ secrets.CLAUDE_API_KEY }}" \\
            -d '{"session_id": "${{ github.event.client_payload.session_id }}"}'
      `,
      openai: `
          # Sync OpenAI session data
          curl -X POST https://api.openai.com/v1/sessions \\
            -H "Authorization: Bearer \${{ secrets.OPENAI_API_KEY }}" \\
            -d '{"session_id": "${{ github.event.client_payload.session_id }}"}'
      `,
      notion: `
          # Sync with Notion
          npm install @notionhq/client
          node -e "
            const { Client } = require('@notionhq/client');
            const notion = new Client({ auth: process.env.NOTION_TOKEN });
            // Sync logic here
          "
      `,
      google: `
          # Sync with Google Workspace
          npm install googleapis
          node -e "
            const { google } = require('googleapis');
            // Google sync logic
          "
      `
    };

    return scripts[type] || '# Custom integration';
  }

  private async addProjectFields(projectId: string, fields: any[]) {
    for (const field of fields) {
      await this.octokit.graphql(`
        mutation AddProjectField($projectId: ID!, $name: String!, $dataType: ProjectV2FieldType!) {
          createProjectV2Field(input: {
            projectId: $projectId,
            name: $name,
            dataType: $dataType
          }) {
            projectV2Field { id }
          }
        }
      `, {
        projectId,
        name: field.name,
        dataType: field.type
      });
    }
  }

  private async createProjectAutomation(projectId: string) {
    const automation = `
name: Project Automation

on:
  issues:
    types: [opened, closed, labeled]
  pull_request:
    types: [opened, closed, merged]

jobs:
  add-to-project:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v0.5.0
        with:
          project-url: https://github.com/orgs/chittyos/projects/1
          github-token: \${{ secrets.GITHUB_TOKEN }}
`;

    await this.commitFile(
      'main',
      '.github/workflows/project-automation.yml',
      automation,
      '🤖 Add project automation'
    );
  }

  private async addIssueToProject(issueNumber: number) {
    // Implementation would add issue to project board
    console.log(`Adding issue #${issueNumber} to project`);
  }

  private async getOwnerId(): Promise<string> {
    const { data } = await this.octokit.users.getByUsername({
      username: this.getOwner()
    });
    return data.node_id;
  }

  private async getRepoId(): Promise<string> {
    const { data } = await this.octokit.repos.get({
      owner: this.getOwner(),
      repo: this.getRepo()
    });
    return data.node_id;
  }

  private async getDiscussionCategoryId(name: string): Promise<string> {
    // Would fetch actual category ID
    return 'DIC_kwDOABC123';
  }

  private async commitFile(branch: string, path: string, content: string, message: string, repo?: string) {
    const [owner, repoName] = (repo || this.userSpace).split('/');

    try {
      // Get file if exists
      const { data: currentFile } = await this.octokit.repos.getContent({
        owner,
        repo: repoName,
        path,
        ref: branch
      }).catch(() => ({ data: null }));

      if (currentFile && 'sha' in currentFile) {
        // Update existing file
        await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo: repoName,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          sha: currentFile.sha,
          branch
        });
      } else {
        // Create new file
        await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo: repoName,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch
        });
      }
    } catch (error) {
      console.error(`Failed to commit ${path}:`, error);
    }
  }

  private getOwner(): string {
    return this.userSpace.split('/')[0];
  }

  private getRepo(): string {
    return this.userSpace.split('/')[1];
  }
}

// Example: Connect everything through GitHub
export async function setupCentralHub() {
  const hub = new GitHubCentralHub(process.env.GITHUB_TOKEN!);

  // Connect all services
  await hub.connectService({
    type: 'claude',
    githubIntegration: {
      webhook: 'https://api.chittychat.legal/webhooks/claude',
      action: 'claude-sync'
    }
  });

  await hub.connectService({
    type: 'openai',
    githubIntegration: {
      webhook: 'https://api.chittychat.legal/webhooks/openai',
      action: 'openai-sync'
    }
  });

  await hub.connectService({
    type: 'notion',
    githubIntegration: {
      app: 'chittychat-notion',
      action: 'notion-sync'
    }
  });

  // Set up GitHub features
  await hub.setupSecurity();
  await hub.setupProject('Legal Case Management');

  // Create documentation
  await hub.publishDocumentation(`
# ChittyChat Central Hub

All services connect through GitHub:
- Claude/OpenAI sessions → GitHub branches
- Notion databases → GitHub Projects
- Google Docs → GitHub Wiki
- Slack messages → GitHub Discussions

Everything is versioned, tracked, and automated!
  `);

  return hub;
}