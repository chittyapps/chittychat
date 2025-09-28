/**
 * ChittyChat AI Gateway Worker
 * Integrates AI Gateway with Workers AI for observability and control
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // AI Gateway configuration
    const gatewayConfig = {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      gatewaySlug: 'chittychat-ai'
    };

    try {
      // Route AI requests through the gateway
      switch (url.pathname) {
        case '/embeddings':
          return handleEmbeddings(request, env, gatewayConfig);

        case '/generate':
          return handleTextGeneration(request, env, gatewayConfig);

        case '/keywords':
          return handleKeywordExtraction(request, env, gatewayConfig);

        case '/analytics':
          return handleAnalytics(env, gatewayConfig);

        default:
          return new Response('ChittyChat AI Gateway', { status: 200 });
      }
    } catch (error) {
      console.error('AI Gateway error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle embedding generation with caching and analytics
 */
async function handleEmbeddings(request, env, gatewayConfig) {
  const { text, model = '@cf/baai/bge-base-en-v1.5' } = await request.json();

  // Check cache first (AI Gateway handles this)
  const cacheKey = `embedding:${hashText(text)}:${model}`;

  // Route through AI Gateway for observability
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${gatewayConfig.accountId}/${gatewayConfig.gatewaySlug}/workers-ai/${model}`;

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      'cf-aig-cache-ttl': '3600', // Cache for 1 hour
      'cf-aig-rate-limit': '100'  // 100 requests per minute
    },
    body: JSON.stringify({
      text: text.substring(0, 8000) // Model limit
    })
  });

  const result = await response.json();

  // Log to analytics
  await logMetrics(env, {
    operation: 'embedding',
    model,
    tokens: estimateTokens(text),
    cached: response.headers.get('cf-aig-cache-status') === 'HIT',
    latency: response.headers.get('cf-aig-response-time')
  });

  return new Response(JSON.stringify({
    embedding: result.data[0],
    model,
    cached: response.headers.get('cf-aig-cache-status') === 'HIT',
    dimensions: getModelDimensions(model)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle text generation with fallbacks
 */
async function handleTextGeneration(request, env, gatewayConfig) {
  const { prompt, model = '@cf/meta/llama-2-7b-chat-fp16' } = await request.json();

  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${gatewayConfig.accountId}/${gatewayConfig.gatewaySlug}/workers-ai/${model}`;

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      'cf-aig-fallback-model': '@cf/mistral/mistral-7b-instruct-v0.1',
      'cf-aig-retry': '3'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant for ChittyChat.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000
    })
  });

  const result = await response.json();

  return new Response(JSON.stringify({
    response: result.response,
    model: response.headers.get('cf-aig-model-used') || model,
    tokens: result.usage
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Extract keywords using AI
 */
async function handleKeywordExtraction(request, env, gatewayConfig) {
  const { text, limit = 10 } = await request.json();

  const prompt = `Extract ${limit} keywords from the following text. Return only a JSON array of keywords:\n\n${text.substring(0, 2000)}`;

  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${gatewayConfig.accountId}/${gatewayConfig.gatewaySlug}/workers-ai/@cf/meta/llama-2-7b-chat-fp16`;

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Extract keywords and return only JSON array.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const result = await response.json();

  try {
    const keywords = JSON.parse(result.response);
    return new Response(JSON.stringify({ keywords }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    // Fallback to simple extraction
    const keywords = result.response.match(/["']([^"']+)["']/g) || [];
    return new Response(JSON.stringify({
      keywords: keywords.slice(0, limit).map(k => k.replace(/["']/g, ''))
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get analytics from AI Gateway
 */
async function handleAnalytics(env, gatewayConfig) {
  const analyticsUrl = `https://api.cloudflare.com/client/v4/accounts/${gatewayConfig.accountId}/ai-gateway/gateways/${gatewayConfig.gatewaySlug}/analytics`;

  const response = await fetch(analyticsUrl, {
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const analytics = await response.json();

  return new Response(JSON.stringify({
    requests: analytics.result.requests,
    tokens: analytics.result.tokens,
    costs: analytics.result.costs,
    cacheHitRate: analytics.result.cache_hit_rate,
    errors: analytics.result.errors,
    latency: analytics.result.avg_latency_ms
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Helper: Log metrics to analytics
 */
async function logMetrics(env, metrics) {
  // Store in KV or Analytics Engine
  if (env.METRICS_KV) {
    const key = `metrics:${Date.now()}`;
    await env.METRICS_KV.put(key, JSON.stringify(metrics), {
      expirationTtl: 86400 * 30 // 30 days
    });
  }
}

/**
 * Helper: Get model dimensions
 */
function getModelDimensions(model) {
  const dimensions = {
    '@cf/baai/bge-small-en-v1.5': 384,
    '@cf/baai/bge-base-en-v1.5': 768,
    '@cf/baai/bge-large-en-v1.5': 1024,
    '@cf/baai/bge-m3': 1024
  };
  return dimensions[model] || 768;
}

/**
 * Helper: Hash text for cache key
 */
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Helper: Estimate tokens
 */
function estimateTokens(text) {
  // Rough estimate: 1 token per 4 characters
  return Math.ceil(text.length / 4);
}