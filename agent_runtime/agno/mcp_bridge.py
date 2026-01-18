"""
MCP Bridge - Policy-Governed Tool Access

Provides policy enforcement for MCP (Model Context Protocol) tool access.
Validates permissions against risk tiers, roles, and configuration allowlists.
No network calls - pure policy checking and configuration validation.
"""

import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.github_provider import GitHubMCPProvider

class MCPBridge:
    """
    MCP Bridge for policy-governed tool access.

    Loads and validates MCP configuration, checks permissions against policies,
    and provides allowlist verification for MCP tool usage.
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize MCP Bridge.

        Args:
            config_path: Path to MCP configuration file (optional)
        """
        self.config = {}
        self.config_path = config_path
        self.is_loaded = False
        self.load_errors: List[str] = []

        self.provider_registry = {
            'github': GitHubMCPProvider,
        }

        self.provider_instances: Dict[str, Any] = {}

        self.provider_required_env = {
            'github': ['GITHUB_TOKEN'],
            'playwright': [],
            'security': [],
            'docker': [],
        }

        # Provider action mappings from providers.md
        self.provider_actions = {
            'github': [
                'list_issues', 'get_issue', 'list_prs',
                'get_pr', 'get_checks', 'get_ci_status'
            ],
            'playwright': [
                'navigate', 'click', 'type_text', 'take_screenshot',
                'get_text', 'wait_for_element', 'execute_script', 'get_page_info'
            ],
            'security': [
                'scan_dependencies', 'scan_code', 'check_secrets',
                'vulnerability_report', 'compliance_check', 'get_scan_results'
            ],
            'docker': [
                'build_image', 'run_container', 'list_images', 'scan_image',
                'get_logs', 'cleanup_images'
            ]
        }

        if config_path:
            self.load_config(config_path)

    def load_config(self, config_path: str) -> bool:
        """
        Load and validate MCP configuration.

        Args:
            config_path: Path to configuration file

        Returns:
            True if configuration loaded successfully, False otherwise
        """
        self.load_errors = []

        try:
            config_file = Path(config_path)
            if not config_file.exists():
                self.load_errors.append(f"Configuration file not found: {config_path}")
                return False

            with open(config_file, 'r', encoding='utf-8') as f:
                self.config = json.load(f)

            # Validate configuration structure
            if not self._validate_config():
                return False

            self.is_loaded = True
            self.config_path = config_path
            return True

        except json.JSONDecodeError as e:
            self.load_errors.append(f"Invalid JSON in config file: {e}")
            return False
        except Exception as e:
            self.load_errors.append(f"Error loading config: {e}")
            return False

    def _validate_config(self) -> bool:
        """Validate configuration structure and required fields."""
        if 'enabled' not in self.config:
            self.load_errors.append("Missing 'enabled' field in config")
            return False

        if not isinstance(self.config.get('enabled'), bool):
            self.load_errors.append("'enabled' must be a boolean")
            return False

        # If MCP is disabled, minimal validation
        if not self.config['enabled']:
            return True

        # Validate providers section
        if 'providers' not in self.config:
            self.load_errors.append("Missing 'providers' section in config")
            return False

        providers = self.config['providers']
        if not isinstance(providers, dict):
            self.load_errors.append("'providers' must be an object")
            return False

        # Validate each provider
        for provider_name, provider_config in providers.items():
            if not self._validate_provider(provider_name, provider_config):
                return False

        return True

    def _validate_provider(self, name: str, config: Dict[str, Any]) -> bool:
        """Validate individual provider configuration."""
        if name not in self.provider_actions:
            self.load_errors.append(f"Unknown provider: {name}")
            return False

        if not isinstance(config, dict):
            self.load_errors.append(f"Provider {name} config must be an object")
            return False

        if 'enabled' not in config:
            self.load_errors.append(f"Provider {name} missing 'enabled' field")
            return False

        if not isinstance(config['enabled'], bool):
            self.load_errors.append(f"Provider {name} 'enabled' must be boolean")
            return False

        # If provider is disabled, skip further validation
        if not config['enabled']:
            return True

        # Validate actions allowlist
        if 'actions' not in config:
            self.load_errors.append(f"Provider {name} missing 'actions' allowlist")
            return False

        actions = config['actions']
        if not isinstance(actions, list):
            self.load_errors.append(f"Provider {name} 'actions' must be a list")
            return False

        # Check all actions are valid for this provider
        valid_actions = self.provider_actions[name]
        for action in actions:
            if action not in valid_actions:
                self.load_errors.append(f"Provider {name}: invalid action '{action}'")
                return False

        # Validate command field shape (argv list). Empty list allowed to enable graceful runtime error.
        if 'command' not in config:
            self.load_errors.append(f"Provider {name} missing 'command' field")
            return False
        command = config.get('command')
        if not isinstance(command, list):
            self.load_errors.append(f"Provider {name} 'command' must be an array (argv style)")
            return False

        # If command provided, validate first argv is resolvable (absolute path or on PATH)
        if command:
            if not self._is_command_available(command[0]):
                self.load_errors.append(f"Provider {name} command not found: {command[0]}")
                return False

        return True

    def is_mcp_enabled(self) -> bool:
        """Check if MCP is enabled globally."""
        return self.is_loaded and self.config.get('enabled', False)

    def is_provider_enabled(self, provider: str) -> bool:
        """Check if a specific provider is enabled."""
        if not self.is_mcp_enabled():
            return False

        providers = self.config.get('providers', {})
        provider_config = providers.get(provider, {})
        return provider_config.get('enabled', False)

    def is_action_allowed(self, provider: str, action: str) -> bool:
        """Check if a specific action is allowed for a provider."""
        if not self.is_provider_enabled(provider):
            return False

        providers = self.config.get('providers', {})
        provider_config = providers.get(provider, {})
        allowed_actions = provider_config.get('actions', [])

        return action in allowed_actions

    def check_mcp_permissions(self, provider: str, action: str, risk_tier: str, role: str) -> Dict[str, Any]:
        """
        Comprehensive permission check for MCP tool usage.

        Args:
            provider: MCP provider name
            action: Action to check
            risk_tier: Current risk tier (GREEN/YELLOW/RED)
            role: Agent role (Planner/Implementer/Auditor)

        Returns:
            Dictionary with permission result and reasoning
        """
        result = {
            'allowed': False,
            'reason': '',
            'checks': {
                'mcp_enabled': self.is_mcp_enabled(),
                'provider_enabled': self.is_provider_enabled(provider),
                'action_allowed': self.is_action_allowed(provider, action),
                'risk_tier_allowed': self._check_risk_tier(risk_tier),
                'role_allowed': self._check_role(provider, action, role)
            }
        }

        # Check all conditions
        checks = result['checks']

        if not checks['mcp_enabled']:
            result['reason'] = 'MCP integration not enabled'
        elif not checks['provider_enabled']:
            result['reason'] = f'Provider {provider} not enabled'
        elif not checks['action_allowed']:
            result['reason'] = f'Action {action} not allowlisted for provider {provider}'
        elif not checks['risk_tier_allowed']:
            result['reason'] = f'Risk tier {risk_tier} not allowed for MCP operations'
        elif not checks['role_allowed']:
            result['reason'] = f'Role {role} not allowed for {provider}:{action}'
        else:
            result['allowed'] = True
            result['reason'] = 'All permission checks passed'

        return result

    def _check_risk_tier(self, risk_tier: str) -> bool:
        """Check if risk tier allows MCP usage."""
        # Phase 4B: Allow GREEN; YELLOW with confirmation at caller
        tier = risk_tier.upper()
        if tier == 'RED':
            return False
        return tier in ['GREEN', 'YELLOW']

    def _check_role(self, provider: str, action: str, role: str) -> bool:
        """Check if role is allowed for specific provider/action."""
        role_upper = role.upper()

        # Provider-specific role restrictions from providers.md
        provider_role_rules = {
            'github': ['PLANNER', 'IMPLEMENTER', 'AUDITOR'],  # All roles
            'playwright': ['IMPLEMENTER', 'AUDITOR'],  # No Planner
            'security': ['PLANNER', 'AUDITOR'],  # No Implementer
            'docker': ['IMPLEMENTER', 'AUDITOR']  # No Planner
        }

        allowed_roles = provider_role_rules.get(provider, [])
        return role_upper in allowed_roles

    def _get_provider_instance(self, provider: str) -> Optional[Any]:
        """Instantiate and cache provider adapters."""
        if provider in self.provider_instances:
            return self.provider_instances[provider]

        factory = self.provider_registry.get(provider)
        if not factory:
            return None

        provider_config = (self.config.get('providers', {}) if self.config else {}).get(provider, {})
        instance = factory(provider_config)
        self.provider_instances[provider] = instance
        return instance

    def _is_command_available(self, cmd: str) -> bool:
        if not cmd:
            return False
        path = Path(cmd)
        if path.is_absolute():
            return path.exists()
        return shutil.which(cmd) is not None

    def route_call(self, provider: str, action: str, params: Dict[str, Any], risk_tier: str, role: str) -> Dict[str, Any]:
        """Route a validated MCP call to the correct provider."""
        permission = self.check_mcp_permissions(provider, action, risk_tier, role)
        meta = {"checks": permission.get("checks", {})}

        if not permission.get('allowed'):
            return {
                "ok": False,
                "data": None,
                "error": permission.get('reason', 'Permission denied'),
                "meta": meta
            }

        provider_config = (self.config.get('providers', {}) if self.config else {}).get(provider, {})
        command = provider_config.get('command') if isinstance(provider_config.get('command'), list) else []

        if not command:
            meta["command_available"] = False
            return {
                "ok": False,
                "data": None,
                "error": f"No command configured for provider {provider}",
                "meta": meta,
            }

        if not self._is_command_available(command[0]):
            meta["command_available"] = False
            return {
                "ok": False,
                "data": None,
                "error": f"Provider {provider} command not found: {command[0]}",
                "meta": meta,
            }

        required_env = self.provider_required_env.get(provider, [])
        missing_env = [env for env in required_env if not os.environ.get(env)]
        if missing_env:
            meta["missing_env"] = missing_env
            return {
                "ok": False,
                "data": None,
                "error": f"Missing required environment variables: {', '.join(missing_env)}",
                "meta": meta,
            }

        provider_instance = self._get_provider_instance(provider)
        if not provider_instance:
            meta["provider_instance"] = "unavailable"
            return {
                "ok": False,
                "data": None,
                "error": f"Provider {provider} not available",
                "meta": meta,
            }

        result = provider_instance.call(action, params or {})
        result.setdefault("meta", {}).setdefault("checks", permission.get("checks", {}))
        return result

    def get_enabled_providers(self) -> List[str]:
        """Get list of enabled provider names."""
        if not self.is_mcp_enabled():
            return []

        providers = self.config.get('providers', {})
        return [name for name, config in providers.items()
                if config.get('enabled', False)]

    def get_allowed_actions(self, provider: str) -> List[str]:
        """Get list of allowed actions for a provider."""
        if not self.is_provider_enabled(provider):
            return []

        providers = self.config.get('providers', {})
        provider_config = providers.get(provider, {})
        return provider_config.get('actions', [])

    def get_required_env_vars(self, provider: str) -> List[str]:
        """Get required environment variables for a provider."""
        return self.provider_required_env.get(provider, [])

    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration (safe for logging)."""
        if not self.is_loaded:
            return {'status': 'not_loaded'}

        summary = {
            'status': 'loaded',
            'mcp_enabled': self.is_mcp_enabled(),
            'config_path': self.config_path,
            'providers_enabled': self.get_enabled_providers(),
            'load_errors': self.load_errors
        }

        # Add provider details (without sensitive info)
        if self.is_mcp_enabled():
            summary['providers_detail'] = {}
            for provider in self.get_enabled_providers():
                summary['providers_detail'][provider] = {
                    'actions_allowed': len(self.get_allowed_actions(provider))
                }

        return summary

# Convenience functions
def create_mcp_bridge(config_path: Optional[str] = None) -> MCPBridge:
    """Create and return a configured MCP Bridge instance."""
    return MCPBridge(config_path)

def check_mcp_permissions(bridge: MCPBridge, provider: str, action: str,
                         risk_tier: str, role: str) -> bool:
    """Convenience function to check MCP permissions."""
    result = bridge.check_mcp_permissions(provider, action, risk_tier, role)
    return result['allowed']