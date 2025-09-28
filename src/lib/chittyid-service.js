/**
 * ChittyID Service Helper
 * Official ChittyID generation following the ChittyOS standard
 * NEVER generates locally - always uses id.chitty.cc service
 */

const CHITTYID_SERVICE_URL = "https://id.chitty.cc/v1/mint";

/**
 * Generate a ChittyID from the official service
 * @param {string} entityType - Entity type (PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR)
 * @param {object} metadata - Optional metadata
 * @param {string} apiKey - ChittyID API key
 * @returns {Promise<string>} - ChittyID in format CHITTY-ENTITY-SEQUENCE-CHECKSUM
 */
export async function generateChittyID(
  entityType,
  metadata = {},
  apiKey = null,
) {
  // Use environment variable if no API key provided
  const token = apiKey || process.env.CHITTY_ID_TOKEN;

  if (!token) {
    throw new Error(
      "ChittyID API token required. Set CHITTY_ID_TOKEN environment variable.",
    );
  }

  try {
    const response = await fetch(CHITTYID_SERVICE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityType: entityType.toUpperCase(),
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `ChittyID service error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    return result.chittyId;
  } catch (error) {
    // In case of service failure, throw error - NEVER fallback to local generation
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

  // ChittyID format: CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}
  const pattern = /^CHITTY-[A-Z]+-\d+-[A-Z0-9]+$/;
  return pattern.test(chittyId);
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
  return parts[1]; // Entity type is second part
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
