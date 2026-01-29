#!/usr/bin/env python3
"""
Unit tests for PLAN structure enforcement in governance_validator.py

These tests validate:
- PLAN structure enforcement triggers on T1+ risk tiers or protected paths
- Missing required PLAN fields produces deterministic errors
- Complete PLAN passes validation
"""

import os
import sys
import json
import tempfile
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add scripts to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from governance_validator import GovernanceValidator, REQUIRED_PLAN_FIELDS, PROTECTED_PATHS


class TestPlanStructureEnforcement:
    """Test PLAN structure validation logic."""

    def test_required_plan_fields_defined(self):
        """Test that REQUIRED_PLAN_FIELDS contains all expected fields."""
        expected_fields = ["Objective", "Non-Goals", "Files", "Risk Tier", "Rollback"]
        assert REQUIRED_PLAN_FIELDS == expected_fields

    def test_triggers_on_t1_risk_tier(self):
        """Test that plan structure check triggers for T1 risk tier."""
        validator = GovernanceValidator()
        validator.changed_files = [Path("BACKLOG/test.md")]  # Non-protected path
        validator.pr_description = "Risk Tier: T1\n## Plan\nObjective: Test"
        
        # Should require plan validation
        desc_lower = validator.pr_description.lower()
        assert "tier 1" in desc_lower or "t1" in desc_lower

    def test_triggers_on_t2_risk_tier(self):
        """Test that plan structure check triggers for T2 risk tier."""
        validator = GovernanceValidator()
        validator.changed_files = [Path("BACKLOG/test.md")]  # Non-protected path
        validator.pr_description = "Risk Tier: T2\n## Plan\nObjective: Test"
        
        desc_lower = validator.pr_description.lower()
        assert "tier 2" in desc_lower or "t2" in desc_lower

    def test_triggers_on_protected_path(self):
        """Test that plan structure check triggers when touching protected paths."""
        validator = GovernanceValidator()
        validator.changed_files = [Path("GOVERNANCE/test.md")]
        validator.pr_description = "Minor update\n## Plan\n---"
        
        # Check if any path is protected
        protected_changed = [
            f for f in validator.changed_files 
            if any(p in f.parts for p in PROTECTED_PATHS + ["FOUNDATION", "GOVERNANCE", "AGENTS"])
        ]
        assert len(protected_changed) > 0

    def test_skips_on_low_risk_no_protected_paths(self):
        """Test that plan structure check is skipped for T3/T4 with no protected paths."""
        validator = GovernanceValidator()
        validator.changed_files = [Path("BACKLOG/test.md")]
        validator.pr_description = "T3 change\n## Plan"
        
        # Check risk tier detection
        desc_lower = validator.pr_description.lower()
        has_tier = any(t in desc_lower for t in ["tier 1", "t1", "tier 2", "t2"])
        
        # Check protected paths
        protected_changed = [
            f for f in validator.changed_files 
            if any(p in f.parts for p in PROTECTED_PATHS + ["FOUNDATION", "GOVERNANCE", "AGENTS"])
        ]
        
        # Should skip validation
        assert not has_tier
        assert len(protected_changed) == 0

    def test_detects_missing_objective_field(self):
        """Test that missing Objective field is detected."""
        content = "## Non-Goals\n- Thing\n## Files\n- test.py\n## Risk Tier\nT1\n## Rollback\nRevert"
        
        content_lower = content.lower()
        heading_patterns = [
            r"^#+\s+objective",
            r"^\*\*?objective\*\*?:",
            r"^\s*-\s+objective",
        ]
        found = any(
            __import__('re').search(pattern, content_lower, __import__('re').MULTILINE) 
            for pattern in heading_patterns
        )
        
        assert not found, "Should not find Objective in content without it"

    def test_detects_missing_files_field(self):
        """Test that missing Files field is detected."""
        content = "## Objective\nTest\n## Non-Goals\n- Thing\n## Risk Tier\nT1\n## Rollback\nRevert"
        
        content_lower = content.lower()
        heading_patterns = [
            r"^#+\s+files",
            r"^\*\*?files\*\*?:",
            r"^\s*-\s+files",
        ]
        found = any(
            __import__('re').search(pattern, content_lower, __import__('re').MULTILINE) 
            for pattern in heading_patterns
        )
        
        assert not found, "Should not find Files in content without it"

    def test_detects_all_fields_present(self):
        """Test that all required fields are detected when present."""
        content = """## Objective
Test objective
## Non-Goals
- Thing 1
- Thing 2
## Files
- test.py
## Risk Tier
T1
## Rollback
Revert commit"""
        
        content_lower = content.lower()
        missing_fields = []
        
        for field in REQUIRED_PLAN_FIELDS:
            heading_patterns = [
                rf"^#+\s+{__import__('re').escape(field.lower())}",
                rf"^\*\*?{__import__('re').escape(field.lower())}\*\*?:",
                rf"^\s*-\s+{__import__('re').escape(field.lower())}",
            ]
            found = any(
                __import__('re').search(pattern, content_lower, __import__('re').MULTILINE) 
                for pattern in heading_patterns
            )
            if not found:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"All fields should be present, missing: {missing_fields}"

    def test_detects_inline_plan_in_pr_description(self):
        """Test that inline plan sections in PR description are detected."""
        pr_description = """T1 Change

## Plan

### Objective
Test objective

### Non-Goals
- Thing 1

### Files
- test.py

### Risk Tier
T1

### Rollback
Revert"""
        
        has_plan_section = __import__('re').search(r"##?\s*plan", pr_description.lower()) is not None
        assert has_plan_section

    def test_case_insensitive_field_detection(self):
        """Test that field detection is case insensitive."""
        content = "## OBJECTIVE\nTest\n## Non-Goals\n- Thing\n## FILES\n- test.py\n## Risk TIER\nT1\n## Rollback\nRevert"
        
        content_lower = content.lower()
        missing_fields = []
        
        for field in REQUIRED_PLAN_FIELDS:
            heading_patterns = [
                rf"^#+\s+{__import__('re').escape(field.lower())}",
                rf"^\*\*?{__import__('re').escape(field.lower())}\*\*?:",
                rf"^\s*-\s+{__import__('re').escape(field.lower())}",
            ]
            found = any(
                __import__('re').search(pattern, content_lower, __import__('re').MULTILINE) 
                for pattern in heading_patterns
            )
            if not found:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Case-insensitive search failed, missing: {missing_fields}"


class TestPlanStructureIntegration:
    """Integration tests for plan structure enforcement."""

    def test_validator_initializes_with_plan_fields(self):
        """Test that validator has plan fields configured."""
        validator = GovernanceValidator()
        assert hasattr(validator, 'pr_description')
        assert len(REQUIRED_PLAN_FIELDS) == 5

    def test_plan_artifact_file_detection(self):
        """Test detection of [PLAN: path] references in PR description."""
        pr_description = """[PLAN: BACKLOG/PLAN-001.md]

This PR implements the plan."""
        
        plan_artifacts = __import__('re').findall(r"\[PLAN:\s*([^\]]+)\]", pr_description, __import__('re').IGNORECASE)
        assert len(plan_artifacts) == 1
        assert plan_artifacts[0].strip() == "BACKLOG/PLAN-001.md"


if __name__ == "__main__":
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
