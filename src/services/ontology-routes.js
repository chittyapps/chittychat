/**
 * Ontology API Routes
 * Public classification and entity discovery endpoints
 */

import { OntologyController } from './ontology-controller.js';

/**
 * Handle ontology API requests
 */
export async function handleOntologyRequest(request, env) {
  const url = new URL(request.url);
  const controller = new OntologyController(env);

  // Extract path after /api/ontology
  const path = url.pathname.replace('/api/ontology', '');

  try {
    // POST /api/ontology/classify - Classify entity
    if (path === '/classify' && request.method === 'POST') {
      const { entity, path: entityPath } = await request.json();
      const classification = await controller.discoverEntityClassification(
        entity || entityPath
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: classification,
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // GET /api/ontology/classify?entity=... - Classify entity (GET)
    if (path === '/classify' && request.method === 'GET') {
      const entity = url.searchParams.get('entity');
      if (!entity) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing entity parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const classification = await controller.discoverEntityClassification(entity);

      return new Response(
        JSON.stringify({
          success: true,
          data: classification,
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // GET /api/ontology/types - List valid entity types
    if (path === '/types' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            types: [
              {
                id: 'services',
                category: 'infrastructure',
                description: 'ChittyOS services with KV/R2/DO presence',
                precedence: 1,
                source: 'registry',
              },
              {
                id: 'domains',
                category: 'infrastructure',
                description: 'Web properties from registry',
                precedence: 1,
                source: 'registry',
              },
              {
                id: 'infrastructure',
                category: 'infrastructure',
                description: 'Workers, durable objects, system components',
                precedence: 1,
                source: 'registry',
              },
              {
                id: 'legal_data',
                category: 'compliance',
                description: 'Legal documents, compliance data (arias*, legal*)',
                precedence: 2,
                source: 'pattern_detection',
              },
              {
                id: 'version_control',
                category: 'infrastructure',
                description: 'Git repositories and version control',
                precedence: 3,
                source: 'pattern_detection',
              },
              {
                id: 'unstructured_data',
                category: 'general',
                description: 'Default classification for unknown entities',
                precedence: 4,
                source: 'default',
              },
            ],
            classification_order: [
              '1. Registry entities (highest precedence)',
              '2. Legal patterns (arias*, legal*)',
              '3. Version control (.git)',
              '4. Unstructured data (lowest precedence)',
            ],
          },
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // GET /api/ontology/lookup?id=... - Lookup ID mapping
    if (path === '/lookup' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing id parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const mapping = await controller.lookupHybridMapping(id);

      if (!mapping) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'ID not found in registry',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: mapping,
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // POST /api/ontology/batch-classify - Batch classify multiple entities
    if (path === '/batch-classify' && request.method === 'POST') {
      const { entities } = await request.json();

      if (!Array.isArray(entities) || entities.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'entities must be a non-empty array',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Classify all entities in parallel
      const classifications = await Promise.all(
        entities.map(async (entity) => ({
          entity,
          classification: await controller.discoverEntityClassification(entity),
        }))
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total: entities.length,
            classifications,
          },
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // GET /api/ontology/health - Health check
    if (path === '/health' && request.method === 'GET') {
      const health = await controller.healthCheck();

      return new Response(
        JSON.stringify({
          success: true,
          data: health,
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // GET /api/ontology - API documentation
    if (path === '' || path === '/' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          service: 'ChittyOS Ontology API',
          version: '1.0.0',
          description:
            'Entity classification and discovery using ChittyOS ontology rules',
          endpoints: {
            'POST /api/ontology/classify': 'Classify a single entity',
            'GET /api/ontology/classify?entity=...': 'Classify entity (GET)',
            'POST /api/ontology/batch-classify': 'Classify multiple entities',
            'GET /api/ontology/types': 'List valid entity types',
            'GET /api/ontology/lookup?id=...': 'Lookup ID mapping',
            'GET /api/ontology/health': 'Health check',
          },
          documentation: 'https://gateway.chitty.cc/docs',
          ontology_rules: [
            '1. Registry entities (highest precedence)',
            '2. Legal patterns (arias*, legal*)',
            '3. Version control (.git)',
            '4. Unstructured data (default)',
          ],
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Not found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'POST /api/ontology/classify',
          'GET /api/ontology/classify?entity=...',
          'POST /api/ontology/batch-classify',
          'GET /api/ontology/types',
          'GET /api/ontology/lookup?id=...',
          'GET /api/ontology/health',
        ],
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Ontology API error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
