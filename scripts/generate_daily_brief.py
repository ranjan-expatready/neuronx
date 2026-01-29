#!/usr/bin/env python3
"""
Daily Brief + Approvals Queue Generator — Antigravity Board Member Loop

This script generates daily operational artifacts for the Founder to review:
- DAILY_BRIEF: Overview of system state, open PRs, blocked items
- APPROVALS_QUEUE: Items requiring explicit founder decisions

Dependencies: Python 3.6+, requests (installed in GitHub Actions)
"""

import os
import sys
import re
import json
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

# Configuration
REPO_ROOT = Path(os.getenv("GITHUB_WORKSPACE", Path(__file__).parent.parent))
REPO_OWNER = os.getenv("GITHUB_REPOSITORY_OWNER", "ranjan-expatready")
REPO_NAME = os.getenv("GITHUB_REPOSITORY_NAME", "autonomous-engineering-os")
GITHUB_API_URL = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Project configuration - will be queried from environment or hardcoded
# SDLC Project v2 ID and URL
SDLC_PROJECT_ID = os.getenv("GITHUB_PROJECT_ID", "")
SDLC_PROJECT_NUMBER = os.getenv("GITHUB_PROJECT_NUMBER", "2")

# Trae artifact directory
TRAE_ARTIFACT_DIR = REPO_ROOT / "COCKPIT" / "artifacts" / "TRAE_REVIEW"

# Output directories
ARTIFACTS_DIR = REPO_ROOT / "COCKPIT" / "artifacts"
DAILY_BRIEF_DIR = ARTIFACTS_DIR / "DAILY_BRIEF"
APPROVALS_QUEUE_DIR = ARTIFACTS_DIR / "APPROVALS_QUEUE"

# Protected paths and risk tiers
PROTECTED_PATHS = ["GOVERNANCE", "AGENTS", "COCKPIT", ".github/workflows", "STATE"]
RISK_TIERS = ["T1", "T2", "T3", "T4"]


def log(message: str, level: str = "INFO"):
    """Safe logging that only logs metadata."""
    print(f"[{level}] {message}")
    sys.stdout.flush()


def get_github_headers() -> Dict[str, str]:
    """Get GitHub API headers."""
    if not GITHUB_TOKEN:
        log("WARNING: GITHUB_TOKEN not set, using unauthenticated API (rate limited)")
        return {"Accept": "application/vnd.github+json"}
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"token {GITHUB_TOKEN}",
    }


def github_api_get(endpoint: str) -> Optional[Dict]:
    """Make a GET request to GitHub API."""
    url = f"{GITHUB_API_URL}{endpoint}"
    try:
        import requests
        response = requests.get(url, headers=get_github_headers(), timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        log(f"GitHub API error: {e}", "ERROR")
        return None


def get_pull_requests() -> List[Dict]:
    """Get open pull requests."""
    endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/pulls?state=open&sort=created&direction=desc&per_page=100"
    data = github_api_get(endpoint)
    return data if isinstance(data, list) else []


def get_open_issues() -> List[Dict]:
    """Get open issues."""
    endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/issues?state=open&sort=created&direction=desc&per_page=100"
    data = github_api_get(endpoint)
    return data if isinstance(data, list) else []


def get_pr_checks_status(pr_number: int) -> Tuple[bool, str]:
    """Get CI checks status for a PR."""
    # Get combined status
    endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/commits"
    data = github_api_get(endpoint)
    if not data:
        return False, "Unknown"

    # Find the PR HEAD commit
    pr_ref_endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/git/refs/pull/{pr_number}/head"
    pr_ref_data = github_api_get(pr_ref_endpoint)
    if not pr_ref_data:
        return False, "No ref"

    sha = pr_ref_data.get("object", {}).get("sha", "")
    if not sha:
        return False, "No SHA"

    # Get status for the commit
    status_endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/commits/{sha}/status"
    status_data = github_api_get(status_endpoint)
    if not status_data:
        return False, "Unknown"

    state = status_data.get("state", "unknown")
    total_count = status_data.get("total_count", 0)
    statuses = status_data.get("statuses", [])

    # Parse checks
    passed = sum(1 for s in statuses if s.get("state") == "success")
    failed = sum(1 for s in statuses if s.get("state") in ["failure", "error"])
    pending = sum(1 for s in statuses if s.get("state") in ["pending", "in_progress"])

    is_passing = state == "success" and failed == 0
    status_str = f"✅ PASS (total: {total_count}, passed: {passed}"
    if failed > 0:
        status_str += f", ❌ failed: {failed}"
    if pending > 0:
        status_str += f", ⏳ pending: {pending}"
    status_str += ")"

    return is_passing, status_str


def get_trae_artifact(pr_number: int) -> Optional[Dict]:
    """Get Trae review artifact for a PR."""
    if not TRAE_ARTIFACT_DIR.exists():
        return None

    # Look for artifact matching PR number
    artifact_files = list(TRAE_ARTIFACT_DIR.glob(f"TRAE-*-{pr_number}.yml"))

    if not artifact_files:
        return None

    artifact_path = artifact_files[-1]  # Get latest
    return parse_trae_artifact(artifact_path)


def parse_trae_artifact(artifact_path: Path) -> Optional[Dict]:
    """Parse Trae review artifact (simple YAML parser)."""
    try:
        with open(artifact_path) as f:
            content = f.read()

        # Extract key fields using regex
        pr_match = re.search(r'pr_number:\s*["\']?(\d+)["\']?', content)
        verdict_match = re.search(r'verdict:\s*["\']?([^"\'\s\n]+)["\']?', content)
        created_match = re.search(r'created_at:\s*["\']?([^"\']+)["\']?', content)

        return {
            "pr_number": int(pr_match.group(1)) if pr_match else None,
            "verdict": verdict_match.group(1) if verdict_match else None,
            "created_at": created_match.group(1) if created_match else None,
            "file_path": artifact_path,
        }
    except Exception as e:
        log(f"Error parsing Trae artifact {artifact_path}: {e}", "ERROR")
        return None


def is_artifact_stale(created_at_str: str) -> bool:
    """Check if artifact is stale (> 7 days old)."""
    try:
        created_at = datetime.strptime(created_at_str, "%Y-%m-%d %H:%M UTC")
        expiry_date = datetime.utcnow() - timedelta(days=7)
        return created_at < expiry_date
    except Exception:
        return False


def detect_risk_tier(pr: Dict, trae_artifact: Optional[Dict]) -> str:
    """Detect risk tier from PR."""
    # Check PR labels
    labels = [label.get("name", "").lower() for label in pr.get("labels", [])]
    if any(l in labels for l in ["tier-1", "critical", "t1"]):
        return "T1"
    if any(l in labels for l in ["tier-2", "high-risk", "t2"]):
        return "T2"
    if any(l in labels for l in ["tier-3", "t3"]):
        return "T3"
    if any(l in labels for l in ["tier-4", "t4"]):
        return "T4"

    # Check PR description
    desc_lower = pr.get("body", "").lower()
    if "tier 1" in desc_lower or "t1" in desc_lower or "critical" in desc_lower:
        return "T1"
    if "tier 2" in desc_lower or "t2" in desc_lower or "high risk" in desc_lower:
        return "T2"
    if "tier 3" in desc_lower or "t3" in desc_lower:
        return "T3"
    if "tier 4" in desc_lower or "t4" in desc_lower:
        return "T4"

    # Check Trae artifact verdict (T1-T4 if Trae reviewed)
    if trae_artifact and trae_artifact.get("verdict") in ["APPROVE", "EMERGENCY_OVERRIDE"]:
        return "T2"  # Assume T2 as fallback when unsure

    # Check files changed (protected paths = T1/T2)
    files_changed = get_pr_files(pr.get("number"))
    touches_protected = any(
        any(p in str(f) for p in PROTECTED_PATHS)
        for f in files_changed
    )
    if touches_protected:
        return "T1"

    return "T3"  # Default


def is_test_pr(pr: Dict) -> bool:
    """Check if PR is a governance test PR (should be excluded from active work counts).
    
    Test PRs have labels like:
    - governance-test
    - do-not-merge
    - test-only
    """
    labels = [label.get("name", "").lower() for label in pr.get("labels", [])]
    test_labels = ["governance-test", "do-not-merge", "test-only", "test-pr"]
    return any(l in labels for l in test_labels)


def get_pr_files(pr_number: int) -> List[str]:
    """Get list of files changed in a PR."""
    endpoint = f"/repos/{REPO_OWNER}/{REPO_NAME}/pulls/{pr_number}/files?per_page=100"
    data = github_api_get(endpoint)
    files = []
    if isinstance(data, list):
        files = [item.get("filename", "") for item in data]
    return files


def get_project_items() -> List[Dict]:
    """Get items from GitHub Project v2 using GraphQL."""
    if not GITHUB_TOKEN:
        log("WARNING: No GITHUB_TOKEN, skipping project items query", "WARN")
        return []

    # GraphQL query for project items
    query = """
    query($owner: String!, $repo: String!, $projectNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 10) {
          nodes {
            number
            title
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    title
                    state
                    url
                  }
                }
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """

    variables = {
        "owner": REPO_OWNER,
        "repo": REPO_NAME,
        "projectNumber": int(SDLC_PROJECT_NUMBER),
    }

    try:
        import requests
        response = requests.post(
            f"{GITHUB_API_URL}/graphql",
            headers=get_github_headers(),
            json={"query": query, "variables": variables},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        # Extract items from project
        items = []
        projects = data.get("data", {}).get("repository", {}).get("projectsV2", {}).get("nodes", [])
        for project in projects:
            if project.get("number") == int(SDLC_PROJECT_NUMBER):
                item_nodes = project.get("items", {}).get("nodes", [])
                for item_node in item_nodes:
                    content = item_node.get("content")
                    if content:
                        # Parse field values
                        status = None
                        field_values = item_node.get("fieldValues", {}).get("nodes", [])
                        for fv in field_values:
                            field = fv.get("field", {})
                            if field and field.get("name") == "Status":
                                status = fv.get("name")
                                break

                        items.append({
                            "number": content.get("number"),
                            "title": content.get("title"),
                            "state": content.get("state"),
                            "url": content.get("url"),
                            "status": status,
                        })
                break

        return items

    except Exception as e:
        log(f"Error fetching project items: {e}", "ERROR")
        return []


def get_project_items() -> List[Dict]:
    """Get items from GitHub Project v2 using GraphQL."""
    if not GITHUB_TOKEN:
        log("WARNING: No GITHUB_TOKEN, skipping project items query", "WARN")
        return []

    # GraphQL query for project items
    query = """
    query($owner: String!, $repo: String!, $projectNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 10) {
          nodes {
            number
            title
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    title
                    state
                    url
                  }
                }
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field {
                        ... on ProjectV2FieldCommon {
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """

    variables = {
        "owner": REPO_OWNER,
        "repo": REPO_NAME,
        "projectNumber": int(SDLC_PROJECT_NUMBER),
    }

    try:
        import requests
        response = requests.post(
            f"{GITHUB_API_URL}/graphql",
            headers=get_github_headers(),
            json={"query": query, "variables": variables},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        # Extract items from project
        items = []
        projects = data.get("data", {}).get("repository", {}).get("projectsV2", {}).get("nodes", [])
        for project in projects:
            if project.get("number") == int(SDLC_PROJECT_NUMBER):
                item_nodes = project.get("items", {}).get("nodes", [])
                for item_node in item_nodes:
                    content = item_node.get("content")
                    if content:
                        # Parse field values
                        status = None
                        field_values = item_node.get("fieldValues", {}).get("nodes", [])
                        for fv in field_values:
                            field = fv.get("field", {})
                            if field and field.get("name") == "Status":
                                status = fv.get("name")
                                break

                        items.append({
                            "number": content.get("number"),
                            "title": content.get("title"),
                            "state": content.get("state"),
                            "url": content.get("url"),
                            "status": status,
                        })
                break

        return items

    except Exception as e:
        log(f"Error fetching project items: {e}", "ERROR")
        return []


def get_governance_failures(prs: List[Dict]) -> List[Dict]:
    """Get list of governance failures across PRs.
    
    Parses governance_validator_results.json if available.
    Returns list of failure dictionaries with type and details.
    """
    failures = []
    
    # Try to read governance validator results
    validator_results_path = REPO_ROOT / ".governance_validator_results.json"
    
    if validator_results_path.exists():
        try:
            with open(validator_results_path) as f:
                results = json.load(f)
                results_list = results.get("results", [])
                
                # Parse PLAN structure failures
                for result in results_list:
                    if not result.get("passed"):
                        failure_type = result.get("name", "UNKNOWN")
                        message = result.get("message", "")
                        
                        if "PLAN Structure" in failure_type:
                            # Extract missing fields from message
                            missing_fields = []
                            if "Missing required PLAN fields" in message:
                                fields_str = message.split("Missing required PLAN fields:")[-1].strip()
                                missing_fields = [f.strip() for f in fields_str.split(",") if f.strip()]
                            
                            failures.append({
                                "type": "PLAN_STRUCTURE",
                                "pr_number": "N/A",  # Would need PR context
                                "pr_title": "Governance Check Failures",
                                "pr_link": "",
                                "missing_fields": missing_fields,
                                "risk_tier": "T1",
                            })
                        elif "Trae Review" in failure_type:
                            failures.append({
                                "type": "TRAE_REVIEW",
                                "pr_number": "N/A",
                                "pr_title": "Trae Review Required",
                                "pr_link": "",
                                "status": message if message else "Missing",
                                "reason": "Trae review artifact not found",
                                "action": "Get Trae review",
                            })
                        elif "CI" in failure_type or "Secret" in failure_type:
                            failures.append({
                                "type": "CI_FAILURE",
                                "pr_number": "N/A",
                                "pr_title": "CI Failure",
                                "pr_link": "",
                                "status": message if message else "Failed",
                            })
        except Exception as e:
            log(f"Error reading validator results: {e}", "ERROR")
    
    # Also check PRs directly for missing Trae reviews on T1/T2
    for pr in prs:
        pr_number = pr.get("number")
        trae_artifact = get_trae_artifact(pr_number)
        risk_tier = detect_risk_tier(pr, trae_artifact)
        
        if risk_tier in ["T1", "T2"]:
            if not trae_artifact:
                failures.append({
                    "type": "TRAE_REVIEW",
                    "pr_number": pr_number,
                    "pr_title": pr.get("title", "Unknown"),
                    "pr_link": pr.get("html_url", ""),
                    "status": "MISSING",
                    "reason": "No Trae review artifact found",
                    "action": "Get Trae review",
                    "risk_tier": risk_tier,
                })
            elif trae_artifact.get("verdict") not in ["APPROVE", "EMERGENCY_OVERRIDE"]:
                verdict = trae_artifact.get("verdict", "UNKNOWN")
                failures.append({
                    "type": "TRAE_REVIEW",
                    "pr_number": pr_number,
                    "pr_title": pr.get("title", "Unknown"),
                    "pr_link": pr.get("html_url", ""),
                    "status": verdict,
                    "reason": f"Trae verdict is {verdict}",
                    "action": "Address Trae's findings" if verdict == "REQUEST_CHANGES" else "Get fresh Trae review",
                    "risk_tier": risk_tier,
                })
            else:
                # Check if stale
                created_at = trae_artifact.get("created_at", "")
                if created_at and is_artifact_stale(created_at):
                    failures.append({
                        "type": "TRAE_REVIEW",
                        "pr_number": pr_number,
                        "pr_title": pr.get("title", "Unknown"),
                        "pr_link": pr.get("html_url", ""),
                        "status": "STALE",
                        "reason": f"Trae review is stale (created: {created_at})",
                        "action": "Get fresh Trae review",
                        "risk_tier": risk_tier,
                    })
    
    # Check CI status for failures
    for pr in prs:
        pr_number = pr.get("number")
        ci_passing, ci_status = get_pr_checks_status(pr_number)
        
        if not ci_passing:
            failures.append({
                "type": "CI_FAILURE",
                "pr_number": pr_number,
                "pr_title": pr.get("title", "Unknown"),
                "pr_link": pr.get("html_url", ""),
                "status": ci_status,
            })
    
    return failures


def get_best_practice_flags(prs: List[Dict]) -> List[Dict]:
    """Get best practice advisory flags from Trae review artifacts.
    
    Parses BEST_PRACTICE_ALIGNMENT fields from Trae review artifacts.
    Returns list of flags with recommendations (non-blocking).
    """
    flags = []
    
    for pr in prs:
        pr_number = pr.get("number")
        trae_artifact = get_trae_artifact(pr_number)
        
        if not trae_artifact:
            continue
        
        # Parse the full artifact content for BEST_PRACTICE_ALIGNMENT
        artifact_path = trae_artifact.get("file_path")
        if not artifact_path or not artifact_path.exists():
            continue
        
        try:
            with open(artifact_path) as f:
                content = f.read()
            
            # Check for BEST_PRACTICE_ALIGNMENT section
            if "BEST_PRACTICE_ALIGNMENT" not in content:
                continue
            
            # Extract values
            plan_quality = None
            change_size = None
            ownership_clear = None
            
            plan_quality_match = re.search(r'PLAN_QUALITY:\s*(PASS|CONCERN)', content, re.IGNORECASE)
            change_size_match = re.search(r'CHANGE_SIZE:\s*(OK|TOO_LARGE)', content, re.IGNORECASE)
            ownership_clear_match = re.search(r'OWNERSHIP_CLEAR:\s*(YES|NO)', content, re.IGNORECASE)
            
            if plan_quality_match:
                plan_quality = plan_quality_match.group(1)
            if change_size_match:
                change_size = change_size_match.group(1)
            if ownership_clear_match:
                ownership_clear = ownership_clear_match.group(1)
            
            # Generate recommendations based on flags
            recommendations = []
            if plan_quality == "CONCERN":
                recommendations.append("Consider improving PLAN completeness")
            if change_size == "TOO_LARGE":
                recommendations.append("Consider splitting into smaller PRs")
            if ownership_clear == "NO":
                recommendations.append("Clarify ownership before merge")
            
            # Only add if there are any flags
            if plan_quality or change_size or ownership_clear:
                flags.append({
                    "pr_number": pr_number,
                    "pr_title": pr.get("title", "Unknown"),
                    "pr_link": pr.get("html_url", ""),
                    "plan_quality": plan_quality,
                    "change_size": change_size,
                    "ownership_clear": ownership_clear,
                    "recommendation": "; ".join(recommendations) if recommendations else None,
                })
        
        except Exception as e:
            log(f"Error parsing best practice alignment for PR #{pr_number}: {e}", "ERROR")
    
    return flags


def generate_daily_brief(prs: List[Dict], issues: List[Dict], project_items: List[Dict], date_str: str) -> str:
    """Generate daily brief markdown."""
    # Filter out test PRs from active work counts (they have governance-test/do-not-merge labels)
    active_prs = [pr for pr in prs if not is_test_pr(pr)]
    test_pr_count = len(prs) - len(active_prs)
    
    brief = []
    brief.append(f"# Daily Brief — {date_str}")
    brief.append("")
    brief.append("**Generated**: " + datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    brief.append("**System**: Autonomous Engineering OS")
    brief.append("")

    brief.append("## Executive Summary")
    brief.append("")
    if test_pr_count > 0:
        brief.append(f"- **Open PRs**: {len(active_prs)} (excluding {test_pr_count} test PRs)")
    else:
        brief.append(f"- **Open PRs**: {len(active_prs)}")
    brief.append(f"- **Open Issues**: {len(issues)}")
    brief.append(f"- **Project Items**: {len(project_items)}")
    brief.append("")

    # Count by status
    waiting_for_approval = [i for i in project_items if i.get("status") == "Waiting for Approval"]
    blocked_items = [i for i in project_items if i.get("status") == "Blocked"]
    in_review = [i for i in project_items if i.get("status") == "In Review (PR Open)"]

    brief.append(f"- **Waiting for Approval**: {len(waiting_for_approval)}")
    brief.append(f"- **Blocked Items**: {len(blocked_items)}")
    brief.append(f"- **In Review**: {len(in_review)}")
    brief.append("")

    brief.append("---")
    brief.append("")

    # Governance failures section
    brief.append("## Governance Failures Summary")
    brief.append("")
    governance_failures = get_governance_failures(prs)
    
    if governance_failures:
        # PLAN structure failures
        plan_failures = [f for f in governance_failures if f.get("type") == "PLAN_STRUCTURE"]
        if plan_failures:
            brief.append("### PLAN Structure Violations")
            brief.append("")
            for failure in plan_failures:
                brief.append(f"**PR #{failure['pr_number']}**: {failure['pr_title']}")
                brief.append(f"- **Link**: {failure['pr_link']}")
                brief.append(f"- **Missing Fields**: {', '.join(failure['missing_fields'])}")
                brief.append(f"- **Risk Tier**: {failure.get('risk_tier', 'Unknown')}")
                brief.append(f"- **Action**: Add required PLAN fields before merge")
                brief.append("")
        
        # Trae review failures
        trae_failures = [f for f in governance_failures if f.get("type") == "TRAE_REVIEW"]
        if trae_failures:
            brief.append("### Trae Review Failures")
            brief.append("")
            for failure in trae_failures:
                brief.append(f"**PR #{failure['pr_number']}**: {failure['pr_title']}")
                brief.append(f"- **Link**: {failure['pr_link']}")
                brief.append(f"- **Status**: {failure.get('status', 'Missing')}")
                if failure.get('reason'):
                    brief.append(f"- **Reason**: {failure['reason']}")
                brief.append(f"- **Action**: {failure.get('action', 'Get Trae review')}")
                brief.append("")
        
        # CI failures affecting governance
        ci_failures = [f for f in governance_failures if f.get("type") == "CI_FAILURE"]
        if ci_failures:
            brief.append("### CI Failures (Governance Impact)")
            brief.append("")
            for failure in ci_failures:
                brief.append(f"**PR #{failure['pr_number']}**: {failure['pr_title']}")
                brief.append(f"- **Link**: {failure['pr_link']}")
                brief.append(f"- **Status**: {failure.get('status')}")
                brief.append("")
    else:
        brief.append("✅ No governance failures detected.")
    brief.append("")
    brief.append("---")
    brief.append("")

    brief.append("## Best Practices Advisory (Soft Risk)")
    brief.append("")
    best_practice_flags = get_best_practice_flags(prs)
    
    if best_practice_flags:
        for flag in best_practice_flags:
            brief.append(f"### PR #{flag['pr_number']}: {flag['pr_title']}")
            brief.append(f"- **Link**: {flag['pr_link']}")
            
            if flag.get('plan_quality'):
                brief.append(f"- **PLAN Quality**: {flag['plan_quality']}")
            if flag.get('change_size'):
                brief.append(f"- **Change Size**: {flag['change_size']}")
            if flag.get('ownership_clear'):
                brief.append(f"- **Ownership Clear**: {flag['ownership_clear']}")
            
            if flag.get('recommendation'):
                brief.append(f"- **Recommendation**: {flag['recommendation']}")
            brief.append("")
    else:
        brief.append("No best practice flags raised.")
    brief.append("")
    brief.append("---")
    brief.append("")

    # Trae Required Section
    brief.append("## Trae Required")
    brief.append("")
    trae_required = []

    for pr in prs:
        pr_number = pr.get("number")
        trae_artifact = get_trae_artifact(pr_number)
        risk_tier = detect_risk_tier(pr, trae_artifact)

        if risk_tier in ["T1", "T2"]:
            if not trae_artifact:
                trae_required.append({
                    "pr": pr,
                    "risk_tier": risk_tier,
                    "verdict": "MISSING",
                })
            else:
                verdict = trae_artifact.get("verdict", "UNKNOWN")
                created_at = trae_artifact.get("created_at", "")
                is_stale = is_artifact_stale(created_at) if created_at else False

                trae_required.append({
                    "pr": pr,
                    "risk_tier": risk_tier,
                    "verdict": verdict,
                    "created_at": created_at,
                    "is_stale": is_stale,
                    "artifact_path": trae_artifact.get("file_path"),
                })

    if trae_required:
        for item in trae_required:
            pr = item["pr"]
            verdict = item["verdict"]
            brief.append(f"### PR #{pr.get('number')}: {pr.get('title')}")
            brief.append(f"- **Risk Tier**: {item['risk_tier']}")
            brief.append(f"- **Link**: {pr.get('html_url')}")
            brief.append(f"- **Trae Verdict**: {verdict}")
            if item.get("created_at"):
                staleness = " (STALE - >7 days old)" if item.get("is_stale") else ""
                brief.append(f"- **Created**: {item['created_at']}{staleness}")
            if item.get("artifact_path"):
                brief.append(f"- **Artifact**: `{item['artifact_path']}`")
            if verdict == "MISSING":
                brief.append("- **Action Required**: Trae review needed before merge")
            elif verdict == "REJECT" or verdict == "REQUEST_CHANGES":
                brief.append("- **Action Required**: Address Trae's findings")
            brief.append("")
    else:
        brief.append("No T1-T2 PRs requiring Trae review.")
    brief.append("")

    brief.append("---")
    brief.append("")

    # Open PRs Section
    brief.append("## Open Pull Requests")
    brief.append("")

    if prs:
        for pr in prs:
            pr_number = pr.get("number")
            ci_passing, ci_status = get_pr_checks_status(pr_number)
            trae_artifact = get_trae_artifact(pr_number)
            risk_tier = detect_risk_tier(pr, trae_artifact)

            brief.append(f"### PR #{pr_number}: {pr.get('title')}")
            brief.append(f"- **Link**: {pr.get('html_url')}")
            brief.append(f"- **Author**: {pr.get('user', {}).get('login', 'unknown')}")
            brief.append(f"- **Created**: {datetime.strptime(pr.get('created_at'), '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')}")
            brief.append(f"- **Risk Tier**: {risk_tier}")
            brief.append(f"- **CI Check**: {ci_status}")
            if ci_passing:
                brief.append("- **Status**: 🟢 Ready for review")
            else:
                brief.append("- **Status**: 🔴 CI failing - needs attention")

            labels = [label.get("name") for label in pr.get("labels", [])]
            if labels:
                brief.append(f"- **Labels**: {', '.join(labels)}")
            brief.append("")
    else:
        brief.append("No open pull requests.")
    brief.append("")

    brief.append("---")
    brief.append("")

    # Project Items Section
    brief.append("## GitHub Project Items (SDLC)")
    brief.append("")

    # Waiting for Approval
    if waiting_for_approval:
        brief.append("### Waiting for Approval")
        for item in waiting_for_approval:
            brief.append(f"- **Issue #{item.get('number')}**: {item.get('title')}")
            brief.append(f"  Link: {item.get('url')}")
        brief.append("")

    # Blocked Items
    if blocked_items:
        brief.append("### Blocked Items")
        for item in blocked_items:
            brief.append(f"- **Issue #{item.get('number')}**: {item.get('title')}")
            brief.append(f"  Link: {item.get('url')}")
        brief.append("")

    # In Review
    if in_review:
        brief.append("### In Review (PR Open)")
        for item in in_review:
            brief.append(f"- **Issue #{item.get('number')}**: {item.get('title')}")
            brief.append(f"  Link: {item.get('url')}")
        brief.append("")

    if not waiting_for_approval and not blocked_items and not in_review:
        brief.append("No items in Waiting for Approval, Blocked, or In Review status.")
    brief.append("")

    brief.append("---")
    brief.append("")

    # Open Issues Section
    brief.append("## Open Issues")
    brief.append("")

    if issues:
        for issue in issues[:10]:  # Limit to 10 most recent
            brief.append(f"### Issue #{issue.get('number')}: {issue.get('title')}")
            brief.append(f"- **Link**: {issue.get('html_url')}")
            brief.append(f"- **Author**: {issue.get('user', {}).get('login', 'unknown')}")
            brief.append(f"- **Created**: {datetime.strptime(issue.get('created_at'), '%Y-%m-%dT%H:%M:%SZ').strftime('%Y-%m-%d')}")

            labels = [label.get("name") for label in issue.get("labels", [])]
            if labels:
                brief.append(f"- **Labels**: {', '.join(labels)}")
            brief.append("")
    else:
        brief.append("No open issues.")
    brief.append("")

    brief.append("---")
    brief.append("")
    brief.append("*End of Daily Brief*")

    return "\n".join(brief)


def generate_approvals_queue(prs: List[Dict], project_items: List[Dict], date_str: str) -> str:
    """Generate approvals queue markdown."""
    queue = []
    queue.append(f"# Approvals Queue — {date_str}")
    queue.append("")
    queue.append("**Generated**: " + datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    queue.append("**System**: Autonomous Engineering OS")
    queue.append("")
    queue.append("> INSTRUCTIONS FOR FOUNDER (Board Member):")
    queue.append("> ")
    queue.append("> Review each decision item below. Respond with:")
    queue.append("> - **YES** to approve the item")
    queue.append("> - **NO** to reject or request defer")
    queue.append("> - **EMERGENCY_OVERRIDE** to bypass standard approval (document reason)")
    queue.append("")
    queue.append("---")
    queue.append("")

    # Section 1: Trae Review Required
    queue.append("## 1. Trae Review Required")
    queue.append("")
    queue.append("These T1-T2 PRs require Trae external review before merge:")
    queue.append("")

    has_trae_decisions = False
    for pr in prs:
        pr_number = pr.get("number")
        trae_artifact = get_trae_artifact(pr_number)
        risk_tier = detect_risk_tier(pr, trae_artifact)

        if risk_tier in ["T1", "T2"]:
            has_trae_decisions = True
            queue.append(f"### PR #{pr_number}: {pr.get('title')}")
            queue.append("")

            if not trae_artifact:
                queue.append("**Status**: 🔴 MISSING TRAE REVIEW")
                queue.append(f"- **Risk Tier**: {risk_tier}")
                queue.append(f"- **Link**: {pr.get('html_url')}")
                queue.append("")
                queue.append("**FOUNDER DECISION REQUIRED**:")
                queue.append("- [ ] **APPROVE** - Authorize Trae review for this PR (factory will invoke)")
                queue.append("- [ ] **DEFER** - Defer this PR until next cycle")
                queue.append("")
            else:
                verdict = trae_artifact.get("verdict", "UNKNOWN")
                created_at = trae_artifact.get("created_at", "")
                is_stale = is_artifact_stale(created_at) if created_at else False

                if verdict == "APPROVE" and not is_stale:
                    queue.append("**Status**: 🟢 TRAE APPROVED")
                    queue.append(f"- **Risk Tier**: {risk_tier}")
                    queue.append(f"- **Link**: {pr.get('html_url')}")
                    queue.append(f"- **Verdict**: {verdict}")
                    queue.append(f"- **Created**: {created_at}")
                    queue.append("")
                    queue.append("**FOUNDER DECISION REQUIRED**:")
                    queue.append("- [ ] **APPROVE MERGE** - Trae approved, authorize merge")
                    queue.append("- [ ] **DEFER** - Defer this PR until next cycle")
                elif verdict == "EMERGENCY_OVERRIDE":
                    queue.append("**Status**: ⚠️ EMERGENCY OVERRIDE INVOKED")
                    queue.append(f"- **Risk Tier**: {risk_tier}")
                    queue.append(f"- **Link**: {pr.get('html_url')}")
                    queue.append(f"- **Verdict**: {verdict}")
                    queue.append(f"- **Created**: {created_at}")
                    queue.append("")
                    queue.append("**FOUNDER DECISION REQUIRED**:")
                    queue.append("- [ ] **APPROVE MERGE** - Accept emergency override")
                    queue.append("- [ ] **REJECT** - Do not accept emergency override")
                    queue.append("")
                else:
                    queue.append(f"**Status**: 🔴 TRAE {verdict}")
                    queue.append(f"- **Risk Tier**: {risk_tier}")
                    queue.append(f"- **Link**: {pr.get('html_url')}")
                    queue.append(f"- **Verdict**: {verdict}")
                    if created_at:
                        staleness = " (STALE)" if is_stale else ""
                        queue.append(f"- **Created**: {created_at}{staleness}")
                    queue.append("")
                    queue.append("**FOUNDER DECISION REQUIRED**:")
                    queue.append("- [ ] **REQUEST RE-REVIEW** - Factory will re-invoke Trae")
                    queue.append("- [ ] **DEFER** - Defer this PR until next cycle")
                    queue.append("")
            queue.append("---")
            queue.append("")

    if not has_trae_decisions:
        queue.append("✅ No T1-T2 PRs requiring Trae review.")
    queue.append("")

    # Section 2: Waiting for Approval (Project Items)
    queue.append("## 2. Founder Decisions Needed (Waiting for Approval)")
    queue.append("")

    waiting_for_approval = [i for i in project_items if i.get("status") == "Waiting for Approval"]

    if waiting_for_approval:
        for item in waiting_for_approval:
            queue.append(f"### Issue #{item.get('number')}: {item.get('title')}")
            queue.append("")
            queue.append(f"- **Link**: {item.get('url')}")
            queue.append(f"- **State**: {item.get('state')}")
            queue.append("")
            queue.append("**FOUNDER DECISION REQUIRED**:")
            queue.append("- [ ] **APPROVE** - Authorize proceeding with this work")
            queue.append("- [ ] **DEFER** - Defer until next cycle")
            queue.append("- [ ] **EMERGENCY_OVERRIDE** - Force proceed (document reason)")
            queue.append("")
            queue.append("---")
            queue.append("")
    else:
        queue.append("✅ No items waiting for approval.")
    queue.append("")

    # Section 3: Blocked Items
    queue.append("## 3. Blocked Items (Needs Resolution)")
    queue.append("")

    blocked_items = [i for i in project_items if i.get("status") == "Blocked"]

    if blocked_items:
        for item in blocked_items:
            queue.append(f"### Issue #{item.get('number')}: {item.get('title')}")
            queue.append("")
            queue.append(f"- **Link**: {item.get('url')}")
            queue.append(f"- **State**: {item.get('state')}")
            queue.append("")
            queue.append("**FOUNDER DECISION REQUIRED**:")
            queue.append("- [ ] **UNBLOCK** - Approve unblocking this item")
            queue.append("- [ ] **DEFER** - Keep blocked for now")
            queue.append("")
            queue.append("---")
            queue.append("")
    else:
        queue.append("✅ No blocked items.")
    queue.append("")

    # Section 4: CI Failing PRs
    queue.append("## 4. CI Failing Pull Requests")
    queue.append("")

    has_failing_ci = False
    for pr in prs:
        pr_number = pr.get("number")
        ci_passing, _ = get_pr_checks_status(pr_number)

        if not ci_passing:
            has_failing_ci = True
            queue.append(f"### PR #{pr_number}: {pr.get('title')}")
            queue.append("")
            queue.append(f"- **Link**: {pr.get('html_url')}")
            queue.append(f"- **Author**: {pr.get('user', {}).get('login', 'unknown')}")
            queue.append("")
            queue.append("**FOUNDER DECISION REQUIRED**:")
            queue.append("- [ ] **APPROVE RETRY** - Retry CI after fix")
            queue.append("- [ ] **DEFER** - Let author fix first")
            queue.append("")
            queue.append("---")
            queue.append("")

    if not has_failing_ci:
        queue.append("✅ No CI failures.")
    queue.append("")

    # Summary
    queue.append("---")
    queue.append("")
    queue.append("## Summary")
    queue.append("")
    decision_count = (
        (1 if has_trae_decisions else 0) +
        len(waiting_for_approval) +
        len(blocked_items) +
        (1 if has_failing_ci else 0)
    )
    queue.append(f"Total Decisions Required: {decision_count}")
    if decision_count == 0:
        queue.append("")
        queue.append("✅ **No founder actions required today** - System operating autonomously.")
    queue.append("")
    queue.append("*End of Approvals Queue*")

    return "\n".join(queue)


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Daily Brief + Approvals Queue Generator")
    parser.add_argument("--test", action="store_true", help="Run in test mode (output to stdout)")
    args = parser.parse_args()

    log("🤖 Daily Brief + Approvals Queue Generator")
    log("=" * 60)

    # Get date string
    date_str = datetime.utcnow().strftime("%Y%m%d")

    # Fetch data
    log("Fetching data from GitHub...")
    prs = get_pull_requests()
    issues = get_open_issues()
    project_items = get_project_items()

    log(f"Found {len(prs)} open PRs, {len(issues)} open issues, {len(project_items)} project items")

    # Generate artifacts
    log("Generating artifacts...")

    brief_content = generate_daily_brief(prs, issues, project_items, date_str)
    approvals_content = generate_approvals_queue(prs, project_items, date_str)

    brief_filename = f"BRIEF-{date_str}.md"
    approvals_filename = f"APPROVALS-{date_str}.md"

    if args.test:
        # Test mode: output to stdout
        log("=" * 60)
        log(f"TEST MODE: {brief_filename}")
        log("=" * 60)
        print(brief_content)
        print("\n\n")
        log("=" * 60)
        log(f"TEST MODE: {approvals_filename}")
        log("=" * 60)
        print(approvals_content)
    else:
        # Production mode: write to files
        # Create directories if they don't exist
        DAILY_BRIEF_DIR.mkdir(parents=True, exist_ok=True)
        APPROVALS_QUEUE_DIR.mkdir(parents=True, exist_ok=True)

        brief_path = DAILY_BRIEF_DIR / brief_filename
        approvals_path = APPROVALS_QUEUE_DIR / approvals_filename

        brief_path.write_text(brief_content)
        approvals_path.write_text(approvals_content)

        log(f"✅ Brief written to: {brief_path.relative_to(REPO_ROOT)}")
        log(f"✅ Approvals queue written to: {approvals_path.relative_to(REPO_ROOT)}")

        # Set output for GitHub Actions
        print(f"brief_file={brief_path}")
        print(f"approvals_file={approvals_path}")

    log("=" * 60)
    log("Done!")


if __name__ == "__main__":
    main()
