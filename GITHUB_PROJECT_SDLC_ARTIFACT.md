# GitHub Project SDLC Setup — Artifact

## Project Overview

**Project Name**: Autonomous Engineering OS — SDLC  
**Repository**: `ranjan-expatready/autonomous-engineering-os`  
**Type**: GitHub Project v2 (Kanban Board)  
**Purpose**: Live SDLC state reference for the Autonomous Engineering OS framework

> **IMPORTANT**: This project must be created manually due to GitHub API token scope limitations.
> Follow the setup instructions below.

---

## SETUP INSTRUCTIONS

### Prerequisite: GitHub Authentication

Before creating the GitHub Project, ensure your GitHub token has the necessary scopes:

```
Required Scopes:
- repo (already present)
- project (required for Projects v2)
- read:project (required for reading project data)
```

To update your token scopes:

1. Go to: https://github.com/settings/tokens
2. Find your current "Factory" token
3. Click "Edit"
4. Add scopes: ✓ project, ✓ read:project
5. Save and re-authenticate with `gh auth login`

---

### Step 1: Create the GitHub Project v2

#### Method A: Using GitHub Web UI (Recommended)

1. Navigate to: https://github.com/ranjan-expatready/autonomous-engineering-os
2. Click on "Projects" tab
3. Click "New Project"
4. Select "Project V2" (Beta)
5. Set:
   - **Owner**: `ranjan-expatready/autonomous-engineering-os`
   - **Name**: `Autonomous Engineering OS — SDLC`
   - **Description**: Live SDLC state machine for the Autonomous Engineering OS framework
   - **Template**: None
   - **Visibility**: Private (recommended for internal operations)
6. Click "Create Project"

#### Method B: Using GitHub CLI (After Scope Update)

```bash
# After updating token scopes, run:
gh api graphql -f query='mutation {
  createProjectV2(
    input: {
      ownerId: "R_kgDOGQvF4g",
      title: "Autonomous Engineering OS — SDLC",
      description: "Live SDLC state machine for the Autonomous Engineering OS framework",
      repositoryId: "R_kgDOGQvF4g"
    }
  ) {
    projectV2 {
      id
      number
      url
      title
    }
  }
}'
```

**Expected Output**:
```json
{
  "data": {
    "createProjectV2": {
      "projectV2": {
        "id": "PVT_kwDOGZ...",
        "number": 1,
        "url": "https://github.com/ranjan-expatready/autonomous-engineering-os/projects/1",
        "title": "Autonomous Engineering OS — SDLC"
      }
    }
  }
}
```

---

### Step 2: Configure Custom Fields

Navigate to your new project and configure the following custom fields:

#### Field 1: Type (Single Select)

1. Click on the ⋮ menu (top right)
2. Select "Settings" → "Fields"
3. Click "New field"
4. Set:
   - **Name**: Type
   - **Type**: Single select
   - **Options** (in this order):
     - Epic (Color: Purple #8957e5)
     - Feature (Color: Green #3fb950)
     - Bug (Color: Red #f85149)
     - Incident (Color: Red #da3633)
     - Tech Debt (Color: Orange #d29922)

#### Field 2: Risk Tier (Single Select)

1. Click "New field"
2. Set:
   - **Name**: Risk Tier
   - **Type**: Single select
   - **Options** (in this order):
     - T0 (Color: Red #da3633) - Critical, production-affecting
     - T1 (Color: Orange #d29922) - High risk, requires explicit approval
     - T2 (Color: Yellow #e3b341) - Medium risk, breaking changes
     - T3 (Color: Green #3fb950) - Low risk, autonomous execution

#### Field 3: Owner (Single Select)

1. Click "New field"
2. Set:
   - **Name**: Owner
   - **Type**: Single select
   - **Options** (in this order):
     - Product (Color: Blue #58a6ff)
     - Code (Color: Green #3fb950)
     - Reliability (Color: Orange #d29922)
     - Knowledge (Color: Purple #8957e5)
     - Advisor (Color: Gray #8b949e)

#### Field 4: Release (Text)

1. Click "New field"
2. Set:
   - **Name**: Release
   - **Type**: Text
   - **Description**: Release version (e.g., v1.2.0, TBD, Backlog)

---

### Step 3: Create Kanban Columns (Statuses)

Configure the project board with the following statuses in order:

1. **Backlog** (Default status for new issues)
2. **Planned**
3. **In Progress**
4. **In Review (PR Open)**
5. **Waiting for Approval**
6. **Blocked**
7. **Ready for Release**
8. **Done**

**Setup Steps**:
1. Click on "⚙️ View settings" (top right dropdown)
2. Click "View configuration"
3. Under "Group by", select "Status"
4. The statuses should appear; reorder them if needed:
   - Drag-and-drop columns to match the order above
5. Ensure custom fields are visible:
   - Click "⚙️ View settings" → "Show fields"
   - Enable: Type, Risk Tier, Owner, Release

---

### Step 4: Set Up Automation Rules

GitHub Projects v2 supports automation through the native workflow. Configure these rules:

1. Open the project
2. Click "⚙️" → "Automation" (in left sidebar)
3. Add the following automation rules:

| Rule | Trigger | Action |
|------|---------|--------|
| 1 | Issue is created | Set status to "Backlog" |
| 2 | Issue is assigned | Set status to "Planned" |
| 3 | Pull request is opened | Set status to "In Progress" |
| 4 | Pull request is in review | Set status to "In Review (PR Open)" |
| 5 | Pull request requires review | Set status to "Waiting for Approval" |
| 6 | Pull request is merged | Set status to "Done" |
| 7 | CI workflow fails | Set status to "Blocked" |

**Setup Details for Each Rule**:

- **Rule 1 - New Issues Backlog**:
  - Trigger: Issue
  - Condition: Created
  - Action: Set status = Backlog

- **Rule 2 - Assigned Issues Planned**:
  - Trigger: Issue
  - Condition: Assignee is assigned (any)
  - Action: Set status = Planned

- **Rule 3 - PR Opens Issue to Progress**:
  - Trigger: Pull request
  - Condition: Opened
  - Action: Find linked issue → Set status = In Progress

- **Rule 4 - PR in Review**:
  - Trigger: Pull request
  - Condition: Status = In review
  - Action: Set linked issue status = In Review (PR Open)

- **Rule 5 - PR Needs Approval**:
  - Trigger: Pull request
  - Condition: Review required
  - Action: Set linked issue status = Waiting for Approval

- **Rule 6 - PR Merged Done**:
  - Trigger: Pull request
  - Condition: Merged (closed and merged = true)
  - Action: Set linked issue status = Done

- **Rule 7 - CI Failure Blocked**:
  - Trigger: Workflow run
  - Condition: Status = Failure
  - Action: Find linked issue → Set status = Blocked

---

### Step 5: Create Three Views

Create saved views for different stakeholders:

#### View 1: Founder View (High-level, by Status)

1. Click "⚙️ View settings" → "Save view"
2. Set:
   - **Name**: Founder View
   - **Group by**: Status
   - **Sort by**: Risk Tier (descending: T0, T1, T2, T3)
   - **Layout**: Board (default)
   - **Fields visible**: Type, Risk Tier, Owner, Release

**Purpose**: Founder sees all work by status, with highest-risk items first.

#### View 2: Engineering View (By Owner)

1. Click "⚙️ View settings" → "Save view"
2. Set:
   - **Name**: Engineering View
   - **Group by**: Owner
   - **Sort by**: Status (in Kanban order)
   - **Layout**: Board
   - **Fields visible**: Type, Risk Tier, Release

**Purpose**: Each owner (Product, Code, Reliability, Knowledge, Advisor) sees their active work.

#### View 3: Release View (By Release)

1. Click "⚙️ View settings" → "Save view"
2. Set:
   - **Name**: Release View
   - **Group by**: Release
   - **Sort by**: Status
   - **Layout**: Table (better for release planning)
   - **Fields visible**: Type, Risk Tier, Owner, Status

**Purpose**: See all items destined for a specific release, track release readiness.

---

## PROJECT URL AND ACCESS

### Primary Access Points

Once created, the project will be accessible at:

```
GitHub Project URL:
https://github.com/ranjan-expatready/autonomous-engineering-os/projects/[project-number]

Repository Projects Tab:
https://github.com/ranjan-expatready/autonomous-engineering-os/projects
```

### Bookmark for Quick Access

- **Founder**: Bookmark the "Founder View"
- **Engineering Team**: Bookmark the "Engineering View"
- **CTO Agent**: Programmatic access via GitHub API
- **Release Manager**: Bookmark the "Release View"

---

## BOARD LAYOUT (Screenshot-style Text Representation)

```
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│                    │                     │                     │                     │
│     BACKLOG        │      PLANNED        │    IN PROGRESS      │   IN REVIEW (PR)   │
│  ┌───────────────┐ │  ┌───────────────┐  │  ┌───────────────┐  │  ┌───────────────┐  │
│  │ #42 Epic:     │ │  │ #7 Feature:   │ │  │ #3 Feature:   │ │  │ #1 Feature:   │  │
│  │ Auth System   │ │  │ User Profile  │ │  │ Login Page    │ │  │ API Endpoints │ │  │
│  │ Type: Epic    │ │  │ Type: Feature │ │  │ Type: Feature │ │  │ Type: Feature │ │  │
│  │ Risk: T3      │ │  │ Risk: T2      │ │  │ Risk: T3      │ │  │ Risk: T2      │ │  │
│  │ Owner: Prod.  │ │  │ Owner: Code   │ │  │ Owner: Code   │ │  │ Owner: Code   │ │  │
│  │ Release: TBD  │ │  │ Release: 1.2  │ │  │ Release: 1.2  │ │  │ Release: 1.2  │ │  │
│  └───────────────┘ │  │ #8 Bug:       │ │  │ #4 Tech Debt: │ │  │ #2 Incident:  │ │  │
│  │               │ │  │ Broken Link   │ │  │ Refactor DB   │ │  │ Outage Recovery│ │
│  │               │ │  │ Type: Bug     │ │  │ Type: Debt    │ │  │ Type: Incident│ │
│  │               │ │  │ Risk: T2      │ │  │ Risk: T1      │ │  │ Risk: T0      │ │  │
│  │               │ │  │ Owner: Rel.   │ │  │ Owner: Code   │ │  │ Owner: Rel.   │ │  │
│  │               │ │  │ Release: 1.1.1│ │  │ Release: 1.3  │ │  │ Release: 1.1.0│ │  │
│  │               │ │  └───────────────┘ │  └───────────────┘ │  └───────────────┘  │
│  │               │ │                    │                    │                    │
│  └───────────────┘ │ └──────────────────┘ │ └──────────────────┘ │ └──────────────────┘ │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘

┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│                    │                     │                     │                     │
│ WAITING APPROVAL   │      BLOCKED        │  READY FOR RELEASE  │       DONE          │
│  ┌───────────────┐ │  ┌───────────────┐  │  ┌───────────────┐  │  ┌───────────────┐  │
│  │ #5 Tech Debt: │ │  │ #9 Bug:       │ │  │ #10 Feature:  │ │  │ #11-25 Done   │ │
│  │ DB Migration  │ │  │ API Timeout   │ │  │ Dashboard     │ │  │ (various)     │ │  │
│  │ Type: Debt    │ │  │ Type: Bug     │ │  │ Type: Feature │ │  │               │ │  │
│  │ Risk: T1      │ │  │ Risk: T0      │ │  │ Risk: T3      │ │  └───────────────┘  │
│  │ Owner: Code   │ │  │ Owner: Rel.   │ │  │ Owner: Prod.  │ │  ┌───────────────┐  │
│  │ Release: 1.3  │ │  │ Release: 1.2  │ │  │ Release: 1.2  │ │  │ #26-50 Done   │ │
│  └───────────────┘ │  └───────────────┘ │  └───────────────┘ │  │ (completed)   │ │
│                    │                    │                    │  │               │ │
│  └───────────────┘ │ └──────────────────┘ │ └──────────────────┘ │  └───────────────┘  │
│ └──────────────────┘                    │                    │                    │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘

Legend:
- T0 = Critical (production incident, immediate action)
- T1 = High Risk (breaking changes, requires explicit approval)
- T2 = Medium Risk (breaking changes, standard approval)
- T3 = Low Risk (autonomous execution, standard implementation)
```

---

## HOW AGENTS UPDATE THE BOARD

### Agent Role Correspondence

| GitHub Project Owner Field | Responsible Agent | Typical Actions |
|----------------------------|-------------------|-----------------|
| Product | Product Agent | Create issues, set Type=Epic, set Owner=Product |
| Code | Code Agent | Implement features, move to In Progress, link PRs |
| Reliability | Reliability Agent | Quality checks, move to In Review/Waiting/Blocked |
| Knowledge | Knowledge Agent | Documentation, capture decisions (Type=Epic/Tech Debt) |
| Advisor | Advisor Agent | Reviews (read-only, does NOT update board) |

### Update Workflow

#### 1. Product Agent: Starting New Work

```bash
# Create issue via GitHub CLI
gh issue create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "User authentication system" \
  --body "As a user, I want to log in..." \
  --label "feature" \
  --assignee ranjan-expatready

# Add to PROJECT after creation
gh project item-add \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --owner ranjan-expatready/autonomous-engineering-os \
  --issue 123

# Set custom fields
gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Type \
  --value "Epic"

gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id "Risk Tier" \
  --value "T2"

gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Owner \
  --value "Product"

gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Release \
  --value "v1.2.0"
```

#### 2. Code Agent: Moving Through Implementation

```bash
# When starting implementation (automation may handle this)
# Move to In Progress:
gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Status \
  --value "In Progress"

# Create PR and link to issue
gh pr create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "Implement user authentication" \
  --body "Closes #123" \
  --base main \
  --head feature/auth

# Automation will move to "In Review (PR Open)"
# If manual update needed:
gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Status \
  --value "In Review (PR Open)"
```

#### 3. Reliability Agent: Quality Gates

```bash
# If approval needed (manual intervention):
gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Status \
  --value "Waiting for Approval"

# Add comment explaining why:
gh issue comment 123 --body "This PR changes the authentication schema. Requires human review before merging."

# If CI fails:
gh project item-edit \
  --owner ranjan-expatready \
  --project "Autonomous Engineering OS — SDLC" \
  --id <item-id> \
  --field-id Status \
  --value "Blocked"

gh issue comment 123 --body "CI failed on [branch]. See logs: [url]. Reason: [explanation]."
```

#### 4. Knowledge Agent: Documentation Tasks

```bash
# Create documentation epic
gh issue create \
  --repo ranjan-expatready/autonomous-engineering-os \
  --title "Document authentication flow" \
  --body "Create user-facing documentation for login/logout..." \
  --label documentation

# Add to project and set fields
gh project item-add --owner ranjan-expatready --project "Autonomous Engineering OS — SDLC" --owner ranjan-expatready/autonomous-engineering-os --issue 124

gh project item-edit --owner ranjan-expatready --project "Autonomous Engineering OS — SDLC" --id <item-id> --field-id Type --value "Epic"
gh project item-edit --owner ranjan-expatready --project "Autonomous Engineering OS — SDLC" --id <item-id> --field-id "Risk Tier" --value "T3"
gh project item-edit --owner ranjan-expatready --project "Autonomous Engineering OS — SDLC" --id <item-id> --field-id Owner --value "Knowledge"
gh project item-edit --owner ranjan-expatready --project "Autonomous Engineering OS — SDLC" --id <item-id> --field-id Release --value "v1.2.0"
```

### State Machine Automation

Most transitions should be handled by automation rules:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTOMATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ISSUE CREATED               →  BACKLOG                                    │
│       ↓                                                                  │
│  ISSUE ASSIGNED              →  PLANNED                                    │
│       ↓                                                                  │
│  PR LINKED                   →  IN PROGRESS                                │
│       ↓                                                                  │
│  PR OPENED                   →  IN REVIEW (PR OPEN)                        │
│       ↓                                                                  │
│  REQUIRES APPROVAL           →  WAITING FOR APPROVAL                       │
│       ↓                                                                  │
│  APPROVED & MERGED           →  DONE                                       │
│       OR                                                               │
│  CI FAILED                   →  BLOCKED                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Manual Intervention Scenarios

When automation doesn't apply:

1. **Escalations to Human**:
   - Move to "Waiting for Approval"
   - Add comment explaining what needs human input
   - Owner field indicates which agent raised the escalation

2. **Blocker Resolution**:
   - Move to "Blocked" with detailed explanation
   - Include blocking factors in issue comments
   - When resolved, move back to previous status

3. **Release Preparation**:
   - Move completed items to "Ready for Release"
   - Update Release field to target version
   - Reliability Agent validates all items in column before release

---

## HOW THE FOUNDER USES IT DAILY

### Morning Standup (5-10 Minutes)

Founder opens the "Founder View" daily:

```
Checklist:
[ ] 1. Open "Founder View" (https://github.com/.../projects?view=Founder)
[ ] 2. Scan "Blocked" column - any items needing attention?
[ ] 3. Scan "Waiting for Approval" - approvals needed today?
[ ] 4. Scan "In Review" - anything close to completion?
[ ] 5. Scan "Ready for Release" - ready to ship?
[ ] 6. Count items by Risk Tier - too many high-risk items active?
[ ] 7. Read issue comments for any items awaiting human input
```

### Daily Decision Points

```
IF "Blocked" has items:
  → Read the blocking factor
  → Decide: Unblock (remove blocker) or Accept (wait)
  → Move back if unblocked

IF "Waiting for Approval" has items:
  → Review PR diffs (click through to PR)
  → Check Risk Tier
  → Decide: Approve or Request changes
  → Comment on PR with decision

IF "In Review" has items > 3 days:
  → Check why pending
  → Escalate to get moving
```

### Weekly Review (30 Minutes)

Founder opens "Release View":

```
Checklist:
[ ] 1. Group by Release field
[ ] 2. For each active release (e.g., v1.2.0):
  -   How many items in "Ready for Release"?
  -   How many in "In Review"?
  -   How many in "In Progress"?
  -   Any blockers?
[ ] 3. Decide: Ship now or wait?
[ ] 4. Update Release field for any items that moved
[ ] 5. Product Agent: Review upcoming planning
```

### Monthly Roadmap Planning

Founder opens "Engineering View" with Product Agent:

```
Checklist:
[ ] 1. Scan "Backlog" items for high-value work
[ ] 2. Check Owner=Product items - priorities correct?
[ ] 3. Set or update Release fields for upcoming months
[ ] 4. Identify any items that should be deprioritized
[ ] 5. Product Agent moves high-priority items to "Planned"
```

### Founder Dashboard (Key Metrics)

From "Founder View", founder tracks:

```
┌──────────────────────────────────────────────────────────────┐
│                  FOUNDER DASHBOARD                           │
├──────────────────────────────────────────────────────────────┤
│ Today's Focus Items:                                         │
│ • #123: Auth system (In Progress, T2)                  │
│ • #45:  Dashboard (In Review, T3)                       │
│ • #67:  Migration (Waiting Approval, T1)                │
│                                                              │
│ At-Risk Items (T0/T1 > 3 days):                             │
│ • #89:  Database upgrade (Blocked, 5 days)             │
│                                                              │
│ Approvals Needed Today:                                     │
│ • #12:  API changes (PR #45, needs review)                  │
│ • #34:  Schema change (PR #67, needs approval)               │
│                                                              │
│ This Week's Release (v1.2.0):                               │
│ • 4 items ready for release                                 │
│ • 1 in review                                               │
│ • 0 blocked                                                 │
│ → READY TO SHIP                                             │
└──────────────────────────────────────────────────────────────┘
```

### Founder Action Quick Reference

| Situation | Action |
|-----------|--------|
| Stuck in "Blocked" > 1 day | Review comments, decide to unblock or wait |
| PR in "Waiting Approval" | Review PR approach, approve/comment |
| Too many T0/T1 active | Ask Agents to reprioritize to T3 |
| "Ready for Release" column full | Release day! Validate and ship |
| No items in "In Progress" | Ask Agents to start next backlog item |
| Unknown item appears | Check Owner field, ask relevant agent |

---

## INTEGRATION WITH STATE LEDGER

The GitHub Project and `STATE_LEDGER.json` work together:

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   GITHUB PROJECT        │ ←─────→ │   STATE_LEDGER.JSON      │
│   (Visual SDLC)         │         │   (AI Memory)            │
├─────────────────────────┤         ├─────────────────────────┤
│ • Issues with status    │ Sync    │ • Current state machine │
│ • Custom fields        │         │ • Decisions log        │
│ • PR links             │         │ • Agent assignments    │
│ • Comments history     │         │ • Timestamps           │
│ • Views (Founder, Eng, │         │ • Next actions         │
│   Release)             │         │                         │
└─────────────────────────┘         └─────────────────────────┘
         ↓                                    ↓
    Human-readable                      Machine-readable
    Interactive                            Queryable by agents
```

### Sync Protocol

**When Agent Completes Work**:
1. Move GitHub Project item to next status
2. Update custom fields
3. Comment on issue/PR with outcome
4. **THEN** update STATE_LEDGER with pointer to GitHub item

**When Agent Resumes**:
1. Read GitHub Project for current state
2. Pull detailed context from STATE_LEDGER
3. Validate consistency
4. GitHub Project wins on conflicts

---

## API ACCESS FOR AGENTS

### GraphQL Queries

Agents can query the GitHub Project programmatically:

```graphql
# Get all issues in project
query {
  repository(owner: "ranjan-expatready", name: "autonomous-engineering-os") {
    projectV2(number: 1) {
      title
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
              state
              assignees(first: 1) {
                nodes {
                  login
                }
              }
            }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2Field {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

```graphql
# Get items by status
query {
  repository(owner: "ranjan-expatready", name: "autonomous-engineering-os") {
    projectV2(number: 1) {
      title
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
            }
          }
          fieldValues(first: 5) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### CLI Helpers

```bash
# Get project number (for queries)
PROJECT_NUMBER=$(gh repo view ranjan-expatready/autonomous-engineering-os --json projects --jq '.projects[].number' | grep -A 1 "Autonomous Engineering OS — SDLC")

# Get all issues in "In Progress" status
gh api graphql -f query="
  query {
    repository(owner: \"ranjan-expatready\", name: \"autonomous-engineering-os\") {
      projectV2(number: $PROJECT_NUMBER) {
        title
        items(first: 50) {
          nodes {
            content {
              ... on Issue {
                number
                title
              }
            }
            fieldValues(first: 5) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
"
```

---

## TROUBLESHOOTING

### Issue: Project Not Visible

**Symptom**: Project URL returns 404 or not found

**Causes**:
1. Project not created yet
2. Wrong project number in URL
3. Permission issues (private project)

**Resolution**:
1. Navigate to repository → Projects tab
2. Verify project exists with correct name
3. Check visibility settings
4. For private projects, ensure user has access

### Issue: Automation Not Working

**Symptom**: Issues not moving automatically as expected

**Resolutions**:
1. Verify GitHub token has `project` and `read:project` scopes
2. Check automation rules are enabled in project settings
3. Review rule triggers and conditions for syntax errors
4. Check GitHub Actions logs for automation errors
5. Manual fallback: Agents can still move items manually

### Issue: Custom Fields Not Showing

**Symptom**: Type, Risk Tier, Owner, Release fields not visible on items

**Resolution**:
1. Click "⚙️ View settings" → "Show fields"
2. Enable the custom fields checkbox for each field
3. Ensure fields are actually configured in Project Settings
4. Refresh the project view

### Issue: Items Not Syncing from Repository

**Symptom**: New repository issues don't appear in project

**Resolution**:
1. Add issues manually if automation doesn't work
2. Use CLI: `gh project item-add` to link issues
3. Check if repository is linked to project
4. Verify automation rule for "Issue created" is active

---

## NEXT STEPS AFTER SETUP

Once the GitHub Project is created and configured:

1. **Populate with Seed Data** (optional):
   - Create a few example issues in each status
   - Set custom fields appropriately
   - Link to sample PRs (dummy or existing)

2. **Test Automation**:
   - Create a test issue
   - Create a test PR linking to the issue
   - Verify statuses update automatically

3. **Train Agents**:
   - Update agent prompts to reference the project
   - Add CLI helper functions for project queries
   - Document agent-specific workflows in AGENTS/ directory

4. **Integrate with STATE_LEDGER**:
   - Update STATE_LEDGER schema to include project pointers
   - Add sync functions between GitHub Project and STATE_LEDGER
   - Test resume protocol from `RUNBOOKS/resume-protocol.md`

5. **Wire to Antigravity Cockpit** (Step 7):
   - Create dashboard view showing project status
   - Add widgets for Founder View metrics
   - Enable real-time updates from project changes

---

## SUMMARY

This artifact provides:

✅ **Complete GitHub Project setup instructions**  
✅ **Custom field configuration** (Type, Risk Tier, Owner, Release)  
✅ **Kanban column setup** (CTO state machine mapping)  
✅ **Automation rules configuration**  
✅ **Three saved views** (Founder, Engineering, Release)  
✅ **Board layout visualization** (ASCII art representation)  
✅ **Agent update procedures** (per agent type)  
✅ **Founder daily usage guidelines**  
✅ **State Ledger integration**  
✅ **API access examples**  
✅ **Troubleshooting guide**  
✅ **Next steps after setup**

The project will serve as the live SDLC state machine for the Autonomous Engineering OS framework, enabling both human founder and autonomous agents to track work in real-time.

---

**Project URL**: TBD (after creation)  
**Documentation**: `RUNBOOKS/resume-protocol.md`  
**Related Files**: `STATE_LEDGER.json`, `AGENTS/CONTRACTS.md`
