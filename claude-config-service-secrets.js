#!/usr/bin/env node

/**
 * Production Secret Management for Claude Config Service
 *
 * Uses:
 * - 1Password Service Accounts for local/dev environments
 * - Cloudflare Secrets for production Workers
 * - ChittyRouter manages secret distribution
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Secret Provider Interface
class SecretProvider {
  async getSecret(key) {
    throw new Error('Must implement getSecret');
  }

  async getSecrets(keys) {
    const secrets = {};
    for (const key of keys) {
      secrets[key] = await this.getSecret(key);
    }
    return secrets;
  }
}

// 1Password Service Account Provider
class OnePasswordProvider extends SecretProvider {
  constructor(options = {}) {
    super();
    this.serviceAccountToken = process.env.OP_SERVICE_ACCOUNT_TOKEN;
    this.vault = options.vault || 'ChittyOS';
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
  }

  async getSecret(key) {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.value;
    }

    try {
      // Use 1Password CLI with service account
      const { stdout } = await execAsync(
        `op item get "${key}" --vault="${this.vault}" --fields label=value --format json`,
        {
          env: {
            ...process.env,
            OP_SERVICE_ACCOUNT_TOKEN: this.serviceAccountToken
          }
        }
      );

      const secret = JSON.parse(stdout).value;

      // Cache the secret
      this.cache.set(key, {
        value: secret,
        expiry: Date.now() + this.cacheTTL
      });

      return secret;
    } catch (error) {
      console.error(`Failed to fetch secret ${key} from 1Password:`, error.message);
      throw error;
    }
  }

  async getSecretReference(key) {
    // Return 1Password reference for injection
    return `op://${this.vault}/${key}/value`;
  }
}

// Cloudflare Secrets Provider (for Workers)
class CloudflareSecretsProvider extends SecretProvider {
  constructor(options = {}) {
    super();
    this.accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = options.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    this.environment = options.environment || 'production';
  }

  async getSecret(key) {
    // In Cloudflare Workers, secrets are available as environment variables
    // This is for managing secrets via API
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/chittyrouter/secrets`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      const secret = data.result.find(s => s.name === key);

      return secret ? secret.text : null;
    } catch (error) {
      console.error(`Failed to fetch secret ${key} from Cloudflare:`, error.message);
      throw error;
    }
  }

  async putSecret(key, value) {
    // Upload secret to Cloudflare
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/chittyrouter/secrets`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: key,
            text: value,
            type: 'secret_text'
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`Failed to store secret ${key} in Cloudflare:`, error.message);
      throw error;
    }
  }
}

// ChittyRouter Secret Management
class ChittyRouterSecrets {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';

    // Use appropriate provider based on environment
    if (this.environment === 'production') {
      this.provider = new CloudflareSecretsProvider();
    } else {
      this.provider = new OnePasswordProvider();
    }

    // Secret mapping for ChittyOS services
    this.secretMapping = {
      canon: {
        token: 'CANON_API_TOKEN',
        endpoint: 'CANON_URL'
      },
      registry: {
        token: 'REGISTRY_API_KEY',
        endpoint: 'REGISTRY_URL'
      },
      mothership: {
        token: 'MOTHERSHIP_API_KEY',
        endpoint: 'MOTHERSHIP_URL'
      },
      notion: {
        token: 'NOTION_TOKEN',
        databaseId: 'NOTION_DATABASE_ID'
      },
      neon: {
        databaseUrl: 'NEON_DATABASE_URL'
      },
      cloudflare: {
        accountId: 'CLOUDFLARE_ACCOUNT_ID',
        apiToken: 'CLOUDFLARE_API_TOKEN',
        r2AccessKey: 'R2_ACCESS_KEY_ID',
        r2SecretKey: 'R2_SECRET_ACCESS_KEY'
      }
    };
  }

  /**
   * Get secrets for a specific service
   */
  async getServiceSecrets(serviceName) {
    const mapping = this.secretMapping[serviceName];
    if (!mapping) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    const secrets = {};
    for (const [key, secretName] of Object.entries(mapping)) {
      secrets[key] = await this.provider.getSecret(secretName);
    }

    return secrets;
  }

  /**
   * Get all secrets needed for Claude Config Service
   */
  async getAllSecrets() {
    const allSecrets = {};

    for (const [service, mapping] of Object.entries(this.secretMapping)) {
      allSecrets[service] = await this.getServiceSecrets(service);
    }

    return allSecrets;
  }

  /**
   * Generate environment variable exports for local development
   */
  async generateEnvExports() {
    const secrets = await this.getAllSecrets();
    const exports = [];

    for (const [service, serviceSecrets] of Object.entries(secrets)) {
      for (const [key, value] of Object.entries(serviceSecrets)) {
        const envName = this.secretMapping[service][key];
        exports.push(`export ${envName}="${value}"`);
      }
    }

    return exports.join('\n');
  }

  /**
   * Sync secrets from 1Password to Cloudflare
   */
  async syncToCloudflare() {
    console.log('Syncing secrets from 1Password to Cloudflare...');

    const opProvider = new OnePasswordProvider();
    const cfProvider = new CloudflareSecretsProvider();

    const results = [];

    for (const [service, mapping] of Object.entries(this.secretMapping)) {
      for (const [key, secretName] of Object.entries(mapping)) {
        try {
          const value = await opProvider.getSecret(secretName);
          await cfProvider.putSecret(secretName, value);
          results.push({ secret: secretName, status: 'synced' });
          console.log(`✓ Synced ${secretName}`);
        } catch (error) {
          results.push({ secret: secretName, status: 'failed', error: error.message });
          console.error(`✗ Failed to sync ${secretName}: ${error.message}`);
        }
      }
    }

    return results;
  }
}

// Enhanced Config Service with Secret Management
class SecureClaudeConfigService {
  constructor() {
    this.secrets = new ChittyRouterSecrets();
    this.config = null;
  }

  async initialize() {
    // Load all secrets from appropriate provider
    const secrets = await this.secrets.getAllSecrets();

    // Initialize service with secrets
    this.config = {
      tokens: {
        canon: secrets.canon.token,
        registry: secrets.registry.token,
        mothership: secrets.mothership.token,
        notion: secrets.notion.token
      },
      endpoints: {
        canon: secrets.canon.endpoint || 'https://canon.chitty.cc',
        registry: secrets.registry.endpoint || 'https://registry.chitty.cc',
        mothership: secrets.mothership.endpoint || 'https://id.chitty.cc'
      },
      database: {
        url: secrets.neon.databaseUrl
      },
      cloudflare: secrets.cloudflare
    };

    console.log('Service initialized with secrets from', this.secrets.environment);
  }

  /**
   * Make authenticated request through ChittyRouter
   */
  async routedRequest(service, path, options = {}) {
    // ChittyRouter handles authentication and routing
    const response = await fetch(`https://router.chitty.cc/api/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': this.config.tokens[service]
      },
      body: JSON.stringify({
        service,
        path,
        method: options.method || 'GET',
        body: options.body,
        headers: options.headers
      })
    });

    return response.json();
  }
}

// Cloudflare Worker Environment (when deployed)
export default {
  async fetch(request, env, ctx) {
    // In Cloudflare Workers, secrets are available in env
    const config = {
      tokens: {
        canon: env.CANON_API_TOKEN,
        registry: env.REGISTRY_API_KEY,
        mothership: env.MOTHERSHIP_API_KEY,
        notion: env.NOTION_TOKEN
      },
      endpoints: {
        canon: env.CANON_URL || 'https://canon.chitty.cc',
        registry: env.REGISTRY_URL || 'https://registry.chitty.cc',
        mothership: env.MOTHERSHIP_URL || 'https://id.chitty.cc'
      }
    };

    // Route request based on path
    const url = new URL(request.url);

    if (url.pathname === '/api/config/fetch') {
      // Fetch config through ChittyRouter
      return handleConfigFetch(request, config);
    }

    return new Response('ChittyRouter Config Service', { status: 200 });
  }
};

// CLI for local development
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const secretManager = new ChittyRouterSecrets();

  switch (command) {
    case 'export':
      // Generate environment variable exports
      secretManager.generateEnvExports().then(exports => {
        console.log(exports);
        console.log('\n# Run: eval $(node claude-config-service-secrets.js export)');
      });
      break;

    case 'sync':
      // Sync secrets from 1Password to Cloudflare
      secretManager.syncToCloudflare().then(results => {
        console.log('\nSync Results:', results);
      });
      break;

    case 'test':
      // Test secret access
      const service = new SecureClaudeConfigService();
      service.initialize().then(() => {
        console.log('Secret access test successful');
      }).catch(error => {
        console.error('Secret access test failed:', error);
      });
      break;

    case 'get':
      // Get specific secret
      const secretName = process.argv[3];
      if (!secretName) {
        console.error('Usage: node claude-config-service-secrets.js get SECRET_NAME');
        process.exit(1);
      }
      secretManager.provider.getSecret(secretName).then(value => {
        console.log(`${secretName}=${value}`);
      });
      break;

    default:
      console.log(`
ChittyRouter Secret Management

Commands:
  export    Generate environment variable exports for local dev
  sync      Sync secrets from 1Password to Cloudflare
  test      Test secret access
  get NAME  Get a specific secret value

Environment:
  NODE_ENV: ${process.env.NODE_ENV || 'development'}
  Provider: ${process.env.NODE_ENV === 'production' ? 'Cloudflare' : '1Password'}

Required Environment Variables:
  - OP_SERVICE_ACCOUNT_TOKEN (for 1Password)
  - CLOUDFLARE_ACCOUNT_ID (for Cloudflare)
  - CLOUDFLARE_API_TOKEN (for Cloudflare)
      `);
  }
}