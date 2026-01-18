# Governance Guardrails

**Purpose:** Automated enforcement of requirement ↔ implementation ↔ tests ↔ evidence integrity.

## Overview

Governance guardrails prevent drift between documentation and code by failing CI when:

- Code changes occur without requirement traceability updates
- Integration work lacks evidence artifacts
- Test coverage gaps exist for new features

## Automated Validations

### Traceability Validation (`scripts/validate-traceability.ts`)

**What it checks:**

- Parses `docs/TRACEABILITY.md` for requirement-to-code mappings
- Detects git changes in REQ-mapped modules (`apps/core-api/`, `packages/`, `apps/adapters/`)
- Requires `docs/TRACEABILITY.md` updates when REQ-mapped code changes

**Failure scenarios:**

```
❌ REQUIREMENT DRIFT DETECTED!
Code changes in REQ-mapped modules require TRACEABILITY.md updates.

Required action:
1. Update docs/TRACEABILITY.md to reflect code changes
2. Ensure requirement acceptance criteria match implementation
3. Add/update test and evidence path mappings
```

**When it runs:**

- CI pipeline (both push and PR)
- Can be run locally: `npm run validate:traceability`

### Evidence Validation (`scripts/validate-evidence.ts`)

**What it checks:**

- Detects integration code changes, webhook handlers, or E2E scenarios
- Requires evidence artifacts in `docs/EVIDENCE/<area>/<date>/README.md`
- Validates evidence README contains required content sections

**Required evidence content:**

- What integration was implemented
- External system endpoints tested
- Authentication method validated
- Error handling scenarios covered
- Link to test execution results

**Failure scenarios:**

```
❌ EVIDENCE REQUIREMENT NOT MET!
Integration/webhook/E2E work requires evidence artifacts.

Required action:
1. Create docs/EVIDENCE/<area>/<date>/README.md
2. Include all required content sections
3. Link to actual test outputs and CI results
```

**When it runs:**

- CI pipeline (both push and PR)
- Can be run locally: `npm run validate:evidence`

## CI Integration

### Quality Gate Sequence

1. **Code Quality:** Format, lint, type check
2. **Governance:** Traceability and evidence validation
3. **Testing:** Unit tests with coverage enforcement
4. **Security:** Scans and dependency checks

### Failure Behavior

- **Traceability failures:** Block merge until documentation updated
- **Evidence failures:** Block merge until evidence artifacts created
- **Test failures:** Block merge until coverage/quality restored

## Local Development Workflow

### Before Committing

```bash
# Validate traceability integrity
npm run validate:traceability

# Validate evidence requirements
npm run validate:evidence

# Run full test suite
npm run test:all
```

### Handling Validation Failures

**For traceability failures:**

1. Review changed files in REQ-mapped modules
2. Update `docs/TRACEABILITY.md` with new mappings
3. Ensure acceptance criteria reflect implementation changes
4. Commit documentation changes

**For evidence failures:**

1. Create evidence directory: `docs/EVIDENCE/<area>/<date>/`
2. Create `README.md` with required content sections
3. Include links to test results and CI artifacts
4. Commit evidence artifacts

## Evidence Directory Structure

```
docs/EVIDENCE/
├── integrations/           # Integration work evidence
│   └── YYYY-MM-DD/
│       └── README.md
├── e2e/                    # E2E scenario evidence
│   └── YYYY-MM-DD/
│       └── README.md
├── requirements/           # Requirement validation evidence
│   └── README.md
└── README.md              # Evidence management guide
```

## Exemption Rules

### Automatic Exemptions

- Changes to documentation-only files
- Test file modifications (unless adding new integration tests)
- Dependency updates without code changes
- Emergency hotfixes (with explicit override)

### Manual Exemptions

- Require ADR approval for governance bypass
- Must include justification and remediation plan
- Automatically flagged for audit review

## Monitoring & Alerts

### Drift Detection

- Automated weekly scans for requirement drift
- Monthly audit of evidence completeness
- Slack alerts for governance failures

### Metrics Tracked

- Governance failure rate by developer
- Time to fix governance issues
- Evidence completeness percentage
- Traceability update frequency

## Troubleshooting

### Common Issues

**"No main branch found"**

- Ensure repository has `main` or `origin/main` branch
- CI runs may need branch protection configuration

**"Evidence file missing"**

- Check that integration changes trigger evidence requirements
- Verify date format in evidence path (YYYY-MM-DD)

**"Traceability matrix parse error"**

- Ensure `docs/TRACEABILITY.md` follows exact table format
- Check for malformed markdown table syntax

### Getting Help

1. **Run locally first:** Validate before pushing
2. **Check CI output:** Detailed error messages provided
3. **Review examples:** See existing evidence READMEs
4. **Contact governance team:** For complex exemption requests

## Success Metrics

- **Governance Failure Rate:** Target <5% of PRs
- **Evidence Completeness:** Target 100% for integration work
- **Traceability Accuracy:** Target 100% requirement-to-code mapping
- **Time to Fix:** Target <30 minutes average for governance issues

---

**Guardrail Status:** ✅ ACTIVE
**Last Updated:** 2026-01-03
**Coverage:** All CI pipelines
