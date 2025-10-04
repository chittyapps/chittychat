#!/usr/bin/env node

/**
 * ChittyRouter MCP Desktop Extension Bridge Server
 * Provides seamless access to ChittyRouter's cloud MCP server
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const NodeCache = require('node-cache');

class ChittyRouterMCPBridge {
  constructor() {
    this.server = new Server(
      {
        name: 'chittyrouter-mcp-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    // Configuration from manifest user_config
    this.config = {
      endpoint: process.env.MCP_ENDPOINT || 'https://mcp.chitty.cc',
      token: process.env.CHITTY_ID_TOKEN,
      enableCache: process.env.ENABLE_LOCAL_CACHE !== 'false',
      timeout: parseInt(process.env.TIMEOUT_SECONDS || '30') * 1000
    };

    // Local cache for performance (TTL: 5 minutes)
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools from ChittyRouter
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const cacheKey = 'available_tools';
        let tools = this.cache.get(cacheKey);

        if (!tools) {
          console.error('Fetching tools from ChittyRouter...');
          const response = await axios.get(`${this.config.endpoint}/tools`, {
            headers: {
              'Authorization': `Bearer ${this.config.token}`,
              'User-Agent': 'ChittyRouter-Desktop-Extension/1.0.0'
            },
            timeout: this.config.timeout
          });

          tools = response.data.tools || [];

          if (this.config.enableCache) {
            this.cache.set(cacheKey, tools);
          }
        }

        return { tools };
      } catch (error) {
        console.error('Failed to fetch tools:', error.message);

        // Return fallback tool list based on manifest capabilities
        return {
          tools: this.getFallbackTools()
        };
      }
    });

    // Execute tools via ChittyRouter
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        console.error(`Executing tool: ${name}`);

        // All tools now unified in ChittyMCP endpoint
        const endpoint = this.config.endpoint;

        // Check cache for read-only operations
        const cacheKey = `tool_${name}_${JSON.stringify(args)}`;
        if (this.isReadOnlyTool(name) && this.config.enableCache) {
          const cached = this.cache.get(cacheKey);
          if (cached) {
            console.error('Returning cached result');
            return cached;
          }
        }

        const response = await axios.post(`${endpoint}/execute`, {
          tool: name,
          arguments: args,
          metadata: {
            source: 'desktop-extension',
            version: '1.0.0'
          }
        }, {
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'ChittyRouter-Desktop-Extension/1.0.0'
          },
          timeout: this.config.timeout
        });

        const result = {
          content: [
            {
              type: 'text',
              text: response.data.result || JSON.stringify(response.data, null, 2)
            }
          ]
        };

        // Cache read-only results
        if (this.isReadOnlyTool(name) && this.config.enableCache) {
          this.cache.set(cacheKey, result);
        }

        return result;

      } catch (error) {
        console.error(`Tool execution failed: ${error.message}`);

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool "${name}": ${error.message}\n\nPlease verify:\n1. ChittyID token is valid\n2. ChittyRouter endpoint is accessible\n3. Tool name and arguments are correct`
            }
          ],
          isError: true
        };
      }
    });
  }

  getFallbackTools() {
    // Fallback tool definitions based on manifest capabilities
    return [
      {
        name: 'read_file',
        description: 'Read file contents from filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'git_status',
        description: 'Get git repository status',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Repository path (optional)', default: '.' }
          }
        }
      },
      {
        name: 'web_search',
        description: 'Search the web for information',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Number of results', default: 5 }
          },
          required: ['query']
        }
      },
      {
        name: 'sql_query',
        description: 'Execute SQL query on database',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query to execute' },
            database: { type: 'string', description: 'Database connection string' }
          },
          required: ['query']
        }
      },
      {
        name: 'verify_case_number',
        description: 'Verify Cook County case number and get case details',
        inputSchema: {
          type: 'object',
          properties: {
            case_number: { type: 'string', description: 'Case number (format: YYYY-L-NNNNNN)' },
            party_names: { type: 'array', items: { type: 'string' }, description: 'Names of parties involved' }
          },
          required: ['case_number']
        }
      },
      {
        name: 'search_cases',
        description: 'Search Cook County cases by party name or attorney',
        inputSchema: {
          type: 'object',
          properties: {
            party_name: { type: 'string', description: 'Name of party to search' },
            attorney_name: { type: 'string', description: 'Name of attorney to search' },
            date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
            date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' }
          }
        }
      },
      {
        name: 'get_court_calendar',
        description: 'Get court calendar events for a case',
        inputSchema: {
          type: 'object',
          properties: {
            case_number: { type: 'string', description: 'Case number to get calendar for' }
          },
          required: ['case_number']
        }
      },
      {
        name: 'lookup_property_pin',
        description: 'Look up Cook County property information by PIN',
        inputSchema: {
          type: 'object',
          properties: {
            pin: { type: 'string', description: 'Property Identification Number (XX-XX-XXX-XXX-XXXX)' },
            include_tax_history: { type: 'boolean', description: 'Include tax assessment history', default: false }
          },
          required: ['pin']
        }
      }
    ];
  }

  isReadOnlyTool(toolName) {
    const readOnlyTools = [
      'read_file', 'list_directory', 'git_status', 'git_log', 'git_diff',
      'web_search', 'fetch_url', 'sql_query', 'text_analyze', 'document_summarize',
      'verify_case_number', 'search_cases', 'get_court_calendar', 'lookup_property_pin'
    ];
    return readOnlyTools.includes(toolName);
  }


  async start() {
    // Validate configuration
    if (!this.config.token) {
      console.error('Error: CHITTY_ID_TOKEN is required');
      process.exit(1);
    }

    console.error(`ChittyRouter MCP Bridge starting...`);
    console.error(`Endpoint: ${this.config.endpoint}`);
    console.error(`Cache enabled: ${this.config.enableCache}`);
    console.error(`Timeout: ${this.config.timeout}ms`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('ChittyRouter MCP Bridge ready!');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down ChittyRouter MCP Bridge...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down ChittyRouter MCP Bridge...');
  process.exit(0);
});

// Start the bridge server
const bridge = new ChittyRouterMCPBridge();
bridge.start().catch((error) => {
  console.error('Failed to start ChittyRouter MCP Bridge:', error);
  process.exit(1);
});