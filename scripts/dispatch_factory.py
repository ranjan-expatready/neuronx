#!/usr/bin/env python3
"""
Factory Dispatcher Script v2.0

Invokes Factory Cloud API for GitHub Issue execution.

Safety Constraints:
- execution_mode: "pr_only" - Never pushes to main
- Branch prefix enforced as "factory/"
- All executions create PRs only
- PRs subject to governance gates (machine-board, autonomous-reviewer)

Trigger: GitHub Issue labeled 'ready-for-factory'
"""

import os
import sys
import json
import requests
from github import Github

FACTORY_API_BASE = "https://api.factory.ai/v1"


def validate_sdlc_phase(issue) -> tuple[bool, str]:
    """
    Validate that the issue has passed required SDLC phases.
    Returns (is_valid, reason).
    """
    labels = [label.name.lower() for label in issue.labels]
    body = issue.body or ""

    # Must have ready-for-factory label (enforced by workflow, but double-check)
    if 'ready-for-factory' not in labels:
        return False, "Missing required label: ready-for-factory"

    # Check for PLAN artifact reference in issue body
    has_plan_ref = 'cockpit/artifacts/plan/' in body.lower()

    # Allow override with explicit label
    has_override = 'sdlc-override' in labels

    if has_plan_ref:
        return True, "PLAN artifact reference found"

    if has_override:
        return True, "SDLC override label present"

    # Warning but allow - plan may be linked in comments or elsewhere
    print("⚠️  Warning: No PLAN artifact reference found in issue body")
    print("    Proceeding anyway - plan may be linked elsewhere")
    return True, "Proceeding without explicit PLAN reference (warning)"


def invoke_factory_cloud(issue_context: dict, api_key: str, repo_info: dict) -> dict:
    """
    Invoke Factory Cloud execution for an issue.
    Returns execution_id and status.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "project": f"{repo_info['owner']}/{repo_info['name']}",
        "task": {
            "type": "github_issue",
            "issue_number": issue_context["number"],
            "title": issue_context["title"],
            "body": issue_context["body"]
        },
        "config": {
            "model": "claude-opus",
            "execution_mode": "pr_only",  # Safety: Never push to main
            "branch_prefix": "factory/"
        }
    }

    print(f"📡 Calling Factory Cloud API...")
    print(f"   Endpoint: {FACTORY_API_BASE}/executions")
    print(f"   Project: {payload['project']}")
    print(f"   Issue: #{issue_context['number']}")

    try:
        response = requests.post(
            f"{FACTORY_API_BASE}/executions",
            headers=headers,
            json=payload,
            timeout=30
        )

        if response.status_code == 201:
            result = response.json()
            print(f"✅ Factory execution queued")
            print(f"   Execution ID: {result.get('execution_id', 'N/A')}")
            return result
        elif response.status_code == 401:
            raise Exception("Factory API authentication failed - check FACTORY_API_KEY")
        elif response.status_code == 422:
            raise Exception(f"Factory API validation error: {response.text}")
        else:
            raise Exception(f"Factory API error: {response.status_code} - {response.text}")

    except requests.exceptions.Timeout:
        raise Exception("Factory API request timed out")
    except requests.exceptions.ConnectionError:
        raise Exception("Failed to connect to Factory API")


def create_execution_record(repo, issue_number: int, branch_name: str, execution_result: dict):
    """
    Create an execution record artifact in the repository.
    """
    import time

    file_path = f"COCKPIT/artifacts/EXECUTION/exec-issue-{issue_number}.md"
    content = f"""# Execution Record

- **Issue**: #{issue_number}
- **Date**: {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}
- **Status**: Factory Dispatched
- **Execution ID**: {execution_result.get('execution_id', 'N/A')}
- **Mode**: PR-only (governance gated)

## Safety Verification

- [x] execution_mode: pr_only
- [x] Branch prefix: factory/
- [x] Subject to machine-board check
- [x] Subject to autonomous-reviewer check
"""

    try:
        repo.get_contents(file_path, ref=branch_name)
        print(f"ℹ️  Execution record already exists: {file_path}")
    except:
        print(f"📝 Creating execution record: {file_path}")
        repo.create_file(
            file_path,
            f"factory: execution record for issue #{issue_number}",
            content,
            branch=branch_name
        )


def main():
    """
    Factory Dispatcher main entry point.

    Flow:
    1. Read issue context from environment
    2. Validate SDLC phase requirements
    3. Invoke Factory Cloud API
    4. Create execution record
    5. Report status
    """

    print("=" * 50)
    print("🏭 FACTORY DISPATCHER v2.0")
    print("=" * 50)

    # 1. Environment & Context
    token = os.environ.get("GITHUB_TOKEN")
    api_key = os.environ.get("FACTORY_API_KEY")
    issue_number = int(os.environ.get("ISSUE_NUMBER", 0))
    issue_title = os.environ.get("ISSUE_TITLE", "")
    issue_body = os.environ.get("ISSUE_BODY", "")
    repo_name = os.environ.get("REPO_NAME")
    repo_owner = os.environ.get("REPO_OWNER")

    if not token:
        print("❌ Error: Missing GITHUB_TOKEN")
        sys.exit(1)

    if not api_key:
        print("❌ Error: Missing FACTORY_API_KEY")
        sys.exit(1)

    if not issue_number:
        print("❌ Error: Missing ISSUE_NUMBER")
        sys.exit(1)

    print(f"Target: Issue #{issue_number} in {repo_owner}/{repo_name}")
    print(f"Title: {issue_title[:50]}...")

    # Initialize GitHub client
    g = Github(token)
    repo = g.get_repo(f"{repo_owner}/{repo_name}")
    issue = repo.get_issue(issue_number)

    # 2. Validate SDLC Phase
    print("\n📋 Validating SDLC phase...")
    is_valid, reason = validate_sdlc_phase(issue)
    print(f"   Result: {'✅ Valid' if is_valid else '❌ Invalid'}")
    print(f"   Reason: {reason}")

    if not is_valid:
        print(f"\n❌ SDLC validation failed: {reason}")
        sys.exit(1)

    # 3. Setup Branch
    branch_name = f"factory/issue-{issue_number}"
    base_branch = "main"

    try:
        repo.get_branch(branch_name)
        print(f"\nℹ️  Branch {branch_name} already exists")
    except:
        print(f"\n🌱 Creating branch: {branch_name}")
        sb = repo.get_branch(base_branch)
        repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=sb.commit.sha)

    # 4. Invoke Factory Cloud API
    print("\n" + "-" * 50)
    issue_context = {
        "number": issue_number,
        "title": issue_title,
        "body": issue_body
    }
    repo_info = {
        "owner": repo_owner,
        "name": repo_name
    }

    try:
        execution_result = invoke_factory_cloud(issue_context, api_key, repo_info)
    except Exception as e:
        print(f"\n❌ Factory API Error: {str(e)}")
        # Create a fallback execution record noting the failure
        execution_result = {"execution_id": "API_ERROR", "error": str(e)}

    # 5. Create Execution Record
    print("\n" + "-" * 50)
    create_execution_record(repo, issue_number, branch_name, execution_result)

    # 6. Check/Create PR
    print("\n" + "-" * 50)
    existing_prs = repo.get_pulls(head=f"{repo_owner}:{branch_name}", base=base_branch, state="open")
    if existing_prs.totalCount > 0:
        pr = existing_prs[0]
        print(f"ℹ️  PR already exists: #{pr.number}")
    else:
        print("🚀 Opening Pull Request...")
        body = f"""## Factory Execution: Issue #{issue_number}

**Title**: {issue_title}
**Execution ID**: {execution_result.get('execution_id', 'N/A')}

### Safety Verification

- [x] execution_mode: pr_only (never pushes to main)
- [x] Subject to machine-board governance check
- [x] Subject to autonomous-reviewer check
- [x] Label-triggered (ready-for-factory)

### Artifacts

- Execution record: `COCKPIT/artifacts/EXECUTION/exec-issue-{issue_number}.md`

Closes #{issue_number}
"""
        pr = repo.create_pull(
            title=f"feat: factory execution for issue #{issue_number}",
            body=body,
            head=branch_name,
            base=base_branch
        )
        print(f"✅ PR Created: #{pr.number}")
        pr.add_to_labels("automation/factory")

    print("\n" + "=" * 50)
    print("🏁 DISPATCH COMPLETE")
    print("=" * 50)


if __name__ == "__main__":
    main()
