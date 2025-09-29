/**
 * ChittyCases Service Handler for ChittyChat Unified Worker
 * Provides legal case management and analysis through unified worker interface
 */

import { ChittyCasesService } from "./chittycases-integration.js";

/**
 * Handle ChittyCases requests through unified worker
 */
export async function handleChittyCases(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Initialize ChittyCases service
    const chittyCases = new ChittyCasesService(env);

    // Health check endpoint
    if (pathname === "/health") {
      const health = await chittyCases.healthCheck();
      return new Response(JSON.stringify(health), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different ChittyCases operations
    if (request.method === "POST") {
      const body = await request.json();

      switch (pathname) {
        case "/cases/legal-research":
          const researchResult = await chittyCases.conductLegalResearch(body);
          return new Response(JSON.stringify(researchResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/cases/document-analysis":
          const analysisResult = await chittyCases.analyzeDocument(body);
          return new Response(JSON.stringify(analysisResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/cases/case-insights":
          const insightsResult = await chittyCases.generateCaseInsights(body);
          return new Response(JSON.stringify(insightsResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/cases/petition-generation":
          const petitionResult = await chittyCases.generatePetition(body);
          return new Response(JSON.stringify(petitionResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/cases/contradiction-analysis":
          const contradictionResult =
            await chittyCases.analyzeContradictions(body);
          return new Response(JSON.stringify(contradictionResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/cases/dashboard-generation":
          const dashboardResult = await chittyCases.generateDashboard(body);
          return new Response(JSON.stringify(dashboardResult), {
            headers: { "Content-Type": "application/json" },
          });

        // MCP ChittyCases Legal Tools
        case "/mcp/verify_case_number":
          const verifyResult = await chittyCases.verifyCaseNumber(body);
          return new Response(JSON.stringify(verifyResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/mcp/search_cases":
          const searchResult = await chittyCases.searchCases(body);
          return new Response(JSON.stringify(searchResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/mcp/get_court_calendar":
          const calendarResult = await chittyCases.getCourtCalendar(body.case_number);
          return new Response(JSON.stringify(calendarResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/mcp/lookup_property_pin":
          const propertyResult = await chittyCases.lookupPropertyPIN(body);
          return new Response(JSON.stringify(propertyResult), {
            headers: { "Content-Type": "application/json" },
          });

        case "/mcp/check_filing_compliance":
          const complianceResult = await chittyCases.checkFilingCompliance(body);
          return new Response(JSON.stringify(complianceResult), {
            headers: { "Content-Type": "application/json" },
          });

        default:
          return new Response(
            JSON.stringify({
              error: "Unknown ChittyCases operation",
              pathname,
              availableEndpoints: [
                "/cases/legal-research",
                "/cases/document-analysis",
                "/cases/case-insights",
                "/cases/petition-generation",
                "/cases/contradiction-analysis",
                "/cases/dashboard-generation",
                "/mcp/verify_case_number",
                "/mcp/search_cases",
                "/mcp/get_court_calendar",
                "/mcp/lookup_property_pin",
                "/mcp/check_filing_compliance",
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
        service: "ChittyCases Legal Service",
        version: "1.0.0",
        status: "operational",
        endpoints: [
          "POST /cases/legal-research",
          "POST /cases/document-analysis",
          "POST /cases/case-insights",
          "POST /cases/petition-generation",
          "POST /cases/contradiction-analysis",
          "POST /cases/dashboard-generation",
          "POST /mcp/verify_case_number",
          "POST /mcp/search_cases",
          "POST /mcp/get_court_calendar",
          "POST /mcp/lookup_property_pin",
          "POST /mcp/check_filing_compliance",
          "GET /health",
        ],
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ChittyCases Handler Error:", error);
    return new Response(
      JSON.stringify({
        error: "ChittyCases Service Error",
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
