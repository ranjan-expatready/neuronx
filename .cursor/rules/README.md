# Cursor Agent Rules

**Canonical rules live in [/AGENTS.md](../../../AGENTS.md)**

This directory contains Cursor-specific rule overrides and extensions. For all general agent governance rules, see the canonical [AGENTS.md](../../../AGENTS.md) file.

## Cursor-Specific Rules

The following rules are specific to Cursor IDE integration and supplement the canonical rules:

- [SSOT_BOOTSTRAP.mdc](SSOT_BOOTSTRAP.mdc) - Core agent bootstrap and governance requirements
- [50_no_drift_policy.mdc](50_no_drift_policy.mdc) - Architecture boundary enforcement
- [60_vendor_boundary_policy.mdc](60_vendor_boundary_policy.mdc) - Business logic separation rules
- [85_evidence_capture.mdc](85_evidence_capture.mdc) - Evidence collection procedures

## Rule Priority

1. **Canonical Rules** ([/AGENTS.md](../../../AGENTS.md)) - Primary governance source
2. **SSOT Documents** (docs/SSOT/) - Detailed implementation guidance
3. **Cursor Overrides** (this directory) - IDE-specific adaptations

## Updates

When updating agent rules:
1. Update canonical [/AGENTS.md](../../../AGENTS.md) first
2. Add Cursor-specific overrides here if needed
3. Ensure compatibility with Continue agent rules

---

**See also**: [Continue Rules](../.continue/rules/README.md) | [SSOT Index](../../docs/SSOT/index.md)