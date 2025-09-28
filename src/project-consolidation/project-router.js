/**
 * ChittyChat Project Router
 * Routes code and files to their appropriate project repositories
 * ChittyChat maintains metadata and orchestration only
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { GitHubOrchestrator } from './github-orchestrator.js';

export class ProjectRouter {
  constructor(config = {}) {
    this.systemDir = '/Users/nb/.claude';
    this.projectsDir = path.join(this.systemDir, 'projects');

    // GitHub client for repo operations
    this.octokit = new Octokit({
      auth: config.githubToken || process.env.GITHUB_TOKEN,
      userAgent: 'ChittyChat/1.0.0',
    });

    // GitHub orchestrator for system-level operations
    this.orchestrator = new GitHubOrchestrator(config);

    // Project repository mappings (metadata only)
    this.projectRepos = new Map();

    // ChittyChat's own metadata repository
    this.metadataRepo = {
      owner: 'chittyos',
      repo: 'chittychat-metadata',
    };
  }

  /**
   * Initialize and discover all project repositories
   */
  async initialize() {
    console.log('🚀 Initializing ChittyChat Project Router...');

    // Discover all project repositories
    await this.discoverProjectRepos();

    // Set up metadata tracking
    await this.initializeMetadataRepo();

    console.log(`✅ Discovered ${this.projectRepos.size} project repositories`);

    return {
      projects: Array.from(this.projectRepos.values()),
      metadata: this.metadataRepo,
    };
  }

  /**
   * Discover and map all project repositories
   */
  async discoverProjectRepos() {
    const projects = await this.scanSystemProjects();

    for (const project of projects) {
      // Extract repository information from project
      const repoInfo = await this.extractRepoInfo(project.path);

      if (repoInfo) {
        this.projectRepos.set(project.name, {
          name: project.name,
          path: project.path,
          repository: repoInfo,
          metadata: {
            lastSync: null,
            files: 0,
            todos: [],
            sessions: [],
            duplicates: [],
          },
        });
      }
    }
  }

  /**
   * Route files to their appropriate project repositories
   */
  async routeFile(filePath, content, metadata = {}) {
    console.log(`📂 Routing file: ${filePath}`);

    // Determine which project this file belongs to
    const project = await this.identifyProject(filePath, metadata);

    if (!project) {
      console.warn('  No project identified for file, skipping');
      return null;
    }

    // Route to the appropriate repository
    return await this.routeToProjectRepo(project, filePath, content, metadata);
  }

  /**
   * Route to specific project repository
   */
  async routeToProjectRepo(project, filePath, content, metadata) {
    const { repository } = project;

    // Create branch for this change
    const branchName = `chittychat-update-${Date.now()}`;

    try {
      // Get default branch
      const { data: repo } = await this.octokit.repos.get({
        owner: repository.owner,
        repo: repository.name,
      });

      const defaultBranch = repo.default_branch;

      // Get latest commit SHA
      const { data: ref } = await this.octokit.git.getRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `heads/${defaultBranch}`,
      });

      // Create new branch
      await this.octokit.git.createRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      // Create or update file in the project's repository
      const relativePath = this.getRelativePath(filePath, project);

      // Check if file exists
      let existingFile;
      try {
        existingFile = await this.octokit.repos.getContent({
          owner: repository.owner,
          repo: repository.name,
          path: relativePath,
          ref: branchName,
        });
      } catch {
        // File doesn't exist, will create
      }

      // Create/update file
      const fileContent = Buffer.from(content).toString('base64');

      await this.octokit.repos.createOrUpdateFileContents({
        owner: repository.owner,
        repo: repository.name,
        path: relativePath,
        message: `ChittyChat: ${metadata.action || 'Update'} ${relativePath}`,
        content: fileContent,
        branch: branchName,
        sha: existingFile?.data?.sha,
      });

      // Create pull request
      const pr = await this.octokit.pulls.create({
        owner: repository.owner,
        repo: repository.name,
        title: `ChittyChat Update: ${relativePath}`,
        head: branchName,
        base: defaultBranch,
        body: this.generatePRBody(filePath, metadata),
      });

      // Update ChittyChat metadata
      await this.updateMetadata(project, {
        lastFile: relativePath,
        lastPR: pr.data.number,
        lastSync: new Date().toISOString(),
      });

      console.log(`  ✅ Routed to ${repository.owner}/${repository.name} PR #${pr.data.number}`);

      return {
        success: true,
        repository: `${repository.owner}/${repository.name}`,
        pr: pr.data.number,
        url: pr.data.html_url,
      };
    } catch (error) {
      console.error(`  ❌ Failed to route to repository:`, error.message);

      // Fall back to local git operations if API fails
      return await this.routeLocally(project, filePath, content);
    }
  }

  /**
   * Route locally using git commands
   */
  async routeLocally(project, filePath, content) {
    const projectPath = project.path;

    // Ensure project is a git repo
    if (!(await this.isGitRepo(projectPath))) {
      await this.initializeProjectRepo(project);
    }

    const relativePath = this.getRelativePath(filePath, project);
    const targetPath = path.join(projectPath, relativePath);

    // Create directory if needed
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Write file
    await fs.writeFile(targetPath, content);

    // Git operations
    try {
      execSync(`cd "${projectPath}" && git add "${relativePath}"`, { stdio: 'pipe' });
      execSync(`cd "${projectPath}" && git commit -m "ChittyChat: Update ${relativePath}"`, {
        stdio: 'pipe',
      });

      console.log(`  ✅ Routed locally to ${projectPath}`);

      return {
        success: true,
        local: true,
        path: targetPath,
      };
    } catch (error) {
      console.error('  ❌ Local routing failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reorganize system files using GitHub features
   */
  async reorganizeSystemFiles() {
    console.log('🎯 Reorganizing system files...');

    // Scan system directories
    const systemScans = {
      projects: await this.scanDirectory(this.projectsDir),
      todos: await this.scanDirectory(path.join(this.systemDir, 'todos')),
      sessions: await this.scanDirectory(path.join(this.systemDir, 'sessions')),
    };

    // Process each category
    const changes = [];

    // Handle project files
    for (const item of systemScans.projects) {
      const itemPath = path.join(this.projectsDir, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        const project = this.projectRepos.get(item);

        if (project) {
          // Route project files to their repository
          const projectChanges = await this.routeProjectFiles(project, itemPath);
          changes.push(...projectChanges);
        }
      }
    }

    // Handle todos - consolidate and route to projects
    const todoChanges = await this.reorganizeTodos(systemScans.todos);
    changes.push(...todoChanges);

    // Handle sessions - archive old, consolidate active
    const sessionChanges = await this.reorganizeSessions(systemScans.sessions);
    changes.push(...sessionChanges);

    // Update metadata repository
    await this.updateMetadataRepo(changes);

    console.log(`✅ Reorganized ${changes.length} system items`);

    return changes;
  }

  /**
   * Route all files in a project directory
   */
  async routeProjectFiles(project, projectPath) {
    const changes = [];
    const files = await this.scanProjectDirectory(projectPath);

    for (const file of files) {
      // Skip git and system files
      if (file.includes('.git') || file.includes('node_modules')) continue;

      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8').catch(() => null);

      if (content) {
        const result = await this.routeFile(filePath, content, {
          action: 'sync',
          source: 'system-reorganization',
        });

        if (result?.success) {
          changes.push({
            type: 'file-routed',
            path: filePath,
            destination: result.repository || result.path,
            pr: result.pr,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Reorganize and route todos to appropriate projects
   */
  async reorganizeTodos(todoFiles) {
    const changes = [];
    const projectTodos = new Map();

    // Group todos by project
    for (const todoFile of todoFiles) {
      const todoPath = path.join(this.systemDir, 'todos', todoFile);
      const content = await fs.readFile(todoPath, 'utf-8').catch(() => null);

      if (content) {
        const project = this.extractProjectFromTodo(todoFile, content);

        if (!projectTodos.has(project)) {
          projectTodos.set(project, []);
        }

        const todos = this.parseTodos(content);
        projectTodos.get(project).push(...todos);
      }
    }

    // Route consolidated todos to each project
    for (const [projectName, todos] of projectTodos) {
      const project = this.projectRepos.get(projectName);

      if (project) {
        const todoContent = this.formatTodos(todos);
        const result = await this.routeFile(`${projectName}/TODO.md`, todoContent, {
          action: 'update-todos',
          source: 'todo-consolidation',
        });

        if (result?.success) {
          changes.push({
            type: 'todos-consolidated',
            project: projectName,
            count: todos.length,
            destination: result.repository || result.path,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Reorganize session files
   */
  async reorganizeSessions(sessionFiles) {
    const changes = [];
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    for (const sessionFile of sessionFiles) {
      const sessionPath = path.join(this.systemDir, 'sessions', sessionFile);
      const stats = await fs.stat(sessionPath);

      if (stats.mtime < cutoffDate) {
        // Archive old session
        const archivePath = path.join(this.systemDir, 'sessions', '.archive', sessionFile);
        await fs.mkdir(path.dirname(archivePath), { recursive: true });
        await fs.rename(sessionPath, archivePath);

        changes.push({
          type: 'session-archived',
          file: sessionFile,
          age: Math.floor((Date.now() - stats.mtime) / (24 * 60 * 60 * 1000)) + ' days',
        });
      }
    }

    return changes;
  }

  /**
   * Update ChittyChat metadata repository
   */
  async updateMetadataRepo(changes) {
    const metadata = {
      timestamp: new Date().toISOString(),
      projects: Array.from(this.projectRepos.values()).map((p) => ({
        name: p.name,
        repository: p.repository,
        metadata: p.metadata,
      })),
      changes,
      summary: {
        totalProjects: this.projectRepos.size,
        totalChanges: changes.length,
        changesByType: changes.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {}),
      },
    };

    // Update metadata in GitHub
    try {
      const content = Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64');

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.metadataRepo.owner,
        repo: this.metadataRepo.repo,
        path: 'metadata.json',
        message: `ChittyChat: System reorganization ${metadata.timestamp}`,
        content,
        sha: await this.getFileSha(this.metadataRepo, 'metadata.json'),
      });

      console.log('  📊 Metadata repository updated');
    } catch (error) {
      console.error('  ❌ Failed to update metadata repo:', error.message);
    }
  }

  /**
   * Helper functions
   */

  async scanSystemProjects() {
    const projects = [];
    const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        projects.push({
          name: entry.name,
          path: path.join(this.projectsDir, entry.name),
        });
      }
    }

    return projects;
  }

  async extractRepoInfo(projectPath) {
    try {
      const remoteUrl = execSync(
        `cd "${projectPath}" && git remote get-url origin 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).trim();

      if (remoteUrl) {
        // Parse GitHub URL
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          return {
            owner: match[1],
            name: match[2],
            url: remoteUrl,
          };
        }
      }
    } catch {
      // Not a git repo or no remote
    }

    return null;
  }

  async identifyProject(filePath, metadata) {
    // Try to identify from file path
    const pathMatch = filePath.match(/\/projects\/([^/]+)/);
    if (pathMatch) {
      const projectName = pathMatch[1];
      return this.projectRepos.get(projectName);
    }

    // Try from metadata
    if (metadata.project) {
      return this.projectRepos.get(metadata.project);
    }

    // Default to first matching project
    for (const [name, project] of this.projectRepos) {
      if (filePath.includes(name)) {
        return project;
      }
    }

    return null;
  }

  getRelativePath(filePath, project) {
    if (filePath.startsWith(project.path)) {
      return path.relative(project.path, filePath);
    }

    // Extract just the filename if no clear relative path
    return path.basename(filePath);
  }

  generatePRBody(filePath, metadata) {
    return `## ChittyChat File Update

**File**: ${filePath}
**Action**: ${metadata.action || 'Update'}
**Source**: ${metadata.source || 'ChittyChat consolidation'}
**Timestamp**: ${new Date().toISOString()}

### Metadata
${metadata.description || 'Automated file update via ChittyChat project consolidation system.'}

---
*This PR was automatically created by ChittyChat - GitHub for AI Project Management*
`;
  }

  async isGitRepo(dir) {
    try {
      await fs.access(path.join(dir, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  async initializeProjectRepo(project) {
    const { path: projectPath, repository } = project;

    execSync(`cd "${projectPath}" && git init`, { stdio: 'pipe' });

    if (repository?.url) {
      execSync(`cd "${projectPath}" && git remote add origin ${repository.url}`, { stdio: 'pipe' });
    }
  }

  async initializeMetadataRepo() {
    try {
      await this.octokit.repos.get({
        owner: this.metadataRepo.owner,
        repo: this.metadataRepo.repo,
      });
    } catch {
      // Create metadata repo if it doesn't exist
      console.log('  Creating metadata repository...');

      await this.octokit.repos.createForAuthenticatedUser({
        name: this.metadataRepo.repo,
        description: 'ChittyChat project metadata and orchestration',
        private: false,
        auto_init: true,
      });
    }
  }

  async scanDirectory(dir) {
    try {
      return await fs.readdir(dir);
    } catch {
      return [];
    }
  }

  async scanProjectDirectory(dir, base = dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subFiles = await this.scanProjectDirectory(fullPath, base);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(path.relative(base, fullPath));
      }
    }

    return files;
  }

  extractProjectFromTodo(filename, content) {
    // Try filename
    const match = filename.match(/^([^-_]+)/);
    if (match) return match[1];

    // Try content
    const projectMatch = content.match(/project:\s*([^\s\n]+)/i);
    if (projectMatch) return projectMatch[1];

    return 'general';
  }

  parseTodos(content) {
    const todos = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        todos.push({
          text: line.trim(),
          completed: line.includes('[x]') || line.includes('✓'),
        });
      }
    }

    return todos;
  }

  formatTodos(todos) {
    let content = '# Project TODOs\n\n';
    content += `*Generated by ChittyChat on ${new Date().toISOString()}*\n\n`;

    const pending = todos.filter((t) => !t.completed);
    const completed = todos.filter((t) => t.completed);

    if (pending.length > 0) {
      content += '## Pending\n\n';
      pending.forEach((t) => (content += `- [ ] ${t.text}\n`));
    }

    if (completed.length > 0) {
      content += '\n## Completed\n\n';
      completed.forEach((t) => (content += `- [x] ${t.text}\n`));
    }

    return content;
  }

  async getFileSha(repo, path) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path,
      });

      return data.sha;
    } catch {
      return undefined;
    }
  }

  async updateMetadata(project, updates) {
    Object.assign(project.metadata, updates);

    // Also update in metadata repo
    await this.updateMetadataRepo([
      {
        type: 'metadata-update',
        project: project.name,
        updates,
      },
    ]);
  }
}

export default ProjectRouter;
