import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, insertTaskSchema, insertAgentSchema, insertActivitySchema } from "@shared/schema";
import { mcpServer } from "./services/mcp-server";
import { chittyidClient } from "./services/chittyid-client";
import { registryClient } from "./services/registry-client";
import { backgroundJobs } from "./services/background-jobs";
import { getChittyBeacon } from "./services/chitty-beacon";
import { z } from "zod";

interface WebSocketClient extends WebSocket {
  agentId?: string;
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active WebSocket connections
  const connections = new Set<WebSocketClient>();

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocketClient, request) => {
    connections.add(ws);
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle agent registration
        if (message.type === 'agent_register') {
          const agent = await storage.createAgent({
            name: message.name,
            type: message.agentType,
            status: 'active',
            capabilities: message.capabilities || [],
            sessionId: message.sessionId,
          });
          ws.agentId = agent.id;
          
          // Broadcast agent connection
          broadcastToClients({
            type: 'agent_connected',
            agent: agent,
          });
        }
        
        // Handle MCP requests
        if (message.type === 'mcp_request') {
          const response = await mcpServer.handleRequest(message.payload);
          ws.send(JSON.stringify({
            type: 'mcp_response',
            requestId: message.requestId,
            payload: response,
          }));
        }
        
        // Update agent last seen
        if (ws.agentId) {
          await storage.updateAgentLastSeen(ws.agentId);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });

    ws.on('close', async () => {
      connections.delete(ws);
      if (ws.agentId) {
        await storage.updateAgent(ws.agentId, { status: 'inactive' });
        broadcastToClients({
          type: 'agent_disconnected',
          agentId: ws.agentId,
        });
      }
    });
  });

  // Broadcast helper function
  function broadcastToClients(message: any) {
    const messageStr = JSON.stringify(message);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  // REST API Routes

  // Projects
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await storage.getProjects(req.query.userId as string);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch projects', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      const stats = await storage.getProjectStats(project.id);
      res.json({ ...project, stats });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      
      // Log activity
      await storage.createActivity({
        type: 'project_created',
        description: `Project "${project.name}" was created`,
        projectId: project.id,
        userId: project.ownerId,
      });
      
      broadcastToClients({
        type: 'project_created',
        project,
      });
      
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid project data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create project', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const updates = req.body;
      const project = await storage.updateProject(req.params.id, updates);
      
      broadcastToClients({
        type: 'project_updated',
        project,
      });
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update project', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Tasks
  app.get('/api/projects/:projectId/tasks', async (req, res) => {
    try {
      const tasks = await storage.getTasks(req.params.projectId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch tasks', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/projects/:projectId/tasks', async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse({
        ...req.body,
        projectId: req.params.projectId,
      });
      
      // AI-enhanced task creation
      const enhancedTask = await mcpServer.enhanceTask(taskData);
      const task = await storage.createTask(enhancedTask);
      
      // Log activity
      await storage.createActivity({
        type: 'task_created',
        description: `Task "${task.title}" was created`,
        projectId: task.projectId,
        taskId: task.id,
        userId: req.body.createdBy,
      });
      
      broadcastToClients({
        type: 'task_created',
        task,
      });
      
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid task data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create task', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const updates = req.body;
      const task = await storage.updateTask(req.params.id, updates);
      
      // Log activity
      const activityType = updates.status === 'completed' ? 'task_completed' : 'task_updated';
      await storage.createActivity({
        type: activityType,
        description: `Task "${task.title}" was ${updates.status === 'completed' ? 'completed' : 'updated'}`,
        projectId: task.projectId,
        taskId: task.id,
        agentId: updates.updatedBy,
      });
      
      broadcastToClients({
        type: 'task_updated',
        task,
      });
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update task', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Agents
  app.get('/api/agents', async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agents', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/agents/active', async (req, res) => {
    try {
      const agents = await storage.getActiveAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch active agents', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Activities
  app.get('/api/activities', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const projectId = req.query.projectId as string;
      
      const activities = projectId 
        ? await storage.getActivities(projectId)
        : await storage.getRecentActivities(limit);
      
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch activities', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // MCP Protocol endpoints
  app.post('/api/mcp/projects', async (req, res) => {
    try {
      const { agentId, projectData } = req.body;
      const project = await mcpServer.createProject(agentId, projectData);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ message: 'MCP project creation failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/mcp/tasks', async (req, res) => {
    try {
      const { agentId, taskData } = req.body;
      const task = await mcpServer.createTask(agentId, taskData);
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ message: 'MCP task creation failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/mcp/discovery', async (req, res) => {
    try {
      const tools = await registryClient.discoverTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({ message: 'Tool discovery failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ChittyID integration
  app.post('/api/chittyid/sync', async (req, res) => {
    try {
      const result = await chittyidClient.syncProjects();
      res.json({ message: 'ChittyID sync completed', ...result });
    } catch (error) {
      res.status(500).json({ message: 'ChittyID sync failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/integrations', async (req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch integrations', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const activeAgents = await storage.getActiveAgents();
      const recentActivities = await storage.getRecentActivities(5);
      
      res.json({
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        activeAgents: activeAgents.length,
        recentActivities,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get ChittyBeacon status
  app.get('/api/beacon/status', (req, res) => {
    try {
      const beacon = getChittyBeacon();
      if (beacon) {
        res.json({
          success: true,
          status: beacon.getStatus(),
          message: 'ChittyBeacon is active and tracking application metrics'
        });
      } else {
        res.json({
          success: false,
          message: 'ChittyBeacon is not initialized or disabled',
          status: { disabled: true }
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to get beacon status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start background jobs
  backgroundJobs.start(broadcastToClients);

  return httpServer;
}
