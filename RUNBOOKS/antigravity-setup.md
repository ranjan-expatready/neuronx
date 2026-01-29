# Antigravity Setup — Step-by-Step Setup Checklist

## Overview

This runbook provides a step-by-step checklist to configure Antigravity for the Autonomous Engineering OS repository. When properly configured, Antigravity provides the Founder Cockpit Manager View, enabling artifacts-first governance workflow.

---

## PRE-REQUISITES

### Required Access

1. **GitHub Repository Access**:
   - Owner or admin access to target repository
   - GitHub CLI (`gh`) installed and authenticated
   - GitHub Personal Access Token with appropriate permissions

2. **Antigravity Account**:
   - Active Antigravity account
   - Administrative access to Antigravity workspace
   - Ability to configure webhooks and integrations

3. **Factory Configuration**:
   - Factory CLI installed with proper authentication
   - Factory tokens available for integration

### Target Information

Before starting, gather:
- Repository owner: `ranjan-expatready` (or your owner)
- Repository name: `autonomous-engineering-os`
- Default branch: `main`
- GitHub organization (if applicable)

---

## STEP 1: CONNECT REPOSITORY TO ANTIGRAVITY

### 1.1. Authenticate with GitHub

```bash
# Verify GitHub CLI is installed and authenticated
gh auth status

# If not authenticated:
gh auth login
# Select: GitHub.com > HTTPS > Yes (upload SSH key) > Login with a web browser
```

**Expected Output**: Shows authenticated account with appropriate scopes.

### 1.2. Connect Repository in Antigravity

**In Antigravity UI**:

1. Navigate to **Settings** → **Repositories**
2. Click **Connect Repository**
3. Select: `ranjan-expatready/autonomous-engineering-os`
4. Grant permissions:
   - ✅ Read repository content
   - ✅ Read/write issues and pull requests
   - ✅ Read and writeActions, deployments
   - ✅ Access webhooks
5. Click **Connect**

**Verify Connection**:
- Repository appears in Antigravity's connected repositories list
- Repository shows "Connected" status

---

## STEP 2: LOCATE ARTIFACTS

### 2.1. Create Artifact Directory Structure

```bash
# Navigate to repository root
cd /Users/ranjansingh/Desktop/autonomous-engineering-os

# Create COCKPIT directory structure
mkdir -p COCKPIT/artifacts
mkdir -p COCKPIT/evidence
mkdir -p COCKPIT/logs
mkdir -p COCKPIT/post-mortems
mkdir -p COCKPIT/skills/proposals
mkdir -p COCKPIT/sandbox

# Create STATE directory structure (if not exists)
mkdir -p STATE/backup

# Create artifact index file
touch COCKPIT/ARTIFACT_INDEX.md
```

### 2.2. Verify Cockpit Documents Exist

Check that all cockpit documents are in place:

```bash
# List cockpit documents
ls -la COCKPIT/
```

**Expected Files**:
- `ANTIGRAVITY_COCKPIT_SPEC.md`
- `ARTIFACT_TYPES.md`
- `APPROVAL_GATES.md`
- `SKILLS_POLICY.md`
- `ARTIFACT_INDEX.md` (created in 2.1)

**Missing Files?** If any of the above are missing, create them from the templates in this repository.

### 2.3. Configure Antigravity to Read COCKPIT/

**In Antigravity UI**:

1. Navigate to **Settings** → **Data Sources**
2. Add **Repository File Source**:
   - Name: `Cockpit Artifacts`
   - Repository: `ranjan-expatready/autonomous-engineering-os`
   - Directory: `COCKPIT/`
   - File types: `.md` (markdown)
   - Refresh rate: Every 5 minutes
3. Click **Save**

**Configuration Check**:
- Antigravity can read COCKPIT/ files
- Cockpit spec, artifact types, approval gates are visible in Antigravity

---

## STEP 3: CONFIGURE COMMENT WORKFLOW

### 3.1. Configure GitHub Webhook (for comment triggers)

**Option A: Via Antigravity UI** (Recommended)

1. Navigate to **Settings** → **Webhooks**
2. Click **Create Webhook**
3. Configure:
   - Repository: `ranjan-expatready/autonomous-engineering-os`
   - Webhook URL: `https://api.antigravity.app/webhook/github` (use your Antigravity webhook URL)
   - Content type: `application/json`
   - Secret: Generate and store securely
   - Trigger events:
     - ✅ Issue comments
     - ✅ Pull request comments
     - ✅ Pull request reviews
4. Click **Create Webhook**

**Option B: Via GitHub CLI**

```bash
# Create webhook
gh api repos/ranjan-expatready/autonomous-engineering-os/hooks \
  --method POST \
  -f name="antigravity-cmd-trigger" \
  -f active=true \
  -f events='["issue_comment","pull_request_comment","pull_request_review"]' \
  -f config='{
    "url": "https://api.antigravity.app/webhook/github",
    "content_type": "json",
    "secret": "YOUR_WEBHOOK_SECRET_HERE"
  }'
```

### 3.2. Configure Antigravity to Process Comments

**In Antigravity UI**:

1. Navigate to **Settings** → **Command Triggers**
2. Add **Comment Command Triggers**:

| Trigger Keyword | Factory Command | Description |
|-----------------|-----------------|-------------|
| `/status` | Execute STATUS template | Request status report |
| `/resume` | Execute RESUME template | Resume autonomous work |
| `/brief` | Execute DAILY_BRIEF template | Request daily brief |
| `/approve` | Approve pending approval | Approve work item |
| `/reject` | Reject pending approval | Reject work item |
| `/refresh` | Execute COCKPIT_REFRESH | Refresh cockpit data |

3. Save triggers

**Verification**:
- Each trigger is mapped to correct Factory command
- Triggers are active

### 3.3. Test Comment Workflow

**In GitHub**:

1. Open an existing Issue or PR in the repository
2. Comment with: `/status`
3. Observe:
   - Comment is detected by webhook
   - Antigravity processes the command
   - Factory executes STATUS template
   - Status response is posted as a comment

**Expected Response**:
```
Factory, please provide a status report.

Report on:
1. Current objective and progress
2. Active issues and PRs
3. Current blockers
4. Next actions (ordered by priority)
5. What needs human approval (if anything)
```

If the test fails:
- Check webhook is receiving events
- Check Antigravity is processing webhooks
- Check Factory commands are correctly configured

---

## STEP 4: CONFIGURE APPROVAL WORKFLOW

### 4.1. Configure GitHub Labels for Approval Workflow

```bash
# Create approval workflow labels
gh api repos/ranjan-expatready/autonomous-engineering-os/labels \
  --method POST \
  -f name="approval-required" \
  -f color="d93f0b" \
  -f description="Requires founder approval before proceed"

gh api repos/ranjan-expatready/autonomous-engineering-os/labels \
  --method POST \
  -f name="approved" \
  -f color="bfd4f2" \
  -f description="Approved by founder"

gh api repos/ranjan-expatready/autonomous-engineering-os/labels \
  --method POST \
  -f name="rejected" \
  -f color="e99695" \
  -f description="Rejected by founder"
```

### 4.2. Configure Antigravity Cockpit Approval Actions

**In Antigravity UI**:

1. Navigate to **Cockpit** → **APPROVALS Panel** → **Settings**
2. Configure **Approval Actions**:

**Approve Action**:
- Action Name: `Approve`
- Trigger: Comment with `/approve` OR click Approve button
- Effect: Add `approved` label, remove `approval-required` label
- Comment: "APPROVED by Founder"
- Notify: Send notification to Factory

**Reject Action**:
- Action Name: `Reject`
- Trigger: Comment with `/reject: [reason]` OR click Reject button
- Effect: Add `rejected` label, remove `approval-required` label
- Comment: "REJECTED by Founder: [reason]"
- Notify: Send notification to Factory

**Request Changes Action**:
- Action Name: `Request Changes`
- Trigger: Comment with `/request-changes: [feedback]`
- Effect: Add `needs-changes` label (if not exists)
- Comment: "REQUEST_CHANGES by Founder: [feedback]"
- Notify: Send notification to Factory

3. Save approval actions

### 4.3. Test Approval Workflow

**Create Test Issue**:

```bash
# Create test issue for approval workflow
gh issue create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "Test Approval Workflow" \
  --body "Test issue for approval workflow configuration." \
  --label "approval-required"
```

**Test Approval**:

1. Open the test issue in GitHub
2. Comment: `/approve`
3. Observe:
   - Issue gets `approved` label
   - Issue loses `approval-required` label
   - Comment "APPROVED by Founder" appears
   - Factory (if configured) receives notification

**Test Reject**:

1. Remove `approved` label from issue
2. Re-add `approval-required` label
3. Comment: `/reject: Testing reject workflow`
4. Observe:
   - Issue gets `rejected` label
   - Issue loses `approval-required` label
   - Comment "REJECTED by Founder: Testing reject workflow" appears

**Clean Up**:

```bash
# Close test issue when done
gh issue close <issue-number> --repo ranjan-expatready/autonomous-engineering-os
```

---

## STEP 5: CONFIGURE STATUS/RESUME/DAILY_BRIEF TRIGGERS

### 5.1. Configure Factory Commands in Antigravity

**In Antigravity UI**:

1. Navigate to **Settings** → **Factory Integration**
2. Add **Factory Command Mappings**:

| Command | Factory Action | Description |
|---------|----------------|-------------|
| `/status` | Execute AGENTS/PROMPT_TEMPLATES.md STATUS template | Plain-English status report |
| `/resume` | Execute RUNBOOKS/resume-protocol.md | Resume autonomous work from interruption |
| `/brief` | Execute AGENTS/PROMPT_TEMPLATES.md CTO_DAILY_BRIEF (when created) | Daily founder brief |
| `/refresh` | Execute AGENTS/PROMPT_TEMPLATES.md COCKPIT_REFRESH (when created) | Refresh cockpit data |

3. Save mappings

### 5.2. Configure Scheduled Briefs (Optional)

**In Antigravity UI**:

1. Navigate to **Settings** → **Schedules**
2. Add **Daily Brief Schedule**:
   - Name: `Founder Daily Brief`
   - Command: `/brief`
   - Trigger: Every day at 9:00 AM (Founder's timezone)
   - Target: Post comment on specific "Daily Briefs" Issue OR send email/digest
3. Save schedule

### 5.3. Test STATUS Command

**In GitHub** (or Antigravity Cockpit):

1. Open any issue or PR
2. Comment `/status`
3. Expected behavior:
   - Factory executes STATUS template
   - Factory reads STATE/STATUS_LEDGER.md and STATE/LAST_KNOWN_STATE.md
   - Factory scans GitHub for current issues/PRs
   - Factory compiles plain-English status report
   - Report is posted as comment

**Expected Output Format** (from AGENTS/PROMPT_TEMPLATES.md):

```
== CURRENT OBJECTIVE AND PROGRESS ==

We're currently working on: [Objective]

Progress: [X%] complete
Milestones reached: [Milestone 1, Milestone 2]
Next milestone: [Milestone 3]

== ACTIVE ISSUES AND PRs ==

Open Issues (3):
- #123: [Title] - [Priority] - [Link]
- #124: [Title] - [Priority] - [Link]
- #125: [Title] - [Priority] - [Link]

Open PRs (2):
- PR #42: [Title] - [CI Status] - [Target Branch] - [Link]
- PR #43: [Title] - [CI Status] - [Target Branch] - [Link]

== CURRENT BLOCKERS ==

1. [Blocker 1] - [Severity]
   Impact: [Description]
   Expected resolution: [Timeline]

2. [Blocker 2] - [Severity]
   Impact: [Description]
   Expected resolution: [Timeline]

== NEXT ACTIONS ==

1. [Action #1] - [HIGHEST]
   Owner: [Agent]
   Estimated time: [X min/hr/day]
   Dependencies: [List]

2. [Action #2] - [HIGH]
   Owner: [Agent]
   Estimated time: [X min/hr/day]
   Dependencies: [List]

== NEEDS HUMAN APPROVAL ==

1. [Item #1]
   Why: [Reason]
   Risk Tier: [T1/T2/T3]
   Waiting since: [Date]
```

### 5.4. Test RESUME Command

**Note**: Only test RESUME if you are okay with Factory potentially resuming autonomous work.

**In GitHub** (or Antigravity Cockpit):

1. Open the "Daily Briefs" issue or create new issue
2. Comment: `/resume`

**Expected Behavior**:
1. Factory executes resume protocol from RUNBOOKS/resume-protocol.md
2. Factory reads all GOVERNANCE files
3. Factory reads STATE files
4. Factory scans GitHub
5. Factory reconstructs state
6. Factory begins executing next action

**Warning**: RESUME will cause Factory to start autonomous execution. Only use when you want Factory to resume.

---

## STEP 6: CONFIGURE COCKPIT PANELS

### 6.1. Configure Antigravity Cockpit Panels

**In Antigravity UI**:

1. Navigate to **Cockpit** → **Panel Configuration**
2. Configure **STATUS Panel**:
   - Name: `STATUS`
   - Data Sources:
     - STATE/STATUS_LEDGER.md
     - STATE/LAST_KNOWN_STATE.md
     - GitHub Issues API
     - GitHub PR API
   - Display Fields:
     - Current objective and progress
     - Active issues count (by priority)
     - Active PRs count (by CI status)
     - Current blockers (by severity)
     - State machine position
     - Last GitHub sync timestamp
   - Actions:
     - Refresh status (triggers `/status`)
     - View full STATUS_LEDGER.md
   - Refresh Rate: Every 5 minutes

3. Configure **ACTIVE WORK Panel**:
   - Name: `ACTIVE WORK`
   - Data Sources:
     - STATE/STATUS_LEDGER.md (next actions)
     - GitHub Issues API
     - GitHub PR API
     - COCKPIT/ARTIFACT_INDEX.md
   - Display Fields:
     - In-progress items
     - Active PRs (with links, CI status)
     - Active artifacts
     - Current agent activity
     - Work item priority
   - Actions:
     - View artifact
     - Request update
     - Create new work item

4. Configure **APPROVALS Panel**:
   - Name: `APPROVALS`
   - Data Sources:
     - STATE/STATUS_LEDGER.md (waiting section)
     - GOVERNANCE/GUARDRAILS.md
     - GOVERNANCE/RISK_TIERS.md
     - GitHub Issues API (approval-required label)
     - GitHub PR API
   - Display Fields:
     - Pending approvals (by risk tier)
     - Approval type
     - Risk tier and approvers
     - How long waiting
     - Associated Issue/PR link
     - Associated artifact link
   - Actions:
     - Approve (/approve)
     - Reject (/reject)
     - Request Changes (/request-changes)
     - View artifact

5. Configure **RISKS Panel**:
   - Name: `RISKS`
   - Data Sources:
     - GOVERNANCE/RISK_TIERS.md
     - STATE/STATUS_LEDGER.md (blockers)
     - GitHub Issues API (risk labels)
   - Display Fields:
     - Current overall risk level
     - Active high-risk items
     - Risk categories
     - Mitigation strategies
     - Risk trends
   - Actions:
     - View risk tier details
     - Elevate risk tier
     - Request mitigation plan

6. Configure **COSTS Panel**:
   - Name: `COSTS`
   - Data Sources:
     - GOVERNANCE/COST_POLICY.md
     - STATE/STATUS_LEDGER.md (cost tracking)
   - Display Fields:
     - Current budget and remaining
     - Daily/weekly spending trend
     - Current cost vs budget (percentage)
     - Pending cost estimates
     - Cost threshold proximity
   - Actions:
     - View cost policy
     - Request budget adjustment

7. Configure **RELEASES Panel**:
   - Name: `RELEASES`
   - Data Sources:
     - GOVERNANCE/DEFINITION_OF_DONE.md
     - STATE/STATUS_LEDGER.md (CI/CD)
     - GitHub PR API (target: main)
     - GitHub Releases API
   - Display Fields:
     - Release candidate PRs
     - DoD compliance status
     - Release readiness status
     - Last production deployment
     - Rollback plan status
   - Actions:
     - View release checklist
     - Approve deployment
     - Request release notes

3. Save all panel configurations

### 6.2. Verify Cockpit Panels

**In Antigravity Cockpit**:

1. Navigate to Cockpit Manager View
2. Verify each panel displays correctly with data from repository
3. Click panel actions to verify integration

**Expected Result**:
- All panels show current data from STATE/ and COCKPIT/
- Panel actions trigger correct Factory commands
- Data refreshes automatically every 5 minutes

---

## STEP 7: CONFIGURE ARTIFACT NOTIFICATIONS

### 7.1. Configure Artifact Creation Notifications

**In Antigravity UI**:

1. Navigate to **Settings** → **Notifications**
2. Add **Artifact Creation Notification**:
   - Trigger: New file created in COCKPIT/artifacts/
   - Notify: Founder (via email, Slack, or Antigravity notification)
   - Include: Artifact summary, link to artifact file
   - Priority: Normal (unless T1/T2 risk, then High)
3. Save notification rule

### 7.2. Configure Approval Request Notifications

**Add Approval Request Notification**:
- Trigger: Issue/PR labeled `approval-required`
- Notify: Founder immediately
- Include: Approval reason, risk tier, plan summary
- Priority: High

### 7.3. Configure Incident Notifications

**Add Incident Notification**:
- Trigger: INCIDENT artifact created with severity HIGH/CRITICAL
- Notify: Founder immediately (via multiple channels if possible)
- Include: Incident summary, severity, impact
- Priority: Critical

---

## STEP 8: FINAL VERIFICATION

### 8.1. Complete Setup Checklist

```bash
# Checklist for complete setup

[ ] Step 1: Repository connected to Antigravity
[ ] Step 2.1: COCKPIT directory structure created
[ ] Step 2.2: Cockpit documents verified (all 5 files present)
[ ] Step 2.3: Antigravity configured to read COCKPIT/
[ ] Step 3.1: GitHub webhook created for comment triggers
[ ] Step 3.2: Antigravity configured to process comments (/status, /resume, /brief, /approve, /reject, /refresh)
[ ] Step 3.3: Comment workflow tested (/status responds correctly)
[ ] Step 4.1: GitHub labels created (approval-required, approved, rejected)
[ ] Step 4.2: Antigravity approval actions configured
[ ] Step 4.3: Approval workflow tested (approve/reject work correctly)
[ ] Step 5.1: Factory command mappings configured
[ ] Step 5.2: Daily brief schedule configured (optional)
[ ] Step 5.3: STATUS command tested (responds correctly)
[ ] Step 5.4: RESUME command tested (optional, only if ready to resume)
[ ] Step 6.1: Cockpit panels configured (all 6 panels)
[ ] Step 6.2: Cockpit panels verified (display correct data)
[ ] Step 7.1: Artifact creation notifications configured
[ ] Step 7.2: Approval request notifications configured
[ ] Step 7.3: Incident notifications configured
```

### 8.2. End-to-End Test

**Test Complete Flow**:

1. **Create Test Plan Artifact**:
   - Create COCKPIT/artifacts/PLAN-TEST-[timestamp].md with test plan
   - Observe: Founder receives notification of new artifact

2. **Test Cockpit Display**:
   - Check Cockpit ACTIVE WORK panel shows new artifact
   - Check Cockpit displays correct summary

3. **Test Approval Flow**:
   - Create Issue for test plan
   - Add `approval-required` label
   - Observe: Founder receives approval notification
   - Founder approves via `/approve`
   - Observe: Issue gets `approved` label

4. **Test Status Reporting**:
   - Comment `/status` on any issue
   - Observe: Status report comments back

5. **Test Cockpit Refresh**:
   - Modify STATE/STATUS_LEDGER.md
   - Wait 5 minutes (or click Refresh)
   - Observe: Cockpit panels update

### 8.3. Troubleshooting Common Issues

**Webhook Not Receiving Events**:
- Check webhook is active in GitHub repository settings
- Check webhook secret matches between GitHub and Antigravity
- Check webhook URL is correct and accessible

**Commands Not Triggering Factory**:
- Check Factory command mappings are correct in Antigravity
- Check Factory is authenticated and has access to execute commands
- Check command keywords match exactly (case-sensitive)

**Cockpit Not Showing Data**:
- Check COCKPIT/ directory is accessible to Antigravity
- Check ARTIFACT_INDEX.md exists and is formatted correctly
- Check refresh intervals are configured correctly

**Notifications Not Sending**:
- Check notification rules are active
- Check notification channels are configured (email, Slack)
- Check notification priority thresholds

---

## SETUP COMPLETE

### What's Configured

When setup is complete, you should have:

1. ✅ Repository connected to Antigravity
2. ✅ COCKPIT/ directory structure and documents
3. ✅ GitHub webhook for comment triggers
4. ✅ Factory command mappings (/status, /resume, /brief, /approve, /reject, /refresh)
5. ✅ Approval workflow with GitHub labels
6. ✅ Cockpit panels (STATUS, ACTIVE WORK, APPROVALS, RISKS, COSTS, RELEASES)
7. ✅ Notifications for artifacts, approvals, and incidents

### Daily Workflow for Founder

**Morning Brief**:
- Check Cockpit or receive automated daily brief
- Review STATUS panel for current state
- Review APPROVALS panel for pending approvals

**Throughout Day**:
- Monitor Cockpit for new artifacts and notifications
- Approve pending items in APPROVALS panel
- Respond to `/status` and `/brief` commands if needed

**End of Day**:
- Review COCKPIT/ artifacts for completed work
- Review COCKPIT/logs/ for any issues
- Check COSTS panel for spending

### Factory and Antigravity Integration

With setup complete:

```
GitHub Issues/PRs
       ↓
Antigravity Cockpit (Manager View)
       ↓
STATUS/DAILY_BRIEF command
       ↓
Factory (Autonomous Execution)
       ↓
COCKPIT/ Artifacts + STATE/ files
       ↓
Updated Cockpit Display
```

---

## VERSION HISTORY

- v1.0 (Initial): Complete Antigravity setup checklist for Autonomous Engineering OS

---

**Runbook Version**: v1.0
**Last Updated**: 2026-01-23 by CTO Agent
