/**
 * LangChain AI Service Handler for ChittyChat Unified Worker
 * Provides LangChain AI capabilities through unified worker interface
 */

import { LangChainAIService } from "./langchain-ai.js";

/**
 * Handle LangChain AI requests through unified worker
 */
export async function handleLangChainAI(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Initialize LangChain AI service
    const langChainAI = new LangChainAIService(env);

    // Health check endpoint
    if (pathname === "/health") {
      const health = await langChainAI.healthCheck();
      return new Response(JSON.stringify(health), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different LangChain operations
    if (request.method === "POST") {
      const body = await request.json();

      switch (pathname) {
        case "/ai/legal-analysis":
          const legalResult = await langChainAI.analyzeLegalCase(body);
          return new Response(JSON.stringify(legalResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/ai/fund-tracing":
          const fundResult = await langChainAI.traceFunds(body);
          return new Response(JSON.stringify(fundResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/ai/document-generation":
          const docResult = await langChainAI.generateDocument(body);
          return new Response(JSON.stringify(docResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/ai/evidence-compilation":
          const evidenceResult = await langChainAI.compileEvidence(body);
          return new Response(JSON.stringify(evidenceResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/ai/timeline-generation":
          const timelineResult = await langChainAI.generateTimeline(body);
          return new Response(JSON.stringify(timelineResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/ai/compliance-analysis":
          const complianceResult = await langChainAI.analyzeCompliance(body);
          return new Response(JSON.stringify(complianceResult), {
            headers: { "Content-Type": "application/json" },
          });

        default:
          return new Response(
            JSON.stringify({
              error: "Unknown LangChain operation",
              pathname,
              availableEndpoints: [
                "/ai/legal-analysis",
                "/ai/fund-tracing",
                "/ai/document-generation",
                "/ai/evidence-compilation",
                "/ai/timeline-generation",
                "/ai/compliance-analysis",
              ],
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
      }
    }

    // GET request - return service info
    return new Response(
      JSON.stringify({
        service: "LangChain AI Service",
        version: "1.0.0",
        status: "operational",
        endpoints: [
          "POST /ai/legal-analysis",
          "POST /ai/fund-tracing",
          "POST /ai/document-generation",
          "POST /ai/evidence-compilation",
          "POST /ai/timeline-generation",
          "POST /ai/compliance-analysis",
          "GET /health",
        ],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("LangChain AI Handler Error:", error);
    return new Response(
      JSON.stringify({
        error: "LangChain AI Service Error",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
