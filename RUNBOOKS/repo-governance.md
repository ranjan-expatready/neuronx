# Repository Governance Runbook — Branch Protection and PR Enforcement

## Overview

This runbook provides step-by-step instructions for configuring, verifying, and maintaining branch protection on the `main` branch. Following these procedures ensures PR-only governance with the **Machine Board of Directors** - an automated validation system enforcing stricter, more consistent governance than human review alone.

---

## QUICK REFERENCE: Branch Protection Status

### Current Status
- **Repository**: `ranjan-expatready/autonomous-engineering-os`
- **Protected Branch**: `main`
- **Required Checks**: See `.github/workflows/ci.yml` and `.github/workflows/governance-validator.yml`
- **Governance**: Machine Board of Directors (automated, no human approval required)

### Verification Checklist
- [ ] Branch protection enabled on main
- [ ] PR required before merging (NO human approval - replaced by governance-validator)
- [ ] governance-validator check included in required status checks
- [ ] All CI checks required to pass (lint, test-unit, test-integration, security, build, summary)
- [ ] Force pushes disabled
- [ ] Branch deletion disabled
- [ ] No bypass allowed for admins

---

## NEW: Machine Board of Directors Mode

### What Changed

**From Human Governance to Machine Board of Directors**:
- ❌ **Removed**: Human approval requirements in development mode
- ✅ **Added**: Automated validation via `governance-validator` workflow
- ✅ **Benefit**: Machine enforces consistent rules (no "LGTM" shortcuts)
- ✅ **Benefit**: Faster - No waiting for human review cycles
- ✅ **Benefit**: Safer - All artifacts, STATE updates, and risk documentation are verified

### How the Machine Board Works

1. **PR opens** → `governance-validator` workflow runs automatically
2. **Validator checks**:
   - Protected paths have required PLAN/VERIFICATION artifacts
   - STATE files are updated (except BACKLOG-only PRs)
   - Risk tier T1/T2 have rollback plans and verification proof
   - No secrets detected in diffs
   - Framework structure is intact (framework-only mode)
3. **If all checks pass** → PR is merge-ready (no human approval needed)
4. **If any check fails** → PR is blocked with specific guidance

### Configuration Changes Required

In your GitHub branch protection settings for `main`:

**REMOVE**:
- ❌ "Require approvals" (set to 0 - no human approval needed)
- ❌ "Require approval from a human reviewer"
- ❌ "Require review from Code Owners" (machine board mode disabled)

**ADD**:
- ✅ `governance-validator` to required status checks (from `.github/workflows/governance-validator.yml`)

---

## PART 1: CONFIGURING BRANCH PROTECTION (MACHINE BOARD MODE)

### Prerequisites
- Repository Owner or Admin access on GitHub
- Repository URL: `https://github.com/ranjan-expatready/autonomous-engineering-os`
- Approximately 5-10 minutes to complete

---

### Step-by-Step GitHub UI Configuration

#### **STEP 1: Navigate to Branch Protection Settings**

1. Open repository in GitHub: `https://github.com/ranjan-expatready/autonomous-engineering-os`
2. Click on **Settings** tab (top navigation, between "Insights" and "Security")
3. In left sidebar, scroll to **Code and automation** section
4. Click on **Branches**
5. Scroll down to **Branch protection rules** section
6. Click on **Add rule** button

**Expected Result**: "Create branch protection rule" dialog opens

---

#### **STEP 2: Configure Main Branch Protection Rule**

**2.1 Basic Settings**

1. In **Branch name pattern** field, type: `main`
   - This creates a rule specifically for the main branch
   - Use exact match (not wildcard)

2. **Include branches that match**: Leave default settings

3. Click **Create ** button (bottom right of dialog)
   - This opens the detailed branch protection configuration

---

#### **STEP 3: Configure for Machine Board of Directors Mode**

**3.1 Disable Human Approvals**

1. Toggle **ON** the switch for: **Require a pull request before merging**
2. Under **Required approving reviews**, set:
   - **Require approvals** → `0` (no human approval needed)

3. **Dismiss stale PR approvals when new commits are pushed**: Toggle can be ON or OFF (optional in machine board mode)

4. **Require approval from a human reviewer**: Toggle **OFF** (disabled in machine board mode)

5. **Require review from Code Owners**: Toggle **OFF** (disabled in machine board mode)

**Expected Result**: PR section shows "0 approvals required" - governance handled by governance-validator

**3.2 Enable Status Check Requirement**

1. Toggle **ON** the switch for: **Require status checks to pass before merging`
   - Additional options appear below

2. **Require branches to be up to date before merging**: Toggle **ON**
   - Ensures PR includes latest main changes before merging

3. Click on **Add requirement** link/button
4. Add all CI checks from `.github/workflows/ci.yml`:
   - `lint` - Linting and Formatting
   - `test-unit` - Unit Tests
   - `test-integration` - Integration Tests
   - `security` - Security Checks
   - `build` - Build Verification
   - `summary` - CI Summary

5. **IMPORTANT**: Add the Machine Board check:
   - `governance-validator` - Machine Board of Directors validation

**Note**: The UI may show these as:
- `lint (CI)`
- `governance-validator (CI)`
- `test-unit (CI)`
- etc.

**Expected Result**: All 7 CI checks are listed under "Required status checks" including governance-validator

---

#### **STEP 5: Restrict Additional Actions**

**5.1 Disallow Force Pushes**

1. Scroll down to **Additional restrictions** section (if visible)
2. Alternatively, look for a separate section titled **Do not allow bypassing the above settings**

3. Enable the following:
   - **Restrict who can push to matching branches**: Leave unchecked
   - **Allow force pushes**: Toggle **OFF** (disable)
     - This prevents `git push --force` to main

4. **Allow deletions**: Toggle **OFF** (disable)
   - This prevents branch deletion

**5.2 Configure Admin Bypass Settings**

5. **Do not allow bypassing the above settings**: Toggle **ON**
   - This prevents Repository Owner from bypassing rules
   - **CRITICAL**: Even admin must follow PR workflow

**Expected Result**: Both force push and deletion are disabled; admin bypass is disabled

---

#### **STEP 6: Save Branch Protection Rule**

1. Scroll to bottom of configuration page
2. Click **Create ** or **Save changes** button
3. Green success message appears confirming the rule is created

**Expected Result**: Branch protection rule is active for main branch

---

#### **STEP 7: Verify Branch Protection**

1. Go to **Code** tab in repository
2. Click on **main** branch dropdown
3. Look for a shield icon (🛡️) next to "main"
   - Shield indicates branch is protected

4. Click **View rules** link if visible
   - Review configured rules match requirements

**Expected Result**: Shield icon present; rules show PR requirement + CI checks

---

## PART 2: VERIFICATION TESTS

### Test 1: Verify Direct Push is Blocked

**Purpose**: Confirm that direct pushes to main are rejected

**Steps**:
1. Create a test branch:
   ```bash
   git checkout -b test-branch-protection
   ```

2. Make a benign change:
   ```bash
   echo "# Test" > verify-protection.md
   git add verify-protection.md
   git commit -m "test: verify branch protection"
   ```

3. Attempt direct push to main (expected to fail):
   ```bash
   git push origin main
   ```

**Expected Result**:
```
ERROR: Cannot push to protected branch 'main' from current branch.
At least 1 approving review is required by reviewers with write access.
```

4. Clean up:
   ```bash
   git checkout main
   git branch -D test-branch-protection
   ```

---

### Test 2: Verify Governance Validator Requirement

**Purpose**: Confirm that the governance-validator check is required and properly validates PRs

**Steps**:
1. Create a new branch:
   ```bash
   git checkout -b feature/test-governance-validator
   ```

2. Make a change to a protected path to trigger validation:
   ```bash
   echo "# Test PR Workflow" > GOVERNANCE/test-governance.md
   git add GOVERNANCE/test-governance.md
   git commit -m "test: verify governance validator"
   ```

3. Push to GitHub:
   ```bash
   git push -u origin feature/test-governance-validator
   ```

4. Open PR via GitHub UI:
   - Go to repository → Pull requests
   - Click "New pull request"
   - Select `feature/test-governance-validator` as source
   - Select `main` as target
   - Confirm you see "All checks have passed" after CI runs
   - Confirm `governance-validator` check is in the required checks list
   - IMPORTANT: This PR should fail validation because it lacks required artifacts

5. Test the failure:
   - The `governance-validator` should fail (missing PLAN/VERIFICATION artifacts)
   - The PR should show a comment from the workflow explaining the failure
   - The merge button should be disabled

6. Fix the PR:
   - Update PR description with PLAN and VERIFICATION sections
   - Add STATE/STATUS_LEDGER.md updates to the PR (or note they'll be updated after)
   - Wait for re-run of governance-validator
   - Check that it now passes

7. Clean up:
   ```bash
   git checkout main
   git branch -D feature/test-governance-validator
   ```

---

### Test 3: Verify CI Checks are Required

**Purpose**: Confirm that PR cannot be merged without passing CI

**Steps**:
1. Create a branch with a failing test (if applicable):
   ```bash
   git checkout -b feature/failing-test
   ```

2. Make changes that will break CI:
   ```bash
   echo "# Failing test" > failing.md
   git add failing.md
   git commit -m "test: failing CI check"
   ```

3. Push and open PR:
   ```bash
   git push -u origin feature/failing-test
   ```

4. In GitHub PR UI:
   - Confirm "All checks must pass" is shown in merge button
   - Merge button is disabled while CI fails

5. Clean up:
   ```bash
   git checkout main
   git branch -D feature/failing-test
   git push origin --delete feature/failing-test
   ```

---

### Test 4: Verify Force Push is Blocked

**Purpose**: Confirm that git push --force to main is rejected

**Steps**:
1. (DANGEROUS - Only if branch protection is NOT working)
   - If branch protection is working, this test is not safe to run
   - See "Verification via Command Line" below instead

**Safer Alternative**:
1. Create a feature branch and push it
2. In GitHub UI, find a commit on that branch
3. Attempt force push to that feature branch (not main)
4. This confirms force push behavior without risking main

**Expected Result on Main**:
```
ERROR: Cannot force-push to protected branch 'main'
```

---

## PART 3: VERIFICATION VIA COMMAND LINE

### Check Branch Protection Status via GitHub CLI

**Prerequisites**: GitHub CLI (`gh`) installed and authenticated

**Command**:
```bash
gh repo view ranjan-expatready/autonomous-engineering-os --json defaultBranchRef
```

**Expected Output**: Shows main branch as default

---

### Check Branch Protection Rules

**Command**:
```bash
gh api repos/ranjan-expatready/autonomous-engineering-os/branches/main/protection
```

**Expected JSON Output**:
```json
{
  "url": "https://api.github.com/repos/...",
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "governance-validator",
      "lint",
      "test-unit",
      "test-integration",
      "security",
      "build",
      "summary"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

**Key Fields to Verify**:
- `strict: true` - Branch must be up-to-date
- `contexts` - Contains all 7 CI checks including `governance-validator`
- `enforce_admins: true` - Admins cannot bypass rules
- `required_approving_review_count: 0` - NO human approval needed (machine board mode)
- `allow_force_pushes: false` - Force push disabled
- `allow_deletions: false` - Deletion disabled

---

### Recent PR Compliance Check

**Command**:
```bash
gh pr list --repo ranjan-expatready/autonomous-engineering-os --state merged --limit 10 --json number,title,mergedAt,reviews,checkRunStatuses
```

**Expected Behavior**: All merged PRs show:
- Approvals from reviewers
- Passed CI checks
- No direct pushes evidenced

---

## PART 4: TROUBLESHOOTING

### Issue: Branch Protection Not Working

**Symptoms**:
- Direct pushes to main succeed unexpectedly
- No shield icon on main branch

**Troubleshooting Steps**:
1. Verify rule is set up correctly in GitHub UI
2. Check if user is bypassing as admin (ensure "Do not allow bypassing" is ON)
3. Verify target branch name is exactly `main` (not `main/*` or wildcard)

---

### Issue: CI Checks Not Running

**Symptoms**:
- PRs show "No required status checks"
- Merge button doesn't wait for CI

**Troubleshooting Steps**:
1. Verify workflow file exists: `.github/workflows/ci.yml`
2. Check workflow is not disabled (Actions tab)
3. Verify workflow triggers on pull_request events
4. Check that job names match status check names (e.g., `lint` job → `lint` check)

---

### Issue: Approval Requirement Not Enforced

**Symptoms**:
- PRs can be merged without reviews
- "Required approvals" setting seems ignored

**Troubleshooting Steps**:
1. Verify GitHub account has write access (not just read)
2. Check that CODEOWNERS file is correctly formatted
3. Verify "Require approval from a human reviewer" is enabled
4. Confirm no one has bypass permissions

---

### Issue: Admin Can Bypass Rules

**Symptoms**:
- Repository Owner can push directly to main

**Troubleshooting Steps**:
1. In branch protection settings
2. Ensure "Do not allow bypassing the above settings" is ON
3. This MUST be enabled for true governance

---

## PART 5: MAINTENANCE

### Regular Verification Checklist

**Monthly**:
- [ ] Verify branch protection settings unchanged
- [ ] Check CI workflow runs successfully on PRs
- [ ] Review merged PRs for compliance
- [ ] Update CODEOWNERS if team structure changes

**Quarterly**:
- [ ] Add new CI checks to required status list
- [ ] Review and update approval requirements if needed
- [ ] Audit recent direct push attempts (via GitHub logs)

**On Major Framework Changes**:
- [ ] Re-evaluate required approvals for new directories
- [ ] Consider adding directory-specific CODEOWNERS rules
- [ ] Update branch protection review requirements

---

### Adding New Required CI Checks

When adding new jobs to `.github/workflows/ci.yml`:

1. Push changes to PR
2. Verify new job runs successfully
3. Go to Settings → Branches → main → Edit
4. Add new job to "Required status checks" list
5. Save changes

---

### Updating Approval Requirements

To change from 1 reviewer to 2+ reviewers:

1. Go to Settings → Branches → main → Edit
2. Under "Required approving reviews", change:
   - ` Require approvals` → increase to desired number (e.g., 2)
3. Save changes

**Note**: Changes apply immediately to new PRs only

---

## PART 6: EMERGENCY BYPASS PROCEDURE

### When Direct Push is Absolutely Necessary

**Warning**: This should never be needed if branch protection is properly configured.

**Hypothetical Procedure** (if configuration is temporarily disabled):
1. Temporarily disable branch protection in GitHub UI (NOT recommended)
2. Make emergency fix
3. Immediately re-enable branch protection
4. Document the bypass in a retrospective

**Recommended Approach**: Always use hotfix PR workflow instead.

### Hotfix PR Workflow

**When urgent fix is needed**:

1. Create hotfix branch:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/urgent-fix-<issue-id>
   ```

2. Make minimal fix
3. Push and create PR with "hotfix" or "urgent" label
4. Tag reviewers and request expedited review
5. Merge with approvals after CI passes

---

## PART 7: SUMMARY

### Key Points

1. **Direct pushes to main are forbidden** - Enforced by GitHub branch protection
2. **All changes require PR** - No exceptions, including for Repository Owner
3. **CI checks must pass** - All 6 checks (lint, test-unit, test-integration, security, build, summary)
4. **1+ human approval required** - At least one reviewer must approve
5. **No bypass for admins** - Even founders must follow the rules

### Reference Documentation

- **Branch Protection Policy**: `GOVERNANCE/GUARDRAILS.md` - Main Branch Protection Policy
- **CI Workflow**: `.github/workflows/ci.yml` - Required checks definition
- **PR Template**: `.github/PULL_REQUEST_TEMPLATE.md` - PR format requirements

### Support

If branch protection is not working as expected:
1. Verify settings in GitHub UI
2. Check GitHub repository access permissions
3. Review this runbook's troubleshooting section
4. Verify CODEOWNERS file is properly configured

---

## VERSION HISTORY

- v1.1 (Machine Board of Directors): Updated for automated governance with governance-validator, removed human approval requirements
- v1.0 (Initial): Branch protection setup, verification procedures, troubleshooting guide
