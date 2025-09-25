# ChittyChat Platform

Unified Cloudflare Worker platform consolidating 34+ ChittyOS services.

## Setup

```bash
# Install dependencies
npm install

# Set environment variables (no hardcoded tokens!)
export CHITTY_API_KEY="your-api-key"
export CLOUDFLARE_API_TOKEN="your-cloudflare-token"

# Run development server
npm run dev

# Deploy to production
npm run deploy
```

## Environment Variables

All sensitive tokens must be provided via environment variables:

- `CHITTY_API_KEY` - Required API key for ChittyOS services
- `CLOUDFLARE_API_TOKEN` - Cloudflare deployment token
- `NOTION_TOKEN` - Notion integration token (optional)

**Never hardcode tokens in the source code!**

## Testing

```bash
npm test
```

## CI/CD

The repository includes comprehensive GitHub Actions workflows:

- **PR Review**: Automated security validation on all pull requests
- **Codex Review**: Daily code quality analysis
- **Organization Development**: Team engagement and growth tracking
- **Security Scanning**: Continuous vulnerability detection

## License

MIT