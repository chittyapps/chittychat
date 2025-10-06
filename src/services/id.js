/**
 * ChittyID Service Module - PROXY ONLY
 * NO LOCAL GENERATION - ALL ChittyIDs come from id.chitty.cc central authority
 * This service acts as a routing proxy in the unified platform
 * Format: VV-G-LLL-SSSS-T-YM-C-X ONLY - NEVER any other format
 */

import ChittyIDClient from "@chittyos/chittyid-client";

/**
 * Get ChittyID client instance
 */
function getChittyIDClient(env) {
  const apiKey = env.CHITTY_ID_TOKEN || env.CHITTYID_API_KEY;
  const serviceUrl = env.CHITTYID_SERVICE_URL || "https://id.chitty.cc";

  return new ChittyIDClient({
    serviceUrl,
    apiKey,
  });
}

/**
 * Handle mint request - PROXY to central authority
 * Proxies to the dedicated chittyid-production worker at id.chitty.cc
 */
async function handleMintRequest(request, context) {
  const { env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      domain,
      subtype,
      metadata = {},
      entity,
      purpose,
      sessionContext = {},
    } = body;

    // Validate API key from request headers
    const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "API key required",
          message: "Include Authorization: Bearer <api-key> header",
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // Normalize domain/entity
    const normalizedDomain = domain || entity || "IDN";
    const normalizedSubtype = subtype || purpose || "initial";

    // PROXY to central ChittyID authority - NO LOCAL GENERATION
    const client = getChittyIDClient(env);
    const chittyId = await client.mint({
      entity: normalizedDomain,
      metadata: {
        ...metadata,
        subtype: normalizedSubtype,
        sessionContext,
      },
    });

    // Return result
    return new Response(
      JSON.stringify({
        chittyId,
        success: true,
        domain: normalizedDomain,
        subtype: normalizedSubtype,
        metadata: {
          ...metadata,
          generated_at: new Date().toISOString(),
          generator: "id.chitty.cc-proxy",
          note: "Proxied through unified platform to central authority",
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-chittyid-source": "central-authority",
          "x-proxy-mode": "pipeline-only",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "ChittyID generation failed",
        message: error.message,
        note: "Service must be available at id.chitty.cc - no fallback generation",
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

export async function handleID(context) {
  const { request, cache, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/id", "");

  // Health check - indicates this is a PROXY service
  if (path === "/health") {
    return new Response(
      JSON.stringify({
        service: "chitty-id-proxy",
        status: "healthy",
        mode: "proxy-only",
        version: "2.1.0",
        target: "https://id.chitty.cc",
        note: "This service proxies to the central ChittyID authority - NO local generation",
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Mint ChittyID endpoint (/mint and /v1/mint) - CONSOLIDATED ENDPOINT
  if ((path === "/mint" || path === "/v1/mint") && request.method === "POST") {
    return await handleMintRequest(request, context);
  }

  // Generate ChittyID endpoint (pipeline-only) - Legacy compatibility
  if (path === "/generate" && request.method === "POST") {
    return await handleMintRequest(request, context);
  }

  // Validate ChittyID endpoint
  if (path.startsWith("/validate/") && request.method === "GET") {
    const chittyId = path.replace("/validate/", "");

    // Use the proper validation function
    const { validateChittyIDFormat } = await import(
      "../lib/chittyid-service.js"
    );
    const isValidFormat = validateChittyIDFormat(chittyId);

    if (!chittyId || !isValidFormat) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid ChittyID format - must be VV-G-LLL-SSSS-T-YM-C-X",
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }

    try {
      // Check if we have metadata for this ID
      const metadata = await cache.get(chittyId, "id");
      const hasMetadata = !!metadata;

      return new Response(
        JSON.stringify({
          valid: isValidFormat,
          chittyId,
          hasMetadata,
          format: "VV-G-LLL-SSSS-T-YM-C-X",
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Validation failed",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // Get ChittyID metadata endpoint
  if (path.startsWith("/metadata/") && request.method === "GET") {
    const chittyId = path.replace("/metadata/", "");

    try {
      const metadata = await cache.get(chittyId, "id");

      if (!metadata) {
        return new Response(
          JSON.stringify({
            error: "Metadata not found",
            chittyId,
          }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(metadata, {
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Metadata retrieval failed",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  return new Response(
    JSON.stringify({
      error: "Endpoint not found",
      available: [
        "/health",
        "/mint",
        "/v1/mint",
        "/generate",
        "/validate/{id}",
        "/metadata/{id}",
      ],
      mode: "proxy-only",
      note: "This service proxies all requests to https://id.chitty.cc - NO local generation",
      recommendation: "Use /mint or /v1/mint for ChittyID generation",
    }),
    {
      status: 404,
      headers: { "content-type": "application/json" },
    },
  );
}
