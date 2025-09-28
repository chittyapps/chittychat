/**
 * Master Document Entity Schema
 * Single source of truth linking legal and technical ID systems
 */

export const MasterEntitySchema = {
  // Primary identifier - internal UUID
  id: 'uuid',

  // ID Systems (Hybrid)
  identifiers: {
    // Technical ID for developers/operations
    technical: 'AA-C-TSK-1234-I-25-7-X',  // Format: AA-{domain}-{namespace}-{seq}-{type}-{date}-{checksum}-{validation}

    // Legal ID for compliance/business
    legal: '01-N-USA-1234-P-25-3-X',       // Format: {version}-{region}-{jurisdiction}-{seq}-{entity}-{date}-{trust}-{checksum}

    // Internal reference (optional)
    internal: 'uuid-v4'
  },

  // Core metadata
  metadata: {
    content_hash: 'sha256',
    lifecycle_status: ['draft', 'active', 'archived', 'deleted'],
    created_at: 'timestamp',
    updated_at: 'timestamp',
    version: 'integer',

    // Data governance
    steward: {
      technical: 'user_id',  // Technical data steward
      legal: 'user_id'       // Legal data steward
    },

    // Compliance tracking
    compliance: {
      jurisdictions: ['USA', 'EU', 'UK'],
      classification: ['public', 'internal', 'confidential', 'restricted'],
      retention_policy: 'policy_id',
      audit_trail: 'audit_log_id'
    }
  },

  // Content (varies by entity type)
  content: {
    type: ['todo', 'document', 'person', 'property', 'evidence'],
    data: 'json',           // Entity-specific data
    attachments: 'array',   // File references
    relationships: 'array'  // Links to other entities
  },

  // System tracking
  system: {
    source: ['cli', 'notion', 'github', 'api'],
    sync_status: {
      github: 'timestamp',
      notion: 'timestamp',
      neon: 'timestamp'
    },
    conflicts: 'array',     // Merge conflicts
    resolution: 'json'      // Conflict resolution data
  }
};

/**
 * Database schema for Neon PostgreSQL
 */
export const PostgreSQLSchema = `
  CREATE TABLE IF NOT EXISTS master_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ID Systems
    technical_id VARCHAR(50) UNIQUE NOT NULL,
    legal_id VARCHAR(50) UNIQUE,
    internal_id UUID,

    -- Core metadata
    content_hash VARCHAR(64) NOT NULL,
    lifecycle_status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,

    -- Data governance
    technical_steward VARCHAR(100),
    legal_steward VARCHAR(100),

    -- Compliance
    jurisdictions TEXT[],
    classification VARCHAR(20) DEFAULT 'internal',
    retention_policy VARCHAR(100),
    audit_trail_id UUID,

    -- Content
    entity_type VARCHAR(50) NOT NULL,
    content_data JSONB,
    attachments JSONB,
    relationships JSONB,

    -- System tracking
    source_system VARCHAR(50),
    sync_status JSONB,
    conflicts JSONB,
    resolution_data JSONB,

    -- Indexes for performance
    CONSTRAINT valid_lifecycle_status CHECK (lifecycle_status IN ('draft', 'active', 'archived', 'deleted')),
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('todo', 'document', 'person', 'property', 'evidence')),
    CONSTRAINT valid_classification CHECK (classification IN ('public', 'internal', 'confidential', 'restricted'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_master_entities_technical_id ON master_entities(technical_id);
  CREATE INDEX IF NOT EXISTS idx_master_entities_legal_id ON master_entities(legal_id);
  CREATE INDEX IF NOT EXISTS idx_master_entities_entity_type ON master_entities(entity_type);
  CREATE INDEX IF NOT EXISTS idx_master_entities_lifecycle ON master_entities(lifecycle_status);
  CREATE INDEX IF NOT EXISTS idx_master_entities_content_hash ON master_entities(content_hash);

  -- ID mapping table for fast lookups
  CREATE TABLE IF NOT EXISTS id_mappings (
    technical_id VARCHAR(50) PRIMARY KEY,
    legal_id VARCHAR(50),
    internal_id UUID,
    entity_id UUID REFERENCES master_entities(id),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(legal_id),
    UNIQUE(internal_id)
  );

  CREATE INDEX IF NOT EXISTS idx_id_mappings_legal ON id_mappings(legal_id);
  CREATE INDEX IF NOT EXISTS idx_id_mappings_internal ON id_mappings(internal_id);
`;

/**
 * Data governance rules
 */
export const GovernanceRules = {
  // ID Generation Rules
  technical_id: {
    format: /^AA-[CE]-[A-Z]{3}-\d{4}-[ILAV]-\d{2}-\d+-[A-Z]$/,
    domains: ['C', 'E'],  // C=standard, E=error/fallback
    namespaces: ['TSK', 'DOC', 'USR', 'PRP', 'EVD'],
    types: ['I', 'L', 'A', 'V'],  // Individual, List, Aggregate, Verification
    sequence_generation: 'crypto.randomInt(1000, 9999)'  // SSSS = 4-digit random
  },

  legal_id: {
    format: /^\d{2}-[A-Z]-[A-Z]{3}-\d{4}-[PLTE]-\d{2}-\d+-[A-Z]$/,
    regions: ['N', 'E', 'A', 'P'],  // North America, Europe, Asia, Pacific
    jurisdictions: ['USA', 'GBR', 'DEU', 'FRA', 'CAN'],
    entity_types: ['P', 'L', 'T', 'E'],  // Person, Location, Thing, Event
    trust_levels: [0, 1, 2, 3, 4, 5],
    sequence_generation: 'crypto.randomInt(1000, 9999)'  // SSSS = 4-digit random
  },

  // Stewardship Rules
  stewardship: {
    technical: {
      responsibilities: [
        'Technical ID format compliance',
        'System integration validation',
        'Performance optimization',
        'API endpoint management'
      ],
      escalation: 'technical-lead@chitty.cc'
    },

    legal: {
      responsibilities: [
        'Legal ID format compliance',
        'Jurisdictional requirements',
        'Compliance reporting',
        'Audit trail maintenance'
      ],
      escalation: 'legal-lead@chitty.cc'
    }
  },

  // Data Quality Rules
  quality: {
    required_fields: ['technical_id', 'content_hash', 'entity_type'],
    validation_rules: {
      content_hash: 'Must be valid SHA-256 hash',
      technical_id: 'Must follow AA-{domain}-{namespace} format',
      legal_id: 'Must follow {version}-{region}-{jurisdiction} format when present'
    },

    conflict_resolution: {
      priority: ['legal_steward', 'technical_steward', 'system_automated'],
      timeout: '24_hours',
      escalation: 'data-governance@chitty.cc'
    }
  }
};

/**
 * Entity factory for creating master records
 */
export class MasterEntityFactory {
  constructor(config = {}) {
    this.technical_steward = config.technical_steward;
    this.legal_steward = config.legal_steward;
    this.default_jurisdiction = config.default_jurisdiction || 'USA';
  }

  /**
   * Create a new master entity
   */
  async createEntity({
    technical_id,
    legal_id = null,
    entity_type,
    content_data,
    source_system,
    classification = 'internal'
  }) {
    // Validate IDs
    if (!this.validateTechnicalId(technical_id)) {
      throw new Error(`Invalid technical ID format: ${technical_id}`);
    }

    if (legal_id && !this.validateLegalId(legal_id)) {
      throw new Error(`Invalid legal ID format: ${legal_id}`);
    }

    // Generate content hash
    const content_hash = this.generateContentHash(content_data);

    // Create master entity
    const entity = {
      technical_id,
      legal_id,
      content_hash,
      entity_type,
      content_data,
      source_system,
      classification,
      technical_steward: this.technical_steward,
      legal_steward: this.legal_steward,
      jurisdictions: [this.default_jurisdiction],
      lifecycle_status: 'draft',
      sync_status: {},
      conflicts: [],
      version: 1
    };

    return entity;
  }

  /**
   * Validate technical ID format
   */
  validateTechnicalId(id) {
    return GovernanceRules.technical_id.format.test(id);
  }

  /**
   * Validate legal ID format
   */
  validateLegalId(id) {
    return GovernanceRules.legal_id.format.test(id);
  }

  /**
   * Generate content hash
   */
  generateContentHash(content) {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  /**
   * Link technical and legal IDs
   */
  async linkIds(technical_id, legal_id) {
    // Update mapping table
    return {
      technical_id,
      legal_id,
      linked_at: new Date(),
      steward: this.legal_steward
    };
  }
}

export default {
  MasterEntitySchema,
  PostgreSQLSchema,
  GovernanceRules,
  MasterEntityFactory
};