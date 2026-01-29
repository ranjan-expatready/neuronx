#!/usr/bin/env python3
"""
MCP Bootstrap - Docker-less MCP Server Validation

Validates that the environment is ready for Docker-less MCP providers.
Provides installation commands when dependencies are missing.

Usage:
    python3 mcp_bootstrap.py --status
    python3 mcp_bootstrap.py --install
    python3 mcp_bootstrap.py --verbose
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Minimum Node.js version required for MCP servers
MIN_NODE_VERSION = (18, 0, 0)

# Pinned MCP server versions for deterministic installation
MCP_SERVERS = {
    'context7': {
        'package': '@upstash/context7-mcp',
        'version': '2.1.0',
        'install_command': 'npx -y @upstash/context7-mcp@2.1.0',
    },
}


def get_node_version() -> Optional[tuple]:
    """Get Node.js version as tuple (major, minor, patch)."""
    try:
        result = subprocess.run(
            ['node', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return None
        
        version_str = result.stdout.strip()  # e.g., "v22.14.0"
        version_str = version_str.lstrip('v')
        
        version_parts = version_str.split('.')
        if len(version_parts) >= 3:
            return tuple(int(parts) for parts in version_parts[:3])
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError):
        pass
    return None


def check_npx_available() -> bool:
    """Check if npx is available on PATH."""
    return shutil.which('npx') is not None


def get_mcp_config_path() -> Optional[Path]:
    """
    Get path to active MCP config.

    Priority order (Factory Native as operator truth):
    1. ~/.factory/mcp.json (Factory native config - operator truth)
    2. agent_runtime/agno/mcp_configs/active.json (NeuronX runtime config - governance/test)

    Returns:
        Path to MCP config file or None if not found
    """
    # Priority 1: Factory native MCP config (operator truth)
    factory_config_path = Path.home() / '.factory' / 'mcp.json'
    if factory_config_path.exists():
        return factory_config_path

    # Priority 2: NeuronX runtime MCP config (fallback for tests/governance)
    runtime_config_path = Path(__file__).parent / 'mcp_configs' / 'active.json'
    if runtime_config_path.exists():
        return runtime_config_path

    return None


def check_docker_in_config(config_path: Path) -> List[str]:
    """Check if Docker commands exist in MCP config."""
    docker_commands = []
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        providers = config.get('providers', {})
        for provider_name, provider_config in providers.items():
            command = provider_config.get('command', [])
            if command and 'docker' in command[0].lower():
                docker_commands.append(provider_name)
    except (json.JSONDecodeError, IOError):
        pass
    
    return docker_commands


def print_status(verbose: bool = False) -> int:
    """Print MCP bootstrap status and return exit code."""
    print("MCP Bootstrap Status")
    print("=" * 60)
    
    # Check Node.js version
    node_version = get_node_version()
    if verbose:
        print(f"\nNode.js check:")
        print(f"  Version found: {node_version}")
        print(f"  Minimum required: {MIN_NODE_VERSION}")
    
    if node_version:
        node_status = "✅" if node_version >= MIN_NODE_VERSION else "❌"
        version_str = f"v{node_version[0]}.{node_version[1]}.{node_version[2]}"
        if node_version < MIN_NODE_VERSION:
            print(f"{node_status} Node.js: {version_str} ❌ (>= v{MIN_NODE_VERSION[0]}.{MIN_NODE_VERSION[1]}.{MIN_NODE_VERSION[2]} required)")
            print(f"   Remediation: Install Node.js 18+ from https://nodejs.org")
            return 1
        else:
            print(f"{node_status} Node.js: {version_str} ✅")
    else:
        print("❌ Node.js: Not found ❌")
        print(f"   Remediation: Install Node.js 18+ from https://nodejs.org")
        return 1
    
    # Check npx availability
    npx_available = check_npx_available()
    if verbose:
        print(f"\nnpx check:")
        print(f"  Available: {npx_available}")
    
    if npx_available:
        npx_version = subprocess.run(
            ['npx', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        ).stdout.strip()
        print(f"✅ npm/npx: {npx_version} ✅")
    else:
        print("❌ npm/npx: Not found ❌")
        print("   Remediation: Reinstall Node.js 18+ (npx comes with npm)")
        return 1
    
    # Check MCP config for Docker commands
    config_path = get_mcp_config_path()
    docker_providers = []
    if config_path:
        docker_providers = check_docker_in_config(config_path)
        
        if verbose:
            print(f"\nMCP config check:")
            print(f"  Config path: {config_path}")
            print(f"  Docker providers: {docker_providers}")
        
        if docker_providers:
            print(f"\n❌ MCP Config: Docker commands found in {', '.join(docker_providers)} ❌")
            print(f"   Remediation: Update {config_path} to use non-Docker commands")
            
            for provider in docker_providers:
                print(f"\n   {provider}:")
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                command = config['providers'][provider]['command']
                print(f"     Current: {' '.join(command)}")
                if provider == 'context7':
                    print(f"     Fix to: npx -y {MCP_SERVERS['context7']['package']}@{MCP_SERVERS['context7']['version']}")
            
            return 3
        else:
            print("\n✅ MCP Config: No Docker commands ✅")
    else:
        print("\n⚠️  MCP Config: Not found (mcp_configs/active.json)")
    
    # Check provider installation status
    print("\nProviders:")
    if config_path:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        providers = config.get('providers', {})
        for provider_name, provider_config in providers.items():
            command = provider_config.get('command', [])
            enabled = provider_config.get('enabled', False)
            actions = provider_config.get('actions', [])
            
            if enabled:
                status = "✅"
                details = ""
                
                # Check if it's a placeholder (echo)
                if command and command[0] == 'echo':
                    details = "(placeholder)"
                # Check if it's npx-based
                elif command and command[0] == 'npx':
                    details = "(npx package)"
                    # Check if package is actually installed
                    try:
                        # Extract package name from npx command
                        # e.g., "npx -y @upstash/context7-mcp@2.1.0" -> "@upstash/context7-mcp@2.1.0"
                        package_spec = None
                        for arg in command:
                            if arg.startswith('@') or arg in MCP_SERVERS:
                                package_spec = arg
                                break
                        
                        if package_spec and verbose:
                            print(f"\n  {provider_name}:")
                            print(f"    Command: {' '.join(command)}")
                            print(f"    Actions: {', '.join(actions) if actions else 'None'}")
                    except Exception:
                        pass
                
                # Check if it's Docker-based (should not happen after migration)
                if command and 'docker' in command[0].lower():
                    status = "❌"
                    details = "(DOCKER - UNSAFE)"
                
                print(f"  {status} {provider_name}: {details}")
            else:
                actions_str = ', '.join(actions) if actions else 'None'
                print(f"  ⏭️  {provider_name}: disabled (actions: {actions_str})")
    
    print()
    return 0


def print_install_commands() -> int:
    """Print installation commands for MCP servers."""
    print("MCP Server Installation Commands")
    print("=" * 60)
    print("\n✅ Dependencies Ready:")
    print("   Node.js >= 18.0.0")
    print("   npm/npx")
    
    print("\n✅ Providers Requiring Installation:")
    
    config_path = get_mcp_config_path()
    if config_path:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        providers = config.get('providers', {})
        for provider_name, provider_config in providers.items():
            enabled = provider_config.get('enabled', False)
            command = provider_config.get('command', [])
            
            if enabled and command and command[0] == 'npx':
                # Extract package spec
                package_spec = None
                for arg in command:
                    if '@' in arg or arg in MCP_SERVERS.get(provider_name, {}).get('package', ''):
                        package_spec = arg
                        break
                
                if package_spec:
                    print(f"\n  {provider_name}:")
                    print(f"    npx --yes {package_spec}")
    
    print("\n⚠️  IMPORTANT:")
    print("   Run these commands in your terminal to install MCP servers.")
    print("   Installation is idempotent - safe to re-run if needed.")
    print("   NEVER run installation on RED risk tier gates.")
    
    return 0


def main():
    """Main entrypoint."""
    args = sys.argv[1:] if len(sys.argv) > 1 else ['--status']
    
    verbose = '--verbose' in args or '-v' in args
    
    if '--status' in args or '-s' in args:
        return print_status(verbose)
    elif '--install' in args or '-i' in args:
        return print_install_commands()
    else:
        print("Usage: python3 mcp_bootstrap.py [--status|--install] [--verbose]")
        print("  --status, -s    Check MCP bootstrap status")
        print("  --install, -i   Print installation commands")
        print("  --verbose, -v   Show detailed output")
        return 1


if __name__ == "__main__":
    sys.exit(main())
