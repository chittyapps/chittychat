/**
 * ChittyID Service Helper
 * Official ChittyID generation following the ChittyOS standard
 * PIPELINE ONLY - NEVER generates locally - ALWAYS uses id.chitty.cc service
 * Format: VV-G-LLL-SSSS-T-YM-C-X ONLY - NEVER any other format
 *
 * Enhanced with:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 * - Validation result caching for performance
 */

import ChittyIDClient from "@chittyos/chittyid-client";
import { withResilience, getCircuitBreaker } from "./chittyid-resilience.js";
import { getSharedCache } from "./chittyid-cache.js";

const DEFAULT_SERVICE_URL = "https://id.chitty.cc/v1";
let sharedClient;
let resilienceEnabled = true; // Can be disabled for testing

function readEnv(key) {
  if (typeof process !== "undefined" && process?.env?.[key]) {
    return process.env[key];
  }
  return undefined;
}

function normalizeServiceUrl(urlLike) {
  if (!urlLike) {
    return DEFAULT_SERVICE_URL;
  }
  const trimmed = urlLike.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/v1`;
  }
  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

function resolveServiceUrl() {
  const envUrl = readEnv("CHITTYID_SERVICE_URL");
  return normalizeServiceUrl(envUrl || DEFAULT_SERVICE_URL);
}

function getSharedClient(options = {}) {
  if (typeof options === "string") {
    options = { apiKey: options };
  }

  const { apiKey, serviceUrl } = options;

  if (apiKey || serviceUrl) {
    return new ChittyIDClient({
      serviceUrl: normalizeServiceUrl(serviceUrl || resolveServiceUrl()),
      apiKey: apiKey ?? readEnv("CHITTY_ID_TOKEN"),
    });
  }

  if (!sharedClient) {
    sharedClient = new ChittyIDClient({
      serviceUrl: resolveServiceUrl(),
      apiKey: readEnv("CHITTY_ID_TOKEN"),
    });
  }

  return sharedClient;
}

// STRICT: No local generation allowed - service or fail

/**
 * Generate a ChittyID from the official service
 * Enhanced with retry logic and circuit breaker
 * @param {string} entityType - Entity type (PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR)
 * @param {object} metadata - Optional metadata
 * @param {object} options - Options (apiKey, serviceUrl, resilience)
 * @returns {Promise<string>} - ChittyID in format VV-G-LLL-SSSS-T-YM-C-X
 */
export async function generateChittyID(
  entityType,
  metadata = {},
  options = {},
) {
  const entity = entityType?.toString().toUpperCase();
  if (!entity || !ENTITY_TYPES[entity]) {
    throw new Error(
      `Unsupported ChittyID entity type: ${entityType}. ` +
        "Use one of PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR.",
    );
  }

  const mintFn = async () => {
    const client = getSharedClient(options);
    return await client.mint({
      entity,
      metadata,
    });
  };

  try {
    // Use resilience features unless explicitly disabled
    if (resilienceEnabled && options.resilience !== false) {
      return await withResilience(mintFn, options.resilienceConfig);
    } else {
      return await mintFn();
    }
  } catch (error) {
    throw new Error(
      `ChittyID generation failed: ${error.message}. Service must be available.`,
    );
  }
}

/**
 * Validate a ChittyID format
 * Enhanced with caching for improved performance
 * @param {string} chittyId - ChittyID to validate
 * @param {object} options - Options (useCache)
 * @returns {boolean} - True if valid format
 */
export function validateChittyIDFormat(chittyId, options = {}) {
  if (!chittyId || typeof chittyId !== "string") {
    return false;
  }

  // Check cache first unless explicitly disabled
  const useCache = options.useCache !== false;
  if (useCache) {
    const cache = getSharedCache();
    const cachedResult = cache.get(chittyId);

    if (cachedResult !== null) {
      return cachedResult;
    }
  }

  // Validate using client
  const client = getSharedClient();
  const isValid = client.validateFormat(chittyId);

  // Cache result
  if (useCache) {
    const cache = getSharedCache();
    cache.set(chittyId, isValid);
  }

  return isValid;
}

/**
 * Extract entity type from ChittyID
 * @param {string} chittyId - ChittyID
 * @returns {string|null} - Entity type or null if invalid
 */
export function extractEntityType(chittyId) {
  if (!validateChittyIDFormat(chittyId)) {
    return null;
  }

  const parts = chittyId.split("-");
  return parts[4]; // Type is the 5th part (T in VV-G-LLL-SSSS-T-YM-C-X);
}

/**
 * Check if a string is a ChittyID
 * @param {string} id - ID to check
 * @returns {boolean} - True if it's a ChittyID
 */
export function isChittyID(id) {
  return validateChittyIDFormat(id);
}

// Entity types supported by ChittyID
export const ENTITY_TYPES = {
  PEO: "PEO", // Person
  PLACE: "PLACE", // Location
  PROP: "PROP", // Property/Asset
  EVNT: "EVNT", // Event
  AUTH: "AUTH", // Authorization
  INFO: "INFO", // Information
  FACT: "FACT", // Fact/Evidence
  CONTEXT: "CONTEXT", // Context
  ACTOR: "ACTOR", // Actor/Agent
};

/**
 * Get circuit breaker status
 * @returns {object} - Circuit breaker state
 */
export function getCircuitBreakerStatus() {
  const circuitBreaker = getCircuitBreaker();
  return circuitBreaker.getState();
}

/**
 * Get cache statistics
 * @returns {object} - Cache statistics
 */
export function getCacheStats() {
  const cache = getSharedCache();
  return cache.getStats();
}

/**
 * Clear validation cache
 */
export function clearCache() {
  const cache = getSharedCache();
  cache.clear();
}

/**
 * Reset circuit breaker
 */
export function resetCircuitBreaker() {
  const circuitBreaker = getCircuitBreaker();
  circuitBreaker.reset();
}

/**
 * Enable or disable resilience features
 * @param {boolean} enabled - Enable/disable
 */
export function setResilienceEnabled(enabled) {
  resilienceEnabled = enabled;
}

/**
 * Get ChittyID service health status
 * @returns {object} - Health status including resilience metrics
 */
export function getServiceHealth() {
  return {
    service: "chittyid-service",
    resilience: {
      enabled: resilienceEnabled,
      circuitBreaker: getCircuitBreakerStatus(),
      cache: getCacheStats(),
    },
    format: "VV-G-LLL-SSSS-T-YM-C-X",
    entityTypes: Object.keys(ENTITY_TYPES),
    mode: "pipeline-only",
  };
}
