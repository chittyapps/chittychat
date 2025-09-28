/**
 * ChittyChat Unified Project Manager
 * Consolidates all Claude projects, worktrees, and todos into a unified system
 * Manages deduplication, archiving, and synchronization
 */

import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

export class UnifiedProjectManager {
  constructor(config = {}) {
    this.projectsDir = config.projectsDir || "/Users/nb/.claude/projects";
    this.todosDir = config.todosDir || "/Users/nb/.claude/todos";
    this.chittychatDataRepo =
      config.dataRepo || "/Users/nb/.claude/projects/-/chittychat-data";
    this.archiveDir =
      config.archiveDir || "/Users/nb/.claude/projects/.archive";

    // Track all projects and their relationships
    this.projectRegistry = new Map();
    this.worktreeMap = new Map();
    this.todoRegistry = new Map();

    // Deduplication tracking
    this.fileHashes = new Map();
    this.duplicates = new Map();
  }

  /**
   * Initialize and scan all projects
   */
  async initialize() {
    console.log("🚀 Initializing ChittyChat Project Consolidation System");

    // Ensure directories exist
    await this.ensureDirectories();

    // Scan all projects
    await this.scanProjects();

    // Identify git worktrees and branches
    await this.mapWorktrees();

    // Scan todos
    await this.scanTodos();

    // Initial consolidation
    await this.consolidateProjects();

    console.log(`✅ Found ${this.projectRegistry.size} projects`);
    console.log(`🌳 Found ${this.worktreeMap.size} worktrees`);
    console.log(`📝 Found ${this.todoRegistry.size} todo lists`);

    return this.getStatus();
  }

  /**
   * Scan all projects in the Claude projects directory
   */
  async scanProjects() {
    const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const projectPath = path.join(this.projectsDir, entry.name);

        // Check if it's a git repository
        const isGitRepo = await this.isGitRepository(projectPath);

        // Get project metadata
        const metadata = await this.getProjectMetadata(projectPath);

        this.projectRegistry.set(entry.name, {
          name: entry.name,
          path: projectPath,
          isGitRepo,
          metadata,
          worktree: null,
          parent: null,
          children: [],
          todos: [],
          lastModified: metadata.lastModified,
          files: [],
        });
      }
    }
  }

  /**
   * Map git worktrees to identify relationships
   */
  async mapWorktrees() {
    for (const [name, project] of this.projectRegistry) {
      if (project.isGitRepo) {
        try {
          // Check if this is a worktree
          const { stdout: worktreeInfo } = await execAsync(
            `cd "${project.path}" && git worktree list --porcelain 2>/dev/null || true`,
          );

          if (worktreeInfo) {
            const lines = worktreeInfo.split("\n");
            const worktreePath = lines[0]?.replace("worktree ", "");
            const head = lines[1]?.replace("HEAD ", "");
            const branch = lines[2]?.replace("branch ", "");

            // Check if this is part of chittychat-data
            const { stdout: remoteUrl } = await execAsync(
              `cd "${project.path}" && git remote get-url origin 2>/dev/null || true`,
            );

            if (
              remoteUrl.includes("chittychat") ||
              remoteUrl.includes("chitcommit")
            ) {
              project.worktree = {
                path: worktreePath,
                head,
                branch,
                remoteUrl: remoteUrl.trim(),
                isMainWorktree: worktreePath === project.path,
              };

              this.worktreeMap.set(branch || head, project);
            }
          }
        } catch (error) {
          console.warn(`Could not check worktree for ${name}:`, error.message);
        }
      }
    }
  }

  /**
   * Scan and consolidate todos
   */
  async scanTodos() {
    try {
      const todoFiles = await fs.readdir(this.todosDir);

      for (const file of todoFiles) {
        if (file.endsWith(".json") || file.endsWith(".md")) {
          const todoPath = path.join(this.todosDir, file);
          const content = await fs.readFile(todoPath, "utf-8");

          // Parse todo content
          const todos = this.parseTodos(content, file);

          // Match todos to projects
          const projectName = this.extractProjectFromTodo(file, content);

          this.todoRegistry.set(file, {
            path: todoPath,
            projectName,
            todos,
            lastModified: (await fs.stat(todoPath)).mtime,
          });

          // Link to project
          if (projectName && this.projectRegistry.has(projectName)) {
            this.projectRegistry.get(projectName).todos.push(todos);
          }
        }
      }
    } catch (error) {
      console.warn("Could not scan todos:", error.message);
    }
  }

  /**
   * Consolidate projects - main consolidation logic
   */
  async consolidateProjects() {
    console.log("🔄 Starting project consolidation...");

    // Phase 1: Identify duplicates across projects
    await this.identifyDuplicates();

    // Phase 2: Merge related worktrees
    await this.mergeWorktrees();

    // Phase 3: Consolidate todos
    await this.consolidateTodos();

    // Phase 4: Archive duplicates
    await this.archiveDuplicates();

    // Phase 5: Update chittychat-data repository
    await this.updateMainRepository();

    console.log("✅ Consolidation complete");
  }

  /**
   * Identify duplicate files across projects
   */
  async identifyDuplicates() {
    console.log("🔍 Identifying duplicates...");

    for (const [name, project] of this.projectRegistry) {
      const files = await this.scanProjectFiles(project.path);

      for (const file of files) {
        const hash = await this.hashFile(file.path);

        if (this.fileHashes.has(hash)) {
          // Found duplicate
          const original = this.fileHashes.get(hash);

          if (!this.duplicates.has(hash)) {
            this.duplicates.set(hash, [original]);
          }
          this.duplicates.get(hash).push(file);

          console.log(`  Duplicate found: ${file.relativePath}`);
        } else {
          this.fileHashes.set(hash, file);
        }

        project.files.push(file);
      }
    }

    console.log(`  Found ${this.duplicates.size} sets of duplicates`);
  }

  /**
   * Merge related worktrees into main branch
   */
  async mergeWorktrees() {
    console.log("🌳 Merging worktrees...");

    // Find the main chittychat-data repository
    let mainRepo = null;
    for (const [name, project] of this.projectRegistry) {
      if (
        project.path === this.chittychatDataRepo ||
        (project.worktree && project.worktree.isMainWorktree)
      ) {
        mainRepo = project;
        break;
      }
    }

    if (!mainRepo) {
      console.log("  No main repository found, creating one...");
      mainRepo = await this.createMainRepository();
    }

    // Merge all worktrees into main
    for (const [branch, project] of this.worktreeMap) {
      if (project !== mainRepo && project.worktree) {
        console.log(`  Merging worktree ${branch} into main...`);

        try {
          // Copy unique files to main repo
          for (const file of project.files) {
            const targetPath = path.join(mainRepo.path, file.relativePath);

            if (!(await this.fileExists(targetPath))) {
              await this.copyFile(file.path, targetPath);
              console.log(`    Copied: ${file.relativePath}`);
            }
          }

          // Commit changes in main repo
          await execAsync(`
            cd "${mainRepo.path}" &&
            git add . &&
            git commit -m "Merged worktree ${branch} via ChittyChat consolidation" || true
          `);
        } catch (error) {
          console.error(`  Failed to merge ${branch}:`, error.message);
        }
      }
    }
  }

  /**
   * Consolidate todos into unified lists
   */
  async consolidateTodos() {
    console.log("📝 Consolidating todos...");

    const projectTodos = new Map();

    // Group todos by project
    for (const [file, todoData] of this.todoRegistry) {
      const projectName = todoData.projectName || "general";

      if (!projectTodos.has(projectName)) {
        projectTodos.set(projectName, []);
      }

      projectTodos.get(projectName).push(...todoData.todos);
    }

    // Remove duplicates and create unified todos
    for (const [projectName, todos] of projectTodos) {
      const uniqueTodos = this.deduplicateTodos(todos);

      // Save unified todo file
      const unifiedTodoPath = path.join(
        this.todosDir,
        `${projectName}-unified.json`,
      );
      await fs.writeFile(
        unifiedTodoPath,
        JSON.stringify(
          {
            project: projectName,
            todos: uniqueTodos,
            lastUpdated: new Date().toISOString(),
            source: "ChittyChat Project Consolidation",
          },
          null,
          2,
        ),
      );

      console.log(
        `  Created unified todo for ${projectName}: ${uniqueTodos.length} items`,
      );
    }
  }

  /**
   * Archive duplicate files
   */
  async archiveDuplicates() {
    console.log("📦 Archiving duplicates...");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivePath = path.join(this.archiveDir, timestamp);

    await fs.mkdir(archivePath, { recursive: true });

    for (const [hash, files] of this.duplicates) {
      // Keep the first file, archive the rest
      const [original, ...duplicates] = files;

      for (const dup of duplicates) {
        const archiveFilePath = path.join(
          archivePath,
          dup.projectName,
          dup.relativePath,
        );

        await fs.mkdir(path.dirname(archiveFilePath), { recursive: true });
        await fs.rename(dup.path, archiveFilePath);

        console.log(`  Archived: ${dup.relativePath}`);
      }
    }

    // Save archive manifest
    const manifest = {
      timestamp,
      duplicatesArchived: this.duplicates.size,
      files: Array.from(this.duplicates.values()).flat(),
    };

    await fs.writeFile(
      path.join(archivePath, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }

  /**
   * Update main chittychat-data repository
   */
  async updateMainRepository() {
    console.log("📤 Updating main repository...");

    try {
      // Push to remote
      await execAsync(`
        cd "${this.chittychatDataRepo}" &&
        git push origin main || true
      `);

      console.log("  Main repository updated");
    } catch (error) {
      console.warn("  Could not push to remote:", error.message);
    }
  }

  /**
   * Sync projects on demand
   */
  async syncProjects() {
    console.log("🔄 Syncing projects...");

    // Re-scan for changes
    await this.scanProjects();
    await this.scanTodos();

    // Consolidate changes
    await this.consolidateProjects();

    return this.getStatus();
  }

  /**
   * Sync based on topic/context
   */
  async syncByTopic(topic) {
    console.log(`🎯 Syncing projects for topic: ${topic}`);

    // Find projects related to topic
    const relatedProjects = [];

    for (const [name, project] of this.projectRegistry) {
      if (
        name.includes(topic) ||
        project.metadata.description?.includes(topic) ||
        project.todos.some((t) => t.content?.includes(topic))
      ) {
        relatedProjects.push(project);
      }
    }

    console.log(`  Found ${relatedProjects.length} related projects`);

    // Create topic-specific consolidation
    const topicPath = path.join(this.chittychatDataRepo, "topics", topic);
    await fs.mkdir(topicPath, { recursive: true });

    // Consolidate topic-related files
    for (const project of relatedProjects) {
      for (const file of project.files) {
        if (file.content?.includes(topic)) {
          const targetPath = path.join(
            topicPath,
            project.name,
            file.relativePath,
          );
          await this.copyFile(file.path, targetPath);
        }
      }
    }

    return relatedProjects;
  }

  /**
   * Helper functions
   */

  async ensureDirectories() {
    await fs.mkdir(this.archiveDir, { recursive: true });
    await fs.mkdir(this.chittychatDataRepo, { recursive: true });
    await fs.mkdir(this.todosDir, { recursive: true });
  }

  async isGitRepository(dir) {
    try {
      await fs.access(path.join(dir, ".git"));
      return true;
    } catch {
      return false;
    }
  }

  async getProjectMetadata(projectPath) {
    const metadata = {
      lastModified: null,
      description: "",
      files: 0,
      size: 0,
    };

    try {
      const stats = await fs.stat(projectPath);
      metadata.lastModified = stats.mtime;

      // Try to read README or CLAUDE.md
      const readmePath = path.join(projectPath, "README.md");
      const claudePath = path.join(projectPath, "CLAUDE.md");

      if (await this.fileExists(readmePath)) {
        const content = await fs.readFile(readmePath, "utf-8");
        metadata.description = content.substring(0, 200);
      } else if (await this.fileExists(claudePath)) {
        const content = await fs.readFile(claudePath, "utf-8");
        metadata.description = content.substring(0, 200);
      }
    } catch (error) {
      console.warn(`Could not get metadata for ${projectPath}:`, error.message);
    }

    return metadata;
  }

  async scanProjectFiles(projectPath, baseDir = projectPath) {
    const files = [];
    const entries = await fs.readdir(projectPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(projectPath, entry.name);

      // Skip certain directories
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name === ".archive"
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.scanProjectFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push({
          path: fullPath,
          relativePath: path.relative(baseDir, fullPath),
          projectName: path.basename(baseDir),
          size: (await fs.stat(fullPath)).size,
        });
      }
    }

    return files;
  }

  async hashFile(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(source, target) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  async createMainRepository() {
    await fs.mkdir(this.chittychatDataRepo, { recursive: true });

    await execAsync(`
      cd "${this.chittychatDataRepo}" &&
      git init &&
      git remote add origin https://github.com/chittyos/chittychat-data.git 2>/dev/null || true
    `);

    return {
      name: "chittychat-data",
      path: this.chittychatDataRepo,
      isGitRepo: true,
      worktree: { isMainWorktree: true },
      files: [],
    };
  }

  parseTodos(content, filename) {
    if (filename.endsWith(".json")) {
      try {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : data.todos || [];
      } catch {
        return [];
      }
    } else if (filename.endsWith(".md")) {
      // Parse markdown todos
      const lines = content.split("\n");
      const todos = [];

      for (const line of lines) {
        if (line.match(/^[\s]*[-*]\s*\[.\]\s*/)) {
          const completed = line.includes("[x]") || line.includes("[X]");
          const text = line.replace(/^[\s]*[-*]\s*\[.\]\s*/, "").trim();
          todos.push({
            content: text,
            completed,
            source: "markdown",
          });
        }
      }

      return todos;
    }

    return [];
  }

  extractProjectFromTodo(filename, content) {
    // Try to extract project name from filename
    const match = filename.match(/^(.+?)[-_]todo/i);
    if (match) return match[1];

    // Try to find project reference in content
    if (content.includes("project:")) {
      const projectMatch = content.match(/project:\s*["']?([^"'\n]+)/);
      if (projectMatch) return projectMatch[1];
    }

    return null;
  }

  deduplicateTodos(todos) {
    const seen = new Set();
    return todos.filter((todo) => {
      const key = `${todo.content}-${todo.completed}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  getStatus() {
    return {
      projects: this.projectRegistry.size,
      worktrees: this.worktreeMap.size,
      todos: this.todoRegistry.size,
      duplicates: this.duplicates.size,
      lastSync: new Date().toISOString(),
    };
  }
}

// Export for use in ChittyChat
export default UnifiedProjectManager;
