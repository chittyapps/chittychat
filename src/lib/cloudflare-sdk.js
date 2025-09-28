import Cloudflare from 'cloudflare';

// Initialize Cloudflare SDK for ChittyChat
export class ChittyCloudflare {
  constructor(env) {
    this.client = new Cloudflare({
      apiToken: env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
    });
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.zoneId = env.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;
  }

  // Email Routing Management
  async setupEmailRouting() {
    try {
      // Enable email routing for zone
      await this.client.emailRouting.enable(this.zoneId);

      // Create catch-all rule
      await this.client.emailRouting.rules.catchAll.update(this.zoneId, {
        enabled: true,
        action: 'worker',
        matcher: 'all'
      });

      return { success: true };
    } catch (error) {
      console.error('Email routing setup failed:', error);
      throw error;
    }
  }

  // Vectorize Operations
  async createVectorizeIndex(name, dimensions = 1536) {
    try {
      const index = await this.client.vectorize.indexes.create({
        account_id: this.accountId,
        name,
        description: `ChittyChat ${name} index`,
        config: {
          dimensions,
          metric: 'cosine'
        }
      });
      return index;
    } catch (error) {
      console.error('Vectorize index creation failed:', error);
      throw error;
    }
  }

  async queryVectorize(indexName, vector, topK = 10) {
    try {
      const results = await this.client.vectorize.indexes.query(
        this.accountId,
        indexName,
        {
          vector,
          topK,
          returnMetadata: true
        }
      );
      return results;
    } catch (error) {
      console.error('Vectorize query failed:', error);
      throw error;
    }
  }

  // R2 Operations
  async uploadToR2(bucketName, key, data, metadata = {}) {
    try {
      const bucket = this.client.r2.buckets.get(this.accountId, bucketName);
      await bucket.put(key, data, {
        customMetadata: metadata,
        httpMetadata: {
          contentType: metadata.contentType || 'application/json'
        }
      });
      return { success: true, key };
    } catch (error) {
      console.error('R2 upload failed:', error);
      throw error;
    }
  }

  async getFromR2(bucketName, key) {
    try {
      const bucket = this.client.r2.buckets.get(this.accountId, bucketName);
      const object = await bucket.get(key);
      return object;
    } catch (error) {
      console.error('R2 get failed:', error);
      throw error;
    }
  }

  // Workers AI Operations
  async runAI(model, input) {
    try {
      const response = await this.client.workers.ai.run(
        this.accountId,
        model,
        input
      );
      return response;
    } catch (error) {
      console.error('Workers AI run failed:', error);
      throw error;
    }
  }

  // AutoRAG Operations
  async createAutoRAG(config) {
    try {
      // AutoRAG API endpoint construction
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/autorag`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.client.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: config.name,
            data_source: config.dataSource,
            config: {
              chunk_size: config.chunkSize || 1000,
              chunk_overlap: config.chunkOverlap || 200,
              model: config.model || 'claude-3-haiku',
              index_schedule: config.indexSchedule || '*/15 * * * *'
            }
          })
        }
      );
      return await response.json();
    } catch (error) {
      console.error('AutoRAG creation failed:', error);
      throw error;
    }
  }

  // D1 Database Operations
  async queryD1(databaseId, query, params = []) {
    try {
      const result = await this.client.d1.database
        .query(this.accountId, databaseId, {
          sql: query,
          params
        });
      return result;
    } catch (error) {
      console.error('D1 query failed:', error);
      throw error;
    }
  }

  // KV Operations
  async putKV(namespaceId, key, value, metadata = {}) {
    try {
      await this.client.kv.namespaces.values.update(
        this.accountId,
        namespaceId,
        key,
        {
          value: JSON.stringify(value),
          metadata
        }
      );
      return { success: true };
    } catch (error) {
      console.error('KV put failed:', error);
      throw error;
    }
  }

  async getKV(namespaceId, key) {
    try {
      const result = await this.client.kv.namespaces.values.get(
        this.accountId,
        namespaceId,
        key
      );
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('KV get failed:', error);
      throw error;
    }
  }

  // Analytics Operations
  async getAnalytics(since, until) {
    try {
      const analytics = await this.client.zones.analytics.get(this.zoneId, {
        since,
        until,
        metrics: ['requests', 'bandwidth', 'threats', 'pageviews']
      });
      return analytics;
    } catch (error) {
      console.error('Analytics fetch failed:', error);
      throw error;
    }
  }

  // Workers Logs
  async getWorkerLogs(scriptName, since) {
    try {
      const logs = await this.client.workers.scripts.logs.get(
        this.accountId,
        scriptName,
        {
          since,
          limit: 100
        }
      );
      return logs;
    } catch (error) {
      console.error('Worker logs fetch failed:', error);
      throw error;
    }
  }
}

// Helper function to create client
export function createCloudflareClient(env) {
  return new ChittyCloudflare(env);
}