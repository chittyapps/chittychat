# ChittyID Authentication Flow Through ChittyAuth

**Date**: 2025-10-11
**Services**: ChittyAuth (auth.chitty.cc) → ChittyID (id.chitty.cc)
**Architecture**: Zero Trust Authentication with ChittyID Integration

---

## Overview

ChittyAuth is the Zero Trust authentication service for the entire ChittyOS ecosystem. It integrates deeply with ChittyID to provide identity-based authentication, API key generation, and authorization management.

**Key Principle**: All identity operations MUST go through id.chitty.cc - no local ID generation permitted.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User/Application                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ 1. Request API Key
                 │    POST /v1/api-keys/generate
                 │    { chitty_id, name, scopes }
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ChittyAuth Service                            │
│                   (auth.chitty.cc)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Rate Limiter                                            │  │
│  │  - 10 req/min per IP for API key generation             │  │
│  │  - Uses Durable Object (AUTH_SESSIONS)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ChittyIDClient (@chittyos/chittyid-client)             │  │
│  │  - Validates ChittyID format                            │  │
│  │  - Calls id.chitty.cc for verification                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 2. Validate ChittyID                  │
│                         │    POST /v1/verify                    │
│                         │    Authorization: Bearer <token>      │
│                         ▼                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ChittyID Service                              │
│                   (id.chitty.cc)                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Pipeline Validation                                     │  │
│  │  1. Router       - Route to correct handler             │  │
│  │  2. Intake       - Parse and validate request           │  │
│  │  3. Trust        - Verify trust level                   │  │
│  │  4. Authorization - Check Bearer token                  │  │
│  │  5. Generation   - Mint or validate ChittyID            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 3. ChittyID Validated                 │
│                         │    { valid: true, details: {...} }    │
│                         ▼                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ChittyAuth Service                            │
│                   (auth.chitty.cc)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AuthorizationService                                    │  │
│  │  - Check if user has "api_keys:generate" permission     │  │
│  │  - Uses KV namespace (AUTH_PERMISSIONS)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 4. Permission Check Passed            │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  APIKeyService                                           │  │
│  │  - Generate cryptographic API key                       │  │
│  │  - Format: sk_live_{base64(SHA256(...))}                │  │
│  │  - Store in KV (AUTH_TOKENS)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 5. Mint API Key ChittyID              │
│                         │    POST /v1/mint                      │
│                         │    { type: "APIKEY", namespace: "AUTH" }
│                         ▼                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ChittyID Service                              │
│                   (id.chitty.cc)                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ID Generation (Official Format)                         │  │
│  │  Format: VV-G-LLL-SSSS-T-YM-C-X                          │  │
│  │  Example: 01-1-USA-0001-A-2510-3-XX                      │  │
│  │                                                           │  │
│  │  Components:                                             │  │
│  │  - VV: Version (01)                                      │  │
│  │  - G: Region (1 = North America)                         │  │
│  │  - LLL: Jurisdiction (USA)                               │  │
│  │  - SSSS: Sequence (0001)                                 │  │
│  │  - T: Type (A = APIKEY)                                  │  │
│  │  - YM: Year-Month (2510 = Oct 2025)                      │  │
│  │  - C: Trust Level (3 = Verified)                         │  │
│  │  - X: Mod-97 Checksum (XX)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 6. ChittyID Minted                    │
│                         │    { chittyId: "01-1-USA-0001-A-2510-3-XX" }
│                         ▼                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ChittyAuth Service                            │
│                   (auth.chitty.cc)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Store Complete API Key Record                           │  │
│  │  {                                                        │  │
│  │    id: "01-1-USA-0001-A-2510-3-XX",  // ChittyID         │  │
│  │    key: "sk_live_ABC123...",          // API secret       │  │
│  │    chitty_id: "01-1-USA-0123-P-2510-3-XY",  // Owner     │  │
│  │    name: "Production API Key",                           │  │
│  │    scopes: ["read", "write"],                            │  │
│  │    active: true,                                         │  │
│  │    created_at: "2025-10-11T...",                         │  │
│  │    last_used: null                                       │  │
│  │  }                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         │ 7. Return to User                     │
│                         ▼                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        User/Application                         │
│                                                                 │
│  Receives:                                                      │
│  {                                                              │
│    success: true,                                               │
│    api_key: "sk_live_ABC123...",                                │
│    key_id: "01-1-USA-0001-A-2510-3-XX",                         │
│    created_at: "2025-10-11T..."                                 │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow Breakdown

### Step 1: API Key Generation Request

**Endpoint**: `POST /v1/api-keys/generate`

**Request Body**:
```json
{
  "chitty_id": "01-1-USA-0123-P-2510-3-XY",
  "name": "Production API Key",
  "scopes": ["read", "write"]
}
```

**Rate Limiting**: 10 requests/minute per IP address

**Validation**:
- Request body contains required fields
- ChittyID is provided (owner identity)
- Scopes are valid

---

### Step 2: ChittyID Validation

**Service**: `ChittyIDClient` (uses @chittyos/chittyid-client npm package)

**Process**:
1. **Local Format Validation**:
   ```javascript
   // Official Format: VV-G-LLL-SSSS-T-YM-C-X
   const officialPattern = /^[A-Z]{2}-[A-Z]-[A-Z]{3}-[0-9]{4}-[A-Z]-[0-9]{2}-[A-Z]-[0-9A-Z]$/;
   ```

2. **Remote Verification** (id.chitty.cc):
   ```javascript
   POST https://id.chitty.cc/v1/verify
   Headers:
     Authorization: Bearer {CHITTYID_API_KEY}
     Content-Type: application/json
   Body:
     { "chitty_id": "01-1-USA-0123-P-2510-3-XY" }
   ```

3. **Response**:
   ```json
   {
     "valid": true,
     "details": {
       "version": "01",
       "region": "1",
       "jurisdiction": "USA",
       "sequence": "0123",
       "type": "P",
       "yearMonth": "2510",
       "trustLevel": "3",
       "checksum": "XY"
     }
   }
   ```

**Fallback Behavior**: If id.chitty.cc is unavailable, ChittyAuth returns error - NO LOCAL GENERATION

---

### Step 3: Authorization Check

**Service**: `AuthorizationService`

**Process**:
1. Check if ChittyID has permission `api_keys:generate`
2. Lookup in KV namespace `AUTH_PERMISSIONS`
3. Key format: `chitty:{chitty_id}:permissions`

**Permission Structure**:
```json
{
  "permissions": [
    "api_keys:generate",
    "api_keys:revoke",
    "api_keys:list"
  ],
  "roles": ["admin", "developer"],
  "granted_at": "2025-10-11T...",
  "granted_by": "01-1-USA-0001-P-2510-5-AB"
}
```

**Response**: `{ canGenerateKeys: true }`

---

### Step 4: API Key Generation

**Service**: `APIKeyService`

**Process**:
1. **Generate Cryptographic Key**:
   ```javascript
   // Use Cloudflare's crypto.getRandomValues (true randomness beacon)
   const beacon = crypto.getRandomValues(new Uint8Array(32));
   const timestamp = Date.now();

   // Create key material
   const keyMaterial = `${chitty_id}:${Array.from(beacon).join("")}:${timestamp}`;

   // Hash with SHA-256
   const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);

   // Format as base64 with URL-safe characters
   const apiKey = `sk_live_${btoa(String.fromCharCode(...hashArray))
     .replace(/\+/g, "-")
     .replace(/\//g, "_")
     .replace(/=/g, "")}`;
   ```

2. **Result**: `sk_live_ABC123XYZ...` (44+ characters)

---

### Step 5: Mint ChittyID for API Key

**Service**: `ChittyIDClient.mintAPIKeyID()`

**Request to id.chitty.cc**:
```javascript
POST https://id.chitty.cc/v1/mint
Headers:
  Authorization: Bearer {CHITTYID_API_KEY}
  Content-Type: application/json
Body:
  {
    "type": "APIKEY",
    "namespace": "AUTH"
  }
```

**ChittyID Service Processing**:
1. **Pipeline Validation**:
   - Router: Route to minting handler
   - Intake: Parse request, validate type/namespace
   - Trust: Determine trust level (3 = Verified for AUTH namespace)
   - Authorization: Verify Bearer token
   - Generation: Mint new ChittyID

2. **ID Generation**:
   ```javascript
   // Format: VV-G-LLL-SSSS-T-YM-C-X
   const chittyId = generateChittyID({
     version: "01",              // v1.0 format
     region: "1",                // North America
     jurisdiction: "USA",        // United States
     sequence: getNextSequence(), // 0001, 0002, etc.
     type: "A",                  // APIKEY
     yearMonth: "2510",          // October 2025
     trustLevel: "3",            // Verified (AUTH namespace)
     checksum: calculateMod97()  // Mod-97 checksum
   });
   ```

3. **Response**:
   ```json
   {
     "success": true,
     "chittyId": "01-1-USA-0001-A-2510-3-XX",
     "format": "VV-G-LLL-SSSS-T-YM-C-X",
     "components": {
       "version": "01",
       "region": "1",
       "jurisdiction": "USA",
       "sequence": "0001",
       "type": "A",
       "yearMonth": "2510",
       "trustLevel": "3",
       "checksum": "XX"
     }
   }
   ```

**Error Handling**: If minting fails, entire API key generation fails (SERVICE OR FAIL principle)

---

### Step 6: Store API Key Record

**Service**: `APIKeyService`

**KV Storage**:
1. **Primary Storage** (by API key):
   ```javascript
   Key: "sk_live_ABC123..."
   Value: {
     "chitty_id": "01-1-USA-0123-P-2510-3-XY",  // Owner
     "name": "Production API Key",
     "scopes": ["read", "write"],
     "active": true,
     "created_at": "2025-10-11T23:15:00Z",
     "last_used": null
   }
   TTL: 365 days
   ```

2. **Reverse Lookup** (by ChittyID):
   ```javascript
   Key: "chitty:01-1-USA-0123-P-2510-3-XY"
   Value: "sk_live_ABC123..."
   TTL: 365 days
   ```

3. **Key List** (for management):
   ```javascript
   Key: "chitty:01-1-USA-0123-P-2510-3-XY:keys"
   Value: ["01-1-USA-0001-A-2510-3-XX", "01-1-USA-0002-A-2510-3-YY"]
   ```

---

### Step 7: Return Response to User

**Response**:
```json
{
  "success": true,
  "api_key": "sk_live_ABC123XYZ...",
  "key_id": "01-1-USA-0001-A-2510-3-XX",
  "created_at": "2025-10-11T23:15:00Z"
}
```

**User Action**: Store `api_key` securely (never log or expose)

**Security Note**: The `api_key` is the secret credential. The `key_id` (ChittyID) is the identifier.

---

## API Key Validation Flow

When a service receives an API request with an API key, ChittyAuth validates it:

```
┌─────────────────┐
│  API Request    │
│  Authorization: │
│  Bearer sk_...  │
└────────┬────────┘
         │
         │ POST /v1/api-keys/validate
         │ { "api_key": "sk_live_..." }
         │
         ▼
┌─────────────────────────────────┐
│      ChittyAuth Service         │
│      (APIKeyService)            │
│                                 │
│  1. Lookup key in KV            │
│     GET AUTH_TOKENS[sk_live_...] │
│                                 │
│  2. Verify key exists and active │
│                                 │
│  3. Update last_used timestamp  │
│                                 │
│  4. Return validation result    │
└────────┬────────────────────────┘
         │
         │ Response:
         │ {
         │   "valid": true,
         │   "chitty_id": "01-1-USA-0123-P-2510-3-XY",
         │   "scopes": ["read", "write"],
         │   "created_at": "2025-10-11T..."
         │ }
         │
         ▼
┌─────────────────┐
│  Service/App    │
│  Grants Access  │
└─────────────────┘
```

---

## Key Components

### 1. ChittyIDClient (npm: @chittyos/chittyid-client)

**Responsibilities**:
- Format validation (local, fast)
- Service communication (id.chitty.cc)
- Batch verification
- Entity type parsing

**Configuration**:
```javascript
const chittyIDClient = new ChittyIDClient({
  serviceUrl: "https://id.chitty.cc/v1",
  apiKey: env.CHITTYID_API_KEY
});
```

**Methods**:
- `validate(chitty_id)` - Verify ChittyID is valid
- `getDetails(chitty_id)` - Get full ChittyID metadata
- `mintAPIKeyID()` - Mint new ChittyID for API key
- `batchVerify(chitty_ids[])` - Verify multiple IDs efficiently

---

### 2. APIKeyService

**Responsibilities**:
- Generate cryptographically secure API keys
- Store API key metadata in KV
- Validate API keys on incoming requests
- Revoke/manage API keys

**Key Generation Algorithm**:
```
Input:
  - ChittyID (owner identity)
  - Cloudflare randomness beacon (32 bytes)
  - Timestamp

Process:
  1. Concatenate: chitty_id + beacon + timestamp
  2. SHA-256 hash
  3. Base64 encode (URL-safe)
  4. Prefix: "sk_live_"

Output:
  "sk_live_ABC123XYZ..." (44+ characters)
```

---

### 3. AuthorizationService

**Responsibilities**:
- Check permissions for ChittyIDs
- Manage role-based access control (RBAC)
- Grant/revoke permissions
- Query permission hierarchy

**Permission Model**:
```javascript
{
  "permissions": [
    "api_keys:generate",
    "api_keys:revoke",
    "api_keys:list",
    "users:create",
    "users:delete"
  ],
  "roles": ["admin", "developer", "viewer"],
  "granted_at": "2025-10-11T...",
  "granted_by": "01-1-USA-0001-P-2510-5-AB"  // Admin ChittyID
}
```

---

## ChittyID Format Specifications

### Official Format (v2.0+)

**Pattern**: `VV-G-LLL-SSSS-T-YM-C-X`

**Components**:

| Component | Description | Values | Example |
|-----------|-------------|--------|---------|
| VV | Version | 01, 02, etc. | 01 |
| G | Region | 1-9 | 1 (North America) |
| LLL | Jurisdiction | 3-letter code | USA, CAN, MEX |
| SSSS | Sequence | 0001-9999 | 0001 |
| T | Entity Type | P/L/T/E/A/S/F/C/I | A (APIKEY) |
| YM | Year-Month | YYMM | 2510 (Oct 2025) |
| C | Trust Level | 0-5 | 3 (Verified) |
| X | Checksum | Mod-97 | XX (calculated) |

**Entity Types**:
- **P**: Person (ChittyPerson)
- **L**: Location (ChittyPlace)
- **T**: Thing (ChittyThing - documents, evidence)
- **E**: Event (ChittyEvent)
- **A**: API Key (ChittyAPIKey)
- **S**: Session (ChittySession)
- **F**: File (ChittyFile)
- **C**: Context (ChittyContext)
- **I**: Info (ChittyInfo)

**Trust Levels**:
- **0**: Unverified
- **1**: Basic (email verified)
- **2**: Standard (phone verified)
- **3**: Verified (identity documents)
- **4**: Premium (in-person verification)
- **5**: Official (government/authority)

**Example ChittyIDs**:
```
01-1-USA-0123-P-2510-3-XY  (Person, Verified, Oct 2025)
01-1-USA-0001-A-2510-3-AB  (API Key, Verified, Oct 2025)
01-2-BRA-0456-L-2510-2-CD  (Location in Brazil, Standard)
01-1-USA-0789-T-2510-4-EF  (Thing/Document, Premium)
```

---

### Legacy Format (Deprecated, v1.0)

**Pattern**: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`

**Example**: `CHITTY-APIKEY-000001-A1B2C3D4`

**Deprecation Notice**: Legacy format supported until v2.0 release. All new systems should use official format.

---

## Security Considerations

### 1. SERVICE OR FAIL Principle

**Rule**: ALL ChittyIDs MUST come from id.chitty.cc - no local generation permitted

**Enforcement**:
```javascript
// ChittyIDClient.mintAPIKeyID()
try {
  const response = await fetch(`${this.serviceUrl}/v1/mint`, {...});
  if (!response.ok) {
    throw new Error(`Failed to mint API key ID: ${response.status}`);
  }
  return result.chitty_id;
} catch (error) {
  // NO LOCAL GENERATION - Fail if ChittyID service is unavailable
  throw new Error("ChittyID service unavailable - cannot mint API key ID");
}
```

**Rationale**:
- Prevents ID collisions across ecosystem
- Ensures global uniqueness
- Maintains central audit trail
- Enforces trust level validation

---

### 2. Rate Limiting

**API Key Generation**: 10 requests/minute per IP

**Implementation**:
- Uses Cloudflare Durable Object (AUTH_SESSIONS)
- Tracks request count per identifier
- Returns 429 status with Retry-After header

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1697062800000
```

---

### 3. Token Security

**CHITTYID_API_KEY** (ChittyAuth → ChittyID communication):
- Format: `mcp_auth_{48_hex_chars}`
- Storage: Wrangler secret (encrypted at rest)
- Scope: Full access to id.chitty.cc minting/validation
- Rotation: Every 90 days (recommended)

**API Keys** (User → ChittyOS services):
- Format: `sk_live_{base64_url_safe}`
- Length: 44+ characters
- Entropy: 256 bits (SHA-256 hash)
- Storage: KV namespace (AUTH_TOKENS)
- TTL: 365 days

---

### 4. Permission Model

**Authorization Check** (before any sensitive operation):
```javascript
const canGenerateKeys = await authorizationService.hasPermission(
  chitty_id,
  "api_keys:generate"
);

if (!canGenerateKeys) {
  return { error: "Insufficient permissions", status: 403 };
}
```

**Permission Format**: `{resource}:{action}`
- `api_keys:generate`
- `api_keys:revoke`
- `users:create`
- `users:delete`
- `data:read`
- `data:write`

---

## Error Handling

### ChittyID Service Unavailable

**Scenario**: id.chitty.cc returns 503 or times out

**ChittyAuth Response**:
```json
{
  "success": false,
  "error": "ChittyID service unavailable - cannot mint API key ID",
  "status": 503,
  "retry_after": 60
}
```

**User Action**: Wait and retry

---

### Invalid ChittyID

**Scenario**: ChittyID format invalid or verification fails

**ChittyAuth Response**:
```json
{
  "success": false,
  "error": "Invalid ChittyID",
  "status": 401
}
```

**User Action**: Obtain valid ChittyID from id.chitty.cc

---

### Insufficient Permissions

**Scenario**: ChittyID doesn't have `api_keys:generate` permission

**ChittyAuth Response**:
```json
{
  "success": false,
  "error": "Insufficient permissions to generate API keys",
  "status": 403
}
```

**User Action**: Contact administrator to grant permissions

---

### Rate Limit Exceeded

**Scenario**: More than 10 API key generation requests in 1 minute

**ChittyAuth Response**:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 45,
  "status": 429
}
```

**User Action**: Wait 45 seconds and retry

---

## Environment Configuration

### ChittyAuth (.env)

```bash
# ChittyID Service
CHITTYID_SERVICE_URL=https://id.chitty.cc/v1
CHITTYID_API_KEY=mcp_auth_16d1a27d6d5b60919b2d06d44f982353474d05960d0093aa

# Cloudflare Resources
AUTH_TOKENS=<KV_NAMESPACE_ID>         # API key storage
AUTH_PERMISSIONS=<KV_NAMESPACE_ID>    # Permission storage
AUTH_SESSIONS=<DURABLE_OBJECT_ID>     # Rate limiter

# JWT Configuration
JWT_SECRET=<secret_key>
JWT_ISSUER=auth.chitty.cc
JWT_AUDIENCE=chittyos-services

# Service Registry
REGISTRY_URL=https://registry.chitty.cc
```

### ChittyID (.env)

```bash
# KV Storage (requires paid plan $5/month)
CHITTYID_KV=<KV_NAMESPACE_ID>

# Pipeline Configuration
PIPELINE_REQUIRED=true
PIPELINE_STAGES=router,intake,trust,authorization,generation

# Trust Level Defaults
DEFAULT_TRUST_LEVEL=3
AUTH_NAMESPACE_TRUST=3
```

---

## Testing Flow

### 1. Generate API Key (Happy Path)

```bash
# Step 1: Request API key generation
curl -X POST https://auth.chitty.cc/v1/api-keys/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chitty_id": "01-1-USA-0123-P-2510-3-XY",
    "name": "Test API Key",
    "scopes": ["read"]
  }'

# Expected Response:
# {
#   "success": true,
#   "api_key": "sk_live_ABC123XYZ...",
#   "key_id": "01-1-USA-0001-A-2510-3-AB",
#   "created_at": "2025-10-11T23:30:00Z"
# }
```

---

### 2. Validate API Key

```bash
# Step 2: Validate the generated API key
curl -X POST https://auth.chitty.cc/v1/api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "sk_live_ABC123XYZ..."
  }'

# Expected Response:
# {
#   "valid": true,
#   "chitty_id": "01-1-USA-0123-P-2510-3-XY",
#   "scopes": ["read"],
#   "created_at": "2025-10-11T23:30:00Z"
# }
```

---

### 3. Test ChittyID Verification

```bash
# Direct test of ChittyID service
curl -X POST https://id.chitty.cc/v1/verify \
  -H "Authorization: Bearer mcp_auth_16d1a27d6d5b60919b2d06d44f982353474d05960d0093aa" \
  -H "Content-Type: application/json" \
  -d '{
    "chitty_id": "01-1-USA-0123-P-2510-3-XY"
  }'

# Expected Response:
# {
#   "valid": true,
#   "details": {
#     "version": "01",
#     "region": "1",
#     "jurisdiction": "USA",
#     "sequence": "0123",
#     "type": "P",
#     "yearMonth": "2510",
#     "trustLevel": "3",
#     "checksum": "XY"
#   }
# }
```

---

## Summary

### Key Takeaways

1. **ChittyAuth** is the authentication gateway for ChittyOS ecosystem
2. **ChittyID** is the central identity authority - all IDs minted there
3. **SERVICE OR FAIL** - no local ID generation, fail if service unavailable
4. **API Keys** get their own ChittyIDs for full traceability
5. **Rate limiting** prevents abuse (10 req/min for key generation)
6. **Permission model** enforces RBAC via KV storage
7. **Official format** (VV-G-LLL-SSSS-T-YM-C-X) is mandatory for v2.0+

### Integration Checklist

For any service integrating with ChittyAuth:

- [ ] Install `@chittyos/chittyid-client` npm package
- [ ] Configure `CHITTYID_SERVICE_URL` and `CHITTYID_API_KEY`
- [ ] Use ChittyIDClient for all validation/minting operations
- [ ] Never generate ChittyIDs locally
- [ ] Handle SERVICE OR FAIL gracefully (return errors, don't fallback)
- [ ] Implement rate limiting for authentication endpoints
- [ ] Store API keys in KV with proper TTL (365 days)
- [ ] Use official ChittyID format (VV-G-LLL-SSSS-T-YM-C-X)
- [ ] Test error scenarios (service unavailable, invalid ID, rate limit)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**ChittyOS Version**: v1.0.1
**ChittyAuth Version**: v1.0.0
**ChittyID Format**: v2.0 (Official)
