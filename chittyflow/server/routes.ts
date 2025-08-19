import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertTaskSchema, 
  insertEnergyLogSchema, 
  insertCelebrationSchema,
  insertAutoActivitySchema,
  insertConnectedServiceSchema,
  insertAgentActionSchema 
} from "@shared/schema";
import { ServiceConnector } from "./agent/serviceConnector";
import { startAgentForUser } from "./agent/aiAgent";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
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

  // Task routes
  app.get('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tasks = await storage.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post('/api/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskData = insertTaskSchema.parse({ ...req.body, userId });
      const task = await storage.createTask(taskData);
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  app.patch('/api/tasks/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const task = await storage.completeTask(id);
      res.json(task);
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ message: "Failed to complete task" });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTask(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Energy tracking routes
  app.get('/api/energy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const energyLogs = await storage.getEnergyLogs(userId);
      const currentLevel = await storage.getCurrentEnergyLevel(userId);
      res.json({ logs: energyLogs, currentLevel });
    } catch (error) {
      console.error("Error fetching energy data:", error);
      res.status(500).json({ message: "Failed to fetch energy data" });
    }
  });

  app.post('/api/energy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const energyData = insertEnergyLogSchema.parse({ ...req.body, userId });
      const energyLog = await storage.createEnergyLog(energyData);
      res.json(energyLog);
    } catch (error) {
      console.error("Error logging energy:", error);
      res.status(400).json({ message: "Failed to log energy" });
    }
  });

  // Celebration routes
  app.get('/api/celebrations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const celebrations = await storage.getCelebrations(userId);
      res.json(celebrations);
    } catch (error) {
      console.error("Error fetching celebrations:", error);
      res.status(500).json({ message: "Failed to fetch celebrations" });
    }
  });

  app.post('/api/celebrations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const celebrationData = insertCelebrationSchema.parse({ ...req.body, userId });
      const celebration = await storage.createCelebration(celebrationData);
      res.json(celebration);
    } catch (error) {
      console.error("Error creating celebration:", error);
      res.status(400).json({ message: "Failed to create celebration" });
    }
  });

  // Auto-activity routes
  app.get('/api/auto-activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await storage.getAutoActivities(userId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching auto activities:", error);
      res.status(500).json({ message: "Failed to fetch auto activities" });
    }
  });

  app.post('/api/auto-activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activityData = insertAutoActivitySchema.parse({ ...req.body, userId });
      const activity = await storage.createAutoActivity(activityData);
      res.json(activity);
    } catch (error) {
      console.error("Error creating auto activity:", error);
      res.status(400).json({ message: "Failed to create auto activity" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/wins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wins = await storage.getTodaysWins(userId);
      const streak = await storage.getTaskCompletionStreak(userId);
      res.json({ ...wins, streak });
    } catch (error) {
      console.error("Error fetching wins:", error);
      res.status(500).json({ message: "Failed to fetch wins data" });
    }
  });

  // Connected services routes
  app.get('/api/services/available', isAuthenticated, async (req: any, res) => {
    try {
      const services = ServiceConnector.getAvailableServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching available services:", error);
      res.status(500).json({ message: "Failed to fetch available services" });
    }
  });

  app.get('/api/services/connected', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const services = await storage.getConnectedServices(userId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching connected services:", error);
      res.status(500).json({ message: "Failed to fetch connected services" });
    }
  });

  app.post('/api/services/connect/:serviceType', isAuthenticated, async (req: any, res) => {
    try {
      const { serviceType } = req.params;
      const userId = req.user.claims.sub;
      
      const authUrl = ServiceConnector.generateAuthUrl(serviceType, userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(400).json({ message: "Failed to generate authorization URL" });
    }
  });

  app.get('/api/services/oauth/callback', async (req: any, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ message: "Missing authorization code or state" });
      }

      const result = await ServiceConnector.handleOAuthCallback(code, state);
      
      if (result.success) {
        res.redirect('/?connected=true');
      } else {
        res.redirect('/?error=' + encodeURIComponent(result.message));
      }
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect('/?error=auth_failed');
    }
  });

  app.delete('/api/services/:serviceId', isAuthenticated, async (req: any, res) => {
    try {
      const { serviceId } = req.params;
      const userId = req.user.claims.sub;
      
      await ServiceConnector.disconnectService(userId, serviceId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting service:", error);
      res.status(500).json({ message: "Failed to disconnect service" });
    }
  });

  // AI Agent routes
  app.get('/api/agent/actions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actions = await storage.getAgentActions(userId, 20);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching agent actions:", error);
      res.status(500).json({ message: "Failed to fetch agent actions" });
    }
  });

  app.post('/api/agent/actions/:actionId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const { actionId } = req.params;
      const action = await storage.approveAgentAction(actionId);
      res.json(action);
    } catch (error) {
      console.error("Error approving action:", error);
      res.status(500).json({ message: "Failed to approve action" });
    }
  });

  app.post('/api/agent/actions/:actionId/reject', isAuthenticated, async (req: any, res) => {
    try {
      const { actionId } = req.params;
      const action = await storage.rejectAgentAction(actionId);
      res.json(action);
    } catch (error) {
      console.error("Error rejecting action:", error);
      res.status(500).json({ message: "Failed to reject action" });
    }
  });

  app.post('/api/agent/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await startAgentForUser(userId);
      res.json({ message: "AI agent started successfully" });
    } catch (error) {
      console.error("Error starting agent:", error);
      res.status(500).json({ message: "Failed to start AI agent" });
    }
  });

  // Transition rituals endpoints
  app.get('/api/transitions/rituals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ritualType = req.query.type as string;
      const rituals = await storage.getTransitionRituals(userId, ritualType);
      res.json(rituals);
    } catch (error) {
      console.error("Error fetching transition rituals:", error);
      res.status(500).json({ message: "Failed to fetch transition rituals" });
    }
  });

  app.post('/api/transitions/rituals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ritualData = { ...req.body, userId };
      const ritual = await storage.createTransitionRitual(ritualData);
      res.json(ritual);
    } catch (error) {
      console.error("Error creating transition ritual:", error);
      res.status(500).json({ message: "Failed to create transition ritual" });
    }
  });

  app.put('/api/transitions/rituals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const ritual = await storage.updateTransitionRitual(id, req.body);
      res.json(ritual);
    } catch (error) {
      console.error("Error updating transition ritual:", error);
      res.status(500).json({ message: "Failed to update transition ritual" });
    }
  });

  app.delete('/api/transitions/rituals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTransitionRitual(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transition ritual:", error);
      res.status(500).json({ message: "Failed to delete transition ritual" });
    }
  });

  // Transition sessions endpoints
  app.post('/api/transitions/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = { ...req.body, userId };
      const session = await storage.createTransitionSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating transition session:", error);
      res.status(500).json({ message: "Failed to create transition session" });
    }
  });

  app.put('/api/transitions/sessions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const session = await storage.updateTransitionSession(id, req.body);
      res.json(session);
    } catch (error) {
      console.error("Error updating transition session:", error);
      res.status(500).json({ message: "Failed to update transition session" });
    }
  });

  app.get('/api/transitions/sessions/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getActiveTransitionSession(userId);
      res.json(session);
    } catch (error) {
      console.error("Error fetching active transition session:", error);
      res.status(500).json({ message: "Failed to fetch active transition session" });
    }
  });

  // Executive Function Support endpoints
  app.get('/api/focus/current-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getCurrentFocusSession(userId);
      res.json(session);
    } catch (error) {
      console.error("Error fetching current focus session:", error);
      res.status(500).json({ message: "Failed to fetch current focus session" });
    }
  });

  app.post('/api/focus/start-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = { ...req.body, userId };
      const session = await storage.createFocusSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error starting focus session:", error);
      res.status(500).json({ message: "Failed to start focus session" });
    }
  });

  app.post('/api/focus/end-session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.endFocusSession(userId, req.body);
      res.json(session);
    } catch (error) {
      console.error("Error ending focus session:", error);
      res.status(500).json({ message: "Failed to end focus session" });
    }
  });

  app.get('/api/time-estimates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const estimates = await storage.getTimeEstimates(userId);
      res.json(estimates);
    } catch (error) {
      console.error("Error fetching time estimates:", error);
      res.status(500).json({ message: "Failed to fetch time estimates" });
    }
  });

  app.get('/api/decisions/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const decisions = await storage.getRecentDecisions(userId);
      res.json(decisions);
    } catch (error) {
      console.error("Error fetching recent decisions:", error);
      res.status(500).json({ message: "Failed to fetch recent decisions" });
    }
  });

  app.post('/api/decisions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const decisionData = { ...req.body, userId };
      const decision = await storage.createDecision(decisionData);
      res.json(decision);
    } catch (error) {
      console.error("Error creating decision:", error);
      res.status(500).json({ message: "Failed to create decision" });
    }
  });

  // Smart Automation endpoints
  app.get('/api/smart/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const suggestions = await storage.getSmartSuggestions(userId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching smart suggestions:", error);
      res.status(500).json({ message: "Failed to fetch smart suggestions" });
    }
  });

  app.post('/api/smart/suggestions/:id/acknowledge', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { wasHelpful } = req.body;
      const suggestion = await storage.acknowledgeSuggestion(id, wasHelpful);
      res.json(suggestion);
    } catch (error) {
      console.error("Error acknowledging suggestion:", error);
      res.status(500).json({ message: "Failed to acknowledge suggestion" });
    }
  });

  app.get('/api/smart/patterns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patternType = req.query.type as string;
      const patterns = await storage.getUserPatterns(userId, patternType);
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching user patterns:", error);
      res.status(500).json({ message: "Failed to fetch user patterns" });
    }
  });

  // Analytics endpoint for ChittyBeacon dashboard
  app.get('/api/analytics/beacon', isAuthenticated, async (req: any, res) => {
    try {
      // This would normally come from ChittyBeacon's tracking service
      // For now, return basic analytics data structure
      const analyticsData = {
        totalSessions: 0, // Would be fetched from tracking service
        avgSessionLength: 0,
        featuresUsed: [],
        platformInfo: {
          platform: process.env.REPL_ID ? 'replit' : 'local',
          environment: process.env.NODE_ENV || 'development',
          uptime: Math.floor(process.uptime())
        },
        privacyStatus: {
          trackingEnabled: process.env.BEACON_DISABLED !== 'true',
          dataRetention: '30 days',
          personalDataCollected: false
        }
      };
      
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
