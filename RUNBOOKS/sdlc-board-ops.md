# SDLC Board Operations Runbook

## Purpose

This runbook documents how the GitHub Projects v2 SDLC Board was created, how to use it, how to re-run verification, and how to recover if automation breaks.

**Created**: 2026-01-25
**Project URL**: https://github.com/users/ranjan-expatready/projects/2
**Project ID**: PVT_kwHODjbJ_M4BNbV3
**Project Name**: Autonomous Engineering OS — SDLC

---

## Board Overview

The GitHub Projects v2 SDLC Board provides live tracking of all work for the Autonomous Engineering OS framework. It serves as the visual state machine for all issues, PRs, and development work.

### Project Details

- **Project URL**: https://github.com/users/ranjan-expatready/projects/2
- **Project ID**: PVT_kwHODjbJ_M4BNbV3
- **Linked Repository**: ranjan-expatready/autonomous-engineering-os
- **Visibility**: Public (accessible to all)

### Custom Fields

| Field Name | Type | Options |
|------------|------|---------|
| Type | Single Select | Epic, Feature, Bug, Incident, Tech Debt |
| Risk Tier | Single Select | T0, T1, T2, T3 |
| Owner | Single Select | Product, Code, Reliability, Knowledge, Advisor |
| Release | Text | Free-form text field |

### Status Columns (Kanban)

1. **Backlog** - Default status for new issues
2. **Planned** - Issue has assignee and is scheduled
3. **In Progress** - Active development
4. **In Review (PR Open)** - Pull request is open and in review
5. **Waiting for Approval** - Requires human approval before merge
6. **Blocked** - Blocked by external dependency or issue
7. **Ready for Release** - Completed and ready for next release
8. **Done** - Completed and merged

---

## How the Board Was Created

### Step 1: Obtain GitHub Authorization

**Token Scopes Required**: `project`, `read:project`, `repo`

**Method Used**: Personal Access Token (PAT)
- Created PAT at: https://github.com/settings/tokens
- Stored in environment variable: `GITHUB_TOKEN`
- Token never written to repo or logs

### Step 2: Create Project v2

```bash
# GraphQL mutation to create Project
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
mutation {
  createProjectV2(
    input: {
      ownerId: "U_kgDODjbJ_A",
      title: "Autonomous Engineering OS — SDLC"
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

**Result**:
- Project ID: PVT_kwHODjbJ_M4BNbV3
- Project Number: 2
- URL: https://github.com/users/ranjan-expatready/projects/2

### Step 3: Link Repository to Project

```bash
# GraphQL mutation to link repository
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
mutation {
  linkProjectV2ToRepository(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", repositoryId: "R_kgDOQ-HCzg"}) {
    clientMutationId
  }
}'
```

### Step 4: Configure Custom Fields

#### Type Field (Single Select)

```bash
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='mutation {
  createProjectV2Field(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", dataType: SINGLE_SELECT, name: "Type", singleSelectOptions: [
    {name: "Epic", description: "Large scope initiative", color: PURPLE},
    {name: "Feature", description: "Product feature", color: GREEN},
    {name: "Bug", description: "Bug fix", color: RED},
    {name: "Incident", description: "Production incident", color: PINK},
    {name: "Tech Debt", description: "Technical debt item", color: ORANGE}
  ]}) {
    projectV2Field {
      ... on ProjectV2FieldCommon {id name}
      ... on ProjectV2SingleSelectField {id name options {id name}}
    }
  }
}'
```

#### Risk Tier Field (Single Select)

```bash
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='mutation {
  createProjectV2Field(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", dataType: SINGLE_SELECT, name: "Risk Tier", singleSelectOptions: [
    {name: "T0", description: "Critical, production-affecting", color: RED},
    {name: "T1", description: "High risk, requires explicit approval", color: ORANGE},
    {name: "T2", description: "Medium risk, breaking changes", color: YELLOW},
    {name: "T3", description: "Low risk, autonomous execution", color: GREEN}
  ]}) {
    projectV2Field {
      ... on ProjectV2FieldCommon {id name}
      ... on ProjectV2SingleSelectField {id name options {id name}}
    }
  }
}'
```

#### Owner Field (Single Select)

```bash
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='mutation {
  createProjectV2Field(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", dataType: SINGLE_SELECT, name: "Owner", singleSelectOptions: [
    {name: "Product", description: "Product Agent responsible", color: BLUE},
    {name: "Code", description: "Code Agent responsible", color: GREEN},
    {name: "Reliability", description: "Reliability Agent responsible", color: ORANGE},
    {name: "Knowledge", description: "Knowledge Agent responsible", color: PURPLE},
    {name: "Advisor", description: "Advisor (read-only)", color: GRAY}
  ]}) {
    projectV2Field {
      ... on ProjectV2FieldCommon {id name}
      ... on ProjectV2SingleSelectField {id name options {id name}}
    }
  }
}'
```

#### Release Field (Text)

```bash
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='mutation {
  createProjectV2Field(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", dataType: TEXT, name: "Release"}) {
    projectV2Field {
      ... on ProjectV2FieldCommon {id name}
    }
  }
}'
```

### Step 5: Configure Status Columns

The Status field was updated to have the 8 required columns:

```bash
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='mutation {
  updateProjectV2Field(input: {fieldId: "PVTSSF_lAHODjbJ_M4BNbV3zg8bL8E", name: "Status", singleSelectOptions: [
    {name: "Backlog", description: "Default status for new issues", color: GRAY},
    {name: "Planned", description: "Issue has assignee and is scheduled", color: BLUE},
    {name: "In Progress", description: "Active development", color: YELLOW},
    {name: "In Review (PR Open)", description: "Pull request is open and in review", color: PURPLE},
    {name: "Waiting for Approval", description: "Requires human approval before merge", color: ORANGE},
    {name: "Blocked", description: "Blocked by external dependency or issue", color: RED},
    {name: "Ready for Release", description: "Completed and ready for next release", color: GREEN},
    {name: "Done", description: "Completed and merged", color: GRAY}
  ]}) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {id name options {id name}}
    }
  }
}'
```

### Step 6: Add Items to Project

Issues are NOT automatically added. Follow this process:

1. Create issue via GitHub CLI or web UI
2. Add issue to project via GraphQL:

```bash
GH_TOKEN='your-token' gh issue create --repo ranjan-expatready/autonomous-engineering-os --title "Issue Title" --body "Description"

# Get issue ID
ISSUE_ID=$(gh issue view <issue-number> --json id --jq '.id')

# Add to project
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query="
mutation {
  addProjectV2ItemById(input: {projectId: \"PVT_kwHODjbJ_M4BNbV3\", contentId: \"${ISSUE_ID}\"}) {
    item {
      id
      content {
        ... on Issue {
          number
          title
        }
      }
    }
  }
}"
```

3. Set custom fields:

```bash
# Get item ID after adding (from response)
ITEM_ID="PVTI_..."

# Set Status to Backlog
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {projectId: "PVT_kwHODjbJ_M4BNbV3", itemId: "'$ITEM_ID'", fieldId: "PVTSSF_lAHODjbJ_M4BNbV3zg8bL8E", value: {singleSelectOptionId: "e0440a41"}}) {
    projectV2Item {id}
  }
}'

# Set Type, Risk Tier, Owner fields as needed
```

### Step 7: Verify Board Functionality

**Test Issue**: #13 (https://github.com/ranjan-expatready/autonomous-engineering-os/issues/13)
**Test PR**: #14 (https://github.com/ranjan-expatready/autonomous-engineering-os/pull/14)

Both verified:
- Issue added to project successfully
- Custom fields populated (Type: Feature, Risk Tier: T3, Owner: Code, Release: TBD)
- Status transitions tested (Backlog → In Progress → In Review (PR Open))
- PR workflow validated

---

## How to Re-Run Verification

### Verification Steps

1. **Create Test Issue**:
   ```bash
   gh issue create --repo ranjan-expatready/autonomous-engineering-os \
     --title "VERIFICATION: SDLC Board Test" \
     --body "Testing SDLC board automation"
   ```

2. **Add to Project**:
   ```bash
   ISSUE_ID=$(gh issue view <number> --json id --jq '.id')
   GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query="
   mutation {
     addProjectV2ItemById(input: {projectId: \"PVT_kwHODjbJ_M4BNbV3\", contentId: \"${ISSUE_ID}\"}) {
       item {
         id
         content {
           ... on Issue {
             number
             title
           }
         }
       }
     }
   }"
   ```

3. **Verify Fields**:
   - Check that item appears in project
   - Verify Status field is set to "Backlog"
   - Manually set Type, Risk Tier, Owner, Release fields

4. **Test Status Transitions**:
   - Update Status to "In Progress"
   - Update Status to "In Review (PR Open)"
   - Update Status to "Done"
   - Verify each transition works

5. **Cleanup**:
   ```bash
   gh issue close <number> --comment "Verification complete"
   ```

---

## Automation Configuration (Pending)

**Status**: 🟡 NOT CONFIGURED YET

GitHub Projects v2 automation rules need to be configured via the web UI. The GraphQL API does not support configuring automation rules programmatically.

### Required Automation Rules

1. **Issue Created** → Set Status to "Backlog"
2. **Issue Assigned** → Set Status to "Planned"
3. **PR Opened** → Find linked issue → Set Status to "In Progress"
4. **PR In Review** → Set linked issue Status to "In Review (PR Open)"
5. **PR Requires Review** → Set linked issue Status to "Waiting for Approval"
6. **PR Merged** → Set linked issue Status to "Done"
7. **CI Failed** → Find linked issue → Set Status to "Blocked"

### How to Configure Automations

1. Navigate to: https://github.com/users/ranjan-expatready/projects/2
2. Click "⚙️" → "Automation"
3. Add each rule using the web UI
4. Test each rule with a test issue/PR

**Estimated Time**: 15-20 minutes

---

## How to Recover if Automation Fails

### Scenario 1: Item Not Moved Automatically

**Symptom**: Issue/PR created but doesn't appear in project or status doesn't update

**Recovery**:
1. Manually add issue to project (see Step 6 in "How the Board Was Created")
2. Manually update status field via web UI or GraphQL API
3. Check automation rules are enabled in project settings

### Scenario 2: Custom Fields Not Showing

**Symptom**: Type, Risk Tier, Owner, Release fields not visible on items

**Recovery**:
1. Click "⚙️ View settings" → "Show fields"
2. Enable visibility checkboxes for each custom field
3. Refresh project view

### Scenario 3: Board Link Broken

**Symptom**: Repository not linked to project, items not syncing

**Recovery**:
1. Check repository link status via GraphQL
2. Re-link repository if needed (see Step 3 in "How the Board Was Created")
3. Verify repository ID and project ID are correct

### Scenario 4: Board Deleted或Corrupted

**Symptom**: Project URL returns 404 or project is in corrupted state

**Recovery**:
1. Recreate project from scratch (see Steps 1-5 in "How the Board Was Created")
2. Restore custom fields and status columns
3. Re-link repository
4. Manually re-add critical items to project
5. Re-configure automation rules via web UI

### Scenario 5: GraphQL API Changes

**Symptom**: GraphQL mutations fail with "field not found" or "invalid argument" errors

**Recovery**:
1. Check GitHub GraphQL API documentation for changes
2. Query for available fields using introspection
3. Update mutations to match current API schema
4. Test mutations with a test project before applying to main project

---

## Permissions Required

### GitHub Token Scopes

- `repo` - Full control of private repositories
- `project` - Create and manage project boards
- `read:project` - Read project board data

### Repository Permissions

- **Read/Write access** to ranjan-expatready/autonomous-engineering-os
- **Admin access** to create Projects v2 (owner or admin)

### Automation Rules

- Automation rule configuration requires **Project Maintainer** role
- Cannot be configured via GraphQL API - requires web UI access

---

## Daily Usage Patterns

### For Agents

1. **Product Agent**:
   - Create issues for new epics/features
   - Add to project, set Type=Epic, Owner=Product
   - Set Risk Tier based on scope

2. **Code Agent**:
   - Update issue status when starting work (In Progress)
   - Create PRs that link to issues
   - Update status through PR workflow (In Review → Done)

3. **Reliability Agent**:
   - Review items in "In Review" or "Waiting for Approval"
   - Move to "Blocked" if issues arise
   - Move back to appropriate status when resolved

### For Founder

1. **Morning Standup (5-10 min)**:
   - Open project: https://github.com/users/ranjan-expatready/projects/2
   - Scan "Blocked" column for immediate attention
   - Scan "Waiting for Approval" for pending approvals
   - Check "In Review" for near-completion items

2. **Weekly Review (30 min)**:
   - Group by "Release" field
   - Check items per release
   - Identify release blockers
   - Adjust Release fields as needed

3. **Monthly Planning**:
   - Review "Backlog" items
   - Prioritize high-value work
   - Set Release fields for upcoming month
   - Move high-priority items to "Planned"

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Item not visible in project | Not added to project | Use `addProjectV2ItemById` mutation |
| Status field not updating | Automation not configured | Configure rules via web UI |
| Custom fields missing | Field visibility disabled | Enable fields in View Settings |
| GraphQL mutation fails | Invalid enum values | Use correct enum literals (RED, BLUE, GREEN, etc.) |
| Item not moving when PR created | Automation rule not active | Check automation settings in web UI |
| Permission denied | Token missing scopes | Re-create token with project, read:project scopes |

### Debugging Commands

```bash
# Check project exists
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
query {
  user(login: "ranjan-expatready") {
    projectV2(number: 2) {
      id
      title
      url
    }
  }
}'

# Check project fields
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
query {
  user(login: "ranjan-expatready") {
    projectV2(number: 2) {
      fields(first: 20) {
        nodes {
          ... on ProjectV2FieldCommon {id name dataType}
          ... on ProjectV2SingleSelectField {options {id name}}
        }
      }
    }
  }
}'

# Check repository link
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
query {
  repository(owner: "ranjan-expatready", name: "autonomous-engineering-os") {
    projectV2(number: 2) {
      id
      title
      repositories(first: 10) {
        nodes {
          id
          name
        }
      }
    }
  }
}'

# Check items in project
GH_TOKEN='your-token' gh api graphql --header 'GraphQL-Features: projects_next_graphql' -f query='
query {
  user(login: "ranjan-expatready") {
    projectV2(number: 2) {
      items(first: 50) {
        nodes {
          content {
            ... on Issue {number title url}
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {name}
                }
              }
            }
          }
        }
      }
    }
  }
}'
```

---

## References

- **Project URL**: https://github.com/users/ranjan-expatready/projects/2
- **SDLC Artifact**: GITHUB_PROJECT_SDLC_ARTIFACT.md
- **Verification Doc**: SDLC_BOARD_VERIFICATION.md
- **GitHub GraphQL API**: https://docs.github.com/graphql
- **Projects v2 Guide**: https://docs.github.com/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects-v2

---

## Version History

- v1.0 (2026-01-25): Initial runbook documenting SDLC board creation, verification, and recovery procedures

---

**Last Updated**: 2026-01-25 by CTO Agent
**Project Status**: ✅ OPERATIONAL (automation configuration pending via web UI)
