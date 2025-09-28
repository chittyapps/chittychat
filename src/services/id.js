/**
 * ChittyID Service Module
 * Consolidated from id.chitty.cc worker
 * Handles ChittyID generation with pipeline-only architecture
 */

export async function handleID(context) {
  const { request, cache } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/id', '');

  // Health check
  if (path === '/health') {
    return new Response(JSON.stringify({
      service: 'chitty-id',
      status: 'healthy',
      mode: 'pipeline-only',
      version: '2.1.0'
    }), {
      headers: { 'content-type': 'application/json' }
    });
  }

  // Generate ChittyID endpoint (pipeline-only)
  if (path === '/generate' && request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const { metadata = {}, sessionContext = {} } = body;

      // Validate API key from request headers
      const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: 'API key required',
          message: 'Include Authorization: Bearer <api-key> header'
        }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }

      // Generate ChittyID using cryptographic approach
      const timestamp = Date.now();
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      const randomHex = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

      // Create base ID structure
      const baseId = `chitty_${timestamp}_${randomHex}`;

      // Add session context hash if provided
      let sessionHash = '';
      if (Object.keys(sessionContext).length > 0) {
        const sessionData = JSON.stringify(sessionContext);
        const encoder = new TextEncoder();
        const data = encoder.encode(sessionData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        sessionHash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 8);
      }

      const chittyId = sessionHash ? `${baseId}_${sessionHash}` : baseId;

      // Store metadata in cache for later retrieval
      if (Object.keys(metadata).length > 0) {
        await cache.set(chittyId, JSON.stringify({
          metadata,
          sessionContext,
          created: timestamp,
          source: 'pipeline-generation'
        }), 'id', 86400); // 24 hour cache
      }

      return new Response(JSON.stringify({
        chittyId,
        timestamp,
        metadata,
        sessionContext,
        source: 'pipeline-only'
      }), {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'ChittyID generation failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // Validate ChittyID endpoint
  if (path.startsWith('/validate/') && request.method === 'GET') {
    const chittyId = path.replace('/validate/', '');

    if (!chittyId || !chittyId.startsWith('chitty_')) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'Invalid ChittyID format'
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    try {
      // Check if we have metadata for this ID
      const metadata = await cache.get(chittyId, 'id');
      const hasMetadata = !!metadata;

      // Basic format validation
      const parts = chittyId.split('_');
      const isValidFormat = parts.length >= 3 && parts[0] === 'chitty';
      const timestamp = parseInt(parts[1]);
      const isValidTimestamp = !isNaN(timestamp) && timestamp > 0;

      return new Response(JSON.stringify({
        valid: isValidFormat && isValidTimestamp,
        chittyId,
        hasMetadata,
        timestamp: isValidTimestamp ? timestamp : null,
        age: isValidTimestamp ? Date.now() - timestamp : null
      }), {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'Validation failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  // Get ChittyID metadata endpoint
  if (path.startsWith('/metadata/') && request.method === 'GET') {
    const chittyId = path.replace('/metadata/', '');

    try {
      const metadata = await cache.get(chittyId, 'id');

      if (!metadata) {
        return new Response(JSON.stringify({
          error: 'Metadata not found',
          chittyId
        }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response(metadata, {
        headers: { 'content-type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Metadata retrieval failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({
    error: 'Endpoint not found',
    available: ['/health', '/generate', '/validate/{id}', '/metadata/{id}'],
    mode: 'pipeline-only'
  }), {
    status: 404,
    headers: { 'content-type': 'application/json' }
  });
}