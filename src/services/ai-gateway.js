/**
 * AI Gateway Service Handler
 * Intelligent model routing with fallbacks and observability
 * Optimized for the ChittyOS Platform Orchestrator
 */

import { handleOpenAPISchema } from "./openapi-schema.js";

export async function handleAIGateway(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // OpenAPI Schema endpoints
  const schemaResponse = await handleOpenAPISchema(request);
  if (schemaResponse) {
    return schemaResponse;
  }

  // Health check
  if (pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "AI Gateway",
        models: {
          primary: env.DEFAULT_MODEL || "@cf/meta/llama-3.1-8b-instruct",
          embedding: env.EMBEDDING_MODEL || "@cf/baai/bge-base-en-v1.5",
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // OpenAI-compatible API
  if (pathname.startsWith("/v1/chat/completions")) {
    return handleChatCompletions(request, env, ctx);
  }

  if (pathname.startsWith("/v1/embeddings")) {
    return handleEmbeddings(request, env, ctx);
  }

  // Model information
  if (pathname === "/v1/models") {
    return handleModels(request, env, ctx);
  }

  // Legacy endpoints for backward compatibility
  if (pathname === "/chat" && request.method === "POST") {
    return handleChatCompletions(request, env, ctx);
  }

  if (pathname === "/embeddings" && request.method === "POST") {
    return handleEmbeddings(request, env, ctx);
  }

  // Default response
  return new Response(
    JSON.stringify({
      service: "ChittyOS AI Gateway",
      version: "1.0.0",
      endpoints: [
        "/health",
        "/v1/chat/completions",
        "/v1/embeddings",
        "/v1/models",
        "/chat", // legacy
        "/embeddings", // legacy
      ],
      documentation: "https://developers.cloudflare.com/workers-ai/",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleChatCompletions(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const model = body.model || env.DEFAULT_MODEL;

    // Use Workers AI binding
    const response = await env.AI.run(model, {
      messages: body.messages,
      max_tokens: body.max_tokens || 256,
      temperature: body.temperature || 0.7,
    });

    return new Response(
      JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: response.response,
            },
            finish_reason: "stop",
          },
        ],
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          type: "invalid_request_error",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleEmbeddings(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    const model = body.model || env.EMBEDDING_MODEL;

    const response = await env.AI.run(model, {
      text: Array.isArray(body.input) ? body.input : [body.input],
    });

    return new Response(
      JSON.stringify({
        object: "list",
        data: response.data.map((embedding, index) => ({
          object: "embedding",
          embedding,
          index,
        })),
        model,
        usage: {
          prompt_tokens: body.input.length,
          total_tokens: body.input.length,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          type: "invalid_request_error",
        },
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleModels(request, env, ctx) {
  return new Response(
    JSON.stringify({
      object: "list",
      data: [
        {
          id: "@cf/meta/llama-3.1-8b-instruct",
          object: "model",
          created: 1677610602,
          owned_by: "cloudflare",
        },
        {
          id: "@cf/baai/bge-base-en-v1.5",
          object: "model",
          created: 1677610602,
          owned_by: "cloudflare",
        },
      ],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
