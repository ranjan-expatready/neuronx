#!/bin/bash

# GitHub Branch Protection Enforcement Script
# This script enforces governance by configuring branch protection rules
# for the main branch of the Sales OS repository.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Status check names that must pass before merging to main
REQUIRED_CHECKS=(
    "CI / Quality Gate"
    "CodeQL / Analyze"
    "Secret Scan / Secret Scan"
)

echo -e "${GREEN}🚀 GitHub Branch Protection Enforcement Script${NC}"
echo "=========================================="

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed. Please install it first:${NC}"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI. Please run:${NC}"
    echo "   gh auth login"
    exit 1
fi

# Get repository information
REPO_INFO=$(gh repo view --json owner,name 2>/dev/null || echo "{}")
REPO_OWNER=$(echo "$REPO_INFO" | grep -o '"login":"[^"]*"' | cut -d'"' -f4)
REPO_NAME=$(echo "$REPO_INFO" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$REPO_OWNER" || -z "$REPO_NAME" ]]; then
    echo -e "${RED}❌ Could not determine repository information. Are you in a git repository?${NC}"
    exit 1
fi

REPO_FULL="$REPO_OWNER/$REPO_NAME"

echo -e "${GREEN}✅ Repository detected: ${REPO_FULL}${NC}"

# Check if user has admin permissions
if ! gh repo view "$REPO_FULL" --json viewerPermission --jq '.viewerPermission' | grep -q "ADMIN\|MAINTAIN"; then
    echo -e "${RED}❌ You need admin or maintain permissions to configure branch protection.${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Configuring branch protection for 'main' branch...${NC}"

# Build the required status checks JSON array
CHECKS_JSON=""
for check in "${REQUIRED_CHECKS[@]}"; do
    if [[ -n "$CHECKS_JSON" ]]; then
        CHECKS_JSON+=","
    fi
    CHECKS_JSON+="\"$check\""
done

# Apply branch protection rules
gh api \
    --method PUT \
    "repos/$REPO_OWNER/$REPO_NAME/branches/main/protection" \
    --input - \
    --silent \
    << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [${CHECKS_JSON}]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "dismissal_restrictions": {}
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Branch protection rules successfully applied to 'main' branch${NC}"
    echo ""
    echo -e "${YELLOW}📋 Applied Rules:${NC}"
    echo "   • Require pull request before merge"
    echo "   • Require at least 1 approving review"
    echo "   • Dismiss stale approvals on new commits"
    echo "   • Require conversation resolution"
    echo "   • Enforce rules for admins"
    echo "   • Block force-pushes and branch deletions"
    echo "   • Require these status checks to pass:"
    for check in "${REQUIRED_CHECKS[@]}"; do
        echo "      - $check"
    done
    echo ""
    echo -e "${GREEN}🎉 Governance enforcement complete!${NC}"
else
    echo -e "${RED}❌ Failed to apply branch protection rules.${NC}"
    echo "   Please check your permissions and try again."
    exit 1
fi
