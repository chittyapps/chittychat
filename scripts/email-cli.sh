#!/bin/bash

# ChittyChat Email CLI - View and manage emails from the command line

VIEWER_URL="https://emails.chitty.cc"
EMAIL_WORKER="https://email-viewer.chitty.workers.dev"

# Use worker URL as fallback if custom domain isn't set up yet
BASE_URL="${VIEWER_URL}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function show_help() {
    echo "📧 ChittyChat Email CLI"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  list [category]     List emails (optional: property, financial, support, tracking)"
    echo "  view <id>          View email by ChittyID"
    echo "  search <query>     Search emails"
    echo "  leads              Show all leads sorted by score"
    echo "  stats              Show email statistics"
    echo "  tracking           Show tracked outbound emails"
    echo "  recent [n]         Show n most recent emails (default: 10)"
    echo "  web                Open web viewer in browser"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 list property"
    echo "  $0 view EMAIL-ABC123"
    echo "  $0 search 'urgent'"
    echo "  $0 leads"
}

function list_emails() {
    local category=${1:-all}
    echo -e "${BLUE}📬 Fetching emails (category: $category)...${NC}"

    response=$(curl -s "${BASE_URL}/api/emails?category=${category}&limit=20")

    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Could not connect to email service${NC}"
        echo "Try: ${EMAIL_WORKER}/api/emails"
        exit 1
    fi

    echo "$response" | jq -r '.emails[] | "\(.timestamp | strftime("%Y-%m-%d %H:%M")) | \(.category) | \(.from) | \(.subject) | \(.chittyId)"' | column -t -s '|' || echo "$response"
}

function view_email() {
    local id=$1
    if [ -z "$id" ]; then
        echo -e "${RED}Error: Please provide an email ID${NC}"
        exit 1
    fi

    echo -e "${BLUE}📧 Fetching email ${id}...${NC}"
    response=$(curl -s "${BASE_URL}/api/email?id=${id}")

    echo "$response" | jq '.' || echo "$response"
}

function search_emails() {
    local query=$1
    if [ -z "$query" ]; then
        echo -e "${RED}Error: Please provide a search query${NC}"
        exit 1
    fi

    echo -e "${BLUE}🔍 Searching for '${query}'...${NC}"
    response=$(curl -s "${BASE_URL}/api/search?q=${query}")

    echo "$response" | jq -r '.results[] | "\(.timestamp | strftime("%Y-%m-%d %H:%M")) | \(.from) | \(.subject) | \(.chittyId)"' | column -t -s '|' || echo "$response"
}

function show_leads() {
    echo -e "${BLUE}🎯 Fetching leads...${NC}"
    response=$(curl -s "${BASE_URL}/api/leads")

    echo -e "${GREEN}Score | Email | Category | Created${NC}"
    echo "$response" | jq -r '.leads[] | "\(.score) | \(.email) | \(.category) | \(.created | strftime("%Y-%m-%d"))"' | column -t -s '|' || echo "$response"
}

function show_stats() {
    echo -e "${BLUE}📊 Email Statistics${NC}"
    response=$(curl -s "${BASE_URL}/api/stats")

    echo "$response" | jq '.' || echo "$response"
}

function show_tracking() {
    echo -e "${BLUE}📈 Tracked Emails${NC}"
    response=$(curl -s "${BASE_URL}/api/tracking")

    echo "$response" | jq -r '.tracking[] | "\(.sentAt | strftime("%Y-%m-%d %H:%M")) | \(.subject) | \(.messageId)"' | column -t -s '|' || echo "$response"
}

function show_recent() {
    local limit=${1:-10}
    echo -e "${BLUE}⏰ ${limit} Most Recent Emails${NC}"

    response=$(curl -s "${BASE_URL}/api/emails?limit=${limit}")

    echo "$response" | jq -r '.emails[] | "\(.timestamp | strftime("%Y-%m-%d %H:%M")) | \(.from | split("@")[0])@... | \(.subject[0:50]) | \(.chittyId)"' | column -t -s '|' || echo "$response"
}

function open_web() {
    echo -e "${GREEN}🌐 Opening email viewer...${NC}"
    echo "URL: ${BASE_URL}"

    if command -v open &> /dev/null; then
        open "${BASE_URL}"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "${BASE_URL}"
    else
        echo "Visit: ${BASE_URL}"
    fi
}

# Main command handler
case "$1" in
    list)
        list_emails "$2"
        ;;
    view)
        view_email "$2"
        ;;
    search)
        search_emails "$2"
        ;;
    leads)
        show_leads
        ;;
    stats)
        show_stats
        ;;
    tracking)
        show_tracking
        ;;
    recent)
        show_recent "$2"
        ;;
    web)
        open_web
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        if [ -z "$1" ]; then
            show_recent 10
        else
            echo -e "${RED}Unknown command: $1${NC}"
            show_help
            exit 1
        fi
        ;;
esac