# GitHub Branch Protection Configuration Evidence

**Date**: 2026-01-10
**Status**: DOCUMENTED (Ready for Manual Configuration)
**Source**: docs/SSOT/11_GITHUB_GOVERNANCE.md

## GitHub UI Configuration Path

1. Go to Repository Settings: `https://github.com/[org]/[repo]/settings/branches`
2. Click "Add rule" under "Branch protection rules"
3. Configure for branch name pattern: `main`

## Required Settings (Based on docs/SSOT/11_GITHUB_GOVERNANCE.md)

### ✅ Require a pull request before merging

- [x] **Checked**: Require pull request before merging
- [x] **Required approvals**: 1
- [x] **Dismiss stale pull request approvals when new commits are pushed**: Checked
- [x] **Require review from Code Owners**: Unchecked (covered by PR template checklist)
- [x] **Restrict who can dismiss pull request reviews**: Unchecked

### ✅ Require status checks to pass before merging

- [x] **Checked**: Require status checks to pass before merging
- [x] **Required status checks** (exact names from CI workflows):

#### Code Quality Checks

- `quality-gate` (from ci.yml)
- `quality-gate` (from pr-quality-checks.yml)

#### Security Checks

- `CodeQL` (from codeql.yml)
- `dependency-review` (from dependency-review.yml)
- `secret-scan` (from secret-scan.yml)

#### Testing Checks

- `api-tests` (from api-tests.yml)
- `e2e-tests` (from e2e-tests.yml)
- `load-tests` (from load-tests.yml)
- `redis-tests` (from redis-tests.yml)

### ✅ Require branches to be up to date before merging

- [x] **Checked**: Require branches to be up to date before merging

### ✅ Include administrators

- [x] **Checked**: Include administrators (rules apply to repository admins)

### ❌ Restrict pushes that create matching branches

- [ ] **Unchecked**: Allow repository admins to create branches

### ❌ Allow force pushes

- [x] **Unchecked**: Never allow force pushes

### ❌ Allow deletions

- [x] **Unchecked**: Never allow branch deletions

## Status Check Names Verification

From `.github/workflows/ci.yml`:

```
name: CI
jobs:
  quality-gate:  # Status check: "quality-gate"
```

From `.github/workflows/pr-quality-checks.yml`:

```
name: PR Quality Checks
jobs:
  quality-gate:  # Status check: "quality-gate"
```

From `.github/workflows/codeql.yml`:

```
name: CodeQL
jobs:
  analyze:  # Status check: "CodeQL"
```

From `.github/workflows/dependency-review.yml`:

```
name: Dependency Review
jobs:
  dependency-review:  # Status check: "dependency-review"
```

From `.github/workflows/secret-scan.yml`:

```
name: Secret Scan
jobs:
  secret-scan:  # Status check: "secret-scan"
```

From `.github/workflows/api-tests.yml`:

```
name: API Tests
jobs:
  api-tests:  # Status check: "api-tests"
```

From `.github/workflows/e2e-tests.yml`:

```
name: E2E Tests
jobs:
  e2e-tests:  # Status check: "e2e-tests"
```

From `.github/workflows/load-tests.yml`:

```
name: Load Tests
jobs:
  load-tests:  # Status check: "load-tests"
```

From `.github/workflows/redis-tests.yml`:

```
name: Redis Tests
jobs:
  redis-tests:  # Status check: "redis-tests"
```

## Screenshot Requirements

### Branch Protection Rule Creation

```
[SCREENSHOT PLACEHOLDER]
Image: github-branch-protection-rule-creation.png
Caption: GitHub UI showing branch protection rule creation for 'main' branch
```

### Status Checks Configuration

```
[SCREENSHOT PLACEHOLDER]
Image: github-status-checks-configuration.png
Caption: GitHub UI showing required status checks configuration with all CI job names
```

### Review Requirements

```
[SCREENSHOT PLACEHOLDER]
Image: github-review-requirements.png
Caption: GitHub UI showing pull request review requirements (1 approval, dismiss stale reviews)
```

## Validation Checklist

After configuration, verify:

- [ ] Cannot push directly to main branch
- [ ] PR creation required for all main changes
- [ ] All status checks appear in PR "Checks" tab
- [ ] PR cannot be merged until all checks pass
- [ ] PR cannot be merged without required approvals
- [ ] Stale approvals are dismissed on new commits

## Emergency Bypass Procedure

**Administrator Only** (Repository admins with engineering leadership approval):

1. **Business Justification**: Document in ENGINEERING_LOG.md
2. **Time Limited**: Maximum 24-hour bypass window
3. **Post-Mortem**: Incident review within 48 hours
4. **Audit Trail**: Update docs/SSOT/10_AGENT_MEMORY.md

**GitHub UI Steps for Bypass:**

1. Go to branch protection rule settings
2. Temporarily uncheck "Include administrators"
3. Apply critical fix
4. Immediately re-enable "Include administrators"
5. Document bypass in ENGINEERING_LOG.md

## Monitoring and Alerts

- **Failure Notifications**: Slack alerts for pipeline failures
- **Merge Blocks**: Automated alerts when PRs are blocked >24 hours
- **Quality Metrics**: Weekly reports on compliance rates
- **Emergency Bypass**: Automatic alerts for any bypass usage

---

**Evidence**: This document provides the exact settings needed for FAANG-grade branch protection. Screenshots should be added after GitHub UI configuration is complete.
