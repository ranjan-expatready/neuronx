# GitHub UI Branch Protection Setup Checklist

**REPOSITORY**: `ranjan-expatready/autonomous-engineering-os`
**BRANCH**: `main`
**ESTIMATED TIME**: 5-10 minutes

---

## STEP 1: Navigate to Branch Protection Settings

- [ ] Open: `https://github.com/ranjan-expatready/autonomous-engineering-os`
- [ ] Click **Settings** tab (top navigation)
- [ ] In left sidebar, find **Code and automation** section
- [ ] Click **Branches**
- [ ] Scroll to **Branch protection rules**
- [ ] Click **Add rule**

---

## STEP 2: Create Main Branch Rule

- [ ] In **Branch name pattern** field, type: `main`
- [ ] Click **Create** button

---

## STEP 3: Configure Pull Request Requirements

### Enable PR Before Merging
- [ ] Toggle **ON**: "Require a pull request before merging"

### Approvals
- [ ] **Require approvals**: Set to `1`
- [ ] Toggle **ON**: "Dismiss stale PR approvals when new commits are pushed"
- [ ] Toggle **ON**: "Require approval from a human reviewer"
- [ ] Toggle **ON**: "Require review from Code Owners"

---

## STEP 4: Configure Status Check Requirements

### Enable Status Checks
- [ ] Toggle **ON**: "Require status checks to pass before merging"
- [ ] Toggle **ON**: "Require branches to be up to date before merging"

### Add Required CI Checks
- [ ] Click **Add requirement**
- [ ] Search and add: `lint`
- [ ] Click **Add requirement**
- [ ] Search and add: `test-unit`
- [ ] Click **Add requirement**
- [ ] Search and add: `test-integration`
- [ ] Click **Add requirement**
- [ ] Search and add: `security`
- [ ] Click **Add requirement**
- [ ] Search and add: `build`
- [ ] Click **Add requirement**
- [ ] Search and add: `summary`
- [ ] Click **Add requirement**
- [ ] Search and add: `machine-board` (Machine Board governance validator)
- [ ] Click **Add requirement**
- [ ] Search and add: `trae-review` (Trae external reviewer validator)

**Total Required Checks**: 8 (lint, test-unit, test-integration, security, build, summary, machine-board, trae-review)

---

## STEP 5: Configure Additional Restrictions

### Disable Force Pushes
- [ ] Toggle **OFF**: "Allow force pushes"

### Disable Deletions
- [ ] Toggle **OFF**: "Allow deletions"

### Prevent Admin Bypass
- [ ] Toggle **ON**: "Do not allow bypassing the above settings"
- [ ] **CRITICAL**: This ensures even Repository Owner must follow PR workflow

---

## STEP 6: Save Branch Protection Rule

- [ ] Scroll to bottom of page
- [ ] Click **Create** or **Save changes** button
- [ ] Confirm green success message appears

---

## STEP 7: Verify Configuration

- [ ] Go to **Code** tab
- [ ] Click on **main** branch dropdown
- [ ] Confirm shield icon (🛡️) appears next to "main"
- [ ] Click **View rules** link to review configured rules

---

## STEP 8: Verify Settings via GitHub CLI (Optional)

Run commands to verify:
```bash
gh api repos/ranjan-expatready/autonomous-engineering-os/branches/main/protection
```

**Expected Key Values**:
- `enforce_admins: true` - Admins cannot bypass
- `allow_force_pushes: false` - Force push disabled
- `allow_deletions: false` - Deletion disabled
- `required_approving_review_count: 1` - Requires 1 approval
- All 6 CI checks in contexts list

---

## STEP 9: Test Branch Protection (Optional)

### Test Direct Push Rejection
```bash
git checkout -b test-branch-protection
echo "# Test" > verify.md
git add verify.md
git commit -m "test: verify branch protection"
git push origin main  # This should fail
```

**Expected Result**:
```
ERROR: Cannot push to protected branch 'main'
At least 1 approving review is required
```

Clean up:
```bash
git checkout main
git branch -D test-branch-protection
```

---

## STEP 10: Document Completion

- [ ] Take timestamp of completion
- [ ] Save screenshot of branch protection settings (optional)
- [ ] Note any deviations from this checklist
- [ ] Document in `GOVERNANCE/GUARDRAILS.md` version history if needed

---

## QUICK REFERENCE: Required Settings Summary

| Setting | Value |
|---------|-------|
| Branch Name Pattern | `main` |
| Require PR Before Merging | ✅ ON |
| Required Approvals | 1 reviewer |
| Dismiss Stale Approvals | ✅ ON |
| Require Human Approval | ✅ ON |
| Require Code Owner Review | ✅ ON |
| Require Status Checks | ✅ ON |
| Branch Must Be Up-to-Date | ✅ ON |
| Required CI Checks | lint, test-unit, test-integration, security, build, summary, machine-board, trae-review (8 total) |
| Allow Force Pushes | ❌ OFF |
| Allow Deletions | ❌ OFF |
| Admin Bypass | ❌ OFF (enforce_on_admins: true) |

---

## Machine Board and Trae Review Governance Checks

### machine-board Check
**Workflow**: `.github/workflows/machine-board.yml`
**Purpose**: Validates PR submissions to ensure T1-T2 changes have rollback and verification artifacts, and that STATE files are updated.
**Runs**: On all PR events (opened, synchronized, reopened, labeled, unlabeled)
**Validation Includes**:
- ✅ Protected path artifacts (GOVERNANCE/, AGENTS/, COCKPIT/ changes have PLAN/VERIFICATION)
- ✅ STATE file updates for non-BACKLOG PRs
- ✅ Risk tier requirements (T1/T2 have rollback plan and verification proof)
- ✅ Trae review artifacts for T1-T4 changes
- ✅ No secrets in diffs

### trae-review Check
**Workflow**: `.github/workflows/trae-review-validator.yml`
**Purpose**: Validates that Trae (external security/policy reviewer) has reviewed and approved T1-T4 changes.
**Runs**: On all PR events (opened, synchronized, reopened, labeled, unlabeled)
**Validation Includes**:
- ✅ TRAE_REVIEW artifact exists for T1-T4 PRs (protected paths or T1/T2 risk tier)
- ✅ Artifact verdict is `APPROVE` or `EMERGENCY_OVERRIDE`
- ✅ Artifact created < 7 days ago (freshness check)
- ✅ Emergency override flag recognized with documentation

**Trae Review Triggers**:
- PR touches protected paths: `GOVERNANCE/**`, `AGENTS/**`, `COCKPIT/**`, `.github/workflows/**`, `STATE/**`
- PR labeled as T1/T2 (`tier-1`, `tier-2`, `critical`, `high-risk`)
- PR description mentions T1/T2 risk tier

**Related Documentation**:
- `AGENTS/TRAE.md` - Trae agent definition and scope
- `RUNBOOKS/trae-review.md` - Trae invocation and protocol
- `COCKPIT/artifacts/TRAE_REVIEW/` - Trae review artifacts directory

---

## COMPLETED: [ ] When All Items Checked

**Notes**: _______________________________________________________________________________

---

**Reference**: `RUNBOOKS/repo-governance.md` for detailed procedures and troubleshooting.
