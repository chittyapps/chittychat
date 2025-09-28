#!/bin/bash

# ChittyID Slash Command
# Comprehensive ChittyID integration checker and fixer

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}   CHITTYID INTEGRATION ANALYZER${RESET}"
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo ""

# 1. SERVICE STATUS
echo -e "${BOLD}1. SERVICE STATUS${RESET}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://id.chitty.cc/health 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓${RESET} ChittyID service online (HTTP $HTTP_CODE)"
    SERVICE_DATA=$(curl -s https://id.chitty.cc/health 2>/dev/null | jq '.' 2>/dev/null || echo "{}")
    if [ "$SERVICE_DATA" != "{}" ]; then
        echo "$SERVICE_DATA" | jq -r 'to_entries[] | "    \(.key): \(.value)"' 2>/dev/null | head -5
    fi
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "  ${YELLOW}⚠${RESET} ChittyID service reachable but health endpoint not found"
else
    echo -e "  ${RED}✗${RESET} ChittyID service unreachable (HTTP $HTTP_CODE)"
fi
echo ""

# 2. TOKEN CONFIGURATION
echo -e "${BOLD}2. TOKEN CONFIGURATION${RESET}"
TOKEN_FOUND=false
TOKEN_LOCATIONS=()

# Check .env
if [ -f ".env" ]; then
    if grep -q "CHITTY_ID_TOKEN" .env 2>/dev/null; then
        echo -e "  ${GREEN}✓${RESET} Token found in .env"
        TOKEN_FOUND=true
        TOKEN_LOCATIONS+=(".env")
    fi
fi

# Check environment
if [ -n "$CHITTY_ID_TOKEN" ]; then
    echo -e "  ${GREEN}✓${RESET} Token found in environment"
    TOKEN_FOUND=true
    TOKEN_LOCATIONS+=("environment")
fi

# Check .env.example
if [ -f ".env.example" ] && grep -q "CHITTY_ID_TOKEN" .env.example 2>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} Token template in .env.example"
else
    echo -e "  ${YELLOW}⚠${RESET} No token template in .env.example"
fi

if [ "$TOKEN_FOUND" = false ]; then
    echo -e "  ${RED}✗${RESET} No ChittyID token configured"
    echo ""
    echo -e "  ${YELLOW}FIX:${RESET} Add to .env:"
    echo -e "    CHITTY_ID_TOKEN=your_token_here"
fi
echo ""

# 3. CODE INTEGRATION
echo -e "${BOLD}3. CODE INTEGRATION${RESET}"

# Check for ChittyID usage
CHITTYID_FILES=$(grep -r "chitty.?id\|id\.chitty\.cc\|/v1/mint" --include="*.js" --include="*.ts" --include="*.py" --include="*.jsx" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v ".git" | cut -d: -f1 | sort -u)

if [ -n "$CHITTYID_FILES" ]; then
    FILE_COUNT=$(echo "$CHITTYID_FILES" | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✓${RESET} ChittyID integration found in $FILE_COUNT file(s):"
    echo "$CHITTYID_FILES" | head -3 | while read -r file; do
        echo "    • $(basename "$file")"
    done
    if [ "$FILE_COUNT" -gt 3 ]; then
        echo "    ... and $((FILE_COUNT - 3)) more"
    fi
else
    echo -e "  ${RED}✗${RESET} No ChittyID integration found in code"
fi

# Check for minting calls
MINT_CALLS=$(grep -r "/v1/mint" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
if [ "$MINT_CALLS" -gt 0 ]; then
    echo -e "  ${GREEN}✓${RESET} $MINT_CALLS minting call(s) found"
fi

# Check for validation calls
VALIDATE_CALLS=$(grep -r "/v1/validate" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
if [ "$VALIDATE_CALLS" -gt 0 ]; then
    echo -e "  ${GREEN}✓${RESET} $VALIDATE_CALLS validation call(s) found"
fi
echo ""

# 4. BAD PATTERNS
echo -e "${BOLD}4. ID GENERATION PATTERNS${RESET}"

# Check for local ID generation
UUID_COUNT=$(grep -r "uuid\|UUID" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v ".git" | wc -l | tr -d ' ')
NANOID_COUNT=$(grep -r "nanoid" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')
RANDOM_ID_COUNT=$(grep -r "Math\.random.*toString\|crypto\.randomUUID" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')

TOTAL_BAD=$((UUID_COUNT + NANOID_COUNT + RANDOM_ID_COUNT))

if [ "$TOTAL_BAD" -eq 0 ]; then
    echo -e "  ${GREEN}✓${RESET} No local ID generation detected"
else
    echo -e "  ${RED}✗${RESET} Local ID generation found:"
    [ "$UUID_COUNT" -gt 0 ] && echo -e "    • UUID: $UUID_COUNT instances"
    [ "$NANOID_COUNT" -gt 0 ] && echo -e "    • nanoid: $NANOID_COUNT instances"
    [ "$RANDOM_ID_COUNT" -gt 0 ] && echo -e "    • Random IDs: $RANDOM_ID_COUNT instances"
    echo ""
    echo -e "  ${YELLOW}These should be replaced with ChittyID minting${RESET}"
fi
echo ""

# 5. CHITTYID FORMAT IN DATA
echo -e "${BOLD}5. CHITTYID FORMAT VALIDATION${RESET}"

# Look for ChittyID format in recent files
CHITTYID_FORMAT=$(grep -r "CT-[0-9][0-9]-[0-9]-[A-Z][A-Z][A-Z]" --include="*.json" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | head -5)

if [ -n "$CHITTYID_FORMAT" ]; then
    echo -e "  ${GREEN}✓${RESET} Valid ChittyID formats found:"
    echo "$CHITTYID_FORMAT" | grep -o "CT-[0-9A-Z-]*" | head -3 | while read -r id; do
        echo "    • $id"
    done
else
    echo -e "  ${YELLOW}⚠${RESET} No ChittyID format instances found in code"
fi

# Check git commits for ChittyIDs
if [ -d ".git" ]; then
    GIT_IDS=$(git log --oneline -20 2>/dev/null | grep -o "CT-[0-9A-Z-]*" | head -3)
    if [ -n "$GIT_IDS" ]; then
        echo -e "  ${GREEN}✓${RESET} ChittyIDs in git history:"
        echo "$GIT_IDS" | while read -r id; do
            echo "    • $id"
        done
    fi
fi
echo ""

# 6. CLIENT LIBRARY
echo -e "${BOLD}6. CLIENT LIBRARY${RESET}"

if [ -f "chittyid-client.js" ] || [ -f "src/chittyid-client.js" ] || [ -f "lib/chittyid-client.js" ]; then
    echo -e "  ${GREEN}✓${RESET} ChittyID client library present"
elif [ -f "chittyid_client.py" ] || [ -f "src/chittyid_client.py" ]; then
    echo -e "  ${GREEN}✓${RESET} ChittyID Python client present"
else
    echo -e "  ${YELLOW}⚠${RESET} No ChittyID client library found"

    # Offer to create
    if [ -f "package.json" ]; then
        echo ""
        echo -e "  ${CYAN}Creating chittyid-client.js...${RESET}"
        cat > chittyid-client.js << 'EOF'
// ChittyID Service Client
const CHITTYID_SERVICE = process.env.CHITTYID_SERVICE_URL || 'https://id.chitty.cc';

class ChittyIDClient {
  constructor(token) {
    this.token = token || process.env.CHITTY_ID_TOKEN;
    if (!this.token) {
      throw new Error('CHITTY_ID_TOKEN required');
    }
  }

  async mint(domain, subtype, metadata = {}) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/mint`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ domain, subtype, metadata })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChittyID mint failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.chitty_id;
  }

  async validate(chittyId) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/validate/${chittyId}`, {
      headers: { 'authorization': `Bearer ${this.token}` }
    });
    return response.ok;
  }

  async lookup(chittyId) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/lookup/${chittyId}`, {
      headers: { 'authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      throw new Error(`ChittyID lookup failed: ${response.status}`);
    }

    return response.json();
  }
}

module.exports = { ChittyIDClient };
// For ES6: export { ChittyIDClient };
EOF
        echo -e "  ${GREEN}✓${RESET} Created chittyid-client.js"
    fi
fi
echo ""

# 7. USAGE EXAMPLES
echo -e "${BOLD}7. IMPLEMENTATION GUIDE${RESET}"

if [ -f "package.json" ]; then
    echo -e "${CYAN}JavaScript/Node.js:${RESET}"
    cat << 'EOF'

  // Import the client
  const { ChittyIDClient } = require('./chittyid-client');

  // Initialize
  const chittyid = new ChittyIDClient();

  // Mint a new ID
  const id = await chittyid.mint('legal', 'evidence', {
    case_id: '2024D007847',
    type: 'document'
  });

  // Validate an ID
  const isValid = await chittyid.validate('CT-01-1-CHI-1234-3-2411-L-97');

EOF
elif [ -f "requirements.txt" ] || ls *.py 2>/dev/null | head -1 >/dev/null; then
    echo -e "${CYAN}Python:${RESET}"
    cat << 'EOF'

  # Import the client
  from chittyid_client import ChittyIDClient

  # Initialize
  client = ChittyIDClient()

  # Mint a new ID
  chitty_id = await client.mint('legal', 'evidence', {
      'case_id': '2024D007847',
      'type': 'document'
  })

  # Validate an ID
  is_valid = await client.validate('CT-01-1-CHI-1234-3-2411-L-97')

EOF
fi

# 8. MULTI-CASE SUPPORT
echo -e "${BOLD}8. MULTI-CASE ARCHITECTURE${RESET}"

CASE_SUPPORT=$(grep -r "case.?id\|case_id\|caseId" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | wc -l | tr -d ' ')

if [ "$CASE_SUPPORT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${RESET} Multi-case support detected ($CASE_SUPPORT references)"

    # Check for case partitioning
    PARTITIONED=$(grep -r "case_id.*{.*}" --include="*.js" --include="*.ts" . 2>/dev/null | head -1)
    if [ -n "$PARTITIONED" ]; then
        echo -e "  ${GREEN}✓${RESET} Case-partitioned storage pattern found"
    fi
else
    echo -e "  ${YELLOW}⚠${RESET} No multi-case support detected"
fi
echo ""

# 9. ENVIRONMENT TEMPLATE
echo -e "${BOLD}9. ENVIRONMENT SETUP${RESET}"

if [ ! -f ".env.example" ]; then
    echo -e "  ${CYAN}Creating .env.example...${RESET}"
    cat > .env.example << 'EOF'
# ChittyID Service Configuration (REQUIRED)
CHITTY_ID_TOKEN=your_chittyid_token_here
CHITTYID_SERVICE_URL=https://id.chitty.cc

# ChittyOS Integration
CHITTYOS_ACCOUNT_ID=your_account_id_here

# Case Configuration (if applicable)
DEFAULT_CASE_ID=2024D007847
EOF
    echo -e "  ${GREEN}✓${RESET} Created .env.example"
elif ! grep -q "CHITTY_ID_TOKEN" .env.example 2>/dev/null; then
    echo "" >> .env.example
    echo "# ChittyID Service Configuration (REQUIRED)" >> .env.example
    echo "CHITTY_ID_TOKEN=your_chittyid_token_here" >> .env.example
    echo -e "  ${GREEN}✓${RESET} Added ChittyID to .env.example"
else
    echo -e "  ${GREEN}✓${RESET} .env.example properly configured"
fi
echo ""

# 10. RECOMMENDATIONS
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}   RECOMMENDATIONS${RESET}"
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}"

RECOMMENDATIONS=()

[ "$TOKEN_FOUND" = false ] && RECOMMENDATIONS+=("Add CHITTY_ID_TOKEN to .env file")
[ "$TOTAL_BAD" -gt 0 ] && RECOMMENDATIONS+=("Replace $TOTAL_BAD local ID generations with ChittyID")
[ -z "$CHITTYID_FILES" ] && RECOMMENDATIONS+=("Integrate ChittyID client into your code")
[ "$CASE_SUPPORT" -eq 0 ] && RECOMMENDATIONS+=("Consider multi-case support architecture")

if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Action Items:${RESET}"
    for i in "${!RECOMMENDATIONS[@]}"; do
        echo "  $((i+1)). ${RECOMMENDATIONS[$i]}"
    done
else
    echo -e "${GREEN}✅ ChittyID fully integrated!${RESET}"
fi

echo ""
echo -e "${CYAN}Documentation: https://id.chitty.cc/docs${RESET}"
echo -e "${CYAN}Run 'project' for interactive fixes${RESET}"