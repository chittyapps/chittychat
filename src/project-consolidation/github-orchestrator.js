/**
 * GitHub Orchestrator
 * Uses GitHub's native features to orchestrate AI project management
 * Leverages branches, PRs, Actions, Issues for coordination
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';

export class GitHubOrchestrator {
  constructor(config = {}) {
    this.owner = config.owner || 'chittyos';
    this.repo = config.repo || 'chittychat-data';
    this.token = config.githubToken || process.env.GITHUB_TOKEN;

    this.octokit = new Octokit({
      auth: this.token,
      userAgent: 'ChittyChat/1.0.0',
    });

    this.localRepoPath = '/Users/nb/.claude/projects/-/chittychat-repo';
    this.systemFilesPath = '/Users/nb/.claude';
  }

  /**
   * Initialize GitHub repository with proper structure
   */
  async initialize() {
    console.log('🚀 Initializing GitHub orchestration...');

    // Ensure local repo exists
    await this.ensureLocalRepo();

    // Set up branch structure
    await this.setupBranchStructure();

    // Configure GitHub Actions
    await this.setupActions();

    // Create issue templates
    await this.createIssueTemplates();

    console.log('✅ GitHub orchestration initialized');
  }

  /**
   * Orchestrate system file reorganization using GitHub features
   */
  async orchestrateSystemFiles() {
    console.log('🎭 Orchestrating system files via GitHub...');

    // Step 1: Create branch for reorganization
    const branchName = `reorg-${Date.now()}`;
    await this.createBranch(branchName);

    // Step 2: Scan and categorize system files
    const systemFiles = await this.scanSystemFiles();

    // Step 3: Create pull request with reorganization plan
    const pr = await this.createReorganizationPR(branchName, systemFiles);

    // Step 4: Use GitHub Actions to validate changes
    await this.triggerValidationAction(pr.number);

    // Step 5: Auto-merge if tests pass
    await this.setupAutoMerge(pr.number);

    return pr;
  }

  /**
   * Scan system files and categorize them
   */
  async scanSystemFiles() {
    const categories = {
      projects: [],
      todos: [],
      sessions: [],
      configs: [],
      duplicates: [],
    };

    // Scan projects directory
    const projectsDir = path.join(this.systemFilesPath, 'projects');
    const projects = await this.scanDirectory(projectsDir);

    for (const project of projects) {
      const projectPath = path.join(projectsDir, project);
      const stats = await fs.stat(projectPath).catch(() => null);

      if (stats?.isDirectory()) {
        // Check for duplicate projects
        const isDuplicate = await this.checkDuplicate(projectPath);

        if (isDuplicate) {
          categories.duplicates.push({
            path: projectPath,
            type: 'project',
            originalPath: isDuplicate,
          });
        } else {
          categories.projects.push({
            name: project,
            path: projectPath,
            metadata: await this.extractProjectMetadata(projectPath),
          });
        }
      }
    }

    // Scan todos
    const todosDir = path.join(this.systemFilesPath, 'todos');
    const todos = await this.scanDirectory(todosDir);
    categories.todos = todos;

    // Scan session data
    const sessionsDir = path.join(this.systemFilesPath, 'sessions');
    const sessions = await this.scanDirectory(sessionsDir);
    categories.sessions = sessions;

    return categories;
  }

  /**
   * Reorganize and update system files
   */
  async reorganizeSystemFiles(categories) {
    console.log('📁 Reorganizing system files...');

    const changes = [];

    // Merge duplicate projects
    for (const duplicate of categories.duplicates) {
      const change = await this.mergeDuplicateProject(duplicate.path, duplicate.originalPath);
      changes.push(change);
    }

    // Consolidate todos
    const todoChanges = await this.consolidateTodos(categories.todos);
    changes.push(...todoChanges);

    // Update project metadata
    for (const project of categories.projects) {
      const metadataChange = await this.updateProjectMetadata(project);
      changes.push(metadataChange);
    }

    // Create manifest of changes
    await this.createChangeManifest(changes);

    return changes;
  }

  /**
   * Create pull request for reorganization
   */
  async createReorganizationPR(branchName, systemFiles) {
    console.log('🔄 Creating reorganization PR...');

    // Apply reorganization changes
    const changes = await this.reorganizeSystemFiles(systemFiles);

    // Commit changes
    await this.commitChanges(branchName, changes);

    // Create PR with detailed description
    const pr = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `🤖 AI Project Reorganization - ${new Date().toISOString()}`,
      head: branchName,
      base: 'main',
      body: this.generatePRDescription(changes),
      labels: ['auto-reorg', 'ai-managed'],
    });

    // Add reviewers if configured
    if (this.config.reviewers) {
      await this.octokit.pulls.requestReviewers({
        owner: this.owner,
        repo: this.repo,
        pull_number: pr.data.number,
        reviewers: this.config.reviewers,
      });
    }

    return pr.data;
  }

  /**
   * Use GitHub Issues for project tracking
   */
  async createProjectIssue(project) {
    const issue = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: `📦 Project: ${project.name}`,
      body: `
## Project Overview
- **Path**: ${project.path}
- **Created**: ${project.metadata.created}
- **Last Modified**: ${project.metadata.modified}
- **ChittyID**: ${project.metadata.chittyId}

## Files
${project.metadata.files.map((f) => `- [ ] ${f}`).join('\n')}

## Todos
${project.metadata.todos.map((t) => `- [ ] ${t}`).join('\n')}

## Cross-references
${project.metadata.references.map((r) => `- #${r}`).join('\n')}
      `,
      labels: ['project', project.metadata.status],
      assignees: project.metadata.assignees || [],
    });

    return issue.data;
  }

  /**
   * Setup GitHub Actions for continuous sync
   */
  async setupActions() {
    const workflowPath = '.github/workflows/chittychat-sync.yml';

    const workflow = `
name: ChittyChat Project Sync

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run project sync
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        CHITTY_ID_TOKEN: \${{ secrets.CHITTY_ID_TOKEN }}
      run: |
        node src/project-consolidation/sync-runner.js

    - name: Commit changes
      run: |
        git config --local user.email "chittychat@chitty.cc"
        git config --local user.name "ChittyChat Bot"
        git add -A
        git diff --staged --quiet || git commit -m "🤖 Automated project sync"

    - name: Push changes
      uses: ad-m/github-push-action@master
      with:
        github_token: \${{ secrets.GITHUB_TOKEN }}
        branch: \${{ github.ref }}
    `;

    await fs.writeFile(workflowPath, workflow);
    console.log('  GitHub Actions workflow created');
  }

  /**
   * Create issue templates for project management
   */
  async createIssueTemplates() {
    const templates = {
      'project-setup': {
        name: 'Project Setup',
        about: 'Initialize a new AI project',
        title: '[PROJECT] ',
        labels: ['project', 'setup'],
        body: `
## Project Details
**Name**:
**Type**: [chat/ai/integration/other]
**AI Models**: [claude/gpt/llama/other]

## Requirements
- [ ] ChittyID assigned
- [ ] Git worktree created
- [ ] Initial sync completed
- [ ] Cross-session enabled

## Files to Track
-
-

## Integration Points
- [ ] ChittyChat
- [ ] ChittyRouter
- [ ] ChittySchema
        `,
      },
      'duplicate-merge': {
        name: 'Duplicate Merge',
        about: 'Merge duplicate projects',
        title: '[MERGE] ',
        labels: ['duplicate', 'merge'],
        body: `
## Duplicates Found
**Original**:
**Duplicate(s)**:

## Merge Strategy
- [ ] Merge todos
- [ ] Combine files
- [ ] Update references
- [ ] Archive duplicates

## Conflicts
-
        `,
      },
    };

    for (const [key, template] of Object.entries(templates)) {
      const templatePath = `.github/ISSUE_TEMPLATE/${key}.md`;
      await fs.writeFile(templatePath, this.formatTemplate(template));
    }

    console.log('  Issue templates created');
  }

  /**
   * Use GitHub Projects for kanban board
   */
  async createProjectBoard() {
    const project = await this.octokit.projects.createForRepo({
      owner: this.owner,
      repo: this.repo,
      name: 'AI Project Management',
      body: 'Automated project tracking for ChittyChat',
    });

    // Create columns
    const columns = ['Backlog', 'In Progress', 'Review', 'Done'];
    for (const name of columns) {
      await this.octokit.projects.createColumn({
        project_id: project.data.id,
        name,
      });
    }

    return project.data;
  }

  /**
   * Trigger GitHub Action for validation
   */
  async triggerValidationAction(prNumber) {
    await this.octokit.actions.createWorkflowDispatch({
      owner: this.owner,
      repo: this.repo,
      workflow_id: 'validate-pr.yml',
      ref: 'main',
      inputs: {
        pr_number: prNumber.toString(),
      },
    });
  }

  /**
   * Setup auto-merge for PR
   */
  async setupAutoMerge(prNumber) {
    // Enable auto-merge if all checks pass
    await this.octokit.graphql(
      `
      mutation($pullRequestId: ID!) {
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
        pullRequestId: await this.getPullRequestNodeId(prNumber),
      }
    );
  }

  /**
   * Commit changes to branch
   */
  async commitChanges(branchName, changes) {
    const message = `🤖 Reorganize system files

Changes:
${changes.map((c) => `- ${c.type}: ${c.description}`).join('\n')}

Automated by ChittyChat Project Consolidation
`;

    execSync(`git checkout ${branchName}`, { cwd: this.localRepoPath });
    execSync('git add -A', { cwd: this.localRepoPath });
    execSync(`git commit -m "${message}"`, { cwd: this.localRepoPath });
    execSync(`git push origin ${branchName}`, { cwd: this.localRepoPath });
  }

  /**
   * Generate detailed PR description
   */
  generatePRDescription(changes) {
    return `
## 🤖 Automated System File Reorganization

This PR was automatically generated by ChittyChat's project consolidation system.

### Summary of Changes

📊 **Statistics**:
- Files affected: ${changes.length}
- Duplicates merged: ${changes.filter((c) => c.type === 'merge').length}
- Todos consolidated: ${changes.filter((c) => c.type === 'todo').length}
- Projects updated: ${changes.filter((c) => c.type === 'project').length}

### Detailed Changes

${changes
  .map(
    (c) => `
#### ${c.type === 'merge' ? '🔀' : c.type === 'todo' ? '✅' : '📁'} ${c.description}
- **Type**: ${c.type}
- **Path**: ${c.path}
- **Action**: ${c.action}
${c.details ? `- **Details**: ${c.details}` : ''}
`
  )
  .join('\n')}

### Validation

- [ ] All tests passing
- [ ] No data loss confirmed
- [ ] ChittyID compliance verified
- [ ] Cross-session sync tested

### Auto-merge

This PR will auto-merge once all checks pass. To prevent auto-merge, add the \`do-not-merge\` label.

---
*Generated by ChittyChat - GitHub for AI Project Management*
    `;
  }

  /**
   * Helper: Ensure local repo exists and is up to date
   */
  async ensureLocalRepo() {
    try {
      await fs.access(this.localRepoPath);
      // Pull latest changes
      execSync('git pull', { cwd: this.localRepoPath });
    } catch {
      // Clone repo if it doesn't exist
      execSync(`git clone https://github.com/${this.owner}/${this.repo} ${this.localRepoPath}`);
    }
  }

  /**
   * Helper: Setup branch structure
   */
  async setupBranchStructure() {
    const branches = ['main', 'staging', 'archive'];

    for (const branch of branches) {
      try {
        await this.octokit.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${branch}`,
        });
      } catch {
        // Create branch if it doesn't exist
        const mainRef = await this.octokit.git.getRef({
          owner: this.owner,
          repo: this.repo,
          ref: 'heads/main',
        });

        await this.octokit.git.createRef({
          owner: this.owner,
          repo: this.repo,
          ref: `refs/heads/${branch}`,
          sha: mainRef.data.object.sha,
        });
      }
    }
  }

  /**
   * Helper: Create a new branch
   */
  async createBranch(branchName) {
    const mainRef = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: 'heads/main',
    });

    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: mainRef.data.object.sha,
    });

    return branchName;
  }

  /**
   * Helper: Scan directory
   */
  async scanDirectory(dir) {
    try {
      return await fs.readdir(dir);
    } catch {
      return [];
    }
  }

  /**
   * Helper: Check for duplicate projects
   */
  async checkDuplicate(projectPath) {
    // Implement duplicate detection logic
    // This is a simplified version
    const projectName = path.basename(projectPath);
    const alternatives = [
      projectPath.replace('/-/', '/'),
      projectPath.replace(/\d+$/, ''),
      projectPath.replace(/-copy/, ''),
    ];

    for (const alt of alternatives) {
      if (alt !== projectPath) {
        try {
          await fs.access(alt);
          return alt;
        } catch {
          // Not a duplicate
        }
      }
    }

    return null;
  }

  /**
   * Helper: Extract project metadata
   */
  async extractProjectMetadata(projectPath) {
    const metadata = {
      created: null,
      modified: null,
      chittyId: null,
      files: [],
      todos: [],
      references: [],
      status: 'active',
      assignees: [],
    };

    try {
      const stats = await fs.stat(projectPath);
      metadata.created = stats.birthtime;
      metadata.modified = stats.mtime;

      // Read CLAUDE.md if exists
      const claudePath = path.join(projectPath, 'CLAUDE.md');
      try {
        const content = await fs.readFile(claudePath, 'utf-8');
        const chittyIdMatch = content.match(/ChittyID:\s*([A-Z0-9-]+)/);
        if (chittyIdMatch) {
          metadata.chittyId = chittyIdMatch[1];
        }
      } catch {
        // No CLAUDE.md file
      }

      // List files
      metadata.files = await this.scanDirectory(projectPath);

      // Extract todos if any
      const todoPath = path.join(projectPath, '.todos');
      try {
        const todos = await fs.readFile(todoPath, 'utf-8');
        metadata.todos = todos.split('\n').filter(Boolean);
      } catch {
        // No todos file
      }
    } catch (error) {
      console.error(`Error extracting metadata for ${projectPath}:`, error);
    }

    return metadata;
  }

  /**
   * Helper: Merge duplicate project
   */
  async mergeDuplicateProject(duplicatePath, originalPath) {
    console.log(`  Merging ${duplicatePath} into ${originalPath}`);

    // Copy unique files from duplicate to original
    const duplicateFiles = await this.scanDirectory(duplicatePath);
    const originalFiles = await this.scanDirectory(originalPath);

    for (const file of duplicateFiles) {
      if (!originalFiles.includes(file)) {
        const src = path.join(duplicatePath, file);
        const dest = path.join(originalPath, file);
        await fs.copyFile(src, dest);
      }
    }

    // Archive duplicate
    const archivePath = duplicatePath.replace('/projects/', '/projects/.archive/');
    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.rename(duplicatePath, archivePath);

    return {
      type: 'merge',
      description: `Merged duplicate project`,
      path: duplicatePath,
      action: 'merged',
      details: `Merged into ${originalPath}, archived at ${archivePath}`,
    };
  }

  /**
   * Helper: Consolidate todos
   */
  async consolidateTodos(todos) {
    const changes = [];
    const consolidated = new Map();

    // Group todos by project
    for (const todoFile of todos) {
      const projectMatch = todoFile.match(/project-([^-]+)/);
      if (projectMatch) {
        const project = projectMatch[1];
        if (!consolidated.has(project)) {
          consolidated.set(project, []);
        }
        consolidated.get(project).push(todoFile);
      }
    }

    // Merge todos for each project
    for (const [project, todoFiles] of consolidated) {
      if (todoFiles.length > 1) {
        // Merge all todos into one
        const allTodos = [];
        for (const file of todoFiles) {
          const content = await fs.readFile(
            path.join(this.systemFilesPath, 'todos', file),
            'utf-8'
          );
          allTodos.push(...content.split('\n').filter(Boolean));
        }

        // Remove duplicates
        const uniqueTodos = [...new Set(allTodos)];

        // Write consolidated todos
        const consolidatedPath = path.join(
          this.systemFilesPath,
          'todos',
          `project-${project}-consolidated.txt`
        );
        await fs.writeFile(consolidatedPath, uniqueTodos.join('\n'));

        // Archive old todo files
        for (const file of todoFiles) {
          const oldPath = path.join(this.systemFilesPath, 'todos', file);
          const archivePath = oldPath.replace('/todos/', '/todos/.archive/');
          await fs.mkdir(path.dirname(archivePath), { recursive: true });
          await fs.rename(oldPath, archivePath);
        }

        changes.push({
          type: 'todo',
          description: `Consolidated todos for ${project}`,
          path: consolidatedPath,
          action: 'consolidated',
          details: `Merged ${todoFiles.length} todo files into one`,
        });
      }
    }

    return changes;
  }

  /**
   * Helper: Update project metadata
   */
  async updateProjectMetadata(project) {
    const metadataPath = path.join(project.path, '.chittychat-meta.json');

    const metadata = {
      ...project.metadata,
      lastSync: new Date().toISOString(),
      managedBy: 'ChittyChat',
      version: '1.0.0',
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return {
      type: 'project',
      description: `Updated metadata for ${project.name}`,
      path: metadataPath,
      action: 'updated',
      details: 'Added ChittyChat management metadata',
    };
  }

  /**
   * Helper: Create change manifest
   */
  async createChangeManifest(changes) {
    const manifestPath = path.join(
      this.localRepoPath,
      '.chittychat',
      'manifests',
      `manifest-${Date.now()}.json`
    );

    await fs.mkdir(path.dirname(manifestPath), { recursive: true });

    const manifest = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      changes,
      summary: {
        total: changes.length,
        byType: changes.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {}),
      },
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return manifestPath;
  }

  /**
   * Helper: Format issue template
   */
  formatTemplate(template) {
    return `---
name: ${template.name}
about: ${template.about}
title: '${template.title}'
labels: ${template.labels.join(', ')}
assignees: ''
---

${template.body}
`;
  }

  /**
   * Helper: Get Pull Request Node ID for GraphQL
   */
  async getPullRequestNodeId(prNumber) {
    const pr = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return pr.data.node_id;
  }
}

export default GitHubOrchestrator;
