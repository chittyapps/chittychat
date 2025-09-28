/**
 * Real AI Embedding Service
 * Production implementation using OpenAI's embedding API
 */

import OpenAI from 'openai';

export class RealEmbeddingService {
  constructor(config = {}) {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY || process.env.OPENAI_API_KEY
    });
    this.model = config.embeddingModel || 'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536;
    this.cache = new Map(); // Simple cache for repeated embeddings
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.substring(0, 8000), // Limit to 8k characters
        dimensions: this.dimensions
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      this.cache.set(cacheKey, embedding);

      // Limit cache size
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Real OpenAI API required - no mock data allowed: ${error.message}`);
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

    // Process in batches of 10 to respect rate limits
    const batchSize = 10;
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
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Find most similar texts from a collection
   */
  async findSimilarTexts(queryText, textCollection, limit = 5) {
    const queryEmbedding = await this.generateEmbedding(queryText);

    const similarities = await Promise.all(
      textCollection.map(async (item, index) => {
        const text = typeof item === 'string' ? item : item.text;
        const embedding = await this.generateEmbedding(text);
        const similarity = this.calculateSimilarity(queryEmbedding, embedding);

        return {
          index,
          item,
          similarity,
          text
        };
      })
    );

    // Sort by similarity (highest first) and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Generate semantic keywords from text
   */
  async extractSemanticKeywords(text, limit = 10) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract the most important semantic keywords from the given text. Return only the keywords separated by commas, no other text.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      const keywords = response.choices[0].message.content
        .split(',')
        .map(keyword => keyword.trim().toLowerCase())
        .filter(keyword => keyword.length > 2)
        .slice(0, limit);

      return keywords;
    } catch (error) {
      console.error('Keyword extraction error:', error);
      // Fallback to simple word extraction
      throw new Error('Simple keyword extraction disabled - real OpenAI API required to prevent data contamination');
    }
  }

  /**
   * Validate the embedding service connection
   */
  async validateConnection() {
    try {
      const testEmbedding = await this.generateEmbedding('test connection');
      return {
        connected: true,
        model: this.model,
        dimensions: testEmbedding.length,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      hits: this.cacheHits || 0,
      misses: this.cacheMisses || 0
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
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
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * REMOVED: No mock embeddings allowed - system must fail cleanly
   */
  generateMockEmbedding(text) {
    throw new Error('Mock embeddings disabled - real OpenAI API required to prevent data contamination');
  }

  /**
   * REMOVED: Simple keyword extraction disabled - prevents data contamination
   */
  extractSimpleKeywords(text, limit) {
    throw new Error('Simple keyword extraction disabled - real OpenAI API required to prevent data contamination');
  }

  /**
   * Helper: Seeded random number generator
   */
  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1664525 + 1013904223) % 2**32;
      return state / 2**32;
    };
  }

  /**
   * Helper: Common stop words
   */
  getStopWords() {
    return [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
      'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where', 'why',
      'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
    ];
  }
}

// Create singleton instance
let embeddingService = null;

export function getEmbeddingService(config = {}) {
  if (!embeddingService) {
    embeddingService = new RealEmbeddingService(config);
  }
  return embeddingService;
}

export default RealEmbeddingService;