# Ontology Service Implementation

**Date**: 2025-10-18
**Version**: 1.0.0
**Status**: ✅ IMPLEMENTED

## Summary

Exposed ChittyOS Ontology classification system as public API at `ontology.chitty.cc`. The ontology service provides entity classification and discovery using ChittyOS ontology rules without creating a new standalone worker - integrated into existing ChittyChat platform.

---

## What Was Added

### 1. Ontology API Routes (`src/services/ontology-routes.js`)

New route handler providing public access to entity classification:

**Endpoints**:
- `POST /classify` - Classify a single entity
- `GET /classify?entity=...` - Classify entity (GET variant)
- `POST /batch-classify` - Classify multiple entities in batch
- `GET /types` - List valid entity types and classification rules
- `GET /lookup?id=...` - Lookup hybrid ID mapping
- `GET /health` - Health check
- `GET /` - API documentation

**Example Request**:
```bash
# Classify a single entity
curl -X POST https://ontology.chitty.cc/classify \
  -H "Content-Type: application/json" \
  -d '{"entity": "/path/to/legal/document"}'

# Response
{
  "success": true,
  "data": {
    "type": "legal_data",
    "category": "compliance",
    "source": "pattern_detection",
    "precedence": 2
  },
  "timestamp": 1729263400000
}
```

**Example Batch Classification**:
```bash
curl -X POST https://ontology.chitty.cc/batch-classify \
  -H "Content-Type: application/json" \
  -d '{
    "entities": [
      "/chittyos/services/chittyauth",
      "/legal/arias-complaint",
      "/projects/myapp/.git"
    ]
  }'

# Response
{
  "success": true,
  "data": {
    "total": 3,
    "classifications": [
      {
        "entity": "/chittyos/services/chittyauth",
        "classification": {"type": "services", "category": "infrastructure", "source": "registry", "precedence": 1}
      },
      {
        "entity": "/legal/arias-complaint",
        "classification": {"type": "legal_data", "category": "compliance", "source": "pattern_detection", "precedence": 2}
      },
      {
        "entity": "/projects/myapp/.git",
        "classification": {"type": "version_control", "category": "infrastructure", "source": "pattern_detection", "precedence": 3}
      }
    ]
  }
}
```

---

## Classification Rules

The ontology uses a precedence-based classification system:

### 1. Registry Entities (Highest Precedence)
- **Type**: `services`, `domains`, `infrastructure`
- **Source**: SERVICE_REGISTRY KV namespace
- **Precedence**: 1
- **Example**: ChittyOS services with KV/R2/DO presence

### 2. Legal Patterns
- **Type**: `legal_data`
- **Category**: `compliance`
- **Patterns**: `arias*`, `legal*`, `compliance*`, `*.legal.*`
- **Precedence**: 2
- **Example**: `/legal/arias-complaint.pdf`

### 3. Version Control
- **Type**: `version_control`
- **Category**: `infrastructure`
- **Pattern**: Contains `.git` or `/.git/`
- **Precedence**: 3
- **Example**: `/projects/myapp/.git`

### 4. Unstructured Data (Default)
- **Type**: `unstructured_data`
- **Category**: `general`
- **Precedence**: 4
- **Used when**: No other rules match

---

## Integration Points

### Subdomain Routing
- **Domain**: `ontology.chitty.cc`
- **Route**: Added to `wrangler.optimized.toml`
- **Location**: Service mesh section (with registry, canon, verify)

### Platform Worker
- **Handler**: `handleOntologyRequest` from `ontology-routes.js`
- **Integration**: SERVICE_ROUTES map in `platform-worker.js`
- **Wrapper**: Uses `wrapHandler()` for consistent error handling

### Documentation
- **API Docs**: Added to `src/services/docs.js`
- **Endpoints**: Documented in JSON format at `/docs/json`
- **Access**: Public documentation at `https://gateway.chitty.cc/docs/json`

---

## Files Modified

### Created
1. `/src/services/ontology-routes.js` (300+ lines)
   - API route handler
   - Classification logic wrapper
   - Batch processing support
   - Health checks

### Modified
1. `/wrangler.optimized.toml`
   - Added `ontology.chitty.cc/*` route to service mesh section

2. `/src/platform-worker.js`
   - Added import: `handleOntologyRequest`
   - Added route: `"ontology.chitty.cc": wrapHandler(handleOntologyRequest)`

3. `/src/services/docs.js`
   - Added ontology service documentation
   - Documented all endpoints with request/response schemas
   - Included classification rules

---

## Usage Examples

### Get Entity Types
```bash
curl https://ontology.chitty.cc/types | jq

# Response
{
  "success": true,
  "data": {
    "types": [
      {
        "id": "services",
        "category": "infrastructure",
        "description": "ChittyOS services with KV/R2/DO presence",
        "precedence": 1,
        "source": "registry"
      },
      {
        "id": "legal_data",
        "category": "compliance",
        "description": "Legal documents, compliance data (arias*, legal*)",
        "precedence": 2,
        "source": "pattern_detection"
      },
      ...
    ]
  }
}
```

### Lookup Hybrid ID
```bash
curl "https://ontology.chitty.cc/lookup?id=AA-C-SVC-1234-I-25-7-X" | jq

# Response (if found)
{
  "success": true,
  "data": {
    "technical_id": "AA-C-SVC-1234-I-25-7-X",
    "legal_id": "01-N-USA-1234-T-25-3-X",
    "entity_type": "services",
    "classification": {...},
    "created_at": "2025-10-18T..."
  }
}
```

### Health Check
```bash
curl https://ontology.chitty.cc/health | jq

# Response
{
  "success": true,
  "data": {
    "status": "healthy",
    "registry_connected": true,
    "schema_connected": true,
    "enforcement": "STRICT_SERVER_ONLY",
    "pipeline_required": true
  }
}
```

---

## Architecture Benefits

### No New Worker
- Integrated into existing ChittyChat platform worker
- Follows consolidation pattern (34+ services → 1 worker)
- Shares resources (KV, AI, cache) with other services

### Foundation-Level Service
- Classification logic from CHITTYFOUNDATION
- Registry-backed (single source of truth)
- Used by ChittyID for hybrid ID generation

### Public API Access
- No authentication required for classification
- CORS enabled for cross-origin requests
- Discoverable at `ontology.chitty.cc`

---

## Related Services

The ontology service works with:

1. **ChittyID** (`id.chitty.cc`)
   - Uses classifications for ID generation
   - Maps entity types to namespaces (LEG, SVC, DOM, etc.)

2. **ChittyRegister** (`registry.chitty.cc`)
   - Registry is source of truth for entity classifications
   - Ontology queries registry first before applying patterns

3. **ChittySchema** (`schema.chitty.cc`)
   - Schema structures the classified entities
   - Ontology provides the "what is it"
   - Schema provides the "how to store it"

---

## Next Steps

### Immediate
- [x] Deploy to production
- [ ] Test all endpoints
- [ ] Verify subdomain routing works
- [ ] Update external documentation

### Future Enhancements
1. **ML-Based Classification** - Add machine learning for ambiguous entities
2. **Custom Rules** - Allow users to register custom classification patterns
3. **Classification History** - Track entity classification changes over time
4. **WebSocket Support** - Real-time classification notifications

---

## Testing

```bash
# Test all endpoints
export ONTOLOGY_URL="https://ontology.chitty.cc"

# 1. Health check
curl $ONTOLOGY_URL/health

# 2. Get types
curl $ONTOLOGY_URL/types

# 3. Classify entity (GET)
curl "$ONTOLOGY_URL/classify?entity=/legal/document"

# 4. Classify entity (POST)
curl -X POST $ONTOLOGY_URL/classify \
  -H "Content-Type: application/json" \
  -d '{"entity": "/chittyos/services/chittyauth"}'

# 5. Batch classify
curl -X POST $ONTOLOGY_URL/batch-classify \
  -H "Content-Type: application/json" \
  -d '{"entities": ["/legal/doc", "/services/api", "/.git"]}'

# 6. Lookup ID
curl "$ONTOLOGY_URL/lookup?id=AA-C-SVC-1234-I-25-7-X"

# Expected: All endpoints return success responses
```

---

## Documentation Access

The ontology service is documented in multiple formats:

1. **Live API**: `https://ontology.chitty.cc/` (JSON self-description)
2. **Platform Docs**: `https://gateway.chitty.cc/docs/json` (includes ontology)
3. **OpenAPI**: (to be added to ChittySync docs pattern)

---

**Status**: ✅ **Ready for Deployment**
**Version**: 1.0.0
**Integration**: ChittyChat Unified Platform
**Pattern**: Consolidated Service (no new worker)
**Date**: 2025-10-18
