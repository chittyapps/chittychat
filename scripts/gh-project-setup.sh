#!/bin/bash

# GitHub Project Setup Script
# Automates creation of labels, milestones, and issues from YAML config

set -e

CONFIG_FILE="$1"

if [ -z "$CONFIG_FILE" ]; then
    echo "Usage: gh-project-setup.sh <config.yaml>"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# Parse YAML using Python (more reliable than bash)
parse_yaml() {
    python3 << 'EOF'
import yaml
import sys
import json

with open(sys.argv[1], 'r') as f:
    config = yaml.safe_load(f)
    print(json.dumps(config))
EOF
}

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: gh CLI not installed${RESET}"
    echo "Install: brew install gh"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 not found${RESET}"
    exit 1
fi

if ! python3 -c "import yaml" 2>/dev/null; then
    echo -e "${YELLOW}PyYAML not found. Installing...${RESET}"
    pip3 install --user pyyaml 2>/dev/null || {
        echo -e "${RED}Failed to install PyYAML. Trying with --break-system-packages...${RESET}"
        pip3 install --break-system-packages pyyaml || {
            echo -e "${RED}Could not install PyYAML. Please install manually:${RESET}"
            echo "  pip3 install --user pyyaml"
            exit 1
        }
    }
fi

echo -e "${CYAN}${BOLD}GitHub Project Setup${RESET}"
echo "Config: $CONFIG_FILE"
echo ""

# Parse config
CONFIG_JSON=$(python3 -c "import yaml, json, sys; print(json.dumps(yaml.safe_load(open('$CONFIG_FILE'))))")

REPO=$(echo "$CONFIG_JSON" | python3 -c "import json, sys; print(json.load(sys.stdin)['project']['repo'])")
PROJECT_NAME=$(echo "$CONFIG_JSON" | python3 -c "import json, sys; print(json.load(sys.stdin)['project']['name'])")

echo -e "${BOLD}Project:${RESET} $PROJECT_NAME"
echo -e "${BOLD}Repository:${RESET} $REPO"
echo ""

# Step 1: Create Labels
echo -e "${CYAN}${BOLD}📍 Creating Labels${RESET}"
python3 - "$CONFIG_FILE" << 'END_LABELS'
import yaml
import json
import sys
import subprocess

with open(sys.argv[1], 'r') as f:
    config = yaml.safe_load(f)

repo = config['project']['repo']
labels = config.get('labels', [])

for label in labels:
    name = label['name']
    desc = label['description']
    color = label['color']

    cmd = f'gh label create "{name}" --description "{desc}" --color "{color}" --repo {repo}'

    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Created label: {name}")
        elif 'already exists' in result.stderr.lower():
            print(f"⏭️  Label exists: {name}")
        else:
            print(f"❌ Error: {result.stderr.strip()}")
    except Exception as e:
        print(f"❌ Error creating label {name}: {e}")
END_LABELS

echo ""

# Step 2: Create Milestones
echo -e "${CYAN}${BOLD}🎯 Creating Milestones${RESET}"
python3 - "$CONFIG_FILE" << 'END_MILES'
import yaml
import json
import sys
import subprocess
from datetime import datetime

with open(sys.argv[1], 'r') as f:
    config = yaml.safe_load(f)

repo = config['project']['repo']
milestones = config.get('milestones', [])

milestone_map = {}

for milestone in milestones:
    title = milestone['title']
    desc = milestone['description']
    due_date = milestone['due_date']
    state = milestone.get('state', 'open')

    # Format date for GitHub API
    due_iso = datetime.strptime(due_date, '%Y-%m-%d').isoformat() + 'Z'

    cmd = f'''gh api repos/{repo}/milestones -f title="{title}" -f state="{state}" -f description="{desc}" -f due_on="{due_iso}"'''

    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            response = json.loads(result.stdout)
            milestone_number = response['number']
            milestone_map[title] = milestone_number
            print(f"✅ Created milestone #{milestone_number}: {title}")
        else:
            # Try to get existing milestone number
            get_cmd = f'''gh api repos/{repo}/milestones --jq '.[] | select(.title=="{title}") | .number' '''
            get_result = subprocess.run(get_cmd, shell=True, capture_output=True, text=True)
            if get_result.stdout.strip():
                milestone_number = int(get_result.stdout.strip())
                milestone_map[title] = milestone_number
                print(f"⏭️  Milestone exists #{milestone_number}: {title}")
            else:
                print(f"❌ Error creating milestone {title}: {result.stderr.strip()}")
    except Exception as e:
        print(f"❌ Error: {e}")

# Save milestone map for issue creation
with open('/tmp/milestone_map.json', 'w') as f:
    json.dump(milestone_map, f)
END_MILES

echo ""

# Step 3: Create Issues
echo -e "${CYAN}${BOLD}📝 Creating Issues${RESET}"
python3 - "$CONFIG_FILE" << 'END_ISSUES'
import yaml
import json
import sys
import subprocess

with open(sys.argv[1], 'r') as f:
    config = yaml.safe_load(f)

# Load milestone map
try:
    with open('/tmp/milestone_map.json', 'r') as f:
        milestone_map = json.load(f)
except:
    milestone_map = {}

repo = config['project']['repo']
issues = config.get('issues', [])

for issue in issues:
    title = issue['title']
    body = issue['body'].replace('"', '\\"').replace('\n', '\\n')
    milestone_title = issue['milestone']
    labels = ','.join(issue['labels'])
    state = issue.get('state', 'open')

    # Create issue
    cmd = f'''gh issue create --repo {repo} --title "{title}" --body "{body}" --label "{labels}" --milestone "{milestone_title}"'''

    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            issue_url = result.stdout.strip()
            print(f"✅ Created: {title}")
            print(f"   {issue_url}")

            # Close if needed
            if state == 'closed':
                issue_number = issue_url.split('/')[-1]
                close_cmd = f"gh issue close {issue_number} --repo {repo}"
                subprocess.run(close_cmd, shell=True, capture_output=True)
                print(f"   ✅ Closed issue #{issue_number}")
        else:
            print(f"❌ Error creating issue: {title}")
            print(f"   {result.stderr.strip()}")
    except Exception as e:
        print(f"❌ Error: {e}")
END_ISSUES

echo ""
echo -e "${GREEN}${BOLD}✨ Project setup complete!${RESET}"
echo ""
echo "View your project:"
echo "  Issues: https://github.com/$REPO/issues?q=is%3Aissue"
echo "  Milestones: https://github.com/$REPO/milestones"
echo "  Labels: https://github.com/$REPO/labels"
