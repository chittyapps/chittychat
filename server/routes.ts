import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, insertTaskSchema, insertAgentSchema, insertActivitySchema } from "@shared/schema";
import { mcpServer } from "./services/mcp-server";
import { mcpNativeTools } from "./services/mcp-native-tools";
import { chittyidClient } from "./services/chittyid-client";
import { registryClient } from "./services/registry-client";
import { registryChittyClient } from "./services/registry-chitty-client";
import { backgroundJobs } from "./services/background-jobs";
import { getChittyBeacon } from "./services/chitty-beacon";
import { smartRecommendationsService } from "./services/smart-recommendations";
import { reputationSystem } from "./services/reputation-system";
import connectorRoutes from "./routes/connector-routes";
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
  
  // Register connector routes
  app.use('/api', connectorRoutes);

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

  // Agent Mesh Visualization endpoint
  app.get('/api/metrics/agent-mesh', async (req, res) => {
    try {
      const meshData = await storage.getAgentMeshData();
      
      // Calculate additional statistics
      const stats = {
        totalAgents: meshData.nodes.filter(n => n.type === 'agent').length,
        activeAgents: meshData.nodes.filter(n => n.type === 'agent' && n.status === 'active').length,
        totalTools: meshData.nodes.filter(n => n.type === 'tool').length,
        activeTools: meshData.nodes.filter(n => n.type === 'tool' && n.status === 'active').length,
        avgResponseTime: Math.floor(Math.random() * 200 + 50), // Mock for now
        networkHealth: Math.min(100, Math.floor((meshData.nodes.filter(n => n.status === 'active').length / meshData.nodes.length) * 100))
      };

      res.json({
        nodes: meshData.nodes,
        edges: meshData.edges,
        lastUpdated: new Date().toISOString(),
        totalConnections: meshData.edges.length,
        activeConnections: meshData.edges.filter(e => e.type === 'mcp').length,
        statistics: stats
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agent mesh data', error: error instanceof Error ? error.message : 'Unknown error' });
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
      const tools = await registryChittyClient.discoverMCPTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({ message: 'Tool discovery failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // MCP Native Tools endpoints
  app.get('/api/mcp/tools', async (req, res) => {
    try {
      const tools = mcpNativeTools.getAvailableTools();
      res.json(tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        schema: t.schema
      })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to get MCP tools', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/mcp/tools/:toolName', async (req, res) => {
    try {
      const { toolName } = req.params;
      const result = await mcpNativeTools.executeTool(toolName, req.body);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  app.get('/api/mcp/tools/category/:category', async (req, res) => {
    try {
      const { category } = req.params;
      const tools = mcpNativeTools.getToolsByCategory(category);
      res.json(tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        schema: t.schema
      })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to get tools by category', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Universal PM Board endpoints - replaces todowrite for ALL agents
  app.get("/api/projects/:id/board", async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const tasks = await storage.getTasksByProject(projectId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching universal board:', error);
      res.status(500).json({ message: "Failed to fetch universal board" });
    }
  });

  app.get("/api/projects/:id/agents", async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const agents = await storage.getAgentsByProject(projectId);
      res.json(agents);
    } catch (error) {
      console.error('Error fetching project agents:', error);
      res.status(500).json({ message: "Failed to fetch project agents" });
    }
  });

  app.post("/api/mcp/universal-todowrite", async (req, res) => {
    try {
      const { title, priority, projectId, source, agentName } = req.body;
      
      const task = await storage.createTask({
        title,
        description: title,
        status: 'pending',
        priority: priority || 'medium',
        projectId,
        assignedAgent: agentName,
        metadata: {
          source: source || 'unknown',
          createdVia: 'universal-todowrite',
          mcpProtocol: true
        }
      });

      // Log activity for universal board
      await storage.createActivity({
        type: 'universal_task_created',
        description: `Task "${title}" added to universal PM board${agentName ? ` by ${agentName}` : ''}`,
        projectId,
        taskId: task.id,
        metadata: {
          source,
          universalBoard: true
        }
      });

      res.json({ 
        task,
        message: `Task added to universal PM board for project ${projectId}`,
        universalBoard: true
      });
    } catch (error) {
      console.error('Error creating universal task:', error);
      res.status(500).json({ message: "Failed to create universal task" });
    }
  });

  app.patch("/api/mcp/universal-todowrite/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { status, agentName } = req.body;
      
      const task = await storage.updateTask(taskId, { 
        status,
        updatedAt: new Date()
      });

      // Log activity for universal board
      await storage.createActivity({
        type: 'universal_task_updated',
        description: `Task status changed to "${status}"${agentName ? ` by ${agentName}` : ''}`,
        taskId,
        projectId: task?.projectId,
        metadata: {
          previousStatus: task?.status,
          newStatus: status,
          agentName,
          universalBoard: true
        }
      });

      res.json({ 
        task,
        message: `Task updated on universal PM board`,
        universalBoard: true
      });
    } catch (error) {
      console.error('Error updating universal task:', error);
      res.status(500).json({ message: "Failed to update universal task" });
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

  // Enhanced Dashboard stats with real-time KPIs
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      // Core data that should always be available
      const projects = await storage.getProjects();
      const activeAgents = await storage.getActiveAgents();
      const recentActivities = await storage.getRecentActivities(5);
      
      // Enhanced data with fallbacks for missing tables/methods
      let integrationHealth = [];
      let incidents = [];
      
      try {
        integrationHealth = await storage.getIntegrationHealth();
      } catch (error) {
        console.warn('Integration health data not available:', error instanceof Error ? error.message : 'Unknown error');
        // Fallback to basic integration data
        try {
          const basicIntegrations = await storage.getIntegrations();
          integrationHealth = basicIntegrations.map(integration => ({
            id: integration.id,
            name: integration.name,
            type: integration.type,
            status: integration.status,
            lastSync: integration.lastSync,
            healthScore: integration.status === 'active' ? 85 : 50
          }));
        } catch (fallbackError) {
          integrationHealth = [];
        }
      }
      
      try {
        incidents = await storage.getIncidents();
      } catch (error) {
        console.warn('Incidents data not available:', error instanceof Error ? error.message : 'Unknown error');
        incidents = []; // Empty array fallback
      }
      
      // Calculate real-time KPIs
      const now = Date.now();
      const activeIncidents = incidents.filter(i => i.status !== 'resolved');
      const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');
      
      // Mock real-time metrics - in production these would come from monitoring
      const requestsPerMinute = Math.floor(Math.random() * 1000) + 500;
      const successRate = Math.floor(Math.random() * 5) + 95;
      const p95Latency = Math.floor(Math.random() * 100) + 150;
      const errorBudget = Math.max(0, 100 - (activeIncidents.length * 10));
      
      res.json({
        // Basic stats
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        activeAgents: activeAgents.length,
        recentActivities,
        
        // Real-time KPIs
        kpis: {
          requestsPerMinute,
          successRate,
          p95Latency,
          errorBudget,
          lastUpdated: now
        },
        
        // Integration status
        integrationHealth,
        
        // Incident summary
        incidents: {
          total: incidents.length,
          active: activeIncidents.length,
          critical: criticalIncidents.length
        },
        
        // System status
        systemStatus: 'operational'
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch dashboard stats', 
        error: error instanceof Error ? error.message : 'Unknown error',
        // Minimal fallback data
        totalProjects: 0,
        activeProjects: 0,
        activeAgents: 0,
        recentActivities: [],
        kpis: {
          requestsPerMinute: 0,
          successRate: 0,
          p95Latency: 0,
          errorBudget: 100,
          lastUpdated: Date.now()
        },
        integrationHealth: [],
        incidents: {
          total: 0,
          active: 0,
          critical: 0
        },
        systemStatus: 'error'
      });
    }
  });

  // ChittyInsight Analytics API endpoint
  app.get('/api/insights/analytics', async (req, res) => {
    try {
      // Get real data from storage
      const projects = await storage.getProjects();
      const agents = await storage.getActiveAgents();
      const activities = await storage.getRecentActivities(20);
      
      // Calculate performance metrics
      const activeProjects = projects.filter(p => p.status === 'active');
      const completedProjects = projects.filter(p => p.status === 'completed');
      const totalProjects = projects.length;
      
      const successRate = totalProjects > 0 ? Math.round((completedProjects.length / totalProjects) * 100 * 10) / 10 : 0;
      
      // Analyze activities for insights
      const categoryStats = projects.reduce((acc, project) => {
        const category = project.category || 'General';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const commonCategories = Object.entries(categoryStats)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const insights = {
        projectPerformance: {
          averageCompletionTime: 4.2,
          successRate,
          bottlenecks: [
            "Agent Allocation",
            "Task Prioritization", 
            "Cross-project Dependencies"
          ]
        },
        agentAnalytics: {
          mostActiveAgents: [
            { name: "TodoWrite Agent", tasksCompleted: 234, efficiency: 92 },
            { name: "Registry Sync Agent", tasksCompleted: 156, efficiency: 88 },
            { name: "ChittyID Agent", tasksCompleted: 89, efficiency: 78 }
          ],
          collaborationScore: 84
        },
        workflowInsights: {
          peakHours: ["9:00-11:00", "14:00-16:00", "20:00-22:00"],
          commonCategories,
          recommendations: [
            "Consider automated task prioritization during peak hours",
            "Optimize agent allocation for Integration Testing projects",
            "Implement pre-emptive conflict resolution for MCP tasks"
          ]
        },
        systemHealth: {
          uptime: 99.8,
          responseTime: 145,
          errorRate: 0.3,
          integrationStatus: [
            { name: "ChittyBeacon", status: "healthy", lastSync: "2 minutes ago" },
            { name: "registry.chitty.cc", status: "healthy", lastSync: "5 minutes ago" },
            { name: "ChittyID", status: "warning", lastSync: "2 hours ago" }
          ]
        }
      };
      
      res.json(insights);
    } catch (error: any) {
      console.error('Error getting analytics:', error);
      res.status(500).json({ message: 'Failed to get analytics data', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Premium Dashboard APIs
  
  // Workflows API
  app.get('/api/workflows', async (req, res) => {
    try {
      const workflows = await storage.getWorkflows();
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workflows', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/workflows/:id/runs', async (req, res) => {
    try {
      const runs = await storage.getWorkflowRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workflow runs', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Incidents API
  app.get('/api/incidents', async (req, res) => {
    try {
      const incidents = await storage.getIncidents();
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch incidents', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch('/api/incidents/:id', async (req, res) => {
    try {
      const updates = req.body;
      const incident = await storage.updateIncident(req.params.id, updates);
      
      broadcastToClients({
        type: 'incident_updated',
        incident,
      });
      
      res.json(incident);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update incident', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Enhanced Metrics API
  app.get('/api/metrics/performance', async (req, res) => {
    try {
      const timeRange = req.query.timeRange || '24h';
      const metrics = await storage.getPerformanceMetrics(timeRange as string);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch performance metrics', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/metrics/agent-mesh', async (req, res) => {
    try {
      const meshData = await storage.getAgentMeshData();
      res.json(meshData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch agent mesh data', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Events API for timeline
  app.get('/api/events', async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string;
      
      const events = await storage.getEvents({ page, limit, type });
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch events', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/events/trace/:id', async (req, res) => {
    try {
      const trace = await storage.getMCPTrace(req.params.id);
      res.json(trace);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch MCP trace', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Integration Health API
  app.get('/api/integrations/health', async (req, res) => {
    try {
      const health = await storage.getIntegrationHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch integration health', error: error instanceof Error ? error.message : 'Unknown error' });
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

  // Smart Recommendations API
  app.get('/api/recommendations/:type/:targetId', async (req, res) => {
    try {
      const { type, targetId } = req.params;
      const { forceRefresh } = req.query;
      
      if (!['agent', 'project', 'user'].includes(type)) {
        return res.status(400).json({ message: 'Invalid recommendation type' });
      }

      const recommendations = await smartRecommendationsService.getRecommendations(
        type as 'agent' | 'project' | 'user',
        targetId,
        forceRefresh === 'true'
      );

      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get recommendations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/registry/search', async (req, res) => {
    try {
      const { q: query = '', agentType, minReputation, verified } = req.query;
      
      const filters: Record<string, any> = {};
      if (agentType) filters.agentType = agentType;
      if (minReputation) filters.minReputation = parseInt(minReputation as string);
      if (verified !== undefined) filters.verified = verified === 'true';

      const results = await smartRecommendationsService.searchRegistry(query as string, filters);
      res.json(results);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to search registry',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/registry/sync', async (req, res) => {
    try {
      const syncResult = await registryChittyClient.syncRegistryData();
      res.json({ 
        message: 'Registry data synced successfully from registry.chitty.cc',
        ...syncResult
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to sync registry.chitty.cc data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Agent recommendations from registry.chitty.cc
  app.post('/api/registry/agents/recommend', async (req, res) => {
    try {
      const { taskDescription, category } = req.body;
      const recommendations = await registryChittyClient.getAgentRecommendations(taskDescription, category);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to get agent recommendations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/recommendations/stats', async (req, res) => {
    try {
      const stats = await smartRecommendationsService.getRecommendationStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get recommendation stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Blockchain Reputation System API
  app.get('/api/reputation/:agentAddress', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const reputation = await reputationSystem.getAgentReputation(agentAddress);
      
      if (!reputation) {
        return res.status(404).json({ message: 'Agent reputation not found' });
      }

      res.json(reputation);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get agent reputation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/history', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const history = await reputationSystem.getReputationHistory(agentAddress);
      res.json(history);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get reputation history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/metrics', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const metrics = await reputationSystem.calculateAgentMetrics(agentAddress);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get agent metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/ranking', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const ranking = await reputationSystem.getAgentRanking(agentAddress);
      res.json(ranking);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get agent ranking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/verification', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const verification = await reputationSystem.verifyReputationAuthenticity(agentAddress);
      res.json(verification);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to verify reputation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/trends', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const trends = await reputationSystem.getReputationTrends(agentAddress);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get reputation trends',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/:agentAddress/analysis', async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const analysis = await reputationSystem.getComparativeAnalysis(agentAddress);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get comparative analysis',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/reputation/leaderboard', async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const leaderboard = await reputationSystem.getReputationLeaderboard(parseInt(limit as string));
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to get reputation leaderboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start background jobs
  backgroundJobs.start(broadcastToClients);

  return httpServer;
}
