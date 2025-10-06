/**
 * ChittyID Service Helper
 * Official ChittyID generation following the ChittyOS standard
 * PIPELINE ONLY - NEVER generates locally - ALWAYS uses id.chitty.cc service
 * Format: VV-G-LLL-SSSS-T-YM-C-X ONLY - NEVER any other format
 */

import ChittyIDClient from "@chittyos/chittyid-client";

const DEFAULT_SERVICE_URL = "https://id.chitty.cc/v1";
let sharedClient;

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
 * @param {string} entityType - Entity type (PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR)
 * @param {object} metadata - Optional metadata
 * @param {string} apiKey - ChittyID API key
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

  try {
    const client = getSharedClient(options);
    return await client.mint({
      entity,
      metadata,
    });
  } catch (error) {
    throw new Error(
      `ChittyID generation failed: ${error.message}. Service must be available.`,
    );
  }
}

/**
 * Validate a ChittyID format
 * @param {string} chittyId - ChittyID to validate
 * @returns {boolean} - True if valid format
 */
export function validateChittyIDFormat(chittyId) {
  if (!chittyId || typeof chittyId !== "string") {
    return false;
  }

  const client = getSharedClient();
  return client.validateFormat(chittyId);
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
