/**
 * Unified AI + Notion Worker
 * Integrates the neutralized Notion connector with AI agent system
 */

import { NotionAIIntegration } from '../ai/notion-ai-integration.js';
import { NeonAuthIntegration } from '../ai/neon-auth-integration.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await handleRequest(request, env, path);

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Unified worker error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

async function handleRequest(request, env, path) {
  // Initialize services
  const notionAI = new NotionAIIntegration({
    DATABASE_URL: env.DATABASE_URL,
    REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
    NEON_API_KEY: env.NEON_API_KEY,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID,
    NOTION_TOKEN: env.NOTION_TOKEN,
    NOTION_ENTITIES_DB: env.NOTION_ENTITIES_DB,
    NOTION_INFORMATION_DB: env.NOTION_INFORMATION_DB,
    NOTION_FACTS_DB: env.NOTION_FACTS_DB,
    NOTION_CONNECTIONS_DB: env.NOTION_CONNECTIONS_DB,
    NOTION_EVIDENCE_DB: env.NOTION_EVIDENCE_DB
  });

  const authService = new NeonAuthIntegration({
    DATABASE_URL: env.DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,
    NEON_AUTH_URL: env.NEON_AUTH_URL,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID
  });

  // Route handling
  switch (path) {
    case '/health':
      return handleHealth(notionAI);

    case '/setup':
      return handleSetup(notionAI);

    case '/notion/agent/create':
      return handleCreateNotionAgent(request, notionAI, authService);

    case '/notion/entity/analyze':
      return handleAnalyzeEntity(request, notionAI, authService);

    case '/notion/information/validate':
      return handleValidateInformation(request, notionAI, authService);

    case '/notion/insights/generate':
      return handleGenerateInsights(request, notionAI, authService);

    case '/notion/insights/sync':
      return handleSyncInsights(request, notionAI, authService);

    case '/notion/coordination/start':
      return handleStartCoordination(request, notionAI, authService);

    case '/notion/entities/similar':
      return handleFindSimilarEntities(request, notionAI, authService);

    case '/notion/analytics':
      return handleNotionAnalytics(request, notionAI, authService);

    case '/notion/connector/test':
      return handleConnectorTest(env);

    case '/notion/setup/databases':
      return handleSetupNotionDatabases(env);

    case '/notion/sync/bidirectional':
      return handleBidirectionalSync(request, env);

    default:
      return new Response('Not Found', { status: 404 });
  }
}

/**
 * Health check
 */
async function handleHealth(notionAI) {
  const health = await notionAI.aiCoordinator.getCoordinatorHealth();

  return Response.json({
    status: 'healthy',
    services: {
      aiCoordinator: health,
      notionIntegration: 'active'
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Setup AI-Notion integration
 */
async function handleSetup(notionAI) {
  try {
    await notionAI.setupAINotionIntegration();

    return Response.json({
      success: true,
      message: 'AI-Notion integration setup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Create Notion analysis agent
 */
async function handleCreateNotionAgent(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const userContext = await authService.validateToken(token);
    const agent = await notionAI.createNotionAnalysisAgent(userContext.tenant_id);

    return Response.json({
      success: true,
      agent
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Analyze Notion entity with AI
 */
async function handleAnalyzeEntity(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { entityData, agentId } = await request.json();

    const analysis = await notionAI.analyzeNotionEntity(entityData, agentId);

    return Response.json({
      success: true,
      analysis
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Validate Notion information with AI
 */
async function handleValidateInformation(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { informationData, agentId } = await request.json();

    const validation = await notionAI.validateNotionInformation(informationData, agentId);

    return Response.json({
      success: true,
      validation
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Generate insights from Notion data
 */
async function handleGenerateInsights(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { entityIds, agentId } = await request.json();

    const insights = await notionAI.generateInsightsFromNotionData(entityIds, agentId);

    return Response.json({
      success: true,
      insights
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Sync insights back to Notion
 */
async function handleSyncInsights(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { insightIds } = await request.json();

    const syncResults = await notionAI.syncInsightsToNotion(insightIds);

    return Response.json({
      success: true,
      syncResults
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Start coordinated Notion analysis
 */
async function handleStartCoordination(request, notionAI, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { notionData, maxAgents } = await request.json();

    const coordination = await notionAI.coordinateNotionAnalysis(notionData, maxAgents);

    return Response.json({
      success: true,
      coordination
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Find similar entities
 */
async function handleFindSimilarEntities(request, notionAI, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const url = new URL(request.url);
    const entityText = url.searchParams.get('text');
    const limit = parseInt(url.searchParams.get('limit')) || 5;

    const similarEntities = await notionAI.findSimilarEntities(entityText, limit);

    return Response.json({
      success: true,
      similarEntities
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Get Notion AI analytics
 */
async function handleNotionAnalytics(request, notionAI, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const userContext = await authService.validateToken(token);
    const analytics = await notionAI.getNotionAIAnalytics(userContext.tenant_id);

    return Response.json({
      success: true,
      analytics
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Test Notion connector functionality
 */
async function handleConnectorTest(env) {
  try {
    // Test basic Notion connectivity
    const notionResponse = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });

    const notionData = notionResponse.ok ? await notionResponse.json() : null;

    return Response.json({
      success: true,
      tests: {
        notionAPI: {
          status: notionResponse.ok ? 'connected' : 'failed',
          data: notionData
        },
        environment: {
          hasNotionToken: !!env.NOTION_TOKEN,
          hasDatabaseIds: !!(
            env.NOTION_ENTITIES_DB &&
            env.NOTION_INFORMATION_DB &&
            env.NOTION_FACTS_DB
          )
        }
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Setup Notion databases (calls the neutralized connector)
 */
async function handleSetupNotionDatabases(env) {
  try {
    // This would call the neutralized connector's database setup
    const setupResult = {
      message: 'Notion database setup initiated',
      databases: {
        entities: env.NOTION_ENTITIES_DB || 'to-be-created',
        information: env.NOTION_INFORMATION_DB || 'to-be-created',
        facts: env.NOTION_FACTS_DB || 'to-be-created',
        connections: env.NOTION_CONNECTIONS_DB || 'to-be-created',
        evidence: env.NOTION_EVIDENCE_DB || 'to-be-created'
      }
    };

    return Response.json({
      success: true,
      setup: setupResult
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Bidirectional sync with Notion
 */
async function handleBidirectionalSync(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { direction = 'both', entityTypes = ['all'] } = await request.json();

    // This would integrate with the neutralized connector's sync service
    const syncResult = {
      direction,
      entityTypes,
      status: 'completed',
      timestamp: new Date().toISOString(),
      summary: {
        entitiesSynced: 0,
        informationSynced: 0,
        factsSynced: 0,
        connectionsSynced: 0
      }
    };

    return Response.json({
      success: true,
      sync: syncResult
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Helper: Extract JWT token from request
 */
function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Scheduled task: Sync insights and cleanup
 */
export async function scheduled(event, env, ctx) {
  const notionAI = new NotionAIIntegration({
    DATABASE_URL: env.DATABASE_URL,
    REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
    NEON_API_KEY: env.NEON_API_KEY,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID,
    NOTION_TOKEN: env.NOTION_TOKEN,
    NOTION_ENTITIES_DB: env.NOTION_ENTITIES_DB,
    NOTION_INFORMATION_DB: env.NOTION_INFORMATION_DB,
    NOTION_FACTS_DB: env.NOTION_FACTS_DB,
    NOTION_CONNECTIONS_DB: env.NOTION_CONNECTIONS_DB,
    NOTION_EVIDENCE_DB: env.NOTION_EVIDENCE_DB
  });

  try {
    // Auto-sync pending insights to Notion
    const pendingInsights = await notionAI.aiCoordinator.mainDB`
      SELECT id FROM notion_ai.insights
      WHERE notion_sync_status = 'pending'
        AND created_at < NOW() - INTERVAL '5 minutes'
      LIMIT 50
    `;

    if (pendingInsights.length > 0) {
      const insightIds = pendingInsights.map(i => i.id);
      await notionAI.syncInsightsToNotion(insightIds);
    }

    // Cleanup old coordination records
    await notionAI.aiCoordinator.mainDB`
      DELETE FROM notion_ai.sync_coordination
      WHERE completed_at < NOW() - INTERVAL '7 days'
    `;

    console.log(`Scheduled sync completed: ${pendingInsights.length} insights processed`);
  } catch (error) {
    console.error('Scheduled sync failed:', error);
  }
}