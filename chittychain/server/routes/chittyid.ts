import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ChittyIDService } from "../services/ChittyIDService.js";

const router = Router();

// ChittyID generation schema
const generateChittyIDSchema = z.object({
  vertical: z
    .enum(["user", "evidence", "case", "property", "contract", "audit"])
    .optional()
    .default("user"),
  nodeId: z.string().optional().default("1"),
  jurisdiction: z.string().optional().default("USA"),
});

const validateChittyIDSchema = z.object({
  chittyId: z.string().min(1),
});

const bulkGenerateSchema = z.object({
  count: z.number().min(1).max(100).default(10),
  vertical: z
    .enum(["user", "evidence", "case", "property", "contract", "audit"])
    .default("user"),
  nodeId: z.string().default("1"),
  jurisdiction: z.string().default("USA"),
});

const listChittyIDsSchema = z.object({
  vertical: z.string().optional(),
  nodeId: z.string().optional(),
  jurisdiction: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
});

// Health check endpoint
router.get("/health", async (req: Request, res: Response) => {
  try {
    const health = await ChittyIDService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "ChittyID v2.0.0",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ChittyID minting endpoint for @chittyos/chittyid-client compatibility
// Wraps /generate logic with client-expected interface
router.post("/v1/mint", async (req: Request, res: Response) => {
  try {
    // Validate authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message:
          "CHITTY_ID_TOKEN required. Include Authorization: Bearer <token> header.",
      });
    }

    // Parse request body (compatible with @chittyos/chittyid-client)
    const { entity, name, metadata } = req.body;

    // Map entity type to vertical
    const verticalMap: Record<string, string> = {
      PEO: "user",
      PLACE: "property",
      PROP: "property",
      EVNT: "case",
      AUTH: "audit",
      INFO: "user",
      FACT: "evidence",
      CONTEXT: "evidence",
      ACTOR: "user",
    };

    const vertical = (verticalMap[entity || "INFO"] || "user") as
      | "user"
      | "evidence"
      | "case"
      | "property"
      | "contract"
      | "audit";
    const nodeId = metadata?.nodeId || "1";
    const jurisdiction = metadata?.jurisdiction || "USA";

    // Generate ChittyID using existing service
    const chittyId = await ChittyIDService.generateChittyID(
      vertical,
      nodeId,
      jurisdiction,
    );
    const parsed = ChittyIDService.parseChittyID(chittyId);
    const timestamp = ChittyIDService.getTimestamp(chittyId);

    // Store the generated ID
    const record = await ChittyIDService.storeChittyID({
      chittyId,
      vertical,
      nodeId,
      jurisdiction,
      timestamp: timestamp || Date.now(),
      isValid: true,
      metadata: {
        ...metadata,
        entity,
        name,
        generatedViaAPI: true,
        endpoint: "/v1/mint",
        userAgent: req.get("User-Agent"),
      },
    });

    // Return in format expected by @chittyos/chittyid-client
    res.status(201).json({
      chittyId: chittyId,
      entity: entity || "INFO",
      metadata: {
        ...metadata,
        vertical,
        nodeId,
        jurisdiction,
        generatedAt: record.generatedAt.toISOString(),
        recordId: record.id,
      },
      timestamp: parsed?.timestamp || Date.now(),
    });
  } catch (error) {
    console.error("ChittyID minting error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      service: "ChittyID",
    });
  }
});

// Generate ChittyID (backward compatibility endpoint)
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { vertical, nodeId, jurisdiction } = generateChittyIDSchema.parse(
      req.body,
    );

    const chittyId = await ChittyIDService.generateChittyID(
      vertical,
      nodeId,
      jurisdiction,
    );
    const parsed = ChittyIDService.parseChittyID(chittyId);
    const timestamp = ChittyIDService.getTimestamp(chittyId);

    // Store the generated ID
    const record = await ChittyIDService.storeChittyID({
      chittyId,
      vertical,
      nodeId,
      jurisdiction,
      timestamp: timestamp || Date.now(),
      isValid: true,
      metadata: {
        generatedViaAPI: true,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json({
      chittyId,
      displayFormat: chittyId,
      timestamp: parsed?.timestamp,
      vertical: parsed?.vertical,
      valid: ChittyIDService.validateChittyID(chittyId),
      metadata: {
        nodeId,
        jurisdiction,
        generatedAt: record.generatedAt.toISOString(),
        recordId: record.id,
      },
    });
  } catch (error) {
    console.error("ChittyID generation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Validate ChittyID
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { chittyId } = validateChittyIDSchema.parse(req.body);

    const isValid = ChittyIDService.validateChittyID(chittyId);
    const parsed = isValid ? ChittyIDService.parseChittyID(chittyId) : null;
    const stored = await ChittyIDService.getChittyID(chittyId);

    res.json({
      chittyId,
      valid: isValid,
      details: parsed,
      stored: !!stored,
      record: stored || null,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ChittyID validation error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid request",
    });
  }
});

// Get ChittyID by ID
router.get("/:chittyId", async (req: Request, res: Response) => {
  try {
    const { chittyId } = req.params;
    const record = await ChittyIDService.getChittyID(chittyId);

    if (!record) {
      return res.status(404).json({ error: "ChittyID not found" });
    }

    res.json(record);
  } catch (error) {
    console.error("ChittyID retrieval error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// List ChittyIDs with filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const filters = listChittyIDsSchema.parse(req.query);
    const records = await ChittyIDService.listChittyIDs(filters);

    res.json({
      records,
      count: records.length,
      filters,
    });
  } catch (error) {
    console.error("ChittyID listing error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Get statistics
router.get("/stats/overview", async (req: Request, res: Response) => {
  try {
    const stats = await ChittyIDService.getStats();
    res.json(stats);
  } catch (error) {
    console.error("ChittyID stats error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Bulk generate ChittyIDs
router.post("/generate/bulk", async (req: Request, res: Response) => {
  try {
    const options = bulkGenerateSchema.parse(req.body);
    const records = await ChittyIDService.bulkGenerate(options);

    res.json({
      records,
      count: records.length,
      generatedAt: new Date().toISOString(),
      options,
    });
  } catch (error) {
    console.error("Bulk ChittyID generation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Bulk generation failed",
    });
  }
});

export default router;
