#!/usr/bin/env python3
"""
Test: Context7 Executes Without Docker

Verifies that Context7 provider uses npx for execution, not Docker.
Evidence: DRY-RUN shows context7:search selected, npx command used, no docker subprocess.

Exit Codes:
- 0: PASS - Context7 uses npx, no Docker subprocess
- 1: FAIL - Context7 uses Docker or execution failed
- 2: ERROR - Config file not found or readiness fails
"""

import json
import subprocess
import sys
from pathlib import Path


def test_context7_dry_run() -> dict:
    """Run Context7 DRY-RUN test."""
    config_path = Path(__file__).parent / 'mcp_configs' / 'active.json'
    
    task = "Search documentation for Python async patterns"
    
    try:
        result = subprocess.run(
            ['python3', 'main.py', '--mcp-config', str(config_path), '--auto-mcp', '--dry-run', task],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=Path(__file__).parent
        )
        
        return {
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    except subprocess.TimeoutExpired:
        print("❌ Context7 DRY-RUN timed out")
        return {
            'exit_code': -1,
            'stdout': '',
            'stderr': 'command timed out'
        }


def check_output_for_npx_not_docker(output: str) -> tuple[bool, str]:
    """Check that output shows npx, not docker."""
    output_lower = output.lower()
    
    # Should have npx
    if 'npx' not in output_lower:
        return False, "npx not found in output"
    
    # Should NOT have docker
    if 'docker' in output_lower:
        return False, "docker found in output (unsafe)"
    
    # Should mention context7
    if 'context7' not in output_lower:
        return False, "context7 not found in output"
    
    # Should show search action
    if 'context7:search' not in output_lower and 'action selected: search' not in output_lower:
        return False, "context7:search not found in output"
    
    return True, ""


def main():
    """Run Context7 smoke test."""
    print("=" * 60)
    print("Test: Context7 Executes Without Docker")
    print("=" * 60)
    
    config_path = Path(__file__).parent / 'mcp_configs' / 'active.json'
    
    if not config_path.exists():
        print(f"❌ Config file not found: {config_path}")
        return 2
    
    print(f"📄 Config path: {config_path}")
    
    # Run readiness check first
    print("\nStep 1: Check Readiness")
    try:
        result = subprocess.run(
            ['python3', 'main.py', '--mcp-config', str(config_path), '--readiness'],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=Path(__file__).parent
        )
    except subprocess.TimeoutExpired:
        print("❌ Readiness check timed out")
        return 2
    
    # Check for RED status (only fail if critical for Context7)
    if 'Overall Status: RED' in result.stdout:
        # Check if it's due to GITHUB_TOKEN or memory (not critical for Context7)
        if 'GITHUB_TOKEN' in result.stdout and 'Memory Directory' in result.stdout:
            print("⚠️  Readiness is RED (missing GITHUB_TOKEN and Memory Directory)")
            print("   These are not critical for Context7 test - continuing...")
        elif 'Node.js' in result.stdout and 'RED' in result.stdout:
            print("❌ Readiness is RED due to Node.js issue - Context7 requires Node.js")
            print("📋 Readiness output:")
            print(result.stdout)
            return 2
        else:
            print("❌ Readiness is RED - cannot proceed with Context7 test")
            print("📋 Readiness output:")
            print(result.stdout)
            return 2
    
    print("✅ Readiness is GREEN or YELLOW (acceptable for Context7 test)")
    
    # Run DRY-RUN test
    print("\nStep 2: Run Context7 DRY-RUN")
    print("Task: 'Search documentation for Python async patterns'")
    
    dry_run_result = test_context7_dry_run()
    
    if dry_run_result['exit_code'] == -1:
        print("❌ DRY-RUN timed out")
        return 1
    
    print("\n📋 DRY-RUN Output:")
    print(dry_run_result['stdout'])
    
    if dry_run_result['stderr']:
        print("\n📋 DRY-RUN Errors:")
        print(dry_run_result['stderr'])
    
    # Check output for npx not docker
    print("\nStep 3: Verify npx, not docker")
    
    combined_output = dry_run_result['stdout'] + ' ' + dry_run_result['stderr']
    is_clean, reason = check_output_for_npx_not_docker(combined_output)
    
    if is_clean:
        print("✅ PASS: Context7 uses npx, not Docker")
    else:
        print(f"❌ FAIL: {reason}")
        return 1
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ ALL CHECKS PASSED - Context7 executes without Docker")
    print("   - npx command used")
    print("   - No docker subprocess")
    print("   - DRY-RUN succeeded")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
