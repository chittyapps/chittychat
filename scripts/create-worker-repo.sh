#!/bin/bash
# Create dedicated repository for a ChittyOS worker
# Usage: ./scripts/create-worker-repo.sh <worker-name>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WORKER_NAME="$1"

if [ -z "$WORKER_NAME" ]; then
  echo -e "${RED}❌ Usage: $0 <worker-name>${NC}"
  echo "Example: $0 project-initiation"
  exit 1
fi

REPO_NAME="chittyos-${WORKER_NAME}-worker"
ORG="chittyos"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Creating Worker Repository: $REPO_NAME${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check gh CLI installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
  echo "Install: brew install gh"
  exit 1
fi

# Check authenticated
if ! gh auth status &> /dev/null; then
  echo -e "${RED}❌ Not authenticated with GitHub${NC}"
  echo "Run: gh auth login"
  exit 1
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"

# Create repository
echo -e "\n${BLUE}=== Creating GitHub Repository ===${NC}"

gh repo create "$ORG/$REPO_NAME" \
  --public \
  --description "ChittyOS ${WORKER_NAME} Worker - Cloudflare Workers Service" \
  --gitignore Node \
  --license MIT || {
  echo -e "${YELLOW}⚠️  Repository might already exist${NC}"
}

echo -e "${GREEN}✅ Repository created: https://github.com/$ORG/$REPO_NAME${NC}"

# Clone repository
echo -e "\n${BLUE}=== Cloning Repository ===${NC}"

REPO_DIR="../$REPO_NAME"

if [ -d "$REPO_DIR" ]; then
  echo -e "${YELLOW}⚠️  Directory exists: $REPO_DIR${NC}"
  read -p "Remove and reclone? (yes/no): " -r
  if [[ $REPLY =~ ^yes$ ]]; then
    rm -rf "$REPO_DIR"
  else
    echo "Using existing directory"
  fi
fi

if [ ! -d "$REPO_DIR" ]; then
  gh repo clone "$ORG/$REPO_NAME" "$REPO_DIR"
fi

cd "$REPO_DIR"

echo -e "${GREEN}✅ Repository cloned to: $REPO_DIR${NC}"

# Create directory structure
echo -e "\n${BLUE}=== Creating Directory Structure ===${NC}"

mkdir -p src
mkdir -p test
mkdir -p docs
mkdir -p .github/workflows

echo -e "${GREEN}✅ Directory structure created${NC}"

# Create README.md
echo -e "\n${BLUE}=== Creating README.md ===${NC}"

cat > README.md << 'EOFREADME'
# ChittyOS WORKER_NAME Worker

**Service**: WORKER_DISPLAY
**Domain**: WORKER_DOMAIN.chitty.cc
**Version**: 1.0.0

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
wrangler dev

# Deploy to production
wrangler deploy --env production
```

## API Endpoints

### Health Check
```bash
curl https://WORKER_DOMAIN.chitty.cc/health
```

### Documentation
- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)

## Development

```bash
# Run tests
npm test

# Run integration tests
npm run test:integration

# Lint code
npm run lint
```

## Deployment

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production (requires approval)
wrangler deploy --env production

# Rollback
wrangler rollback --env production
```

## Environment Variables

See `.env.example` for required configuration.

## Links

- **Production**: https://WORKER_DOMAIN.chitty.cc
- **Health**: https://WORKER_DOMAIN.chitty.cc/health
- **Registry**: https://registry.chitty.cc/services/WORKER_NAME
- **Monorepo**: https://github.com/chittyos/chittychat
- **Documentation**: https://docs.chitty.cc

## License

MIT - Part of ChittyOS Framework

---

**ChittyOS WORKER_DISPLAY Worker v1.0.0**
EOFREADME

# Replace placeholders
sed -i '' "s/WORKER_NAME/$WORKER_NAME/g" README.md
sed -i '' "s/WORKER_DISPLAY/${WORKER_NAME^}/g" README.md
sed -i '' "s/WORKER_DOMAIN/$WORKER_NAME/g" README.md

echo -e "${GREEN}✅ README.md created${NC}"

# Create package.json
echo -e "\n${BLUE}=== Creating package.json ===${NC}"

cat > package.json << EOFPACKAGE
{
  "name": "@chittyos/$WORKER_NAME-worker",
  "version": "1.0.0",
  "description": "ChittyOS $WORKER_NAME Worker - Cloudflare Workers Service",
  "main": "src/index.js",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "test": "node test/integration.test.js",
    "test:integration": "BASE_URL=http://localhost:8787 node test/integration.test.js",
    "lint": "eslint src/",
    "tail": "wrangler tail"
  },
  "keywords": [
    "chittyos",
    "cloudflare",
    "workers",
    "$WORKER_NAME"
  ],
  "author": "ChittyOS Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/$ORG/$REPO_NAME"
  },
  "dependencies": {},
  "devDependencies": {
    "wrangler": "^3.78.0"
  }
}
EOFPACKAGE

echo -e "${GREEN}✅ package.json created${NC}"

# Create wrangler.toml
echo -e "\n${BLUE}=== Creating wrangler.toml ===${NC}"

cat > wrangler.toml << EOFWRANGLER
name = "$REPO_NAME"
main = "src/index.js"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]
account_id = "0bc21e3a5a9de1a4cc843be9c3e98121"

[vars]
SERVICE_NAME = "$WORKER_NAME"
SERVICE_VERSION = "1.0.0"

# Staging environment
[env.staging]
name = "$REPO_NAME-staging"
routes = [
  { pattern = "staging-$WORKER_NAME.chitty.cc/*", zone_name = "chitty.cc" }
]

[env.staging.vars]
ENVIRONMENT = "staging"

# Production environment
[env.production]
name = "$REPO_NAME-production"
routes = [
  { pattern = "$WORKER_NAME.chitty.cc/*", zone_name = "chitty.cc" }
]

[env.production.vars]
ENVIRONMENT = "production"
EOFWRANGLER

echo -e "${GREEN}✅ wrangler.toml created${NC}"

# Create GitHub Actions workflow
echo -e "\n${BLUE}=== Creating GitHub Actions Workflow ===${NC}"

cat > .github/workflows/deploy.yml << 'EOFWORKFLOW'
name: Deploy Worker

on:
  push:
    branches:
      - main
      - production
  workflow_dispatch:

env:
  NODE_VERSION: '20'

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: staging
      url: https://staging-WORKER_NAME.chitty.cc

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - run: npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env staging
          wranglerVersion: '3.78.0'

      - name: Health Check
        run: |
          sleep 15
          curl -f https://staging-WORKER_NAME.chitty.cc/health || exit 1

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/production'
    environment:
      name: production
      url: https://WORKER_NAME.chitty.cc

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - run: npm ci

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production
          wranglerVersion: '3.78.0'

      - name: Health Check
        run: |
          sleep 15
          curl -f https://WORKER_NAME.chitty.cc/health || exit 1
EOFWORKFLOW

sed -i '' "s/WORKER_NAME/$WORKER_NAME/g" .github/workflows/deploy.yml

echo -e "${GREEN}✅ GitHub Actions workflow created${NC}"

# Create basic worker code
echo -e "\n${BLUE}=== Creating Worker Code ===${NC}"

cat > src/index.js << 'EOFWORKER'
/**
 * ChittyOS WORKER_NAME Worker
 * Version: 1.0.0
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'WORKER_NAME',
          version: env.SERVICE_VERSION || '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({
        service: 'WORKER_NAME',
        message: 'Worker running',
        version: env.SERVICE_VERSION || '1.0.0',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
EOFWORKER

sed -i '' "s/WORKER_NAME/$WORKER_NAME/g" src/index.js

echo -e "${GREEN}✅ Worker code created${NC}"

# Create test file
echo -e "\n${BLUE}=== Creating Test File ===${NC}"

cat > test/integration.test.js << 'EOFTEST'
/**
 * Integration tests for WORKER_NAME worker
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

async function testHealthCheck() {
  console.log('Testing health check...');
  const response = await fetch(`${BASE_URL}/health`);
  const data = await response.json();

  if (response.status === 200 && data.status === 'healthy') {
    console.log('✅ Health check passed');
    return true;
  } else {
    console.log('❌ Health check failed');
    return false;
  }
}

async function runTests() {
  console.log('Running integration tests...\n');

  const results = await Promise.all([
    testHealthCheck(),
  ]);

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\nResults: ${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
EOFTEST

sed -i '' "s/WORKER_NAME/$WORKER_NAME/g" test/integration.test.js

echo -e "${GREEN}✅ Test file created${NC}"

# Create .env.example
cat > .env.example << 'EOFENV'
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=0bc21e3a5a9de1a4cc843be9c3e98121
CLOUDFLARE_API_TOKEN=your-token-here

# Service Configuration
SERVICE_NAME=WORKER_NAME
SERVICE_VERSION=1.0.0
ENVIRONMENT=development
EOFENV

sed -i '' "s/WORKER_NAME/$WORKER_NAME/g" .env.example

# Create CHANGELOG.md
cat > CHANGELOG.md << 'EOFCHANGELOG'
# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-10-18

### Added
- Initial release
- Basic worker structure
- Health check endpoint
- GitHub Actions CI/CD
- Integration tests

[1.0.0]: https://github.com/chittyos/REPO_NAME/releases/tag/v1.0.0
EOFCHANGELOG

sed -i '' "s/REPO_NAME/$REPO_NAME/g" CHANGELOG.md

# Add topics to repository
echo -e "\n${BLUE}=== Adding Repository Topics ===${NC}"

gh repo edit "$ORG/$REPO_NAME" \
  --add-topic chittyos \
  --add-topic cloudflare-workers \
  --add-topic worker \
  --add-topic "$WORKER_NAME" || echo "Topics already set"

# Commit and push
echo -e "\n${BLUE}=== Committing and Pushing ===${NC}"

git add .
git commit -m "Initial worker setup for $WORKER_NAME

- Basic worker structure
- Health check endpoint
- GitHub Actions workflow
- Integration tests
- Documentation

🤖 Generated with ChittyOS worker creation script"

git push origin main

echo -e "${GREEN}✅ Code pushed to GitHub${NC}"

# Create production branch
echo -e "\n${BLUE}=== Creating Production Branch ===${NC}"

git checkout -b production
git push origin production
git checkout main

echo -e "${GREEN}✅ Production branch created${NC}"

# Summary
echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Worker Repository Created! 🎉                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Repository: ${GREEN}https://github.com/$ORG/$REPO_NAME${NC}"
echo -e "Directory: ${GREEN}$REPO_DIR${NC}"
echo ""
echo -e "Next steps:"
echo "  1. Add secrets to GitHub repository:"
echo "     - CLOUDFLARE_API_TOKEN"
echo "     - CLOUDFLARE_ACCOUNT_ID"
echo ""
echo "  2. Extract worker code from monorepo:"
echo "     ./scripts/sync-worker-to-repo.sh $WORKER_NAME"
echo ""
echo "  3. Deploy worker:"
echo "     cd $REPO_DIR"
echo "     wrangler deploy --env staging"
echo ""
echo "  4. Configure GitHub environments (staging, production)"
echo ""
