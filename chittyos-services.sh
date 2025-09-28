#!/bin/bash

# ChittyOS Central Services Configuration
# Loaded automatically by .zshrc and chittycheck

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ============================================
# CHITTYOS CENTRAL SERVICES
# ============================================

# Core Identity & Registry Services
export CHITTYID_SERVICE="https://id.chitty.cc"
export REGISTRY_SERVICE="https://registry.chitty.cc"
export SCHEMA_SERVICE="https://schema.chitty.cc"
export CANON_SERVICE="https://canon.chitty.cc"
export CHITTYOS_SERVICE="https://chittyos.chitty.cc"
export CHITTYCHAT_SERVICE="https://chittychat.chitty.cc"
export CHITTYMCP_SERVICE="https://chittymcp.chitty.cc"

# Verification & Trust Services
export VERIFY_SERVICE="https://verify.chitty.cc"
export CHITTYVERIFY_SERVICE="https://chittyverify.chitty.cc"
export TRUST_SERVICE="https://trust.chitty.cc"
export AUTH_SERVICE="https://auth.chitty.cc"
export CERT_SERVICE="https://cert.chitty.cc"
export CHITTYALIGN_SERVICE="https://chittyalign.chitty.cc"

# Data & Storage Services
export EVIDENCE_SERVICE="https://evidence.chitty.cc"
export LEDGER_SERVICE="https://ledger.chitty.cc"
export CHRONICLE_SERVICE="https://chronicle.chitty.cc"
export CHITTYCHRONICLE_SERVICE="https://chittychronicle.chitty.cc"
export CHITTYREGISTRY_SERVICE="https://chittyregistry.chitty.cc"

# Communication & Coordination Services
export CHAT_SERVICE="https://chat.chitty.cc"
export SYNC_SERVICE="https://sync.chitty.cc"
export BEACON_SERVICE="https://beacon.chitty.cc"
export ROUTER_SERVICE="https://router.chitty.cc"

# Financial & Business Services
export ACCOUNTS_SERVICE="https://accounts.chitty.cc"
export PAYMENTS_SERVICE="https://payments.chitty.cc"
export BILLING_SERVICE="https://billing.chitty.cc"
export TREASURY_SERVICE="https://treasury.chitty.cc"
export CHITTYFINANCE_SERVICE="https://chittyfinance.chitty.cc"

# Monitoring & Analytics Services
export ANALYTICS_SERVICE="https://analytics.chitty.cc"
export METRICS_SERVICE="https://metrics.chitty.cc"
export LOGS_SERVICE="https://logs.chitty.cc"
export ALERTS_SERVICE="https://alerts.chitty.cc"

# AI & Intelligence Services
export AI_SERVICE="https://ai.chitty.cc"
export INTEL_SERVICE="https://intel.chitty.cc"
export CHAIN_SERVICE="https://chain.chitty.cc"

# Emergency & Special Services
export EMERGENCY_SERVICE="https://emergency.chitty.cc"
export PDX_SERVICE="https://pdx.chitty.cc"
export INTAKE_SERVICE="https://intake.chitty.cc"
export CHITTYGOV_SERVICE="https://chittygov.chitty.cc"
export CHITTYCOUNSEL_SERVICE="https://chittycounsel.chitty.cc"

# Gateway Services
export GATEWAY_SERVICE="https://gateway.chitty.cc"
export API_GATEWAY="https://api.chitty.cc"

# ============================================
# DYNAMIC SERVICE DISCOVERY
# ============================================

# Fetch latest service registry from registry.chitty.cc
update_service_registry() {
    local cache_file="$HOME/.chittyos/service-registry.json"
    local cache_dir="$(dirname "$cache_file")"

    [ ! -d "$cache_dir" ] && mkdir -p "$cache_dir"

    echo -e "${CYAN}Updating service registry from registry.chitty.cc...${RESET}"

    local response=$(curl -s "$REGISTRY_SERVICE/api/v1/services/list" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo "$response" > "$cache_file"
        echo -e "${GREEN}✓ Service registry updated${RESET}"

        # Export discovered services as environment variables
        echo "$response" | jq -r '.services[] | "export \(.name | ascii_upcase)_SERVICE=\"\(.url)\""' 2>/dev/null | while read export_cmd; do
            eval "$export_cmd"
        done
    else
        echo -e "${YELLOW}⚠ Could not update registry, using cached values${RESET}"
        if [ -f "$cache_file" ]; then
            cat "$cache_file" | jq -r '.services[] | "export \(.name | ascii_upcase)_SERVICE=\"\(.url)\""' 2>/dev/null | while read export_cmd; do
                eval "$export_cmd"
            done
        fi
    fi
}

# ============================================
# SERVICE FUNCTIONS
# ============================================

# Check service health
check_service() {
    local service_url=$1
    local service_name=$2

    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$service_url/health" 2>/dev/null)

    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✓${RESET} $service_name online"
    elif [ "$http_code" = "404" ]; then
        echo -e "  ${YELLOW}⚠${RESET} $service_name (no health endpoint)"
    else
        echo -e "  ${YELLOW}✗${RESET} $service_name unreachable"
    fi
}

# List all services
chittyos_services() {
    echo -e "${CYAN}${BOLD}CHITTYOS CENTRAL SERVICES${RESET}"
    echo -e "════════════════════════════════════"

    echo -e "\n${BOLD}Core Services:${RESET}"
    echo "  • ChittyID:     $CHITTYID_SERVICE"
    echo "  • Registry:     $REGISTRY_SERVICE"
    echo "  • Schema:       $SCHEMA_SERVICE"
    echo "  • Canon:        $CANON_SERVICE"

    echo -e "\n${BOLD}Verification:${RESET}"
    echo "  • Verify:       $VERIFY_SERVICE"
    echo "  • Trust:        $TRUST_SERVICE"
    echo "  • Auth:         $AUTH_SERVICE"
    echo "  • Cert:         $CERT_SERVICE"

    echo -e "\n${BOLD}Data Services:${RESET}"
    echo "  • Evidence:     $EVIDENCE_SERVICE"
    echo "  • Ledger:       $LEDGER_SERVICE"
    echo "  • Chronicle:    $CHRONICLE_SERVICE"

    echo -e "\n${BOLD}Communication:${RESET}"
    echo "  • Chat:         $CHAT_SERVICE"
    echo "  • Sync:         $SYNC_SERVICE"
    echo "  • Beacon:       $BEACON_SERVICE"
    echo "  • Router:       $ROUTER_SERVICE"

    echo -e "\n${BOLD}Financial:${RESET}"
    echo "  • Accounts:     $ACCOUNTS_SERVICE"
    echo "  • Payments:     $PAYMENTS_SERVICE"
    echo "  • Billing:      $BILLING_SERVICE"
    echo "  • Treasury:     $TREASURY_SERVICE"

    echo -e "\n${BOLD}Monitoring:${RESET}"
    echo "  • Analytics:    $ANALYTICS_SERVICE"
    echo "  • Metrics:      $METRICS_SERVICE"
    echo "  • Logs:         $LOGS_SERVICE"
    echo "  • Alerts:       $ALERTS_SERVICE"

    echo -e "\n${BOLD}AI & Intelligence:${RESET}"
    echo "  • AI:           $AI_SERVICE"
    echo "  • Intel:        $INTEL_SERVICE"
    echo "  • Chain:        $CHAIN_SERVICE"

    echo -e "\n${BOLD}Gateways:${RESET}"
    echo "  • Gateway:      $GATEWAY_SERVICE"
    echo "  • API:          $API_GATEWAY"
}

# Check all services health
chittyos_health() {
    echo -e "${CYAN}${BOLD}CHECKING CHITTYOS SERVICES HEALTH${RESET}"
    echo -e "════════════════════════════════════"

    echo -e "\n${BOLD}Core Services:${RESET}"
    check_service "$CHITTYID_SERVICE" "ChittyID"
    check_service "$REGISTRY_SERVICE" "Registry"
    check_service "$SCHEMA_SERVICE" "Schema"
    check_service "$CANON_SERVICE" "Canon"

    echo -e "\n${BOLD}Critical Services:${RESET}"
    check_service "$VERIFY_SERVICE" "Verify"
    check_service "$AUTH_SERVICE" "Auth"
    check_service "$GATEWAY_SERVICE" "Gateway"

    echo -e "\n${BOLD}Data Services:${RESET}"
    check_service "$EVIDENCE_SERVICE" "Evidence"
    check_service "$SYNC_SERVICE" "Sync"
}

# Get canonical reference for an entity
canon() {
    local entity=$1
    if [ -z "$entity" ]; then
        echo "Usage: canon <entity>"
        return 1
    fi

    curl -s "$CANON_SERVICE/api/v1/resolve/$entity" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" 2>/dev/null | jq '.' 2>/dev/null
}

# Validate against schema
schema_validate() {
    local data=$1
    local schema_type=$2

    if [ -z "$data" ] || [ -z "$schema_type" ]; then
        echo "Usage: schema_validate <data> <schema_type>"
        return 1
    fi

    curl -s -X POST "$SCHEMA_SERVICE/api/v1/validate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -d "{\"data\": $data, \"schema\": \"$schema_type\"}" 2>/dev/null | jq '.' 2>/dev/null
}

# Register with registry
register_service() {
    local service_name=$1
    local service_url=$2

    curl -s -X POST "$REGISTRY_SERVICE/api/v1/services/register" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
        -d "{\"name\": \"$service_name\", \"url\": \"$service_url\"}" 2>/dev/null
}

# ============================================
# ALIASES FOR QUICK ACCESS
# ============================================

# Service shortcuts
alias chitty-services='chittyos_services'
alias chitty-health='chittyos_health'
alias chitty-canon='canon'
alias chitty-schema='schema_validate'

# Quick service checks
alias check-id='curl -s $CHITTYID_SERVICE/health | jq'
alias check-registry='curl -s $REGISTRY_SERVICE/health | jq'
alias check-canon='curl -s $CANON_SERVICE/health | jq'
alias check-schema='curl -s $SCHEMA_SERVICE/health | jq'

# ============================================
# AUTO-CONFIGURATION
# ============================================

# Set ChittyOS account if not set
if [ -z "$CHITTYOS_ACCOUNT_ID" ]; then
    export CHITTYOS_ACCOUNT_ID="bbf9fcd845e78035b7a135c481e88541"
fi

# Auto-update service registry on load (if older than 1 hour)
if [ -f "$HOME/.chittyos/service-registry.json" ]; then
    last_update=$(stat -f %m "$HOME/.chittyos/service-registry.json" 2>/dev/null || stat -c %Y "$HOME/.chittyos/service-registry.json" 2>/dev/null)
    current_time=$(date +%s)
    age=$((current_time - last_update))

    if [ "$age" -gt 3600 ]; then
        update_service_registry &>/dev/null &
    fi
else
    update_service_registry &>/dev/null &
fi

# Set default timeout for service calls
export CHITTYOS_TIMEOUT=${CHITTYOS_TIMEOUT:-10}

# Enable service discovery
export CHITTYOS_DISCOVERY_ENABLED=true

# ============================================
# INITIALIZATION MESSAGE
# ============================================

if [ -n "$CHITTYOS_VERBOSE" ]; then
    echo -e "${CYAN}ChittyOS Services Loaded${RESET}"
    echo "  Run 'chittyos_services' to list all services"
    echo "  Run 'chittyos_health' to check service health"
fi

# Export functions for use in scripts
export -f check_service
export -f chittyos_services
export -f chittyos_health
export -f canon
export -f schema_validate
export -f register_service