/**
 * Shared cache utilities for ChittyOS Workers
 */

/**
 * Prefix key with optional namespace
 */
export function withNamespace(key, namespace) {
  return namespace && typeof namespace === "string" && namespace.length > 0
    ? `${namespace}:${key}`
    : key;
}

/**
 * Create a KV-backed cache with namespacing, TTL and safe delete semantics.
 * - get(key, namespace?) with fallback to non-namespaced key
 * - set(key, value, namespaceOrTtl?, ttl?) where null/undefined deletes
 * - put(key, value, options?) passthrough
 * - delete(key, namespace?)
 */
export function createKVCache(kv) {
  return {
    async get(key, namespace) {
      const k = withNamespace(key, namespace);
      const value = await kv?.get(k);
      if (value == null && namespace) {
        return kv?.get(key);
      }
      return value;
    },
    async put(key, value, options) {
      return kv?.put(key, value, options);
    },
    async delete(key, namespace) {
      const k = withNamespace(key, namespace);
      return kv?.delete?.(k);
    },
    async set(key, value, namespaceOrTtl, ttl) {
      let namespace;
      let expirationTtl;
      if (typeof namespaceOrTtl === "number") {
        expirationTtl = namespaceOrTtl;
      } else {
        namespace = namespaceOrTtl;
        if (typeof ttl === "number") expirationTtl = ttl;
      }
      const k = withNamespace(key, namespace);
      if (value == null) return kv?.delete?.(k);
      const options = expirationTtl ? { expirationTtl } : undefined;
      return kv?.put(k, value, options);
    },
  };
}

/**
 * Create a composite cache that routes by namespace prefix to different stores.
 * Expects stores: { cache, memory, metrics } with get/put/delete.
 */
export function createCompositeCache(stores) {
  const pick = (namespace) => {
    if (
      namespace?.startsWith("session:") ||
      namespace?.startsWith("auth:") ||
      namespace?.startsWith("api:")
    ) {
      return stores.cache;
    }
    if (
      namespace?.startsWith("agent:") ||
      namespace?.startsWith("memory:") ||
      namespace?.startsWith("vector:")
    ) {
      return stores.memory || stores.cache;
    }
    if (namespace?.startsWith("metric:") || namespace?.startsWith("beacon:")) {
      return stores.metrics || stores.cache;
    }
    return stores.cache;
  };

  return {
    async get(key, namespace = "default") {
      const store = pick(namespace);
      const k = withNamespace(key, namespace);
      const value = await store?.get(k);
      if (value == null && namespace) {
        // Fallback to non-namespaced
        return store?.get(key);
      }
      return value;
    },
    async set(key, value, namespace = "default", ttl = 3600) {
      const store = pick(namespace);
      const k = withNamespace(key, namespace);
      if (value == null) {
        return store?.delete?.(k);
      }
      return store?.put(k, value, { expirationTtl: ttl });
    },
    async delete(key, namespace = "default") {
      const store = pick(namespace);
      const k = withNamespace(key, namespace);
      return store?.delete?.(k);
    },
    async put(key, value, options) {
      // Default to primary cache
      return stores.cache?.put(key, value, options);
    },
  };
}

