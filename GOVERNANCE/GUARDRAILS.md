# Guardrails — Approval Gates, One-Writer Rule, and Safe Terminal Policy

## Overview

This document defines the guardrails that keep the Autonomous Engineering OS operating safely, efficiently, and within its intended scope. Guardrails are not limitations — they are accelerators that enable autonomous operation by defining clear boundaries.

## DEFAULT OPERATION MODE

### Safe Autonomy Mode (MANDATORY DEFAULT)

**CRITICAL RULE": The Autonomous Engineering OS MUST operate in "Safe Autonomy Mode" by default. "Allow all commands" or "Auto High" modes are PROHIBITED as default settings.**

### Default Configuration

**Operation Mode**: Safe Autonomy (Allowlist-based Execution)
- Only commands on the approved allowlist execute autonomously
- All other commands require explicit human approval
- Risk assessment required for every command before execution
- Dry-run verification mandatory for file operations

**Risk Level**: Low/Medium (autonomous), High (requires approval)
- LOW RISK: Informational commands (read-only, no side effects) — autonomous
- MEDIUM RISK: Non-destructive operations within repo root — autonomous with logging
- HIGH RISK: Any destructive operation, system modifications, or file changes outside repo — requires human approval

### Override Mechanism

Human can temporarily elevate authorization with explicit consent:
```
"Factory, I authorize elevated execution for task [X]. Proceed with caution."
```

Elevated mode:
- Lasts for single task only
- Resets to Safe Autonomy after task completion
- Requires explicit re-authorization for subsequent tasks

---

## ONE-WRITER RULE (Critical)

### Rule Statement

**Only Factory (the Autonomous Engineering OS system) writes to the repository. External AIs function in an advisory capacity only.**

### What This Means

**Factory (Permitted Actions):**
- ✅ Write code directly to the repository
- ✅ Create and delete files
- ✅ Execute git commits
- ✅ Modify configuration files
- ✅ Run build and deployment commands
- ✅ Install dependencies via package managers
- ✅ Execute tests and linters

**External AIs (Advisor Role Only):**
- ❌ Never write to the repository
- ❌ Never execute git commands
- ❌ Never modify files directly
- ✅ Provide code suggestions and explanations
- ✅ Answer technical questions
- ✅ Review and analyze code
- ✅ Offer architecture advice
- ✅ Explain trade-offs

### Enforcement

1. **Before any write operation**, the system must verify the source is Factory
2. **Human must explicitly opt-in** to any external AI suggestions
3. **Code suggestions from external AIs** must be:
   - Presented as text/plain
   - Requires explicit "Factory, please implement this" instruction from human
   - Reviewed by Factory before applying

### Violation Handling

If an external AI attempts to write:
1. Immediate stop with clear warning
2. Explain one-writer rule
3. Offer to proceed as advisory-only session
4. Require explicit confirmation from human to ignore (not recommended)

---

## APPROVAL GATES

### Gate Classification System

| Gate Trigger | Risk Tier | Action |
|--------------|-----------|--------|
| Cost projection > $100 | Tier 2 | Wait for human |
| Production deploy | Tier 1 | Require human approval |
| Database migration | Tier 2 | Require human approval |
| Security credential usage | Tier 1 | Require human approval |
| Breaking API change | Tier 2 | Require human approval |
| Delete > 10 files | Tier 3 | Autonomous if tests pass |
| Modify production config | Tier 1 | Require human approval |
| External API integration | Tier 2 | Cost assessment + approval |
| Payment processing change | Tier 1 | Require human approval |

### Detailed Gate Definitions

#### GATE-1: Task Entry Validation
**Trigger**: New task received from human
**Risk Tier**: Assessed during PLANNING state
**Actions**:
- Validate task clarity
- Assign initial risk tier
- Check for conflicting priorities
- Determine if specialized agent needed
**Proceed**: Always proceed to PLANNING

#### GATE-2: Cost Threshold Approval
**Trigger**: Estimated cost exceeds threshold
**Thresholds**:
- Single task: $50 (warn), $100 (require approval)
- Daily cumulative: $200 (warn), $400 (pause)
- Monthly: $2000 (require review)
**Actions**:
- Calculate cost breakdown
- Present to human with alternatives
- Pause execution until approval
**Proceed**: Human approval OR cost reduced under threshold

#### GATE-3: Production Deployment Authorization
**Trigger**: Deployment to production environment
**Risk Tier**: Tier 1 (always requires approval)
**Actions**:
- Verify all tests passing
- Confirm rollback plan exists
- Present deployment summary
- Require explicit human confirm
**Proceed**: Only after explicit human approval
**Note**: Staging/preview deployments are Tier 3 (autonomous)

#### GATE-4: Database Migration Approval
**Trigger**: Any DDL statement (CREATE, ALTER, DROP)
**Risk Tier**: Tier 2 (medium-high risk)
**Actions**:
- Generate migration script
- Create rollback script
- Estimate execution time
- Request human approval
**Proceed**: Human approval after reviewing both scripts

#### GATE-5: Breaking Change Notification
**Trigger**: Changes that could break dependent systems
**Risk Tier**: Tier 2 (medium risk)
**Examples**:
- API endpoint removal or signature change
- Database schema modification
- Authentication flow change
- Critical data structure change
**Actions**:
- Identify affected components
- Generate migration guide
- Assess customer impact
- Request human approval
**Proceed**: Human approval after impact review

#### GATE-6: Configuration Change Authorization
**Trigger**: Modification of production config files
**Risk Tier**: Tier 1 (if production), Tier 3 (if dev/staging)
**Actions**:
- Validate config syntax
- Document change reason
- Create rollback config
**Proceed**: Production → approval required; dev/staging → autonomous

#### GATE-7: External API Integration Approval
**Trigger**: New external API or service integration
**Risk Tier**: Tier 2 (medium risk)
**Actions**:
- Cost analysis of API usage
- Availability and SLA review
- Security assessment
**Proceed**: Human approval after cost/risk review

#### GATE-8: Payment Processing Change
**Trigger**: Any modification to payment flow or integration
**Risk Tier**: Tier 1 (critical)
**Actions**:
- Security review mandatory
- Compliance check (PCI, GAAP if applicable)
- Testing in sandbox environment
**Proceed**: Human approval after security review

#### GATE-9: Ambiguity Resolution Gate
**Trigger**: Task requirements are unclear or conflicting
**Risk Tier**: Dynamic (based on context)
**Actions**:
- Identify specific ambiguities
- Propose clarifying questions
- Pause execution
**Proceed**: Human provides clear answers

---

## SAFE TERMINAL POLICY

### Command Execution Safety

All terminal commands executed by Factory must pass safety validation:

### Approved Command Patterns

**Read Operations (LOW RISK - autonomous):**
```bash
# File reading
cat, less, head, tail
# Directory listing
ls, find (no -delete or -exec)
# Git read operations
git status, git log, git diff, git show
# System info
ps, top, df, du, date
npm list, pip list
```

**Build Operations (MEDIUM RISK - autonomous):**
```bash
# Building
npm run build, npm run compile
python -m build
make build
# Linting and formatting
npm run lint, npm run format
black, prettier, eslint
# Testing
npm test, pytest, cargo test
```

**Dependency Management (MEDIUM RISK - autonomous):**
```bash
# Installing dependencies (non-root)
npm install, npm add
pip install, poetry install
cargo add
```

**Git Write Operations (MEDIUM RISK - autonomous):**
```bash
git add
git commit (no --amend, no --force)
git checkout (no -f flag)
git branch, git merge (no --force)
```

### Prohibited Command Patterns

**NEVER Execute (HIGH RISK - blocked):**
```bash
# Destructive operations
rm, rmdir (any form)
rm -rf (BLOCKED ABSOLUTELY)
mkfs, dd, shred
# System modification (with sudo)
sudo apt, sudo yum, sudo brew
sudo chmod, sudo chown
sudo service, sudo systemctl
# Network exposure (production)
sudo iptables, sudo firewall-cmd
# Security risks
curl | bash, wget | sh eval $(curl)
# Force git operations
git push --force, git push -f
git reset --hard (on shared branches)
git clean -f (without -n dry-run first)
```

### Permitted with Approval

**REQUIRE HUMAN APPROVAL BEFORE EXECUTION (ALL CATEGORIES):**

#### System Commands (NEVER Autonomous)
```bash
sudo                    # ANY command with sudo prefix
sudo rm                 # Absolutely blocked
sudo chmod, sudo chown  # Permission changes
sudo apt, sudo yum, sudo brew # System package management
sudo service, sudo systemctl # Service management
sudo iptables, sudo firewall-cmd # Firewall changes
```

#### Destructive Operations (NEVER Autonomous)
```bash
rm -rf                  # Absolutely blocked under all circumstances
rm -r                   # Requires approval, must show affected files first
rmdir                   # Requires approval
mkfs, dd, shred        # High risk filesystem operations
```

#### Package Management (NEVER Autonomous)
```bash
npm install -g          # Global package installation
pip install --user      # User-level installation outside repo
brew install            # macOS system package management
apt-get install         # Linux system package management
docker pull <image>     # Requires approval due to bandwidth and security
```

#### Docker Operations (NEVER Autonomous)
```bash
docker system prune     # Removes all unused data - destructive
docker volume rm        # Requires approval
docker network rm       # Requires approval
docker rmi -f           # Force remove images - blocked
docker-compose down -v  # Removes volumes - blocked
```

#### Secrets and Credentials (NEVER Autonomous)
```bash
# ANY operation that accesses or modifies secrets/credentials:
# Example commands that must be approved:
echo $API_KEY
cat ~/.env
chmod 600 ~/.ssh/id_rsa
ssh-keygen
openssl genrsa
# Reading or writing to: ~/.ssh, ~/.aws, ~/.config/*, ~/.credentials/*
# Any environment file operations outside repo root:
cat /etc/environment
echo export KEY > ~/.bashrc
```

#### Filesystem Writes Outside Repository Root (NEVER Autonomous)
```bash
# Writing outside the repo root requires approval:
# Repo root: /Users/ranjansingh/Desktop/autonomous-engineering-os/
# Blocked unless explicitly approved:
touch /tmp/file.txt
echo "content" > ~/config.json
cp file ~/Documents/
mkdir /var/log/app
kubectl apply -f ~/k8s/
terraform apply (state files outside repo)
```

### Permitted with Approval Examples (Additional Context)

**Require Human Approval Before Execution:**
```bash
# Database operations
psql -d production -c "..."
# Production config changes
kubectl apply -f production/
terraform apply -var-file=production.tfvars
# Large scale deletes (within repo root)
rm large-directory/ (present plan and count first)
# Container operations (production)
docker stop <production-container>
kubectl delete deployment/<name>
# Any operation with production credentials
# Any file write operation outside repository root
```

### Command Execution Flow

1. **Validate**: Check against approved/prohibited lists
2. **Analyze**: Determine risk tier
3. **Context-Check**: Verify working directory is correct
4. **Quote**: Quote paths with spaces and special characters
5. **Execute**: Run with timeout
6. **Monitor**: Watch for expected output
7. **Verify**: Confirm success before proceeding

### Safety Override

Human can override safety checks with explicit command:
```
"Factory, execute this high-risk command despite guardrails: [command]"
```

Required responses to proceed with override:
1. Clear acknowledgment of risk
2. Description of what will happen
3. Confirm "proceed at your own risk"

---

## VIOLATION HANDLING

### When a Guardrail is Violated

1. **Immediate Stop**: Halt current execution
2. **Explain**: Clearly state which guardrail was triggered
3. **Context**: Show the specific action that caused violation
4. **Path Forward**: Offer options:
   - Adjust action to stay within guardrails
   - Request explicit override from human
   - Suggest alternative approach

### Severity Levels

**Informational** (Log and continue):
- Approached but did not cross threshold
- Multiple small operations that sum to large

**Warning** (Pause and notify):
- Approaching cost threshold
- Unusual pattern detected
- Best practice not followed

**Critical** (Block and require approval):
- Security risk detected
- Production deployment attempt
- Database migration without approval
- One-writer rule violation

---

## GUARDRAIL MAINTENANCE

### Updating Guardrails

Guardrails themselves cannot be modified autonomously. To update:

1. Human proposes change
2. Factory analyzes impact
3. Update committed with clear rationale
4. Version history maintained

### Review Cycle

Guardrails should be reviewed:
- Monthly: Cost thresholds
- Quarterly: Risk tier assignments
- On incident: Related guardrails
- Before major feature: Relevant gates

---

## DOCUMENTATION SOURCES POLICY

### Overview

This section defines how agents should use different documentation sources to ensure accurate, up-to-date, and reliable information when working with frameworks, libraries, and APIs.

### Documentation Sources

**1. Repo Doctrine (project-specific knowledge)**
- Location: `FRAMEWORK_KNOWLEDGE/` directory, inline code comments, README files
- When to use: For project-specific patterns, decisions, architecture, and conventions
- Priority: **HIGHEST** - Always check repo doctrine first before external sources

**2. docs (Official MCP Documentation Server)**
- Type: HTTP-based MCP server
- URL: `https://modelcontextprotocol.io/mcp`
- When to use: For official Model Context Protocol documentation and reference
- Priority: HIGH - Use as primary source for MCP protocol specifics

**3. docs_arabold (Arabold Docs MCP Server)**
- Type: Stdio-based MCP server with local indexing
- Capabilities: Index and search documentation from libraries, frameworks, and APIs
- When to use: For technical documentation of third-party libraries, frameworks, APIs
- Features: Supports versioned documentation, semantic search, local caching
- Priority: HIGH - Use for versioned APIs, framework documentation, and technical facts

**4. context7 (Remote Context Provider)**
- Type: HTTP-based MCP server
- URL: `https://mcp.context7.com/mcp`
- When to use: For general context and knowledge retrieval when local sources are insufficient
- Priority: MEDIUM - Use as fallback when other sources lack specific information

**5. Built-in Tools (Factory Native)**
- **FetchUrl**: Built-in tool for fetching web pages, APIs, and documentation
- **WebSearch**: Built-in tool for searching the web for current information
- When to use: For recent news, current events, or when other documentation sources are unavailable
- Priority: LOW - Use only as last resort or for time-sensitive information

### Priority Order

**Documentation Source Hierarchy** (from highest to lowest priority):

1. **Repo Doctrine** → Project-specific knowledge (FRAMEWORK_KNOWLEDGE/)
2. **docs MCP** → Official MCP protocol documentation
3. **docs_arabold MCP** → Indexed library/framework documentation
4. **context7 MCP** → Remote context knowledge
5. **Built-in Tools (WebSearch/FetchUrl)** → Web search and page fetching

### Decision Matrix

| Question | Recommended Source |
|----------|-------------------|
| How does this project pattern work? | Repo Doctrine (FRAMEWORK_KNOWLEDGE/) |
| What is the MCP tool format? | docs MCP (official server) |
| What is the React useEffect API signature? | docs_arabold MCP (versioned docs) |
| How do I implement JWT authentication? | docs_arabold MCP (auth library docs) |
| What's the industry standard for X? | context7 MCP or WebSearch |
| What are recent updates to framework Y? | WebSearch (current information) |

### Usage Guidelines

**Mandatory Requirements**:
1. **Always check repo doctrine first** for project-specific patterns and decisions
2. **Use docs_arabold for versioned APIs** - do not rely on memory for API signatures that change
3. **Prefer docs_arabold over WebSearch** for established frameworks and libraries
4. **Validate documentation publication dates** when using docs_arabold for critical decisions
5. **Document the source** when referencing external documentation in code or decisions

**When to Use Each Source**:

**Repo Doctrine**:
- Project architecture decisions
- Code patterns and conventions
- Framework choices and rationale
- Team best practices

**docs MCP**:
- Official MCP protocol tool formats
- MCP server implementation guidelines
- Factory-specific MCP capabilities

**docs_arabold MCP**:
- Framework API documentation (React, Vue, Django, etc.)
- Library reference documentation
- Version-specific API changes
- Technical implementation details

**context7 MCP**:
- General knowledge queries
- Industry best practices
- Coding patterns when local docs are insufficient

**WebSearch/FetchUrl**:
- Recent news and announcements
- Current API pricing or policies
- Very new libraries not yet indexed
- Finding additional sources for complex problems

### Documentation Verification

Before acting on documentation:
1. **Check publication date** - Prefer recent documentation
2. **Verify version compatibility** - Ensure docs match library version in use
3. **Cross-reference multiple sources** - For critical decisions
4. **Check for deprecation warnings** - Ensure APIs are not deprecated
5. **Test in safe environment** - Before applying to production code

---

## STATE MANAGEMENT POLICY

### Overview

The Autonomous Engineering OS maintains determinism through state tracking in the STATE/ directory. All state changes are tracked in STATUS_LEDGER.md and LAST_KNOWN_STATE.md to enable deterministic resume after interruption.

### State Files

**STATE/STATUS_LEDGER.md**:
- Human-readable ledger of current system state
- Tracks: objectives, issues, PRs, artifacts, blockers, next actions, risk tier, gates
- Updated continuously during operations
- Read during resume protocol to understand current state

**STATE/LAST_KNOWN_STATE.md**:
- Concise snapshot at meaningful milestones
- Captured after: planning completed, PR opened, CI passed, deploy ready, etc.
- Provides deterministic resume point after interruption
- Updated after every state machine transition

### PR State Update Requirements

**MANDATORY**: Every pull request MUST update STATE/STATUS_LEDGER.md and STATE/LAST_KNOWN_STATE.md.

**When to Update STATE Files**:

**Within the PR** (Preferred):
- Include STATE/STATUS_LEDGER.md update in the PR itself
- Include STATE/LAST_KNOWN_STATE.md update in the PR itself
- Document state changes in commit messages
- Reviewers must verify STATE files are updated

**Immediately After Merge** (If not in PR):
- If PR does not include STATE file updates, update immediately after merge
- Commit: "chore: update STATE ledger and last known state"
- Push to main (no PR required for STATE updates only)
- Verify updates reflect merged changes

**Which PRs Must Update STATE**:

**ALL PRs must update STATE files**, including:
- Application code changes (APP/**)
- Product specification changes (PRODUCT/**)
- Backlog updates (BACKLOG/**)
- Governance changes (GOVERNANCE/**)
- Agent changes (AGENTS/**)
- Workflow changes (.github/workflows/**)
- Documentation changes (any directory)
- Infrastructure changes
- ANY change to the repository

**Exceptions**: None. All PRs must update state.

### STATE Update Checklist

Before merging a PR, the PR MUST include updates to:

**STATE/STATUS_LEDGER.md**:
- [ ] Current objective updated (if changed)
- [ ] Active issues updated (new issues added/closed)
- [ ] Active PRs updated (PR opened/closed/merged)
- [ ] Last completed artifact updated (if any artifact delivered)
- [ ] Current blockers updated (new blockers added/resolved)
- [ ] Next actions updated (prioritized list)
- [ ] Current risk tier updated (if changed)
- [ ] Required gates status updated (if gates cleared/new gates)

**STATE/LAST_KNOWN_STATE.md**:
- [ ] State machine position updated (IDLE/PLANNING/EXECUTING/WAITING_FOR_HUMAN)
- [ ] Active task updated (if changed)
- [ ] Work-in-progress items updated (if changed)
- [ ] GitHub state updated (branch, commits, issues, PRs)
- [ ] CI/CD state updated (if CI run completed)
- [ ] Risk assessment updated (if changed)
- [ ] Quality state updated (if tests/coverage changed)
- [ ] Governance compliance updated (if guardrails changed)
- [ ] Agent coordination updated (if handoffs)
- [ ] Blockers updated (added/resolved)
- [ ] Next actions updated (ordered list)
- [ ] Context preservation updated (if important context changed)
- [ ] Validation checks completed

### PR Templates with STATE Updates

When creating a PR, the PR description MUST include a section:

```markdown
## STATE Updates

### STATUS_LEDGER.md Updates
- Current objective: [Updated/Unchanged]
- Active issues: [Added/Closed X issues]
- Active PRs: [Added/Closed X PRs]
- Last completed artifact: [New artifact / Unchanged]
- Current blockers: [Added/Resolved X blockers]
- Next actions: [Updated priority list]

### LAST_KNOWN_STATE.md Updates
- State machine position: [IDLE/PLANNING/EXECUTING/WAITING_FOR_HUMAN]
- Active task: [Updated to: / Unchanged]
- GitHub state: [Branch updated / PRs updated / Unchanged]
- CI/CD state: [CI results updated / Unchanged]
- Risk tier: [Updated to: / Unchanged]
- Quality state: [Coverage: X% updated / Tests updated / Unchanged]
```

### Reviewer Responsibility When Reviewing PRs

**Checklist for PR Reviewers**:
```bash
[ ] STATE/STATUS_LEDGER.md included in PR (or will be updated immediately after merge)
[ ] STATE/LAST_KNOWN_STATE.md included in PR (or will be updated immediately after merge)
[ ] Current objective correctly reflects PR changes
[ ] Active issues list is accurate
[ ] Active PRs list is accurate
[ ] Last completed artifact documented (if PR delivers artifact)
[ ] Current blockers documented (if any)
[ ] Next actions prioritized correctly
[ ] Risk tier assessment is correct
[ ] Required gates status is accurate

If STATE files are NOT in PR:
[ ] Confirm PR description states "STATE files will be updated immediately after merge"
[ ] Verify commit message includes STATE update
[ ] Reviewer should merge with expectation of STATE update
```

### STATE File Validation

**Pre-Merge Checks** (automated or manual):

1. Check existence:
   - STATE/STATUS_LEDGER.md must exist
   - STATE/LAST_KNOWN_STATE.md must exist

2. Check content:
   - STATUS_LEDGER.md should not be empty template
   - LAST_KNOWN_STATE.md should have current state populated
   - No placeholder values (e.g., "[CURRENT OBJECTIVE]" should be filled)

3. Check consistency:
   - STATUS_LEDGER and LAST_KNOWN_STATE should be consistent
   - GitHub state should match STATE files
   - CI status should match STATE files

4. Check completeness:
   - All required fields filled
   - No sections skipped (unless N/A)
   - Timestamps populated
   - Links valid

**State File Validation Failure**:
- If STATE files not updated: BLOCK PR and require update
- If STATE files have placeholder values: BLOCK PR and require fix
- If STATE files are inconsistent: BLOCK PR and require fix

---

## MAIN BRANCH PROTECTION POLICY — Machine Board of Directors

### Overview

This section defines the mandatory branch protection rules for the `main` branch. These rules enforce PR-only governance powered by the **Machine Board of Directors** - an automated validation system that enforces stricter, more consistent governance than human review alone.

### Core Principle

**DIRECT PUSHES TO MAIN ARE FORBIDDEN.**

All changes to the `main` branch MUST occur through pull requests with the **governance-validator** status check passing.

### Required Branch Protection Settings

The following settings MUST be configured on the `main` branch in GitHub:

#### 1. Require Pull Request Before Merging
**Setting**: Enable "Require a pull request before merging"

**Requirements**:
- Dismiss stale PR approvals when new commits are pushed (optional, not needed)
- **NO human approval required** - replaced by governance-validator
- Require review from CODEOWNERS when defined (disabled in machine board mode)

### Machine Board of Directors

**NEW GOVERNANCE MODEL**: The Autonomous Engineering OS uses automated governance enforcement instead of human approvals.

**What Changed**:
- ❌ **Removed**: Human approval requirements in development mode
- ✅ **Added**: Automated validation via `governance-validator` workflow
- ✅ **Stronger**: Machine enforces consistent rules (no "LGTM" shortcuts)
- ✅ **Faster**: No waiting for human review cycles
- ✅ **Safer**: All artifacts, STATE updates, and risk documentation are verified

**How It Works**:
1. PR opens → `governance-validator` workflow runs automatically
2. Validator checks:
   - Protected paths have required PLAN/VERIFICATION artifacts
   - STATE files are updated (except BACKLOG-only PRs)
   - Risk tier T1/T2 have rollback plans and verification proof
   - No secrets detected in diffs
   - Framework structure is intact (framework-only mode)
3. If all checks pass → PR is merge-ready (no human approval needed)
4. If any check fails → PR is blocked with specific guidance

**Validator Checks**:

**Check 1: Protected Path Artifacts**
- Protected paths: `GOVERNANCE/**`, `AGENTS/**`, `COCKPIT/**`, `.github/workflows/**`, `STATE/**`
- Required artifact sections:
  - **PLAN**: scope, risk tier, cost estimate, verification plan, rollback plan
  - **VERIFICATION**: tests run, results, CI links, screenshots
  - **STATE**: STATUS_LEDGER.md and LAST_KNOWN_STATE.md updates

**Check 2: STATE File Updates**
- Required for non-BACKLOG PRs
- Exceptions: BACKLOG-only PRs can skip STATE

**Check 3: Risk Tier Requirements**
- T1/T2 require rollback plan + verification proof
- Detected from PR description (Tier 1, T1, Critical, Tier 2, T2, High Risk)

**Check 4: Secret Detection**
- Forbidden patterns: `password=`, `api_key=`, `secret=`, `BEGIN PRIVATE KEY`
- Blocks PRs with potential credentials

**Check 5: Framework Validations** (framework-only mode)
- YAML syntax validation for workflows
- Markdown basic lint (headings, no binary blobs)
- Repo structure validation (required framework files exist)

#### 2. Require Status Checks to Pass Before Merging
**Setting**: Enable "Require status checks to pass before merging"

**Required Checks** (from `.github/workflows/ci.yml` and `.github/workflows/governance-validator.yml`):
- `governance-validator` - Machine Board of Directors validation
- `lint` - Linting and Formatting checks
- `test-unit` - Unit Tests
- `test-integration` - Integration Tests
- `security` - Security Checks
- `build` - Build Verification
- `summary` - CI Summary

**Additional Settings**:
- Require branches to be up to date before merging
- Require approval from all code owners when available (disabled in machine board mode)

#### 3. Disallow Force Pushes to Main
**Setting**: Enable "Do not allow bypassing the above settings"

**Impact**:
- `git push --force` to main is blocked
- `git push -f main` is blocked
- History rewriting on main is impossible
- Ensures audit trail is preserved

#### 4. Disallow Deletion of Main
**Setting**: Enable "Restrict deletions"

**Impact**:
- Branch cannot be deleted via GitHub UI
- `git push origin --delete main` is blocked
- Prevents accidental or malicious branch removal

### Validation Requirements by Directory

**MACHINE BOARD MODE**: All directories are now governed by automated validation instead of human review.

#### Protected Governance Paths (Require Artifacts)

Changes to the following directories **MUST** include proper artifacts in the PR description:

```
GOVERNANCE/           # Governance policies (guardrails, cost policy, risk tiers)
AGENTS/               # Agent contracts, roles, best practices, prompt templates
COCKPIT/              # Cockpit integration and skills policy
.github/workflows/    # CI/CD workflows and automation
STATE/                # State ledger and last known state
```

**Required Artifacts**:
- **PLAN section**: scope, risk tier, cost estimate, verification plan, rollback plan
- **VERIFICATION section**: tests run, results, CI links, screenshots
- **STATE updates**: STATUS_LEDGER.md and LAST_KNOWN_STATE.md documented

**Rationale**: These directories define the operating rules, agent behaviors, and automated processes. The machine validator ensures all changes are properly documented with artifacts, providing stronger governance than human review alone.

#### All Other Paths (Standard Validation)

Changes to other directories require:
- ✅ CI checks passing (lint, test, security, build)
- ✅ governance-validator passing (verifies no secrets, structure intact)
- ✅ STATE files updated (unless BACKLOG-only)

```
APP/**                  # Application code (when populated)
PRODUCT/**              # Product specifications, requirements
BACKLOG/**              # Backlog items, task definitions, tickets
FRAMEWORK_KNOWLEDGE/**  # Technical knowledge base
ARCHITECTURE/**         # System architecture documentation
RUNBOOKS/**             # Operational procedures
Any other paths         # Documentation, artifacts, etc.
```

**Rationale**: Application code and documentation changes follow standard software engineering practices with automated testing. The machine validator enforces consistent standards without human bottlenecks.

---

### Enforced Workflow

The REQUIRED workflow for changes to main:

```
Step 1: Create Feature Branch
   git checkout -b feature/your-feature-name

Step 2: Make and Commit Changes
   git add .
   git commit -m "descriptive commit message"
   git push -u origin feature/your-feature-name

Step 3: Open Pull Request
   - Use GitHub UI to create PR from branch to main
   - Fill in PR template (.github/PULL_REQUEST_TEMPLATE.md)
   - Tag appropriate reviewers based on changed directories

Step 4: CI Checks Run
   - All CI checks must pass (lint, test, security, build)
   - Fix any failing checks before proceeding

Step 5: Code Review
   - Human reviewer(s) review changes
   - Approve if quality and governance standards are met
   - Request changes if improvements are needed

Step 6: Merge
   - After approval and CI passing, merge the PR
   - Use "Squash and merge" or "Rebase and merge" (not "Merge commit")
   - Delete feature branch after merge
```

### Bypassing Branch Protection

**CRITICAL RULE**: Branch protection settings should NOT allow bypassing by administrators, maintainers, or human reviewers.

**Rationale**: Even the Repository Owner (Founder) must follow the same governance rules. No exceptions.

If an emergency fix is required:
1. Create a hotfix branch following standard workflow
2. Create PR with "emergency/hotfix" label
3. Request expedited review
4. Merge with proper approvals after review

### Codeowners (Recommended)

Create a `.github/CODEOWNERS` file to define who must approve changes to specific directories:

**Example CODEOWNERS**:
```
# High-risk directories require Founder approval
GOVERNANCE/           @ranjan-expatready
AGENTS/               @ranjan-expatready
.github/workflows/    @ranjan-expatready

# Framework knowledge can be reviewed by any contributor
FRAMEWORK_KNOWLEDGE/  *

# Application code follows standard review process
APP/                  *

# Documentation updates are low-risk
*.md                  * @ranjan-expatready
```

### Violation Detection

If someone attempts to push directly to main, GitHub will reject the push with:

```
ERROR: Protected branch update failed for main.
At least 1 approving review is required by reviewers with write access.
```

If CI checks are failing:
```
ERROR: Protected branch update failed for main.
Required status check "lint" is expected (2/2 required).
```

### Monitoring and Alerts

GitHub provides built-in notifications for:
- Branch protection rule violations
- Failing CI checks on PRs
- Approvals requested
- Merge events

Configure GitHub repository settings to receive:
- Email notifications for PR reviews
- Slack/Discord notifications for CI failures
- Security alerts for vulnerabilities

### Periodic Review

Branch protection rules should be reviewed:
- **Quarterly**: Ensure all required checks exist and pass
- **On major framework changes**: Update review requirements if needed
- **After security incidents**: Strengthen protection if necessary

### Compliance Verification

**Checklist for verifying branch protection compliance**:

```
[ ] 1. Branch protection is enabled on main
[ ] 2. Require PR before merging is enabled
[ ] 3. At least 1 human approval is required
[ ] 4. All CI checks are required to pass
[ ] 5. Force pushes are disabled
[ ] 6. Branch deletion is disabled
[ ] 7. No bypass of rules is allowed for admins
[ ] 8. CODEOWNERS file is configured (recommended)
[ ] 9. CI workflow runs on every PR
[ ] 10. Recent PRs followed the enforcement rules
```

### Reference Files

- **Branch Protection Setup Guide**: See `RUNBOOKS/repo-governance.md` for step-by-step GitHub UI instructions
- **CI Workflow Definition**: See `.github/workflows/ci.yml` for required checks
- **PR Template**: See `.github/PULL_REQUEST_TEMPLATE.md` for PR format requirements

---

## COMPLIANCE STATEMENT

Every action taken by the Autonomous Engineering OS must satisfy:

1. ✅ One-writer rule not violated
2. ✅ Relevant approval gates evaluated
3. ✅ Command safety rules followed
4. ✅ Cost within thresholds
5. ✅ Risk acceptable for context
6. ✅ Rollback plan exists for irreversible actions
7. ✅ Human approval obtained for Tier 1 gates
8. ✅ Main branch protection policy followed (PR-only workflow)
9. ✅ STATE files updated for every PR (STATUS_LEDGER.md + LAST_KNOWN_STATE.md)

---

## MCP USAGE RULES

### Allowed MCP Servers

All agents are authorized to use the following MCP servers:
- **filesystem** — Read/write any file on the Mac (scoped to the repository root)
- **docs** — Inject up-to-date technical documentation into prompts (HTTP-based official MCP server)

### Built-in Tools (Not MCP Servers)

**Factory also provides built-in tools for web content fetching:**
- **FetchUrl** — Fetch web pages, APIs, and documentation (built-in tool, not an MCP server)
- **WebSearch** — Search the web for information (built-in tool, not an MCP server)

These built-in tools are used instead of a dedicated fetch MCP server to ensure reliable web content access.

### Agent Responsibilities

**Agents MUST:**
- ✅ Use filesystem MCP instead of guessing file contents
- ✅ Use docs MCP instead of relying on training data
- ✅ Use FetchUrl built-in tool to verify external facts and APIs
- ✅ Use WebSearch built-in tool to search for current information
- ✅ Verify data authenticity before acting on fetched content
- ✅ Maintain appropriate isolation between agent contexts

**Agents are NOT allowed to:**
- ❌ Access credentials, secrets, or private keys via filesystem MCP
- ❌ Modify files outside the repository unless explicitly approved
- ❌ Use fetch tools to circumvent rate limits or terms of service
- ❌ Cache sensitive data from docs MCP without proper handling

### MCP Safety Guidelines

1. **Filesystem MCP Access**
   - Limit operations to the repository root: `/Users/ranjansingh/Desktop/autonomous-engineering-os`
   - Read operations are autonomous
   - Write operations follow all existing guardrails
   - Never access system directories like `/etc`, `/var`, `~/.ssh`

2. **Docs MCP Integration**
   - Use for framework documentation, API references, best practices
   - Cross-reference with multiple sources for critical decisions
   - Consider publication dates when using docs
   - Prefer official documentation over third-party sources
   - Server runs over HTTP at `https://modelcontextprotocol.io/mcp`

3. **Built-in FetchUrl Tool Usage**
   - Verify URL authenticity before making requests
   - Respect rate limits and robots.txt
   - Validate TLS certificates automatically
   - Cache responses appropriately to reduce unnecessary fetches

### MCP Error Handling

When an MCP server fails:
1. Log the failure with context
2. Attempt fallback for docs MCP: use WebSearch or FetchUrl built-in tool
3. Notify human if critical for task completion
4. Never proceed with guessing when MCP data is unavailable

Note: FetchUrl and WebSearch are Factory built-in tools, not MCP servers. They should always be available as fallback options.

### MCP Server Management

Adding or removing MCP servers requires:
- Risk assessment of new server
- Update to this governance document
- Human approval for production-impacting changes
- Testing in safe environment before use

---

## Version History

- v1.4 (Machine Board of Directors): Replaced human approvals with automated governance-validator for all PRs; stronger, faster, safer
- v1.3 (Dev Fast Mode): Added Dev Stage Fast Mode for directory-based auto-merge with CI
- v1.2 (Branch Protection): Added Main Branch Protection Policy and PR-only enforcement
- v1.1 (MCP Integration): Added MCP Usage Rules for filesystem, fetch, and docs servers
- v1.0 (Initial): Core guardrails, one-writer rule, approval gates, safe terminal policy
