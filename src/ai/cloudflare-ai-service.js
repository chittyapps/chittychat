/**
 * Cloudflare Workers AI Service
 * Uses Cloudflare's AI platform for embeddings and text processing
 * Replaces OpenAI with edge-based AI models
 */

class CloudflareAIService {
  constructor(options = {}) {
    this.ai = options.ai; // Cloudflare Workers AI binding
    this.cache = new Map();
    this.model = options.model || '@cf/baai/bge-base-en-v1.5'; // 768-dimensional embeddings
    this.dimensions = this.getModelDimensions(this.model);
    this.requestTimeout = options.timeout || 30000;
  }

  /**
   * Get dimensions for embedding model
   */
  getModelDimensions(model) {
    const modelDimensions = {
      '@cf/baai/bge-small-en-v1.5': 384,
      '@cf/baai/bge-base-en-v1.5': 768,
      '@cf/baai/bge-large-en-v1.5': 1024,
      '@cf/baai/bge-m3': 1024,
      '@cf/google/embed-english-v3': 768
    };
    return modelDimensions[model] || 768;
  }

  /**
   * Generate text embeddings using Cloudflare Workers AI
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    if (!this.ai) {
      throw new Error('Cloudflare AI binding not available - ensure Workers AI is configured');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Use Cloudflare Workers AI for embeddings
      const response = await this.ai.run(this.model, {
        text: text.substring(0, 8000), // BGE model limit
      });

      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Cloudflare AI');
      }

      const embedding = response.data;

      // Validate embedding dimensions
      if (embedding.length !== this.dimensions) {
        throw new Error(`Expected ${this.dimensions} dimensions, got ${embedding.length}`);
      }

      // Cache the result
      this.cache.set(cacheKey, embedding);

      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return embedding;
    } catch (error) {
      console.error('Cloudflare AI embedding error:', error);
      throw new Error(`Cloudflare AI embedding failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(texts) {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    const embeddings = [];

    // Process in batches of 5 to respect Cloudflare Workers AI limits
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );

      embeddings.push(...batchEmbeddings);

      // Small delay to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return embeddings;
  }

  /**
   * Calculate semantic similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      throw new Error('Embeddings must be arrays');
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Extract keywords using Cloudflare Workers AI text processing
   */
  async extractSemanticKeywords(text, limit = 10) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    if (!this.ai) {
      throw new Error('Cloudflare AI binding not available');
    }

    try {
      // Use Cloudflare Workers AI for text analysis
      const response = await this.ai.run('@cf/meta/llama-2-7b-chat-fp16', {
        messages: [
          {
            role: 'system',
            content: 'Extract the most important keywords from the following text. Return only a JSON array of keywords, no other text.'
          },
          {
            role: 'user',
            content: `Extract ${limit} keywords from: ${text.substring(0, 2000)}`
          }
        ]
      });

      if (!response || !response.response) {
        throw new Error('Invalid response from Cloudflare AI text processing');
      }

      // Parse keywords from AI response
      try {
        const keywords = JSON.parse(response.response);
        return Array.isArray(keywords) ? keywords.slice(0, limit) : [];
      } catch (parseError) {
        // Fallback: extract from response text
        const matches = response.response.match(/["']([^"']+)["']/g);
        return matches ? matches.slice(0, limit).map(m => m.replace(/["']/g, '')) : [];
      }
    } catch (error) {
      console.error('Keyword extraction error:', error);
      throw new Error(`Cloudflare AI keyword extraction failed: ${error.message}`);
    }
  }

  /**
   * Get vector dimensions for this model
   */
  getDimensions() {
    return this.dimensions;
  }

  /**
   * Get supported models (updated from official Cloudflare docs)
   */
  getSupportedModels() {
    return {
      embeddings: [
        '@cf/baai/bge-small-en-v1.5',   // 384 dimensions
        '@cf/baai/bge-base-en-v1.5',    // 768 dimensions
        '@cf/baai/bge-large-en-v1.5',   // 1024 dimensions
        '@cf/baai/bge-m3',              // 1024 dimensions, multi-lingual
        '@cf/google/embed-english-v3'   // 768 dimensions
      ],
      textGeneration: [
        '@cf/meta/llama-2-7b-chat-fp16',
        '@cf/mistral/mistral-7b-instruct-v0.1',
        '@cf/microsoft/DialoGPT-medium'
      ]
    };
  }

  /**
   * Helper: Generate cache key for text
   */
  getCacheKey(text) {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000
    };
  }
}

export { CloudflareAIService };