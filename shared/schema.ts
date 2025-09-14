import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, json, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Workspaces for multi-tenant isolation
export const workspaces = pgTable("workspaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("shared"), // shared, isolated, private
  ownerId: varchar("owner_id"),
  settings: json("settings").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  chittyId: text("chitty_id"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, archived, paused
  isGlobal: boolean("is_global").notNull().default(true),
  ownerId: varchar("owner_id").references(() => users.id),
  // workspaceId: varchar("workspace_id").references(() => workspaces.id),
  progress: integer("progress").notNull().default(0), // 0-100
  category: text("category"),
  tags: json("tags").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  // lifecycleStage: text("lifecycle_stage").default("planning"), // planning, development, testing, review, maintenance
  // archivalScheduledAt: timestamp("archival_scheduled_at"),
  // archivedAt: timestamp("archived_at"),
  // lastActivityAt: timestamp("last_activity_at").defaultNow(),
  // collaborationScore: integer("collaboration_score").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, blocked
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent, critical
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  assigneeId: varchar("assignee_id").references(() => users.id),
  assignedAgent: text("assigned_agent"), // AI agent name
  category: text("category"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  tags: json("tags").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  // priorityScore: integer("priority_score").default(0), // AI-calculated priority score
  dependencies: json("dependencies").$type<string[]>().default([]), // Task IDs this depends on
  blockingTasks: json("blocking_tasks").$type<string[]>().default([]), // Task IDs blocked by this
  autoScheduled: boolean("auto_scheduled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // claude, gpt4, custom, etc.
  status: text("status").notNull().default("inactive"), // active, inactive, error
  capabilities: json("capabilities").$type<string[]>().default([]),
  lastSeen: timestamp("last_seen"),
  sessionId: text("session_id"),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // task_created, task_updated, task_completed, project_created, etc.
  description: text("description").notNull(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id),
  userId: varchar("user_id").references(() => users.id),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // chittyid, registry, mcp, etc.
  status: text("status").notNull().default("inactive"), // active, inactive, error
  config: json("config").$type<Record<string, any>>().default({}),
  lastSync: timestamp("last_sync"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mcpTools = pgTable("mcp_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version"),
  category: text("category"),
  capabilities: json("capabilities").$type<string[]>().default([]),
  registryUrl: text("registry_url"),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smartRecommendations = pgTable("smart_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type", { enum: ["agent", "project", "user", "tool"] }).notNull(),
  targetId: text("target_id").notNull(),
  recommendations: json("recommendations").$type<{
    itemId: string;
    itemType: string;
    title: string;
    description: string;
    score: number;
    reason: string;
    metadata: Record<string, any>;
  }[]>().notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ethRegistryEntries = pgTable("eth_registry_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  address: text("address").notNull().unique(),
  ensName: text("ens_name"),
  agentType: text("agent_type").notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  reputation: integer("reputation").default(0),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  description: text("description"),
  tags: json("tags").$type<string[]>().notNull(),
  verified: boolean("verified").default(false),
  mcpTools: json("mcp_tools").$type<string[]>(),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Collaboration Heatmap Data
export const collaborationHeatmap = pgTable("collaboration_heatmap", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id),
  userId: varchar("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(), // edit, comment, review, etc.
  intensity: integer("intensity").notNull().default(1), // Activity intensity score
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  location: json("location").$type<{ file?: string; line?: number; component?: string }>(),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
});

// Conflict Resolution System
export const conflicts = pgTable("conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // merge_conflict, resource_conflict, schedule_conflict, etc.
  status: text("status").notNull().default("pending"), // pending, resolved, escalated
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }),
  taskId: varchar("task_id").references(() => tasks.id),
  affectedAgents: json("affected_agents").$type<string[]>().notNull(),
  conflictData: json("conflict_data").$type<Record<string, any>>().notNull(),
  resolutionStrategy: text("resolution_strategy"), // automatic, manual, ai_suggested
  resolution: json("resolution").$type<Record<string, any>>(),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// AI Optimization Assistant
export const aiOptimizations = pgTable("ai_optimizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetType: text("target_type").notNull(), // project, task, workflow, resource
  targetId: text("target_id").notNull(),
  optimizationType: text("optimization_type").notNull(), // schedule, resource, workflow, priority
  currentState: json("current_state").$type<Record<string, any>>().notNull(),
  suggestedState: json("suggested_state").$type<Record<string, any>>().notNull(),
  expectedImprovement: json("expected_improvement").$type<{
    metric: string;
    currentValue: number;
    expectedValue: number;
    improvementPercentage: number;
  }[]>().notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  status: text("status").notNull().default("pending"), // pending, applied, rejected, partial
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
});

// Adaptive UI Patterns
export const uiPatterns = pgTable("ui_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  agentId: varchar("agent_id").references(() => agents.id),
  patternType: text("pattern_type").notNull(), // navigation, workflow, preference
  pattern: json("pattern").$type<{
    action: string;
    frequency: number;
    context: Record<string, any>;
    timestamp: string;
  }[]>().notNull(),
  confidence: integer("confidence").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project Lifecycle Management
export const projectLifecycle = pgTable("project_lifecycle", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  stage: text("stage").notNull(), // planning, development, testing, review, maintenance, archived
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  exitedAt: timestamp("exited_at"),
  triggers: json("triggers").$type<string[]>().default([]), // What triggered the stage change
  metrics: json("metrics").$type<Record<string, any>>().default({}),
  automatedActions: json("automated_actions").$type<string[]>().default([]),
});

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  tasks: many(tasks),
  activities: many(activities),
  uiPatterns: many(uiPatterns),
  collaborationHeatmap: many(collaborationHeatmap),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  // workspace: one(workspaces, {
  //   fields: [projects.workspaceId],
  //   references: [workspaces.id],
  // }),
  tasks: many(tasks),
  activities: many(activities),
  collaborationHeatmap: many(collaborationHeatmap),
  conflicts: many(conflicts),
  projectLifecycle: many(projectLifecycle),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  activities: many(activities),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [activities.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  chittyId: true,
  role: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSync: true,
});

export const insertMcpToolSchema = createInsertSchema(mcpTools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmartRecommendationSchema = createInsertSchema(smartRecommendations).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
});

export const insertEthRegistryEntrySchema = createInsertSchema(ethRegistryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollaborationHeatmapSchema = createInsertSchema(collaborationHeatmap).omit({
  id: true,
  timestamp: true,
});

export const insertConflictSchema = createInsertSchema(conflicts).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertAiOptimizationSchema = createInsertSchema(aiOptimizations).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
});

export const insertUiPatternSchema = createInsertSchema(uiPatterns).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertProjectLifecycleSchema = createInsertSchema(projectLifecycle).omit({
  id: true,
  enteredAt: true,
  exitedAt: true,
});

// Premium Dashboard Entities
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  definition: json("definition").$type<Record<string, any>>().notNull(), // DAG structure
  status: text("status").notNull().default("draft"), // draft, active, paused, archived
  version: integer("version").notNull().default(1),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => workflows.id).notNull(),
  status: text("status").notNull().default("running"), // running, completed, failed, cancelled
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // seconds
  logs: json("logs").$type<Record<string, any>>().default({}),
  metrics: json("metrics").$type<Record<string, any>>().default({}),
  errorMessage: text("error_message"),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, investigating, resolved, closed
  assignedTo: varchar("assigned_to").references(() => users.id),
  source: text("source"), // alert, manual, automated
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  resolvedAt: timestamp("resolved_at"),
  slaTarget: timestamp("sla_target"),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  value: integer("value").notNull(),
  unit: text("unit"), // requests/min, ms, percent, count
  tags: json("tags").$type<Record<string, any>>().default({}), // {"agent": "gpt4", "project": "123"}
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // workflow.started, agent.connected, mcp.tool.called
  source: text("source").notNull(), // agent, workflow, integration
  sourceId: text("source_id").notNull(),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  traceId: text("trace_id"), // for distributed tracing
  severity: text("severity").notNull().default("info"), // debug, info, warn, error
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Insert schemas for new entities
export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({
  id: true,
  startedAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  timestamp: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  timestamp: true,
});

// Types
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type McpTool = typeof mcpTools.$inferSelect;
export type InsertMcpTool = z.infer<typeof insertMcpToolSchema>;
export type SmartRecommendation = typeof smartRecommendations.$inferSelect;
export type InsertSmartRecommendation = z.infer<typeof insertSmartRecommendationSchema>;
export type EthRegistryEntry = typeof ethRegistryEntries.$inferSelect;
export type InsertEthRegistryEntry = z.infer<typeof insertEthRegistryEntrySchema>;
export type CollaborationHeatmap = typeof collaborationHeatmap.$inferSelect;
export type InsertCollaborationHeatmap = z.infer<typeof insertCollaborationHeatmapSchema>;
export type Conflict = typeof conflicts.$inferSelect;
export type InsertConflict = z.infer<typeof insertConflictSchema>;
export type AiOptimization = typeof aiOptimizations.$inferSelect;
export type InsertAiOptimization = z.infer<typeof insertAiOptimizationSchema>;
export type UiPattern = typeof uiPatterns.$inferSelect;
export type InsertUiPattern = z.infer<typeof insertUiPatternSchema>;
export type ProjectLifecycle = typeof projectLifecycle.$inferSelect;
export type InsertProjectLifecycle = z.infer<typeof insertProjectLifecycleSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// Workflow node definitions for Orchestration Canvas
export interface WorkflowNode {
  id: string;
  type: 'agent' | 'tool' | 'decision' | 'integration' | 'start' | 'end' | 'webhook' | 'delay';
  position: { x: number; y: number };
  data: WorkflowNodeData;
  style?: Record<string, any>;
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config?: Record<string, any>;
  // Agent node specific
  agentType?: string;
  capabilities?: string[];
  // Tool node specific
  toolName?: string;
  toolParams?: Record<string, any>;
  // Decision node specific
  condition?: string;
  branches?: { true: string; false: string };
  // Integration node specific
  integrationName?: string;
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: Record<string, any>;
  // Execution state
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  executionTime?: number;
  output?: any;
  error?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional' | 'success' | 'error';
  label?: string;
  style?: Record<string, any>;
  animated?: boolean;
  data?: {
    condition?: string;
    label?: string;
  };
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  variables?: Record<string, any>;
  settings?: {
    autoSave?: boolean;
    parallelExecution?: boolean;
    retryPolicy?: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
    };
  };
}

export interface WorkflowExecutionState {
  currentNodeId?: string;
  completedNodes: string[];
  failedNodes: string[];
  nodeOutputs: Record<string, any>;
  variables: Record<string, any>;
  executionLog: WorkflowLogEntry[];
  startTime?: Date;
  endTime?: Date;
  totalDuration?: number;
}

export interface WorkflowLogEntry {
  id: string;
  timestamp: Date;
  nodeId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  definition: WorkflowDefinition;
  thumbnail?: string;
  featured?: boolean;
}
