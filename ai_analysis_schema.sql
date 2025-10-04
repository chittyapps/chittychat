-- =====================================================
-- AI Analysis & Review Schema Extension
-- For ChittySchema Centralized Architecture
-- Integrates Claude, GPT, and other AI model analysis
-- =====================================================

-- AI Analysis Sessions
CREATE TABLE IF NOT EXISTS ai_analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,

    -- Session Context
    case_id UUID REFERENCES cases(id),
    evidence_id UUID REFERENCES evidence(id),
    document_cid TEXT,

    -- AI Model Information
    model_provider TEXT NOT NULL CHECK (model_provider IN ('CLAUDE', 'GPT', 'GEMINI', 'LLAMA', 'MISTRAL', 'CHITTYROUTER')),
    model_version TEXT NOT NULL, -- e.g., 'claude-3-opus', 'gpt-4-turbo'
    routing_method TEXT DEFAULT 'CHITTYROUTER', -- Always route through ChittyRouter

    -- Analysis Type
    analysis_type TEXT NOT NULL CHECK (analysis_type IN (
        'DOCUMENT_REVIEW',
        'CONTRADICTION_DETECTION',
        'ENTITY_EXTRACTION',
        'TIMELINE_ANALYSIS',
        'LEGAL_RESEARCH',
        'CASE_STRATEGY',
        'EVIDENCE_EVALUATION',
        'RISK_ASSESSMENT',
        'COMPLIANCE_CHECK'
    )),

    -- Request Information
    prompt TEXT NOT NULL,
    prompt_hash TEXT NOT NULL, -- SHA-256 of prompt for deduplication
    context_window_size INTEGER,
    temperature DECIMAL(2,1),
    max_tokens INTEGER,

    -- Response & Results
    response_text TEXT,
    structured_output JSONB, -- Parsed structured data from response
    confidence_scores JSONB, -- Confidence scores for different aspects

    -- Extracted Insights
    entities_extracted JSONB, -- People, places, dates, amounts
    contradictions_found JSONB, -- Array of contradiction objects
    legal_citations JSONB, -- Legal references found
    risk_factors JSONB, -- Identified risks
    recommendations JSONB, -- AI recommendations

    -- Quality & Validation
    review_status TEXT DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW')),
    reviewed_by UUID REFERENCES people(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Performance Metrics
    request_tokens INTEGER,
    response_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    cost_usd DECIMAL(10,4),

    -- Chain of Analysis (for multi-step reasoning)
    parent_analysis_id UUID REFERENCES ai_analysis_sessions(id),
    analysis_chain JSONB, -- Array of analysis steps

    -- Event Sourcing Integration
    event_id UUID REFERENCES event_store(id),

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI Analysis
CREATE INDEX idx_ai_analysis_case ON ai_analysis_sessions(case_id);
CREATE INDEX idx_ai_analysis_evidence ON ai_analysis_sessions(evidence_id);
CREATE INDEX idx_ai_analysis_model ON ai_analysis_sessions(model_provider, model_version);
CREATE INDEX idx_ai_analysis_type ON ai_analysis_sessions(analysis_type);
CREATE INDEX idx_ai_analysis_status ON ai_analysis_sessions(review_status);
CREATE INDEX idx_ai_analysis_prompt_hash ON ai_analysis_sessions(prompt_hash);
CREATE INDEX idx_ai_analysis_created ON ai_analysis_sessions(created_at DESC);

-- AI Comparative Analysis (for multi-model consensus)
CREATE TABLE IF NOT EXISTS ai_comparative_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,

    -- Subject of Comparison
    subject_type TEXT NOT NULL CHECK (subject_type IN ('EVIDENCE', 'DOCUMENT', 'TESTIMONY', 'TIMELINE', 'CASE_STRATEGY')),
    subject_id UUID, -- References appropriate table based on subject_type

    -- Analysis Sessions Being Compared
    claude_analysis_id UUID REFERENCES ai_analysis_sessions(id),
    gpt_analysis_id UUID REFERENCES ai_analysis_sessions(id),
    other_analysis_ids UUID[], -- Array of additional analysis IDs

    -- Consensus Metrics
    agreement_score DECIMAL(3,2), -- 0.00 to 1.00
    divergence_points JSONB, -- Where models disagree
    consensus_findings JSONB, -- Where models agree

    -- Synthesized Results
    final_conclusion TEXT,
    confidence_level TEXT CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW', 'CONFLICTING')),
    requires_human_review BOOLEAN DEFAULT FALSE,

    -- Metadata
    comparison_methodology TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Training Feedback (for improving analysis)
CREATE TABLE IF NOT EXISTS ai_training_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to Analysis
    analysis_id UUID REFERENCES ai_analysis_sessions(id) NOT NULL,

    -- Feedback Information
    feedback_type TEXT CHECK (feedback_type IN ('CORRECTION', 'VALIDATION', 'ENHANCEMENT', 'FALSE_POSITIVE', 'FALSE_NEGATIVE')),
    feedback_text TEXT,

    -- Corrected Data
    corrected_entities JSONB,
    corrected_contradictions JSONB,
    corrected_conclusions TEXT,

    -- Quality Metrics
    accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
    usefulness_rating INTEGER CHECK (usefulness_rating BETWEEN 1 AND 5),

    -- Submitted By
    submitted_by UUID REFERENCES people(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),

    -- Training Status
    used_for_training BOOLEAN DEFAULT FALSE,
    training_batch_id TEXT
);

-- AI Model Performance Tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Model Information
    model_provider TEXT NOT NULL,
    model_version TEXT NOT NULL,

    -- Performance Window
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Metrics
    total_requests INTEGER,
    successful_requests INTEGER,
    failed_requests INTEGER,
    average_latency_ms DECIMAL(10,2),
    average_tokens_per_request DECIMAL(10,2),
    total_cost_usd DECIMAL(10,2),

    -- Quality Metrics (from feedback)
    average_accuracy_rating DECIMAL(3,2),
    average_usefulness_rating DECIMAL(3,2),
    contradiction_detection_rate DECIMAL(3,2),
    entity_extraction_accuracy DECIMAL(3,2),

    -- Comparative Performance
    rank_in_category INTEGER,
    preferred_for_types TEXT[],

    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(model_provider, model_version, period_start, period_end)
);

-- Create event triggers for AI analysis
CREATE OR REPLACE FUNCTION log_ai_analysis_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO event_store (
        chitty_id,
        aggregate_id,
        aggregate_type,
        event_type,
        event_data,
        event_version,
        event_hash,
        metadata
    ) VALUES (
        NEW.chitty_id,
        NEW.id,
        'ai_analysis',
        TG_OP || '_ANALYSIS',
        to_jsonb(NEW),
        1,
        encode(sha256(to_jsonb(NEW)::text::bytea), 'hex'),
        jsonb_build_object(
            'model_provider', NEW.model_provider,
            'analysis_type', NEW.analysis_type,
            'case_id', NEW.case_id
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER ai_analysis_event_log
AFTER INSERT OR UPDATE ON ai_analysis_sessions
FOR EACH ROW EXECUTE FUNCTION log_ai_analysis_event();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO neondb_owner;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO neondb_owner;