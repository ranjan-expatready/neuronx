"""
Policy Engine - Risk Classification and Safety Enforcement

Implements risk classification for tasks based on the canonical policy definitions.
Phase 3A: Hardcoded Always-Red categories with basic keyword-based classification.
"""

from enum import Enum
from typing import List, Optional

class RiskTier(Enum):
    """Risk classification tiers."""
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"

class PolicyEngine:
    """
    Policy engine for risk classification and safety enforcement.

    Implements the risk classification logic from agent_runtime/policy.md
    """

    def __init__(self):
        # Always Red categories from policy.md
        self.always_red_categories = [
            "auth/permissions/rbac",
            "payments/billing",
            "secrets/env/prod credentials",
            "destructive DB migrations (drop/alter)",
            "infra/terraform/k8s",
            "logging/audit tampering",
            "data export / PII access"
        ]

        # Keywords that suggest Red-tier risk
        self.red_keywords = [
            "auth", "authentication", "authorization", "permissions", "rbac",
            "payment", "billing", "stripe", "charge", "invoice",
            "secret", "credential", "password", "token", "key", "env",
            "database", "migration", "drop", "alter", "delete", "destroy",
            "infra", "terraform", "kubernetes", "k8s", "infrastructure",
            "logging", "audit", "tamper", "PII", "personal", "export", "data"
        ]

        # Keywords that suggest Yellow-tier risk
        self.yellow_keywords = [
            "api", "endpoint", "interface", "contract",
            "database", "schema", "table", "column",
            "security", "encrypt", "decrypt", "hash",
            "deploy", "release", "production",
            "config", "configuration", "setting",
            "user", "profile", "account"
        ]

        self._last_classification_reason = ""

    def classify_risk(self, task: str) -> RiskTier:
        """
        Classify the risk level of a task based on its description.

        Args:
            task: Natural language task description

        Returns:
            RiskTier: GREEN, YELLOW, or RED
        """
        task_lower = task.lower()

        # Check Always Red categories first
        for category in self.always_red_categories:
            category_keywords = category.lower().split('/')
            if any(keyword in task_lower for keyword in category_keywords):
                self._last_classification_reason = f"Always Red category: {category}"
                return RiskTier.RED

        # Check for Red-tier keywords
        for keyword in self.red_keywords:
            if keyword in task_lower:
                self._last_classification_reason = f"Red-tier keyword detected: {keyword}"
                return RiskTier.RED

        # Check for Yellow-tier keywords
        for keyword in self.yellow_keywords:
            if keyword in task_lower:
                self._last_classification_reason = f"Yellow-tier keyword detected: {keyword}"
                return RiskTier.YELLOW

        # Default to Green for safe tasks
        self._last_classification_reason = "No risk keywords detected - defaulting to Green"
        return RiskTier.GREEN

    def get_classification_reason(self) -> str:
        """Get the reason for the last risk classification."""
        return self._last_classification_reason

    def validate_task_allowed(self, task: str) -> tuple[bool, str]:
        """
        Validate if a task is allowed to proceed.

        Args:
            task: Task description to validate

        Returns:
            Tuple of (is_allowed, reason)
        """
        risk_tier = self.classify_risk(task)

        if risk_tier == RiskTier.RED:
            return False, "HITL required for Red-tier tasks"

        return True, f"{risk_tier.value} tier - proceeding with safety measures"

    def get_always_red_categories(self) -> List[str]:
        """Get the list of always Red categories."""
        return self.always_red_categories.copy()

    def is_task_dry_run_only(self, task: str) -> bool:
        """
        Determine if a task should only run in dry-run mode.

        Phase 3A: All non-Green tasks require dry-run first.
        """
        risk_tier = self.classify_risk(task)
        return risk_tier in [RiskTier.YELLOW, RiskTier.RED]

# Convenience functions
def classify_task_risk(task: str) -> RiskTier:
    """Convenience function to classify a single task."""
    engine = PolicyEngine()
    return engine.classify_risk(task)

def is_task_allowed(task: str) -> bool:
    """Convenience function to check if a task is allowed."""
    engine = PolicyEngine()
    allowed, _ = engine.validate_task_allowed(task)
    return allowed