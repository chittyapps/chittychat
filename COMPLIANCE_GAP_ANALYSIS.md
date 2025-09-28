# §36 Compliance Gap Analysis

## Critical Architecture Violations

### ❌ **Current Implementation Issues**

#### 1. Direct Service Calls (Violates §36)
**Current**: Direct calls to `https://id.chitty.cc/v1/mint`
**Required**: Registry-resolved service discovery

#### 2. Hardcoded URLs (Violates §31)
**Current**:
```python
self.chittyrouter_endpoint = os.getenv("CHITTYROUTER_ENDPOINT", "https://router.chitty.cc/v1")
```
**Required**: Dynamic resolution through ChittyRegistry

#### 3. Local Schema (Violates §16)
**Current**: `setup_neon.py` creates local database schema
**Required**: Schema retrieved via ChittySchema service

#### 4. Missing Service Integration
**Missing**:
- ChittyCanon (entity canonicalization)
- ChittyVerify (trust verification)
- ChittyCheck (compliance validation)
- ChittyRegistry (service discovery)

### ✅ **Required Architecture Pattern**

Based on manual Section 37, evidence ingestion must follow:

```typescript
// 1) Resolve services via ChittyRegistry
const canonBase = await resolve('chittycanon');
const idBase = await resolve('foundation-id');
const schemaBase = await resolve('chittyschema');
const verifyBase = await resolve('chittyverify');
const checkBase = await resolve('chittycheck');

// 2) Canonicalize entities via ChittyCanon
const canonPlaces = await fetch(canonBase + '/api/v1/jurisdiction/validate', ...);

// 3) Request ChittyID from Foundation
const idRes = await fetch(idBase + '/api/v2/chittyid/mint', ...);

// 4) Validate via ChittySchema
const schema = await fetch(schemaBase + '/api/v1/schemas/evidence', ...);
const val = await fetch(schemaBase + '/api/v1/validate/evidence', ...);

// 5) Verify integrity via ChittyVerify
const vres = await fetch(verifyBase + '/api/v1/evidence/verify', ...);

// 6) Compliance via ChittyCheck
const cres = await fetch(checkBase + '/api/v1/validate/evidence', ...);

// 7) Store canonical record via ChittySchema
const store = await fetch(schemaBase + '/api/v1/store/evidence', ...);
```

## Required Changes

### 1. Service Registry Integration
**File**: `evidence_analyzer_chittyos.py`
**Change**: Replace hardcoded URLs with registry resolution
```python
async def resolve_service(self, service_name: str) -> str:
    """Resolve service URL via ChittyRegistry"""
    registry_url = os.getenv("CHITTY_REGISTRY_URL")
    response = await aiohttp.ClientSession().get(
        f"{registry_url}/api/v1/resolve/{service_name}",
        headers={"Authorization": f"Bearer {os.getenv('CHITTY_REGISTRY_TOKEN')}"}
    )
    result = await response.json()
    return result["base_url"]
```

### 2. ChittyCanon Integration
**Purpose**: Entity canonicalization (PEO/PLACE/PROP)
**Implementation**: Replace local entity processing with canonical resolution

### 3. ChittyVerify Integration
**Purpose**: Trust verification and integrity checks
**Implementation**: Evidence trust scores embedded in metadata

### 4. ChittyCheck Integration
**Purpose**: Compliance validation
**Implementation**: Replace local compliance logic with service calls

### 5. ChittySchema Integration
**Purpose**: Centralized schema management
**Implementation**: Remove `setup_neon.py`, use service-provided schemas

## Environment Variables Required

```bash
# ChittyOS Registry
CHITTY_REGISTRY_URL=https://registry.chitty.cc
CHITTY_REGISTRY_TOKEN=<registry_token>

# Service-specific tokens
CHITTY_ID_TOKEN=<foundation_token>
CHITTY_CANON_TOKEN=<canon_token>
CHITTY_VERIFY_TOKEN=<verify_token>
CHITTY_CHECK_TOKEN=<check_token>
```

## Immediate Actions

1. **Halt Current PR** - Architecture violates §36
2. **Redesign Service Integration** - Implement registry-resolved pattern
3. **Add Missing Services** - Canon, Verify, Check integration
4. **Update Documentation** - Reflect ChittyOS client architecture
5. **Re-test Compliance** - Validate against §36 requirements

## Risk Assessment

**Severity**: 🚨 **CRITICAL**
**Impact**: Current system operates outside ChittyOS governance
**Resolution**: Complete architectural refactor required

The litigation system must be redesigned as a ChittyOS client with proper service orchestration before deployment.