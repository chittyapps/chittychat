#!/bin/bash

# ChittyOS Intelligent Project Orchestrator
# Advanced project management with architectural analysis and conflict resolution

# First, remove any conflicting aliases
unalias project 2>/dev/null || true

project() {
    local PROJECTS_DIR="/Users/nb/.claude/projects/-"
    local PROJECT_NAME=""
    local PROJECT_PATH=""

    # Check for config command
    if [ "$1" = "config" ] || [ "$1" = "configure" ]; then
        shift
        _project_config "$@"
        return
    fi

    # Select project (either from argument or interactively)
    if [ -n "$1" ]; then
        PROJECT_NAME="$1"
        PROJECT_PATH="$PROJECTS_DIR/$1"
        if [ ! -d "$PROJECT_PATH" ]; then
            echo "❌ Project '$1' not found"
            return 1
        fi
    else
        # Interactive selection
        echo "📁 Select a project:"
        select proj in $(ls -d "$PROJECTS_DIR"/*/ 2>/dev/null | xargs -n1 basename | sort) "Cancel"; do
            case $proj in
                "Cancel") return ;;
                "") echo "Invalid selection" ;;
                *)
                    PROJECT_NAME="$proj"
                    PROJECT_PATH="$PROJECTS_DIR/$proj"
                    break
                    ;;
            esac
        done
    fi

    # Change to project directory
    cd "$PROJECT_PATH" || return

    echo "════════════════════════════════════════════════════════════"
    echo "🚀 PROJECT ORCHESTRATOR: $PROJECT_NAME"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    # Run comprehensive analysis
    _analyze_claude_sessions
    _check_chittyid_integration
    _analyze_architecture
    _detect_conflicts
    _check_dependencies
    _analyze_patterns
    _suggest_improvements

    # Interactive decision making
    _resolve_conflicts
    _apply_fixes

    echo ""
    echo "✅ Project environment ready: $PROJECT_PATH"
}

_project_config() {
    local action="$1"
    local project="$2"
    local PROJECTS_DIR="/Users/nb/.claude/projects/-"
    local CONFIG_DIR="$HOME/.chittyos/projects"

    # Create config directory if it doesn't exist
    mkdir -p "$CONFIG_DIR"

    case "$action" in
        "list"|"ls")
            echo "🔧 PROJECT CONFIGURATIONS"
            echo "════════════════════════"
            echo ""

            # List all projects with their config status
            for proj_dir in "$PROJECTS_DIR"/*/; do
                if [ -d "$proj_dir" ]; then
                    local proj_name=$(basename "$proj_dir")
                    local config_file="$CONFIG_DIR/$proj_name.json"
                    local has_config=false
                    local has_env=false
                    local has_claude_md=false
                    local git_status="no git"

                    [ -f "$config_file" ] && has_config=true
                    [ -f "$proj_dir/.env" ] && has_env=true
                    [ -f "$proj_dir/CLAUDE.md" ] && has_claude_md=true
                    [ -d "$proj_dir/.git" ] && git_status="git initialized"

                    echo "📁 $proj_name"
                    echo -n "   Status: "
                    [ "$has_config" = true ] && echo -n "✅ Config " || echo -n "⚠️  No config "
                    [ "$has_env" = true ] && echo -n "✅ .env " || echo -n "⚠️  No .env "
                    [ "$has_claude_md" = true ] && echo -n "✅ CLAUDE.md " || echo -n "⚠️  No CLAUDE.md "
                    echo "($git_status)"

                    # Show key config details if config exists
                    if [ "$has_config" = true ] && command -v jq >/dev/null 2>&1; then
                        local type=$(jq -r '.type // "unknown"' "$config_file" 2>/dev/null)
                        local framework=$(jq -r '.framework // "none"' "$config_file" 2>/dev/null)
                        local chittyid=$(jq -r '.chittyid_enabled // false' "$config_file" 2>/dev/null)
                        echo "   Type: $type | Framework: $framework | ChittyID: $chittyid"
                    fi
                    echo ""
                fi
            done
            ;;

        "show"|"view")
            if [ -z "$project" ]; then
                echo "Usage: project config show <project_name>"
                return 1
            fi

            local config_file="$CONFIG_DIR/$project.json"
            local project_path="$PROJECTS_DIR/$project"

            echo "🔍 CONFIGURATION: $project"
            echo "════════════════════════════════════"
            echo ""

            # Show saved config
            if [ -f "$config_file" ]; then
                echo "📋 Saved Configuration:"
                if command -v jq >/dev/null 2>&1; then
                    jq '.' "$config_file" 2>/dev/null
                else
                    cat "$config_file"
                fi
                echo ""
            else
                echo "⚠️  No saved configuration for $project"
                echo ""
            fi

            # Show current project state
            if [ -d "$project_path" ]; then
                echo "📊 Current Project State:"
                echo "   Path: $project_path"
                [ -f "$project_path/package.json" ] && echo "   ✅ package.json exists"
                [ -f "$project_path/.env" ] && echo "   ✅ .env exists"
                [ -f "$project_path/CLAUDE.md" ] && echo "   ✅ CLAUDE.md exists"
                [ -d "$project_path/.git" ] && echo "   ✅ Git repository initialized"

                # Detect framework
                if [ -f "$project_path/package.json" ]; then
                    echo ""
                    echo "   Dependencies:"
                    grep -E '"(react|vue|angular|svelte|express|next|wrangler)"' "$project_path/package.json" 2>/dev/null | head -5 | sed 's/^/     /'
                fi

                # Check ChittyID integration
                if grep -q "CHITTY_ID_TOKEN\|chittyid\|id\.chitty\.cc" "$project_path/.env" "$project_path/package.json" 2>/dev/null; then
                    echo ""
                    echo "   ✅ ChittyID integration detected"
                fi
            else
                echo "⚠️  Project directory not found: $project_path"
            fi
            ;;

        "set"|"update")
            if [ -z "$project" ]; then
                echo "Usage: project config set <project_name>"
                return 1
            fi

            local config_file="$CONFIG_DIR/$project.json"
            local project_path="$PROJECTS_DIR/$project"

            if [ ! -d "$project_path" ]; then
                echo "❌ Project not found: $project"
                return 1
            fi

            echo "⚙️  CONFIGURE PROJECT: $project"
            echo "════════════════════════════════════"
            echo ""

            # Load existing config or create new
            local config="{}"
            if [ -f "$config_file" ]; then
                config=$(cat "$config_file")
                echo "Updating existing configuration..."
            else
                echo "Creating new configuration..."
            fi

            # Intelligent context detection
            echo ""
            echo "🤖 INTELLIGENT PROJECT SETUP"
            echo "═══════════════════════════"

            # Detect user context
            local detected_context=""
            local recommendations=""

            # Check for existing files to understand context
            if [ -f "package.json" ]; then
                detected_context="Node.js project detected"
                if grep -q "wrangler" package.json 2>/dev/null; then
                    detected_context="Cloudflare Worker project detected"
                    recommendations="cloudflare"
                elif grep -q "next" package.json 2>/dev/null; then
                    detected_context="Next.js project detected"
                    recommendations="nextjs"
                elif grep -q "react" package.json 2>/dev/null; then
                    detected_context="React project detected"
                    recommendations="react"
                fi
            elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
                detected_context="Python project detected"
                recommendations="python"
            elif [ -f "Cargo.toml" ]; then
                detected_context="Rust project detected"
                recommendations="rust"
            elif [ -d ".obsidian" ] || [ -f "README.md" ]; then
                detected_context="Documentation project detected"
                recommendations="documentation"
            elif [ -f "docker-compose.yml" ] || [ -f "Dockerfile" ]; then
                detected_context="Containerized application detected"
                recommendations="container"
            fi

            [ -n "$detected_context" ] && echo "🔍 Context: $detected_context"

            # Role-based recommendations
            echo ""
            echo "What's your role? (This helps us recommend best practices)"
            echo "  1) Developer/Engineer"
            echo "  2) DevOps/SRE"
            echo "  3) Data Scientist/Analyst"
            echo "  4) Product Manager"
            echo "  5) Designer/Creative"
            echo "  6) Legal/Compliance"
            echo "  7) Business/Operations"
            echo ""
            read -p "Select role (1-7): " user_role

            # Provide tailored recommendations based on role
            case "$user_role" in
                1) # Developer
                    echo ""
                    echo "💡 DEVELOPER RECOMMENDATIONS:"
                    echo "  • Enable ChittyID for all entities"
                    echo "  • Use Cloudflare Workers for serverless"
                    echo "  • Connect GitHub for CI/CD"
                    echo "  • Enable AI code generation"
                    echo "  • Set up monitoring with Sentry"
                    ;;
                2) # DevOps
                    echo ""
                    echo "💡 DEVOPS RECOMMENDATIONS:"
                    echo "  • Enable CI/CD pipelines"
                    echo "  • Configure multi-environment deployments"
                    echo "  • Set up comprehensive monitoring"
                    echo "  • Use Infrastructure as Code"
                    echo "  • Enable automated testing"
                    ;;
                3) # Data Scientist
                    echo ""
                    echo "💡 DATA SCIENCE RECOMMENDATIONS:"
                    echo "  • Connect to data warehouses"
                    echo "  • Enable Jupyter/notebook integration"
                    echo "  • Set up data versioning"
                    echo "  • Configure ML experiment tracking"
                    echo "  • Use cloud compute for training"
                    ;;
                4) # Product Manager
                    echo ""
                    echo "💡 PRODUCT RECOMMENDATIONS:"
                    echo "  • Connect Notion for documentation"
                    echo "  • Enable issue tracking with GitHub"
                    echo "  • Set up analytics dashboards"
                    echo "  • Configure customer feedback loops"
                    echo "  • Use project hierarchy for roadmap"
                    ;;
                5) # Designer
                    echo ""
                    echo "💡 DESIGN RECOMMENDATIONS:"
                    echo "  • Connect Figma/design tools"
                    echo "  • Enable asset management"
                    echo "  • Set up design system sync"
                    echo "  • Configure review workflows"
                    echo "  • Use version control for assets"
                    ;;
                6) # Legal
                    echo ""
                    echo "💡 LEGAL RECOMMENDATIONS:"
                    echo "  • ALWAYS enable ChittyID for evidence"
                    echo "  • Configure audit logging"
                    echo "  • Enable data encryption"
                    echo "  • Set retention policies"
                    echo "  • Connect compliance tools"
                    ;;
                7) # Business
                    echo ""
                    echo "💡 BUSINESS RECOMMENDATIONS:"
                    echo "  • Connect productivity tools"
                    echo "  • Enable reporting dashboards"
                    echo "  • Set up workflow automation"
                    echo "  • Configure team notifications"
                    echo "  • Use project hierarchy"
                    ;;
            esac

            # Auto-suggest category based on detection and role
            local suggested_category=""
            case "$user_role" in
                1|2) suggested_category=1 ;;  # Code/Dev
                3) suggested_category=4 ;;     # Research
                4|7) suggested_category=6 ;;   # Operations
                5) suggested_category=5 ;;     # Creative
                6) suggested_category=3 ;;     # Legal
            esac

            echo ""
            echo "Project Categories:"
            echo "  1) Code/Development (cloudflare, node, react, etc.)"
            echo "  2) Documentation (docs, wiki, knowledge base)"
            echo "  3) Legal (cases, contracts, compliance)"
            echo "  4) Research (analysis, data, studies)"
            echo "  5) Creative (design, content, media)"
            echo "  6) Operations (admin, finance, hr)"
            echo "  7) Other"

            [ -n "$suggested_category" ] && echo ""
            [ -n "$suggested_category" ] && echo "📌 Recommended: Option $suggested_category based on your role"

            echo ""
            read -p "Select category (1-7) [${suggested_category:-1}]: " category_choice
            [ -z "$category_choice" ] && category_choice="${suggested_category:-1}"

            case "$category_choice" in
                1)
                    # Smart defaults for developers
                    local default_type="$recommendations"
                    [ -z "$default_type" ] && default_type="node"
                    local default_chittyid="y"
                    local default_db="postgres"
                    local default_framework="none"

                    [ "$default_type" = "cloudflare" ] && default_framework="hono" && default_db="neon"
                    [ "$default_type" = "nextjs" ] && default_framework="none" && default_db="postgres"

                    echo ""
                    echo "📊 Based on your context, recommending:"
                    echo "   • Type: $default_type"
                    echo "   • ChittyID: Enabled (best practice)"
                    echo "   • Database: $default_db"
                    [ "$default_framework" != "none" ] && echo "   • Framework: $default_framework"
                    echo ""

                    read -p "Project type (cloudflare/node/react/nextjs/other) [$default_type]: " proj_type
                    [ -z "$proj_type" ] && proj_type="$default_type"

                    read -p "Framework (none/express/fastify/hono) [$default_framework]: " framework
                    [ -z "$framework" ] && framework="$default_framework"

                    read -p "Enable ChittyID integration? (y/N) [$default_chittyid]: " chittyid_enabled
                    [ -z "$chittyid_enabled" ] && chittyid_enabled="$default_chittyid"

                    read -p "Database type (none/postgres/mysql/neon) [$default_db]: " database
                    [ -z "$database" ] && database="$default_db"

                    read -p "Primary port (default: 3000): " port
                    ;;
                2)
                    proj_type="documentation"
                    read -p "Documentation type (markdown/notion/confluence/wiki): " doc_type
                    framework="$doc_type"
                    read -p "Enable version control? (y/N): " version_control
                    chittyid_enabled="false"
                    database="none"
                    port="N/A"
                    ;;
                3)
                    proj_type="legal"
                    read -p "Legal type (case/contract/compliance/policy): " legal_type
                    framework="$legal_type"
                    read -p "Case/Matter ID: " matter_id
                    read -p "Client/Party: " client_name
                    chittyid_enabled="true"  # Legal always needs ChittyID for evidence
                    database="none"
                    port="N/A"
                    ;;
                4)
                    proj_type="research"
                    read -p "Research type (data/analysis/study/survey): " research_type
                    framework="$research_type"
                    read -p "Data sources (csv/api/database/manual): " data_sources
                    chittyid_enabled="false"
                    database="none"
                    port="N/A"
                    ;;
                5)
                    proj_type="creative"
                    read -p "Creative type (design/content/video/audio): " creative_type
                    framework="$creative_type"
                    read -p "Primary tools (figma/adobe/canva/other): " tools
                    chittyid_enabled="false"
                    database="none"
                    port="N/A"
                    ;;
                6)
                    proj_type="operations"
                    read -p "Operations type (admin/finance/hr/planning): " ops_type
                    framework="$ops_type"
                    read -p "Primary systems (notion/excel/sap/other): " systems
                    chittyid_enabled="false"
                    database="none"
                    port="N/A"
                    ;;
                7|*)
                    read -p "Project type: " proj_type
                    read -p "Category/Framework: " framework
                    read -p "Enable ChittyID? (y/N): " chittyid_enabled
                    database="none"
                    port="N/A"
                    ;;
            esac

            read -p "Description: " description
            read -p "Status (active/paused/archived/planning): " status
            read -p "Owner/Lead: " owner
            read -p "Tags (comma-separated): " tags

            # Hierarchical relationships
            echo ""
            echo "📊 PROJECT HIERARCHY & RELATIONSHIPS"
            echo "────────────────────────────────────"
            read -p "Is this a parent project? (y/N): " is_parent
            if [ "$is_parent" = "y" ] || [ "$is_parent" = "Y" ]; then
                read -p "Child projects (comma-separated): " child_projects
            else
                read -p "Parent project (if any): " parent_project
                read -p "Sibling projects (comma-separated): " sibling_projects
            fi
            read -p "Dependencies on other projects (comma-separated): " dependencies
            read -p "Projects that depend on this (comma-separated): " dependents

            # Data decisions
            echo ""
            echo "💾 DATA ARCHITECTURE DECISIONS"
            echo "──────────────────────────────"
            read -p "Primary data source (api/database/files/streaming/none): " data_source
            read -p "Data storage (local/cloud/hybrid/none): " data_storage
            read -p "Data format (json/xml/csv/binary/mixed): " data_format
            read -p "Enable data sync? (y/N): " data_sync
            if [ "$data_sync" = "y" ] || [ "$data_sync" = "Y" ]; then
                read -p "Sync targets (notion/sheets/airtable/custom): " sync_targets
                read -p "Sync frequency (realtime/hourly/daily/weekly/manual): " sync_frequency
            fi
            read -p "Data retention policy (days, 0=forever): " data_retention
            read -p "Enable data encryption? (y/N): " data_encryption

            # Extensions & Connectors with smart defaults
            echo ""
            echo "🔌 EXTENSIONS & CONNECTORS"
            echo "─────────────────────────"

            # Set defaults based on role
            local default_notion="N"
            local default_github="N"
            local default_chat="N"
            local default_storage="N"
            local default_ai="N"

            case "$user_role" in
                1|2) # Developer/DevOps
                    default_github="y"
                    default_ai="y"
                    default_storage="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ GitHub (version control & CI/CD)"
                    echo "  ✓ AI Services (code assistance)"
                    echo "  ✓ Cloud Storage (artifacts)"
                    ;;
                3) # Data Scientist
                    default_storage="y"
                    default_ai="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ Cloud Storage (datasets)"
                    echo "  ✓ AI Services (ML models)"
                    ;;
                4) # Product Manager
                    default_notion="y"
                    default_github="y"
                    default_chat="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ Notion (documentation)"
                    echo "  ✓ GitHub (issue tracking)"
                    echo "  ✓ Slack/Discord (team communication)"
                    ;;
                5) # Designer
                    default_notion="y"
                    default_storage="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ Notion (design docs)"
                    echo "  ✓ Cloud Storage (assets)"
                    ;;
                6) # Legal
                    default_notion="y"
                    default_storage="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ Notion (case management)"
                    echo "  ✓ Cloud Storage (evidence)"
                    echo "  ⚠️  Ensure encryption is enabled"
                    ;;
                7) # Business
                    default_notion="y"
                    default_chat="y"
                    echo "💡 Recommended for your role:"
                    echo "  ✓ Notion (documentation)"
                    echo "  ✓ Slack/Discord (team updates)"
                    ;;
            esac

            echo ""
            echo "Available connectors:"
            echo "  • Notion - Document & database sync"
            echo "  • GitHub - Code & issue management"
            echo "  • Slack - Team notifications"
            echo "  • Discord - Community integration"
            echo "  • Google Workspace - Sheets, Docs, Drive"
            echo "  • Microsoft 365 - Teams, OneDrive"
            echo "  • AWS - S3, Lambda, DynamoDB"
            echo "  • Cloudflare - Workers, KV, R2"
            echo "  • OpenAI/Claude - AI services"
            echo "  • Stripe - Payment processing"
            echo "  • SendGrid - Email services"
            echo "  • Twilio - SMS/Voice"
            echo "  • Zapier - Workflow automation"
            echo "  • Webhooks - Custom integrations"
            echo ""

            read -p "Connect to Notion? (y/N) [$default_notion]: " connect_notion
            [ -z "$connect_notion" ] && connect_notion="$default_notion"
            [ "$connect_notion" = "y" ] || [ "$connect_notion" = "Y" ] && {
                read -p "  Notion workspace ID: " notion_workspace
                read -p "  Notion database ID: " notion_database
            }

            read -p "Connect to GitHub? (y/N) [$default_github]: " connect_github
            [ -z "$connect_github" ] && connect_github="$default_github"
            [ "$connect_github" = "y" ] || [ "$connect_github" = "Y" ] && {
                read -p "  GitHub repo (owner/name): " github_repo
                read -p "  Enable issues sync? (y/N) [y]: " github_issues
                [ -z "$github_issues" ] && github_issues="y"
                read -p "  Enable actions/CI? (y/N) [y]: " github_actions
                [ -z "$github_actions" ] && github_actions="y"
            }

            read -p "Connect to Slack/Discord? (y/N) [$default_chat]: " connect_chat
            [ -z "$connect_chat" ] && connect_chat="$default_chat"
            [ "$connect_chat" = "y" ] || [ "$connect_chat" = "Y" ] && {
                read -p "  Platform (slack/discord/both) [slack]: " chat_platform
                [ -z "$chat_platform" ] && chat_platform="slack"
                read -p "  Channel/Server ID: " chat_channel
                read -p "  Enable notifications? (y/N) [y]: " chat_notifications
                [ -z "$chat_notifications" ] && chat_notifications="y"
            }

            read -p "Connect to cloud storage? (y/N) [$default_storage]: " connect_storage
            [ -z "$connect_storage" ] && connect_storage="$default_storage"
            [ "$connect_storage" = "y" ] || [ "$connect_storage" = "Y" ] && {
                read -p "  Provider (aws/cloudflare/google/azure) [cloudflare]: " storage_provider
                [ -z "$storage_provider" ] && storage_provider="cloudflare"
                read -p "  Bucket/Container name: " storage_bucket
            }

            read -p "Connect to AI services? (y/N) [$default_ai]: " connect_ai
            [ -z "$connect_ai" ] && connect_ai="$default_ai"
            [ "$connect_ai" = "y" ] || [ "$connect_ai" = "Y" ] && {
                read -p "  AI providers (openai/claude/both/custom) [both]: " ai_providers
                [ -z "$ai_providers" ] && ai_providers="both"
                local default_embeddings="N"
                local default_codegen="N"
                [ "$user_role" = "1" ] && default_codegen="y"  # Developers want code gen
                [ "$user_role" = "3" ] && default_embeddings="y"  # Data scientists want embeddings
                read -p "  Enable embeddings? (y/N) [$default_embeddings]: " ai_embeddings
                [ -z "$ai_embeddings" ] && ai_embeddings="$default_embeddings"
                read -p "  Enable code generation? (y/N) [$default_codegen]: " ai_codegen
                [ -z "$ai_codegen" ] && ai_codegen="$default_codegen"
            }

            read -p "Other connectors (comma-separated): " other_connectors

            # Integration decisions
            echo ""
            echo "🔄 INTEGRATION ARCHITECTURE"
            echo "──────────────────────────"
            read -p "API style (rest/graphql/grpc/websocket/none): " api_style
            read -p "Authentication method (jwt/oauth/apikey/basic/none): " auth_method
            read -p "Enable webhooks? (y/N): " enable_webhooks
            [ "$enable_webhooks" = "y" ] || [ "$enable_webhooks" = "Y" ] && {
                read -p "  Webhook endpoints (comma-separated): " webhook_endpoints
            }
            read -p "Enable event streaming? (y/N): " enable_streaming
            read -p "Rate limiting (requests/min, 0=unlimited): " rate_limit
            read -p "CORS origins (comma-separated, *=all): " cors_origins

            # Deployment decisions
            echo ""
            echo "🚀 DEPLOYMENT ARCHITECTURE"
            echo "─────────────────────────"
            read -p "Deployment target (cloudflare/vercel/aws/gcp/azure/self/none): " deploy_target
            read -p "Environment stages (dev/staging/prod or custom): " environments
            read -p "Enable CI/CD? (y/N): " enable_cicd
            read -p "Monitoring service (datadog/newrelic/sentry/custom/none): " monitoring
            read -p "Log aggregation (cloudwatch/elastic/splunk/none): " logging

            # Convert answers to JSON
            [ -z "$port" ] && port="3000"
            [ "$port" = "N/A" ] && port="null"
            [ "$chittyid_enabled" = "y" ] || [ "$chittyid_enabled" = "Y" ] && chittyid_enabled="true" || chittyid_enabled="false"
            [ -z "$status" ] && status="active"
            [ -z "$owner" ] && owner="unknown"

            # Create JSON config
            if command -v jq >/dev/null 2>&1; then
                # Build base config
                # Auto-detect impact scope and make recommendations
                local impact_scope="project"  # Default
                local macos_integration="false"
                local framework_level="false"
                local system_level="false"
                local branch_recommendation="feature"
                declare -a recommendations=()

                # Analyze project characteristics to determine impact
                PROJECT_NAME=$(basename "$PWD")

                # Framework-level detection
                if [[ "$PROJECT_NAME" =~ ^(chitty|chit) ]] && [[ ! "$PROJECT_NAME" =~ (data|test)$ ]]; then
                    framework_level="true"
                    impact_scope="framework"
                    branch_recommendation="framework"
                    recommendations+=("🌐 FRAMEWORK: This affects all ChittyOS projects")
                    recommendations+=("Use framework/* branches for changes")
                    recommendations+=("Test across multiple projects before deployment")
                    recommendations+=("Consider PATH/symlink setup for CLI tools")
                fi

                # System-level detection
                if [[ "$PROJECT_NAME" =~ (registry|id|os|gateway|canon|router)$ ]] || [ "$proj_type" = "system" ]; then
                    system_level="true"
                    impact_scope="system"
                    branch_recommendation="system"
                    recommendations+=("🌍 SYSTEM: This affects core ChittyOS infrastructure")
                    recommendations+=("Use system/* branches for changes")
                    recommendations+=("Coordinate with service registry")
                    recommendations+=("May require infrastructure updates")
                fi

                # macOS integration detection
                if [ "$(uname)" = "Darwin" ]; then
                    # Check for macOS-specific files/features
                    if [ -d "*.app" ] || grep -rq "osascript\|AppleScript\|Accessibility" . 2>/dev/null || \
                       grep -rq "share.*extension\|notification\|clipboard\|pbcopy\|pbpaste" . 2>/dev/null; then
                        macos_integration="true"
                        recommendations+=("🍎 MACOS: Native macOS integrations detected")
                        recommendations+=("Test with: Accessibility, Full Disk Access permissions")
                        recommendations+=("Consider: Raycast, Shortcuts, Share Extensions")
                    fi

                    # Check for common macOS tools
                    if grep -rq "1password\|op \|brew \|launchctl" . 2>/dev/null; then
                        macos_integration="true"
                        recommendations+=("🍎 MACOS: CLI tool integrations found")
                        recommendations+=("Ensure tools available in PATH")
                    fi
                fi

                # Special project recommendations based on name patterns
                case "$PROJECT_NAME" in
                    *check*|*fix*)
                        recommendations+=("🔍 VALIDATION: Used by all projects for compliance")
                        recommendations+=("Make globally accessible via PATH or npm -g")
                        ;;
                    *cli*)
                        recommendations+=("💻 CLI: Consider global installation strategy")
                        recommendations+=("Add to PATH: ln -s \$(pwd)/bin/chitty /usr/local/bin/")
                        ;;
                    *chat*)
                        recommendations+=("💬 COMMUNICATION: High integration complexity")
                        recommendations+=("Real-time features may affect notifications")
                        ;;
                    *router*|*gateway*)
                        recommendations+=("🚦 ROUTING: Critical data flow component")
                        recommendations+=("Consider: Load balancing, failover, caching")
                        ;;
                    *schema*|*data*)
                        recommendations+=("📊 DATA: Affects all data consumers")
                        recommendations+=("Plan: Database migrations, version compatibility")
                        ;;
                    *auth*|*id*)
                        recommendations+=("🔐 IDENTITY: Security-critical component")
                        recommendations+=("Requires: Security audit, permission review")
                        ;;
                esac

                # Auto-discover dependencies and dependents
                declare -a auto_dependencies=()
                declare -a auto_dependents=()

                # Scan for common ChittyOS dependencies in code
                if [ -f "package.json" ]; then
                    # Check package.json dependencies
                    while IFS= read -r dep; do
                        if [[ "$dep" =~ chitty ]]; then
                            auto_dependencies+=("$(echo "$dep" | sed 's/.*"\([^"]*\)".*/\1/')")
                        fi
                    done < <(grep -o '"@\?[^"]*chitty[^"]*"' package.json 2>/dev/null)
                fi

                # Scan for service calls in code
                if [ -d "." ]; then
                    # Look for ChittyOS service URLs
                    while IFS= read -r url; do
                        local service=$(echo "$url" | sed 's/.*\/\/\([^.]*\)\.chitty\.cc.*/\1/')
                        if [ "$service" != "$PROJECT_NAME" ] && [[ "$service" =~ ^[a-z]+$ ]]; then
                            auto_dependencies+=("$service")
                        fi
                    done < <(grep -rho "https://[^.]*\.chitty\.cc" --include="*.js" --include="*.ts" --include="*.json" . 2>/dev/null | sort -u)

                    # Look for imports/requires of other chitty projects
                    while IFS= read -r import; do
                        local module=$(echo "$import" | sed 's/.*['\''"][^/'\''"]*\/\([^/'\''"]*\)['\''"].*/\1/')
                        if [[ "$module" =~ ^chitty ]] && [ "$module" != "$PROJECT_NAME" ]; then
                            auto_dependencies+=("$module")
                        fi
                    done < <(grep -rho "from [\"']\.[^\"']*[\"']\|require([\"']\.[^\"']*[\"'])" --include="*.js" --include="*.ts" . 2>/dev/null)
                fi

                # Auto-discover what depends on this project
                local projects_dir="/Users/nb/.claude/projects/-"
                if [ -d "$projects_dir" ]; then
                    for other_project in "$projects_dir"/*/; do
                        if [ -d "$other_project" ] && [ "$(basename "$other_project")" != "$PROJECT_NAME" ]; then
                            # Check if other project references this one
                            if grep -rq "$PROJECT_NAME\|$(basename "$PWD")" "$other_project" --include="*.js" --include="*.ts" --include="*.json" 2>/dev/null; then
                                auto_dependents+=("$(basename "$other_project")")
                            fi
                        fi
                    done
                fi

                # Add common architectural patterns
                case "$PROJECT_NAME" in
                    *check*)
                        auto_dependents+=("chittycli" "chittychat" "all-projects")
                        recommendations+=("DEPENDENCIES: Used by all projects for validation")
                        ;;
                    *cli*)
                        auto_dependencies+=("chittycheck" "chittyid")
                        auto_dependents+=("developer-workflow")
                        ;;
                    *chat*)
                        auto_dependencies+=("chittyid" "chittyregistry" "chittyauth")
                        auto_dependents+=("communication-features")
                        ;;
                    *router*|*gateway*)
                        auto_dependencies+=("chittyid" "chittyregistry")
                        auto_dependents+=("all-services")
                        ;;
                    *schema*)
                        auto_dependents+=("chittyrouter" "chittychat" "data-consumers")
                        ;;
                    *id*)
                        auto_dependents+=("all-projects" "all-services")
                        recommendations+=("🔗 CRITICAL: Core identity service - everything depends on this")
                        ;;
                    *registry*)
                        auto_dependents+=("all-services")
                        recommendations+=("🔗 DISCOVERY: Service discovery - all services depend on this")
                        ;;
                esac

                # Remove duplicates and clean up
                auto_dependencies=($(printf '%s\n' "${auto_dependencies[@]}" | sort -u | grep -v "^$"))
                auto_dependents=($(printf '%s\n' "${auto_dependents[@]}" | sort -u | grep -v "^$"))

                # Add dependency insights to recommendations
                if [ ${#auto_dependencies[@]} -gt 0 ]; then
                    recommendations+=("DEPENDS ON: $(IFS=', '; echo "${auto_dependencies[*]}")")
                fi
                if [ ${#auto_dependents[@]} -gt 0 ]; then
                    recommendations+=("USED BY: $(IFS=', '; echo "${auto_dependents[*]}")")
                fi

                # Add architectural guidance
                if [ "$framework_level" = "true" ] || [ "$system_level" = "true" ]; then
                    recommendations+=("📁 STRUCTURE: Consider consolidating framework tools")
                    if [ "$(uname)" = "Darwin" ]; then
                        recommendations+=("🍎 LOCATION: ~/Library/Application Support/ChittyOS/")
                    else
                        recommendations+=("🐧 LOCATION: ~/.local/share/chittyos/ or /opt/chittyos/")
                    fi
                fi

                config=$(echo "{}" | jq \
                    --arg type "$proj_type" \
                    --arg framework "$framework" \
                    --arg chittyid "$chittyid_enabled" \
                    --arg database "$database" \
                    --arg desc "$description" \
                    --arg status "$status" \
                    --arg owner "$owner" \
                    --arg tags "$tags" \
                    --arg impact "$impact_scope" \
                    --arg macos "$macos_integration" \
                    --arg framework_level "$framework_level" \
                    --arg system_level "$system_level" \
                    --arg branch_rec "$branch_recommendation" \
                    --arg updated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                    '.type = $type | .framework = $framework | .chittyid_enabled = ($chittyid == "true") | .database = $database | .description = $desc | .status = $status | .owner = $owner | .tags = ($tags | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) | .impact_scope = $impact | .macos_integration = ($macos == "true") | .framework_level = ($framework_level == "true") | .system_level = ($system_level == "true") | .branch_recommendation = $branch_rec | .updated_at = $updated')

                # Add recommendations array
                local recs_json="[]"
                if [ ${#recommendations[@]} -gt 0 ]; then
                    # Convert recommendations array to JSON
                    recs_json=$(printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .)
                fi
                config=$(echo "$config" | jq --argjson recs "$recs_json" '.recommendations = $recs')

                # Combine manual and auto-discovered dependencies
                all_dependencies="$dependencies"
                if [ ${#auto_dependencies[@]} -gt 0 ]; then
                    auto_deps_str=$(IFS=','; echo "${auto_dependencies[*]}")
                    if [ -n "$all_dependencies" ]; then
                        all_dependencies="$all_dependencies,$auto_deps_str"
                    else
                        all_dependencies="$auto_deps_str"
                    fi
                fi

                all_dependents="$dependents"
                if [ ${#auto_dependents[@]} -gt 0 ]; then
                    auto_deps_str=$(IFS=','; echo "${auto_dependents[*]}")
                    if [ -n "$all_dependents" ]; then
                        all_dependents="$all_dependents,$auto_deps_str"
                    else
                        all_dependents="$auto_deps_str"
                    fi
                fi

                # Add hierarchy with auto-discovered dependencies
                config=$(echo "$config" | jq \
                    --arg parent "$parent_project" \
                    --arg children "$child_projects" \
                    --arg siblings "$sibling_projects" \
                    --arg deps "$all_dependencies" \
                    --arg dependents "$all_dependents" \
                    '.hierarchy = {
                        parent: (if $parent == "" then null else $parent end),
                        children: (if $children == "" then [] else ($children | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        siblings: (if $siblings == "" then [] else ($siblings | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        dependencies: (if $deps == "" then [] else ($deps | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        dependents: (if $dependents == "" then [] else ($dependents | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        auto_discovered: {
                            dependencies: (if ($deps | split(",") | length) > 0 then ($deps | split(",") | map(ltrimstr(" ") | rtrimstr(" ")) | map(select(. as $item | ["chittyid", "chittycheck", "chittyregistry", "chittyauth", "chittychat", "chittyrouter", "chittyschema"] | index($item)))) else [] end),
                            dependents: (if ($dependents | split(",") | length) > 0 then ($dependents | split(",") | map(ltrimstr(" ") | rtrimstr(" ")) | map(select(. as $item | ["chittyid", "chittycheck", "chittyregistry", "chittyauth", "chittychat", "chittyrouter", "chittyschema"] | index($item)))) else [] end)
                        }
                    }')

                # Add data architecture
                config=$(echo "$config" | jq \
                    --arg source "$data_source" \
                    --arg storage "$data_storage" \
                    --arg format "$data_format" \
                    --arg sync "$data_sync" \
                    --arg sync_targets "$sync_targets" \
                    --arg sync_freq "$sync_frequency" \
                    --arg retention "$data_retention" \
                    --arg encryption "$data_encryption" \
                    '.data = {
                        source: $source,
                        storage: $storage,
                        format: $format,
                        sync_enabled: ($sync == "y" or $sync == "Y"),
                        sync_targets: (if $sync_targets == "" then [] else ($sync_targets | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        sync_frequency: $sync_freq,
                        retention_days: ($retention | tonumber),
                        encryption_enabled: ($encryption == "y" or $encryption == "Y")
                    }')

                # Add connectors
                local connectors_json="{}"

                [ "$connect_notion" = "y" ] || [ "$connect_notion" = "Y" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg workspace "$notion_workspace" \
                        --arg database "$notion_database" \
                        '.notion = {enabled: true, workspace: $workspace, database: $database}')
                }

                [ "$connect_github" = "y" ] || [ "$connect_github" = "Y" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg repo "$github_repo" \
                        --arg issues "$github_issues" \
                        --arg actions "$github_actions" \
                        '.github = {enabled: true, repo: $repo, issues_sync: ($issues == "y"), actions_enabled: ($actions == "y")}')
                }

                [ "$connect_chat" = "y" ] || [ "$connect_chat" = "Y" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg platform "$chat_platform" \
                        --arg channel "$chat_channel" \
                        --arg notifs "$chat_notifications" \
                        '.chat = {enabled: true, platform: $platform, channel: $channel, notifications: ($notifs == "y")}')
                }

                [ "$connect_storage" = "y" ] || [ "$connect_storage" = "Y" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg provider "$storage_provider" \
                        --arg bucket "$storage_bucket" \
                        '.storage = {enabled: true, provider: $provider, bucket: $bucket}')
                }

                [ "$connect_ai" = "y" ] || [ "$connect_ai" = "Y" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg providers "$ai_providers" \
                        --arg embeddings "$ai_embeddings" \
                        --arg codegen "$ai_codegen" \
                        '.ai = {enabled: true, providers: ($providers | split(",") | map(ltrimstr(" ") | rtrimstr(" "))), embeddings: ($embeddings == "y"), code_generation: ($codegen == "y")}')
                }

                [ -n "$other_connectors" ] && {
                    connectors_json=$(echo "$connectors_json" | jq \
                        --arg others "$other_connectors" \
                        '.other = ($others | split(",") | map(ltrimstr(" ") | rtrimstr(" ")))')
                }

                config=$(echo "$config" | jq --argjson connectors "$connectors_json" '.connectors = $connectors')

                # Add integration architecture
                config=$(echo "$config" | jq \
                    --arg api "$api_style" \
                    --arg auth "$auth_method" \
                    --arg webhooks "$enable_webhooks" \
                    --arg endpoints "$webhook_endpoints" \
                    --arg streaming "$enable_streaming" \
                    --arg rate "$rate_limit" \
                    --arg cors "$cors_origins" \
                    '.integration = {
                        api_style: $api,
                        auth_method: $auth,
                        webhooks_enabled: ($webhooks == "y" or $webhooks == "Y"),
                        webhook_endpoints: (if $endpoints == "" then [] else ($endpoints | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        streaming_enabled: ($streaming == "y" or $streaming == "Y"),
                        rate_limit: ($rate | tonumber),
                        cors_origins: (if $cors == "" then [] else ($cors | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end)
                    }')

                # Add deployment architecture
                config=$(echo "$config" | jq \
                    --arg target "$deploy_target" \
                    --arg envs "$environments" \
                    --arg cicd "$enable_cicd" \
                    --arg monitor "$monitoring" \
                    --arg logs "$logging" \
                    '.deployment = {
                        target: $target,
                        environments: (if $envs == "" then [] else ($envs | split(",") | map(ltrimstr(" ") | rtrimstr(" "))) end),
                        cicd_enabled: ($cicd == "y" or $cicd == "Y"),
                        monitoring: $monitor,
                        logging: $logs
                    }')

                # Add port if it's a number
                if [ "$port" != "null" ]; then
                    config=$(echo "$config" | jq --arg port "$port" '.port = ($port | tonumber)')
                fi

                # Add category-specific fields
                case "$category_choice" in
                    2) # Documentation
                        [ -n "$version_control" ] && config=$(echo "$config" | jq --arg vc "$version_control" '.version_control = $vc')
                        ;;
                    3) # Legal
                        [ -n "$matter_id" ] && config=$(echo "$config" | jq --arg mid "$matter_id" '.matter_id = $mid')
                        [ -n "$client_name" ] && config=$(echo "$config" | jq --arg client "$client_name" '.client = $client')
                        ;;
                    4) # Research
                        [ -n "$data_sources" ] && config=$(echo "$config" | jq --arg ds "$data_sources" '.data_sources = ($ds | split(",") | map(ltrimstr(" ") | rtrimstr(" ")))')
                        ;;
                    5) # Creative
                        [ -n "$tools" ] && config=$(echo "$config" | jq --arg tools "$tools" '.tools = ($tools | split(",") | map(ltrimstr(" ") | rtrimstr(" ")))')
                        ;;
                    6) # Operations
                        [ -n "$systems" ] && config=$(echo "$config" | jq --arg sys "$systems" '.systems = ($sys | split(",") | map(ltrimstr(" ") | rtrimstr(" ")))')
                        ;;
                esac
            else
                # Fallback without jq
                [ "$port" = "null" ] && port_json="null" || port_json="$port"
                config="{
  \"type\": \"$proj_type\",
  \"framework\": \"$framework\",
  \"chittyid_enabled\": $chittyid_enabled,
  \"database\": \"$database\",
  \"port\": $port_json,
  \"description\": \"$description\",
  \"status\": \"$status\",
  \"owner\": \"$owner\",
  \"tags\": [$(echo "$tags" | sed 's/,/", "/g' | sed 's/^/"/; s/$/"/')],
  \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
            fi

            # Save config
            echo "$config" > "$config_file"
            echo ""
            echo "✅ Configuration saved to: $config_file"

            # Offer to update project files
            echo ""
            echo -n "Update project files based on configuration? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                _apply_project_config "$project" "$config_file"
            fi
            ;;

        "apply")
            if [ -z "$project" ]; then
                echo "Usage: project config apply <project_name>"
                return 1
            fi

            local config_file="$CONFIG_DIR/$project.json"
            if [ ! -f "$config_file" ]; then
                echo "❌ No configuration found for: $project"
                return 1
            fi

            _apply_project_config "$project" "$config_file"
            ;;

        "export")
            if [ -z "$project" ]; then
                echo "Exporting all project configurations..."
                local export_file="$HOME/chittyos-projects-export-$(date +%Y%m%d-%H%M%S).json"
                echo "{" > "$export_file"
                local first=true

                for config in "$CONFIG_DIR"/*.json; do
                    if [ -f "$config" ]; then
                        local proj_name=$(basename "$config" .json)
                        [ "$first" = false ] && echo "," >> "$export_file"
                        echo "  \"$proj_name\": $(cat "$config")" >> "$export_file"
                        first=false
                    fi
                done

                echo "}" >> "$export_file"
                echo "✅ Exported all configurations to: $export_file"
            else
                local config_file="$CONFIG_DIR/$project.json"
                if [ -f "$config_file" ]; then
                    local export_file="$HOME/$project-config-$(date +%Y%m%d-%H%M%S).json"
                    cp "$config_file" "$export_file"
                    echo "✅ Exported $project configuration to: $export_file"
                else
                    echo "❌ No configuration found for: $project"
                fi
            fi
            ;;

        "help"|*)
            echo "📖 PROJECT CONFIGURATION COMMANDS"
            echo "═════════════════════════════════"
            echo ""
            echo "Usage: project config <command> [project_name]"
            echo ""
            echo "Commands:"
            echo "  list/ls              - List all projects and their config status"
            echo "  show <project>       - Show configuration for a specific project"
            echo "  set <project>        - Create or update project configuration"
            echo "  apply <project>      - Apply saved configuration to project"
            echo "  export [project]     - Export configuration(s) to file"
            echo "  help                 - Show this help message"
            echo ""
            echo "Examples:"
            echo "  project config list"
            echo "  project config show chittychat"
            echo "  project config set chittyrouter"
            echo "  project config apply chittyschema"
            echo "  project config export"
            ;;
    esac
}

_apply_project_config() {
    local project="$1"
    local config_file="$2"
    local project_path="$PROJECTS_DIR/$project"

    echo "🚀 APPLYING CONFIGURATION TO: $project"
    echo "════════════════════════════════════"
    echo ""

    if [ ! -f "$config_file" ] || [ ! -d "$project_path" ]; then
        echo "❌ Invalid project or configuration"
        return 1
    fi

    cd "$project_path"

    # Read config values
    if command -v jq >/dev/null 2>&1; then
        local proj_type=$(jq -r '.type // "unknown"' "$config_file")
        local framework=$(jq -r '.framework // "none"' "$config_file")
        local chittyid_enabled=$(jq -r '.chittyid_enabled // false' "$config_file")
        local database=$(jq -r '.database // "none"' "$config_file")
        local port=$(jq -r '.port // 3000' "$config_file")
    fi

    # Apply ChittyID integration if enabled
    if [ "$chittyid_enabled" = "true" ]; then
        if [ ! -f ".env" ] || ! grep -q "CHITTY_ID_TOKEN" .env; then
            echo "Adding ChittyID configuration to .env..."
            echo "" >> .env
            echo "# ChittyID Service Configuration" >> .env
            echo "CHITTY_ID_TOKEN=your_chittyid_token_here" >> .env
            echo "CHITTYID_SERVICE=https://id.chitty.cc" >> .env
        fi

        if [ ! -f "chittyid-client.js" ] && [ -f "package.json" ]; then
            echo -n "Create ChittyID client module? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                _add_chittyid_template
            fi
        fi
    fi

    # Update package.json scripts based on type
    if [ -f "package.json" ] && [ "$proj_type" != "unknown" ]; then
        echo "Updating package.json scripts for $proj_type project..."

        case "$proj_type" in
            "cloudflare")
                if command -v node >/dev/null 2>&1; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'wrangler dev';
                    pkg.scripts.deploy = pkg.scripts.deploy || 'wrangler deploy';
                    pkg.scripts.tail = pkg.scripts.tail || 'wrangler tail';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                fi
                ;;
            "node"|"express")
                if command -v node >/dev/null 2>&1; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'nodemon index.js';
                    pkg.scripts.start = pkg.scripts.start || 'node index.js';
                    pkg.scripts.test = pkg.scripts.test || 'jest';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                fi
                ;;
            "react"|"nextjs")
                if command -v node >/dev/null 2>&1; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'next dev';
                    pkg.scripts.build = pkg.scripts.build || 'next build';
                    pkg.scripts.start = pkg.scripts.start || 'next start';
                    pkg.scripts.lint = pkg.scripts.lint || 'next lint';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                fi
                ;;
        esac
    fi

    echo "✅ Configuration applied successfully"
    echo ""

    # Show summary
    echo "📊 Configuration Summary:"
    echo "   Type: $proj_type"
    echo "   Framework: $framework"
    echo "   ChittyID: $chittyid_enabled"
    echo "   Database: $database"
    echo "   Port: $port"
}

_analyze_claude_sessions() {
    echo "🔄 CLAUDE SESSION ANALYSIS"
    echo "──────────────────────────"

    local session_conflicts=false
    local active_sessions=0
    local session_risks=()

    # Check for Claude Desktop sessions
    local claude_pids=$(ps aux | grep -E "Claude\.app.*Helper" | grep -v grep | wc -l | tr -d ' ')
    if [ "$claude_pids" -gt 0 ]; then
        echo "  Active Claude sessions detected: $claude_pids processes"
        active_sessions=$claude_pids
    fi

    # Check for recent evidence files (indicates active work)
    local evidence_dir="$HOME/.claude/evidence"
    if [ -d "$evidence_dir" ]; then
        local recent_evidence=$(find "$evidence_dir" -type f -mmin -30 2>/dev/null | wc -l | tr -d ' ')
        if [ "$recent_evidence" -gt 0 ]; then
            echo "  Recent activity: $recent_evidence evidence files (last 30 min)"
        fi
    fi

    # Check cross-session sync status
    if ps aux | grep -q "start-project-sync" | grep -v grep; then
        echo "  ✅ Cross-session sync is running"
    else
        echo "  ⚠️  Cross-session sync not active"
        session_risks+=("No sync between sessions")
    fi

    # Check for conflicting file modifications across sessions
    echo ""
    echo "  Checking for concurrent modifications..."

    # Look for files modified in the last hour in current project
    local recent_files=$(find . -type f -name "*.js" -o -name "*.ts" -o -name "*.json" \
        -mmin -60 2>/dev/null | head -5)

    if [ -n "$recent_files" ]; then
        echo "  Files recently modified:"
        echo "$recent_files" | head -3 | sed 's/^/    /'

        # Check if any files are open in multiple editors
        for file in $recent_files; do
            local file_locks=$(lsof "$file" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$file_locks" -gt 1 ]; then
                echo "  ⚠️  $(basename "$file") is open in multiple processes!"
                session_conflicts=true
            fi
        done
    fi

    # Check for git conflicts or uncommitted changes
    if [ -d ".git" ]; then
        local uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$uncommitted" -gt 10 ]; then
            echo "  ⚠️  Large number of uncommitted changes: $uncommitted files"
            echo "     Risk: Multiple sessions may be making incompatible changes"
            session_risks+=("High uncommitted change count")
            session_conflicts=true
        fi

        # Check for merge conflicts
        if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
            echo "  🚨 MERGE CONFLICTS DETECTED!"
            echo "     Critical: Resolve conflicts before continuing"
            session_conflicts=true
        fi
    fi

    # Analyze session divergence risk
    if [ "$active_sessions" -gt 1 ]; then
        echo ""
        echo "  ⚠️  MULTI-SESSION RISK ASSESSMENT:"

        # Check if different wrangler instances are running
        local wrangler_count=$(ps aux | grep -c "wrangler dev" | grep -v grep || echo "0")
        if [ "$wrangler_count" -gt 1 ]; then
            echo "    🚨 Multiple wrangler dev servers detected!"
            echo "       Risk: Port conflicts and state inconsistency"
            session_conflicts=true
        fi

        # Check for different branches being worked on
        if [ -d ".git" ]; then
            local current_branch=$(git branch --show-current 2>/dev/null)
            echo "    Current branch: $current_branch"

            # Look for evidence of other branch work
            local branch_files=$(find "$evidence_dir" -type f -mmin -60 -name "*branch*" 2>/dev/null)
            if [ -n "$branch_files" ]; then
                echo "    ⚠️  Evidence of multi-branch work detected"
                echo "       Recommendation: Ensure branches are properly merged"
            fi
        fi

        # Check package.json for concurrent modifications
        if [ -f "package.json" ]; then
            local pkg_age=$(stat -f "%m" package.json 2>/dev/null || stat -c "%Y" package.json 2>/dev/null)
            local current_time=$(date +%s)
            local age_minutes=$(( ($current_time - $pkg_age) / 60 ))

            if [ "$age_minutes" -lt 10 ]; then
                echo "    ⚠️  package.json recently modified ($age_minutes min ago)"
                echo "       Risk: Dependency conflicts between sessions"
            fi
        fi
    fi

    # Provide alignment recommendations
    if [ "$session_conflicts" = true ] || [ ${#session_risks[@]} -gt 0 ]; then
        echo ""
        echo "  🔧 ALIGNMENT RECOMMENDATIONS:"

        if [ "$uncommitted" -gt 10 ]; then
            echo "    1. Commit or stash current changes"
        fi

        if [ "$active_sessions" -gt 1 ]; then
            echo "    2. Coordinate between active sessions"
            echo "    3. Use cross-session sync: 'sync-project'"
        fi

        if [ "$wrangler_count" -gt 1 ]; then
            echo "    4. Stop duplicate dev servers"
        fi

        echo ""
        echo -n "  Resolve conflicts now? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            _resolve_session_conflicts
        fi
    else
        echo ""
        echo "  ✅ No session conflicts detected"
    fi

    echo ""
}

_resolve_session_conflicts() {
    echo ""
    echo "  RESOLVING SESSION CONFLICTS..."
    echo "  ──────────────────────────────"

    # SMART: Use git worktrees to prevent conflicts entirely!
    if [ -d ".git" ]; then
        echo ""
        echo "    🌳 GIT WORKTREE MANAGEMENT"
        echo "    ──────────────────────"

        # Check existing worktrees
        local worktree_count=$(git worktree list 2>/dev/null | wc -l | tr -d ' ')
        if [ "$worktree_count" -eq 1 ]; then
            echo "    No worktrees configured (working in main repo)"
            echo -n "    Create worktree for this session? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                local session_name="session-$(date +%Y%m%d-%H%M%S)"
                local worktree_path="../$(basename "$PWD")-worktrees/$session_name"

                # Create worktree directory structure
                mkdir -p "../$(basename "$PWD")-worktrees"

                # Get current branch
                local current_branch=$(git branch --show-current 2>/dev/null || echo "main")

                echo "    Creating worktree: $worktree_path"
                git worktree add "$worktree_path" -b "$session_name" "$current_branch" 2>/dev/null

                if [ $? -eq 0 ]; then
                    echo "    ✅ Created worktree for isolated development"
                    echo ""
                    echo -n "    Switch to new worktree now? (y/N): "
                    read -r response
                    if [[ "$response" =~ ^[Yy]$ ]]; then
                        cd "$worktree_path"
                        echo "    ✅ Switched to worktree: $worktree_path"
                        echo "    📝 You're now in an isolated workspace!"

                        # Copy over .env if it exists
                        if [ -f "../../$(basename "$PWD")/.env" ]; then
                            cp "../../$(basename "$PWD")/.env" .env
                            echo "    ✅ Copied .env file"
                        fi

                        # Install dependencies if needed
                        if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
                            echo "    Installing dependencies in worktree..."
                            npm install
                        fi
                    fi
                else
                    echo "    ❌ Failed to create worktree"
                fi
            fi
        else
            echo "    Existing worktrees:"
            git worktree list | sed 's/^/      /'

            echo ""
            echo -n "    Clean up old worktrees? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                git worktree prune
                echo "    ✅ Pruned stale worktrees"
            fi
        fi
        echo ""
    fi

    # Kill duplicate wrangler processes
    local wrangler_pids=$(ps aux | grep "wrangler dev" | grep -v grep | awk '{print $2}')
    if [ $(echo "$wrangler_pids" | wc -l) -gt 1 ]; then
        echo -n "    Kill duplicate wrangler processes? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "$wrangler_pids" | tail -n +2 | xargs kill 2>/dev/null
            echo "    ✅ Stopped duplicate servers"
        fi
    fi

    # Start cross-session sync if not running
    if ! ps aux | grep -q "start-project-sync" | grep -v grep; then
        echo -n "    Start cross-session sync? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            nohup node /Users/nb/jumpoff/chittychat-repo/cross-session-sync/start-project-sync.mjs &>/dev/null &
            echo "    ✅ Started cross-session sync"
        fi
    fi

    # Offer to commit changes if many uncommitted
    if [ -d ".git" ]; then
        local uncommitted=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$uncommitted" -gt 10 ]; then
            echo -n "    Commit current changes? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                git add -A
                git commit -m "WIP: Syncing between Claude sessions - $(date +%Y%m%d-%H%M%S)"
                echo "    ✅ Changes committed"
            fi
        fi
    fi
}

_check_chittyid_integration() {
    echo "🆔 CHITTYID INTEGRATION CHECK"
    echo "────────────────────────────"

    local has_chittyid=false
    local issues=()

    # Check for ChittyID token in environment
    if [ -f ".env" ]; then
        if grep -q "CHITTY_ID_TOKEN\|CHITTYID_TOKEN\|CHITTYID_API_KEY" .env 2>/dev/null; then
            echo "  ✅ ChittyID token configured"
            has_chittyid=true
        else
            echo "  ⚠️  No ChittyID token in .env"
            issues+=("Missing CHITTY_ID_TOKEN")
        fi
    fi

    # Check if ChittyID service is reachable
    if command -v curl >/dev/null 2>&1; then
        if curl -s -o /dev/null -w "%{http_code}" https://id.chitty.cc/health 2>/dev/null | grep -q "200\|404"; then
            echo "  ✅ ChittyID service reachable"
        else
            echo "  ⚠️  Cannot reach ChittyID service"
            issues+=("ChittyID service unreachable")
        fi
    fi

    # Check for local ID generation (BAD PATTERN)
    if [ -d "src" ] || [ -f "*.js" ] || [ -f "*.py" ]; then
        local bad_patterns=$(grep -r "uuid\|nanoid\|Math.random.*toString\|crypto.randomUUID" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -3)

        if [ -n "$bad_patterns" ]; then
            echo "  ⚠️  Local ID generation detected (should use ChittyID):"
            echo "$bad_patterns" | head -2 | sed 's/^/      /' | cut -c1-80
            issues+=("Local ID generation instead of ChittyID")
        fi
    fi

    # Check for ChittyID usage in code
    local chittyid_usage=$(grep -r "chitty.?id\|id\.chitty\.cc\|/v1/mint" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules | grep -v ".git" | head -1)

    if [ -n "$chittyid_usage" ]; then
        echo "  ✅ ChittyID integration found in code"
        has_chittyid=true
    elif [ -f "package.json" ] || [ -f "requirements.txt" ]; then
        echo "  ℹ️  No ChittyID usage detected in code"
    fi

    # Check for case-based architecture
    if grep -q "case.?id\|case_id\|caseId" . -r --include="*.js" --include="*.ts" --include="*.py" 2>/dev/null | head -1 >/dev/null; then
        echo "  ✅ Multi-case support detected"
    fi

    # Validate ID format in recent commits
    if [ -d ".git" ]; then
        local recent_ids=$(git log --oneline -10 2>/dev/null | grep -o "CT-[0-9A-Z-]*" | head -3)
        if [ -n "$recent_ids" ]; then
            echo "  ✅ ChittyID format in commits:"
            echo "$recent_ids" | head -2 | sed 's/^/      /'
        fi
    fi

    # Provide recommendations
    if [ ${#issues[@]} -gt 0 ]; then
        echo ""
        echo "  🔧 CHITTYID FIXES NEEDED:"

        if [[ " ${issues[@]} " =~ "Missing CHITTY_ID_TOKEN" ]]; then
            echo "    1. Add to .env: CHITTY_ID_TOKEN=your_token_here"
        fi

        if [[ " ${issues[@]} " =~ "Local ID generation" ]]; then
            echo "    2. Replace UUID/nanoid with ChittyID minting:"
            echo "       const id = await fetch('https://id.chitty.cc/v1/mint', {"
            echo "         method: 'POST',"
            echo "         headers: { 'authorization': 'Bearer ' + token },"
            echo "         body: JSON.stringify({ domain: 'your_domain', subtype: 'type' })"
            echo "       });"
        fi

        echo ""
        echo -n "  Add ChittyID integration template? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            _add_chittyid_template
        fi
    else
        echo "  ✅ ChittyID properly integrated"
    fi

    echo ""
}

_add_chittyid_template() {
    # Create ChittyID integration file
    if [ -f "package.json" ]; then
        cat > chittyid-client.js << 'EOF'
// ChittyID Service Client
const CHITTYID_SERVICE = 'https://id.chitty.cc';

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
      throw new Error(`ChittyID mint failed: ${response.status}`);
    }

    const { chitty_id } = await response.json();
    return chitty_id;
  }

  async validate(chittyId) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/validate/${chittyId}`, {
      headers: { 'authorization': `Bearer ${this.token}` }
    });
    return response.ok;
  }
}

module.exports = { ChittyIDClient };
EOF
        echo "    ✅ Created chittyid-client.js"
    elif [ -f "requirements.txt" ] || [ -f "*.py" ]; then
        cat > chittyid_client.py << 'EOF'
"""ChittyID Service Client"""
import os
import aiohttp
from typing import Optional, Dict, Any

CHITTYID_SERVICE = 'https://id.chitty.cc'

class ChittyIDClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv('CHITTY_ID_TOKEN')
        if not self.token:
            raise ValueError('CHITTY_ID_TOKEN required')

    async def mint(self, domain: str, subtype: str, metadata: Dict[str, Any] = None) -> str:
        """Mint a new ChittyID"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{CHITTYID_SERVICE}/v1/mint",
                json={"domain": domain, "subtype": subtype, "metadata": metadata or {}},
                headers={"authorization": f"Bearer {self.token}"}
            ) as response:
                response.raise_for_status()
                data = await response.json()
                return data["chitty_id"]

    async def validate(self, chitty_id: str) -> bool:
        """Validate a ChittyID"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{CHITTYID_SERVICE}/v1/validate/{chitty_id}",
                headers={"authorization": f"Bearer {self.token}"}
            ) as response:
                return response.status == 200
EOF
        echo "    ✅ Created chittyid_client.py"
    fi

    # Add to .env.example if it doesn't exist
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'EOF'
# ChittyID Service Configuration (REQUIRED)
CHITTY_ID_TOKEN=your_chittyid_token_here

# ChittyOS Integration
CHITTYOS_ACCOUNT_ID=your_account_id_here
EOF
        echo "    ✅ Created .env.example with ChittyID config"
    elif ! grep -q "CHITTY_ID_TOKEN" .env.example 2>/dev/null; then
        echo "" >> .env.example
        echo "# ChittyID Service Configuration (REQUIRED)" >> .env.example
        echo "CHITTY_ID_TOKEN=your_chittyid_token_here" >> .env.example
        echo "    ✅ Added ChittyID config to .env.example"
    fi
}

_analyze_architecture() {
    echo "🏗️  ARCHITECTURAL ANALYSIS"
    echo "─────────────────────────"

    local has_issues=false

    # Detect project type and framework
    local project_type="unknown"
    local framework=""
    local architecture=""

    if [ -f "wrangler.toml" ] || [ -f "wrangler.optimized.toml" ]; then
        project_type="cloudflare-worker"
        architecture="serverless"
        echo "  Type: Cloudflare Worker (Serverless)"
    elif [ -f "package.json" ]; then
        if grep -q '"next"' package.json 2>/dev/null; then
            project_type="nextjs"
            framework="Next.js"
            architecture="full-stack"
            echo "  Type: Next.js Application"
        elif grep -q '"react"' package.json 2>/dev/null; then
            project_type="react"
            framework="React"
            architecture="frontend"
            echo "  Type: React Application"
        elif grep -q '"express"' package.json 2>/dev/null; then
            project_type="express"
            framework="Express"
            architecture="backend"
            echo "  Type: Express Server"
        else
            project_type="node"
            architecture="generic"
            echo "  Type: Node.js Project"
        fi
    fi

    # Check for architectural patterns
    if [ -d "src/services" ] || [ -d "services" ]; then
        echo "  Pattern: Service-Oriented Architecture"
    elif [ -d "src/components" ] && [ -d "src/pages" ]; then
        echo "  Pattern: Component-Based Architecture"
    elif [ -d "src/models" ] && [ -d "src/controllers" ]; then
        echo "  Pattern: MVC Architecture"
    fi

    # Check for ChittyOS integration
    if [ -f "CLAUDE.md" ] || grep -q "chitty" package.json 2>/dev/null; then
        echo "  ✅ ChittyOS Integrated"
    else
        echo "  ⚠️  No ChittyOS Integration detected"
        has_issues=true
    fi

    # Database detection
    if grep -q "postgresql\|postgres" package.json .env 2>/dev/null; then
        echo "  Database: PostgreSQL"
    elif grep -q "mongodb\|mongoose" package.json 2>/dev/null; then
        echo "  Database: MongoDB"
    elif grep -q "sqlite" package.json 2>/dev/null; then
        echo "  Database: SQLite"
    fi

    echo ""
}

_detect_conflicts() {
    echo "🔍 CONFLICT DETECTION"
    echo "────────────────────"

    local conflicts=()
    local has_conflicts=false

    # Check for conflicting dependencies
    if [ -f "package.json" ]; then
        # Check for multiple UI frameworks
        local ui_frameworks=0
        grep -q '"react"' package.json 2>/dev/null && ((ui_frameworks++))
        grep -q '"vue"' package.json 2>/dev/null && ((ui_frameworks++))
        grep -q '"angular"' package.json 2>/dev/null && ((ui_frameworks++))
        grep -q '"svelte"' package.json 2>/dev/null && ((ui_frameworks++))

        if [ $ui_frameworks -gt 1 ]; then
            conflicts+=("Multiple UI frameworks detected")
            echo "  ⚠️  Multiple UI frameworks in package.json"
            has_conflicts=true
        fi

        # Check for conflicting test frameworks
        local test_frameworks=0
        grep -q '"jest"' package.json 2>/dev/null && ((test_frameworks++))
        grep -q '"mocha"' package.json 2>/dev/null && ((test_frameworks++))
        grep -q '"vitest"' package.json 2>/dev/null && ((test_frameworks++))

        if [ $test_frameworks -gt 1 ]; then
            conflicts+=("Multiple test frameworks detected")
            echo "  ⚠️  Multiple test frameworks in package.json"
            has_conflicts=true
        fi
    fi

    # Check for configuration conflicts
    local configs=0
    [ -f "webpack.config.js" ] && ((configs++))
    [ -f "vite.config.js" ] || [ -f "vite.config.ts" ] && ((configs++))
    [ -f "rollup.config.js" ] && ((configs++))
    [ -f "esbuild.config.js" ] && ((configs++))

    if [ $configs -gt 1 ]; then
        conflicts+=("Multiple bundler configurations detected")
        echo "  ⚠️  Multiple bundler configurations found"
        has_conflicts=true
    fi

    # Check for ChittyOS alignment issues
    if [ -f "wrangler.toml" ] && [ -f "wrangler.optimized.toml" ]; then
        echo "  ⚠️  Both wrangler.toml and wrangler.optimized.toml exist"
        echo "     Recommendation: Use wrangler.optimized.toml for production"
        has_conflicts=true
    fi

    if [ "$has_conflicts" = false ]; then
        echo "  ✅ No architectural conflicts detected"
    fi

    echo ""
}

_check_dependencies() {
    echo "📦 DEPENDENCY ANALYSIS"
    echo "─────────────────────"

    if [ ! -f "package.json" ]; then
        echo "  ℹ️  No package.json found"
        echo ""
        return
    fi

    # Check for outdated lock file
    if [ -f "package-lock.json" ] && [ -f "yarn.lock" ]; then
        echo "  ⚠️  Both npm and yarn lock files present"
        echo "     Recommendation: Choose one package manager"
    fi

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo "  ⚠️  Dependencies not installed"
        echo "     Action needed: npm install"
    else
        # Check if lock file is newer than node_modules
        if [ -f "package-lock.json" ]; then
            if [ "package-lock.json" -nt "node_modules" ]; then
                echo "  ⚠️  Lock file updated since last install"
                echo "     Action needed: npm install"
            else
                echo "  ✅ Dependencies up to date"
            fi
        fi
    fi

    # Check for security vulnerabilities
    if command -v npm >/dev/null 2>&1 && [ -d "node_modules" ]; then
        local audit_output=$(npm audit --json 2>/dev/null | grep -c '"severity"' || echo "0")
        if [ "$audit_output" -gt 0 ]; then
            echo "  ⚠️  Security vulnerabilities detected: $audit_output"
            echo "     Action needed: npm audit fix"
        fi
    fi

    # Cross-project dependency check
    echo ""
    echo "  Cross-Project Dependencies:"
    if grep -q "chittyid\|chittyos\|chittychat" package.json 2>/dev/null; then
        grep -E "chitty[a-z]+" package.json | head -3 | sed 's/^/    /'
    else
        echo "    None detected"
    fi

    echo ""
}

_analyze_patterns() {
    echo "🎯 PATTERN ANALYSIS"
    echo "──────────────────"

    # Check code organization
    local organization_score=0
    local max_score=5

    [ -d "src" ] && ((organization_score++))
    [ -d "tests" ] || [ -d "test" ] || [ -d "__tests__" ] && ((organization_score++))
    [ -f ".gitignore" ] && ((organization_score++))
    [ -f "README.md" ] || [ -f "readme.md" ] && ((organization_score++))
    [ -d ".git" ] && ((organization_score++))

    echo "  Code Organization: $organization_score/$max_score"

    # Check for ChittyOS patterns
    if [ -f "CLAUDE.md" ]; then
        echo "  ✅ CLAUDE.md instructions present"
    else
        echo "  ⚠️  No CLAUDE.md file (recommended for ChittyOS)"
    fi

    # Check for proper error handling patterns
    if [ -d "src" ]; then
        local has_error_handling=$(grep -r "try.*catch\|\.catch\|error" src 2>/dev/null | head -1)
        if [ -n "$has_error_handling" ]; then
            echo "  ✅ Error handling patterns detected"
        else
            echo "  ⚠️  No error handling patterns found"
        fi
    fi

    # Check for environment configuration
    if [ -f ".env.example" ] || [ -f ".env.template" ]; then
        echo "  ✅ Environment template present"
    elif [ -f ".env" ]; then
        echo "  ⚠️  .env exists but no template file"
    fi

    echo ""
}

_suggest_improvements() {
    echo "💡 IMPROVEMENT SUGGESTIONS"
    echo "────────────────────────"

    local suggestions=()

    # Basic improvements
    [ ! -f ".gitignore" ] && suggestions+=("Create .gitignore file")
    [ ! -d ".git" ] && suggestions+=("Initialize git repository")
    [ ! -f "README.md" ] && suggestions+=("Add README.md documentation")
    [ ! -f "CLAUDE.md" ] && suggestions+=("Add CLAUDE.md for ChittyOS integration")
    [ ! -d "tests" ] && [ ! -d "test" ] && suggestions+=("Set up test structure")

    # Advanced improvements
    if [ -f "package.json" ]; then
        ! grep -q '"test"' package.json && suggestions+=("Add test script to package.json")
        ! grep -q '"lint"' package.json && suggestions+=("Add linting script")
        ! grep -q '"build"' package.json && suggestions+=("Add build script")
    fi

    if [ ${#suggestions[@]} -gt 0 ]; then
        for suggestion in "${suggestions[@]}"; do
            echo "  • $suggestion"
        done
    else
        echo "  ✅ Project follows best practices"
    fi

    echo ""
}

_resolve_conflicts() {
    echo "🔧 CONFLICT RESOLUTION"
    echo "─────────────────────"

    local actions_taken=false

    # Auto-fix simple issues
    if [ ! -f ".gitignore" ]; then
        echo -n "  Create .gitignore? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.wrangler/
dist/
build/
*.log
.DS_Store
coverage/
.vscode/
.idea/
*.swp
*.swo
.cache/
EOF
            echo "  ✅ Created .gitignore"
            actions_taken=true
        fi
    fi

    # Handle wrangler config conflict
    if [ -f "wrangler.toml" ] && [ -f "wrangler.optimized.toml" ]; then
        echo -n "  Use optimized wrangler config as default? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            if [ -f "package.json" ] && ! grep -q "wrangler.optimized.toml" package.json; then
                # Update package.json to use optimized config
                node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('package.json'));
                pkg.scripts = pkg.scripts || {};
                if (pkg.scripts.dev && pkg.scripts.dev.includes('wrangler')) {
                    pkg.scripts.dev = 'wrangler dev --config wrangler.optimized.toml';
                }
                if (pkg.scripts.deploy && pkg.scripts.deploy.includes('wrangler')) {
                    pkg.scripts.deploy = 'wrangler deploy --config wrangler.optimized.toml';
                }
                fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                console.log('  ✅ Updated package.json to use optimized config');
                " 2>/dev/null && actions_taken=true
            fi
        fi
    fi

    # Create CLAUDE.md if missing
    if [ ! -f "CLAUDE.md" ]; then
        echo -n "  Create CLAUDE.md for ChittyOS integration? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cat > CLAUDE.md << EOF
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this project.

## Project Overview
$(basename "$PWD") - Part of the ChittyOS ecosystem

## Architecture
- Type: $([ -f "wrangler.toml" ] && echo "Cloudflare Worker" || echo "Node.js Application")
- Framework: $(grep -o '"react"\|"vue"\|"angular"\|"svelte"\|"express"' package.json 2>/dev/null | head -1 | tr -d '"' || echo "None detected")

## Development Commands
\`\`\`bash
npm install          # Install dependencies
npm run dev          # Start development server
npm test             # Run tests
npm run build        # Build for production
\`\`\`

## ChittyOS Integration
This project is part of the ChittyOS framework and follows its architectural patterns.

## Key Files
- Main entry: $([ -f "src/index.js" ] && echo "src/index.js" || [ -f "index.js" ] && echo "index.js" || echo "TBD")
- Configuration: $([ -f "wrangler.toml" ] && echo "wrangler.toml" || echo "package.json")

## Notes
[Add project-specific notes here]
EOF
            echo "  ✅ Created CLAUDE.md"
            actions_taken=true
        fi
    fi

    if [ "$actions_taken" = false ]; then
        echo "  No actions taken"
    fi

    echo ""
}

_apply_fixes() {
    echo "🚀 AUTOMATED FIXES"
    echo "────────────────"

    local fixes_applied=false

    # Install dependencies if needed
    if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
        echo -n "  Install dependencies? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "  Installing dependencies..."
            npm install
            fixes_applied=true
        fi
    fi

    # Add missing scripts
    if [ -f "package.json" ]; then
        local needs_scripts=false
        ! grep -q '"dev"' package.json 2>/dev/null && ! grep -q '"start"' package.json 2>/dev/null && needs_scripts=true

        if [ "$needs_scripts" = true ]; then
            echo -n "  Add development scripts? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                # Detect and add appropriate scripts
                if [ -f "wrangler.optimized.toml" ]; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'wrangler dev --config wrangler.optimized.toml';
                    pkg.scripts.deploy = pkg.scripts.deploy || 'wrangler deploy --config wrangler.optimized.toml';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                elif [ -f "wrangler.toml" ]; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'wrangler dev';
                    pkg.scripts.deploy = pkg.scripts.deploy || 'wrangler deploy';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                else
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = pkg.scripts.dev || 'node index.js';
                    pkg.scripts.test = pkg.scripts.test || 'echo \"No tests configured\"';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    " 2>/dev/null
                fi
                echo "  ✅ Added development scripts"
                fixes_applied=true
            fi
        fi
    fi

    # Initialize git if needed
    if [ ! -d ".git" ]; then
        echo -n "  Initialize git repository? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            git init
            echo "  ✅ Initialized git repository"
            fixes_applied=true
        fi
    fi

    if [ "$fixes_applied" = false ]; then
        echo "  No fixes needed"
    fi

    echo ""

    # Final prompt to start development
    if [ -f "package.json" ]; then
        if grep -q '"dev"' package.json 2>/dev/null; then
            echo -n "🎯 Start development server? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                npm run dev
            fi
        fi
    fi
}

# Export the function so it persists in the shell
export -f project
export -f _project_config
export -f _apply_project_config
export -f _analyze_architecture
export -f _detect_conflicts
export -f _check_dependencies
export -f _analyze_patterns
export -f _suggest_improvements
export -f _resolve_conflicts
export -f _apply_fixes