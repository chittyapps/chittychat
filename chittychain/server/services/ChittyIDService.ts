import { neonStorage as storage } from "../neon-storage.js";
import type { IStorage } from "../storage.js";

export interface ChittyIDComponents {
  prefix: string;
  timestamp: string;
  vertical: string;
  nodeId: string;
  sequence: string;
  checksum: string;
}

export interface ChittyIDRecord {
  id: string;
  chittyId: string;
  vertical: string;
  nodeId: string;
  jurisdiction: string;
  timestamp: number;
  generatedAt: Date;
  isValid: boolean;
  metadata?: Record<string, any>;
}

export class ChittyIDService {
  private static readonly PREFIX = "CHTTY";
  private static readonly VERTICALS = [
    "user",
    "evidence",
    "case",
    "property",
    "contract",
    "audit",
  ];
  private static sequence = 0;

  static async generateChittyID(
    vertical: string = "user",
    nodeId: string = "1",
    jurisdiction: string = "USA",
  ): Promise<string> {
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

  static async parseChittyID(
    chittyId: string,
  ): Promise<ChittyIDComponents | null> {
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

  // REMOVED: generateChecksum method violates ChittyOS policy
  // All validation MUST go through id.chitty.cc
  // Format: VV-G-LLL-SSSS-T-YM-C-X NEVER ANYTHING ELSE

  // Database operations using audit logs for storage
  static async storeChittyID(
    record: Omit<ChittyIDRecord, "id" | "generatedAt">,
  ): Promise<ChittyIDRecord> {
    // Use crypto.randomUUID() for internal record IDs (not ChittyIDs)
    const id = crypto.randomUUID();
    const fullRecord: ChittyIDRecord = {
      ...record,
      id,
      generatedAt: new Date(),
    };

    // Store as audit log
    try {
      await storage.createAuditLog({
        id: id,
        action: "chittyid_generated",
        details: JSON.stringify(fullRecord),
        timestamp: new Date(),
        userId: null,
        metadata: {
          chittyId: record.chittyId,
          vertical: record.vertical,
          nodeId: record.nodeId,
        },
      });
    } catch (error) {
      console.error("Failed to store ChittyID:", error);
    }

    return fullRecord;
  }

  static async getChittyID(chittyId: string): Promise<ChittyIDRecord | null> {
    try {
      const auditLogs = await storage.getAllAuditLogs();
      const chittyIdLog = auditLogs.find(
        (log) =>
          log.action === "chittyid_generated" &&
          log.metadata?.chittyId === chittyId,
      );

      if (chittyIdLog) {
        return JSON.parse(chittyIdLog.details) as ChittyIDRecord;
      }
      return null;
    } catch {
      return null;
    }
  }

  static async listChittyIDs(filters?: {
    vertical?: string;
    nodeId?: string;
    jurisdiction?: string;
    limit?: number;
  }): Promise<ChittyIDRecord[]> {
    try {
      const auditLogs = await storage.getAllAuditLogs();
      let records = auditLogs
        .filter((log) => log.action === "chittyid_generated")
        .map((log) => {
          try {
            return JSON.parse(log.details) as ChittyIDRecord;
          } catch {
            return null;
          }
        })
        .filter((record) => record !== null);

      if (filters) {
        if (filters.vertical) {
          records = records.filter((r) => r.vertical === filters.vertical);
        }
        if (filters.nodeId) {
          records = records.filter((r) => r.nodeId === filters.nodeId);
        }
        if (filters.jurisdiction) {
          records = records.filter(
            (r) => r.jurisdiction === filters.jurisdiction,
          );
        }
        if (filters.limit) {
          records = records.slice(0, filters.limit);
        }
      }

      return records.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  static async getStats(): Promise<{
    total: number;
    byVertical: Record<string, number>;
    byNode: Record<string, number>;
    recentCount: number;
  }> {
    try {
      const records = await this.listChittyIDs();
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const byVertical: Record<string, number> = {};
      const byNode: Record<string, number> = {};
      let recentCount = 0;

      records.forEach((record) => {
        byVertical[record.vertical] = (byVertical[record.vertical] || 0) + 1;
        byNode[record.nodeId] = (byNode[record.nodeId] || 0) + 1;

        if (record.timestamp > oneDayAgo) {
          recentCount++;
        }
      });

      return {
        total: records.length,
        byVertical,
        byNode,
        recentCount,
      };
    } catch {
      return {
        total: 0,
        byVertical: {},
        byNode: {},
        recentCount: 0,
      };
    }
  }

  // Bulk operations
  static async bulkGenerate(options: {
    count: number;
    vertical: string;
    nodeId: string;
    jurisdiction: string;
  }): Promise<ChittyIDRecord[]> {
    const { count, vertical, nodeId, jurisdiction } = options;

    if (count > 100) {
      throw new Error("Maximum bulk generation limit is 100 IDs");
    }

    const records: ChittyIDRecord[] = [];

    for (let i = 0; i < count; i++) {
      const chittyId = await this.generateChittyID(
        vertical,
        nodeId,
        jurisdiction,
      );
      const timestamp = this.getTimestamp(chittyId);

      const record = await this.storeChittyID({
        chittyId,
        vertical,
        nodeId,
        jurisdiction,
        timestamp: timestamp || Date.now(),
        isValid: true,
        metadata: {
          bulkGenerated: true,
          batchIndex: i,
        },
      });

      records.push(record);
    }

    return records;
  }

  // Health check and system status
  static async healthCheck(): Promise<{
    status: "ok" | "degraded" | "error";
    version: string;
    uptime: number;
    lastGenerated?: Date;
    totalGenerated: number;
  }> {
    try {
      const stats = await this.getStats();
      const records = await this.listChittyIDs({ limit: 1 });
      const lastRecord = records[0];

      return {
        status: "ok",
        version: "2.0.0",
        uptime: process.uptime(),
        lastGenerated: lastRecord?.generatedAt,
        totalGenerated: stats.total,
      };
    } catch {
      return {
        status: "error",
        version: "2.0.0",
        uptime: process.uptime(),
        totalGenerated: 0,
      };
    }
  }
}
