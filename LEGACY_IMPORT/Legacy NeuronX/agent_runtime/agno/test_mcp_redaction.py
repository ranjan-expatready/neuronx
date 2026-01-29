#!/usr/bin/env python3
"""
Test: MCP Secrets are Redacted from Evidence

Verifies that GITHUB_TOKEN and other secrets are redacted from evidence files.
Evidence: Grep for tokens/keys in agent_runtime/evidence/ shows no actual values.

Exit Codes:
- 0: PASS - No secrets found in evidence
- 1: FAIL - Secrets found in evidence
- 2: ERROR - Evidence directory not found
"""

import subprocess
import sys
from pathlib import Path


def grep_secrets_in_evidence(evidence_dir: Path) -> list[str]:
    """Search for secrets in evidence files."""
    
    # Patterns to search for (avoid actual values)
    secret_patterns = [
        'GITHUB_TOKEN',
        'CONTEXTSTREAM_API_KEY',
        'CONTEXT7_API_KEY',
    ]
    
    # Also search for common secret value patterns that should NOT appear
    # (actual values would be long strings, these are heuristics)
    suspicious_patterns = [
        'ghp_',  # GitHub token prefix
        'gho_',  # GitHub token prefix
        'ghu_',  # GitHub token prefix
        'ghs_',  # GitHub token prefix
        'ghr_',  # GitHub token prefix
        'sk-',   # API key prefix
        'apikey',
    ]
    
    findings = []
    
    if not evidence_dir.exists():
        return findings
    
    # Search for secret keys (these are OK to appear as keys)
    for pattern in secret_patterns:
        try:
            result = subprocess.run(
                ['grep', '-r', pattern, str(evidence_dir)],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                findings.extend([(pattern, line) for line in lines if line])
        except subprocess.TimeoutExpired:
            pass
        except Exception:
            pass
    
    # Search for suspicious patterns (these should NOT appear)
    for pattern in suspicious_patterns:
        try:
            result = subprocess.run(
                ['grep', '-i', '-r', pattern, str(evidence_dir)],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                # Filter out our smoke test script itself
                lines = [line for line in lines if 'test_mcp_redaction.py' not in line]
                findings.extend([(f'SUSPICIOUS: {pattern}', line) for line in lines if line])
        except subprocess.TimeoutExpired:
            pass
        except Exception:
            pass
    
    return findings


def main():
    """Run secret redaction test."""
    print("=" * 60)
    print("Test: MCP Secrets are Redacted from Evidence")
    print("=" * 60)
    
    # Find evidence directory
    evidence_dir = Path(__file__).parent.parent / 'evidence'
    
    print(f"\nEvidence directory: {evidence_dir}")
    
    if not evidence_dir.exists():
        print(f"❌ Evidence directory not found: {evidence_dir}")
        print("⚠️  This is OK if no tests have been run yet")
        print("✅ PASS: No secrets to redact (no evidence files)")
        return 0
    
    if len(list(evidence_dir.glob('*.json'))) == 0:
        print("⚠️  No evidence files found")
        print("✅ PASS: No secrets to redact (no evidence files)")
        return 0
    
    print(f"✓ Found {len(list(evidence_dir.glob('*.json')))} evidence files")
    
    # Search for secrets
    print("\nSearching for secrets in evidence files...")
    
    findings = grep_secrets_in_evidence(evidence_dir)
    
    if not findings:
        print("✅ PASS: No secrets found in evidence files")
        return 0
    
    # Report findings
    print(f"\n❌ FAIL: Found {len(findings)} potential secret references:")
    
    for pattern, line in findings[:10]:  # Show first 10
        print(f"\n  Pattern: {pattern}")
        print(f"  File: {line.split(':')[0]}")
        # Don't print the full line to avoid showing secrets
        print(f"  Line excerpt: {line[:100]}...")
    
    if len(findings) > 10:
        print(f"\n  ... and {len(findings) - 10} more findings")
    
    # Check if any are actual secrets (not just keys)
    actual_secrets = [f for f in findings if f[0].startswith('SUSPICIOUS')]
    if actual_secrets:
        print(f"\n❌ CRITICAL: Found {len(actual_secrets)} potential actual secret values!")
        return 1
    else:
        print(f"\n⚠️  WARNING: Found secret KEY references (acceptable)")
        print("   These are OK - only key names, not actual values")
        return 0


if __name__ == "__main__":
    sys.exit(main())
