import { Router } from 'express';
import { ConnectorManager } from '../connectors/connector-manager';
import type { ConnectorConfig } from '../connectors/base-connector';

const router = Router();
const connectorManager = ConnectorManager.getInstance();

// Initialize connector manager
connectorManager.initialize();

// Get all connectors
router.get('/connectors', async (req, res) => {
  try {
    const connectors = connectorManager.getAllConnectors();
    const connectorList = [];

    for (const [name, instance] of connectors) {
      connectorList.push({
        name,
        type: instance.config.type,
        active: instance.connector.isActive(),
        capabilities: instance.connector.getCapabilities()
      });
    }

    res.json({ connectors: connectorList });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific connector status
router.get('/connectors/:name/status', async (req, res) => {
  try {
    const status = await connectorManager.getConnectorStatus(req.params.name);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Claude connector
router.post('/connectors/claude', async (req, res) => {
  try {
    const { name, apiKey, model, baseUrl } = req.body;

    if (!name || !apiKey) {
      return res.status(400).json({ error: 'Name and API key are required' });
    }

    const config: ConnectorConfig = {
      name,
      type: 'claude',
      apiKey,
      model,
      baseUrl
    };

    const result = await connectorManager.createConnector(name, config);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create GPT connector
router.post('/connectors/gpt', async (req, res) => {
  try {
    const { name, apiKey, model, baseUrl, organization } = req.body;

    if (!name || !apiKey) {
      return res.status(400).json({ error: 'Name and API key are required' });
    }

    const config: ConnectorConfig = {
      name,
      type: 'gpt',
      apiKey,
      model,
      baseUrl,
      metadata: { organization }
    };

    const result = await connectorManager.createConnector(name, config);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Claude Code connector
router.post('/connectors/claude-code', async (req, res) => {
  try {
    const { name, workspaceUrl, sessionToken, autoSync, mcpEndpoint } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const config: ConnectorConfig = {
      name,
      type: 'claude-code',
      metadata: {
        workspaceUrl,
        sessionToken,
        autoSync,
        mcpEndpoint
      }
    };

    const result = await connectorManager.createConnector(name, config);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create custom GPT connector
router.post('/connectors/custom', async (req, res) => {
  try {
    const { 
      name, 
      schemaUrl, 
      apiKey, 
      authType, 
      authHeader,
      customHeaders,
      requestFormat,
      responseFormat 
    } = req.body;

    if (!name || !schemaUrl) {
      return res.status(400).json({ error: 'Name and schema URL are required' });
    }

    const config: ConnectorConfig = {
      name,
      type: 'custom',
      apiKey,
      baseUrl: schemaUrl,
      metadata: {
        authType,
        authHeader,
        customHeaders,
        requestFormat,
        responseFormat
      }
    };

    const result = await connectorManager.createConnector(name, config);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove connector
router.delete('/connectors/:name', async (req, res) => {
  try {
    const result = await connectorManager.removeConnector(req.params.name);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send message to connector
router.post('/connectors/:name/message', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const connector = connectorManager.getConnector(req.params.name);
    
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const result = await connector.sendMessage(messages);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create task via connector
router.post('/connectors/:name/task', async (req, res) => {
  try {
    const taskRequest = req.body;
    
    const connector = connectorManager.getConnector(req.params.name);
    
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const task = await connector.createTask(taskRequest);
    
    if (task) {
      res.json({ success: true, task });
    } else {
      res.status(400).json({ error: 'Failed to create task' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create project via connector
router.post('/connectors/:name/project', async (req, res) => {
  try {
    const projectRequest = req.body;
    
    const connector = connectorManager.getConnector(req.params.name);
    
    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const project = await connector.createProject(projectRequest);
    
    if (project) {
      res.json({ success: true, project });
    } else {
      res.status(400).json({ error: 'Failed to create project' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute custom method on connector
router.post('/connectors/:name/execute', async (req, res) => {
  try {
    const { method, args = [] } = req.body;
    
    if (!method) {
      return res.status(400).json({ error: 'Method name is required' });
    }

    const result = await connectorManager.executeOnConnector(
      req.params.name,
      method,
      ...args
    );
    
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast to all connectors
router.post('/connectors/broadcast', async (req, res) => {
  try {
    const { method, args = [] } = req.body;
    
    if (!method) {
      return res.status(400).json({ error: 'Method name is required' });
    }

    const results = await connectorManager.broadcastToAll(method, ...args);
    
    const response: Record<string, any> = {};
    for (const [name, result] of results) {
      response[name] = result;
    }
    
    res.json({ success: true, results: response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;