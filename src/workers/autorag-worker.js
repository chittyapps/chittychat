import { verifyChittyAuth } from '../services/auth';

export default {
  async fetch(request, env, ctx) {
    try {
      // Verify ChittyID authentication
      const chittyId = request.headers.get('X-ChittyID');
      const authToken = request.headers.get('Authorization');

      if (!chittyId || !authToken) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      const isValid = await verifyChittyAuth(authToken, chittyId, env);
      if (!isValid) {
        return Response.json({ error: 'Invalid authentication' }, { status: 403 });
      }

      // Parse request
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Handle different AutoRAG operations
      switch (pathname) {
        case '/autorag/query':
          return handleQuery(request, env, chittyId);

        case '/autorag/index':
          return handleIndexTrigger(request, env, chittyId);

        case '/autorag/health':
          return handleHealthCheck(env);

        default:
          return Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (error) {
      console.error('AutoRAG Worker Error:', error);
      return Response.json({
        error: 'Internal server error',
        message: error.message
      }, { status: 500 });
    }
  }
};

async function handleQuery(request, env, chittyId) {
  const { query, filters = {} } = await request.json();

  if (!query) {
    return Response.json({ error: 'Query required' }, { status: 400 });
  }

  // Get user's trust level from ChittyID service
  const trustLevel = await getTrustLevel(chittyId, env);

  // Build AutoRAG query with ChittyChat context
  const autoragQuery = {
    query,
    system_prompt: `You are ChittyChat Assistant with access to processed legal documents.
      The user has trust level ${trustLevel} (L0-L5 scale).
      Provide accurate, contextual responses based on available documents.
      Maintain chain of custody references when citing documents.`,
    metadata_filter: {
      ...filters,
      trust_level: { $lte: trustLevel },
      chitty_id_access: { $in: [chittyId, 'public'] }
    },
    similarity_cache: true,
    query_rewriting: true,
    top_k: 5
  };

  // Query AutoRAG via binding
  const response = await env.AUTORAG.query(autoragQuery);

  // Add audit logging
  await logQuery(chittyId, query, response, env);

  return Response.json({
    success: true,
    data: response,
    metadata: {
      chitty_id: chittyId,
      trust_level: trustLevel,
      timestamp: Date.now()
    }
  });
}

async function handleIndexTrigger(request, env, chittyId) {
  const { document_id, force = false } = await request.json();

  // Verify user has permission to trigger indexing
  const trustLevel = await getTrustLevel(chittyId, env);
  if (trustLevel < 3) {
    return Response.json({
      error: 'Insufficient permissions for indexing'
    }, { status: 403 });
  }

  // Trigger AutoRAG reindex for specific document or all
  const indexResult = await env.AUTORAG.index({
    document_id,
    force_reindex: force
  });

  return Response.json({
    success: true,
    indexed: indexResult.documents_processed,
    duration: indexResult.duration_ms
  });
}

async function handleHealthCheck(env) {
  try {
    // Check AutoRAG binding
    const autoragStatus = await env.AUTORAG.health();

    // Check R2 bucket connectivity
    const r2Status = await env.R2.head('health-check');

    return Response.json({
      status: 'healthy',
      services: {
        autorag: autoragStatus?.status || 'unknown',
        r2: r2Status ? 'connected' : 'disconnected'
      },
      timestamp: Date.now()
    });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now()
    }, { status: 503 });
  }
}

async function getTrustLevel(chittyId, env) {
  try {
    const response = await fetch(`${env.CHITTYID_URL}/api/trust/${chittyId}`, {
      headers: {
        'Authorization': `Bearer ${env.CHITTYID_API_KEY}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.trust_level || 0;
    }
  } catch (error) {
    console.error('Failed to get trust level:', error);
  }

  return 0; // Default to L0 if lookup fails
}

async function logQuery(chittyId, query, response, env) {
  const logEntry = {
    chitty_id: chittyId,
    query,
    response_tokens: response.tokens_used || 0,
    documents_retrieved: response.documents?.length || 0,
    timestamp: Date.now()
  };

  // Store in R2 audit log
  const logKey = `audit-logs/${new Date().toISOString()}-${chittyId}.json`;
  await env.R2.put(logKey, JSON.stringify(logEntry));
}