import { BaseConnector, ConnectorConfig, ConnectorResponse } from './base-connector';
import { ClaudeConnector } from './claude-connector';
import { ClaudeCodeConnector } from './claude-code-connector';
import { GPTConnector } from './gpt-connector';
import { CustomGPTConnector } from './custom-gpt-connector';
import { db } from '../db';
import { integrations, activities } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface ConnectorInstance {
  connector: BaseConnector;
  config: ConnectorConfig;
  integrationId?: string;
}

export class ConnectorManager {
  private static instance: ConnectorManager;
  private connectors: Map<string, ConnectorInstance> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  static getInstance(): ConnectorManager {
    if (!ConnectorManager.instance) {
      ConnectorManager.instance = new ConnectorManager();
    }
    return ConnectorManager.instance;
  }

  async initialize() {
    // Load saved integrations from database
    await this.loadIntegrations();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  private async loadIntegrations() {
    try {
      const savedIntegrations = await db
        .select()
        .from(integrations)
        .where(eq(integrations.status, 'active'));

      for (const integration of savedIntegrations) {
        const config = integration.config as ConnectorConfig;
        if (config) {
          await this.createConnector(integration.name, config, integration.id);
        }
      }

      console.log(`Loaded ${savedIntegrations.length} active integrations`);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  }

  async createConnector(
    name: string,
    config: ConnectorConfig,
    integrationId?: string
  ): Promise<ConnectorResponse> {
    try {
      // Check if connector already exists
      if (this.connectors.has(name)) {
        return {
          success: false,
          error: 'Connector already exists with this name'
        };
      }

      let connector: BaseConnector;

      // Create appropriate connector based on type
      switch (config.type) {
        case 'claude':
          connector = new ClaudeConnector(config as any);
          break;
          
        case 'claude-code':
          connector = new ClaudeCodeConnector(config as any);
          break;
          
        case 'gpt':
          connector = new GPTConnector(config as any);
          break;
          
        case 'custom':
          connector = new CustomGPTConnector(config as any);
          break;
          
        default:
          return {
            success: false,
            error: `Unknown connector type: ${config.type}`
          };
      }

      // Connect to the service
      const connectResult = await connector.connect();
      
      if (!connectResult.success) {
        return connectResult;
      }

      // Save to database if not already saved
      if (!integrationId) {
        const [integration] = await db.insert(integrations).values({
          name,
          type: config.type,
          status: 'active',
          config: config as any,
          lastSync: new Date()
        }).returning();
        
        integrationId = integration.id;
      } else {
        // Update existing integration
        await db
          .update(integrations)
          .set({
            status: 'active',
            lastSync: new Date(),
            errorMessage: null
          })
          .where(eq(integrations.id, integrationId));
      }

      // Store connector instance
      this.connectors.set(name, {
        connector,
        config,
        integrationId
      });

      await this.logActivity(
        'connector_created',
        `Created ${config.type} connector: ${name}`
      );

      return {
        success: true,
        message: `Connector ${name} created successfully`,
        data: {
          name,
          type: config.type,
          capabilities: connector.getCapabilities()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create connector'
      };
    }
  }

  async removeConnector(name: string): Promise<ConnectorResponse> {
    try {
      const instance = this.connectors.get(name);
      
      if (!instance) {
        return {
          success: false,
          error: 'Connector not found'
        };
      }

      // Disconnect the connector
      await instance.connector.disconnect();

      // Update database
      if (instance.integrationId) {
        await db
          .update(integrations)
          .set({
            status: 'inactive',
            errorMessage: 'Manually disconnected'
          })
          .where(eq(integrations.id, instance.integrationId));
      }

      // Remove from map
      this.connectors.delete(name);

      await this.logActivity(
        'connector_removed',
        `Removed connector: ${name}`
      );

      return {
        success: true,
        message: `Connector ${name} removed successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to remove connector'
      };
    }
  }

  getConnector(name: string): BaseConnector | null {
    return this.connectors.get(name)?.connector || null;
  }

  getAllConnectors(): Map<string, ConnectorInstance> {
    return this.connectors;
  }

  async getConnectorStatus(name: string): Promise<{
    active: boolean;
    type?: string;
    capabilities?: string[];
    error?: string;
  }> {
    const instance = this.connectors.get(name);
    
    if (!instance) {
      return { active: false, error: 'Connector not found' };
    }

    return {
      active: instance.connector.isActive(),
      type: instance.config.type,
      capabilities: instance.connector.getCapabilities()
    };
  }

  private startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, instance] of this.connectors) {
        try {
          if (!instance.connector.isActive()) {
            console.log(`Reconnecting ${name}...`);
            const result = await instance.connector.connect();
            
            if (result.success) {
              await db
                .update(integrations)
                .set({
                  status: 'active',
                  lastSync: new Date(),
                  errorMessage: null
                })
                .where(eq(integrations.id, instance.integrationId!));
            } else {
              await db
                .update(integrations)
                .set({
                  status: 'error',
                  errorMessage: result.error
                })
                .where(eq(integrations.id, instance.integrationId!));
            }
          }
        } catch (error) {
          console.error(`Health check failed for ${name}:`, error);
        }
      }
    }, 5 * 60 * 1000);
  }

  private async logActivity(type: string, description: string) {
    try {
      await db.insert(activities).values({
        type,
        description,
        metadata: {
          source: 'connector-manager',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async executeOnConnector(
    connectorName: string,
    method: string,
    ...args: any[]
  ): Promise<any> {
    const connector = this.getConnector(connectorName);
    
    if (!connector) {
      throw new Error(`Connector ${connectorName} not found`);
    }

    if (typeof (connector as any)[method] !== 'function') {
      throw new Error(`Method ${method} not found on connector`);
    }

    return await (connector as any)[method](...args);
  }

  async broadcastToAll(method: string, ...args: any[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (const [name, instance] of this.connectors) {
      try {
        if (typeof (instance.connector as any)[method] === 'function') {
          const result = await (instance.connector as any)[method](...args);
          results.set(name, result);
        }
      } catch (error) {
        results.set(name, { error: error.message });
      }
    }

    return results;
  }

  stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Disconnect all connectors
    for (const [name, instance] of this.connectors) {
      instance.connector.disconnect().catch(error => {
        console.error(`Failed to disconnect ${name}:`, error);
      });
    }

    this.connectors.clear();
  }
}