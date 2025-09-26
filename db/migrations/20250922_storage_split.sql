-- Storage Split Migration: Mutable vs Immutable
-- Following ADR-0001: PostgreSQL for metadata, R2/CAS for artifacts

-- Artifact table for CID-addressed content
CREATE TABLE IF NOT EXISTS artifact (
  cid text PRIMARY KEY,
  kind text NOT NULL,
  r2_key text NOT NULL,
  bytes_sha256 text NOT NULL,
  size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Evidence items with CID references
CREATE TABLE IF NOT EXISTS evidence_item (
  id text PRIMARY KEY,          -- evidence_id
  case_id text NOT NULL,
  cid text NOT NULL REFERENCES artifact(cid),
  source text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Chain of custody for legal compliance
CREATE TABLE IF NOT EXISTS chain_of_custody (
  id bigserial PRIMARY KEY,
  evidence_id text NOT NULL REFERENCES evidence_item(id),
  action text NOT NULL,
  actor text,
  ts timestamptz NOT NULL DEFAULT now(),
  cid text NOT NULL,
  signature text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_item(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_cid ON evidence_item(cid);
CREATE INDEX IF NOT EXISTS idx_custody_evidence ON chain_of_custody(evidence_id);
CREATE INDEX IF NOT EXISTS idx_custody_ts ON chain_of_custody(ts);

-- Views for Notion integration
CREATE OR REPLACE VIEW evidence_for_notion AS
SELECT
  e.id as evidence_id,
  e.case_id,
  e.cid,
  a.r2_key,
  a.size as file_size_bytes,
  e.captured_at,
  e.metadata,
  (SELECT COUNT(*) FROM chain_of_custody WHERE evidence_id = e.id) as custody_entries
FROM evidence_item e
JOIN artifact a ON e.cid = a.cid;