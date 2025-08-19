import { 
  users, 
  type User, 
  type UpsertUser, 
  tunnels, 
  type Tunnel, 
  type InsertTunnel,
  usageStats,
  type UsageStats,
  type InsertUsageStats
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

// Extend the storage interface with our CRUD methods
export interface IStorage {
  // User methods - for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tunnel methods
  getTunnels(): Promise<Tunnel[]>;
  getTunnel(id: number): Promise<Tunnel | undefined>;
  createTunnel(tunnel: InsertTunnel): Promise<Tunnel>;
  updateTunnel(id: number, tunnel: Partial<Tunnel>): Promise<Tunnel | undefined>;
  deleteTunnel(id: number): Promise<boolean>;
  
  // Usage stats methods
  getUsageStatsByTunnel(tunnelId: number): Promise<UsageStats[]>;
  addUsageStats(stats: InsertUsageStats): Promise<UsageStats>;
  
  // Summary methods
  getActiveTunnelsCount(): Promise<number>;
  getTotalBandwidthUsage(): Promise<{ incoming: number, outgoing: number }>;
  getUptimeStats(): Promise<{ uptime: number, downtime: number }>;
}

// Implement in-memory storage for development
export class MemStorage implements IStorage {
  private userMap: Map<string, User>;
  private tunnels: Map<number, Tunnel>;
  private usageStats: Map<number, UsageStats>;
  
  private tunnelCurrentId: number;
  private usageStatsCurrentId: number;
  
  constructor() {
    this.userMap = new Map();
    this.tunnels = new Map();
    this.usageStats = new Map();
    
    this.tunnelCurrentId = 1;
    this.usageStatsCurrentId = 1;
    
    // Create some default tunnels for demo (in a real app we wouldn't have mock data)
    this.seedData();
  }
  
  // User methods for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.userMap.get(id);
  }
  
  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.userMap.get(userData.id);
    
    const user: User = {
      ...userData,
      updatedAt: new Date(),
      createdAt: existing?.createdAt || new Date(),
    };
    
    this.userMap.set(userData.id, user);
    return user;
  }
  
  // Tunnel methods
  async getTunnels(): Promise<Tunnel[]> {
    return Array.from(this.tunnels.values());
  }
  
  async getTunnel(id: number): Promise<Tunnel | undefined> {
    return this.tunnels.get(id);
  }
  
  async createTunnel(insertTunnel: InsertTunnel): Promise<Tunnel> {
    const id = this.tunnelCurrentId++;
    // Generate a random IP for demo purposes
    const staticIp = this.generateRandomIp();
    const now = new Date();
    
    const tunnel: Tunnel = { 
      ...insertTunnel, 
      id,
      staticIp,
      createdAt: now,
      updatedAt: now
    };
    
    this.tunnels.set(id, tunnel);
    return tunnel;
  }
  
  async updateTunnel(id: number, tunnelUpdate: Partial<Tunnel>): Promise<Tunnel | undefined> {
    const existingTunnel = this.tunnels.get(id);
    
    if (!existingTunnel) {
      return undefined;
    }
    
    const updatedTunnel: Tunnel = {
      ...existingTunnel,
      ...tunnelUpdate,
      updatedAt: new Date()
    };
    
    this.tunnels.set(id, updatedTunnel);
    return updatedTunnel;
  }
  
  async deleteTunnel(id: number): Promise<boolean> {
    return this.tunnels.delete(id);
  }
  
  // Usage stats methods
  async getUsageStatsByTunnel(tunnelId: number): Promise<UsageStats[]> {
    return Array.from(this.usageStats.values()).filter(
      stats => stats.tunnelId === tunnelId
    );
  }
  
  async addUsageStats(insertStats: InsertUsageStats): Promise<UsageStats> {
    const id = this.usageStatsCurrentId++;
    const stats: UsageStats = { ...insertStats, id };
    
    this.usageStats.set(id, stats);
    return stats;
  }
  
  // Summary methods
  async getActiveTunnelsCount(): Promise<number> {
    return Array.from(this.tunnels.values()).filter(
      tunnel => tunnel.status === 'active'
    ).length;
  }
  
  async getTotalBandwidthUsage(): Promise<{ incoming: number, outgoing: number }> {
    // Calculate total bandwidth usage from all tunnels
    const allStats = Array.from(this.usageStats.values());
    
    const incoming = allStats.reduce((total, stat) => total + stat.incomingTraffic, 0);
    const outgoing = allStats.reduce((total, stat) => total + stat.outgoingTraffic, 0);
    
    return { incoming, outgoing };
  }
  
  async getUptimeStats(): Promise<{ uptime: number, downtime: number }> {
    // For demo purposes, return a fixed value
    return { uptime: 99.98, downtime: 2 };
  }
  
  // Helper methods
  private generateRandomIp(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(Math.floor(Math.random() * 256));
    }
    return segments.join('.');
  }
  
  private seedData() {
    // Seed some initial tunnels for demo
    const seedTunnels: InsertTunnel[] = [
      {
        name: "Mercury Bank API",
        status: "active",
        serviceProvider: "cloudflare",
        targetApi: "https://api.mercury.com/v1",
        region: "us-east",
        connectionTimeout: 30,
        maxConnections: 10,
        autoRestart: true,
        enableLogging: false,
        enableMonitoring: true
      },
      {
        name: "Fintech API Backup",
        status: "active",
        serviceProvider: "google-cloud",
        targetApi: "https://api.fintech.example.com/v2",
        region: "us-west",
        connectionTimeout: 60,
        maxConnections: 20,
        autoRestart: true,
        enableLogging: true,
        enableMonitoring: true
      },
      {
        name: "Payment Processing",
        status: "active",
        serviceProvider: "github",
        targetApi: "https://api.payments.example.com",
        region: "eu-central",
        connectionTimeout: 45,
        maxConnections: 15,
        autoRestart: true,
        enableLogging: false,
        enableMonitoring: true
      },
      {
        name: "Dev Environment",
        status: "inactive",
        serviceProvider: "custom",
        targetApi: "https://dev.example.com/api",
        region: "ap-southeast",
        connectionTimeout: 30,
        maxConnections: 5,
        autoRestart: false,
        enableLogging: true,
        enableMonitoring: false
      }
    ];
    
    // Create the seed tunnels
    seedTunnels.forEach(tunnel => {
      this.createTunnel(tunnel);
    });
    
    // Create some usage stats for the tunnels
    for (let i = 1; i <= 4; i++) {
      this.addUsageStats({
        tunnelId: i,
        date: new Date(),
        incomingTraffic: Math.floor(Math.random() * 5000000000), // Random number up to 5GB
        outgoingTraffic: Math.floor(Math.random() * 10000000000), // Random number up to 10GB
        responseTime: Math.floor(Math.random() * 100), // Random response time up to 100ms
        errors: Math.floor(Math.random() * 5), // Random errors up to 5
        connections: Math.floor(Math.random() * 30) // Random connections up to 30
      });
    }
  }
}

// Create a class for database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Tunnel methods
  async getTunnels(): Promise<Tunnel[]> {
    return db.select().from(tunnels);
  }
  
  async getTunnel(id: number): Promise<Tunnel | undefined> {
    const [tunnel] = await db.select().from(tunnels).where(eq(tunnels.id, id));
    return tunnel;
  }
  
  async createTunnel(insertTunnel: InsertTunnel): Promise<Tunnel> {
    // Generate a random IP for demo purposes
    const staticIp = this.generateRandomIp();
    
    const [tunnel] = await db
      .insert(tunnels)
      .values({
        ...insertTunnel,
        staticIp
      })
      .returning();
    
    return tunnel;
  }
  
  async updateTunnel(id: number, tunnelUpdate: Partial<Tunnel>): Promise<Tunnel | undefined> {
    const [updatedTunnel] = await db
      .update(tunnels)
      .set({
        ...tunnelUpdate,
        updatedAt: new Date()
      })
      .where(eq(tunnels.id, id))
      .returning();
    
    return updatedTunnel;
  }
  
  async deleteTunnel(id: number): Promise<boolean> {
    const result = await db
      .delete(tunnels)
      .where(eq(tunnels.id, id));
    
    return true; // In SQLite, this doesn't return anything useful
  }
  
  // Usage stats methods
  async getUsageStatsByTunnel(tunnelId: number): Promise<UsageStats[]> {
    return db
      .select()
      .from(usageStats)
      .where(eq(usageStats.tunnelId, tunnelId));
  }
  
  async addUsageStats(insertStats: InsertUsageStats): Promise<UsageStats> {
    const [stats] = await db
      .insert(usageStats)
      .values(insertStats)
      .returning();
    
    return stats;
  }
  
  // Summary methods
  async getActiveTunnelsCount(): Promise<number> {
    const activeTunnels = await db
      .select()
      .from(tunnels)
      .where(eq(tunnels.status, "active"));
    
    return activeTunnels.length;
  }
  
  async getTotalBandwidthUsage(): Promise<{ incoming: number, outgoing: number }> {
    const allStats = await db.select().from(usageStats);
    
    const incoming = allStats.reduce((total, stat) => total + stat.incomingTraffic, 0);
    const outgoing = allStats.reduce((total, stat) => total + stat.outgoingTraffic, 0);
    
    return { incoming, outgoing };
  }
  
  async getUptimeStats(): Promise<{ uptime: number, downtime: number }> {
    // For demo purposes, return a fixed value
    return { uptime: 99.9, downtime: 0.1 };
  }

  private generateRandomIp(): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(Math.floor(Math.random() * 256));
    }
    return segments.join('.');
  }
}

// Use in-memory storage for now
export const storage = new MemStorage();
