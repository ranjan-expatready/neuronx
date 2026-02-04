# Trae Review Runbook — Invocation and Protocol

> **DEPRECATED** (2026-02-04)
> This runbook describes a tool-specific review protocol that has been superseded.
> The reviewer function is now fulfilled by autonomous reviewers (QA/Reliability Droid).
>
> **Superseded By**: CLAUDE.md Section J (Reviewer & Tool Agnosticism)
> **New Workflow**: `.github/workflows/autonomous-reviewer.yml`
> **New Artifact Path**: `COCKPIT/artifacts/VERIFICATION/`
>
> This file is preserved for historical traceability only.

---

Machine-board sanity check marker: 2026-01-25

## Overview

This runbook describes the complete protocol for invoking Trae, the external security and policy reviewer, and handling its verdicts in the Autonomous Engineering OS.

---

## WHEN TO INVOKE TRAE

### Trigger Conditions

Factory invokes Trae automatically when a PR meets **ANY** of these conditions:

1. **Protected Path Changed**: PR touches files in:
   - `GOVERNANCE/**`
   - `AGENTS/**`
   - `COCKPIT/**`
   - `.github/workflows/**`
   - `STATE/**`

2. **T1 or T2 Risk Tier**: PR is explicitly labeled as:
   - `tier-1` or `critical`
   - `tier-2` or `high-risk`

3. **Governance Validator Flags**: Trae check required based on PR content

### When NOT to Invoke Trae

- T3 (low-risk) changes in non-protected paths (APP/, PRODUCT/, BACKLOG/)
- T0 (informational) read-only operations
- Documentation-only changes (unless in GOVERNANCE/)
- Test files updates (unless in protected paths)

---

## STEP-BY-STEP INVOCATION PROTOCOL

### Step 1: Detect Need for Trae Review

Factory checks PR when opened or synchronized:

```python
# Pseudocode: Detect need for Trae review

def requires_trae_review(pr):
    # Check protected paths
    protected_paths = ["GOVERNANCE", "AGENTS", "COCKPIT", ".github/workflows", "STATE"]

    touches_protected = any(
        path in str(file) for file in pr.changed_files
        for path in protected_paths
    )

    # Check risk tier labels
    has_t1_label = "tier-1" in labels or "critical" in labels
    has_t2_label = "tier-2" in labels or "high-risk" in labels

    return touches_protected or has_t1_label or has_t2_label
```

**Output**: `True` (invoke Trae) or `False` (skip Trae)

---

### Step 2: Prepare Trae Review Context

Factory prepares a JSON payload with PR metadata:

```json
{
  "pr_number": 42,
  "pr_url": "https://github.com/owner/repo/pull/42",
  "pr_title": "feat: add Trae integration",
  "pr_author": "@username",
  ".diff": "@@ -1,5 +1,7 @@\n...",
  "files_changed": [
    {
      "path": "GOVERNANCE/GUARDRAILS.md",
      "lines_added": 5,
      "lines_deleted": 2,
      "lines_changed": 7
    },
    {
      "path": "scripts/governance_validator.py",
      "lines_added": 15,
      "lines_deleted": 0,
      "lines_changed": 15
    }
  ],
  "risk_tier": "T2",
  "labels": ["enhancement", "tier-2", "governance"],
  "governance_context": {
    "protected_paths": ["GOVERNANCE", "AGENTS", "COCKPIT", ".github/workflows", "STATE"],
    "risk_tier_definition": "...",
    "guardrails_summary": "...",
    "cost_policy_summary": "..."
  }
}
```

**Notes**:
- `.diff` contains full git diff output
- `governance_context` provides policy background
- Payload size limit: ~1MB (for large diffs, send file paths separately)

---

### Step 3: Send Review Request to Trae

Factory calls Trae's review endpoint:

```python
# Pseudocode: Call Trae reviewer

def call_trae_reviewer(pr_context):
    """
    Invoke Trae external reviewer.

    Returns: Trae verdict (dict with verdict, findings, recommendations)
    """

    trae_endpoint = "https://trae.example.com/api/review"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {get_trae_api_key()}"
    }

    try:
        response = requests.post(
            trae_endpoint,
            json=pr_context,
            headers=headers,
            timeout=120
        )

        response.raise_for_status()
        return response.json()

    except requests.exceptions.Timeout:
        # Handle timeout - retry or mark as pending
        return {"verdict": "PENDING", "error": "Trae service timeout"}

    except requests.exceptions.HTTPError as e:
        # Handle HTTP errors
        logger.error(f"Trae API error: {e}")
        return {"verdict": "ERROR", "error": str(e)}

    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error calling Trae: {e}")
        return {"verdict": "ERROR", "error": str(e)}
```

**Timeout**: 120 seconds (Trae may take up to 2 minutes for complex diffs)

**Retries**: 3 attempts with exponential backoff (5s, 10s, 20s)

---

### Step 4: Trae Processes and Returns Verdict

Trae analyzes the PR and returns a JSON verdict:

```json
{
  "verdict": "APPROVE",
  "review_scope": [
    "GOVERNANCE/GUARDRAILS.md",
    "scripts/governance_validator.py"
  ],
  "security_findings": [],
  "policy_violations": [],
  "recommendations": "No security or policy issues found. Change is compliant with governance policies.",
  "review_timestamp": "2026-01-25T10:30:00Z",
  "signature": "trae-external-reviewer"
}
```

**Verdict Types**:
- `APPROVE`: No issues, safe to merge
- `REJECT`: Critical issues found, must fix before merge
- `REQUEST_CHANGES`: Issues found, must fix and re-request before merge
- `EMERGENCY_OVERRIDE`: Trae unavailable and critical fix authorized; post-merge review required
- `ERROR`: Trae service error or issue
- `PENDING`: Review in progress (for async Trae)

---

### Step 5: Factory Creates TRAE_REVIEW Artifact

Factory creates a `TRAE_REVIEW` artifact in `COCKPIT/artifacts/TRAE_REVIEW/`:

```python
# Pseudocode: Create Trae review artifact

def create_trae_review_artifact(pr_number, trae_verdict):
    """
    Create TRAE_REVIEW artifact based on Trae's verdict.
    """

    artifact_id = f"TRAE-{datetime.now().strftime('%Y%m%d')}-{pr_number}"
    artifact_path = f"COCKPIT/artifacts/TRAE_REVIEW/{artifact_id}.yml"

    artifact_content = f"""
ARTIFACT_TYPE: TRAE_REVIEW
artifact_id: "{artifact_id}"
created_at: "{datetime.now().strftime('%Y-%m-%d %H:%M UTC')}"
created_by: "Factory (based on Trae verdict)"

pr_number: {pr_number}
pr_url: "https://github.com/owner/repo/pull/{pr_number}"

verdict: "{trae_verdict['verdict']}"
signature: "trae-external-reviewer"

review_scope:
{chr(10).join(f'  - "{scope}"' for scope in trae_verdict.get('review_scope', []))}

security_findings:
{chr(10).join(f'  - "{finding}"' for finding in trae_verdict.get('security_findings', []))}

policy_violations:
{chr(10).join(f'  - "{violation}"' for violation in trae_verdict.get('policy_violations', []))}

recommendations: |
  {trae_verdict.get('recommendations', 'No recommendations.')}

review_timestamp: "{trae_verdict.get('review_timestamp', datetime.now().strftime('%Y-%m-%d %H:%M UTC'))}"
expiry_days: 7

links:
  github_pr: "https://github.com/owner/repo/pull/{pr_number}"
  artifact_file: "{artifact_path}"
"""

    # Write artifact to file
    with open(artifact_path, 'w') as f:
        f.write(artifact_content)

    # Commit artifact to repository
    git_add(artifact_path)
    git_commit(f"chore: add Trae review artifact for PR #{pr_number}")
    git_push()

    return artifact_path
```

**Artifact Naming**: `TRAE-{YYYYMMDD}-{PR-NUMBER}.yml`

**Location**: `COCKPIT/artifacts/TRAE_REVIEW/`

---

### Step 6: Machine Board Validates Artifact

Machine Board (via `governance_validator.py` and `trae-review-validator.yml`) validates:

```python
# Pseudocode: Machine Board validates Trae artifact

def validate_trae_review_artifact(pr_number):
    """
    Check if TRAE_REVIEW artifact exists and is valid.
    """

    # Step 1: Find artifact for this PR
    trae_dir = Path("COCKPIT/artifacts/TRAE_REVIEW")
    artifact_files = list(trae_dir.glob(f"TRAE-*-{pr_number}.yml"))

    if not artifact_files:
        return {
            "passed": False,
            "message": f"No TRAE_REVIEW artifact found for PR #{pr_number}"
        }

    # Step 2: Parse artifact
    artifact = parse_yaml(artifact_files[0])

    # Step 3: Validate verdict
    verdict = artifact.get('verdict')
    if verdict not in ['APPROVE', 'EMERGENCY_OVERRIDE']:
        return {
            "passed": False,
            "message": f"Trae verdict is '{verdict}'. Require 'APPROVE' to merge."
        }

    # Step 4: Validate expiry (< 7 days old)
    created_at = parse_timestamp(artifact.get('created_at'))
    if is_stale(created_at, days=7):
        return {
            "passed": False,
            "message": "Trae review is stale (> 7 days). Re-request review."
        }

    # Step 5: All checks passed
    return {
        "passed": True,
        "message": "Trae review validated successfully"
    }
```

---

### Step 7: PR Merge Allowed or Blocked

Based on validation results:

| Machine Board | Trae Review | Branch Protection | Result |
|---------------|-------------|-------------------|--------|
| PASS | PASS | PASS | Merge allowed ✅ |
| PASS | PASS | FAIL | Merge blocked (branch protection issue) |
| PASS | FAIL | PASS | Merge blocked (Trae rejected) |
| FAIL | PASS | PASS | Merge blocked (other governance issue) |
| FAIL | FAIL | PASS | Merge blocked (multiple issues) |

---

## REVALIDATION ON PR UPDATE

### When PR Gets New Commit

1. **Factory detects change**: PR synchronize event
2. **Factory re-sends to Trae**: Updated context from Step 2
3. **Trae returns new verdict**: May change with new diff
4. **Factory updates artifact**:
   - Option A: Overwrite existing artifact
   - Option B: Create new artifact with timestamp suffix
5. **Machine Board re-runs**: Validates updated artifact

### Artifact Update Strategy

**Option A: Overwrite (Recommended)**
- Simpler artifact management
- Always single artifact per PR
- Update in-place: modify `COCKPIT/artifacts/TRAE_REVIEW/TRAE-20260125-042.yml`

**Option B: Create New**
- Full audit trail of reviews
- More artifacts to manage
- Naming: `TRAE-20260125-042-2.yml`, `TRAE-20260125-042-3.yml`

**Recommendation**: Use Option A (overwrite) for most cases, Option B (new) for complex multi-review scenarios.

---

## EMERGENCY OVERRIDE PROTOCOL

### When Trae Is Unavailable

If Trae service is down or unreachable:

1. **Declare emergency** by adding to PR description:
   ```markdown
   ## EMERGENCY OVERRIDE
   - Reason: Trae service unavailable, critical security fix needed
   - Authorized by: @username
   - Post-merge review required: true
   ```

2. **Factory creates artifact with override**:
   ```yaml
   verdict: "EMERGENCY_OVERRIDE"
   emergency_reason: "Trae service unavailable, critical security fix needed"
   authorized_by: "@username"
   post_merge_review_required: true
   ```

3. **Machine Board allows merge** with override flag
4. **Trae reviews post-merge** when service is restored
5. **Create incident artifact** if issues found

### Manual Override Checklist

- [ ] Document emergency reason
- [ ] Get founder authorization (comment on PR)
- [ ] Create EMERGENCY_OVERRIDE artifact
- [ ] Post-merge review required (yes/no)
- [ ] Rollback plan documented (if needed)
- [ ] Notify stakeholders (if applicable)

---

## TROUBLESHOOTING

### Problem: Trae Timeout

**Symptoms**: `Trae service timeout` error in artifact

**Causes**:
- Large PR diff (>1MB)
- Trae service overloaded
- Network connectivity issues

**Solutions**:
1. Retry invocation (automatic retry up to 3 times)
2. Split PR into smaller chunks
3. Reduce diff size by combining commits
4. Contact Trae service team if issue persists

---

### Problem: Trae HTTP Error

**Symptoms**: `Trae API error: 500 Internal Server Error`

**Causes**:
- Trae service down
- Trae API endpoint changed
- Authentication issues

**Solutions**:
1. Check Trae service status page
2. Verify API key is valid
3. Validate API endpoint URL
4. Use emergency override if critical PR

---

### Problem: Artifact Not Found

**Symptoms**: Machine Board fails: `No TRAE_REVIEW artifact found for PR`

**Causes**:
- Artifact creation failed
- Artifact not committed/pushed
- Artifact in wrong location

**Solutions**:
1. Check `COCKPIT/artifacts/TRAE_REVIEW/` directory
2. Re-run Trae invocation
3. Verify Factory has git write access
4. Check git logs for push failures

---

### Problem: Verdict Not APPROVE

**Symptoms**: Machine Board fails: `Trae verdict is 'REJECT'`

**Causes**:
- Security findings detected
- Policy violations found
- Risk issues identified

**Solutions**:
1. Review Trae's findings in artifact
2. Address security findings (hardcoded secrets, vulnerabilities)
3. Fix policy violations (guardrail compliance, risk tier accuracy)
4. Re-request Trae review after fixes
5. Contact Trae for clarification if needed

---

## MONITORING TRAE HEALTH

### Metrics to Track

1. **Invocation Success Rate**: % of successful Trae API calls
2. **Average Response Time**: Time from request to verdict
3. **Timeout Rate**: % of requests that timed out
4. **Verdict Distribution**: % of APPROVE/REJECT/REQUEST_CHANGES
5. **Artifact Age Distribution**: % of artifacts < 7 days old

### Alerts

Alert on:
- Trae invocation success rate < 95%
- Average response time > 60 seconds
- Timeout rate > 5%
- Verdict = REJECT > 10% (may indicate policy issues)

---

## VERSION HISTORY

- v1.0 (2026-01-25): Initial Trae review invocation protocol

---

**Document Version**: v1.0
**Last Updated**: 2026-01-25 by CTO Agent
