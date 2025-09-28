import { pgTable, text, serial, integer, boolean, json, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Create tunnel schema for IP tunneling
export const tunnels = pgTable("tunnels", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // Add relation to users
  name: text("name").notNull(),
  staticIp: text("static_ip").notNull(),
  status: text("status").notNull().default("inactive"), // active, inactive
  serviceProvider: text("service_provider").notNull(),
  targetApi: text("target_api").notNull(),
  region: text("region").notNull(),
  connectionTimeout: integer("connection_timeout").notNull().default(30),
  maxConnections: integer("max_connections").notNull().default(10),
  autoRestart: boolean("auto_restart").notNull().default(true),
  enableLogging: boolean("enable_logging").notNull().default(false),
  enableMonitoring: boolean("enable_monitoring").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTunnelSchema = createInsertSchema(tunnels)
  .omit({ id: true, staticIp: true, createdAt: true, updatedAt: true });

// Define schema for usage statistics
export const usageStats = pgTable("usage_stats", {
  id: serial("id").primaryKey(),
  tunnelId: integer("tunnel_id").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  incomingTraffic: integer("incoming_traffic").notNull().default(0), // in bytes
  outgoingTraffic: integer("outgoing_traffic").notNull().default(0), // in bytes
  responseTime: integer("response_time").notNull().default(0), // in ms
  errors: integer("errors").notNull().default(0),
  connections: integer("connections").notNull().default(0),
});

export const insertUsageStatsSchema = createInsertSchema(usageStats)
  .omit({ id: true });

// Define type exports
export type Tunnel = typeof tunnels.$inferSelect;
export type InsertTunnel = z.infer<typeof insertTunnelSchema>;

export type UsageStats = typeof usageStats.$inferSelect;
export type InsertUsageStats = z.infer<typeof insertUsageStatsSchema>;

// Define regions for IP tunnels
export const regions = [
  { id: "us-east", name: "US East (N. Virginia)" },
  { id: "us-west", name: "US West (Oregon)" },
  { id: "eu-central", name: "EU Central (Frankfurt)" },
  { id: "ap-southeast", name: "Asia Pacific (Singapore)" },
];

// Define service providers
export const serviceProviders = [
  { id: "cloudflare", name: "Cloudflare" },
  { id: "google-cloud", name: "Google Cloud" },
  { id: "github", name: "GitHub" },
  { id: "custom", name: "Custom" },
];
