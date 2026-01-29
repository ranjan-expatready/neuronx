#!/bin/bash
echo "--- OUTPUT 1: ls -la ---"
ls -la coverage/coverage-summary.json
echo "--- OUTPUT 2: jq ---"
jq '.total.lines.pct' coverage/coverage-summary.json
echo "--- OUTPUT 3: tail ---"
tail -120 docs/EVIDENCE/testing/2026-01-12_ci-gates/12_gate2_webhook_signer_coverage_raise.txt
echo "--- OUTPUT 4: git status ---"
git status --porcelain | head -40
