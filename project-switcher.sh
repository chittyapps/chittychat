#!/bin/bash

# ChittyOS Smart Project Switcher
# Actually useful version that does things

# Remove old alias if it exists
unalias project 2>/dev/null || true

project() {
    local PROJECTS_DIR="/Users/nb/.claude/projects/-"

    # If specific project name provided, go directly
    if [ -n "$1" ]; then
        local target_dir="$PROJECTS_DIR/$1"
        if [ -d "$target_dir" ]; then
            cd "$target_dir" || return
            _initialize_project
        else
            echo "❌ Project '$1' not found"
            return 1
        fi
        return
    fi

    # Interactive selection with fzf if available, otherwise basic select
    if command -v fzf >/dev/null 2>&1; then
        local selected=$(ls -d "$PROJECTS_DIR"/*/ 2>/dev/null | xargs -n1 basename | fzf --height=50% --header="Select project:")
        [ -z "$selected" ] && return
        cd "$PROJECTS_DIR/$selected" || return
    else
        echo "📁 Select a project:"
        select proj in $(ls -d "$PROJECTS_DIR"/*/ 2>/dev/null | xargs -n1 basename) "Cancel"; do
            case $proj in
                "Cancel") return ;;
                "") echo "Invalid selection" ;;
                *) cd "$PROJECTS_DIR/$proj" || return; break ;;
            esac
        done
    fi

    _initialize_project
}

_initialize_project() {
    echo "🚀 Initializing $(basename "$PWD")..."

    local fixes_applied=false

    # Auto-fix: Create .gitignore if missing
    if [ ! -f .gitignore ]; then
        echo "📝 Creating .gitignore..."
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
EOF
        fixes_applied=true
    fi

    # Auto-fix: Initialize git if needed
    if [ ! -d .git ]; then
        echo "🔧 Initializing git repository..."
        git init
        fixes_applied=true
    fi

    # Auto-fix: Install dependencies if package.json exists but no node_modules
    if [ -f package.json ] && [ ! -d node_modules ]; then
        echo "📦 Installing dependencies..."
        npm install
        fixes_applied=true
    fi

    # Auto-fix: Add dev script if missing
    if [ -f package.json ]; then
        if ! grep -q '"dev"' package.json && ! grep -q '"start"' package.json; then
            echo "🔧 Adding dev script to package.json..."

            # Detect project type and add appropriate script
            if [ -f wrangler.toml ] || [ -f wrangler.optimized.toml ]; then
                # Cloudflare Worker project
                if [ -f wrangler.optimized.toml ]; then
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = 'wrangler dev --config wrangler.optimized.toml';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    "
                else
                    node -e "
                    const fs = require('fs');
                    const pkg = JSON.parse(fs.readFileSync('package.json'));
                    pkg.scripts = pkg.scripts || {};
                    pkg.scripts.dev = 'wrangler dev';
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                    "
                fi
            elif [ -f vite.config.ts ] || [ -f vite.config.js ]; then
                # Vite project
                node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('package.json'));
                pkg.scripts = pkg.scripts || {};
                pkg.scripts.dev = 'vite';
                fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                "
            else
                # Generic Node project
                node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('package.json'));
                pkg.scripts = pkg.scripts || {};
                pkg.scripts.dev = 'node index.js';
                fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
                "
            fi
            fixes_applied=true
        fi
    fi

    # Create test directories if missing
    if [ -f package.json ] && [ ! -d tests ] && [ ! -d test ] && [ ! -d __tests__ ]; then
        echo "📁 Creating test structure..."
        mkdir -p tests/unit tests/integration
        fixes_applied=true
    fi

    # Show what was fixed
    if [ "$fixes_applied" = true ]; then
        echo "✅ Applied automatic fixes"
    fi

    # Show current status
    echo ""
    echo "📊 Project: $(basename "$PWD")"
    echo "📁 Path: $PWD"

    # Check git status
    if [ -d .git ]; then
        local changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        if [ "$changes" -gt 0 ]; then
            echo "⚠️  Git: $changes uncommitted changes"
        else
            echo "✅ Git: Clean"
        fi
    fi

    # Check for running services
    if lsof -i :8787 >/dev/null 2>&1; then
        echo "✅ Wrangler running on :8787"
    elif lsof -i :3000 >/dev/null 2>&1; then
        echo "✅ Dev server running on :3000"
    fi

    # Offer to start dev server
    if [ -f package.json ]; then
        echo ""
        if grep -q '"dev"' package.json; then
            echo "💡 Run 'npm run dev' to start development"
            echo -n "Start dev server now? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                npm run dev
            fi
        elif grep -q '"start"' package.json; then
            echo "💡 Run 'npm start' to start the project"
            echo -n "Start now? (y/N): "
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                npm start
            fi
        fi
    fi
}

# Run if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    project "$@"
fi