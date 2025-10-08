/**
 * ChittyID Validation Cache
 * In-memory LRU cache for ChittyID validation results
 * Reduces load on central service and improves response time
 */

/**
 * LRU Cache for ChittyID validation results
 */
export class ChittyIDCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.ttlMs = options.ttlMs || 300000; // 5 minutes default
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  /**
   * Get validation result from cache
   * @param {string} chittyId - ChittyID to lookup
   * @returns {boolean|null} - Validation result or null if not cached/expired
   */
  get(chittyId) {
    const entry = this.cache.get(chittyId);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(chittyId);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Cache hit - move to end (LRU)
    this.cache.delete(chittyId);
    this.cache.set(chittyId, entry);
    this.stats.hits++;

    return entry.isValid;
  }

  /**
   * Set validation result in cache
   * @param {string} chittyId - ChittyID
   * @param {boolean} isValid - Validation result
   */
  set(chittyId, isValid) {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(chittyId, {
      isValid,
      timestamp: Date.now(),
    });

    this.stats.sets++;
  }

  /**
   * Check if a ChittyID is in cache
   * @param {string} chittyId - ChittyID to check
   * @returns {boolean} - True if cached
   */
  has(chittyId) {
    const entry = this.cache.get(chittyId);
    if (!entry) return false;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(chittyId);
      this.stats.evictions++;
      return false;
    }

    return true;
  }

  /**
   * Invalidate a specific ChittyID
   * @param {string} chittyId - ChittyID to invalidate
   */
  invalidate(chittyId) {
    this.cache.delete(chittyId);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    console.info("ChittyID cache cleared", {
      previousSize: this.cache.size,
      stats: this.getStats(),
    });

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  /**
   * Get cache size
   * @returns {number} - Number of cached entries
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0
        ? ((this.stats.hits / totalRequests) * 100).toFixed(2)
        : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hitRate: `${hitRate}%`,
      totalRequests,
    };
  }

  /**
   * Perform cache maintenance (remove expired entries)
   * @returns {number} - Number of entries removed
   */
  maintain() {
    const now = Date.now();
    let removed = 0;

    for (const [chittyId, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.ttlMs) {
        this.cache.delete(chittyId);
        removed++;
      }
    }

    if (removed > 0) {
      this.stats.evictions += removed;
      console.info(
        `ChittyID cache maintenance: removed ${removed} expired entries`,
      );
    }

    return removed;
  }

  /**
   * Get all cached ChittyIDs (for debugging)
   * @returns {Array<string>} - Array of cached ChittyIDs
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache configuration
   * @returns {Object} - Cache configuration
   */
  getConfig() {
    return {
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      ttlMinutes: (this.ttlMs / 60000).toFixed(1),
    };
  }
}

// Shared cache instance
let sharedCache;

/**
 * Get or create shared cache instance
 * @param {Object} options - Cache options
 * @returns {ChittyIDCache} - Shared cache instance
 */
export function getSharedCache(options = {}) {
  if (!sharedCache) {
    sharedCache = new ChittyIDCache(options);

    // Schedule periodic maintenance (every 5 minutes)
    if (typeof setInterval !== "undefined") {
      setInterval(() => {
        sharedCache.maintain();
      }, 300000);
    }
  }

  return sharedCache;
}

/**
 * Clear the shared cache instance
 */
export function clearSharedCache() {
  if (sharedCache) {
    sharedCache.clear();
  }
}
