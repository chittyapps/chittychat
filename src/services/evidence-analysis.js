/**
 * Evidence Analysis Service Module
 * AI-powered legal document analysis using LangChain
 * Specialized for ChittyOS evidence processing
 */

export async function handleEvidenceAnalysis(context) {
  const { request, ai, cache } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/analysis", "");

  // Health check
  if (path === "/health") {
    return new Response(
      JSON.stringify({
        service: "evidence-analysis",
        status: "healthy",
        capabilities: [
          "document-classification",
          "entity-extraction",
          "timeline-generation",
          "legal-analysis",
          "summarization",
        ],
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  }

  // Analyze document endpoint
  if (path === "/analyze" && request.method === "POST") {
    try {
      const body = await request.json();
      const {
        document_text,
        document_type,
        analysis_type = "comprehensive",
      } = body;

      if (!document_text) {
        return new Response(
          JSON.stringify({
            error: "Document text required",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        );
      }

      // Generate analysis prompt based on document type
      const analysisPrompt = generateAnalysisPrompt(
        document_text,
        document_type,
        analysis_type,
      );

      // Use Cloudflare AI for analysis
      const aiResponse = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content:
              "You are a legal document analysis expert. Provide structured, accurate analysis of legal documents.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      });

      const analysis = parseAnalysisResponse(aiResponse.response);

      // Cache the analysis
      const cacheKey = `analysis:${hashText(document_text)}`;
      await cache.set(cacheKey, JSON.stringify(analysis), "evidence", 86400); // 24 hours

      return new Response(
        JSON.stringify({
          analysis,
          document_type,
          analysis_type,
          timestamp: new Date().toISOString(),
          cache_key: cacheKey,
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Analysis failed",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // Extract entities endpoint
  if (path === "/entities" && request.method === "POST") {
    try {
      const body = await request.json();
      const { document_text } = body;

      const entityPrompt = `
Extract key entities from this legal document. Return as JSON:

Document: ${document_text.substring(0, 2000)}...

Extract:
{
  "people": ["names of individuals"],
  "organizations": ["company names, law firms"],
  "properties": ["addresses, property descriptions"],
  "dates": ["important dates"],
  "amounts": ["monetary amounts"],
  "case_numbers": ["court case numbers"],
  "contracts": ["contract references"],
  "legal_concepts": ["legal terms, concepts"]
}
`;

      const aiResponse = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content:
              "You are a legal entity extraction expert. Extract entities in valid JSON format only.",
          },
          {
            role: "user",
            content: entityPrompt,
          },
        ],
      });

      let entities;
      try {
        entities = JSON.parse(aiResponse.response);
      } catch {
        // Fallback if JSON parsing fails
        entities = {
          error: "Failed to parse entities",
          raw_response: aiResponse.response,
        };
      }

      return new Response(
        JSON.stringify({
          entities,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Entity extraction failed",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  // Generate timeline endpoint
  if (path === "/timeline" && request.method === "POST") {
    try {
      const body = await request.json();
      const { documents } = body; // Array of document texts

      const timelinePrompt = `
Analyze these legal documents and create a chronological timeline:

${documents.map((doc, i) => `Document ${i + 1}: ${doc.substring(0, 1000)}...`).join("\n\n")}

Create a timeline in JSON format:
{
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "event": "Brief description",
      "document_source": "Document 1",
      "significance": "legal significance",
      "parties_involved": ["party names"]
    }
  ]
}
`;

      const aiResponse = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content:
              "You are a legal timeline expert. Create accurate chronological timelines from legal documents.",
          },
          {
            role: "user",
            content: timelinePrompt,
          },
        ],
      });

      let timeline;
      try {
        timeline = JSON.parse(aiResponse.response);
      } catch {
        timeline = {
          error: "Failed to parse timeline",
          raw_response: aiResponse.response,
        };
      }

      return new Response(
        JSON.stringify({
          timeline,
          document_count: documents.length,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Timeline generation failed",
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
      available: ["/health", "/analyze", "/entities", "/timeline"],
    }),
    {
      status: 404,
      headers: { "content-type": "application/json" },
    },
  );
}

function generateAnalysisPrompt(document_text, document_type, analysis_type) {
  const basePrompt = `Analyze this ${document_type || "legal"} document:

${document_text.substring(0, 3000)}...

Provide analysis in JSON format:`;

  switch (analysis_type) {
    case "court_order":
      return `${basePrompt}
{
  "document_type": "court_order",
  "case_number": "extracted case number",
  "court": "court name",
  "judge": "judge name",
  "date_issued": "YYYY-MM-DD",
  "parties": ["plaintiff", "defendant"],
  "orders": ["list of specific orders"],
  "deadlines": ["any deadlines mentioned"],
  "legal_significance": "significance of this order",
  "next_steps": ["required actions"]
}`;

    case "financial":
      return `${basePrompt}
{
  "document_type": "financial",
  "financial_data": {
    "amounts": ["monetary amounts mentioned"],
    "accounts": ["account numbers/names"],
    "transactions": ["transaction descriptions"],
    "dates": ["transaction dates"]
  },
  "parties": ["involved parties"],
  "purpose": "purpose of financial document",
  "legal_relevance": "why this is legally significant"
}`;

    case "property":
      return `${basePrompt}
{
  "document_type": "property",
  "property_details": {
    "address": "property address",
    "legal_description": "legal description",
    "value": "property value if mentioned",
    "ownership": "ownership details"
  },
  "transaction_type": "sale/lease/mortgage etc",
  "parties": ["buyer", "seller", "other parties"],
  "key_terms": ["important terms"],
  "legal_implications": "legal significance"
}`;

    default:
      return `${basePrompt}
{
  "document_type": "determined type",
  "summary": "brief summary",
  "key_facts": ["important facts"],
  "parties_involved": ["all parties mentioned"],
  "dates": ["important dates"],
  "legal_issues": ["legal issues identified"],
  "significance": "why this document is important",
  "related_documents": ["references to other documents"]
}`;
  }
}

function parseAnalysisResponse(response) {
  try {
    return JSON.parse(response);
  } catch {
    // Fallback parsing for non-JSON responses
    return {
      summary: response.substring(0, 500),
      raw_analysis: response,
      parsing_error: true,
    };
  }
}

// TODO: This function is too long (-15 lines). Consider breaking into smaller functions.
function hashText(text) {
  // Simple hash for caching - in production would use crypto
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
