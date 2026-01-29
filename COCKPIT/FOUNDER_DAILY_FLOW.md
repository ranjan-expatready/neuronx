# Founder Daily Flow — Antigravity Cockpit Integration

## Overview

This document explains the Founder's daily flow in the Antigravity Cockpit and how approvals hand off to Factory execution. This is the operational guide for artifacts-first governance.

---

## DAILY FLOW SUMMARY

**Morning Start**: 9:00 AM (or Founder's preferred time)
1. Receive Automated Daily Brief (or trigger `/brief`)
2. Review Cockpit STATUS panel for current state
3. Review Cockpit APPROVALS panel for pending approvals
4. Approve or reject pending items

**Throughout Day**:
1. Monitor Cockpit for new artifacts and notifications
2. Approve items as they come up
3. Respond to `/status` requests if needed

**End of Day**:
1. Review completed work in COCKPIT/artifacts/
2. Review COCKPIT/logs/ for any issues
3. Check COSTS panel for spending

---

## DAILY FLOW DETAIL

### Step 1: Receive Daily Brief (9:00 AM)

**Automated Daily Brief**:

If configured in Antigravity, you receive an automated daily brief at 9:00 AM with:
- Current objective and progress
- Approvals needed (pending items with risk tier)
- Active blockers and their severity
- Costs (current spending vs budget)
- Releases ready or blocked

**Manual Brief**:

At any time, you can trigger a brief:
- Comment `/brief` on any Issue or PR
- Or trigger "CTO Daily Brief" command in Cockpit

**Brief Content**:

```
== FOUNDER DAILY BRIEF ==

== STATUS SUMMARY ==

Current Objective: [What we're working on]
Progress: [X%] complete
State Machine: [IDLE/PLANNING/EXECUTING/WAITING_FOR_HUMAN]

Recent Milestones:
- [Milestone 1]
- [Milestone 2]

Next Milestone: [Milestone 3]

== APPROVALS NEEDED ==

[N] items awaiting approval:

1. [Item Name]
   Type: [T1_GATE/T2_GATE/PROD_DEPLOY/COST_THRESHOLD]
   Risk Tier: [T1/T2/T3]
   Waiting Since: [Date, X ago]
   Why: [Concise reason]
   Link: [GitHub Issue/PR or artifact]
   Action: Founder must approve via /approve or Cockpit

== BLOCKERS ==

[N] active blockers:

1. [Blocker Description]
   Severity: [CRITICAL/HIGH/MEDIUM/LOW]
   Impact: [What is blocked]
   Expected Resolution: [When]
   Owner: [Agent or human]

== COSTS ==

Current Budget: $[amount]
Spent This Week: $[amount]
Remaining: $[amount]

Warning: [If approaching threshold, note here]

== RELEASES ==

Ready for Release:
- [Release candidate PR # - Title - Link]

Blocked from Release:
- [PR # - Title - Blocker reason]

Last Production Deployment: [date/time]

== SUMMARY ==

[System state summary - healthy/degraded/critical]
[Top priority for Founder]
[One sentence on overall trajectory]
```

---

### Step 2: Review Cockpit STATUS Panel

**Access**: Navigate to Antigravity Cockpit → STATUS panel

**What You See**:
- Current objective and progress percentage
- Active issues count (grouped by priority: P0, P1, P2)
- Active PRs count (grouped by CI status: passing, failing, pending)
- Current blockers (severity: CRITICAL, HIGH, MEDIUM)
- State machine position (IDLE, PLANNING, EXECUTING, WAITING_FOR_HUMAN)
- Last GitHub sync timestamp

**Actions Available**:
- "Refresh Status" - triggers `/status` command to get fresh data
- "View Full STATUS_LEDGER.md" - opens the full state ledger document

**When to Refresh**:
- If data looks stale (last sync > 10 minutes ago)
- After approving/rejecting items
- After Factory completes work

---

### Step 3: Review Cockpit APPROVALS Panel

**Access**: Navigate to Antigravity Cockpit → APPROVALS panel

**What You See**:
- Pending approvals (grouped by risk tier: T1, T2, T3)
- Approval type (T1_GATE, T2_GATE, PROD_DEPLOY, COST_THRESHOLD, etc.)
- Risk tier and required approvers
- How long waiting for approval (timestamp)
- Associated GitHub Issue/PR link
- Associated artifact link (PLAN, EXECUTION, VERIFICATION, RELEASE)

**Example**:

| Approval Item | Type | Risk Tier | Waiting Since | Action |
|---------------|------|-----------|---------------|--------|
| Production Deploy - v1.2.3 | PROD_DEPLOY | T3 | 2 hours ago | [Approve] |
| Schema Change - User Table | SCHEMA_CHANGES | T1 | 4 hours ago | [Approve] |
| Feature - User Profile Upload | T2_GATE | T2 | 6 hours ago | [Approve] |

**How to Review**:

1. **Click on Approval Item**: Opens full approval artifact
2. **Read Artifact Summary**: One-line plain English summary
3. **Review Risk Assessment**: Risk tier and risk categories
4. **Review Cost Estimate**: If applicable
5. **Review Verification Status**: If VERIFICATION or RELEASE artifact
6. **Review Rollback Plan**: If PROD_DEPLOY or SCHEMA_CHANGE gate
7. **Check Linked Issue/PR**: Click GitHub link for more context

**Approval Actions**:

**Approve**:
- Click "APPROVE" button in Cockpit
- Or comment `/approve` on GitHub Issue
- Factory resumes execution

**Reject**:
- Click "REJECT" button in Cockpit and enter reason
- Or comment `/reject: [reason]` on GitHub Issue
- Factory stops work

**Request Changes**:
- Comment `/request-changes: [feedback]` on GitHub Issue
- Factory updates work and resubmits

---

### Step 4: Throughout the Day — Monitor Cockpit

**Notifications**:

You receive notifications for:
- New artifacts created in COCKPIT/artifacts/
- Approval requests (issues labeled `approval-required`)
- Incidents (INCIDENT artifacts with HIGH/CRITICAL severity)

**Monitoring Strategy**:

**Option 1: Passive Monitoring** (Recommended for most days):
- Check Cockpit when you receive notifications
- Review APPROVALS panel every few hours
- Respond to approval requests

**Option 2: Active Monitoring** (During major releases or incidents):
- Keep Cockpit open in browser
- Watch STATUS panel for state changes
- Monitor APPROVALS panel for new items
- Respond immediately to approvals

**Status Requests**:

If you need an update at any time:
- Comment `/status` on any Issue or PR
- Factory responds with current status

---

### Step 5: Approvals Hand Off to Factory Execution

**The Approval → Execution Handoff**:

1. **Factory Detects Gate**:
   - Factory encounters T1/T2 gate, PROD_DEPLOY gate, COST_THRESHOLD gate, etc.
   - Factory STOPS execution immediately
   - Factory triggers COCKPIT/APPROVAL_GATES.md defined gate

2. **Factory Creates Approval Artifact**:
   - Factory creates APPROVAL-{timestamp}-{gate_type}.md artifact
   - Factory includes: summary, risk assessment, cost, verification, rollback
   - Factory updates STATUS_LEDGER.md with `waiting_for_human` status

3. **Cockpit Displays Approval**:
   - Antigravity Cockpit refreshes (every 5 minutes or manual)
   - APPROVALS panel shows new approval item
   - Founder receives notification

4. **Founder Reviews and Approves**:
   - Founder reviews approval artifact in Cockpit or GitHub
   - Founder approves via `/approve` or Cockpit approve button
   - GitHub issue gets `approved` label

5. **Factory Resumes Execution**:
   - Factory receives approval notification
   - Factory updates STATUS_LEDGER.md with approval timestamp
   - Factory resumes execution from stopped position
   - Factory continues work past the gate

6. **Execution Updates Cockpit**:
   - Factory updates EXECUTION artifact with progress
   - STATUS_LEDGER.md updated with new state
   - Cockpit panels reflect progress

**Visual Flow**:

```
          Factory
             |
      (Gate Triggered)
             |
             v
   STOP Execution
             |
             v
   Create Approval Artifact
   (COCKPIT/artifacts/APPROVAL-*.md)
             |
             v
   Update STATUS_LEDGER.md
   (waiting_for_human = true)
             |
             v
   Cockpit Refreshes (5 min)
   APPROVALS Panel Shows Item
             |
             v
   Founder Receives Notification
             |
   Founder Reviews Artifact
             |
   Founder Approves (/approve)
             |
             v
   Factory Receives Approval
             |
             v
   Update STATUS_LEDGER.md
   (approved_timestamp = now)
             |
             v
   Resume Execution
             |
             v
   Update EXECUTION Artifact
   Update STATUS_LEDGER.md
   Cockpit Reflects Progress
```

---

### Step 6: End of Day — Review Completed Work

**Review Completed Artifacts**:

1. **Navigate to COCKPIT/artifacts/**
2. **Filter by Status**: Look for artifacts with status `COMPLETE`
3. **Review Summary**: Read founder summaries of each completed artifact
4. **Verify Results** (optional):
   - Click GitHub links to verify merges
   - Click CI links to verify passing tests
   - Check app for deployed features

**Review Logs**:

1. **Navigate to COCKPIT/logs/**
2. **Review recent deployment logs** (REL-*.log)
3. **Review incident logs** (if any) (INC-*.log)
4. **Identify any issues** that need follow-up

**Check Costs**:

1. **Navigate to Cockpit COSTS panel**
2. **Review spending vs budget**
3. **Check if any cost threshold warnings**
4. **Review pending cost approvals**

**Daily Summary**:

At the end of the day, the Founder should have:
- [ ] Reviewed and responded to all pending approvals
- [ ] Reviewed completed work for the day
- [ ] Reviewed logs for any issues
- [ ] Checked costs and confirmed within budget
- [ ] Notified Factory of any issues or concerns

---

## APPROVAL GATES QUICK REFERENCE

| Gate Type | Trigger | Founder Required | Auto-Approve Possible |
|-----------|---------|------------------|----------------------|
| T1_GATE | Risk tier T1 | YES | NO |
| T2_GATE | Risk tier T2 | YES | NO |
| PROD_DEPLOY | Production release | YES | NO |
| COST_THRESHOLD | Cost ≥ $100 | YES | NO |
| AUTH_BILLING_SECURITY | Affects auth/billing/security | YES | NO |
| SCHEMA_CHANGES | Database schema changes | YES | NO |
| OUT_OF_SCOPE | Work outside repo scope | YES | NO |
| INCIDENT_RESPONSE | HIGH/CRITICAL incident | YES (acknowledge) | NO |

---

## COCKPIT COMMANDS QUICK REFERENCE

| Command | Description | Triggered By |
|---------|-------------|--------------|
| `/status` | Plain-English status report | Any Issue/PR comment |
| `/resume` | Resume autonomous work | Any Issue/PR comment |
| `/brief` | Founder daily brief | Any Issue/PR comment or scheduled |
| `/approve` | Approve pending approval | Founder comment on Issue |
| `/reject: [reason]` | Reject pending approval | Founder comment on Issue |
| `/request-changes: [feedback]` | Request changes to work | Founder comment on Issue |
| `/refresh` | Refresh Cockpit data | Cockpit button or comment |

---

## TROUBLESHOOTING

### Cockpit Not Updating

**Problem**: Cockpit panels show stale data

**Solution**:
1. Click "Refresh Status" on STATUS panel
2. Or comment `/refresh` on any Issue
3. Check STATE/STATUS_LEDGER.md is up-to-date
4. Check GitHub webhook is receiving events

### Approval Not Processing

**Problem**: You approved but Factory didn't resume

**Solution**:
1. Check GitHub issue has `approved` label
2. Check Issue comment has "APPROVED" text
3. Check Cockpit APPROVALS panel shows approval
4. Check Factory is operational (not paused/crashed)
5. Review COCKPIT/logs/ for Factory errors

### Missing Approval Request

**Problem**: No approval appeared in Cockpit for T1/T2 work

**Solution**:
1. Check STATE/STATUS_LEDGER.md for `waiting_for_human`
2. Check COCKPIT/artifacts/ for APPROVAL artifacts
3. Check Factory logs for gate detection errors
4. Verify GOVERNANCE/ files are correctly configured

### Daily Brief Not Received

**Problem**: No automated daily brief at expected time

**Solution**:
1. Check Antigravity scheduling configuration
2. Check notification channels are configured
3. Manually trigger `/brief` to test
4. Check Factory is operational

---

## BEST PRACTICES

### For Founder

1. **Review Approvals Promptly**: Approvals block autonomous work. Respond within a few hours.
2. **Read Full Artifacts**: Don't just skim summaries. Review full artifacts for T1/T2 work.
3. **Check Daily**: Check Cockpit at least once a day, even if no notifications.
4. **Provide Clear Feedback**: If rejecting or requesting changes, be specific about why.
5. **Monitor Costs**: Check COSTS panel regularly to avoid surprises.

### For Factory

1. **Always Stop at Gates**: Never proceed past a gate without explicit approval.
2. **Create Clear Artifacts**: Founder summaries should be plain English and concise.
3. **Update STATE Files**: Always update STATUS_LEDGER.md and LAST_KNOWN_STATE.md.
4. **Notify Promptly**: Trigger notifications when approvals are needed.
5. **Document Decisions**: Record all approvals and rejections in artifacts.

---

## SUPPORT AND ESCALATION

### Where to Get Help

1. **Review Documentation**:
   - COCKPIT/ANTIGRAVITY_COCKPIT_SPEC.md - Cockpit specification
   - COCKPIT/APPROVAL_GATES.md - Approval gate definitions
   - RUNBOOKS/antigravity-setup.md - Setup and troubleshooting

2. **Create Issue**:
   - Create GitHub Issue with label `cockpit-issue`
   - Describe problem, include screenshots/logs

3. **Urgent Issues**:
   - If blocking all autonomous work, escalate immediately
   - Comment `/urgent` on issue for priority attention

---

## VERSION HISTORY

- v1.0 (Initial): Founder daily flow documentation with approval handoff explanation

---

**Document Version**: v1.0
**Last Updated**: 2026-01-23 by CTO Agent
