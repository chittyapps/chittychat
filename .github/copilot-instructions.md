# GitHub Copilot Instructions

## Project Overview

You are working on a Legal Evidence Analysis System for case 2024D007847 (Arias v. Bianchi) built within the ChittyOS Framework. This system processes legal documents, maintains cryptographic chain of custody, and performs automated contradiction detection for litigation support.

## System Architecture

### Core Components
1. **Evidence Analyzer Pipeline** - Processes documents with ChittyOS integration
2. **Chain of Custody Tracking** - Cryptographic evidence integrity using ChittyID service
3. **Contradiction Detection** - Automated analysis of conflicting evidence
4. **Timeline Integration** - Multi-platform communication timeline (1,433+ events)
5. **OpenPhone Analysis** - Business communication extraction
6. **Notion ChittyLedger** - Evidence database with legal hold tracking

### Storage Layers
- **Cloudflare R2**: Primary evidence file storage
- **Neon PostgreSQL**: Metadata, relationships, AI analysis results
- **Google Drive**: Cross-session state synchronization (chittychat-data)
- **Notion**: Evidence dashboard and tracking
- **Temp**: `/tmp/` for processing (no permanent `/out/` storage)

## Critical Rules

### ChittyID Service Integration
- **NEVER generate IDs locally** - All IDs must come from `https://id.chitty.cc/v1/mint`
- **Required**: `CHITTY_ID_TOKEN` environment variable for authentication
- **Format**: `CT-01-1-CHI-XXXX-3-YYMM-L-CC` with Mod-97 checksum
- **Failure mode**: System must fail fast if service is unavailable

### Content Addressing
- Generate CIDs using format: `bafk{sha256[:52]}` (IPFS-compatible)
- R2 storage keys: `evidence/{case_id}/{hash[:16]}_{type}_{timestamp}.ext`
- Same content always produces same CID for deduplication

### AI Processing
- **NO direct AI API calls** - All AI processing must route through ChittyRouter
- Never call OpenAI, Anthropic, or other AI services directly
- Use ChittyRouter service for all AI operations

## Code Patterns

### Evidence Processing Flow
```python
# 1. Process with ChittyOSEvidenceAnalyzer
analyzer = ChittyOSEvidenceAnalyzer(case_id="2024D007847", input_dir=".")

# 2. Request ChittyID from service (never generate locally)
chitty_id = await mint_chitty_id(domain="evidence", subtype="document")

# 3. Upload to R2
r2_key = f"evidence/{case_id}/{cid[:16]}_{type}_{timestamp}.ext"

# 4. Store metadata in Neon
# Uses tables: artifacts, evidence_items, ai_processing, evidence_relationships
```

### Database Schema
When working with Neon PostgreSQL, use these core tables:
- `artifacts` - Content-addressed storage (CID → R2 mapping)
- `evidence_items` - ChittyID indexed evidence with metadata
- `ai_processing` - Entity extraction and relevance scoring
- `evidence_relationships` - Document relationships (CONTRADICTS, SUPPORTS)
- `processing_sessions` - Analysis session tracking

### Evidence Classifications
Use these standard classifications:
- `COMPREHENSIVE_ANALYSIS` - Complete discovery reports
- `CONTRADICTION_EVIDENCE` - Documents contradicting claims
- `BUSINESS_COMMUNICATIONS` - OpenPhone/email data
- `TIMELINE_DATA` - Temporal events (CSV/parquet)
- `STRUCTURED_DATA` - JSON analysis outputs

## Environment Configuration

Required environment variables:
```bash
CHITTY_ID_TOKEN        # ChittyID service authentication
R2_ENDPOINT           # Cloudflare R2 endpoint
R2_ACCESS_KEY         # R2 access credentials
R2_SECRET_KEY         # R2 secret key
R2_BUCKET            # Usually "chittyos-evidence"
NEON_CONNECTION_STRING # PostgreSQL connection with SSL
NOTION_TOKEN         # Notion integration token (optional)
CHITTYLEGDER_DATABASE_ID # Notion database ID (optional)
```

## Command Reference

### Primary Analysis
```bash
# Run complete evidence analysis
python3 evidence_cli.py --case-id 2024D007847 --input-dir . --queue-hard-mint

# Process individual evidence file
./evidence-processor.sh process <file> [case_year] [evidence_id]
```

### Database Operations
```bash
# Generate Neon import files
python3 setup_neon.py

# Import to Neon database
psql $NEON_CONNECTION_STRING < out/neon_import/neon_full_import.sql
```

### Notion Sync
```bash
# Generate and sync evidence manifest
node notion_sync_standalone.js
python3 notion_evidence_sync.py
```

### Analysis Tools
```bash
# Detect contradictions in timeline
python3 message_contradiction_analyzer.py --timeline-file out/timeline_master.parquet

# Analyze OpenPhone communications
python3 openphone_critical_analyzer.py --data-dir <openphone_data>

# Check session conflicts
python3 session_conflict_analyzer.py

# Generate status reports
python3 evidence_status_report.py
```

## Security Guidelines

1. **Credentials**: Use environment variables only, never hardcode secrets
2. **ChittyID**: Always use service calls, never generate locally
3. **AI Services**: Route through ChittyRouter, no direct API calls
4. **Content Integrity**: Use SHA-256 hashing for all evidence files
5. **Storage**: Follow strict separation - R2 for files, Neon for metadata

## File Organization

```
/
├── evidence_cli.py              # Main CLI entry point
├── evidence_analyzer_chittyos.py # Core analyzer with ChittyOS integration
├── evidence_versioning.py        # Version control for evidence
├── setup_neon.py                # Database schema setup
├── notion_sync_standalone.js    # Notion synchronization
├── message_contradiction_analyzer.py # Contradiction detection
├── openphone_critical_analyzer.py    # OpenPhone analysis
├── session_conflict_analyzer.py      # Cross-session conflicts
├── evidence-processor.sh         # Shell script for processing
├── requirements.txt             # Python dependencies
└── db/
    └── migrations/             # Database migration files
```

## Testing and Validation

Before deploying:
1. Run `./scripts/ci/no-direct-models.sh` to verify no direct AI calls
2. Ensure all ChittyID requests go through the service
3. Verify R2 and Neon connections are configured
4. Test chain of custody tracking with sample documents

## Common Issues and Solutions

### ChittyID Service Unavailable
- Check `CHITTY_ID_TOKEN` is set correctly
- Verify network access to `id.chitty.cc`
- System should fail fast rather than generate local IDs

### Storage Conflicts
- Ensure no permanent files in `/out/` directory
- Use `/tmp/` for temporary processing only
- All permanent storage goes to R2/Neon/Notion

### AI Processing Errors
- Verify routing through ChittyRouter
- Check for any direct AI API calls (forbidden)
- Review `chittyrouter` service logs

## Dependencies

Python packages (install with `pip3 install -r requirements.txt`):
- pandas>=2.0.0
- numpy>=1.24.0
- pyarrow>=12.0.0
- aiohttp>=3.8.0
- click>=8.0.0
- notion-client>=2.2.1
- psycopg2-binary (for Neon)
- matplotlib>=3.7.0
- seaborn>=0.12.0