/**
 * ChittyID Integration Tests
 * Comprehensive test suite for ChittyID service integration
 *
 * Tests the full lifecycle: generation, validation, format enforcement
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import {
  generateChittyID,
  validateChittyIDFormat,
  extractEntityType,
  isChittyID,
  ENTITY_TYPES,
} from "../src/lib/chittyid-service.js";

describe("ChittyID Service Integration", () => {
  beforeAll(() => {
    // Ensure CHITTY_ID_TOKEN is set
    if (!process.env.CHITTY_ID_TOKEN) {
      console.warn("⚠️  CHITTY_ID_TOKEN not set - some tests may be skipped");
    }
  });

  describe("ChittyID Generation", () => {
    test("should generate valid ChittyID from service", async () => {
      const chittyId = await generateChittyID("INFO", { test: true });

      expect(chittyId).toBeDefined();
      expect(typeof chittyId).toBe("string");
      expect(validateChittyIDFormat(chittyId)).toBe(true);
    }, 10000); // 10s timeout for network

    test("should generate ChittyID with correct format pattern", async () => {
      const chittyId = await generateChittyID("INFO", { purpose: "testing" });

      // VV-G-LLL-SSSS-T-YM-C-X pattern
      const pattern = /^\d{2}-[A-Z]-[A-Z]{3}-\d{4}-[A-Z]-\d{4}-\d-[0-9A-Z]+$/;
      expect(chittyId).toMatch(pattern);
    }, 10000);

    test("should generate different ChittyIDs for each request", async () => {
      const id1 = await generateChittyID("INFO");
      const id2 = await generateChittyID("INFO");

      expect(id1).not.toBe(id2);
    }, 10000);

    test("should support all entity types", async () => {
      const entityTypes = Object.keys(ENTITY_TYPES);

      for (const entity of entityTypes) {
        const chittyId = await generateChittyID(entity, { test: entity });
        expect(validateChittyIDFormat(chittyId)).toBe(true);
      }
    }, 30000); // Extended timeout for multiple requests

    test("should reject invalid entity type", async () => {
      await expect(generateChittyID("INVALID_TYPE")).rejects.toThrow(
        "Unsupported ChittyID entity type",
      );
    });

    test("should reject empty entity type", async () => {
      await expect(generateChittyID("")).rejects.toThrow(
        "Unsupported ChittyID entity type",
      );
    });

    test("should reject null entity type", async () => {
      await expect(generateChittyID(null)).rejects.toThrow(
        "Unsupported ChittyID entity type",
      );
    });

    test("should include metadata in generation", async () => {
      const metadata = {
        source: "test-suite",
        timestamp: Date.now(),
        environment: "testing",
      };

      const chittyId = await generateChittyID("INFO", metadata);
      expect(chittyId).toBeDefined();
    }, 10000);
  });

  describe("ChittyID Validation", () => {
    test("should validate correct VV-G-LLL-SSSS-T-YM-C-X format", () => {
      const validIds = [
        "01-A-CHI-1234-I-2409-5-0",
        "01-B-CHI-5678-P-2410-7-12",
        "01-C-TES-9999-E-2510-3-45",
        "02-A-NYC-0001-L-2409-8-67",
      ];

      validIds.forEach((id) => {
        expect(validateChittyIDFormat(id)).toBe(true);
      });
    });

    test("should reject old chitty_ format", () => {
      const oldFormats = [
        "chitty_1234567890_abc123",
        "chitty_9876543210_def456",
        "chitty_timestamp_hash",
      ];

      oldFormats.forEach((id) => {
        expect(validateChittyIDFormat(id)).toBe(false);
      });
    });

    test("should reject legacy CHITTY- format", () => {
      const legacyFormats = [
        "CHITTY-INFO-123-ABC",
        "CHITTY-PEO-456-DEF",
        "CHITTY-EVNT-789-GHI",
      ];

      legacyFormats.forEach((id) => {
        expect(validateChittyIDFormat(id)).toBe(false);
      });
    });

    test("should reject malformed formats", () => {
      const malformed = [
        "1-A-CHI-123-I-24-5-0", // Wrong VV length
        "01-AA-CHI-1234-I-2409-5-0", // Wrong G length
        "01-A-CH-1234-I-2409-5-0", // Wrong LLL length
        "01-A-CHI-123-I-2409-5-0", // Wrong SSSS length
        "01-A-CHI-1234-INFO-2409-5-0", // Wrong T length
        "01-A-CHI-1234-I-24-5-0", // Wrong YM length
        "01-A-CHI-1234-I-2409-55-0", // Wrong C length
        "", // Empty
      ];

      malformed.forEach((id) => {
        expect(validateChittyIDFormat(id)).toBe(false);
      });
    });

    test("should handle null and undefined", () => {
      expect(validateChittyIDFormat(null)).toBe(false);
      expect(validateChittyIDFormat(undefined)).toBe(false);
    });

    test("should handle non-string input", () => {
      expect(validateChittyIDFormat(12345)).toBe(false);
      expect(validateChittyIDFormat({})).toBe(false);
      expect(validateChittyIDFormat([])).toBe(false);
    });
  });

  describe("ChittyID Utilities", () => {
    test("should extract entity type correctly", () => {
      const testCases = [
        { id: "01-A-CHI-1234-I-2409-5-0", expected: "I" },
        { id: "01-A-CHI-5678-P-2409-7-12", expected: "P" },
        { id: "01-C-TES-9999-E-2510-3-45", expected: "E" },
        { id: "02-A-NYC-0001-L-2409-8-67", expected: "L" },
      ];

      testCases.forEach(({ id, expected }) => {
        expect(extractEntityType(id)).toBe(expected);
      });
    });

    test("should return null for invalid ChittyID when extracting type", () => {
      expect(extractEntityType("invalid")).toBe(null);
      expect(extractEntityType("chitty_123_abc")).toBe(null);
      expect(extractEntityType("CHITTY-INFO-123")).toBe(null);
    });

    test("isChittyID should identify valid IDs", () => {
      expect(isChittyID("01-A-CHI-1234-I-2409-5-0")).toBe(true);
      expect(isChittyID("chitty_123_abc")).toBe(false);
      expect(isChittyID("random-string")).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should provide clear error when service unavailable", async () => {
      // Mock service URL to invalid endpoint
      await expect(
        generateChittyID(
          "INFO",
          {},
          { serviceUrl: "https://invalid.chitty.test" },
        ),
      ).rejects.toThrow("Service must be available");
    }, 15000);

    test("should require API key", async () => {
      const originalToken = process.env.CHITTY_ID_TOKEN;
      delete process.env.CHITTY_ID_TOKEN;

      await expect(
        generateChittyID("INFO", {}, { apiKey: "" }),
      ).rejects.toThrow();

      process.env.CHITTY_ID_TOKEN = originalToken;
    });
  });

  describe("Format Compliance", () => {
    test("generated ChittyID should have 8 parts", async () => {
      const chittyId = await generateChittyID("INFO");
      const parts = chittyId.split("-");

      expect(parts).toHaveLength(8);
    }, 10000);

    test("generated ChittyID parts should match specification", async () => {
      const chittyId = await generateChittyID("EVNT", { event: "test" });
      const parts = chittyId.split("-");

      expect(parts[0]).toMatch(/^\d{2}$/); // VV - Version (2 digits)
      expect(parts[1]).toMatch(/^[A-Z]$/); // G - Generation (1 letter)
      expect(parts[2]).toMatch(/^[A-Z]{3}$/); // LLL - Location (3 letters)
      expect(parts[3]).toMatch(/^\d{4}$/); // SSSS - Sequence (4 digits)
      expect(parts[4]).toMatch(/^[A-Z]$/); // T - Type (1 letter)
      expect(parts[5]).toMatch(/^\d{4}$/); // YM - Year/Month (4 digits)
      expect(parts[6]).toMatch(/^\d$/); // C - Check (1 digit)
      expect(parts[7]).toMatch(/^[0-9A-Z]+$/); // X - Extension (alphanumeric)
    }, 10000);

    test("should NEVER generate old formats", async () => {
      const chittyId = await generateChittyID("INFO");

      // Must NOT match old patterns
      expect(chittyId).not.toMatch(/^chitty_/);
      expect(chittyId).not.toMatch(/^CHITTY-/);
      expect(chittyId).not.toMatch(/^CD-/);

      // MUST match new pattern
      expect(chittyId).toMatch(
        /^\d{2}-[A-Z]-[A-Z]{3}-\d{4}-[A-Z]-\d{4}-\d-[0-9A-Z]+$/,
      );
    }, 10000);
  });
});

describe("ChittyID End-to-End Workflow", () => {
  test("complete lifecycle: generate → validate → extract", async () => {
    // Step 1: Generate
    const chittyId = await generateChittyID("EVNT", {
      name: "E2E Test Event",
      timestamp: Date.now(),
    });

    expect(chittyId).toBeDefined();
    console.log(`Generated ChittyID: ${chittyId}`);

    // Step 2: Validate
    const isValid = validateChittyIDFormat(chittyId);
    expect(isValid).toBe(true);

    // Step 3: Extract entity type
    const entityType = extractEntityType(chittyId);
    expect(entityType).toBe("E"); // EVNT → E

    // Step 4: Verify it's recognized as a ChittyID
    expect(isChittyID(chittyId)).toBe(true);

    // Step 5: Verify format structure
    const parts = chittyId.split("-");
    expect(parts).toHaveLength(8);
    expect(parts[4]).toBe("E"); // Type should be E for EVNT

    console.log(`✅ E2E workflow complete: ${chittyId}`);
  }, 15000);

  test("multiple entity types in sequence", async () => {
    const testEntities = ["PEO", "PLACE", "PROP", "EVNT", "INFO"];
    const generatedIds = [];

    for (const entity of testEntities) {
      const id = await generateChittyID(entity, { test: entity });
      generatedIds.push(id);

      expect(validateChittyIDFormat(id)).toBe(true);
      console.log(`${entity}: ${id}`);
    }

    // All should be unique
    const uniqueIds = new Set(generatedIds);
    expect(uniqueIds.size).toBe(generatedIds.length);
  }, 30000);
});
