#!/usr/bin/env python3
"""
Governance Validator for Machine Board of Directors.

This script validates PRs against the governance rules defined in:
- GOVERNANCE/GUARDRAILS.md
- GOVERNANCE/RISK_TIERS.md
- FOUNDATION/07_FACTORY.md

Validation Checks:
1. STATE file updates for non-BACKLOG PRs
2. Protected path artifacts (PLAN, VERIFICATION sections)
3. Risk tier requirements (rollback for T1/T2)
4. Secret detection
5. Trae review artifact presence for T1-T4 PRs
6. No-doc-spam enforcement (single collaboration surface)

Usage:
    python scripts/governance_validator.py

Environment Variables:
    GITHUB_WORKSPACE: Repository root path
    CHANGED_FILES: Newline-separated list of changed files
    PR_DESCRIPTION: Full PR body text
    PR_NUMBER: PR number for Trae artifact lookup
"""

import os
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False


class GovernanceValidator:
    """Validates PRs against governance rules."""

    PROTECTED_PATHS = [
        "GOVERNANCE/",
        "AGENTS/",
        "COCKPIT/",
        ".github/workflows/",
        "STATE/",
    ]

    SECRET_PATTERNS = [
        r"password\s*[=:]\s*['\"][^'\"]{8,}['\"]",
        r"api[_-]?key\s*[=:]\s*['\"][^'\"]{16,}['\"]",
        r"secret\s*[=:]\s*['\"][^'\"]{8,}['\"]",
        r"-----BEGIN.*PRIVATE KEY-----",
        r"AKIA[0-9A-Z]{16}",  # AWS Access Key
        r"ghp_[A-Za-z0-9]{36}",  # GitHub Personal Access Token
        r"sk-[A-Za-z0-9]{48}",  # OpenAI API Key
    ]

    ALLOWED_COCKPIT_PATHS = [
        "COCKPIT/artifacts/",
        "COCKPIT/WORKSPACE/TEAM_LOG.md",
        "COCKPIT/ARTIFACT_TYPES.md",
        "COCKPIT/APPROVAL_GATES.md",
        "COCKPIT/SKILLS_POLICY.md",
        "COCKPIT/ANTIGRAVITY_COCKPIT_SPEC.md",
        "COCKPIT/FOUNDER_DAILY_FLOW.md",
    ]

    def __init__(
        self,
        repo_root: str,
        changed_files: List[str],
        pr_description: str = "",
    ):
        self.repo_root = Path(repo_root)
        self.changed_files = [f for f in changed_files if f.strip()]
        self.pr_description = pr_description
        self.results: List[Dict] = []

    def add_result(
        self, check_name: str, passed: bool, message: str = "", severity: str = "error"
    ):
        """Record a validation check result."""
        self.results.append({
            "check": check_name,
            "passed": passed,
            "message": message,
            "severity": severity,  # error, warning, info
        })

    def is_backlog_only(self) -> bool:
        """Check if PR only touches BACKLOG/ files."""
        if not self.changed_files:
            return False
        return all(f.startswith("BACKLOG/") for f in self.changed_files)

    def is_artifact_only(self) -> bool:
        """Check if PR only touches COCKPIT/artifacts/ files."""
        if not self.changed_files:
            return False
        return all(f.startswith("COCKPIT/artifacts/") for f in self.changed_files)

    def touches_protected_path(self) -> bool:
        """Check if any changed file is in protected paths."""
        for f in self.changed_files:
            for protected in self.PROTECTED_PATHS:
                if f.startswith(protected):
                    return True
        return False

    def get_protected_paths_touched(self) -> List[str]:
        """Get list of protected paths touched by this PR."""
        touched = []
        for f in self.changed_files:
            for protected in self.PROTECTED_PATHS:
                if f.startswith(protected) and protected not in touched:
                    touched.append(protected)
        return touched

    def get_risk_tier(self) -> str:
        """Detect risk tier from PR description or changed paths."""
        # Check explicit tier in PR description
        tier_patterns = {
            "T1": r"(?:risk[\s-]?tier|tier)[\s:]*(?:1|T1|critical)",
            "T2": r"(?:risk[\s-]?tier|tier)[\s:]*(?:2|T2|high)",
            "T3": r"(?:risk[\s-]?tier|tier)[\s:]*(?:3|T3|low)",
            "T0": r"(?:risk[\s-]?tier|tier)[\s:]*(?:0|T0|info)",
        }

        for tier, pattern in tier_patterns.items():
            if re.search(pattern, self.pr_description, re.IGNORECASE):
                return tier

        # Infer tier from paths
        if any(f.startswith(".github/workflows/") for f in self.changed_files):
            return "T2"  # CI/CD changes are T2
        if any(f.startswith("GOVERNANCE/") for f in self.changed_files):
            return "T2"  # Governance changes are T2
        if any(f.startswith("AGENTS/") for f in self.changed_files):
            return "T2"  # Agent changes are T2

        return "T3"  # Default

    # =========================================================================
    # CHECK 1: STATE File Updates
    # =========================================================================
    def check_state_updates(self):
        """Verify STATE/ files are updated for non-BACKLOG PRs."""
        if self.is_backlog_only():
            self.add_result(
                "STATE Updates",
                True,
                "BACKLOG-only PR, STATE update not required",
                "info",
            )
            return

        if self.is_artifact_only():
            self.add_result(
                "STATE Updates",
                True,
                "Artifact-only PR, STATE update not required",
                "info",
            )
            return

        state_updated = any(f.startswith("STATE/") for f in self.changed_files)
        if state_updated:
            self.add_result("STATE Updates", True, "STATE files updated")
        else:
            self.add_result(
                "STATE Updates",
                False,
                "Non-BACKLOG PR must update STATE/STATUS_LEDGER.md. "
                "Add current state changes to the ledger.",
            )

    # =========================================================================
    # CHECK 2: Protected Path Artifacts
    # =========================================================================
    def check_protected_path_artifacts(self):
        """Verify protected path changes have required artifacts."""
        if not self.touches_protected_path():
            self.add_result(
                "Protected Path Artifacts",
                True,
                "No protected paths changed",
                "info",
            )
            return

        protected_touched = self.get_protected_paths_touched()

        # Check for PLAN section in PR description
        has_plan = bool(
            re.search(r"##\s*PLAN|###\s*PLAN", self.pr_description, re.IGNORECASE)
        )
        has_verification = bool(
            re.search(
                r"##\s*VERIFICATION|###\s*VERIFICATION",
                self.pr_description,
                re.IGNORECASE,
            )
        )

        if has_plan and has_verification:
            self.add_result(
                "Protected Path Artifacts",
                True,
                f"PLAN and VERIFICATION sections present for: {', '.join(protected_touched)}",
            )
        else:
            missing = []
            if not has_plan:
                missing.append("## PLAN")
            if not has_verification:
                missing.append("## VERIFICATION")
            self.add_result(
                "Protected Path Artifacts",
                False,
                f"Protected paths changed: {', '.join(protected_touched)}. "
                f"PR description missing: {', '.join(missing)}",
            )

    # =========================================================================
    # CHECK 3: Risk Tier Requirements
    # =========================================================================
    def check_risk_tier_requirements(self):
        """Verify T1/T2 PRs have rollback and verification proof."""
        tier = self.get_risk_tier()

        if tier not in ["T1", "T2"]:
            self.add_result(
                "Risk Tier Requirements",
                True,
                f"Risk tier {tier} has no special requirements",
                "info",
            )
            return

        has_rollback = bool(
            re.search(r"rollback|revert|undo", self.pr_description, re.IGNORECASE)
        )
        has_verification = bool(
            re.search(
                r"verification|tested|validated|proof",
                self.pr_description,
                re.IGNORECASE,
            )
        )

        issues = []
        if not has_rollback:
            issues.append("rollback plan")
        if not has_verification:
            issues.append("verification proof")

        if issues:
            self.add_result(
                "Risk Tier Requirements",
                False,
                f"{tier} PR missing: {', '.join(issues)}. "
                f"Add rollback instructions and verification evidence to PR description.",
            )
        else:
            self.add_result(
                "Risk Tier Requirements", True, f"{tier} requirements met"
            )

    # =========================================================================
    # CHECK 4: Secret Detection
    # =========================================================================
    def check_secrets(self):
        """Detect potential secrets in PR description."""
        for pattern in self.SECRET_PATTERNS:
            match = re.search(pattern, self.pr_description, re.IGNORECASE)
            if match:
                # Redact the match for safety
                redacted = match.group(0)[:20] + "..."
                self.add_result(
                    "Secret Detection",
                    False,
                    f"Potential secret detected in PR description: {redacted}. "
                    f"Remove secrets from PR body.",
                )
                return

        self.add_result("Secret Detection", True, "No secrets detected in PR description")

    # =========================================================================
    # CHECK 5: Trae Review Artifact
    # =========================================================================
    def check_trae_review(self, pr_number: int):
        """Verify Trae review artifact exists for T1-T4 PRs."""
        tier = self.get_risk_tier()

        # T0 doesn't require Trae
        if tier == "T0":
            self.add_result(
                "Trae Review", True, "T0 PR, Trae review not required", "info"
            )
            return

        # Skip if only artifacts changed (meta-work)
        if self.is_artifact_only():
            self.add_result(
                "Trae Review",
                True,
                "Artifact-only PR, Trae review not required",
                "info",
            )
            return

        # Skip if BACKLOG-only
        if self.is_backlog_only():
            self.add_result(
                "Trae Review",
                True,
                "BACKLOG-only PR, Trae review not required",
                "info",
            )
            return

        # Check for protected paths (require Trae)
        if not self.touches_protected_path() and tier == "T3":
            self.add_result(
                "Trae Review",
                True,
                "T3 PR without protected paths, Trae review optional",
                "info",
            )
            return

        # Look for Trae artifact
        trae_dir = self.repo_root / "COCKPIT" / "artifacts" / "TRAE_REVIEW"
        if not trae_dir.exists():
            self.add_result(
                "Trae Review",
                False,
                f"No TRAE_REVIEW directory found. Create Trae review artifact for {tier} PR.",
            )
            return

        # Find artifact for this PR (check various naming patterns)
        found_artifact = None
        for artifact_file in trae_dir.glob("TRAE-*.yml"):
            if not YAML_AVAILABLE:
                # Fallback: check filename contains PR number
                if f"-{pr_number}" in artifact_file.name:
                    found_artifact = artifact_file
                    break
                continue

            try:
                with open(artifact_file) as f:
                    artifact = yaml.safe_load(f)
                    if artifact and artifact.get("pr_number") == pr_number:
                        verdict = artifact.get("verdict", "")
                        if verdict in ["APPROVE", "EMERGENCY_OVERRIDE"]:
                            self.add_result(
                                "Trae Review",
                                True,
                                f"Trae verdict: {verdict} (artifact: {artifact_file.name})",
                            )
                            return
                        else:
                            self.add_result(
                                "Trae Review",
                                False,
                                f"Trae verdict: {verdict}. Require APPROVE or EMERGENCY_OVERRIDE.",
                            )
                            return
            except Exception:
                continue

        # Also check markdown format (TRAE_VERDICT-*.md)
        for verdict_file in trae_dir.glob("TRAE_VERDICT-*.md"):
            if f"-{pr_number}" in verdict_file.name:
                # Check file content for verdict
                try:
                    content = verdict_file.read_text()
                    if re.search(r"verdict.*APPROVE", content, re.IGNORECASE):
                        self.add_result(
                            "Trae Review",
                            True,
                            f"Trae APPROVE verdict found in {verdict_file.name}",
                        )
                        return
                    elif re.search(r"EMERGENCY.?OVERRIDE", content, re.IGNORECASE):
                        self.add_result(
                            "Trae Review",
                            True,
                            f"Emergency override found in {verdict_file.name}",
                            "warning",
                        )
                        return
                except Exception:
                    continue

        self.add_result(
            "Trae Review",
            False,
            f"No Trae review artifact found for PR #{pr_number}. "
            f"Request Trae review per RUNBOOKS/trae-review.md",
        )

    # =========================================================================
    # CHECK 6: No-Doc-Spam (Single Collaboration Surface)
    # =========================================================================
    def check_no_doc_spam(self):
        """Verify no ad-hoc markdown files created in COCKPIT/."""
        violations = []

        for f in self.changed_files:
            if not f.startswith("COCKPIT/"):
                continue

            # Check if it's an allowed path
            is_allowed = any(
                f.startswith(allowed) or f == allowed
                for allowed in self.ALLOWED_COCKPIT_PATHS
            )

            if not is_allowed:
                violations.append(f)

        if violations:
            self.add_result(
                "No Doc Spam",
                False,
                f"Prohibited file creation in COCKPIT/: {', '.join(violations)}. "
                f"Use COCKPIT/WORKSPACE/TEAM_LOG.md for coordination.",
            )
        else:
            self.add_result(
                "No Doc Spam", True, "No prohibited file creation detected"
            )

    # =========================================================================
    # Main Validation
    # =========================================================================
    def validate(self, pr_number: int = 0) -> Tuple[bool, List[Dict]]:
        """Run all validation checks."""
        self.check_state_updates()
        self.check_protected_path_artifacts()
        self.check_risk_tier_requirements()
        self.check_secrets()
        if pr_number:
            self.check_trae_review(pr_number)
        self.check_no_doc_spam()

        all_passed = all(r["passed"] for r in self.results)
        return all_passed, self.results


def main():
    """CLI entry point for CI."""
    repo_root = os.environ.get("GITHUB_WORKSPACE", ".")
    changed_files_str = os.environ.get("CHANGED_FILES", "")
    pr_description = os.environ.get("PR_DESCRIPTION", "")
    pr_number = int(os.environ.get("PR_NUMBER", "0"))

    changed_files = [f.strip() for f in changed_files_str.split("\n") if f.strip()]

    print("\n" + "=" * 70)
    print("MACHINE BOARD OF DIRECTORS - Governance Validation")
    print("=" * 70)
    print(f"\nRepository: {repo_root}")
    print(f"PR Number: #{pr_number}")
    print(f"Changed Files: {len(changed_files)}")

    if changed_files:
        print("\nFiles Changed:")
        for f in changed_files[:10]:  # Show first 10
            print(f"  - {f}")
        if len(changed_files) > 10:
            print(f"  ... and {len(changed_files) - 10} more")

    validator = GovernanceValidator(repo_root, changed_files, pr_description)
    passed, results = validator.validate(pr_number)

    print("\n" + "-" * 70)
    print("VALIDATION RESULTS")
    print("-" * 70)

    for result in results:
        if result["passed"]:
            icon = "\u2705"  # green check
        else:
            icon = "\u274c"  # red x

        severity = result.get("severity", "error")
        if severity == "warning":
            icon = "\u26a0\ufe0f"  # warning
        elif severity == "info" and result["passed"]:
            icon = "\u2139\ufe0f"  # info

        print(f"\n{icon} {result['check']}")
        if result["message"]:
            print(f"   {result['message']}")

    print("\n" + "=" * 70)
    if passed:
        print("\u2705 RESULT: ALL GOVERNANCE CHECKS PASSED")
        print("=" * 70)
        sys.exit(0)
    else:
        failed_checks = [r["check"] for r in results if not r["passed"]]
        print(f"\u274c RESULT: VALIDATION FAILED ({len(failed_checks)} check(s))")
        print(f"   Failed: {', '.join(failed_checks)}")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
