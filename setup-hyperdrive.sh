#!/bin/bash

# ChittyChat Hyperdrive Setup Script
# This script creates Hyperdrive services for Neon databases

echo "🚀 Setting up Cloudflare Hyperdrive for ChittyChat sync services..."
echo

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
echo "📋 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

echo "✅ Cloudflare authentication confirmed"
echo

# Function to create Hyperdrive service
create_hyperdrive() {
    local name=$1
    local connection_string=$2

    echo "🔧 Creating Hyperdrive service: $name"

    # Create the Hyperdrive service
    local result=$(wrangler hyperdrive create "$name" --connection-string "$connection_string" --output json 2>/dev/null)

    if [ $? -eq 0 ]; then
        local hyperdrive_id=$(echo "$result" | jq -r '.id')
        echo "✅ Created Hyperdrive service: $name (ID: $hyperdrive_id)"
        echo "$hyperdrive_id"
    else
        echo "❌ Failed to create Hyperdrive service: $name"
        echo "Error: $result"
        return 1
    fi
}

# Function to update wrangler.toml with Hyperdrive IDs
update_wrangler_config() {
    local chittycases_id=$1
    local memory_cloude_id=$2

    echo "📝 Updating wrangler.toml with Hyperdrive IDs..."

    # Update development Hyperdrive bindings
    sed -i.bak "s/binding = \"CHITTYCASES_DB\".*$/binding = \"CHITTYCASES_DB\"\nid = \"$chittycases_id\"/" wrangler.toml
    sed -i.bak "s/binding = \"MEMORY_CLOUDE_DB\".*$/binding = \"MEMORY_CLOUDE_DB\"\nid = \"$memory_cloude_id\"/" wrangler.toml

    echo "✅ Updated wrangler.toml configuration"
}

# Main setup
echo "📊 Getting Neon database connection strings via API..."

# Get Neon API key from 1Password
echo "🔐 Retrieving Neon API key from 1Password..."
if ! NEON_API_KEY=$(op run --env-file=.env.1password -- echo '$NEON_API_KEY' 2>/dev/null); then
    echo "❌ Failed to get Neon API key from 1Password"
    echo "Please ensure you're signed in: op signin"
    exit 1
fi

echo "✅ Neon API key retrieved successfully"

# Function to get connection string via Neon API
get_neon_connection_string() {
    local project_name=$1
    echo "🔍 Getting connection string for project: $project_name"

    # Get projects list
    local projects=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" \
        "https://console.neon.tech/api/v2/projects")

    # Extract project ID for the given name
    local project_id=$(echo "$projects" | jq -r ".projects[] | select(.name == \"$project_name\") | .id")

    if [ -z "$project_id" ] || [ "$project_id" = "null" ]; then
        echo "❌ Project '$project_name' not found"
        return 1
    fi

    # Get connection string for the project
    local connection_uri=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" \
        "https://console.neon.tech/api/v2/projects/$project_id/connection_uri" | \
        jq -r '.uri')

    echo "$connection_uri"
}

# Get connection strings
echo "🔗 Fetching database connection strings..."
CHITTYCASES_CONNECTION=$(get_neon_connection_string "chittycases-cc")
if [ $? -ne 0 ]; then exit 1; fi

MEMORY_CLOUDE_CONNECTION=$(get_neon_connection_string "memory-cloude")
if [ $? -ne 0 ]; then exit 1; fi

echo "✅ Connection strings retrieved successfully"

echo
echo "🔄 Creating Hyperdrive services..."

# Create Hyperdrive services
CHITTYCASES_ID=$(create_hyperdrive "chittychat-chittycases" "$CHITTYCASES_CONNECTION")
if [ $? -ne 0 ]; then exit 1; fi

MEMORY_CLOUDE_ID=$(create_hyperdrive "chittychat-memory-cloude" "$MEMORY_CLOUDE_CONNECTION")
if [ $? -ne 0 ]; then exit 1; fi

# Update wrangler.toml
update_wrangler_config "$CHITTYCASES_ID" "$MEMORY_CLOUDE_ID"

echo
echo "🎉 Hyperdrive setup complete!"
echo
echo "Hyperdrive Service IDs:"
echo "- ChittyCases DB: $CHITTYCASES_ID"
echo "- Memory Cloude DB: $MEMORY_CLOUDE_ID"
echo
echo "Next steps:"
echo "1. Update your sync services to use Hyperdrive connections"
echo "2. Deploy your Worker: wrangler deploy"
echo "3. Test the database connectivity"
echo
echo "Your ChittyChat sync services will now use Cloudflare Hyperdrive for:"
echo "✨ Faster database connections"
echo "🌍 Global connection pooling"
echo "⚡ Reduced latency"