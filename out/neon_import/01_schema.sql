
-- Neon Evidence Database Schema
-- Case: 2024D007847

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Artifacts table (content-addressed storage)
CREATE TABLE IF NOT EXISTS artifacts (
    cid TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence items table (ChittyID indexed)
CREATE TABLE IF NOT EXISTS evidence_items (
    chitty_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    cid TEXT REFERENCES artifacts(cid),
    file_name TEXT NOT NULL,
    file_type TEXT,
    classification TEXT,
    legal_hold BOOLEAN DEFAULT true,
    verification_status TEXT DEFAULT 'PENDING',
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- AI processing results
CREATE TABLE IF NOT EXISTS ai_processing (
    processing_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chitty_id TEXT REFERENCES evidence_items(chitty_id),
    processing_type TEXT NOT NULL,
    model_used TEXT,
    confidence DECIMAL(3,2),
    entities JSONB,
    classifications JSONB,
    relevance_score INTEGER,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    results JSONB
);

-- Evidence relationships
CREATE TABLE IF NOT EXISTS evidence_relationships (
    relationship_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_chitty_id TEXT REFERENCES evidence_items(chitty_id),
    target_chitty_id TEXT REFERENCES evidence_items(chitty_id),
    relationship_type TEXT NOT NULL,
    confidence DECIMAL(3,2),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Session tracking
CREATE TABLE IF NOT EXISTS processing_sessions (
    session_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id TEXT NOT NULL,
    session_type TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    items_processed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'RUNNING',
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_evidence_case_id ON evidence_items(case_id);
CREATE INDEX idx_evidence_classification ON evidence_items(classification);
CREATE INDEX idx_evidence_created ON evidence_items(created_at DESC);
CREATE INDEX idx_ai_processing_chitty_id ON ai_processing(chitty_id);
CREATE INDEX idx_ai_relevance ON ai_processing(relevance_score DESC);
CREATE INDEX idx_relationships_source ON evidence_relationships(source_chitty_id);
CREATE INDEX idx_relationships_target ON evidence_relationships(target_chitty_id);
CREATE INDEX idx_sessions_case ON processing_sessions(case_id, started_at DESC);

-- Full text search
CREATE INDEX idx_evidence_metadata_gin ON evidence_items USING gin(metadata);
CREATE INDEX idx_ai_results_gin ON ai_processing USING gin(results);
