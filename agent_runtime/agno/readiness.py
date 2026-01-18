"""
Readiness Checker for Agent Runtime - Phase 4D

Verifies that ContextStream, MCP, and configured providers are actually usable.
Logs evidence to agent_runtime/evidence/ and updates STATE.json with readiness summary.
"""

import json
import os
import shutil
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path
import uuid

# Provider specs for required environment variables
PROVIDER_REQUIRED_ENV = {
    'github': ['GITHUB_TOKEN'],
    'playwright': [],
    'security': [],
    'docker': [],
}

CONTEXTSTREAM_ENV_VARS = ['CONTEXTSTREAM_URL', 'CONTEXTSTREAM_API_KEY']

def collect_readiness(mcp_bridge=None, contextstream_client=None, env=os.environ) -> Dict[str, Any]:
    """
    Check whether ContextStream + MCP + any configured providers are actually usable.
    
    Args:
        mcp_bridge: Initialized MCPBridge instance (optional)
        contextstream_client: Initialized ContextStreamClient instance (optional)
        env: Environment variables dict (defaults to os.environ)
        
    Returns:
        Dictionary with readiness status and details:
        - overall_status: GREEN/YELLOW/RED
        - checks: list of {name, status, detail, remediation}
        - capabilities: {mcp:{enabled,providers}, contextstream:{enabled,configured}, memory_write:{enabled}}
        - missing_env: list of missing environment variables
        - timestamp: ISO timestamp of check
    """
    checks = []
    missing_env_vars = []
    capabilities = {
        "mcp": {
            "enabled": False,
            "providers": []
        },
        "contextstream": {
            "enabled": False,
            "configured": False
        },
        "memory_write": {
            "enabled": False
        }
    }
    
    # Check MCP global configuration
    if mcp_bridge is not None:
        if mcp_bridge.is_loaded:
            if mcp_bridge.is_mcp_enabled():
                capabilities["mcp"]["enabled"] = True
                capabilities["mcp"]["providers"] = mcp_bridge.get_enabled_providers()
                
                checks.append({
                    "name": "MCP Configuration",
                    "status": "GREEN",
                    "detail": f"MCP enabled with {len(capabilities['mcp']['providers'])} providers",
                    "remediation": None
                })
                
                # Per-provider checks
                for provider_name in capabilities["mcp"]["providers"]:
                    # Check command exists
                    provider_config = mcp_bridge.config.get('providers', {}).get(provider_name, {})
                    command = provider_config.get('command', [])
                    
                    if command:
                        cmd_path = command[0]
                        if Path(cmd_path).is_absolute() and Path(cmd_path).exists():
                            command_status = "GREEN"
                            command_detail = f"Command exists: {cmd_path}"
                            command_remediation = None
                        elif shutil.which(cmd_path):
                            command_status = "GREEN"
                            command_detail = f"Command found on PATH: {cmd_path}"
                            command_remediation = None
                        else:
                            command_status = "RED"
                            command_detail = f"Command not found: {cmd_path}"
                            command_remediation = f"Install {cmd_path} or update MCP config with correct path"
                    else:
                        command_status = "YELLOW"
                        command_detail = f"No command specified for provider {provider_name}"
                        command_remediation = f"Add command to MCP config for {provider_name}"
                        
                    checks.append({
                        "name": f"MCP Provider {provider_name} Command",
                        "status": command_status,
                        "detail": command_detail,
                        "remediation": command_remediation
                    })
                    
                    # Check required environment variables
                    required_env = PROVIDER_REQUIRED_ENV.get(provider_name, [])
                    missing_env = []
                    
                    for env_var in required_env:
                        if not env.get(env_var):
                            missing_env.append(env_var)
                            missing_env_vars.append(env_var)
                            
                    if missing_env:
                        checks.append({
                            "name": f"MCP Provider {provider_name} Environment",
                            "status": "RED",
                            "detail": f"Missing required environment variables: {', '.join(missing_env)}",
                            "remediation": f"Set environment variables: {', '.join(missing_env)}"
                        })
                    else:
                        checks.append({
                            "name": f"MCP Provider {provider_name} Environment",
                            "status": "GREEN",
                            "detail": "All required environment variables present",
                            "remediation": None
                        })
            else:
                checks.append({
                    "name": "MCP Configuration",
                    "status": "YELLOW",
                    "detail": "MCP disabled by design",
                    "remediation": None
                })
        else:
            checks.append({
                "name": "MCP Configuration",
                "status": "RED",
                "detail": f"MCP configuration failed to load: {', '.join(mcp_bridge.load_errors)}",
                "remediation": "Fix MCP configuration file errors"
            })
    else:
        checks.append({
            "name": "MCP Configuration",
            "status": "YELLOW",
            "detail": "MCP not configured",
            "remediation": None
        })
    
    # Check ContextStream
    if contextstream_client is not None:
        capabilities["contextstream"]["enabled"] = True
        capabilities["contextstream"]["configured"] = contextstream_client.is_configured
        
        if contextstream_client.is_configured:
            # Try to import requests
            try:
                import requests
                requests_available = True
            except ImportError:
                requests_available = False
                
            if requests_available:
                checks.append({
                    "name": "ContextStream",
                    "status": "GREEN",
                    "detail": "ContextStream configured and requests library available",
                    "remediation": None
                })
            else:
                checks.append({
                    "name": "ContextStream",
                    "status": "YELLOW",
                    "detail": "ContextStream configured but requests library missing",
                    "remediation": "Install requests: pip install requests"
                })
        else:
            checks.append({
                "name": "ContextStream",
                "status": "YELLOW",
                "detail": "ContextStream not configured",
                "remediation": "Set CONTEXTSTREAM_URL and CONTEXTSTREAM_API_KEY environment variables"
            })
    else:
        checks.append({
            "name": "ContextStream",
            "status": "YELLOW",
            "detail": "ContextStream not enabled",
            "remediation": None
        })
    
    # Check Memory Directory Writable
    memory_dir = Path("agent_runtime/memory")
    memory_writable = False
    
    try:
        # Test write by creating a temp file
        test_file = memory_dir / f".writable_test_{uuid.uuid4().hex}"
        test_file.touch()
        test_file.unlink()
        memory_writable = True
    except OSError:
        memory_writable = False
    
    if memory_writable:
        checks.append({
            "name": "Memory Directory Writable",
            "status": "GREEN",
            "detail": f"Memory directory writable: {memory_dir}",
            "remediation": None
        })
        capabilities["memory_write"]["enabled"] = True
    else:
        checks.append({
            "name": "Memory Directory Writable",
            "status": "RED",
            "detail": f"Memory directory not writable: {memory_dir}",
            "remediation": "Ensure agent_runtime/memory/ exists and has write permissions (chmod 700)"
        })
        capabilities["memory_write"]["enabled"] = False
    
    # Determine overall status
    # RED if any check is RED
    # YELLOW if no RED but some YELLOW
    # GREEN if all GREEN
    if any(check["status"] == "RED" for check in checks):
        overall_status = "RED"
    elif any(check["status"] == "YELLOW" for check in checks):
        overall_status = "YELLOW"
    else:
        overall_status = "GREEN"
    
    return {
        "overall_status": overall_status,
        "checks": checks,
        "capabilities": capabilities,
        "missing_env": list(set(missing_env_vars)),  # Deduplicate
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }
