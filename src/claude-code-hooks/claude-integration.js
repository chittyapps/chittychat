/**
 * Claude Code Integration
 * Hooks into actual Claude Code operations and manages real directories
 */

import { ChittyChatAPI } from '../session-persistence/claude-integration.js';
import fs from 'fs/promises';
import path from 'path';
// Note: child_process execSync removed (unused)

export class ClaudeCodeIntegration {
  constructor() {
    const home = (typeof process !== 'undefined' && process.env && (process.env.CLAUDE_BASE_PATH || process.env.HOME)) || '';
    const base = process.env?.CLAUDE_BASE_PATH || (home ? path.join(home, '.claude') : '/Users/nb/.claude');

    this.claudeProjectsDir = path.join(base, 'projects');
    this.claudeTodosDir = path.join(base, 'todos');
    this.claudeSessionsDir = path.join(base, 'sessions');

    this.isActive = false;
    this.fileWatcher = null;
    this.originalOperations = new Map();
  }

  /**
   * Start integration with real Claude Code system
   */
  async start() {
    console.log('🔌 Starting Claude Code integration...');

    // Start ChittyChat session system
    await ChittyChatAPI.start();

    // Hook into real directories
    await this.watchClaudeDirectories();

    // Manage existing projects and todos
    await this.consolidateExistingData();

    this.isActive = true;
    console.log('✅ Claude Code integration active');

    return {
      status: 'active',
      watching: [this.claudeProjectsDir, this.claudeTodosDir],
      sessionsDir: this.claudeSessionsDir,
    };
  }

  /**
   * Watch Claude's actual directories for changes
   */
  async watchClaudeDirectories() {
    const chokidar = await import('chokidar');

    this.fileWatcher = chokidar.watch([this.claudeProjectsDir, this.claudeTodosDir], {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        /node_modules/,
        /.git/,
        /\.DS_Store/,
      ],
      persistent: true,
      ignoreInitial: false,
    });

    // Track file operations
    this.fileWatcher
      .on('add', (filePath) => this.handleFileOperation('add', filePath))
      .on('change', (filePath) => this.handleFileOperation('change', filePath))
      .on('unlink', (filePath) => this.handleFileOperation('delete', filePath));

    console.log('👁️ Watching Claude directories for changes');
  }

  /**
   * Handle file operations in Claude directories
   */
  async handleFileOperation(operation, filePath) {
    if (!this.isActive) return;

    try {
      // Determine if this is a project file or todo file
      if (filePath.startsWith(this.claudeProjectsDir)) {
        await this.handleProjectFile(operation, filePath);
      } else if (filePath.startsWith(this.claudeTodosDir)) {
        await this.handleTodoFile(operation, filePath);
      }

      // Track in ChittyChat session
      const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
      await ChittyChatAPI.fileOperation(filePath, operation, content);
    } catch (error) {
      console.warn(`Failed to handle ${operation} on ${filePath}:`, error.message);
    }
  }

  /**
   * Handle changes to project files
   */
  async handleProjectFile(operation, filePath) {
    const relativePath = path.relative(this.claudeProjectsDir, filePath);
    const projectName = relativePath.split('/')[0];

    console.log(`📁 Project file ${operation}: ${projectName}/${path.basename(filePath)}`);

    // Update session context based on project
    if (operation === 'add' || operation === 'change') {
      const projectContext = await this.extractProjectContext(projectName, filePath);

      if (projectContext) {
        await ChittyChatAPI.setContext(
          `Working on project: ${projectName}. Current file: ${path.basename(filePath)}`,
          projectContext.intent || `Developing ${projectName}`
        );
      }
    }

    // Check for and consolidate duplicate projects
    if (operation === 'add') {
      await this.checkForDuplicateProjects(projectName);
    }
  }

  /**
   * Handle changes to todo files
   */
  async handleTodoFile(operation, filePath) {
    console.log(`✅ Todo file ${operation}: ${path.basename(filePath)}`);

    if (operation === 'add' || operation === 'change') {
      // Read and sync todos to session
      const todos = await this.parseTodoFile(filePath);

      for (const todo of todos) {
        await ChittyChatAPI.addTodo(todo.text, todo.priority);
      }

      // Consolidate todos across sessions
      await this.consolidateTodos();
    }
  }

  /**
   * Consolidate existing Claude data into ChittyChat system
   */
  async consolidateExistingData() {
    console.log('🔄 Consolidating existing Claude data...');

    // Scan existing projects
    const projects = await this.scanExistingProjects();
    console.log(`   Found ${projects.length} existing projects`);

    // Scan existing todos
    const todos = await this.scanExistingTodos();
    console.log(`   Found ${todos.length} existing todo files`);

    // Update session with current state
    if (projects.length > 0 || todos.length > 0) {
      const context = this.generateConsolidationContext(projects, todos);
      await ChittyChatAPI.setContext(context, 'Consolidating existing Claude work');
    }

    // Set up next steps based on what was found
    const nextSteps = [];
    if (projects.length > 5) {
      nextSteps.push('Review projects for duplicates and consolidation opportunities');
    }
    if (todos.length > 3) {
      nextSteps.push('Consolidate todo files into unified task management');
    }
    nextSteps.push('Continue development with session tracking active');

    if (nextSteps.length > 0) {
      await ChittyChatAPI.setNextSteps(nextSteps);
    }
  }

  /**
   * Scan existing projects in Claude directory
   */
  async scanExistingProjects() {
    const projects = [];

    try {
      const entries = await fs.readdir(this.claudeProjectsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const projectPath = path.join(this.claudeProjectsDir, entry.name);
          const metadata = await this.getProjectMetadata(projectPath);

          projects.push({
            name: entry.name,
            path: projectPath,
            ...metadata,
          });
        }
      }
    } catch (error) {
      console.warn('Could not scan existing projects:', error.message);
    }

    return projects;
  }

  /**
   * Scan existing todos in Claude directory
   */
  async scanExistingTodos() {
    const todos = [];

    try {
      const entries = await fs.readdir(this.claudeTodosDir);

      for (const entry of entries) {
        if (entry.endsWith('.json') || entry.endsWith('.md') || entry.endsWith('.txt')) {
          const todoPath = path.join(this.claudeTodosDir, entry);
          const parsedTodos = await this.parseTodoFile(todoPath);

          todos.push({
            file: entry,
            path: todoPath,
            todos: parsedTodos,
          });
        }
      }
    } catch (error) {
      console.warn('Could not scan existing todos:', error.message);
    }

    return todos;
  }

  /**
   * Parse various todo file formats
   */
  async parseTodoFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const todos = [];

      if (filePath.endsWith('.json')) {
        // Parse JSON todos (Claude's format)
        const data = JSON.parse(content);
        const todoArray = Array.isArray(data) ? data : data.todos || [];

        for (const todo of todoArray) {
          todos.push({
            text: typeof todo === 'string' ? todo : todo.content || todo.text,
            completed: todo.completed || todo.status === 'completed',
            priority: todo.priority || 'normal',
          });
        }
      } else {
        // Parse markdown/text todos
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const completed = trimmed.includes('[x]') || trimmed.includes('✓');
            const text = trimmed
              .replace(/^[-*]\s*(\[.\])?\s*/, '')
              .replace(/✓/, '')
              .trim();

            if (text) {
              todos.push({
                text,
                completed,
                priority: line.includes('!') ? 'high' : 'normal',
              });
            }
          }
        }
      }

      return todos;
    } catch (error) {
      console.warn(`Could not parse todo file ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Extract project context from files
   */
  async extractProjectContext(projectName, filePath) {
    try {
      // Look for CLAUDE.md or README.md
      const contextFiles = ['CLAUDE.md', 'README.md', 'package.json'];
      const projectDir = path.join(this.claudeProjectsDir, projectName);

      for (const file of contextFiles) {
        const contextPath = path.join(projectDir, file);

        try {
          const content = await fs.readFile(contextPath, 'utf-8');

          if (file === 'package.json') {
            const pkg = JSON.parse(content);
            return {
              intent: `Working on ${pkg.name}: ${pkg.description || 'Node.js project'}`,
              type: 'nodejs',
              description: pkg.description,
            };
          } else {
            // Extract first meaningful paragraph
            const lines = content.split('\n').filter((l) => l.trim());
            const description = lines.slice(0, 3).join(' ').substring(0, 200);

            return {
              intent: `Working on ${projectName}`,
              description,
              type: 'project',
            };
          }
        } catch {
          // File doesn't exist, continue
        }
      }

      return {
        intent: `Working on ${projectName}`,
        type: 'unknown',
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(projectPath) {
    try {
      const stats = await fs.stat(projectPath);
      const files = await fs.readdir(projectPath);

      return {
        lastModified: stats.mtime,
        fileCount: files.length,
        isGitRepo: files.includes('.git'),
        hasPackageJson: files.includes('package.json'),
        hasClaudeMd: files.includes('CLAUDE.md'),
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Check for duplicate projects and consolidate
   */
  async checkForDuplicateProjects(newProjectName) {
    const projects = await this.scanExistingProjects();
    const similar = projects.filter(
      (p) => p.name !== newProjectName && this.calculateSimilarity(p.name, newProjectName) > 0.7
    );

    if (similar.length > 0) {
      console.log(
        `⚠️ Found similar projects to ${newProjectName}:`,
        similar.map((p) => p.name)
      );

      await ChittyChatAPI.addTodo(
        `Review potential duplicate projects: ${newProjectName} vs ${similar.map((p) => p.name).join(', ')}`,
        'high'
      );
    }
  }

  /**
   * Consolidate todos across all todo files
   */
  async consolidateTodos() {
    const allTodos = await this.scanExistingTodos();
    const projectTodos = new Map();

    // Group todos by project
    for (const todoFile of allTodos) {
      // Try to extract project name from filename
      const projectName = this.extractProjectFromTodoFilename(todoFile.file);

      if (!projectTodos.has(projectName)) {
        projectTodos.set(projectName, []);
      }

      projectTodos.get(projectName).push(...todoFile.todos);
    }

    // Create consolidated todo files
    for (const [projectName, todos] of projectTodos) {
      if (todos.length > 1) {
        await this.createConsolidatedTodoFile(projectName, todos);
      }
    }
  }

  /**
   * Create consolidated todo file
   */
  async createConsolidatedTodoFile(projectName, todos) {
    const consolidatedPath = path.join(this.claudeTodosDir, `${projectName}-consolidated.json`);

    const uniqueTodos = this.deduplicateTodos(todos);

    const todoData = {
      project: projectName,
      todos: uniqueTodos,
      lastUpdated: new Date().toISOString(),
      source: 'ChittyChat consolidation',
    };

    await fs.writeFile(consolidatedPath, JSON.stringify(todoData, null, 2));
    console.log(`📝 Created consolidated todos: ${consolidatedPath}`);
  }

  /**
   * Helper functions
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  extractProjectFromTodoFilename(filename) {
    // Try various patterns
    const patterns = [
      /^([^-_\.]+)[-_]todo/i,
      /^([^-_\.]+)[-_]tasks/i,
      /^todo[-_]([^-_\.]+)/i,
      /^([^-_\.]+)/,
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    return 'general';
  }

  deduplicateTodos(todos) {
    const seen = new Set();
    return todos.filter((todo) => {
      const key = `${todo.text.toLowerCase()}-${todo.completed}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  generateConsolidationContext(projects, todos) {
    return (
      `Managing ${projects.length} existing projects and ${todos.length} todo files. ` +
      `Projects: ${projects
        .slice(0, 3)
        .map((p) => p.name)
        .join(', ')}${projects.length > 3 ? '...' : ''}. ` +
      `ChittyChat session tracking now active for all future work.`
    );
  }

  /**
   * Stop integration
   */
  stop() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }

    this.isActive = false;
    console.log('⏹️ Claude Code integration stopped');
  }
}

export default ClaudeCodeIntegration;
