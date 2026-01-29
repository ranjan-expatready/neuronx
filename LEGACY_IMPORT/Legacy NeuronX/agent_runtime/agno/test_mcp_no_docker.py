#!/usr/bin/env python3
"""
Test: MCP Inventory Contains No Docker Commands

Verifies that all MCP providers use non-Docker command invocation.
Evidence: active.json and --mcp-inventory output must have zero "docker" strings.

Exit Codes:
- 0: PASS - No Docker commands found
- 1: FAIL - Docker commands found or config error
- 2: ERROR - Config file not found
"""

import json
import subprocess
import sys
from pathlib import Path


def check_config_file_for_docker(config_path: Path) -> tuple[bool, list[str]]:
    """Check if MCP config contains docker commands."""
    docker_providers = []
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        providers = config.get('providers', {})
        for provider_name, provider_config in providers.items():
            command = provider_config.get('command', [])
            if command and len(command) > 0:
                # Check first word of command
                if 'docker' in command[0].lower():
                    docker_providers.append(provider_name)
        
        return len(docker_providers) == 0, docker_providers
    except (json.JSONDecodeError, IOError) as e:
        print(f"❌ Error reading config: {e}")
        raise


def check_mcp_inventory_output_for_docker() -> tuple[bool, str]:
    """Run --mcp-inventory and check for docker in output."""
    config_path = Path(__file__).parent / 'mcp_configs' / 'active.json'
    
    try:
        result = subprocess.run(
            ['python3', 'main.py', '--mcp-config', str(config_path), '--mcp-inventory'],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=Path(__file__).parent
        )
    except subprocess.TimeoutExpired:
        print("❌ MCP inventory command timed out")
        return False, "command timed out"
    
    if 'docker' in result.stdout.lower():
        return False, "docker found in stdout"
    
    if 'docker' in result.stderr.lower():
        return False, "docker found in stderr"
    
    return True, ""


def main():
    """Run all checks."""
    print("=" * 60)
    print("Test: MCP Inventory - No Docker Commands")
    print("=" * 60)
    
    # Check 1: Config file
    print("\nCheck 1: MCP Config File (active.json)")
    config_path = Path(__file__).parent / 'mcp_configs' / 'active.json'
    
    if not config_path.exists():
        print(f"❌ Config file not found: {config_path}")
        return 2
    
    print(f"📄 Config path: {config_path}")
    
    try:
        is_clean, docker_providers = check_config_file_for_docker(config_path)
    except Exception:
        return 2
    
    if is_clean:
        print("✅ PASS: No Docker commands found in MCP config")
    else:
        print(f"❌ FAIL: Docker commands found in providers: {', '.join(docker_providers)}")
        return 1
    
    # Check 2: MCP inventory output
    print("\nCheck 2: MCP Inventory Output")
    
    try:
        is_clean, reason = check_mcp_inventory_output_for_docker()
    except Exception as e:
        print(f"❌ Error running MCP inventory: {e}")
        return 1
    
    if is_clean:
        print("✅ PASS: No Docker strings in --mcp-inventory output")
    else:
        print(f"❌ FAIL: {reason}")
        return 1
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ ALL CHECKS PASSED - MCP inventory contains no Docker commands")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
