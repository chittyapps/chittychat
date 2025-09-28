# Repository Secrets Configuration

## Required Secrets for CI/CD

Navigate to: https://github.com/chittyos/chittychat/settings/secrets/actions

Configure the following secrets:

### ChittyOS Core Services
```
CHITTY_ID_TOKEN
Description: ChittyID service authentication token
Value: [Request from id.chitty.cc admin]
```

### Database Configuration
```
NEON_CONNECTION_STRING
Description: PostgreSQL connection string for evidence metadata
Format: postgresql://user:password@host:5432/database?sslmode=require
Value: [Neon project connection string]
```

### Storage Configuration
```
R2_ENDPOINT
Description: Cloudflare R2 endpoint URL
Value: https://[account-id].r2.cloudflarestorage.com

R2_ACCESS_KEY
Description: R2 access key ID
Value: [Cloudflare R2 access key]

R2_SECRET_KEY
Description: R2 secret access key
Value: [Cloudflare R2 secret key]
```

### Optional Integrations
```
NOTION_TOKEN
Description: Notion integration token for evidence dashboard
Value: secret_[notion_integration_token]

CHITTYLEGDER_DATABASE_ID
Description: Notion database ID for evidence tracking
Value: [32-character database ID]

CHITTYROUTER_API_KEY
Description: ChittyRouter service API key (fallback to OPENAI_API_KEY)
Value: [ChittyRouter service key]
```

## Environment Variables (Already Configured)
```
R2_BUCKET=chittyos-evidence
```

## Verification Commands

After configuring secrets, verify with:

```bash
# Test ChittyID service connectivity
curl -f -X POST https://id.chitty.cc/v1/health \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN"

# Test database connection
psql "$NEON_CONNECTION_STRING" -c "SELECT 1;"

# Test R2 connectivity
aws s3 ls --endpoint-url="$R2_ENDPOINT"
```

## Next Steps

1. Configure all required secrets in GitHub repository settings
2. Re-run CI checks to verify connectivity
3. Merge PR #8 once all checks pass
4. Set up branch protection rules requiring CI approval

## Security Notes

- Never commit these values to the repository
- Rotate secrets regularly (quarterly recommended)
- Use least-privilege access for all service accounts
- Monitor secret usage in GitHub Actions logs