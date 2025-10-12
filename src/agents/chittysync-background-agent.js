/**
 * ChittySync Background Agent
 * Autonomous background daemon for continuous todo synthesis and session coordination
 *
 * Features:
 * - Real-time file watching with fswatch
 * - Git-like conflict resolution
 * - Incremental consolidation (changed files only)
 * - Parallel file reading for performance
 * - Conflict detection and reporting
 * - Remote sync to sync.chitty.cc with KV persistence
 * - Cross-session awareness and coordination
 *
 * Based on background-agent-design architecture analysis
 */

import { McpAgent } from "@cloudflare/agents";
import { McpServer } from "@modelcontextprotocol/typescript-sdk";
import { z } from "zod";

export class ChittySyncBackgroundAgent extends McpAgent {
  server = new McpServer({
    name: "ChittySync-Background",
    version: "2.0.0",
    description:
      "Continuous todo synthesis and session coordination for ChittyOS",
  });

  // Persistent state with conflict tracking
  initialState = {
    todos: {}, // Map<content, todo>
    sessions: {}, // Map<sessionId, metadata>
    projects: {}, // Map<projectName, coordination>
    conflicts: [], // Array of detected conflicts
    lastSync: null,
    metrics: {
      consolidations: 0,
      conflicts: 0,
      deduplicationRate: 0,
      avgLatency: 0,
    },
    fileHashes: {}, // For incremental updates
  };

  async init() {
    this.registerSyncTools();
    this.registerConflictTools();
    this.registerAnalyticsTools();
    this.registerRemoteSyncTools();
  }

  /**
   * Core Sync Tools
   */
  registerSyncTools() {
    // Incremental consolidation (only changed files)
    this.server.tool(
      "consolidate_incremental",
      {
        sessionFiles: z.array(
          z.object({
            path: z.string(),
            hash: z.string(),
            content: z.string(),
          }),
        ),
      },
      async ({ sessionFiles }) => {
        const startTime = Date.now();
        let processed = 0;
        let skipped = 0;

        // Parallel file reading
        const results = await Promise.all(
          sessionFiles.map(async (file) => {
            // Skip if hash unchanged
            if (this.state.fileHashes[file.path] === file.hash) {
              skipped++;
              return null;
            }

            // Parse todos from file
            try {
              const todos = JSON.parse(file.content);
              this.state.fileHashes[file.path] = file.hash;
              processed++;
              return { path: file.path, todos };
            } catch (error) {
              console.error(`Parse error in ${file.path}:`, error);
              return null;
            }
          }),
        );

        // Merge todos with conflict detection
        const conflicts = [];
        const validResults = results.filter((r) => r !== null);

        for (const result of validResults) {
          for (const todo of result.todos) {
            const key = todo.content;
            const existing = this.state.todos[key];

            if (existing) {
              // Conflict detection
              const conflict = this.detectConflict(existing, todo, result.path);
              if (conflict) {
                conflicts.push(conflict);
              }

              // Git-like resolution: status priority
              const resolved = this.resolveConflict(existing, todo);
              this.state.todos[key] = resolved;
            } else {
              this.state.todos[key] = todo;
            }
          }
        }

        // Update state
        this.setState({
          todos: this.state.todos,
          fileHashes: this.state.fileHashes,
          conflicts: [...this.state.conflicts, ...conflicts],
          metrics: {
            ...this.state.metrics,
            consolidations: this.state.metrics.consolidations + 1,
            conflicts: this.state.metrics.conflicts + conflicts.length,
            avgLatency:
              (this.state.metrics.avgLatency + (Date.now() - startTime)) / 2,
          },
        });

        const deduplicationRate =
          ((sessionFiles.length - Object.keys(this.state.todos).length) /
            sessionFiles.length) *
          100;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                processed,
                skipped,
                total: sessionFiles.length,
                uniqueTodos: Object.keys(this.state.todos).length,
                conflicts: conflicts.length,
                deduplicationRate: Math.round(deduplicationRate),
                latency: Date.now() - startTime,
              }),
            },
          ],
        };
      },
    );

    // Get consolidated todos
    this.server.tool(
      "get_consolidated_todos",
      {
        filter: z
          .object({
            status: z.enum(["pending", "in_progress", "completed"]).optional(),
            project: z.string().optional(),
          })
          .optional(),
      },
      async ({ filter }) => {
        let todos = Object.values(this.state.todos);

        if (filter?.status) {
          todos = todos.filter((t) => t.status === filter.status);
        }

        if (filter?.project) {
          const projectTodos = this.state.projects[filter.project]?.todos || [];
          const projectContents = new Set(projectTodos.map((t) => t.content));
          todos = todos.filter((t) => projectContents.has(t.content));
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                count: todos.length,
                todos,
              }),
            },
          ],
        };
      },
    );

    // Synthesize project coordination
    this.server.tool(
      "synthesize_coordination",
      {
        projectHeuristics: z.object({}).passthrough().optional(),
      },
      async ({ projectHeuristics }) => {
        const projects = new Map();
        const todos = Object.values(this.state.todos);

        // Apply heuristics to group todos by project
        for (const todo of todos) {
          const content = todo.content.toLowerCase();
          let project = "general";

          // Default heuristics
          if (content.includes("chittyschema")) project = "chittyschema";
          else if (content.includes("chittychat")) project = "chittychat";
          else if (content.includes("chittyrouter")) project = "chittyrouter";
          else if (content.includes("chittycheck")) project = "chittycheck";
          else if (content.includes("chittysync")) project = "chittysync";

          // Custom heuristics
          if (projectHeuristics) {
            for (const [keyword, projectName] of Object.entries(
              projectHeuristics,
            )) {
              if (content.includes(keyword.toLowerCase())) {
                project = projectName;
                break;
              }
            }
          }

          if (!projects.has(project)) {
            projects.set(project, {
              project_name: project,
              todos: [],
              active_count: 0,
              completed_count: 0,
            });
          }

          const proj = projects.get(project);
          proj.todos.push(todo);
          if (todo.status === "in_progress") proj.active_count++;
          if (todo.status === "completed") proj.completed_count++;
        }

        // Update state
        const projectsObj = {};
        projects.forEach((value, key) => {
          projectsObj[key] = value;
        });

        this.setState({
          projects: projectsObj,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                projectCount: projects.size,
                projects: Array.from(projects.values()),
              }),
            },
          ],
        };
      },
    );
  }

  /**
   * Conflict Detection and Resolution Tools
   */
  registerConflictTools() {
    // Get conflicts
    this.server.tool(
      "get_conflicts",
      {
        resolved: z.boolean().default(false),
      },
      async ({ resolved }) => {
        const conflicts = resolved
          ? this.state.conflicts.filter((c) => c.resolved)
          : this.state.conflicts.filter((c) => !c.resolved);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                count: conflicts.length,
                conflicts,
              }),
            },
          ],
        };
      },
    );

    // Resolve conflict manually
    this.server.tool(
      "resolve_conflict",
      {
        conflictId: z.string(),
        resolution: z.enum(["keep_existing", "use_new", "merge"]),
        mergedTodo: z.object({}).passthrough().optional(),
      },
      async ({ conflictId, resolution, mergedTodo }) => {
        const conflict = this.state.conflicts.find((c) => c.id === conflictId);
        if (!conflict) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Conflict not found" }),
              },
            ],
          };
        }

        let resolvedTodo;
        if (resolution === "keep_existing") {
          resolvedTodo = conflict.existing;
        } else if (resolution === "use_new") {
          resolvedTodo = conflict.new;
        } else {
          resolvedTodo =
            mergedTodo || this.resolveConflict(conflict.existing, conflict.new);
        }

        // Update todo
        this.state.todos[conflict.content] = resolvedTodo;

        // Mark conflict as resolved
        conflict.resolved = true;
        conflict.resolution = resolution;
        conflict.resolvedAt = new Date().toISOString();

        this.setState({
          todos: this.state.todos,
          conflicts: this.state.conflicts,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                conflictId,
                resolution,
                resolvedTodo,
              }),
            },
          ],
        };
      },
    );
  }

  /**
   * Remote Sync Tools (to sync.chitty.cc)
   */
  registerRemoteSyncTools() {
    // Sync to remote KV storage
    this.server.tool(
      "sync_to_remote",
      {
        endpoint: z.string().default("https://sync.chitty.cc"),
        token: z.string().optional(),
      },
      async ({ endpoint, token }) => {
        const payload = {
          version: "2.0.0",
          timestamp: new Date().toISOString(),
          todos: Object.values(this.state.todos),
          projects: this.state.projects,
          sessions: this.state.sessions,
          metrics: this.state.metrics,
        };

        try {
          // Store in KV namespace
          await this.env.SYNC_KV.put(
            "chittysync:consolidated",
            JSON.stringify(payload),
            {
              expirationTtl: 86400 * 30, // 30 days
              metadata: {
                todoCount: Object.keys(this.state.todos).length,
                projectCount: Object.keys(this.state.projects).length,
                lastSync: new Date().toISOString(),
              },
            },
          );

          // Also sync to endpoint via HTTP
          if (token) {
            const response = await fetch(`${endpoint}/api/v1/todos/sync`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              console.warn("HTTP sync failed:", response.statusText);
            }
          }

          this.setState({
            lastSync: new Date().toISOString(),
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  synced: true,
                  todoCount: Object.keys(this.state.todos).length,
                  timestamp: this.state.lastSync,
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error.message,
                  synced: false,
                }),
              },
            ],
          };
        }
      },
    );

    // Fetch from remote
    this.server.tool("fetch_from_remote", {}, async () => {
      try {
        const data = await this.env.SYNC_KV.get(
          "chittysync:consolidated",
          "json",
        );

        if (data) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(data),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "No remote data found" }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: error.message }),
            },
          ],
        };
      }
    });
  }

  /**
   * Analytics Tools
   */
  registerAnalyticsTools() {
    this.server.tool("get_metrics", {}, async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ...this.state.metrics,
              todoCount: Object.keys(this.state.todos).length,
              projectCount: Object.keys(this.state.projects).length,
              sessionCount: Object.keys(this.state.sessions).length,
              conflictCount: this.state.conflicts.filter((c) => !c.resolved)
                .length,
              lastSync: this.state.lastSync,
            }),
          },
        ],
      };
    });

    this.server.tool("reset_metrics", {}, async () => {
      this.setState({
        metrics: this.initialState.metrics,
      });

      return {
        content: [
          {
            type: "text",
            text: "Metrics reset successfully",
          },
        ],
      };
    });
  }

  /**
   * Helper Methods
   */
  detectConflict(existing, newTodo, source) {
    // Same content, different status = conflict
    if (existing.status !== newTodo.status) {
      return {
        id: `conflict-${Date.now()}`,
        content: existing.content,
        existing,
        new: newTodo,
        source,
        type: "status_mismatch",
        detected: new Date().toISOString(),
        resolved: false,
      };
    }

    return null;
  }

  resolveConflict(existing, newTodo) {
    // Git-like resolution: status priority
    // completed > in_progress > pending
    const statusPriority = {
      completed: 3,
      in_progress: 2,
      pending: 1,
    };

    const existingPriority = statusPriority[existing.status] || 0;
    const newPriority = statusPriority[newTodo.status] || 0;

    if (newPriority > existingPriority) {
      return newTodo;
    }

    if (newPriority === existingPriority) {
      // Same priority: use most recent (if timestamps available)
      return newTodo; // Default to new
    }

    return existing;
  }

  async onStateUpdate(newState, oldState) {
    const todoCountChange =
      Object.keys(newState.todos).length - Object.keys(oldState.todos).length;
    const newConflicts = newState.conflicts.length - oldState.conflicts.length;

    console.log("ChittySync state updated:", {
      todos: Object.keys(newState.todos).length,
      todoChange: todoCountChange > 0 ? `+${todoCountChange}` : todoCountChange,
      projects: Object.keys(newState.projects).length,
      activeConflicts: newState.conflicts.filter((c) => !c.resolved).length,
      newConflicts,
      metrics: newState.metrics,
    });

    // Auto-sync to remote on state changes
    if (this.env.SYNC_KV && (todoCountChange !== 0 || newConflicts > 0)) {
      await this.server.tool("sync_to_remote", {
        endpoint: "https://sync.chitty.cc",
      });
    }
  }
}

// Export for deployment
export default {
  agent: ChittySyncBackgroundAgent,
};
