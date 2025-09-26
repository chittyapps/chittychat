
-- Useful queries for evidence analysis

-- 1. Get all evidence for a case with relevance scores
SELECT
    e.chitty_id,
    e.file_name,
    e.classification,
    a.relevance_score,
    e.confidence_score
FROM evidence_items e
LEFT JOIN ai_processing a ON e.chitty_id = a.chitty_id
WHERE e.case_id = '2024D007847'
ORDER BY a.relevance_score DESC NULLS LAST;

-- 2. Find contradictions
SELECT
    e1.file_name as source_file,
    e2.file_name as target_file,
    r.relationship_type,
    r.confidence
FROM evidence_relationships r
JOIN evidence_items e1 ON r.source_chitty_id = e1.chitty_id
JOIN evidence_items e2 ON r.target_chitty_id = e2.chitty_id
WHERE r.relationship_type = 'CONTRADICTS'
ORDER BY r.confidence DESC;

-- 3. Get timeline events
SELECT
    chitty_id,
    file_name,
    metadata->>'description' as description,
    created_at
FROM evidence_items
WHERE classification IN ('TIMELINE_DATA', 'TIMELINE_INTEGRATION')
ORDER BY created_at;

-- 4. AI processing summary
SELECT
    processing_type,
    COUNT(*) as count,
    AVG(confidence) as avg_confidence,
    AVG(relevance_score) as avg_relevance
FROM ai_processing
GROUP BY processing_type;

-- 5. Storage usage
SELECT
    COUNT(*) as file_count,
    SUM(size_bytes) as total_bytes,
    SUM(size_bytes) / 1024 / 1024 as total_mb
FROM artifacts;
