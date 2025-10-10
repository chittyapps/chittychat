/**
 * evidence.ts - Evidence Management Worker
 * Deployed at: evidence.chitty.cc
 * Part of ChittyOS Evidence Management System
 */

import { Hono } from "hono";

interface Env {
  DB: D1Database;
  EVIDENCE_KV: KVNamespace;
  EVIDENCE_R2: R2Bucket;
  CHITTY_ID_TOKEN: string;
  NEON_DATABASE_URL: string;
}

interface EvidenceMetadata {
  chittyId: string;
  sha256: string;
  originalName: string;
  domain: "LEGAL" | "BUSINESS" | "PERSONAL" | "GENERAL";
  caseId?: string;
  created: string;
  version: number;
}

interface IntakeRequest {
  file: File;
  domain?: string;
  caseId?: string;
  metadata?: Record<string, any>;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  return c.json({
    service: "evidence.chitty.cc",
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Evidence intake endpoint
 * POST /intake with multipart/form-data
 */
app.post("/intake", async (c) => {
  const env = c.env;
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Calculate SHA256
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Mint ChittyID
    const chittyIdResponse = await fetch("https://id.chitty.cc/mint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHITTY_ID_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entityType: "EVNT",
        metadata: {
          sha256,
          originalName: file.name,
          size: file.size,
          type: file.type,
        },
      }),
    });

    if (!chittyIdResponse.ok) {
      throw new Error("Failed to mint ChittyID");
    }

    const { chittyId } = await chittyIdResponse.json();

    // Store in R2
    await env.EVIDENCE_R2.put(
      `objects/${sha256.substring(0, 2)}/${sha256}`,
      arrayBuffer,
      {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          chittyId,
          originalName: file.name,
        },
      },
    );

    // Store metadata in KV
    const metadata: EvidenceMetadata = {
      chittyId,
      sha256,
      originalName: file.name,
      domain: (formData.get("domain") as any) || classifyDomain(file.name),
      caseId: formData.get("caseId") as string,
      created: new Date().toISOString(),
      version: 1,
    };

    await env.EVIDENCE_KV.put(`evidence:${chittyId}`, JSON.stringify(metadata));

    // Log to audit trail
    await logAuditEntry(env, {
      action: "INTAKE",
      chittyId,
      sha256,
      timestamp: new Date().toISOString(),
      source: request.headers.get("cf-connecting-ip") || "unknown",
    });

    return Response.json({
      success: true,
      chittyId,
      sha256,
      metadata,
    });
  } catch (error) {
    console.error("Intake error:", error);
    return Response.json(
      {
        error: "Intake failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});

/**
 * Get evidence by ChittyID
 */
router.get("/evidence/:chittyId", async (request: Request, env: Env) => {
  const { chittyId } = request.params;

  const metadataJson = await env.EVIDENCE_KV.get(`evidence:${chittyId}`);

  if (!metadataJson) {
    return Response.json({ error: "Evidence not found" }, { status: 404 });
  }

  const metadata: EvidenceMetadata = JSON.parse(metadataJson);

  return Response.json(metadata);
});

/**
 * Download evidence file
 */
router.get(
  "/evidence/:chittyId/download",
  async (request: Request, env: Env) => {
    const { chittyId } = request.params;

    const metadataJson = await env.EVIDENCE_KV.get(`evidence:${chittyId}`);

    if (!metadataJson) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }

    const metadata: EvidenceMetadata = JSON.parse(metadataJson);
    const { sha256, originalName } = metadata;

    const object = await env.EVIDENCE_R2.get(
      `objects/${sha256.substring(0, 2)}/${sha256}`,
    );

    if (!object) {
      return Response.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }

    return new Response(object.body, {
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${originalName}"`,
        "X-ChittyID": chittyId,
        "X-SHA256": sha256,
      },
    });
  },
);

/**
 * List evidence by case
 */
router.get("/cases/:caseId/evidence", async (request: Request, env: Env) => {
  const { caseId } = request.params;

  // List all keys with prefix
  const list = await env.EVIDENCE_KV.list({ prefix: "evidence:" });

  const evidence: EvidenceMetadata[] = [];

  for (const key of list.keys) {
    const metadataJson = await env.EVIDENCE_KV.get(key.name);
    if (metadataJson) {
      const metadata: EvidenceMetadata = JSON.parse(metadataJson);
      if (metadata.caseId === caseId) {
        evidence.push(metadata);
      }
    }
  }

  return Response.json({
    caseId,
    count: evidence.length,
    evidence,
  });
});

/**
 * Verify evidence integrity
 */
router.post("/verify/:chittyId", async (request: Request, env: Env) => {
  const { chittyId } = request.params;

  const metadataJson = await env.EVIDENCE_KV.get(`evidence:${chittyId}`);

  if (!metadataJson) {
    return Response.json({ error: "Evidence not found" }, { status: 404 });
  }

  const metadata: EvidenceMetadata = JSON.parse(metadataJson);
  const { sha256 } = metadata;

  // Fetch object from R2
  const object = await env.EVIDENCE_R2.get(
    `objects/${sha256.substring(0, 2)}/${sha256}`,
  );

  if (!object) {
    return Response.json(
      {
        verified: false,
        error: "File not found in storage",
      },
      { status: 404 },
    );
  }

  // Recalculate SHA256
  const arrayBuffer = await object.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const calculatedSha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const verified = calculatedSha256 === sha256;

  return Response.json({
    verified,
    chittyId,
    expectedSha256: sha256,
    calculatedSha256,
  });
});

/**
 * Helper: Classify document domain
 */
function classifyDomain(filename: string): EvidenceMetadata["domain"] {
  const upper = filename.toUpperCase();

  if (
    upper.includes("COURT") ||
    upper.includes("LEGAL") ||
    upper.includes("FILED")
  ) {
    return "LEGAL";
  }
  if (
    upper.includes("LLC") ||
    upper.includes("BUSINESS") ||
    upper.includes("INVOICE")
  ) {
    return "BUSINESS";
  }
  if (
    upper.includes("PERSONAL") ||
    upper.includes("BANK") ||
    upper.includes("TAX")
  ) {
    return "PERSONAL";
  }

  return "GENERAL";
}

/**
 * Helper: Log audit entry
 */
async function logAuditEntry(env: Env, entry: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const key = `audit:${timestamp}:${entry.chittyId}`;

  await env.EVIDENCE_KV.put(key, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 365, // 1 year
  });
}

/**
 * 404 handler
 */
router.all("*", () => {
  return Response.json({ error: "Not found" }, { status: 404 });
});

/**
 * Main worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
