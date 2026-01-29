# SDLC Board Automation Rules — Verification Artifact

**Created**: 2026-01-25
**Project URL**: https://github.com/users/ranjan-expatready/projects/2
**Project ID**: PVT_kwHODjbJ_M4BNbV3
**Status**: 🟡 PENDING UI CONFIGURATION

---

## EXTRACTED AUTOMATION RULES (7 Total)

Based on `GITHUB_PROJECT_SDLC_ARTIFACT.md` and `RUNBOOKS/sdlc-board-ops.md`, the following 7 automation rules must be configured via GitHub Projects UI:

| Rule ID | Trigger | Action | Target Status |
|---------|---------|--------|---------------|
| 1 | Issue is created | Set status to "Backlog" | Backlog |
| 2 | Issue is assigned (any assignee) | Set status to "Planned" | Planned |
| 3 | Pull request is opened | Find linked issue → Set status to "In Progress" | In Progress |
| 4 | Pull request is in review | Set linked issue status to "In Review (PR Open)" | In Review (PR Open) |
| 5 | Pull request requires review | Set linked issue status to "Waiting for Approval" | Waiting for Approval |
| 6 | Pull request is merged | Set linked issue status to "Done" | Done |
| 7 | CI workflow fails | Find linked issue → Set status to "Blocked" | Blocked |

---

## STEP-BY-STEP UI CONFIGURATION CHECKLIST

### Prerequisites

- ✅ GitHub Projects board is operational (https://github.com/users/ranjan-expatready/projects/2)
- ✅ GitHub account has Project Maintainer permissions
- ✅ Repository: ranjan-expatready/autonomous-engineering-os

---

### UI Configuration Steps

#### Navigate to Automation Settings

1. Open browser and navigate to: **https://github.com/users/ranjan-expatready/projects/2**
2. Click the ** ⚙️ ** (gear icon) in the top-right corner
3. Click **"Automation"** in the left sidebar
4. Verify you see automation rules panel

---

### Rule 1: Issue Created → Backlog

**UI Configuration Path**:

1. In Automation panel, click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Issue"** from dropdown
   - Select **"Created"** from condition dropdown
3. Under **"Then"** (Action):
   - Select **"Set status"** from action dropdown
   - Select **"Backlog"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Issue → Created
Then: Set status to Backlog
```

---

### Rule 2: Issue Assigned → Planned

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Issue"** from dropdown
   - Select **"Assigned"** from condition dropdown
   - Leave assignee field as **"Any assignee"** (or select "When assigned")
3. Under **"Then"** (Action):
   - Select **"Set status"** from action dropdown
   - Select **"Planned"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Issue → Assigned (any assignee)
Then: Set status to Planned
```

---

### Rule 3: PR Opened → Linked Issue to In Progress

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Pull request"** from dropdown
   - Select **"Opened"** from condition dropdown
3. Under **"Then"** (Action):
   - Select **"Find linked issue"** or **"Update linked issue"** from action dropdown
   - Select **"Set status"** from sub-action dropdown
   - Select **"In Progress"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Pull request → Opened
Then: Find linked issue → Set status to In Progress
```

---

### Rule 4: PR In Review → Linked Issue to In Review (PR Open)

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Pull request"** from dropdown
   - Select **"In review"** from condition dropdown
3. Under **"Then"** (Action):
   - Select **"Find linked issue"** or **"Update linked issue"** from action dropdown
   - Select **"Set status"** from sub-action dropdown
   - Select **"In Review (PR Open)"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Pull request → In review
Then: Find linked issue → Set status to In Review (PR Open)
```

---

### Rule 5: PR Requires Review → Linked Issue to Waiting for Approval

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Pull request"** from dropdown
   - Select **"Review required"** or **"Requires review"** from condition dropdown
3. Under **"Then"** (Action):
   - Select **"Find linked issue"** or **"Update linked issue"** from action dropdown
   - Select **"Set status"** from sub-action dropdown
   - Select **"Waiting for Approval"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Pull request → Requires review
Then: Find linked issue → Set status to Waiting for Approval
```

---

### Rule 6: PR Merged → Linked Issue to Done

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Pull request"** from dropdown
   - Select **"Merged"** from condition dropdown
   - Note: May require selecting "Closed and merged = true"
3. Under **"Then"** (Action):
   - Select **"Find linked issue"** or **"Update linked issue"** from action dropdown
   - Select **"Set status"** from sub-action dropdown
   - Select **"Done"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Pull request → Merged
Then: Find linked issue → Set status to Done
```

---

### Rule 7: CI Failed → Linked Issue to Blocked

**UI Configuration Path**:

1. Click **"New automation"** or **"Add rule"**
2. Under **"When"** (Trigger):
   - Select **"Workflow run"** from dropdown
   - Select **"Status"** from condition dropdown
   - Select **"Failure"** from status value dropdown
3. Under **"Then"** (Action):
   - Select **"Find linked issue"** or **"Update linked issue"** from action dropdown
   - Select **"Set status"** from sub-action dropdown
   - Select **"Blocked"** from status dropdown
4. Click **"Save"** or **"Create"**
5. Verify the rule appears in your automation rules list

**Expected Rule Summary**:
```
When: Workflow run → Status = Failure
Then: Find linked issue → Set status to Blocked
```

---

### Verify All Rules Are Active

After configuring all 7 rules:

1. Review the automation rules list in the Automation panel
2. Verify all 7 rules appear
3. Check that each rule has a toggle switch set to **"On"** or **"Enabled"**
4. Take a screenshot (optional) showing all 7 active rules for evidence

**Expected Count**: 7 automation rules active and enabled

---

## VERIFICATION PROTOCOL

### Overview

This verification protocol tests the automation rules by creating a test issue and a test PR, then verifying the board state transitions.

### Test Workflow

#### Step 1: Create Test Issue

```bash
gh issue create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "VERIFICATION: Test SDLC automation rules" \
  --body "This issue tests SDLC board automation. Will be linked to a test PR."
```

**Record Issue Number**: `#___` (fill in after creation)

**Expected Behavior (due to Rule 1)**:
- ✅ Issue automatically appears in project
- ✅ Status automatically set to **"Backlog"**

**Verification Point**:
- Navigate to: https://github.com/users/ranjan-expatready/projects/2
- Verify the issue exists in the **[Backlog]** column
- Screenshot evidence (optional)

---

#### Step 2: Assign Test Issue

```bash
# Issue number from Step 1
gh issue edit <ISSUE_NUMBER> \
  --repo ranjan-expatready/autonomous-engineering-os \
  --assignee ranjan-expatready
```

**Expected Behavior (due to Rule 2)**:
- ✅ Issue status automatically changes to **"Planned"**

**Verification Point**:
- Refresh project board at: https://github.com/users/ranjan-expatready/projects/2
- Verify the issue moved from **[Backlog]** to **[Planned]** column
- Screenshot evidence (optional)

---

#### Step 3: Create Feature Branch

```bash
git checkout -b test/sdlc-automation-verification
```

---

#### Step 4: Create Test PR Linking to Issue

```bash
gh pr create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "VERIFICATION: Test PR for SDLC automation" \
  --body "Closes #<ISSUE_NUMBER>" \
  --base main \
  --head test/sdlc-automation-verification
```

**Record PR Number**: `#___` (fill in after creation)

**Expected Behavior (due to Rule 3)**:
- ✅ Linked issue status automatically changes to **"In Progress"**

**Verification Point 1 (Issue Status)**:
- Refresh project board at: https://github.com/users/ranjan-expatready/projects/2
- Verify the issue moved from **[Planned]** to **[In Progress]** column
- Screenshot evidence (optional)

**Verification Point 2 (PR Link)**:
- Open the PR at: https://github.com/ranjan-expatready/autonomous-engineering-os/pull/<PR_NUMBER>
- Verify PR description includes: `Closes #<ISSUE_NUMBER>`

---

#### Step 5: Request Review (Trigger Rule 4 or 5)

```bash
# Request a review from any user (yourself or another)
gh pr edit <PR_NUMBER> \
  --repo ranjan-expatready/autonomous-engineering-os \
  --add-reviewer ranjan-expatready
```

**Expected Behavior (due to Rule 4)**:
- ✅ Linked issue status automatically changes to **"In Review (PR Open)"**

**Verification Point**:
- Refresh project board at: https://github.com/users/ranjan-expatready/projects/2
- Verify the issue moved from **[In Progress]** to **[In Review (PR Open)]** column
- Screenshot evidence (optional)

**Note**: If Rule 5 triggers instead (waiting for approval), this is also valid behavior depending on branch protection settings.

---

#### Step 6: Approve and Merge PR (Trigger Rule 6)

```bash
# Approve the PR
gh pr review <PR_NUMBER> \
  --repo ranjan-expatready/autonomous-engineering-os \
  --approve

# Merge the PR
gh pr merge <PR_NUMBER> \
  --repo ranjan-expatready/autonomous-engineering-os \
  --merge
```

**Expected Behavior (due to Rule 6)**:
- ✅ Linked issue status automatically changes to **"Done"**

**Verification Point**:
- Refresh project board at: https://github.com/users/ranjan-expatready/projects/2
- Verify the issue moved from **[In Review (PR Open)]** (or "Waiting for Approval") to **[Done]** column
- Screenshot evidence (optional)

---

#### Step 7: Test CI Failure (Optional - Rule 7)

**⚠️ WARNING**: This will intentionally break CI. Only perform if you want to test Rule 7.

```bash
git checkout -b test/ci-failure-verification
echo "failing_test" > tests/fake_test.py
git add tests/fake_test.py
git commit -m "test: intentionally fail CI"
git push origin test/ci-failure-verification

gh pr create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "VERIFICATION: Test CI failure automation" \
  --body "Closes #<ISSUE_NUMBER>"
```

**Expected Behavior (due to Rule 7)**:
- ✅ Linked issue status automatically changes to **"Blocked"**

**Verification Point**:
- Refresh project board at: https://github.com/users/ranjan-expatready/projects/2
- Verify any linked issue moved to **[Blocked]** column
- Screenshot evidence (optional)

**Cleanup after CI failure test**:
```bash
gh pr close <PR_NUMBER> --comment "Cleanup: CI failure test complete"
git checkout main
git branch -D test/ci-failure-verification
```

---

### Expected State Transition Summary

| Step | Action | Triggered Rule | Expected Status | Verification URL |
|------|--------|---------------|-----------------|-----------------|
| 1 | Issue created | Rule 1 | **Backlog** | https://github.com/users/ranjan-expatready/projects/2 |
| 2 | Issue assigned | Rule 2 | **Planned** | https://github.com/users/ranjan-expatready/projects/2 |
| 3 | PR opened | Rule 3 | **In Progress** | https://github.com/users/ranjan-expatready/projects/2 |
| 4 | PR in review | Rule 4 | **In Review (PR Open)** | https://github.com/users/ranjan-expatready/projects/2 |
| 5 | PR requires review | Rule 5 | **Waiting for Approval** | https://github.com/users/ranjan-expatready/projects/2 |
| 6 | PR merged | Rule 6 | **Done** | https://github.com/users/ranjan-expatready/projects/2 |
| 7 | CI fails | Rule 7 | **Blocked** | https://github.com/users/ranjan-expatready/projects/2 |

---

### Evidence Collection

For each verification step, collect the following evidence:

**Minimum Required Evidence**:
- ✅ Test Issue URL (e.g., https://github.com/ranjan-expatready/autonomous-engineering-os/issues/13)
- ✅ Test PR URL (e.g., https://github.com/ranjan-expatready/autonomous-engineering-os/pull/14)
- ✅ Project URL showing item at each status (https://github.com/users/ranjan-expatready/projects/2)

**Optional Evidence (enhances credibility)**:
- Screenshots of project board at each status transition
- Screenshots of automation rules panel showing all 7 active rules
- Timeline of issue status transitions (visible in issue activity log)

---

### Cleanup After Verification

```bash
# Close test issue
gh issue close <ISSUE_NUMBER> --comment "VERIFICATION COMPLETE: SDLC automation rules working correctly"

# Delete feature branch
git checkout main
git branch -D test/sdlc-automation-verification

# Push cleanup (optional)
git push origin --delete test/sdlc-automation-verification
```

---

## TROUBLESHOOTING AUTOMATION RULES

### Common Issues

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Issue not appearing in project | Rule 1 not configured or not enabled | Re-configure Rule 1, ensure toggle is "On" |
| Issue not moving when assigned | Rule 2 condition too specific | Verify condition is "Assigned" (any assignee) |
| PR not triggering issue movement | PR not linked to issue | Ensure PR body includes `Closes #<issue_number>` |
| Issue stuck in "In Progress" | Rule 4 or 5 not configured | Re-configure Rules 4 and 5 |
| Issue not moving to "Done" | Rule 6 not triggering on merge | Check PR was actually merged (not closed) |
| CI failure not blocking issue | Rule 7 workflow filter too specific | Verify workflow run filter matches actual CI |

### Debugging Steps

1. **Check Automations Panel**:
   - Navigate to: https://github.com/users/ranjan-expatready/projects/2
   - Click ** ⚙️ ** → **"Automation"**
   - Verify all 7 rules exist and are enabled

2. **Check Issue Activity Log**:
   - Open test issue: https://github.com/ranjan-expatready/autonomous-engineering-os/issues/<number>
   - Review timeline for automated events
   - Look for "status changed by automation" entries

3. **Check Project Item**:
   - Navigate to project: https://github.com/users/ranjan-expatready/projects/2
   - Click on test issue item
   - Review field values and timestamps

4. **Verify PR Link to Issue**:
   - Open test PR: https://github.com/ranjan-expatready/autonomous-engineering-os/pull/<number>
   - Verify sidebar shows "Linked issues" section
   - Confirm test issue is linked

---

## SUCCESS CRITERIA

The SDLC board automation configuration is considered successfully completed when:

### Functional Criteria

- ✅ All 7 automation rules are configured and enabled
- ✅ Test issue automatically appears in project with status "Backlog"
- ✅ Test issue status transitions correctly at each step:
  - Created → Backlog
  - Assigned → Planned
  - PR Opened → In Progress
  - PR In Review → In Review (PR Open)
  - PR Requires Review → Waiting for Approval
  - PR Merged → Done
- ✅ (Optional test) CI failure → Blocked

### Evidence Criteria

- ✅ Test Issue URL recorded and accessible
- ✅ Test PR URL recorded and accessible
- ✅ Project board URL showing successful state transitions
- ✅ (Optional) Screenshots captured at each step

### Documentation Criteria

- ✅ FRAMEWORK/PROGRESS.md updated to mark automation rules as COMPLETE
- ✅ FRAMEWORK/EVIDENCE_INDEX.md updated with automation evidence
- ✅ FRAMEWORK/MISSING_ITEMS.md updated to remove automation task
- ✅ STATE/STATUS_LEDGER.md updated with automation completion milestone

---

## NEXT STEPS AFTER CONFIGURATION

Once automation rules are configured and verified:

1. **Proceed to Product Definition Phase**:
   - Populate PRODUCT/ directory with product vision
   - Requirements and user stories
   - Begin end-to-end SDLC simulation

2. **Monitor Board Daily**:
   - Founder checks "Blocked" and "Waiting for Approval" columns
   - Agents use board to track work
   - Validate automation continues to work

3. **Monthly Automation Review**:
   - Verify rules still enabled
   - Check for GitHub API changes affecting automation
   - Update rules if workflow changes

---

## REFERENCES

- **Project URL**: https://github.com/users/ranjan-expatready/projects/2
- **GITHUB_PROJECT_SDLC_ARTIFACT.md**: Full SDLC board setup documentation
- **RUNBOOKS/sdlc-board-ops.md**: SDLC board operations runbook
- **GitHub Projects Automation**: https://docs.github.com/issues/planning-and-tracking-with-projects/automating-projects

---

**Last Updated**: 2026-01-25
**Status**: 🟡 PENDING UI CONFIGURATION (awaiting manual configuration via web UI)
**Estimated Configuration Time**: 15-20 minutes
