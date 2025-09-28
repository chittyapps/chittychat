/**
 * ChittyID Translation Layer - Cloudflare Worker
 * Translates between hybrid ID formats using ChittyOS ontology registry
 */

import { MasterEntitySchema, GovernanceRules } from '../master-entity-schema.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (url.pathname === '/translate/technical-to-legal') {
        return await handleTechnicalToLegal(request, env);
      } else if (url.pathname === '/translate/legal-to-technical') {
        return await handleLegalToTechnical(request, env);
      } else if (url.pathname === '/translate/batch') {
        return await handleBatchTranslation(request, env);
      } else if (url.pathname === '/registry/lookup') {
        return await handleRegistryLookup(request, env);
      } else if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          service: 'ChittyID Translation Layer',
          version: '1.0.0',
          timestamp: Date.now()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Translation worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Translate technical ID to legal ID format
 * Technical: AA-C-TSK-1234-I-25-7-X
 * Legal: 01-N-USA-1234-P-25-3-X
 */
async function handleTechnicalToLegal(request, env) {
  const { technical_id, jurisdiction = 'USA', trust_level = 3 } = await request.json();

  if (!technical_id) {
    return jsonError('Missing technical_id parameter', 400);
  }

  // Parse technical ID
  const techComponents = parseTechnicalId(technical_id);
  if (!techComponents.valid) {
    return jsonError('Invalid technical ID format', 400);
  }

  // Look up entity in registry
  const entityKey = `entity:${technical_id}`;
  const entityData = await env.SERVICE_REGISTRY.get(entityKey);

  if (!entityData) {
    return jsonError('Entity not found in registry', 404);
  }

  const entity = JSON.parse(entityData);

  // Generate legal ID using registry data
  const legalId = await generateLegalId({
    technicalId: technical_id,
    entityType: entity.type,
    jurisdiction,
    trustLevel: trust_level,
    sequenceNumber: techComponents.sequence,
    yearMonth: techComponents.yearMonth
  });

  // Store translation mapping
  await storeTranslationMapping(env, {
    technical_id,
    legal_id: legalId,
    entity_type: entity.type,
    jurisdiction,
    trust_level,
    created_at: new Date().toISOString()
  });

  return jsonResponse({
    technical_id,
    legal_id: legalId,
    entity_type: entity.type,
    jurisdiction,
    trust_level,
    translation_rules: {
      sequence_preserved: true,
      year_month_preserved: true,
      checksum_recalculated: true
    }
  });
}

/**
 * Translate legal ID to technical ID format
 */
async function handleLegalToTechnical(request, env) {
  const { legal_id } = await request.json();

  if (!legal_id) {
    return jsonError('Missing legal_id parameter', 400);
  }

  // Look up existing mapping
  const mappingKey = `mapping:legal:${legal_id}`;
  const mappingData = await env.PLATFORM_KV.get(mappingKey);

  if (mappingData) {
    const mapping = JSON.parse(mappingData);
    return jsonResponse({
      legal_id,
      technical_id: mapping.technical_id,
      entity_type: mapping.entity_type,
      source: 'existing_mapping'
    });
  }

  // Parse legal ID to extract components
  const legalComponents = parseLegalId(legal_id);
  if (!legalComponents.valid) {
    return jsonError('Invalid legal ID format', 400);
  }

  // Generate technical ID from legal components
  const technicalId = await generateTechnicalId({
    legalId: legal_id,
    entityType: mapLegalToTechnicalType(legalComponents.entityType),
    sequenceNumber: legalComponents.sequence,
    yearMonth: legalComponents.yearMonth
  });

  return jsonResponse({
    legal_id,
    technical_id: technicalId,
    entity_type: legalComponents.entityType,
    source: 'generated'
  });
}

/**
 * Handle batch translation requests
 */
async function handleBatchTranslation(request, env) {
  const { ids, direction } = await request.json();

  if (!ids || !Array.isArray(ids)) {
    return jsonError('Missing or invalid ids array', 400);
  }

  if (!direction || !['technical-to-legal', 'legal-to-technical'].includes(direction)) {
    return jsonError('Invalid direction. Must be "technical-to-legal" or "legal-to-technical"', 400);
  }

  const results = [];
  const errors = [];

  for (const id of ids) {
    try {
      let result;
      if (direction === 'technical-to-legal') {
        result = await translateTechnicalToLegal(id, env);
      } else {
        result = await translateLegalToTechnical(id, env);
      }
      results.push({ id, result, status: 'success' });
    } catch (error) {
      errors.push({ id, error: error.message, status: 'error' });
    }
  }

  return jsonResponse({
    direction,
    total: ids.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors
  });
}

/**
 * Handle registry lookup requests
 */
async function handleRegistryLookup(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'entity';

  if (!id) {
    return jsonError('Missing id parameter', 400);
  }

  let key;
  switch (type) {
    case 'entity':
      key = `entity:${id}`;
      break;
    case 'mapping':
      key = `mapping:${id}`;
      break;
    case 'namespace':
      key = `namespace:${id}`;
      break;
    default:
      return jsonError('Invalid type. Must be entity, mapping, or namespace', 400);
  }

  const data = await env.SERVICE_REGISTRY.get(key);

  if (!data) {
    return jsonError('Not found in registry', 404);
  }

  return jsonResponse({
    key,
    data: JSON.parse(data),
    timestamp: Date.now()
  });
}

/**
 * Parse technical ID format: AA-C-TSK-1234-I-25-7-X
 */
function parseTechnicalId(technicalId) {
  const pattern = GovernanceRules.technical_id.format;
  const match = technicalId.match(pattern);

  if (!match) {
    return { valid: false };
  }

  const parts = technicalId.split('-');
  return {
    valid: true,
    version: parts[0],
    domain: parts[1],
    namespace: parts[2],
    sequence: parts[3],
    type: parts[4],
    yearMonth: parts[5],
    component: parts[6],
    checksum: parts[7]
  };
}

/**
 * Parse legal ID format: 01-N-USA-1234-P-25-3-X
 */
function parseLegalId(legalId) {
  const pattern = GovernanceRules.legal_id.format;
  const match = legalId.match(pattern);

  if (!match) {
    return { valid: false };
  }

  const parts = legalId.split('-');
  return {
    valid: true,
    version: parts[0],
    region: parts[1],
    jurisdiction: parts[2],
    sequence: parts[3],
    entityType: parts[4],
    yearMonth: parts[5],
    trustLevel: parts[6],
    checksum: parts[7]
  };
}

/**
 * Generate legal ID from technical components
 */
async function generateLegalId({ technicalId, entityType, jurisdiction, trustLevel, sequenceNumber, yearMonth }) {
  const version = '01';
  const region = getRegionForJurisdiction(jurisdiction);
  const legalEntityType = mapTechnicalToLegalType(entityType);

  // Use crypto.randomInt for sequence as specified in research
  const sequence = sequenceNumber || crypto.randomInt(1000, 9999).toString().padStart(4, '0');

  const baseId = `${version}-${region}-${jurisdiction}-${sequence}-${legalEntityType}-${yearMonth}-${trustLevel}`;

  // Calculate checksum (simplified for demonstration)
  const checksum = calculateChecksum(baseId);

  return `${baseId}-${checksum}`;
}

/**
 * Generate technical ID from legal components
 */
async function generateTechnicalId({ legalId, entityType, sequenceNumber, yearMonth }) {
  const version = 'AA';
  const domain = 'C'; // Central
  const namespace = mapEntityTypeToNamespace(entityType);
  const type = 'I'; // Individual
  const component = '7'; // Version 7 as per research

  // Use crypto.randomInt for sequence as specified in research
  const sequence = sequenceNumber || crypto.randomInt(1000, 9999).toString().padStart(4, '0');

  const baseId = `${version}-${domain}-${namespace}-${sequence}-${type}-${yearMonth}-${component}`;

  // Calculate checksum
  const checksum = calculateChecksum(baseId);

  return `${baseId}-${checksum}`;
}

/**
 * Store translation mapping in KV
 */
async function storeTranslationMapping(env, mapping) {
  const techKey = `mapping:technical:${mapping.technical_id}`;
  const legalKey = `mapping:legal:${mapping.legal_id}`;

  await Promise.all([
    env.PLATFORM_KV.put(techKey, JSON.stringify(mapping)),
    env.PLATFORM_KV.put(legalKey, JSON.stringify(mapping))
  ]);
}

/**
 * Map jurisdiction to region code
 */
function getRegionForJurisdiction(jurisdiction) {
  const regionMap = {
    'USA': 'N', // North America
    'CAN': 'N',
    'GBR': 'E', // Europe
    'DEU': 'E',
    'FRA': 'E',
    'JPN': 'A', // Asia
    'CHN': 'A',
    'AUS': 'P', // Pacific
    'NZL': 'P'
  };

  return regionMap[jurisdiction] || 'N';
}

/**
 * Map technical entity type to legal entity type
 */
function mapTechnicalToLegalType(techType) {
  const typeMap = {
    'I': 'P', // Individual -> Person
    'D': 'T', // Document -> Thing
    'C': 'E', // Claim -> Event
    'E': 'T', // Evidence -> Thing
    'L': 'T'  // Ledger -> Thing
  };

  return typeMap[techType] || 'T';
}

/**
 * Map legal entity type to technical type
 */
function mapLegalToTechnicalType(legalType) {
  const typeMap = {
    'P': 'I', // Person -> Individual
    'L': 'D', // Location -> Document
    'T': 'D', // Thing -> Document
    'E': 'C'  // Event -> Claim
  };

  return typeMap[legalType] || 'I';
}

/**
 * Map entity type to namespace
 */
function mapEntityTypeToNamespace(entityType) {
  const namespaceMap = {
    'person': 'USR',
    'document': 'DOC',
    'property': 'PRP',
    'evidence': 'EVD',
    'todo': 'TSK'
  };

  return namespaceMap[entityType] || 'DOC';
}

/**
 * Calculate simple checksum (to be replaced with proper cryptographic checksum)
 */
function calculateChecksum(baseId) {
  let sum = 0;
  for (let i = 0; i < baseId.length; i++) {
    sum += baseId.charCodeAt(i);
  }
  return (sum % 36).toString(36).toUpperCase();
}

/**
 * Helper functions
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// Helper functions for batch operations
async function translateTechnicalToLegal(technicalId, env) {
  // Implementation details would mirror handleTechnicalToLegal
  // but return just the result object
}

async function translateLegalToTechnical(legalId, env) {
  // Implementation details would mirror handleLegalToTechnical
  // but return just the result object
}