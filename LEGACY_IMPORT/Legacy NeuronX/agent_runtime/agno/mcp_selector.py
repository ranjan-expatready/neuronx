"""
MCP Selector - Deterministic suggestion-only tool planning (Phase 5C) + Autonomous Execution (Phase 5F)

Provides structured MCP suggestions:
- Risk tier classification
- MCP appropriateness
- Recommended providers from configured MCP providers
- Recommended allowlisted actions
- Required environment variables
- Exact next command snippets

Also provides autonomous MCP execution decisions for GREEN-tier tasks.
"""

import json
import os
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from policy import PolicyEngine, RiskTier
from mcp_bridge import MCPBridge


class MCPAppropriateness(Enum):
    """Whether MCP is appropriate for the task."""
    APPROPRIATE = "appropriate"
    NOT_APPROPRIATE = "not_appropriate"
    MAYBE_APPROPRIATE = "maybe_appropriate"


@dataclass
class ProviderSuggestion:
    """Suggestion for a specific provider."""
    provider_name: str
    reason: str  # Why this provider matches the task
    allowed_actions: List[str]  # Only allowlisted actions from config
    required_env_vars: List[str]
    command_snippet: str  # Exact command to run


@dataclass
class AutoMCPDecision:
    """
    Autonomous MCP execution decision.
    """
    decision: str  # "execute_mcp", "use_local_tools", "block_safe", "block_unsafe"
    reasoning: Dict[str, Any]
    provider_action: Optional[Tuple[str, str]]  # (provider, action)
    params: Dict[str, Any]
    budget_required: Dict[str, int]  # {calls: int, seconds: int}


@dataclass
class MCPSuggestion:
    """Complete MCP suggestion for a task."""
    task: str
    risk_tier: RiskTier
    risk_reason: str
    mcp_appropriate: MCPAppropriateness
    mcp_appropriate_reason: str
    mcp_config_provided: bool
    mcp_enabled: bool
    readiness_status: str  # Overall readiness from last check
    provider_suggestions: List[ProviderSuggestion]
    general_recommendation: str  # Overall recommendation text


class MCPSelector:
    """
    Deterministic MCP suggestion engine.

    Uses keyword/regex mapping to match tasks to providers.
    No LLM calls - purely rule-based.
    """

    # Provider keyword mappings (lowercase)
    PROVIDER_KEYWORDS = {
        "github": ["github", "issue", "pr", "pull request", "repo", "repository",
                  "branch", "commit", "merge", "collaborator", "code review"],
        "context7": ["context", "context7", "docs", "documentation", "library",
                    "lookup", "reference", "semantic search"],
        "filesystem": ["file", "directory", "folder", "read", "write", "path", "ls", "cat", "fs"],
        "linear": ["linear", "ticket", "task", "project management", "backlog"],
        "postgres": ["postgres", "database", "db", "sql", "query", "schema", "table"],
        "sentry": ["sentry", "error", "exception", "bug", "crash", "log", "monitor"],
        "playwright": ["playwright", "e2e", "browser", "ui", "screenshot", "web",
                      "page", "click", "type", "automation", "test"],
        "security": ["security", "scan", "vuln", "vulnerability", "deps",
                    "dependencies", "secrets", "audit", "compliance", "check"],
        "docker": ["docker", "container", "image", "build", "run", "registry",
                  "cleanup", "logs", "scan"]
    }

    # Default action recommendations per provider (first action in allowlist)
    DEFAULT_ACTIONS = {
        "github": "list_issues",
        "context7": "search",
        "filesystem": "list_directory",
        "linear": "list_issues",
        "playwright": "navigate",
        "security": "scan_dependencies",
        "docker": "list_images"
    }

    # Action parameter templates
    ACTION_PARAM_TEMPLATES = {
        "list_issues": '{"limit":5}',
        "get_issue": '{"issue_number":1}',
        "list_prs": '{"limit":5}',
        "get_pr": '{"pr_number":1}',
        "get_checks": '{"ref":"main"}',
        "get_ci_status": '{"ref":"main"}',
        "search": '{"query":"test search"}',
        "get": '{"id":"test-id"}',
        "list": '{}',
        "navigate": '{"url":"https://example.com"}',
        "click": '{"selector":"button"}',
        "type_text": '{"selector":"input","text":"example"}',
        "take_screenshot": '{"selector":"body","path":"screenshot.png"}',
        "get_text": '{"selector":"h1"}',
        "wait_for_element": '{"selector":"h1","timeout":5000}',
        "execute_script": '{"script":"return document.title"}',
        "get_page_info": '{}',
        "scan_dependencies": '{"path":"."}',
        "scan_code": '{"path":"."}',
        "check_secrets": '{"path":"."}',
        "vulnerability_report": '{"path":"."}',
        "compliance_check": '{"path":"."}',
        "get_scan_results": '{"scan_id":"latest"}',
        "build_image": '{"dockerfile":"Dockerfile","tag":"myapp:latest"}',
        "run_container": '{"image":"nginx:latest","ports":{"80":"80"}}',
        "list_images": '{}',
        "scan_image": '{"image":"nginx:latest"}',
        "get_logs": '{"container_id":"container_id"}',
        "cleanup_images": '{"older_than_days":30}'
    }

    def __init__(self, mcp_bridge: Optional[MCPBridge] = None):
        self.mcp_bridge = mcp_bridge
        self.policy_engine = PolicyEngine()

    def suggest(self, task: str, readiness_status: str = "UNKNOWN") -> MCPSuggestion:
        """
        Generate structured MCP suggestions for a task.

        Args:
            task: Task description
            readiness_status: Overall readiness status from last check

        Returns:
            MCPSuggestion with all structured data
        """
        # 1. Risk tier classification
        risk_tier = self.policy_engine.classify_risk(task)
        risk_reason = self.policy_engine.get_classification_reason()

        # 2. Determine MCP appropriateness
        mcp_appropriate, mcp_reason = self._determine_mcp_appropriateness(task, risk_tier)

        # 3. MCP config status
        mcp_config_provided = self.mcp_bridge is not None
        mcp_enabled = mcp_config_provided and self.mcp_bridge.is_mcp_enabled()

        # 4. Provider suggestions
        provider_suggestions = self._get_provider_suggestions(task, risk_tier)

        # 5. Overall recommendation
        general_recommendation = self._generate_general_recommendation(
            task, risk_tier, mcp_appropriate, mcp_enabled, provider_suggestions, readiness_status
        )

        return MCPSuggestion(
            task=task,
            risk_tier=risk_tier,
            risk_reason=risk_reason,
            mcp_appropriate=mcp_appropriate,
            mcp_appropriate_reason=mcp_reason,
            mcp_config_provided=mcp_config_provided,
            mcp_enabled=mcp_enabled,
            readiness_status=readiness_status,
            provider_suggestions=provider_suggestions,
            general_recommendation=general_recommendation
        )

    def execute_auto_mcp_decision(self, task: str, readiness_status: str, mcp_bridge: MCPBridge) -> AutoMCPDecision:
        """
        Make autonomous MCP execution decision for GREEN-tier tasks.

        Args:
            task: Task description
            readiness_status: Overall readiness status from readiness check
            mcp_bridge: Configured MCP bridge instance

        Returns:
            AutoMCPDecision with execution decision and reasoning
        """
        # 1. Risk tier classification
        risk_tier = self.policy_engine.classify_risk(task)
        risk_reason = self.policy_engine.get_classification_reason()

        # 2. Block unsafe tiers for autonomous execution
        if risk_tier in [RiskTier.RED, RiskTier.YELLOW]:
            return AutoMCPDecision(
                decision="block_unsafe",
                reasoning={
                    "risk_tier": risk_tier.value,
                    "risk_reason": risk_reason,
                    "readiness_status": readiness_status,
                    "mcp_appropriate": False,
                    "reason": f"AUTO-MCP BLOCKED: {risk_tier.value} tier tasks require human review"
                },
                provider_action=None,
                params={},
                budget_required={"calls": 0, "seconds": 0}
            )

        # 3. Determine MCP appropriateness
        mcp_appropriate, mcp_reason = self._determine_mcp_appropriateness(task, risk_tier)

        # 4. If not appropriate, consider local tools
        if mcp_appropriate != MCPAppropriateness.APPROPRIATE:
            # Check if local tools are available
            local_tools_available = self._check_local_tools_availability(task)
            if local_tools_available:
                return AutoMCPDecision(
                    decision="use_local_tools",
                    reasoning={
                        "risk_tier": risk_tier.value,
                        "risk_reason": risk_reason,
                        "readiness_status": readiness_status,
                        "mcp_appropriate": False,
                        "mcp_appropriate_reason": mcp_reason,
                        "local_tools_available": True,
                        "reason": "Local tools available and MCP not appropriate"
                    },
                    provider_action=None,
                    params={},
                    budget_required={"calls": 0, "seconds": 0}
                )
            elif mcp_appropriate == MCPAppropriateness.NOT_APPROPRIATE:
                return AutoMCPDecision(
                    decision="block_safe",
                    reasoning={
                        "risk_tier": risk_tier.value,
                        "risk_reason": risk_reason,
                        "readiness_status": readiness_status,
                        "mcp_appropriate": False,
                        "mcp_appropriate_reason": mcp_reason,
                        "local_tools_available": False,
                        "reason": "MCP not appropriate and no local tools available"
                    },
                    provider_action=None,
                    params={},
                    budget_required={"calls": 0, "seconds": 0}
                )

        # 5. Check readiness for RED status (block execution)
        if readiness_status == "RED":
            return AutoMCPDecision(
                decision="block_unsafe",
                reasoning={
                    "risk_tier": risk_tier.value,
                    "risk_reason": risk_reason,
                    "readiness_status": readiness_status,
                    "mcp_appropriate": True,
                    "reason": "AUTO-MCP BLOCKED: Readiness RED prevents autonomous execution"
                },
                provider_action=None,
                params={},
                budget_required={"calls": 0, "seconds": 0}
            )

        # 6. Generate provider suggestions
        provider_suggestions = self._get_provider_suggestions(task, risk_tier)

        # 7. Select first matching provider/action if available
        if not provider_suggestions:
            return AutoMCPDecision(
                decision="block_safe",
                reasoning={
                    "risk_tier": risk_tier.value,
                    "risk_reason": risk_reason,
                    "readiness_status": readiness_status,
                    "mcp_appropriate": True,
                    "mcp_appropriate_reason": mcp_reason,
                    "reason": "No suitable MCP providers found for task"
                },
                provider_action=None,
                params={},
                budget_required={"calls": 0, "seconds": 0}
            )

        # Select first provider suggestion
        selected_provider = provider_suggestions[0]
        provider_name = selected_provider.provider_name
        
        # Select first allowed action for this provider
        action_name = selected_provider.allowed_actions[0] if selected_provider.allowed_actions else None
        
        if not action_name:
            return AutoMCPDecision(
                decision="block_safe",
                reasoning={
                    "risk_tier": risk_tier.value,
                    "risk_reason": risk_reason,
                    "readiness_status": readiness_status,
                    "mcp_appropriate": True,
                    "mcp_appropriate_reason": mcp_reason,
                    "selected_provider": provider_name,
                    "reason": f"No allowed actions for provider {provider_name}"
                },
                provider_action=None,
                params={},
                budget_required={"calls": 0, "seconds": 0}
            )

        # 8. Check if action is allowlisted
        if not mcp_bridge.is_action_allowed(provider_name, action_name):
            return AutoMCPDecision(
                decision="block_safe",
                reasoning={
                    "risk_tier": risk_tier.value,
                    "risk_reason": risk_reason,
                    "readiness_status": readiness_status,
                    "mcp_appropriate": True,
                    "mcp_appropriate_reason": mcp_reason,
                    "selected_provider": provider_name,
                    "selected_action": action_name,
                    "reason": f"Action {action_name} not allowlisted for provider {provider_name}"
                },
                provider_action=None,
                params={},
                budget_required={"calls": 0, "seconds": 0}
            )

        # 9. Generate parameters for the action
        params = self._generate_action_parameters(action_name)

        # 10. Check local tools availability for explainability
        local_tools_available = self._check_local_tools_availability(task)
        local_tool_name = self._get_relevant_local_tool(task)

        # 11. Create final decision
        reasoning = {
            "risk_tier": risk_tier.value,
            "risk_reason": risk_reason,
            "readiness_status": readiness_status,
            "mcp_appropriate": True,
            "mcp_appropriate_reason": mcp_reason,
            "provider_selected": provider_name,
            "action_selected": action_name,
            "allowlisted": True,
            "local_tools_available": local_tools_available,
            "local_tool_name": local_tool_name,
            "reason": "GREEN tier task with appropriate MCP provider and allowlisted action"
        }

        return AutoMCPDecision(
            decision="execute_mcp",
            reasoning=reasoning,
            provider_action=(provider_name, action_name),
            params=params,
            budget_required={"calls": 1, "seconds": 10}  # Estimate 10 seconds per call
        )

    def _determine_mcp_appropriateness(self, task: str, risk_tier: RiskTier) -> Tuple[MCPAppropriateness, str]:
        """
        Determine if MCP is appropriate for the task.
        """
        task_lower = task.lower()

        # Red-tier tasks require HITL, no MCP
        if risk_tier == RiskTier.RED:
            return MCPAppropriateness.NOT_APPROPRIATE, "Red-tier tasks require human-in-the-loop (HITL)"

        # Check if task matches any provider keywords
        matches = []
        for provider, keywords in self.PROVIDER_KEYWORDS.items():
            if any(keyword in task_lower for keyword in keywords):
                matches.append(provider)

        if matches:
            return MCPAppropriateness.APPROPRIATE, f"Task matches provider(s): {', '.join(matches)}"
        else:
            return MCPAppropriateness.MAYBE_APPROPRIATE, "Task does not strongly match any provider keywords"

    def _get_provider_suggestions(self, task: str, risk_tier: RiskTier) -> List[ProviderSuggestion]:
        """
        Generate provider-specific suggestions.
        Only includes providers that are enabled and have allowlisted actions.
        """
        suggestions = []
        if not self.mcp_bridge or not self.mcp_bridge.is_mcp_enabled():
            return suggestions

        task_lower = task.lower()
        enabled_providers = self.mcp_bridge.get_enabled_providers()

        # Check each provider for keyword matches
        for provider_name in enabled_providers:
            keywords = self.PROVIDER_KEYWORDS.get(provider_name, [])
            matched_keywords = [kw for kw in keywords if kw in task_lower]
            
            if not matched_keywords:
                continue

            # Get allowed actions for this provider
            allowed_actions = self.mcp_bridge.get_allowed_actions(provider_name)
            if not allowed_actions:
                continue

            # Get required environment variables
            required_env_vars = self.mcp_bridge.get_required_env_vars(provider_name)

            # Generate command snippet using first allowed action as example
            if allowed_actions:
                example_action = allowed_actions[0]
                command_snippet = self._generate_command_snippet(provider_name, example_action)
                
                suggestion = ProviderSuggestion(
                    provider_name=provider_name,
                    reason=f"Task contains keywords: {', '.join(matched_keywords[:3])}",
                    allowed_actions=allowed_actions,
                    required_env_vars=required_env_vars,
                    command_snippet=command_snippet
                )
                suggestions.append(suggestion)

        return suggestions

    def _generate_command_snippet(self, provider: str, action: str) -> str:
        """
        Generate an exact command snippet for copy/paste.
        """
        # Get config path
        config_path = self.mcp_bridge.config_path if self.mcp_bridge else "mcp_config.json"
        
        # Get parameters template
        params = self.ACTION_PARAM_TEMPLATES.get(action, '{}')
        
        # Build env vars prefix
        env_vars = []
        if self.mcp_bridge and provider in self.mcp_bridge.provider_required_env:
            env_vars = self.mcp_bridge.provider_required_env[provider]
        
        env_prefix = ""
        if env_vars:
            env_prefix = f"{' '.join([f'{var}=...' for var in env_vars])} "
        
        # Example task description
        example_task = f"Using {provider} {action}"
        
        return f"{env_prefix}python3 agent_runtime/agno/main.py --mcp-config {config_path} --mcp-call {provider} {action} '{params}' \"{example_task}\""

    def _generate_action_parameters(self, action: str) -> Dict[str, Any]:
        """
        Generate appropriate parameters for an action based on templates.
        """
        # Use existing parameter templates
        params_json = self.ACTION_PARAM_TEMPLATES.get(action, '{}')
        try:
            import json
            return json.loads(params_json)
        except:
            return {}

    def _check_local_tools_availability(self, task: str) -> bool:
        """
        Check if relevant local tools are available for a task.
        """
        # Simple check for now - in a real implementation, this would check actual binaries
        task_lower = task.lower()
        
        # Common local tools that might do similar things
        local_tools = {
            'github': ['gh', 'git'],
            'context7': ['grep', 'rg', 'find'],
            'playwright': ['npm', 'npx'],
            'security': ['npm', 'npx'],
            'docker': ['docker']
        }
        
        # Determine relevant tools based on task keywords
        for provider, tools in local_tools.items():
            if provider in task_lower:
                # In a real implementation, we would check if tools exist on PATH
                # For now, we'll just return True if the provider is mentioned
                return True
        
        return False

    def _get_relevant_local_tool(self, task: str) -> Optional[str]:
        """
        Get the name of the most relevant local tool for a task.
        """
        task_lower = task.lower()

        # Common local tools that might do similar things
        if 'github' in task_lower or 'issue' in task_lower or 'pr' in task_lower:
            return 'gh'
        elif 'context' in task_lower or 'context7' in task_lower or 'docs' in task_lower:
            return 'rg'
        elif 'playwright' in task_lower or 'browser' in task_lower:
            return 'npx playwright'
        elif 'security' in task_lower or 'scan' in task_lower:
            return 'npm audit'
        elif 'docker' in task_lower or 'container' in task_lower:
            return 'docker'

        return None

    def _generate_general_recommendation(self, task: str, risk_tier: RiskTier, 
                                        mcp_appropriate: MCPAppropriateness, 
                                        mcp_enabled: bool,
                                        provider_suggestions: List[ProviderSuggestion],
                                        readiness_status: str) -> str:
        """
        Generate overall recommendation text.
        """
        lines = []

        # Risk tier warning
        if risk_tier == RiskTier.RED:
            lines.append("⚠️  HITL REQUIRED: Red-tier tasks require human-in-the-loop approval")
            lines.append("   No MCP actions should be executed without explicit human approval")
            return "\n".join(lines)

        # Readiness warning
        if readiness_status == "RED":
            lines.append("⚠️  EXECUTION BLOCKED: Readiness is RED")
            lines.append("   Suggestions are informational only - execution would be blocked until readiness is GREEN/YELLOW")
        elif readiness_status == "YELLOW":
            lines.append("⚠️  LIMITED CAPABILITY: Readiness is YELLOW")
            lines.append("   Some MCP providers may be unavailable due to missing configuration")

        # MCP appropriateness
        if mcp_appropriate == MCPAppropriateness.NOT_APPROPRIATE:
            lines.append("❌ MCP NOT APPROPRIATE: This task does not require MCP")
            lines.append("   Consider using local tools instead")
        elif mcp_appropriate == MCPAppropriateness.MAYBE_APPROPRIATE:
            lines.append("🤔 MCP MAY BE APPROPRIATE: Task does not strongly match provider keywords")
            lines.append("   Consider reviewing the task description for better keyword matching")
        else:
            lines.append("✅ MCP APPROPRIATE: Task matches provider keywords")

        # MCP enabled status
        if not mcp_enabled:
            lines.append("⚠️  MCP NOT ENABLED: No MCP configuration provided or MCP disabled in config")
            lines.append("   Use --mcp-config <file> to enable MCP providers")
        elif not provider_suggestions:
            lines.append("⚠️  NO PROVIDER SUGGESTIONS: Task matches providers but no allowlisted actions available")
            lines.append("   Check MCP configuration allowlists or provider readiness")
        else:
            lines.append("✅ PROVIDERS AVAILABLE: Suggestions below include enabled providers with allowlisted actions")

        # Next steps
        if provider_suggestions:
            lines.append("\nNEXT STEPS:")
            lines.append("1. Set required environment variables")
            lines.append("2. Copy/paste the command snippets below")
            lines.append("3. Run with --mcp-call to execute the suggested actions")

        return "\n".join(lines)


def format_suggestion_for_cli(suggestion: MCPSuggestion) -> str:
    """
    Format an MCPSuggestion for CLI output.
    """
    lines = []
    
    # Header
    lines.append("=" * 60)
    lines.append("MCP SUGGESTION REPORT (Phase 5C)")
    lines.append("=" * 60)
    
    # Task
    lines.append(f"Task: {suggestion.task}")
    lines.append("")
    
    # Risk tier
    lines.append(f"1) Risk Tier: {suggestion.risk_tier.value}")
    lines.append(f"   Reason: {suggestion.risk_reason}")
    lines.append("")
    
    # MCP appropriateness
    lines.append(f"2) MCP Appropriate: {suggestion.mcp_appropriate.value}")
    lines.append(f"   Reason: {suggestion.mcp_appropriate_reason}")
    lines.append("")
    
    # MCP status
    lines.append(f"3) MCP Configuration: {'Provided' if suggestion.mcp_config_provided else 'Not provided'}")
    lines.append(f"   MCP Enabled: {'Yes' if suggestion.mcp_enabled else 'No'}")
    lines.append(f"   Readiness Status: {suggestion.readiness_status}")
    lines.append("")
    
    # Provider suggestions
    if suggestion.provider_suggestions:
        lines.append("4) Recommended Providers/Actions:")
        for i, ps in enumerate(suggestion.provider_suggestions, 1):
            lines.append(f"   {i}. Provider: {ps.provider_name}")
            lines.append(f"      Reason: {ps.reason}")
            lines.append(f"      Allowed Actions: {', '.join(ps.allowed_actions[:3])}")
            if len(ps.allowed_actions) > 3:
                lines.append(f"      ... and {len(ps.allowed_actions) - 3} more")
            lines.append(f"      Required Env Vars: {', '.join(ps.required_env_vars) if ps.required_env_vars else 'None'}")
            lines.append(f"      Command Snippet:")
            lines.append(f"        {ps.command_snippet}")
            lines.append("")
    else:
        lines.append("4) No provider suggestions generated.")
        lines.append("")
    
    # General recommendation
    lines.append("5) General Recommendation:")
    for line in suggestion.general_recommendation.split('\n'):
        lines.append(f"   {line}")
    
    lines.append("=" * 60)
    
    return "\n".join(lines)
