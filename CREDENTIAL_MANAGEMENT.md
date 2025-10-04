# Credential Management Guide

## Current State

### Working Credentials
- **ChittyID Token**: Valid and authenticated (stored in environment)
- **R2 Storage**: Configured via environment variables (R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
- **Notion Token**: Configured in environment
- **1Password CLI**: Installed and authenticated

### Issues Identified
- **ChittyID Service**: Currently hitting KV storage daily limit (not a credential issue)
- **Neon Database**: Connection string present but needs testing
- **ChittyLedger Database ID**: Not configured (needed for Notion sync)

## Environment Variables Required

```bash
# Core Services
CHITTY_ID_TOKEN         # ✅ Configured (valid)
R2_BUCKET              # ✅ Configured
R2_ACCESS_KEY_ID       # ✅ Configured
R2_SECRET_ACCESS_KEY   # ✅ Configured
NOTION_TOKEN           # ✅ Configured

# ChittySchema Centralized Database
ARIAS_DB_URL              # ✅ Connected (ep-solitary-darkness-aem5a1yw)
CHITTYLEGDER_DATABASE_ID  # ✅ Configured (3a168a269d06425fbc308ab6ab66d28b)

# Schema Management
CHITTYSCHEMA_URL          # ✅ Centralized via /CHITTYOS/chittyos-services/chittyschema/
DATABASE_SCHEMA           # ✅ Event-sourced ChittyLedger production schema

# Legacy
NEON_CONNECTION_STRING    # ⚠️  Replaced by ChittySchema centralized management
```

## 1Password Integration Setup

### Create .env.op File
To use 1Password CLI for credential injection, create a `.env.op` file:

```bash
# .env.op - 1Password reference file
CHITTY_ID_TOKEN="op://ChittyOS-Deployment/ChittyID-Service/token"
R2_ACCESS_KEY_ID="op://ChittyOS-Deployment/R2-Storage/access_key"
R2_SECRET_ACCESS_KEY="op://ChittyOS-Deployment/R2-Storage/secret_key"
NEON_CONNECTION_STRING="op://ChittyOS-Deployment/Neon-Database/connection_string"
NOTION_TOKEN="op://ChittyOS-Deployment/Notion-Integration/token"
CHITTYLEGDER_DATABASE_ID="op://ChittyOS-Deployment/Notion-ChittyLedger/database_id"
```

### Usage
```bash
# Run commands with 1Password credential injection
op run --env-file=.env.op -- python3 evidence_cli.py --case-id 2024D007847

# Or export to environment
eval $(op run --env-file=.env.op -- printenv)
```

## Manual Credential Refresh

If credentials expire or need refresh:

```bash
# 1. Sign in to 1Password CLI
op signin

# 2. List available items
op item list | grep -i chitty

# 3. Get specific credential
op item get "ChittyID-Service" --fields token

# 4. Export to environment
export CHITTY_ID_TOKEN=$(op item get "ChittyID-Service" --fields token)
```

## Service Status

### ChittyID Service
- **Endpoint**: https://id.chitty.cc/v1/mint
- **Status**: ⚠️ Working but hitting daily KV limit
- **Error**: "KV put() limit exceeded for the day"
- **Resolution**: Wait for daily reset or contact service admin

### Testing Credentials

```bash
# Test ChittyID token
curl -X POST https://id.chitty.cc/v1/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -d '{"domain":"evidence","subtype":"test"}'

# Test Neon connection
psql "$NEON_CONNECTION_STRING" -c "SELECT version();"

# Test R2 access (requires AWS CLI configured for R2)
aws s3 ls s3://$R2_BUCKET --endpoint-url=$R2_ENDPOINT

# Test Notion API
curl -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/users/me
```

## Security Best Practices

1. **Never commit credentials** to git repositories
2. **Use 1Password CLI** for credential management
3. **Rotate tokens regularly** especially if exposed
4. **Set minimal permissions** for service accounts
5. **Use environment variables** not hardcoded values
6. **Monitor service quotas** to avoid disruption

## Troubleshooting

### "KV put() limit exceeded"
- ChittyID service has daily limits on ID generation
- Not a credential issue - wait for reset or use cached IDs

### "403 Forbidden" from ChittyID
- Check token expiration: `echo $CHITTY_ID_TOKEN | base64 -d`
- Verify token format: Should start with "Bearer " in header
- Ensure POST request with JSON body

### Neon Connection Failures
- Verify SSL mode: `?sslmode=require` in connection string
- Check network access to Neon endpoints
- Confirm database exists and user has permissions

### Notion API Errors
- Verify integration has access to target database
- Check Notion API version in headers
- Ensure database ID is correct format