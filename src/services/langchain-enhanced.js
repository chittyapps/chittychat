/**
 * Enhanced LangChain Service Handler for Unified Worker
 * Includes ChittyCases integration and ChittyID validation
 */

import { LangChainAIService } from "./langchain-ai.js";
import { ChittyCasesService } from "./chittycases-integration.js";
// Use local stub to avoid cross-repo dev dependency
import { ChittyRouterGateway } from "./chittyrouter-gateway-stub.js";

/**
 * ChittyID Validation Middleware
 * Following ChittyID security guidelines - NEVER accept client-supplied IDs
 */
class ChittyIDValidator {
  constructor(serviceEndpoint = "https://id.chitty.cc") {
    this.idService = serviceEndpoint;
    this.cache = new Map(); // 5-minute validation cache per documentation
  }

  async validateOnEntry(request, chittyID) {
    // Check cache first (5-minute TTL as per validation framework)
    const cacheKey = `${chittyID}-${Math.floor(Date.now() / 300000)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Validate against id.chitty.cc
    try {
      const response = await fetch(`${this.idService}/api/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CHITTY_API_KEY}`,
        },
        body: JSON.stringify({
          chitty_id: chittyID,
          requesting_service: "langchain-enhanced",
          timestamp: new Date().toISOString(),
        }),
      });

      const validation = await response.json();

      // Cache result for 5 minutes
      this.cache.set(cacheKey, validation);

      return validation;
    } catch (error) {
      console.error("ChittyID validation failed:", error);
      return { valid: false, error: error.message };
    }
  }

  async requestChittyID(entityType, metadata) {
    // NEVER generate locally - always request from mothership
    // ChittyID format: VV-G-LLL-SSSS-T-YM-C-X
    // T (entity type): P (Person), L (Location), T (Thing), E (Event)
    try {
      const response = await fetch(`${this.idService}/api/v1/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CHITTY_API_KEY}`,
        },
        body: JSON.stringify({
          entity: entityType, // Must be P, L, T, or E
          name: metadata.name || "langchain-operation",
          metadata: {
            ...metadata,
            format: "official", // VV-G-LLL-SSSS-T-YM-C-X format
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ChittyID request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("ChittyID request failed:", error);
      throw error;
    }
  }
}

/**
 * Enhanced LangChain Handler with ChittyID validation
 */
export async function handleLangChainEnhanced(request, env, ctx) {
  const validator = new ChittyIDValidator(
    env.CHITTY_ID_SERVICE || "https://id.chitty.cc",
  );

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Validate service ChittyID if present in headers
    const serviceChittyID = request.headers.get("X-Service-ChittyID");
    if (serviceChittyID) {
      const validation = await validator.validateOnEntry(
        request,
        serviceChittyID,
      );
      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            error: "Invalid service ChittyID",
            validation,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Initialize services
    const langChainAI = new LangChainAIService(env);
    const chittyCases = new ChittyCasesService(env);
    const gateway = new ChittyRouterGateway(env);

    // Route based on path
    if (pathname.startsWith("/langchain/legal")) {
      return handleLegalAnalysis(request, langChainAI, validator, env);
    } else if (pathname.startsWith("/langchain/cases")) {
      return handleCasesOperation(request, chittyCases, validator, env);
    } else if (pathname.startsWith("/langchain/pipeline")) {
      return handlePipeline(request, gateway, validator, env);
    } else if (pathname === "/langchain/health") {
      return handleHealthCheck(langChainAI, chittyCases, gateway);
    }

    // Default response
    return new Response(
      JSON.stringify({
        service: "LangChain Enhanced",
        status: "ready",
        capabilities: [
          "legal_analysis",
          "fund_tracing",
          "document_generation",
          "evidence_compilation",
          "case_management",
          "petition_generation",
        ],
        chittyid_validation: "enabled",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("LangChain Enhanced error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle legal analysis with ChittyID generation
 */
async function handleLegalAnalysis(request, langChainAI, validator, env) {
  try {
    const body = await request.json();
    const { caseDetails, analysisType, provider } = body;

    // Request ChittyID for this analysis
    // Using 'T' for Thing since this is a legal analysis document/thing
    const chittyIdResponse = await validator.requestChittyID("T", {
      type: "legal_analysis",
      analysisType,
      timestamp: new Date().toISOString(),
    });

    // Perform analysis
    const result = await langChainAI.analyzeLegalCase({
      caseDetails,
      analysisType,
      provider,
    });

    // Add ChittyID to result
    result.chittyId = chittyIdResponse.chitty_id;
    result.validation = chittyIdResponse;

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "X-ChittyID": chittyIdResponse.chitty_id,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Legal analysis failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle ChittyCases operations with ChittyID validation
 */
async function handleCasesOperation(request, chittyCases, validator, env) {
  try {
    const body = await request.json();
    const { operation, params } = body;

    // Request ChittyID for this operation
    // Using 'T' for Thing since case operations produce documents/things
    const chittyIdResponse = await validator.requestChittyID("T", {
      operation,
      timestamp: new Date().toISOString(),
    });

    let result;

    switch (operation) {
      case "legal_research":
        result = await chittyCases.performLegalResearch(params);
        break;
      case "document_analysis":
        result = await chittyCases.analyzeDocument(params);
        break;
      case "case_insights":
        result = await chittyCases.getCaseInsights(params);
        break;
      case "petition_generation":
        result = await chittyCases.generatePetition(params);
        break;
      case "contradiction_analysis":
        result = await chittyCases.findContradictions(params);
        break;
      case "dashboard_generation":
        result = await chittyCases.generateDashboardData(params);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Add ChittyID to result
    result.chittyId = chittyIdResponse.chitty_id;

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "X-ChittyID": chittyIdResponse.chitty_id,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Cases operation failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Handle pipeline operations
 */
async function handlePipeline(request, gateway, validator, env) {
  try {
    const body = await request.json();
    const { pipelineType, pipelineRequest, context } = body;

    // Request ChittyID for pipeline operation
    // Using 'T' for Thing since pipeline operations produce results/things
    const chittyIdResponse = await validator.requestChittyID("T", {
      pipelineType,
      timestamp: new Date().toISOString(),
    });

    let result;

    // Route to appropriate pipeline
    if (pipelineType.startsWith("langchain_")) {
      const langchainType = pipelineType.replace("langchain_", "");
      result = await gateway.executeLangChainPipeline(
        langchainType,
        pipelineRequest,
        context,
      );
    } else if (pipelineType.startsWith("cases_")) {
      const casesType = pipelineType.replace("cases_", "");
      result = await gateway.executeChittyCasesPipeline(
        casesType,
        pipelineRequest,
        context,
      );
    } else {
      throw new Error(`Unknown pipeline type: ${pipelineType}`);
    }

    // Add ChittyID to result
    result.chittyId = chittyIdResponse.chitty_id;

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "X-ChittyID": chittyIdResponse.chitty_id,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Pipeline execution failed",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Health check for all services
 */
async function handleHealthCheck(langChainAI, chittyCases, gateway) {
  try {
    const [langChainHealth, casesHealth, gatewayLangChain, gatewayCases] =
      await Promise.all([
        langChainAI.healthCheck(),
        chittyCases.healthCheck(),
        gateway.checkLangChainHealth(),
        gateway.checkChittyCasesHealth(),
      ]);

    return new Response(
      JSON.stringify({
        status: "healthy",
        services: {
          langchain_ai: langChainHealth,
          chittycases: casesHealth,
          gateway_langchain: gatewayLangChain,
          gateway_cases: gatewayCases,
        },
        chittyid_validation: "enabled",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "unhealthy",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Export for use in platform worker
export default handleLangChainEnhanced;
