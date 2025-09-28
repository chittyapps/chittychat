/**
 * ChittyChat AI Agent Provisioning Worker
 * Cloudflare Worker for managing AI agents with Neon integration
 */

import { NeonAICoordinator } from '../ai/neon-ai-coordinator.js';
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
      console.error('Worker error:', error);
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
  const aiCoordinator = new NeonAICoordinator({
    DATABASE_URL: env.DATABASE_URL,
    REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
    NEON_API_KEY: env.NEON_API_KEY,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID
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
      return handleHealth(aiCoordinator, authService);

    case '/auth/register':
      return handleAuthRegister(request, authService);

    case '/auth/login':
      return handleAuthLogin(request, authService);

    case '/auth/validate':
      return handleAuthValidate(request, authService);

    case '/agents/provision':
      return handleAgentProvision(request, aiCoordinator, authService);

    case '/agents/list':
      return handleAgentsList(request, authService);

    case '/agents/coordinate':
      return handleAgentCoordination(request, aiCoordinator, authService);

    case '/agents/sessions':
      return handleAgentSessions(request, aiCoordinator, authService);

    case '/sync/topic':
      return handleTopicSync(request, aiCoordinator, authService);

    case '/analytics/usage':
      return handleUsageAnalytics(request, authService);

    case '/setup/initialize':
      return handleInitializeSetup(aiCoordinator, authService);

    default:
      return new Response('Not Found', { status: 404 });
  }
}

/**
 * Health check endpoint
 */
async function handleHealth(aiCoordinator, authService) {
  const [coordinatorHealth, authHealth] = await Promise.all([
    aiCoordinator.getCoordinatorHealth(),
    authService.getAuthHealth()
  ]);

  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      aiCoordinator: coordinatorHealth,
      authentication: authHealth
    }
  });
}

/**
 * User registration
 */
async function handleAuthRegister(request, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { email, password, tenantName } = await request.json();

  if (!email || !password || !tenantName) {
    return new Response('Missing required fields', { status: 400 });
  }

  try {
    const result = await authService.registerUser(email, password, tenantName);

    return Response.json({
      success: true,
      user: result.user,
      tenant: result.tenant,
      token: result.token
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * User login
 */
async function handleAuthLogin(request, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response('Missing credentials', { status: 400 });
  }

  try {
    const result = await authService.authenticateUser(email, password);

    return Response.json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 401 });
  }
}

/**
 * Token validation
 */
async function handleAuthValidate(request, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('No token provided', { status: 401 });
  }

  try {
    const userContext = await authService.validateToken(token);

    return Response.json({
      valid: true,
      user: userContext
    });
  } catch (error) {
    return Response.json({
      valid: false,
      error: error.message
    }, { status: 401 });
  }
}

/**
 * Provision new AI agent
 */
async function handleAgentProvision(request, aiCoordinator, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const agentConfig = await request.json();
    const userContext = await authService.validateToken(token);

    // Add tenant context to agent config
    agentConfig.capabilities = {
      ...agentConfig.capabilities,
      tenant_id: userContext.tenant_id
    };

    const agent = await aiCoordinator.createAIAgent(agentConfig);

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
 * List user's agents
 */
async function handleAgentsList(request, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const agents = await authService.getTenantData(token, 'agents');

    return Response.json({
      success: true,
      agents
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Coordinate multiple agents
 */
async function handleAgentCoordination(request, aiCoordinator, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { taskDescription, maxAgents } = await request.json();

    const coordination = await aiCoordinator.coordinateAgents(taskDescription, maxAgents);

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
 * Get agent sessions
 */
async function handleAgentSessions(request, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const sessions = await authService.getTenantData(token, 'sessions');

    return Response.json({
      success: true,
      sessions
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Perform AI-enhanced topic sync
 */
async function handleTopicSync(request, aiCoordinator, authService) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    await authService.validateToken(token);
    const { sessionId, topicText } = await request.json();

    const syncResult = await aiCoordinator.performAITopicSync(sessionId, topicText);

    return Response.json({
      success: true,
      sync: syncResult
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Get usage analytics
 */
async function handleUsageAnalytics(request, authService) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response('Authentication required', { status: 401 });
  }

  try {
    const userContext = await authService.validateToken(token);
    const authDB = await authService.createAuthenticatedConnection(token);

    // Get tenant-specific analytics
    const [projectStats] = await authDB.query`
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'active') as active_projects,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') as recent_projects
      FROM chittychat_projects
    `;

    const [agentStats] = await authDB.query`
      SELECT
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE status = 'active') as active_agents,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_agents
      FROM ai_agents.registry
    `;

    const [sessionStats] = await authDB.query`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(DISTINCT agent_id) as agents_with_sessions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_sessions
      FROM ai_agents.sessions
    `;

    return Response.json({
      success: true,
      analytics: {
        tenant_id: userContext.tenant_id,
        projects: projectStats,
        agents: agentStats,
        sessions: sessionStats,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 400 });
  }
}

/**
 * Initialize database schemas
 */
async function handleInitializeSetup(aiCoordinator, authService) {
  try {
    await authService.setupAuthSchema();
    await authService.setupAppRLS();
    await aiCoordinator.setupAIDatabase();

    return Response.json({
      success: true,
      message: 'Database schemas initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({
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
 * Scheduled task: Cleanup inactive agents and expired sessions
 */
export async function scheduled(event, env, ctx) {
  const aiCoordinator = new NeonAICoordinator({
    DATABASE_URL: env.DATABASE_URL,
    REPORTING_DATABASE_URL: env.REPORTING_DATABASE_URL,
    NEON_API_KEY: env.NEON_API_KEY,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID
  });

  const authService = new NeonAuthIntegration({
    DATABASE_URL: env.DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,
    NEON_AUTH_URL: env.NEON_AUTH_URL,
    NEON_PROJECT_ID: env.NEON_PROJECT_ID
  });

  try {
    // Cleanup inactive agents (older than 7 days)
    const cleanedAgents = await aiCoordinator.cleanupInactiveAgents();

    // Cleanup expired sessions
    const cleanedSessions = await authService.cleanupExpiredSessions();

    console.log(`Cleanup completed: ${cleanedAgents} agents, ${cleanedSessions} sessions`);
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
}