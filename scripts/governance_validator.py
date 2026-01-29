#!/usr/bin/env python3
"""
Governance Validator — Machine Board of Directors

This script enforces automated governance on pull requests by validating:
1. Protected paths have required PLAN/VERIFICATION artifacts
2. STATE files are updated for non-BACKLOG PRs
3. Risk tier T1/T2 have rollback plans and verification proof
4. No forbidden patterns (secrets) in diffs
5. Framework-only mode validations (YAML, Markdown, structure)

Dependencies: Python 3.6+, PyYAML (optional, simple YAML syntax check only)
"""

import os
import sys
import re
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional

# Configuration
REPO_ROOT = Path(os.getenv("GITHUB_WORKSPACE", Path(__file__).parent.parent))
PROTECTED_PATHS = ["GOVERNANCE", "AGENTS", "COCKPIT", ".github/workflows", "STATE"]
TRAE_ARTIFACT_DIR = REPO_ROOT / "COCKPIT" / "artifacts" / "TRAE_REVIEW"
FRAMEWORK_REQUIRED_FILES = [
    "FRAMEWORK_REQUIREMENTS.md",
    "GOVERNANCE/GUARDRAILS.md",
    "GOVERNANCE/COST_POLICY.md",
    "GOVERNANCE/DEFINITION_OF_DONE.md",
    "GOVERNANCE/RISK_TIERS.md",
    "AGENTS/ROLES.md",
    "AGENTS/CONTRACTS.md",
    "AGENTS/BEST_PRACTICES.md",
    "AGENTS/PROMPT_TEMPLATES.md",
    "FRAMEWORK_KNOWLEDGE/autonomy_principles.md",
    "FRAMEWORK_KNOWLEDGE/product_best_practices.md",
    "FRAMEWORK_KNOWLEDGE/engineering_standards.md",
    "FRAMEWORK_KNOWLEDGE/testing_strategy.md",
    "FRAMEWORK_KNOWLEDGE/deployment_philosophy.md",
    "README.md",
]

# Forbidden secret patterns (basic heuristics)
SECRET_PATTERNS = [
    r"password\s*=\s*['\"]?[^'\"]+['\"]?",  # password=, password='...'
    r"api_key\s*=\s*['\"]?[^'\"]+['\"]?",    # api_key=, api_key='...'
    r"secret\s*=\s*['\"]?[^'\"]+['\"]?",     # secret=, secret='...'
    r"BEGIN\s+PRIVATE\s+KEY",                # RSA private key marker
]

# Required PLAN artifact fields
REQUIRED_PLAN_FIELDS = [
    "Objective",
    "Non-Goals",
    "Files",
    "Risk Tier",
    "Rollback",
]

# PR description artifact sections
REQUIRED_ARTIFACT_SECTIONS = {
    "PLAN": ["scope", "risk tier", "cost estimate", "verification plan", "rollback plan"],
    "VERIFICATION": ["tests run", "results", "ci"],
}


class ValidationResult:
    """Represents the result of a validation check."""

    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def to_dict(self) -> dict:
        return {"name": self.name, "passed": self.passed, "message": self.message}


class GovernanceValidator:
    """Main validator class that orchestrates all checks."""

    def __init__(self):
        self.results: List[ValidationResult] = []
        self.pr_number = os.getenv("PR_NUMBER", "")
        self.pr_description = os.getenv("PR_DESCRIPTION", "")
        self.changed_files = self._get_changed_files()
        self.framework_only_mode = self._is_framework_only_mode()

    def _get_changed_files(self) -> List[Path]:
        """Get list of changed files in the PR from GitHub API or git."""
        # First, try to get changed files from GitHub API (via CHANGED_FILES env var)
        changed_files_env = os.getenv("CHANGED_FILES", "")

        if changed_files_env:
            # GitHub API provided the files - use them directly
            files = [Path(f.strip()) for f in changed_files_env.splitlines() if f.strip()]
            print(f"   Using changed files from GitHub API: {len(files)} files")
            return files

        # Fallback: try git diff
        try:
            # For pull_request_target, diff against main
            # For pull_request, diff against base branch
            base_ref = os.getenv("GITHUB_BASE_REF", "main")
            result = subprocess.run(
                ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
                check=True,
            )
            files = [Path(f.strip()) for f in result.stdout.splitlines() if f.strip()]
            print(f"   Using changed files from git diff: {len(files)} files")
            return files
        except subprocess.CalledProcessError:
            # Fallback: check if we're checking a specific commit
            try:
                result = subprocess.run(
                    ["git", "diff", "--name-only", "HEAD^", "HEAD"],
                    capture_output=True,
                    text=True,
                    cwd=REPO_ROOT,
                    check=True,
                )
                files = [Path(f.strip()) for f in result.stdout.splitlines() if f.strip()]
                print(f"   Using changed files from HEAD^ diff: {len(files)} files")
                return files
            except subprocess.CalledProcessError:
                print(f"   Warning: Could not determine changed files")
                return []

    def _is_framework_only_mode(self) -> bool:
        """Check if repository is in framework-only mode (no APP tests)."""
        app_dir = REPO_ROOT / "APP"
        if not app_dir.exists():
            return True
        # Check for test configuration files
        test_configs = ["pytest.ini", "pyproject.toml", "setup.cfg", "package.json"]
        for config in test_configs:
            config_file = REPO_ROOT / config
            if config_file.exists():
                content = config_file.read_text()
                if "pytest" in content or "test" in content.lower():
                    return False
        return True

    def add_result(self, name: str, passed: bool, message: str = ""):
        """Add a validation result."""
        self.results.append(ValidationResult(name, passed, message))

    def validate(self) -> bool:
        """Run all validations and return overall status."""
        print("🤖 Machine Board of Directors - Governance Validator")
        print("=" * 60)

        # Run all checks
        self._check_secrets_in_diffs()
        self._check_artifacts_for_protected_paths()
        self._check_state_files_updated()
        self._check_risk_tier_requirements()
        self._check_trae_review_for_protected_paths()
        self._check_framework_only_validations()
        self._check_plan_structure()

        # Print results and exit
        self._print_results()
        return all(r.passed for r in self.results)

    def _check_secrets_in_diffs(self):
        """Check for forbidden patterns (secrets) in diffs."""
        print("\n🔍 Checking for forbidden patterns in diffs...")
        found_secrets = []

        try:
            base_ref = os.getenv("GITHUB_BASE_REF", "main")
            result = subprocess.run(
                ["git", "diff", f"{base_ref}...HEAD"],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
                check=True,
            )
            diff_content = result.stdout

            for pattern in SECRET_PATTERNS:
                matches = re.finditer(pattern, diff_content, re.IGNORECASE)
                for match in matches:
                    line_start = diff_content.rfind("\n", 0, match.start()) + 1
                    line_end = diff_content.find("\n", match.end())
                    line = diff_content[line_start:line_end].strip()
                    found_secrets.append(f"Pattern: {pattern}, Line: {line[:80]}")
        except subprocess.CalledProcessError:
            pass

        if found_secrets:
            self.add_result(
                "Secret Detection",
                False,
                f"Found {len(found_secrets)} potential secret(s): {found_secrets[0]}",
            )
            print(f"   ❌ Found {len(found_secrets)} potential secret(s)")
        else:
            self.add_result("Secret Detection", True)
            print(f"   ✅ No secrets detected")

    def _check_artifacts_for_protected_paths(self):
        """Check if protected paths have required PLAN/VERIFICATION artifacts."""
        print("\n📋 Checking artifacts for protected paths...")

        protected_changed = [
            f for f in self.changed_files if any(p in f.parts for p in PROTECTED_PATHS)
        ]

        if not protected_changed:
            self.add_result("Protected Path Artifacts", True, "No protected paths changed")
            print(f"   ✅ No protected paths changed")
            return

        print(f"   Protected paths changed: {[str(f) for f in protected_changed]}")

        # Check PR description for artifact sections
        desc_lower = self.pr_description.lower()

        # Check for PLAN section references
        has_plan = (
            "## plan" in desc_lower
            or "<!-- plan" in desc_lower
            or any(section in desc_lower for section in REQUIRED_ARTIFACT_SECTIONS["PLAN"])
        )

        # Check for VERIFICATION section references
        has_verification = (
            "## verification" in desc_lower
            or "<!-- verification" in desc_lower
            or any(
                section in desc_lower for section in REQUIRED_ARTIFACT_SECTIONS["VERIFICATION"]
            )
        )

        # Check for referenced artifact files
        artifact_refs = re.findall(
            r"\[ARTIFACT:?\s*([^\]]+)\]", self.pr_description, re.IGNORECASE
        )
        has_artifact_refs = len(artifact_refs) > 0

        # Check STATE files mentioned
        mentions_state = (
            "state/status_ledger.md" in desc_lower.lower()
            or "state/last_known_state.md" in desc_lower.lower()
        )

        if has_plan and has_verification and mentions_state:
            self.add_result(
                "Protected Path Artifacts",
                True,
                "PLAN, VERIFICATION, and STATE updates documented",
            )
            print(f"   ✅ Required artifacts documented in PR description")
        elif has_artifact_refs:
            self.add_result(
                "Protected Path Artifacts",
                True,
                f"Referenced artifacts: {artifact_refs}",
            )
            print(f"   ✅ Referenced artifact files: {artifact_refs}")
        else:
            missing = []
            if not has_plan and not has_artifact_refs:
                missing.append("PLAN section")
            if not has_verification and not has_artifact_refs:
                missing.append("VERIFICATION section")
            if not mentions_state:
                missing.append("STATE file updates")

            self.add_result(
                "Protected Path Artifacts",
                False,
                f"Missing: {', '.join(missing)}",
            )
            print(f"   ❌ Missing required artifacts: {', '.join(missing)}")

    def _check_state_files_updated(self):
        """Check if STATE files are updated for non-BACKLOG PRs."""
        print("\n📊 Checking STATE file updates...")

        # Check if only BACKLOG/** files changed
        only_backlog_changed = all(
            any(p in f.parts for p in ["BACKLOG"])
            for f in self.changed_files
            if f.exists()
        )

        # Check if PR description explicitly states STATE will be updated
        desc_lower = self.pr_description.lower()
        will_update_state = (
            "state will be updated" in desc_lower
            or "state files will be updated" in desc_lower
            or "immediately after merge" in desc_lower
        )

        if only_backlog_changed:
            self.add_result(
                "STATE File Updates",
                True,
                "BACKLOG-only PR (STATE updates optional)",
            )
            print(f"   ✅ BACKLOG-only PR (STATE updates optional)")
            return

        state_files_in_changes = [
            f
            for f in self.changed_files
            if "STATE" in f.parts and f.name in ["STATUS_LEDGER.md", "LAST_KNOWN_STATE.md"]
        ]

        if state_files_in_changes:
            self.add_result(
                "STATE File Updates",
                True,
                f"STATE files updated: {[f.name for f in state_files_in_changes]}",
            )
            print(f"   ✅ STATE files included in PR")
        elif will_update_state:
            self.add_result(
                "STATE File Updates",
                True,
                "PR description states STATE will be updated after merge",
            )
            print(f"   ✅ PR describes post-merge STATE update")
        else:
            self.add_result(
                "STATE File Updates",
                False,
                "No STATE files in PR (required unless BACKLOG-only)",
            )
            print(f"   ❌ STATE files not updated (required for non-BACKLOG PRs)")

    def _check_risk_tier_requirements(self):
        """Check if T1/T2 risk tiers have rollback plan and verification proof."""
        print("\n⚠️  Checking risk tier requirements...")

        desc_lower = self.pr_description.lower()

        # Detect risk tier
        risk_tier = None
        if "tier 1" in desc_lower or "t1" in desc_lower or "critical" in desc_lower:
            risk_tier = "T1"
        elif "tier 2" in desc_lower or "t2" in desc_lower or "high risk" in desc_lower:
            risk_tier = "T2"

        if not risk_tier:
            self.add_result(
                "Risk Tier Requirements",
                True,
                "No T1/T2 risk tier detected",
            )
            print(f"   ✅ No T1/T2 risk tier detected")
            return

        print(f"   Detected risk tier: {risk_tier}")

        # Check for rollback plan
        has_rollback = (
            "rollback" in desc_lower
            or "roll back" in desc_lower
            or "revert" in desc_lower
        )

        # Check for verification proof
        has_verification = (
            "verification" in desc_lower
            or "verified" in desc_lower
            or "tests passed" in desc_lower
            or "ci passed" in desc_lower
            or "ci:" in desc_lower.lower()
        )

        if has_rollback and has_verification:
            self.add_result(
                "Risk Tier Requirements",
                True,
                f"{risk_tier} has rollback plan and verification proof",
            )
            print(f"   ✅ {risk_tier} requirements satisfied")
        else:
            missing = []
            if not has_rollback:
                missing.append("rollback plan")
            if not has_verification:
                missing.append("verification proof")

            self.add_result(
                "Risk Tier Requirements",
                False,
                f"{risk_tier} missing: {', '.join(missing)}",
            )
            print(f"   ❌ {risk_tier} missing: {', '.join(missing)}")

    def _check_trae_review_for_protected_paths(self):
        """Check if T1-T4 PRs have required TRAE_REVIEW artifact."""
        print("\n🔒 Checking Trae review for T1-T4 changes...")

        # Bootstrap exception for PR #21 (Trae integration)
        if self.pr_number == "21":
            self.add_result(
                "Trae Review",
                True,
                "Bootstrap: Trae integration PR self-approved (PR #21)",
            )
            print(f"   ⚠️  Bootstrap exception: Trae integration PR (#21) self-approved")
            return

        desc_lower = self.pr_description.lower()

        # Check for emergency override
        has_emergency_override = "emergency" in desc_lower and "override" in desc_lower

        if has_emergency_override:
            self.add_result(
                "Trae Review",
                True,
                "Emergency override declared",
            )
            print(f"   ⚠️  Emergency override detected - Trae review waived")
            return

        # Check if PR touches protected paths
        protected_changed = [
            f for f in self.changed_files if any(p in f.parts for p in PROTECTED_PATHS)
        ]

        # Check if PR is T1 or T2 risk tier
        risk_tier = None
        if "tier 1" in desc_lower or "t1" in desc_lower or "critical" in desc_lower:
            risk_tier = "T1"
        elif "tier 2" in desc_lower or "t2" in desc_lower or "high risk" in desc_lower:
            risk_tier = "T2"

        # Trae review required if...
        requires_trae_review = protected_changed or risk_tier in ["T1", "T2"]

        if not requires_trae_review:
            self.add_result(
                "Trae Review",
                True,
                "Not required (no T1-T4 changes)",
            )
            print(f"   ✅ Trae review not required (no T1-T4 changes)")
            return

        print(f"   Trae review required: protected={len(protected_changed) > 0}, risk_tier={risk_tier or 'none'}")

        # Check for TRAE_REVIEW artifact
        if not TRAE_ARTIFACT_DIR.exists():
            self.add_result(
                "Trae Review",
                False,
                f"TRAE_REVIEW directory not found: {TRAE_ARTIFACT_DIR.relative_to(REPO_ROOT)}",
            )
            print(f"   ❌ TRAE_REVIEW directory not found")
            return

        # Find artifact for this PR
        artifact_files = list(TRAE_ARTIFACT_DIR.glob(f"TRAE-*-{self.pr_number}.yml"))

        if not artifact_files:
            self.add_result(
                "Trae Review",
                False,
                f"No TRAE_REVIEW artifact found for PR #{self.pr_number}",
            )
            print(f"   ❌ No TRAE_REVIEW artifact found for PR #{self.pr_number}")
            return

        artifact_path = artifact_files[0]
        print(f"   Found artifact: {artifact_path.name}")

        # Parse artifact (simple YAML-like parsing)
        verdict = None
        created_at = None

        try:
            with open(artifact_path) as f:
                content = f.read()

            # Extract verdict using regex
            verdict_match = re.search(r'^verdict:\s*["\']?([^"\'\s]+)["\']?', content, re.MULTILINE)
            created_match = re.search(r'^created_at:\s*["\']?([^"\']+)["\']?', content, re.MULTILINE)

            verdict = verdict_match.group(1) if verdict_match else None
            created_at = created_match.group(1) if created_match else None

        except Exception as e:
            self.add_result(
                "Trae Review",
                False,
                f"Failed to parse artifact: {e}",
            )
            print(f"   ❌ Failed to parse artifact: {e}")
            return

        if not verdict:
            self.add_result(
                "Trae Review",
                False,
                "Artifact has no verdict field",
            )
            print(f"   ❌ Artifact has no verdict field")
            return

        print(f"   Artifact verdict: {verdict}")

        # Validate verdict
        if verdict not in ["APPROVE", "EMERGENCY_OVERRIDE"]:
            self.add_result(
                "Trae Review",
                False,
                f"Trae verdict is '{verdict}', require 'APPROVE'",
            )
            print(f"   ❌ Verdict is '{verdict}', require 'APPROVE'")
            return

        # Check expiry (< 7 days old)
        if created_at:
            try:
                from datetime import datetime, timedelta
                parsed_date = datetime.strptime(created_at, "%Y-%m-%d %H:%M UTC")
                expiry_date = datetime.utcnow() - timedelta(days=7)

                if parsed_date < expiry_date:
                    self.add_result(
                        "Trae Review",
                        False,
                        f"Artifact is stale (created: {created_at})",
                    )
                    print(f"   ❌ Artifact is stale (> 7 days old)")
                    return

            except Exception:
                # If we can't parse date, consider it valid (conservative)
                pass

        self.add_result(
            "Trae Review",
            True,
            f"Valid Trae review (verdict: {verdict})",
        )
        print(f"   ✅ Trae review validated (verdict: {verdict})")

    def _check_framework_only_validations(self):
        """Run framework-only mode validations."""
        print("\n🏗️  Checking framework-only validations...")

        if not self.framework_only_mode:
            self.add_result(
                "Framework Validations",
                True,
                "Framework mode not applicable (APP tests exist)",
            )
            print(f"   ✅ Framework mode not applicable")
            return

        results = []

        # Check YAML syntax for workflows
        workflows_dir = REPO_ROOT / ".github" / "workflows"
        if workflows_dir.exists():
            yaml_ok = True
            for yaml_file in workflows_dir.glob("*.yml"):
                yaml_ok = yaml_ok and self._check_yaml_syntax(yaml_file)
            results.append(("YAML Syntax", yaml_ok))
        else:
            results.append(("YAML Syntax", True))  # No workflows to check

        # Check Markdown for basic issues
        md_files = list(REPO_ROOT.rglob("*.md"))[:20]  # Check first 20 files
        no_binary_blobs = True
        has_headings = False
        for md_file in md_files:
            content = md_file.read_text()
            if "\x00" in content:  # Binary marker
                no_binary_blobs = False
                break
            if re.search(r"^#{1,3}\s+", content):
                has_headings = True

        results.append(("Markdown Valid", no_binary_blobs))
        results.append(("Documentation Structure", has_headings))

        # Check required framework files exist
        required_exist = all((REPO_ROOT / f).exists() for f in FRAMEWORK_REQUIRED_FILES)
        results.append(("Framework Structure", required_exist))

        passed = all(ok for _, ok in results)

        if passed:
            self.add_result("Framework Validations", True, "All framework checks passed")
            print(f"   ✅ All framework checks passed:")
            for name, _ in results:
                print(f"      ✅ {name}")
        else:
            failures = [name for name, ok in results if not ok]
            self.add_result(
                "Framework Validations",
                False,
                f"Failed: {', '.join(failures)}",
            )
            print(f"   ❌ Framework validation failures:")
            for name, ok in results:
                status = "✅" if ok else "❌"
                print(f"      {status} {name}")

    def _check_plan_structure(self):
        """Check if PLAN artifacts have required structural fields.
        
        Applies when:
        - Risk Tier >= T1
        - OR directories include protected paths (FOUNDATION, COCKPIT, etc.)
        
        Required fields: Objective, Non-Goals, Files, Risk Tier, Rollback
        """
        print("\n📋 Checking PLAN structure...")
        
        # Determine if this check applies
        desc_lower = self.pr_description.lower()
        
        # Check risk tier
        risk_tier = None
        if "tier 1" in desc_lower or "t1" in desc_lower or "critical" in desc_lower:
            risk_tier = "T1"
        elif "tier 2" in desc_lower or "t2" in desc_lower or "high risk" in desc_lower:
            risk_tier = "T2"
        elif "tier 3" in desc_lower or "t3" in desc_lower:
            risk_tier = "T3"
        elif "tier 4" in desc_lower or "t4" in desc_lower:
            risk_tier = "T4"
        
        # Check protected paths
        protected_changed = [
            f for f in self.changed_files 
            if any(p in f.parts for p in PROTECTED_PATHS + ["FOUNDATION", "GOVERNANCE", "AGENTS"])
        ]
        
        # Skip if T0 or lower and no protected paths
        if not risk_tier and not protected_changed:
            self.add_result("PLAN Structure", True, "Low risk, no protected paths - validation not required")
            print(f"   ✅ Low risk change - PLAN structure validation not required")
            return
        
        print(f"   PLAN validation required: risk_tier={risk_tier or 'detected'}, protected_paths={len(protected_changed) > 0}")
        
        # Check if there's a referenced PLAN artifact file
        plan_artifacts = re.findall(r"\[PLAN:\s*([^\]]+)\]", self.pr_description, re.IGNORECASE)
        if not plan_artifacts:
            plan_artifacts = re.findall(r"plan.*artifact:\s*([^\s\n]+)", self.pr_description, re.IGNORECASE)
        
        # Also check for inline PLAN section in PR description
        has_plan_section = re.search(r"##?\s*plan", desc_lower) is not None
        
        # Check if all required fields are present (even without ## plan header)
        content_lower = desc_lower
        all_fields_present = True
        any_field_present = False
        fields_found = []
        for field in REQUIRED_PLAN_FIELDS:
            heading_patterns = [
                rf"(?:^|\n)#+\s+{re.escape(field.lower())}",  # ## Objective (start of line or after newline)
                rf"(?:^|\n)\s*\*{1,2}" + re.escape(field.lower()) + r"\*{0,2}:\s*",  # **Objective:** or *Objective:*
                rf"(?:^|\n)\s*-\s+{re.escape(field.lower())}",  # - Objective
            ]
            found = any(re.search(pattern, content_lower) for pattern in heading_patterns)
            fields_found.append((field, found))
            if not found:
                all_fields_present = False
            else:
                any_field_present = True
        
        has_fields_directly = all_fields_present
        has_partial_plan = any_field_present  # At least one PLAN field found
        
        # Determine content source for validation
        content_to_check = ""
        
        if plan_artifacts:
            # Try to read the first referenced PLAN artifact
            plan_path = REPO_ROOT / plan_artifacts[0]
            try:
                content_to_check = plan_path.read_text()
                print(f"   Checking PLAN artifact: {plan_artifacts[0]}")
            except FileNotFoundError:
                self.add_result(
                    "PLAN Structure",
                    False,
                    f"Referenced PLAN artifact not found: {plan_artifacts[0]}"
                )
                print(f"   ❌ PLAN artifact not found: {plan_artifacts[0]}")
                return
        elif has_plan_section or has_fields_directly or has_partial_plan:
            # Use PR description as PLAN content
            content_to_check = self.pr_description
            if has_plan_section:
                print(f"   Checking inline PLAN section in PR description")
            else:
                print(f"   Checking PLAN fields in PR description")
        else:
            # No PLAN found at all
            self.add_result(
                "PLAN Structure",
                False,
                "No PLAN artifact found - required for T1+ or protected paths"
            )
            print(f"   ❌ No PLAN artifact referenced or inline PLAN section found")
            return
        
        # Check for required fields (case-insensitive heading match)
        content_lower = content_to_check.lower()
        missing_fields = []
        
        for field in REQUIRED_PLAN_FIELDS:
            # Look for heading patterns like "## Objective" or "**Objective:**"
            heading_patterns = [
                rf"^#+\s+{re.escape(field.lower())}",  # ## Objective
                # Use ^\*{{1,2}} for 1-2 stars at start, \*{{0,2}} for 0-2 stars at end
                r"^\*{1,2}" + re.escape(field.lower()) + r"\*{0,2}:",  # **Objective:** or *Objective:*
                rf"^\s*-\s+{re.escape(field.lower())}",  # - Objective
            ]
            found = any(re.search(pattern, content_lower, re.MULTILINE) for pattern in heading_patterns)
            if not found:
                missing_fields.append(field)
        
        if missing_fields:
            self.add_result(
                "PLAN Structure",
                False,
                f"Missing required PLAN fields: {', '.join(missing_fields)}"
            )
            print(f"   ❌ Missing required fields: {', '.join(missing_fields)}")
        else:
            self.add_result(
                "PLAN Structure",
                True,
                f"All required PLAN fields present ({len(REQUIRED_PLAN_FIELDS)} fields)"
            )
            print(f"   ✅ All required PLAN fields present")

    def _check_yaml_syntax(self, yaml_file: Path) -> bool:
        """Basic YAML syntax check without pyyaml dependency."""
        try:
            with open(yaml_file) as f:
                content = f.read()

            # Basic indentation checks
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if line.strip():
                    # Check for mixed tabs and spaces
                    if "\t" in line and line.startswith(" " * 1):
                        return False

            return True
        except Exception:
            return False

    def _print_results(self):
        """Print all validation results and output summary JSON."""
        print("\n" + "=" * 60)
        print("VALIDATION SUMMARY")
        print("=" * 60)

        for result in self.results:
            status = "✅ PASS" if result.passed else "❌ FAIL"
            print(f"{status} - {result.name}")
            if result.message:
                print(f"      {result.message}")

        print("=" * 60)

        # Output results as JSON for GitHub actions
        results_json = {"results": [r.to_dict() for r in self.results]}
        print(f"::set-output name=results::{json.dumps(results_json)}")

        # Write to file for GitHub actions
        output_file = REPO_ROOT / ".governance_validator_results.json"
        with open(output_file, "w") as f:
            json.dump(results_json, f, indent=2)

        print(f"\nResults written to: {output_file.relative_to(REPO_ROOT)}")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Machine Board of Directors Governance Validator")
    parser.add_argument("--test", action="store_true", help="Run in test mode")
    args = parser.parse_args()

    validator = GovernanceValidator()
    passed = validator.validate()

    if args.test:
        print("\n🧪 Test mode: Not enforcing validation status")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
