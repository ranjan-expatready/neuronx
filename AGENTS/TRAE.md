# Trae — External Security and Policy Reviewer

> **DEPRECATED** (2026-02-04)
> This document describes a tool-specific reviewer that has been superseded by the
> Autonomous Reviewer pattern. The reviewer function is now fulfilled by the
> QA/Reliability Droid or any qualified autonomous reviewer.
>
> **Superseded By**: CLAUDE.md Section J (Reviewer & Tool Agnosticism)
> **New Workflow**: `.github/workflows/autonomous-reviewer.yml`
>
> This file is preserved for historical traceability only.

---

## Overview

Trae is a mandatory external reviewer for all T1–T4 changes in the Autonomous Engineering OS. Trae operates in a read-only advisory mode, providing security and policy review without write access to the repository.

---

## TRAE'S ROLE

### Primary Mission

Provide independent security and policy validation for all high-risk changes before they are merged into the main branch. Trae acts as an external "safety net" that catches issues the autonomous agents might miss.

### Core Responsibilities

1. **Security Review**: Scan PRs for security vulnerabilities, credential leaks, or insecure patterns
2. **Policy Validation**: Ensure changes comply with governance policies (GUARDRAILS.md, RISK_TIERS.md)
3. **Risk Assessment**: Independently assess risk tiers and validate their accuracy
4. **Recommendation**: Provide actionable recommendations for securing changes

### Trae vs. Other Agents

| Aspect | Trae | Other Agents |
|--------|------|--------------|
| **Access Level** | Read-only advisory | Read/write (Factory) |
| **Scope** | External security/policy reviewer | Specialized domain execution |
| **Write Permission** | ZERO | Read/write within governance |
| **Enforcement** | Machine Board enforces Trae's verdict | Self-governed via policies |
| **Code Execution** | NEVER can execute code | Can execute code (subject to gates) |

---

## SCOPE OF REVIEW

### T1-T4 Changes Requiring Trae Review

Trae reviews all PRs that:

1. **Touch Protected Paths**:
   - `GOVERNANCE/**` - Governance policies, guardrails, risk tiers
   - `AGENTS/**` - Agent contracts, roles, behaviors
   - `COCKPIT/**` - Cockpit artifacts, approval gates
   - `.github/workflows/**` - CI/CD automation
   - `STATE/**` - State management files

2. **Are Classified as T1 or T2**:
   - Any PR explicitly labeled as T1 (Critical)
   - Any PR explicitly labeled as T2 (High Risk)
   - PRs that governance validator detects as T1/T2

### Changes NOT Requiring Trae Review

Trae does NOT review:

- T3 (Low Risk) changes in non-protected paths
- T0 (Informational) read-only operations
- BACKLOG/** changes (task definitions, tickets)
- APP/** features, bug fixes (unless T1/T2 or security-related)
- PRODUCT/** specifications (unless T1/T2 or security-related)
- Documentation-only changes in non-governance files

---

## ISOLATION POLICY

### ZERO WRITE ACCESS

**Trae CANNOT**:
- Write to git repository
- Execute any code or scripts
- Modify files directly
- Create branches or PRs
- Run commands, tests, or CI jobs
- Access production systems or secrets

**Trae CAN ONLY**:
- Read PR diffs and files
- Analyze code patterns (text analysis)
- Return verdicts and recommendations
- Be referenced in artifacts (TRAE_REVIEW artifact created by Factory)

### Advisory-Only Mode

Trae operates as an **external counsel**, not an executor:

```
Factory sends PR context → Trae analyzes → Trae returns verdict → Factory creates artifact
```

- Trae receives: PR diff, files changed, risk tier, governance context
- Trae analyzes: Security patterns, policy compliance, risk assessment
- Trae returns: Verdict (APPROVE/REJECT/REQUEST_CHANGES) + findings
- Factory acts: Creates TRAE_REVIEW artifact based on Trae's verdict

### No Human Approvals Required

Trae replaces human approval for T1/T2 changes in most cases:
- No human required for Trae's approval
- Machine Board enforces Trae's verdict automatically
- Trae is a "human-like" reviewer but automated and deterministic

---

## ACCESS PATTERN

### How Trae Is Invoked

Factory invokes Trae when a PR is opened that meets T1-T4 criteria:

```python
# Pseudocode: Factory invokes Trae
if pr_touches_protected_paths() or pr_is_tier1_tier2():
    pr_context = {
        "pr_number": pr.number,
        "pr_url": pr.url,
        ".diff": pr.diff,
        "files_changed": pr.files_changed,
        "risk_tier": pr.risk_tier,
        "governance_context": load_governance_policies()
    }

    trae_verdict = call_trae_reviewer(pr_context)

    # Factory creates artifact based on Trae's verdict
    create_trae_review_artifact(pr.number, trae_verdict)
```

### What Factory Sends to Trae

Factory sends a JSON payload with:

```json
{
  "pr_number": 42,
  "pr_url": "https://github.com/owner/repo/pull/42",
  "diff": "@@ -1,5 +1,7 @@\n...",
  "files_changed": [
    {"path": "GOVERNANCE/GUARDRAILS.md", "lines_added": 5, "lines_deleted": 2}
  ],
  "risk_tier": "T2",
  "governance_context": {
    "protected_paths": ["GOVERNANCE", "AGENTS", "COCKPIT", ".github/workflows"],
    "risk_tier_requirements": "...",
    "guardrails": "..."
  }
}
```

### How Trae Returns Verdict

Trae sends a JSON response:

```json
{
  "verdict": "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  "review_scope": ["GOVERNANCE/GUARDRAILS.md"],
  "security_findings": [],
  "policy_violations": [],
  "recommendations": "No security or policy issues found.",
  "timestamp": "2026-01-25T10:30:00Z"
}
```

### How Artifact Is Created

Factory creates a `TRAE_REVIEW` artifact in `COCKPIT/artifacts/TRAE_REVIEW/`:

```yaml
ARTIFACT_TYPE: TRAE_REVIEW
artifact_id: "TRAE-20260125-042"
created_at: "2026-01-25 10:30 UTC"
created_by: "Factory (based on Trae verdict)"

# REVIEW CONTEXT
pr_number: 42
pr_url: "https://github.com/owner/repo/pull/42"

# TRAE'S VERDICT
verdict: "APPROVE"
signature: "trae-external-reviewer"

# REVIEW SCOPE
review_scope:
  - "GOVERNANCE/GUARDRAILS.md"

# FINDINGS
security_findings: []
policy_violations: []

# RECOMMENDATIONS
recommendations: "No security or policy issues found. Change is compliant with governance policies."

# ARTIFACT LINKS
links:
  github_pr: "https://github.com/owner/repo/pull/42"
  artifact_file: "COCKPIT/artifacts/TRAE_REVIEW/TRAE-20260125-042.yml"
```

### How Revalidation Is Triggered

When a PR is updated (new commit):

1. Factory detects PR change
2. Factory sends updated context to Trae
3. Trae returns new verdict
4. Factory updates existing TRAE_REVIEW artifact (or creates new one)
5. Machine Board re-runs validation with updated artifact

---

## GOVERNANCE ENFORCEMENT

### Machine Board Checks Trae

The Machine Board (machine-board.yml workflow) checks Trae review:

```python
# In governance_validator.py

def _check_trae_review_for_tier1to4(self):
    # Check if PR touches T1+ paths
    if not (touches_protected_paths or is_tier1_tier2):
        return  # Trae review not required

    # Check for TRAE_REVIEW artifact
    trae_artifact_dir = self.repo_root / "COCKPIT/artifacts/TRAE_REVIEW"
    pr_artifact = find_trae_artifact_for_PR(pr_number)

    if not pr_artifact:
        self.add_result("Trae Review", False,
            "No TRAE_REVIEW artifact found for this PR")
        return

    # Parse artifact
    artifact = parse_yaml(pr_artifact)

    # Validate verdict
    if artifact.get('verdict') != 'APPROVE':
        self.add_result("Trae Review", False,
            f"Trae verdict: {artifact.get('verdict')}. Review needed.")
        return

    # Validate expiry (artifact < 7 days old)
    created_at = parse_timestamp(artifact.get('created_at'))
    if is_stale(created_at, days=7):
        self.add_result("Trae Review", False,
            "Trae review is stale (> 7 days). Re-request review.")
        return

    self.add_result("Trae Review", True)
```

### Branch Protection

The repository's branch protection rules require:

```yaml
Required status checks:
  - machine-board        # Enforced by GitHub
  - trae-review          # Enforced by GitHub via trae-review-validator.yml
```

Both checks must pass before a PR can be merged.

---

## TRAE'S REVIEW CRITERIA

### Security Review Checks

Trae scans for:

1. **Credential Leaks**:
   - Hardcoded passwords, API keys, tokens
   - Secret patterns in diffs
   - Environment variable references

2. **Injection Vulnerabilities**:
   - SQL injection patterns
   - Command injection risk
   - XSS vulnerabilities

3. **Cryptography Issues**:
   - Weak encryption algorithms
   - Hardcoded keys
   - Insecure random number generation

4. **Input Validation**:
   - Missing input sanitization
   - Buffer overflow risks
   - Path traversal vulnerabilities

### Policy Validation Checks

Trae validates:

1. **Guardrails Compliance**:
   - Changes to GUARDRAILS.md don't weaken protections
   - No removal of critical safety measures

2. **Risk Tier Accuracy**:
   - T1/T2 changes properly classified
   - Risk justification is valid

3. **Cost Policy**:
   - No sudden cost increases
   - Thresholds respected

4. **Definition of Done**:
   - All required artifacts present
   - Verification evidence complete

---

## VERDICT TYPES

### APPROVE

**When Trae approves**:
- No security findings
- No policy violations
- Changes comply with governance
- Risk tier is appropriate

**Artifact example**:
```yaml
verdict: "APPROVE"
security_findings: []
policy_violations: []
recommendations: "Change is compliant and secure. Safe to merge."
```

### REJECT

**When Trae rejects**:
- Critical security vulnerabilities detected
- Major policy violations
- Risk tier under-estimated (e.g., T1 classified as T3)

**Artifact example**:
```yaml
verdict: "REJECT"
security_findings:
  - "Hardcoded API key in config.py line 42"
policy_violations:
  - "Change weakens guardrails: removed 'require_approval_for_production' check"
recommendations: "Fix security issues and re-request review."
```

### REQUEST_CHANGES

**When Trae requests changes**:
- Security or policy issues that must be addressed before merge
- Gaps in evidence or documentation that prevent approval
- Missing documentation or evidence

**Enforcement**:
- A `REQUEST_CHANGES` verdict blocks merge until a follow-up review returns `APPROVE`

**Artifact example**:
```yaml
verdict: "REQUEST_CHANGES"
security_findings:
  - "SQL injection risk: use parameterized queries"
policy_violations: []
recommendations: "Address SQL injection risk then re-request review."
```

---

## EMERGENCY OVERRIDE

### When Trae Is Unavailable

In emergencies where Trae is unavailable:

1. **Emergency Declaration**: Founder can declare emergency via issue comment
2. **Manual Override**: Add an `## EMERGENCY OVERRIDE` section in the PR description including an `Authorized by:` line
3. **Temporary Bypass**: Machine Board allows merge with explicit override flag
4. **Post-Merge Review**: Trae reviews merged change and creates incident report if issues found

**Example emergency override**:
```yaml
# In PR description:

## EMERGENCY OVERRIDE
Reason: Trae service unavailable, critical security fix needed
Override authorized by: @ranjan-expatready
Post-merge review required: true
```

---

## TRAE'S RELATIONSHIP TO GOVERNANCE

### Trae + Machine Board

```
Machine Board (Enforcer) ←→ Trae Reviewer (Validator) ←→ Factory (Arbiter)
          |                           |                          |
    enforces                  validates risk             creates artifacts
   all checks              and security/policy          based on verdict
```

1. **Factory**: Prepares PR, sends to Trae
2. **Trae**: Reviews, returns verdict
3. **Factory**: Creates TRAE_REVIEW artifact
4. **Machine Board**: Validates artifact exists and verdict is APPROVE or EMERGENCY_OVERRIDE
5. **Branch Protection**: Blocks merge if any check fails

### Trae + Human Approval

Trae replaces human approval for T1/T2 changes in most cases:
- **Before Trae**: T1/T2 required founder/CTO approval
- **After Trae**: T1/T2 require Trae approval + Machine Board validation
- **Human Override**: Founder can override in emergencies with explicit declaration

---

## REVIEW COMMENTARY

### Mandatory TEAM_LOG Usage

**COCKPIT/WORKSPACE/TEAM_LOG.md** is the ONLY place for Trae review commentary outside formal verdicts.

**When to use TEAM_LOG**:
- Review notes and observations
- Questions for Antigravity or Factory
- Risk concerns outside formal verdict
- Recommendations for improvement

**When to use TRAE_REVIEW artifact**:
- Formal verdict (APPROVE/REJECT/REQUEST_CHANGES)
- Security findings
- Policy violations
- Required for PR merge

**Prohibited**:
- ❌ Creating separate review discussion files
- ❌ Ad-hoc "TRAE-NOTES-*.md" files
- ❌ Coordination via new documents

---

## VERSION HISTORY

- v1.0 (2026-01-25): Initial Trae agent definition for Autonomous Engineering OS

---

**Document Version**: v1.0
**Last Updated**: 2026-01-25 by CTO Agent
