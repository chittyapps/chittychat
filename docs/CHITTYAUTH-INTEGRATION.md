# ChittyAuth Integration Strategy

**Version**: 1.0
**Date**: 2025-10-12
**Status**: Production-Ready

## Overview

ChittyAuth provides Zero Trust authentication for the entire ChittyOS platform. The unified platform worker (`platform-worker.js`) integrates with ChittyAuth for user authentication, API key validation, and session management.

## Architecture

```
Client Request
    ↓
Platform Worker (gateway.chitty.cc)
    ↓
Auth Middleware Check
    ↓
ChittyAuth Service (auth.chitty.cc)
    ├── JWT Validation
    ├── API Key Validation
    └── Session Management
    ↓
Service Handler
```

## Integration Points

### 1. Service Handler (`src/services/auth.js`)

The platform delegates all auth operations to ChittyAuth:

```javascript
// Proxies to auth.chitty.cc
export async function handleAuth(context) {
  const { request, env } = context;
  const authUrl = env.CHITTYAUTH_URL || 'https://auth.chitty.cc';

  // Forward request to ChittyAuth worker
  return fetch(authUrl + request.url.pathname, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
}
```

### 2. Authentication Middleware

Platform services use auth middleware for protected routes:

```javascript
async function authMiddleware(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Validate via ChittyAuth /v1/verify endpoint
  const verifyResponse = await fetch('https://auth.chitty.cc/v1/verify', {
    method: 'POST',
    headers: { 'Authorization': authHeader }
  });

  if (!verifyResponse.ok) {
    return new Response('Invalid token', { status: 403 });
  }

  const { chitty_id, scopes } = await verifyResponse.json();
  return { chitty_id, scopes };
}
```

### 3. ChittyAuth Endpoints

**User Authentication**:
- `POST /v1/auth/register` - User registration
- `POST /v1/auth/login` - User login
- `POST /v1/auth/logout` - Session termination
- `GET /v1/auth/session` - Session validation

**API Keys**:
- `POST /v1/api-keys/generate` - Generate API key (requires ChittyID)
- `POST /v1/api-keys/validate` - Validate API key
- `DELETE /v1/api-keys/revoke` - Revoke API key

**JWT Tokens**:
- `POST /v1/tokens/generate` - Generate JWT
- `POST /v1/tokens/refresh` - Refresh JWT
- `POST /v1/tokens/validate` - Validate JWT

**OAuth 2.0**:
- `POST /v1/mcp/linked-app/oauth` - Issue authorization code
- `POST /v1/mcp/linked-app/token` - Exchange code for tokens
- `POST /v1/mcp/portal/authenticate` - Cloudflare Zero Trust portal auth

**Universal Verification**:
- `POST /v1/verify` - Validates JWT or API keys (accepts Authorization header or request body)

### 4. Environment Configuration

```bash
# Required
CHITTYAUTH_URL=https://auth.chitty.cc
CHITTY_ID_TOKEN=<token>  # For ChittyID integration

# Optional
JWT_SECRET=<secret>  # For JWT generation
CHITTYAUTH_MCP_URL=https://auth-mcp.chitty.cc  # MCP agent
```

## Security Patterns

### Zero Trust Model

All requests require authentication:
1. **Public endpoints**: `/health`, `/docs` (no auth)
2. **Protected endpoints**: All others require valid JWT or API key
3. **Service-to-service**: Use API keys with scoped permissions

### Token Types

**JWT Tokens**:
- 1 hour expiration
- Stored in `AUTH_TOKENS` KV namespace
- Includes ChittyID and scopes

**API Keys**:
- No expiration (until revoked)
- Stored in `API_KEYS` KV namespace
- Each key has unique ChittyID from id.chitty.cc

**OAuth Codes**:
- 10 minute expiration
- Single-use only
- Stored in `AUTH_OAUTH_CODES` KV namespace

### Rate Limiting

ChittyAuth applies rate limits per endpoint category:
- Registration: 5 req/min
- Login: 10 req/min
- API key generation: 10 req/min
- Default: 100 req/min

## Integration Checklist

- [x] ChittyAuth service deployed to auth.chitty.cc
- [x] MCP agent deployed to auth-mcp.chitty.cc
- [x] 6 KV namespaces configured
- [x] Platform worker proxies `/api/auth/*` to ChittyAuth
- [x] Auth middleware implemented for protected routes
- [x] Universal `/v1/verify` endpoint operational
- [x] OAuth 2.0 flows tested
- [x] Rate limiting active
- [x] ChittyID integration complete (runtime minting)

## Testing

### Health Check
```bash
curl https://auth.chitty.cc/health
```

### Token Verification
```bash
curl -X POST https://auth.chitty.cc/v1/verify \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### API Key Validation
```bash
curl -X POST https://auth.chitty.cc/v1/api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{"api_key":"<API_KEY>"}'
```

## Production Deployment

ChittyAuth is deployed as dual-worker architecture:
- **Main Worker**: `auth.chitty.cc` (REST API)
- **MCP Agent**: `auth-mcp.chitty.cc` (WebSocket + 10 tools)
- **Account**: ChittyCorp LLC (0bc21e3a5a9de1a4cc843be9c3e98121)
- **Readiness**: 85/100 (Production-ready)

## Next Steps

1. ✅ ChittyAuth integration complete
2. ⏳ Add auth middleware to all protected platform routes
3. ⏳ Implement service-to-service API key auth
4. ⏳ Add OAuth client management UI
5. ⏳ Integrate with ChittyRegistry for service discovery

## References

- ChittyAuth CLAUDE.md: `/CHITTYOS/chittyos-services/chittyauth/CLAUDE.md`
- Platform Worker: `/CHITTYOS/chittyos-services/chittychat/src/platform-worker.js`
- Auth Service Handler: `/CHITTYOS/chittyos-services/chittychat/src/services/auth.js`
- ChittyID Runtime Minting: Phase 1 Complete

---

**Generated**: 2025-10-12
**ChittyOS Framework**: v1.0.1
