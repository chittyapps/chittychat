import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTunnelSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up Replit authentication
  await setupAuth(app);
  
  // Auth user info endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  // API routes for tunnels - protected by authentication
  app.get("/api/tunnels", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tunnels = await storage.getTunnels();
      res.json({ tunnels });
    } catch (error) {
      res.status(500).json({ message: "Error fetching tunnels" });
    }
  });
  
  app.get("/api/tunnels/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tunnelId = parseInt(req.params.id);
      if (isNaN(tunnelId)) {
        return res.status(400).json({ message: "Invalid tunnel ID" });
      }
      
      const tunnel = await storage.getTunnel(tunnelId);
      
      if (!tunnel) {
        return res.status(404).json({ message: "Tunnel not found" });
      }
      
      res.json({ tunnel });
    } catch (error) {
      res.status(500).json({ message: "Error fetching tunnel" });
    }
  });
  
  app.post("/api/tunnels", isAuthenticated, async (req: any, res: Response) => {
    try {
      const validatedData = insertTunnelSchema.parse(req.body);
      // Add user ID from auth to link tunnel to user
      const userId = req.user.claims.sub;
      const tunnelData = {
        ...validatedData,
        userId
      };
      const tunnel = await storage.createTunnel(tunnelData);
      res.status(201).json({ tunnel });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tunnel data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating tunnel" });
    }
  });
  
  app.patch("/api/tunnels/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tunnelId = parseInt(req.params.id);
      if (isNaN(tunnelId)) {
        return res.status(400).json({ message: "Invalid tunnel ID" });
      }
      
      const updatedTunnel = await storage.updateTunnel(tunnelId, req.body);
      
      if (!updatedTunnel) {
        return res.status(404).json({ message: "Tunnel not found" });
      }
      
      res.json({ tunnel: updatedTunnel });
    } catch (error) {
      res.status(500).json({ message: "Error updating tunnel" });
    }
  });
  
  app.delete("/api/tunnels/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tunnelId = parseInt(req.params.id);
      if (isNaN(tunnelId)) {
        return res.status(400).json({ message: "Invalid tunnel ID" });
      }
      
      const success = await storage.deleteTunnel(tunnelId);
      
      if (!success) {
        return res.status(404).json({ message: "Tunnel not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Error deleting tunnel" });
    }
  });
  
  // Stats endpoints
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const activeTunnels = await storage.getActiveTunnelsCount();
      const bandwidthUsage = await storage.getTotalBandwidthUsage();
      const uptimeStats = await storage.getUptimeStats();
      
      // Convert bandwidth to GB for frontend
      const incomingGB = bandwidthUsage.incoming / 1000000000; // Bytes to GB
      const outgoingGB = bandwidthUsage.outgoing / 1000000000; // Bytes to GB
      
      res.json({
        activeTunnels,
        bandwidth: {
          incoming: incomingGB.toFixed(1),
          outgoing: outgoingGB.toFixed(1),
          total: (incomingGB + outgoingGB).toFixed(1),
          totalBytes: bandwidthUsage.incoming + bandwidthUsage.outgoing
        },
        uptime: uptimeStats.uptime,
        downtime: uptimeStats.downtime
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching stats" });
    }
  });
  
  app.get("/api/stats/tunnel/:id", async (req: Request, res: Response) => {
    try {
      const tunnelId = parseInt(req.params.id);
      if (isNaN(tunnelId)) {
        return res.status(400).json({ message: "Invalid tunnel ID" });
      }
      
      const stats = await storage.getUsageStatsByTunnel(tunnelId);
      
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ message: "Error fetching tunnel stats" });
    }
  });
  
  const httpServer = createServer(app);
  
  return httpServer;
}
