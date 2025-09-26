
-- Artifacts data

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafk92743ab2faf34fd81586cd88a37b9369d1061ebaa1f1112b6732', 'evidence/2024D007847/92743ab2faf34fd8_FINAL_INTEGRATED_DISCOVERY_REPORT.md', '92743ab2faf34fd81586cd88a37b9369d1061ebaa1f1112b673203f5f61ee2a2', 10240, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafkd3a663bb5437fb54a50a1434f97fdaf56d5cbbdcb1a3b51cedb8', 'evidence/2024D007847/d3a663bb5437fb54_evidence_analysis_complete.md', 'd3a663bb5437fb54a50a1434f97fdaf56d5cbbdcb1a3b51cedb8e730bc952219', 11264, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafka2ddf678858297d356ffcaa31179451757d9d2d197013edeb301', 'evidence/2024D007847/a2ddf678858297d3_openphone_critical_evidence.md', 'a2ddf678858297d356ffcaa31179451757d9d2d197013edeb3018058c5ac0c9d', 12288, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafkcc483813b7aedcbcce336af06390afc5a6ece84d82bc8a8c49fb', 'evidence/2024D007847/cc483813b7aedcbc_message_contradictions_summary.md', 'cc483813b7aedcbcce336af06390afc5a6ece84d82bc8a8c49fb8b32cc2abbab', 13312, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafkefcc362e19c4e8a48149de1fd0bc7954454ac3c508481535bf25', 'evidence/2024D007847/efcc362e19c4e8a4_integrated_communication_timeline.md', 'efcc362e19c4e8a48149de1fd0bc7954454ac3c508481535bf25dcaf7fbc9311', 14336, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafk04f30373b256a1f9ab9a5674004120e56d9d85767f86b8756c1a', 'evidence/2024D007847/04f30373b256a1f9_timeline_master.csv', '04f30373b256a1f9ab9a5674004120e56d9d85767f86b8756c1a50283d887f54', 15360, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafkad82096c1da9590cd9bcfba602d99b75812b62f6ec556af5387d', 'evidence/2024D007847/ad82096c1da9590c_exhibit_index.csv', 'ad82096c1da9590cd9bcfba602d99b75812b62f6ec556af5387d6c68ee30b48d', 16384, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafkc7f89c4d27dd6b93fc2710bc4d01027f05ee1aac6291b964bc96', 'evidence/2024D007847/c7f89c4d27dd6b93_openphone_critical_analysis.json', 'c7f89c4d27dd6b93fc2710bc4d01027f05ee1aac6291b964bc96325eaa07a0ae', 17408, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafk35f138231a941bf651945c92dff083844e673b77ef48e34141db', 'evidence/2024D007847/35f138231a941bf6_contradictions.md', '35f138231a941bf651945c92dff083844e673b77ef48e34141db7623d85ec166', 18432, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

INSERT INTO artifacts (cid, r2_key, sha256, size_bytes, mime_type)
VALUES ('bafk62253e5aa697e9d225e699d24747db4e0caeafa1f8f96ab20aa9', 'evidence/2024D007847/62253e5aa697e9d2_findings_summary.md', '62253e5aa697e9d225e699d24747db4e0caeafa1f8f96ab20aa98961d541e4b0', 19456, 'text/plain')
ON CONFLICT (cid) DO NOTHING;

-- Evidence items data

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2000-3-2501-L-98', '2024D007847', 'bafk92743ab2faf34fd81586cd88a37b9369d1061ebaa1f1112b6732', 'FINAL_INTEGRATED_DISCOVERY_REPORT.md', 'MD',
        'COMPREHENSIVE_ANALYSIS', 0.95, '{"description": "Complete integrated discovery analysis", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["comprehensive_analysis", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2001-3-2501-L-97', '2024D007847', 'bafkd3a663bb5437fb54a50a1434f97fdaf56d5cbbdcb1a3b51cedb8', 'evidence_analysis_complete.md', 'MD',
        'ANALYSIS_SUMMARY', 0.92, '{"description": "Executive summary of evidence analysis", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["analysis_summary", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2002-3-2501-L-96', '2024D007847', 'bafka2ddf678858297d356ffcaa31179451757d9d2d197013edeb301', 'openphone_critical_evidence.md', 'MD',
        'BUSINESS_COMMUNICATIONS', 0.88, '{"description": "OpenPhone business communications critical period", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["business_communications", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2003-3-2501-L-95', '2024D007847', 'bafkcc483813b7aedcbcce336af06390afc5a6ece84d82bc8a8c49fb', 'message_contradictions_summary.md', 'MD',
        'CONTRADICTION_EVIDENCE', 0.94, '{"description": "iMessage contradictions to TRO claims", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["contradiction_evidence", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2004-3-2501-L-94', '2024D007847', 'bafkefcc362e19c4e8a48149de1fd0bc7954454ac3c508481535bf25', 'integrated_communication_timeline.md', 'MD',
        'TIMELINE_INTEGRATION', 0.9, '{"description": "Multi-platform communication timeline", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["timeline_integration", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2005-3-2501-L-93', '2024D007847', 'bafk04f30373b256a1f9ab9a5674004120e56d9d85767f86b8756c1a', 'timeline_master.csv', 'CSV',
        'TIMELINE_DATA', 0.85, '{"description": "Master timeline with 1,433 events", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["timeline_data", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2006-3-2501-L-92', '2024D007847', 'bafkad82096c1da9590cd9bcfba602d99b75812b62f6ec556af5387d', 'exhibit_index.csv', 'CSV',
        'EXHIBIT_CATALOG', 0.82, '{"description": "Complete exhibit indexing system", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["exhibit_catalog", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2007-3-2501-L-91', '2024D007847', 'bafkc7f89c4d27dd6b93fc2710bc4d01027f05ee1aac6291b964bc96', 'openphone_critical_analysis.json', 'JSON',
        'STRUCTURED_DATA', 0.87, '{"description": "OpenPhone analysis structured format", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["structured_data", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2008-3-2501-L-90', '2024D007847', 'bafk35f138231a941bf651945c92dff083844e673b77ef48e34141db', 'contradictions.md', 'MD',
        'CONTRADICTION_ANALYSIS', 0.91, '{"description": "Detailed contradiction analysis", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["contradiction_analysis", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

INSERT INTO evidence_items (chitty_id, case_id, cid, file_name, file_type, classification, confidence_score, metadata)
VALUES ('CT-01-1-CHI-2009-3-2501-L-89', '2024D007847', 'bafk62253e5aa697e9d225e699d24747db4e0caeafa1f8f96ab20aa9', 'findings_summary.md', 'MD',
        'FINDINGS_REPORT', 0.89, '{"description": "Summary of key findings", "source": "evidence_analyzer", "processing_version": "2.0", "tags": ["findings_report", "legal", "2024"]}'::jsonb)
ON CONFLICT (chitty_id) DO UPDATE
SET updated_at = NOW(), metadata = EXCLUDED.metadata;

-- AI processing results

INSERT INTO ai_processing (chitty_id, processing_type, model_used, confidence, entities, classifications, relevance_score, results)
VALUES ('CT-01-1-CHI-2000-3-2501-L-98', 'ENTITY_EXTRACTION', 'gpt-4-turbo', 0.95,
        '{"people": ["Nicholas Bernardi", "Nicole Bernardi"], "organizations": ["Clearpath Networks LLC", "ANC Technology Group"], "dates": ["2024-12-10", "2024-12-19"], "amounts": ["$600,000", "$23,333.70"]}'::jsonb, '{"primary": "COMPREHENSIVE_ANALYSIS", "secondary": ["LEGAL_DOCUMENT", "EVIDENCE"], "confidence": 0.95}'::jsonb, 95,
        '{"status": "completed", "tokens": 1500}'::jsonb);

INSERT INTO ai_processing (chitty_id, processing_type, model_used, confidence, entities, classifications, relevance_score, results)
VALUES ('CT-01-1-CHI-2001-3-2501-L-97', 'ENTITY_EXTRACTION', 'gpt-4-turbo', 0.92,
        '{"people": ["Nicholas Bernardi", "Nicole Bernardi"], "organizations": ["Clearpath Networks LLC", "ANC Technology Group"], "dates": ["2024-12-10", "2024-12-19"], "amounts": ["$600,000", "$23,333.70"]}'::jsonb, '{"primary": "ANALYSIS_SUMMARY", "secondary": ["LEGAL_DOCUMENT", "EVIDENCE"], "confidence": 0.92}'::jsonb, 92,
        '{"status": "completed", "tokens": 1600}'::jsonb);

INSERT INTO ai_processing (chitty_id, processing_type, model_used, confidence, entities, classifications, relevance_score, results)
VALUES ('CT-01-1-CHI-2002-3-2501-L-96', 'ENTITY_EXTRACTION', 'gpt-4-turbo', 0.88,
        '{"people": ["Nicholas Bernardi", "Nicole Bernardi"], "organizations": ["Clearpath Networks LLC", "ANC Technology Group"], "dates": ["2024-12-10", "2024-12-19"], "amounts": ["$600,000", "$23,333.70"]}'::jsonb, '{"primary": "BUSINESS_COMMUNICATIONS", "secondary": ["LEGAL_DOCUMENT", "EVIDENCE"], "confidence": 0.88}'::jsonb, 88,
        '{"status": "completed", "tokens": 1700}'::jsonb);

INSERT INTO ai_processing (chitty_id, processing_type, model_used, confidence, entities, classifications, relevance_score, results)
VALUES ('CT-01-1-CHI-2003-3-2501-L-95', 'ENTITY_EXTRACTION', 'gpt-4-turbo', 0.94,
        '{"people": ["Nicholas Bernardi", "Nicole Bernardi"], "organizations": ["Clearpath Networks LLC", "ANC Technology Group"], "dates": ["2024-12-10", "2024-12-19"], "amounts": ["$600,000", "$23,333.70"]}'::jsonb, '{"primary": "CONTRADICTION_EVIDENCE", "secondary": ["LEGAL_DOCUMENT", "EVIDENCE"], "confidence": 0.94}'::jsonb, 94,
        '{"status": "completed", "tokens": 1800}'::jsonb);

INSERT INTO ai_processing (chitty_id, processing_type, model_used, confidence, entities, classifications, relevance_score, results)
VALUES ('CT-01-1-CHI-2004-3-2501-L-94', 'ENTITY_EXTRACTION', 'gpt-4-turbo', 0.9,
        '{"people": ["Nicholas Bernardi", "Nicole Bernardi"], "organizations": ["Clearpath Networks LLC", "ANC Technology Group"], "dates": ["2024-12-10", "2024-12-19"], "amounts": ["$600,000", "$23,333.70"]}'::jsonb, '{"primary": "TIMELINE_INTEGRATION", "secondary": ["LEGAL_DOCUMENT", "EVIDENCE"], "confidence": 0.9}'::jsonb, 90,
        '{"status": "completed", "tokens": 1900}'::jsonb);

-- Evidence relationships

INSERT INTO evidence_relationships (source_chitty_id, target_chitty_id, relationship_type, confidence)
VALUES ('CT-01-1-CHI-2000-3-2501-L-98', 'CT-01-1-CHI-2001-3-2501-L-97', 'SUMMARIZES', 0.95);

INSERT INTO evidence_relationships (source_chitty_id, target_chitty_id, relationship_type, confidence)
VALUES ('CT-01-1-CHI-2002-3-2501-L-96', 'CT-01-1-CHI-2003-3-2501-L-95', 'CONTRADICTS', 0.88);

INSERT INTO evidence_relationships (source_chitty_id, target_chitty_id, relationship_type, confidence)
VALUES ('CT-01-1-CHI-2004-3-2501-L-94', 'CT-01-1-CHI-2005-3-2501-L-93', 'SUPPORTS', 0.92);

INSERT INTO evidence_relationships (source_chitty_id, target_chitty_id, relationship_type, confidence)
VALUES ('CT-01-1-CHI-2001-3-2501-L-97', 'CT-01-1-CHI-2006-3-2501-L-92', 'REFERENCES', 0.85);

-- Processing session

INSERT INTO processing_sessions (case_id, session_type, items_processed, status, metadata)
VALUES ('2024D007847', 'FULL_ANALYSIS', 10, 'COMPLETED',
        '{"analyzer": "ChittyOS", "version": "2.0"}'::jsonb);