import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, json, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  status: text("status").notNull().default("active"), // active, completed, archived
  isGlobal: boolean("is_global").notNull().default(true),
  ownerId: varchar("owner_id").references(() => users.id),
  progress: integer("progress").notNull().default(0), // 0-100
  category: text("category"),
  tags: json("tags").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, blocked
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  tasks: many(tasks),
  activities: many(activities),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  tasks: many(tasks),
  activities: many(activities),
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

// Types
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
