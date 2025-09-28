# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **§36 Compliant Legal Evidence Analysis System** for case 2024D007847 (Arias v. Bianchi) built as a **ChittyOS client** per the Critical Architecture Principle. The system orchestrates evidence workflows through ChittyOS services, maintaining chain of custody and performing automated contradiction detection for litigation support.

**§36 Critical Architecture Principle**: The litigation system is a ChittyOS client, never standalone. All features must REQUEST, REGISTER, VALIDATE, RESOLVE, STORE, and AUTHENTICATE through ChittyOS services.

### System Components

1. **Evidence Analyzer Pipeline** - Processes documents for case 2024D007847 with ChittyOS integration
2. **Chain of Custody Tracking** - Cryptographic evidence integrity using ChittyID service
3. **Contradiction Detection** - Automated analysis of conflicting evidence claims
4. **Timeline Integration** - Multi-platform communication timeline (1,433+ events)
5. **OpenPhone Analysis** - Business communication extraction and analysis
6. **Notion ChittyLedger** - Evidence database with legal hold and admissibility tracking

## Key Components

### Evidence Processing Pipeline
- **ChittyOSEvidenceAnalyzer** - Main analyzer that stores all data in centralized ChittyOS location (`/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data`)
- **ChittyID Service Integration** - All evidence receives service-generated IDs from `https://id.chitty.cc/v1/mint` (no local generation allowed)
- **Content Addressing** - Files are content-addressed using CID format (`bafk{sha256[:52]}`)
- **Storage Architecture** - R2 for binary files, Neon PostgreSQL for metadata, Notion for evidence dashboard

### Storage Architecture

```
Evidence Flow: Input → ChittyOS Analyzer → R2 + Neon → Notion Dashboard
              ↓                         ↓
           Temp Processing           Permanent Storage
```

- **Hot Storage**: Cloudflare R2 (primary evidence files)
- **Database**: Neon PostgreSQL (metadata, relationships, AI results)
- **Sync Layer**: Google Drive (chittychat-data) for cross-session state
- **Dashboard**: Notion (ChittyLedger evidence tracking)
- **Temp Processing**: `/tmp/` files (no permanent `/out/` storage)

## Commands

### Primary Analysis
```bash
# Run complete evidence analysis pipeline
python3 evidence_cli.py --case-id 2024D007847 --input-dir . --queue-hard-mint

# Process individual evidence file with chain of custody
./evidence-processor.sh process <file> [case_year] [evidence_id]
```

### Database Setup
```bash
# Generate Neon database import files
python3 setup_neon.py

# Import to Neon
psql $NEON_CONNECTION_STRING < out/neon_import/neon_full_import.sql
```

### Notion Synchronization
```bash
# Generate evidence manifest and sync to Notion
node notion_sync_standalone.js
python3 notion_evidence_sync.py
```

### Analysis Tools
```bash
# Contradiction detection
python3 message_contradiction_analyzer.py --timeline-file out/timeline_master.parquet

# OpenPhone analysis
python3 openphone_critical_analyzer.py --data-dir <openphone_data>

# Session conflict detection
python3 session_conflict_analyzer.py

# Evidence status reporting
python3 evidence_status_report.py
```

### CI/Testing
```bash
# Verify no direct AI provider calls (must use ChittyRouter)
./scripts/ci/no-direct-models.sh

# Install dependencies
pip3 install -r requirements.txt
```

## Environment Variables

### §36 Required ChittyOS Service Integration
```bash
# ChittyOS Registry (§31 - Service Discovery)
CHITTY_REGISTRY_URL=https://registry.chitty.cc
CHITTY_REGISTRY_TOKEN=<registry_token>

# ChittyOS Service Tokens (§36 - Service Authentication)
CHITTY_ID_TOKEN=<foundation_token>          # ChittyID Foundation service
CHITTY_CANON_TOKEN=<canon_token>           # ChittyCanon entity resolution
CHITTY_VERIFY_TOKEN=<verify_token>         # ChittyVerify trust validation
CHITTY_CHECK_TOKEN=<check_token>           # ChittyCheck compliance validation

# Unified ChittySchema Database (Current Working Connection)
ARIAS_DB_URL=postgresql://neondb_owner:npg_WC8DvuRU1PQs@ep-solitary-darkness-aem5a1yw-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
PGPASSWORD=npg_WC8DvuRU1PQs

# Cloudflare R2 Storage
R2_ENDPOINT=<r2_endpoint>
R2_ACCESS_KEY=<access_key>
R2_SECRET_KEY=<secret_key>
R2_BUCKET=chittyos-evidence

# Notion Integration (optional)
NOTION_TOKEN=<notion_integration_token>
CHITTYLEGDER_DATABASE_ID=<notion_database_id>
```

## Key Architectural Patterns

### §36 Service Orchestration Pattern
```
REQUEST → REGISTER/RESOLVE → VALIDATE → VERIFY → COMPLY → STORE
```

**Implementation**: All services resolved via ChittyRegistry (§31), no hardcoded URLs allowed.

### ChittyID Service Integration (§30)
- **Service Resolution**: Dynamic via `ChittyRegistry.resolve('foundation-id')`
- **Format**: `CT-01-1-CHI-XXXX-3-YYMM-L-CC` (Mod-97 checksum)
- **Authentication**: Bearer token via `CHITTY_ID_TOKEN`
- **Failure Mode**: System fails fast if service unavailable (no local generation)

### Content Addressing System
- **CID Generation**: `bafk{sha256[:52]}` (IPFS-compatible)
- **R2 Keys**: `evidence/{case_id}/{hash[:16]}_{type}_{timestamp}.ext`
- **Deduplication**: Same content = same CID = single storage

### Database Schema (ChittySchema Centralized)
Managed by: `/CHITTYOS/chittyos-services/chittyschema/`

**Event-Sourced Architecture:**
- `event_store` - Immutable event log with ChittyID and cryptographic chain
- `schema_versions` - Safe migration management
- `entities` - Core entity management with temporal tracking
- `entity_relationships` - Relationship tracking between entities
- `processing_sessions` - Analysis session tracking

**Evidence Integration:**
- Evidence stored as events in `event_store` with `aggregate_type: 'evidence'`
- ChittyID integration for each evidence event
- Cryptographic integrity via `event_hash` and `previous_hash`

### Evidence Classification
- `COMPREHENSIVE_ANALYSIS` - Complete discovery reports
- `CONTRADICTION_EVIDENCE` - Documents contradicting TRO claims
- `BUSINESS_COMMUNICATIONS` - OpenPhone/email communications
- `TIMELINE_DATA` - Temporal event data (CSV/parquet)
- `STRUCTURED_DATA` - JSON analysis outputs

### ChittyOS Data Flow
Evidence processing follows **strict storage separation**:

1. **Ingest**: Files processed by `ChittyOSEvidenceAnalyzer`
2. **ChittyID**: Service request to `id.chitty.cc` with metadata
3. **R2 Upload**: Binary content to Cloudflare R2 bucket
4. **Neon Upsert**: Metadata and relationships to PostgreSQL
5. **Temp Cleanup**: No permanent local `/out/` storage

## Integration Patterns

### Notion ChittyLedger
Evidence items sync to Notion database with fields:
- ChittyID, CID, R2 Key, Drive File ID
- Vectorized status, Queue Status, Batch ID
- Gas Price @ Mint, Processing metadata

### Cross-Session Synchronization
System maintains state across Claude sessions via:
- ChittyOS data repository in Google Drive
- Session insights and conflict detection
- Automated evidence package generation

## Case-Specific Context

This system analyzes evidence for case 2024D007847 with:
- **Timeline Integration**: 1,433+ communication events across platforms
- **Chain of Custody**: Cryptographic integrity verification via SHA-256
- **AI Analysis**: Entity extraction, relevance scoring, contradiction detection
- **Cross-Session State**: Maintained via ChittyOS data repository in Google Drive

## Security Considerations

- **No Direct AI Calls**: All AI processing routed through ChittyRouter
- **Credential Management**: Environment variables only, no hardcoded secrets
- **Content Addressing**: Tamper-evident storage through cryptographic hashing
- **Service Authentication**: Bearer token auth for ChittyID service