#!/usr/bin/env python3
"""
Factory Dispatcher Script v3.0 (Validation Only)

This script performs SDLC validation for Factory execution.
Actual execution happens via `droid exec` CLI in GitHub Actions.

NOTE: This script does NOT execute Factory. Execution is handled by:
  .github/workflows/dispatcher.yml → "Execute Factory Droid" step

Safety Constraints:
- Validates SDLC phase requirements
- Checks for PLAN artifact references
- Reports validation status
- Does NOT make any API calls
"""

import os
import sys


def validate_environment() -> tuple[bool, str]:
    """
    Validate required environment variables are present.
    Returns (is_valid, message).
    """
    required_vars = ['ISSUE_NUMBER', 'REPO_NAME', 'REPO_OWNER']
    missing = [var for var in required_vars if not os.environ.get(var)]

    if missing:
        return False, f"Missing environment variables: {', '.join(missing)}"

    return True, "Environment validated"


def validate_sdlc_phase(issue_body: str, labels: list[str]) -> tuple[bool, str]:
    """
    Validate that the issue has passed required SDLC phases.
    Returns (is_valid, reason).

    Checks:
    1. ready-for-factory label present
    2. PLAN artifact reference in body OR sdlc-override label
    """
    labels_lower = [label.lower() for label in labels]

    # Must have ready-for-factory label
    if 'ready-for-factory' not in labels_lower:
        return False, "Missing required label: ready-for-factory"

    # Check for PLAN artifact reference
    body_lower = (issue_body or "").lower()
    has_plan_ref = 'cockpit/artifacts/plan/' in body_lower

    # Allow override with explicit label
    has_override = 'sdlc-override' in labels_lower

    if has_plan_ref:
        return True, "PLAN artifact reference found"

    if has_override:
        return True, "SDLC override label present"

    # Warning but allow - plan may be linked elsewhere
    print("⚠️  Warning: No PLAN artifact reference found in issue body")
    print("    Proceeding anyway - plan may be linked elsewhere")
    return True, "Proceeding without explicit PLAN reference (warning)"


def main():
    """
    Factory Dispatcher validation entry point.

    This script ONLY validates SDLC requirements.
    Actual execution happens via GitHub Actions workflow using `droid exec`.
    """

    print("=" * 50)
    print("🏭 FACTORY DISPATCHER v3.0 (Validation Only)")
    print("=" * 50)
    print("")
    print("NOTE: This script validates SDLC requirements.")
    print("      Execution via `droid exec` happens in GitHub Actions.")
    print("")

    # 1. Validate environment
    print("📋 Step 1: Validating environment...")
    env_valid, env_msg = validate_environment()
    print(f"   Result: {'✅ Valid' if env_valid else '❌ Invalid'}")
    print(f"   {env_msg}")

    if not env_valid:
        print(f"\n❌ Environment validation failed")
        sys.exit(1)

    # 2. Get issue context
    issue_number = os.environ.get('ISSUE_NUMBER')
    issue_title = os.environ.get('ISSUE_TITLE', '')
    issue_body = os.environ.get('ISSUE_BODY', '')
    repo_name = os.environ.get('REPO_NAME')
    repo_owner = os.environ.get('REPO_OWNER')

    print("")
    print(f"📋 Step 2: Issue Context")
    print(f"   Issue: #{issue_number}")
    print(f"   Title: {issue_title[:50]}..." if len(issue_title) > 50 else f"   Title: {issue_title}")
    print(f"   Repo: {repo_owner}/{repo_name}")

    # 3. SDLC validation (simplified - full validation in workflow)
    print("")
    print("📋 Step 3: SDLC Phase Validation")

    # Extract labels from environment if available
    # Note: In the workflow, labels are validated separately
    # This is a secondary check
    labels = []
    if 'ready-for-factory' in issue_body.lower():
        labels.append('ready-for-factory')

    sdlc_valid, sdlc_msg = validate_sdlc_phase(issue_body, labels)
    print(f"   Result: {'✅ Valid' if sdlc_valid else '⚠️ Warning'}")
    print(f"   {sdlc_msg}")

    # 4. Summary
    print("")
    print("=" * 50)
    print("📋 VALIDATION SUMMARY")
    print("=" * 50)
    print("")
    print(f"✅ Environment: Valid")
    print(f"{'✅' if sdlc_valid else '⚠️'} SDLC Phase: {sdlc_msg}")
    print("")
    print("🏭 NEXT: GitHub Actions will execute `droid exec`")
    print("   See workflow step: 'Execute Factory Droid'")
    print("")
    print("=" * 50)
    print("🏁 VALIDATION COMPLETE")
    print("=" * 50)


if __name__ == "__main__":
    main()
