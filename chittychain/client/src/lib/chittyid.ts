// ChittyID Core Integration
// Based on the ChittyID v2 specification for blockchain legal evidence management

export interface ChittyIDComponents {
  prefix: string;
  timestamp: string;
  vertical: string;
  nodeId: string;
  sequence: string;
  checksum: string;
}

export interface ChittyIDGenerationRequest {
  vertical?: "user" | "evidence" | "case" | "property" | "contract" | "audit";
  nodeId?: string;
  jurisdiction?: string;
}

export interface ChittyIDValidationResult {
  chittyId: string;
  valid: boolean;
  details?: ChittyIDComponents;
  timestamp?: number;
  vertical?: string;
}

export interface ChittyIDGenerationResult {
  chittyId: string;
  displayFormat: string;
  timestamp?: number;
  vertical?: string;
  valid: boolean;
}

// ChittyID format: CHTTY-{timestamp}-{vertical}-{nodeId}-{sequence}-{checksum}
export class ChittyIDSystem {
  private static readonly PREFIX = "CHTTY";
  private static readonly VERTICALS = [
    "user",
    "evidence",
    "case",
    "property",
    "contract",
    "audit",
  ];

  static async generateChittyID(
    options: ChittyIDGenerationRequest = {},
  ): Promise<string> {
    const { vertical = "user", nodeId = "1", jurisdiction = "USA" } = options;

    if (!this.VERTICALS.includes(vertical)) {
      throw new Error(
        `Invalid vertical: ${vertical}. Must be one of: ${this.VERTICALS.join(", ")}`,
      );
    }

    try {
      // Use central ChittyID service
      const response = await fetch("https://id.chitty.cc/v1/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CHITTY_ID_TOKEN}`,
        },
        body: JSON.stringify({
          entity: vertical.toUpperCase(),
          nodeId,
          jurisdiction,
        }),
      });

      if (!response.ok) {
        throw new Error(`ChittyID service error: ${response.status}`);
      }

      const data = await response.json();
      return data.chittyId || data.id;
    } catch (error) {
      console.error("Failed to generate ChittyID from central service:", error);
      throw new Error(
        "ChittyID generation failed - central service unavailable",
      );
    }
  }

  static async validateChittyID(chittyId: string): Promise<boolean> {
    // ALWAYS use central ChittyID service for validation
    // No local validation allowed per ChittyOS policy
    try {
      const response = await fetch("https://id.chitty.cc/v1/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CHITTY_ID_TOKEN}`,
        },
        body: JSON.stringify({ chittyId }),
      });

      if (!response.ok) {
        throw new Error(
          `ChittyID validation service error: ${response.status}`,
        );
      }

      const data = await response.json();
      return data.valid || false;
    } catch (error) {
      console.error("Failed to validate ChittyID from central service:", error);
      // Per ChittyOS policy: NO FALLBACK - fail if service unavailable
      throw new Error(
        "ChittyID validation failed - central service unavailable. Format must be: VV-G-LLL-SSSS-T-YM-C-X",
      );
    }
  }

  static async parseChittyID(chittyId: string): Promise<ChittyIDComponents | null> {
    // Parse via central service to ensure validation
    const isValid = await this.validateChittyID(chittyId);
    if (!isValid) return null;

    const [prefix, timestamp, vertical, nodeId, sequence, checksum] =
      chittyId.split("-");

    return {
      prefix,
      timestamp,
      vertical: vertical.toLowerCase(),
      nodeId,
      sequence,
      checksum,
    };
  }

  static async getTimestamp(chittyId: string): Promise<number | null> {
    const components = await this.parseChittyID(chittyId);
    if (!components) return null;

    try {
      return parseInt(components.timestamp, 36);
    } catch {
      return null;
    }
  }

  // REMOVED: Local checksum generation violates ChittyOS policy
  // All validation MUST go through id.chitty.cc
  // Format: VV-G-LLL-SSSS-T-YM-C-X NEVER ANYTHING ELSE
}
}

// API integration functions for backend communication
export const chittyIdApi = {
  async generateId(
    options: ChittyIDGenerationRequest,
  ): Promise<ChittyIDGenerationResult> {
    try {
      const response = await fetch("/api/chittyid/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Per ChittyOS policy: NO FALLBACK GENERATION
      // Service must fail if API unavailable
      console.error("ChittyID API unavailable - cannot generate ID:", error);
      throw new Error(
        "ChittyID generation failed - API unavailable. All IDs must come from id.chitty.cc. Format: VV-G-LLL-SSSS-T-YM-C-X",
      );
    }
  },

  async validateId(chittyId: string): Promise<ChittyIDValidationResult> {
    try {
      const response = await fetch("/api/chittyid/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chittyId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Per ChittyOS policy: NO FALLBACK VALIDATION
      // Service must fail if API unavailable
      console.error("ChittyID validation API unavailable:", error);
      throw new Error(
        "ChittyID validation failed - API unavailable. All validation must go through id.chitty.cc. Format: VV-G-LLL-SSSS-T-YM-C-X",
      );
    }
  },
};
