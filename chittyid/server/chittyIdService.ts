import crypto from "crypto";

export interface ChittyIdResponse {
  chittyId: string;
  displayFormat: string;
  timestamp?: string;
  vertical?: string;
  valid: boolean;
}

export interface ChittyIdValidationResponse {
  chittyId: string;
  valid: boolean;
  details?: any;
}

// Identity Service Implementation following ChittyID Architecture
class ChittyIdService {
  private mothershipUrl: string;
  private apiKey: string;
  private nodeId: string;

  constructor() {
    this.mothershipUrl =
      process.env.CHITTYID_MOTHERSHIP_URL || "https://id.chitty.cc";
    this.apiKey = process.env.CHITTYID_API_KEY || "dev-key";
    this.nodeId = process.env.CHITTYID_NODE_ID || "01";
  }

  // Core Identity Service - implements `identity-service.create(domain, type, attrs, ctx)`
  async generateChittyId(
    domain: string = "identity",
    type: string = "person",
    attrs: any = {},
  ): Promise<string> {
    try {
      console.log(
        `🔗 Connecting to ChittyID mothership at ${this.mothershipUrl}`,
      );

      const response = await fetch(
        `${this.mothershipUrl}/api/identity/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "X-Node-ID": this.nodeId,
          },
          body: JSON.stringify({
            domain,
            type,
            attrs,
            ctx: {
              source: "chittyauth",
              timestamp: new Date().toISOString(),
              nodeId: this.nodeId,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `ChittyID mothership API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: ChittyIdResponse = await response.json();
      console.log(`✅ ChittyID generated from mothership: ${data.chittyId}`);
      return data.chittyId || data.displayFormat;
    } catch (error) {
      console.error("❌ ChittyID mothership unavailable:", error.message);
      throw new Error(
        "ChittyID generation requires connection to mothership server at id.chitty.cc. Please try again when the central server is online.",
      );
    }
  }

  async checkMothershipStatus(): Promise<boolean> {
    try {
      console.log(`🔍 Checking ChittyID mothership status...`);

      const response = await fetch(`${this.mothershipUrl}/api/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const isOnline = response.ok;
      console.log(
        `🌐 ChittyID mothership status: ${isOnline ? "ONLINE" : "OFFLINE"}`,
      );
      return isOnline;
    } catch (error) {
      console.log(`🔴 ChittyID mothership OFFLINE: ${error.message}`);
      return false;
    }
  }

  async validateChittyId(chittyId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.mothershipUrl}/api/v1/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ chittyId }),
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error(
          `ChittyID validation API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: ChittyIdValidationResponse = await response.json();
      return data.valid;
    } catch (error) {
      console.error(
        "Failed to validate ChittyID with mothership:",
        error.message,
      );
      throw new Error(
        "ChittyID validation requires connection to mothership server at id.chitty.cc. Please try again when the central server is online.",
      );
    }
  }

  // REMOVED: All local validation fallback code (validateFallbackChittyId, calculateMod97Checksum)
  // SERVICE OR FAIL: ChittyID validation must only use id.chitty.cc mothership
  // If mothership is unavailable, validation must fail (not fallback to local validation)

  // Sync with mothership - registers user with the central system
  async syncUserWithMothership(
    userId: string,
    chittyId: string,
    userData: any,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.mothershipUrl}/api/v1/register-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            chittyId,
            userId,
            metadata: {
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              registrationTimestamp: new Date().toISOString(),
              source: "chittyauth",
            },
          }),
          timeout: 5000,
        },
      );

      if (!response.ok) {
        console.warn(
          `Failed to sync user ${chittyId} with mothership: ${response.status}`,
        );
        return false;
      }

      console.log(`✅ User ${chittyId} synced with ChittyID mothership`);
      return true;
    } catch (error) {
      console.warn(
        `Failed to sync user ${chittyId} with mothership:`,
        error.message,
      );
      return false;
    }
  }
}

export const chittyIdService = new ChittyIdService();
