#!/bin/bash
# ChittyChat Architecture Migration Script
# This script creates the new structure and prepares for migration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base directories
OLD_BASE="/Users/nb"
NEW_BASE="/Users/nb/chittychat"

echo -e "${GREEN}ChittyChat Architecture Migration${NC}"
echo "=================================="
echo ""

# Step 1: Create new directory structure
echo -e "${YELLOW}Step 1: Creating new directory structure...${NC}"
mkdir -p "$NEW_BASE"/{core/{router,daemon,server},sync/{neon,notion,claude,shared},agents/{core,plugins}}
mkdir -p "$NEW_BASE"/{web/{app,api},cli/{chittychat,utils},config/{development,production,templates}}
mkdir -p "$NEW_BASE"/{scripts/{setup,deploy,maintenance},docs/{api,architecture,guides}}
mkdir -p "$NEW_BASE"/{tests/{unit,integration,e2e},docker/{development,production}}

# Step 2: Create README files for each directory
echo -e "${YELLOW}Step 2: Creating README files...${NC}"
cat > "$NEW_BASE/README.md" << 'EOF'
# ChittyChat

Unified ChittyChat service architecture.

## Directory Structure

- `core/` - Core services (router, daemon, server)
- `sync/` - Synchronization services
- `agents/` - AI agents
- `web/` - Web interfaces
- `cli/` - Command-line tools
- `config/` - Configuration files
- `scripts/` - Utility scripts
- `docs/` - Documentation
- `tests/` - Test suites
- `docker/` - Container configurations

## Migration Status

This is the new unified structure for ChittyChat, migrated from:
- chittychat-sync/
- chittyserv/
- chitty-agents/
EOF

# Step 3: Create migration mapping
echo -e "${YELLOW}Step 3: Creating migration mapping...${NC}"
cat > "$NEW_BASE/MIGRATION_MAP.json" << 'EOF'
{
  "mappings": [
    {
      "from": "chittychat-sync/chittychat/router",
      "to": "core/router",
      "type": "service"
    },
    {
      "from": "chittychat-sync/chittychat/daemon",
      "to": "core/daemon",
      "type": "service"
    },
    {
      "from": "chittychat-sync/chittychat/neon-sync",
      "to": "sync/neon",
      "type": "sync_service"
    },
    {
      "from": "chittychat-sync/chittychat/notion-sync",
      "to": "sync/notion",
      "type": "sync_service"
    },
    {
      "from": "chittyserv",
      "to": "core/server",
      "type": "service"
    },
    {
      "from": "chitty-agents",
      "to": "agents",
      "type": "agents"
    }
  ]
}
EOF

# Step 4: Create compatibility symlinks (for transition period)
echo -e "${YELLOW}Step 4: Creating compatibility symlinks...${NC}"
ln -sf "$NEW_BASE/core/router" "$NEW_BASE/router-compat"
ln -sf "$NEW_BASE/core/daemon" "$NEW_BASE/daemon-compat"

# Step 5: Create migration status file
echo -e "${YELLOW}Step 5: Creating migration status tracker...${NC}"
cat > "$NEW_BASE/MIGRATION_STATUS.md" << 'EOF'
# Migration Status

## Phase 1: Structure Creation ✅
- [x] Created new directory structure
- [x] Added README files
- [x] Created migration mapping
- [x] Set up compatibility symlinks

## Phase 2: Code Migration ⏳
- [ ] Router service
- [ ] Daemon service
- [ ] Neon sync
- [ ] Notion sync
- [ ] Server (chittyserv)
- [ ] Agents

## Phase 3: Configuration ⏳
- [ ] Update import paths
- [ ] Environment variables
- [ ] Service discovery
- [ ] Database connections

## Phase 4: Testing ⏳
- [ ] Unit tests
- [ ] Integration tests
- [ ] Service communication
- [ ] External integrations

## Phase 5: Cutover ⏳
- [ ] Stop old services
- [ ] Backup current state
- [ ] Start new services
- [ ] Monitor health
- [ ] Remove old structure
EOF

# Step 6: Create service start script
echo -e "${YELLOW}Step 6: Creating unified start script...${NC}"
cat > "$NEW_BASE/start-services.sh" << 'EOF'
#!/bin/bash
# Start all ChittyChat services from new structure

export CHITTYCHAT_HOME="/Users/nb/chittychat"
export NEON_DSN="${NEON_DSN:-postgresql://nb@localhost:5432/chittychat}"

echo "Starting ChittyChat services from unified structure..."

# Start core services
echo "Starting router..."
python3 "$CHITTYCHAT_HOME/core/router/main.py" &

echo "Starting daemon..."
python3 "$CHITTYCHAT_HOME/core/daemon/main.py" &

echo "Starting sync services..."
python3 "$CHITTYCHAT_HOME/sync/neon/worker.py" &

echo "All services started!"
EOF

chmod +x "$NEW_BASE/start-services.sh"

# Step 7: Create safe migration script
echo -e "${YELLOW}Step 7: Creating safe migration executor...${NC}"
cat > "$NEW_BASE/execute-migration.sh" << 'EOF'
#!/bin/bash
# Execute the actual file migration

echo "This script will copy files from old to new structure."
echo "It will NOT delete any existing files."
echo ""
read -p "Continue with migration? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting migration..."
    
    # Copy router
    if [ -d "/Users/nb/chittychat-sync/chittychat/router" ]; then
        echo "Migrating router..."
        cp -r /Users/nb/chittychat-sync/chittychat/router/* /Users/nb/chittychat/core/router/
    fi
    
    # Copy daemon
    if [ -d "/Users/nb/chittychat-sync/chittychat/daemon" ]; then
        echo "Migrating daemon..."
        cp -r /Users/nb/chittychat-sync/chittychat/daemon/* /Users/nb/chittychat/core/daemon/
    fi
    
    # Copy sync services
    if [ -d "/Users/nb/chittychat-sync/chittychat/neon-sync" ]; then
        echo "Migrating neon-sync..."
        cp -r /Users/nb/chittychat-sync/chittychat/neon-sync/* /Users/nb/chittychat/sync/neon/
    fi
    
    echo "Migration complete! Check MIGRATION_STATUS.md for next steps."
else
    echo "Migration cancelled."
fi
EOF

chmod +x "$NEW_BASE/execute-migration.sh"

echo ""
echo -e "${GREEN}✅ Migration preparation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the new structure at: $NEW_BASE"
echo "2. Check the migration plan: $NEW_BASE/MIGRATION_MAP.json"
echo "3. When ready, run: $NEW_BASE/execute-migration.sh"
echo ""
echo -e "${YELLOW}Note: This script created the structure but did NOT move any files yet.${NC}"