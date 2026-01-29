# Artifact Types — Mandatory Artifacts for Antigravity Cockpit

## Overview

This document defines the mandatory artifact types that must be created and maintained for the Antigravity Cockpit to operate effectively. Every piece of autonomous work must be represented as an artifact that the Founder can review, approve, and track.

---

## ARTIFACT PHILOSOPHY

### Artifacts-First Operating Model

**Definition**: An artifact is the complete, auditable record of a piece of autonomous work, including the plan, execution, verification, release, and any incidents.

**Purpose**: Artifacts serve as the Founder's review layer. The Founder reviews plans before work starts, verifies work after completion, and maintains a complete audit trail of all autonomous activity.

**Alignment to Antigravity**: This artifact type system aligns with Antigravity's concept of "Artifacts" as plans plus verification evidence, ensuring that all work is traceable and auditable.

---

## MANDATORY ARTIFACT TYPES

### Artifact Type 1: PLAN

**Definition**: A PLAN artifact captures the intent, scope, and risk assessment for a piece of work before execution begins.

**When Created**: Before any autonomous work starts (feature, bug fix, refactor, deployment, etc.)

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: PLAN

artifact_id: "PLAN-{timestamp}-{short-id}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "CTO Agent"

# FOUNDER SUMMARY - Required for cockpit display
founder_summary: |
  One-line plain-English summary for the Founder.
  What work is being proposed and why?

# PLAN DETAILS
plan_type: "FEATURE" | "BUG_FIX" | "REFACTOR" | "INCIDENT_RESPONSE" | "DEPLOYMENT"
objective: "What we want to achieve"
scope:
  in_scope:
    - "Specific items included in this plan"
  out_of_scope:
    - "Specific items explicitly excluded"

# ACCEPTANCE CRITERIA
acceptance_criteria:
  - "Specific, testable criteria for completion"
  - "Each criterion must be verifiable"

# RISK ASSESSMENT
risk_tier: "T1" | "T2" | "T3"
risk_justification: "Why this risk tier was assigned"
risk_categories:
  - "security" | "data_loss" | "availability" | "performance" | "cost" | "reliability"

# COST ESTIMATE
estimated_cost:
  breakdown:
    ai_assistance: "${amount}"
    external_apis: "${amount}"
    testing: "${amount}"
  total: "${amount}"
  exceeds_threshold: true/false

# GOVERNANCE CHECKS
governance_checks:
  requires_review: true/false
  requires_approval: true/false
  approval_type: "T1_GATE" | "T2_GATE" | "PROD_DEPLOY" | "COST_THRESHOLD" | "OTHER"
  approver_role: "FOUNDER" | "CTO" | "NONE"

# LINKS
links:
  github_issue: "https://github.com/owner/repo/issues/{number}"
  artifact_file: "COCKPIT/artifacts/PLAN-{timestamp}-{short-id}.md"

# DEPENDENCIES
dependencies:
  - "Other artifacts or external dependencies"

# NEXT STEPS
next_steps:
  - "Step 1: Founder approves PLAN artifact"
  - "Step 2: EXECUTION artifact is created"
  - "Step 3: Work begins"
```

**Example**:

```yaml
ARTIFACT_TYPE: PLAN
artifact_id: "PLAN-20260123-001"
created_at: "2026-01-23 10:00 UTC"
created_by: "CTO Agent"

founder_summary: "Add user profile picture upload feature with image resizing"

plan_type: "FEATURE"
objective: "Enable users to upload profile pictures from their device"
scope:
  in_scope:
    - "Image upload from device file picker"
    - "JPEG and PNG file type validation"
    - "5MB file size limit enforcement"
    - "Automatic resize to 200x200 pixels"
    - "Thumbnail generation (50x50)"
  out_of_scope:
    - "Social media account profile picture sync"
    - "Video profile pictures"

acceptance_criteria:
  - "Upload button exists on user profile edit page"
  - "File picker accepts JPEG and PNG files only"
  - "Maximum file size: 5MB enforced on client and server"
  - "Image is automatically resized to 200x200 pixels"
  - "Thumbnail (50x50) is generated"
  - "Success notification displayed after upload"
  - "Error message shown for invalid file type or size"

risk_tier: "T3"
risk_justification: "Non-critical feature, backward compatible, no data impact"
risk_categories:
  - "security" (file upload validation)
  - "cost" (storage usage)

estimated_cost:
  breakdown:
    ai_assistance: "$5"
    external_apis: "$0"
    testing: "$2"
  total: "$7"
  exceeds_threshold: false

governance_checks:
  requires_review: true
  requires_approval: false
  approval_type: "NONE"
  approver_role: "NONE"

links:
  github_issue: "https://github.com/owner/repo/issues/123"
  artifact_file: "COCKPIT/artifacts/PLAN-20260123-001.md"

dependencies:
  - "Storage service configuration"

next_steps:
  - "Step 1: Founder reviews PLAN and provides feedback if needed"
  - "Step 2: Factory creates EXECUTION artifact with implementation details"
  - "Step 3: Factory implements feature following plan"
```

---

### Artifact Type 2: EXECUTION

**Definition**: An EXECUTION artifact captures the actual work performed, files changed, tests written, and progress tracking during execution.

**When Created**: Work in progress, updated incrementally as work progresses.

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: EXECUTION

artifact_id: "EXEC-{timestamp}-{short-id}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "Code Agent"
plan_artifact_id: "PLAN-{timestamp}-{short-id}"

# FOUNDER SUMMARY - Required for cockpit display
founder_summary: |
  One-line plain-English summary of current execution status.
  What is currently being worked on and at what stage?

# EXECUTION DETAILS
execution_status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE"
progress_percentage: "0-100%"
started_at: "YYYY-MM-DD HH:MM UTC"
completed_at: "YYYY-MM-DD HH:MM UTC" # or null if not complete

# WORK COMPLETED
completed_items:
  - "Item 1 completed"
  - "Item 2 completed"

# WORK IN PROGRESS
in_progress_items:
  - "Item 1: description, current state"
  - "Item 2: description, current state"

# FILES MODIFIED
files_modified:
  - path: "/path/to/file.py"
    action: "CREATED" | "MODIFIED" | "DELETED"
    lines_changed: N
    description: "Change description"
  - path: "/path/to/another_file.py"
    action: "MODIFIED"
    lines_changed: N
    description: "Change description"

# TESTS WRITTEN
tests_written:
  - path: "/path/to/test_feature.py"
    test_count: N
    coverage: "XX%"
    passing: true/false

# BLOCKERS (if any)
blockers:
  - blocker: "Blocker description"
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    blocked_item: "What item is blocked"
    resolution_plan: "How to resolve"

# ACTUAL COST
actual_cost:
  ai_assistance_actual: "${amount}"
  external_apis_actual: "${amount}"
  testing_actual: "${amount}"
  total_actual: "${amount}"
  over_budget: true/false

# LINKS
links:
  github_pr: "https://github.com/owner/repo/pull/{number}" # when PR created
  ci_status: "https://github.com/owner/repo/actions/runs/{run_id}"
  artifact_file: "COCKPIT/artifacts/EXEC-{timestamp}-{short-id}.md"
```

**Example**:

```yaml
ARTIFACT_TYPE: EXECUTION
artifact_id: "EXEC-20260123-002"
created_at: "2026-01-23 11:30 UTC"
created_by: "Code Agent"
plan_artifact_id: "PLAN-20260123-001"

founder_summary: "Implementing user profile picture upload feature. Backend complete, frontend in progress."

execution_status: "IN_PROGRESS"
progress_percentage: "60%"
started_at: "2026-01-23 11:30 UTC"
completed_at: null

completed_items:
  - "Backend API endpoint for image upload (/api/user/avatar)"
  - "Server-side validation (file type, size)"
  - "Image resizing service integration"

in_progress_items:
  - "Frontend: File picker component - 80% complete"
  - "Frontend: Upload button - 60% complete"

files_modified:
  - path: "backend/api/user.py"
    action: "MODIFIED"
    lines_changed: 45
    description: "Added upload_avatar endpoint"
  - path: "backend/services/image_processor.py"
    action: "CREATED"
    lines_changed: 80
    description: "Image resizing and thumbnail generation"
  - path: "frontend/pages/profile.js"
    action: "MODIFIED"
    lines_changed: 30
    description: "Added upload button component"

tests_written:
  - path: "backend/tests/test_user_api.py"
    test_count: 12
    coverage: "95%"
    passing: true

blockers: []

actual_cost:
  ai_assistance_actual: "$3"
  external_apis_actual: "$0"
  testing_actual: "$1"
  total_actual: "$4"
  over_budget: false

links:
  github_pr: "https://github.com/owner/repo/pull/42"
  ci_status: "https://github.com/owner/repo/actions/runs/123456"
  artifact_file: "COCKPIT/artifacts/EXEC-20260123-002.md"
```

---

### Artifact Type 3: VERIFICATION

**Definition**: A VERIFICATION artifact captures proof that work meets acceptance criteria, passes all tests, and is ready for release.

**When Created**: After execution is complete, before release or deployment.

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: VERIFICATION

artifact_id: "VER-{timestamp}-{short-id}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "Reliability Agent"
exec_artifact_id: "EXEC-{timestamp}-{short-id}"
plan_artifact_id: "PLAN-{timestamp}-{short-id}"

# FOUNDER SUMMARY - Required for cockpit display
founder_summary: |
  One-line plain-English summary of verification status.
  Is the work verified and ready for release?

# VERIFICATION STATUS
overall_status: "PASS" | "FAIL" | "IN_PROGRESS"
verification_date: "YYYY-MM-DD HH:MM UTC"
verified_by: "Reliability Agent"

# ACCEPTANCE CRITERIA VERIFICATION
acceptance_criteria_check:
  - criterion: "Specific criterion from PLAN"
    status: "PASS" | "FAIL" | "NOT_APPLICABLE"
    evidence: "How this was verified"
    screenshot_or_log: "Path to screenshot or log if applicable"
  - criterion: "Another criterion"
    status: "PASS"
    evidence: "Verification evidence"

# TEST RESULTS
test_results:
  total_tests: N
  passed_tests: N
  failed_tests: N
  coverage_percentage: "XX%"
  test_run_id: "CI run ID or link"

# CI/CD STATUS
ci_status:
  build_passing: true/false
  all_checks_passing: true/false
  failed_checks:
    - check_name: "Check name"
      reason: "Failure reason"
  ci_link: "https://github.com/owner/repo/actions/runs/{run_id}"

# VERIFICATION PROOF - CRITICAL SECTION
verification_proof:
  manual_testing:
    - test_scenario: "Scenario description"
      tester: "Reliability Agent"
      result: "PASS" | "FAIL"
      notes: "Observations"
  automated_testing:
    - test_suite: "Test suite name"
      result: "PASS" | "FAIL"
      details: "Test output summary"
  code_review:
    reviewed_by: "Reviewer Agent or CTO Agent"
    review_status: "APPROVED" | "NEEDS_CHANGES" | "REJECTED"
    review_comments: "Summary of review"
  other_evidence:
    - "Screenshot of working feature"
    - "Log excerpt showing correct behavior"

# DEFECTS FOUND
defects_found:
  - defect: "Defect description"
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    status: "BLOCKS_RELEASE" | "FIXED" | "DEFERRED"
    fix_link: "PR or issue link if fixed"

# RECOMMENDATION
recommendation: "READY_FOR_RELEASE" | "NEEDS_FIXES" | "BLOCKED"
recommendation_justification: "Why this recommendation"

# LINKS
links:
  github_pr: "https://github.com/owner/repo/pull/{number}"
  exec_artifact: "COCKPIT/artifacts/EXEC-{timestamp}-{short-id}.md"
  artifact_file: "COCKPIT/artifacts/VER-{timestamp}-{short-id}.md"
```

**Example**:

```yaml
ARTIFACT_TYPE: VERIFICATION
artifact_id: "VER-20260123-003"
created_at: "2026-01-23 14:00 UTC"
created_by: "Reliability Agent"
exec_artifact_id: "EXEC-20260123-002"
plan_artifact_id: "PLAN-20260123-001"

founder_summary: "User profile upload feature verified. All acceptance criteria passed. Ready for release."

overall_status: "PASS"
verification_date: "2026-01-23 14:00 UTC"
verified_by: "Reliability Agent"

acceptance_criteria_check:
  - criterion: "Upload button exists on user profile edit page"
    status: "PASS"
    evidence: "Manual verification: button visible and clickable"
    screenshot_or_log: "COCKPIT/evidence/upload_button.png"
  - criterion: "File picker accepts JPEG and PNG files only"
    status: "PASS"
    evidence: "Manual verification: other file types rejected with error message"
  - criterion: "Maximum file size: 5MB enforced on client and server"
    status: "PASS"
    evidence: "Uploads >5MB rejected at client and validated at server"
  - criterion: "Image is automatically resized to 200x200 pixels"
    status: "PASS"
    evidence: "Verified uploaded images are 200x200 pixels"
  - criterion: "Thumbnail (50x50) is generated"
    status: "PASS"
    evidence: "Thumbnail present in storage with correct dimensions"
  - criterion: "Success notification displayed after upload"
    status: "PASS"
    evidence: "Notification shown after successful upload"
  - criterion: "Error message shown for invalid file type or size"
    status: "PASS"
    evidence: "Error messages shown correctly for invalid inputs"

test_results:
  total_tests: 25
  passed_tests: 25
  failed_tests: 0
  coverage_percentage: "94%"
  test_run_id: "https://github.com/owner/repo/actions/runs/123456"

ci_status:
  build_passing: true
  all_checks_passing: true
  failed_checks: []
  ci_link: "https://github.com/owner/repo/actions/runs/123456"

verification_proof:
  manual_testing:
    - test_scenario: "Upload JPEG file under 5MB"
      tester: "Reliability Agent"
      result: "PASS"
      notes: "Upload successful, image resized, thumbnail generated"
    - test_scenario: "Upload PNG file exactly 5MB"
      tester: "Reliability Agent"
      result: "PASS"
      notes: "Upload successful"
    - test_scenario: "Upload GIF file (should be rejected)"
      tester: "Reliability Agent"
      result: "PASS"
      notes: "Correctly rejected with error message"
  automated_testing:
    - test_suite: "backend/tests/test_user_api.py"
      result: "PASS"
      details: "12/12 tests passing, 95% coverage"
  code_review:
    reviewed_by: "CTO Agent"
    review_status: "APPROVED"
    review_comments: "Clean implementation, good error handling, tests comprehensive"
  other_evidence:
    - "COCKPIT/evidence/upload_demo.png"
    - "COCKPIT/evidence/error_message.png"

defects_found: []

recommendation: "READY_FOR_RELEASE"
recommendation_justification: "All acceptance criteria passed, all tests passing, no critical defects found"

links:
  github_pr: "https://github.com/owner/repo/pull/42"
  exec_artifact: "COCKPIT/artifacts/EXEC-20260123-002.md"
  artifact_file: "COCKPIT/artifacts/VER-20260123-003.md"
```

---

### Artifact Type 4: RELEASE

**Definition**: A RELEASE artifact captures the deployment of verified work to production or staging environments.

**When Created**: When verified work is deployed to an environment.

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: RELEASE

artifact_id: "REL-{timestamp}-{short-id}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "CTO Agent"
ver_artifact_id: "VER-{timestamp}-{short-id}"

# FOUNDER SUMMARY - Required for cockpit display
founder_summary: |
  One-line plain-English summary of release status.
  What was released and to where?

# RELEASE DETAILS
release_type: "PRODUCTION" | "STAGING" | "CANARY"
release_version: "v1.2.3" or "SHA: abc123"
release_date: "YYYY-MM-DD HH:MM UTC"
target_environment: "production" | "staging" | "staging-2"

# WHAT'S INCLUDED
includes:
  - "Plan: User profile upload feature (PLAN-20260123-001)"
  - "PR: #42 - Add user profile upload"
  - "SHA: abc123def456"

# ROLLBACK PLAN
rollback_plan:
  available: true/false
  rollback_command: "git revert abc123 || previous release rollback procedure"
  rollback_time_estimate: "< 5 minutes"
  last_known_good: "SHA of previous commit or release"

# DEPLOYMENT VERIFICATION
deployment_verification:
  health_check_passing: true/false
  metrics_normal: true/false
  error_rate_within_threshold: true/false
  issues_detected: []

# POST-DEPLOYMENT MONITORING
monitoring_period_ends: "YYYY-MM-DD HH:MM UTC" # +1 hour for prod
monitoring_checklist:
  - check: "Error rate < 0.1%"
    status: "PASS" | "FAIL" | "PENDING"
    notes: "Observations"
  - check: "Response time < 200ms p95"
    status: "PASS"
    notes: "Observations"

# RISK ASSESSMENT FOR RELEASE
release_risk_tier: "T1" | "T2" | "T3" # inherited or escalated
requires_founder_approval: true/false
approval_granted_by: "Founder" or null
approval_timestamp: "YYYY-MM-DD HH:MM UTC" or null

# LINKS
links:
  github_release: "https://github.com/owner/repo/releases/tag/v1.2.3"
  ver_artifact: "COCKPIT/artifacts/VER-{timestamp}-{short-id}.md"
  deployment_log: "COCKPIT/logs/REL-{timestamp}-log.txt"
  artifact_file: "COCKPIT/artifacts/REL-{timestamp}-{short-id}.md"
```

**Example**:

```yaml
ARTIFACT_TYPE: RELEASE
artifact_id: "REL-20260123-004"
created_at: "2026-01-23 15:00 UTC"
created_by: "CTO Agent"
ver_artifact_id: "VER-20260123-003"

founder_summary: "Released user profile upload feature to production"

release_type: "PRODUCTION"
release_version: "v1.2.3"
release_date: "2026-01-23 15:00 UTC"
target_environment: "production"

includes:
  - "Plan: User profile upload feature (PLAN-20260123-001)"
  - "PR: #42 - Add user profile upload"
  - "SHA: abc123def456"

rollback_plan:
  available: true
  rollback_command: "git revert abc123 && deploy to production"
  rollback_time_estimate: "< 5 minutes"
  last_known_good: "v1.2.2"

deployment_verification:
  health_check_passing: true
  metrics_normal: true
  error_rate_within_threshold: true
  issues_detected: []

monitoring_period_ends: "2026-01-23 16:00 UTC"
monitoring_checklist:
  - check: "Error rate < 0.1%"
    status: "PASS"
    notes: "Current error rate: 0.02%, trending stable"
  - check: "Response time < 200ms p95"
    status: "PASS"
    notes: "Current p95: 145ms, within threshold"
  - check: "Upload success rate > 99%"
    status: "PASS"
    notes: "Success rate: 99.7%"
  - check: "No user-reported issues"
    status: "PASS"
    notes: "No issues reported in support channels"

release_risk_tier: "T3"
requires_founder_approval: false
approval_granted_by: null
approval_timestamp: null

links:
  github_release: "https://github.com/owner/repo/releases/tag/v1.2.3"
  ver_artifact: "COCKPIT/artifacts/VER-20260123-003.md"
  deployment_log: "COCKPIT/logs/REL-20260123-004-log.txt"
  artifact_file: "COCKPIT/artifacts/REL-20260123-004.md"
```

---

### Artifact Type 5: INCIDENT

**Definition**: An INCIDENT artifact captures an incident that occurred, its impact, root cause, resolution, and learnings.

**When Created**: When an incident is detected (automatically or manually).

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: INCIDENT

artifact_id: "INC-{timestamp}-{short-id}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "Reliability Agent"
detected_at: "YYYY-MM-DD HH:MM UTC"

# FOUNDER SUMMARY - Required for cockpit display
founder_summary: |
  One-line plain-English summary of incident.
  What happened, impact, and current status?

# INCIDENT DETAILS
incident_id: "INC-XXX" # sequential numbering
severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
affected_component: "Component or system affected"
affected_users: "Number of users affected, or estimate"

# INCIDENT TIMELINE
timeline:
  - timestamp: "YYYY-MM-DD HH:MM UTC"
    event: "Event description"
  - timestamp: "YYYY-MM-DD HH:MM UTC"
    event: "Event description"

# IMPACT
impact_description: "Description of user or system impact"
business_impact: "Description of business impact (if applicable)"
duration_in_minutes: N

# ROOT CAUSE ANALYSIS
root_cause: "Primary cause of incident"
contributing_factors:
  - "Factor 1"
  - "Factor 2"
root_cause_category: "CODE_BUG" | "CONFIGURATION_ERROR" | "INFRASTRUCTURE" | "DEPENDENCY" | "HUMAN_ERROR" | "OTHER"

# RESOLUTION
resolution_status: "RESOLVED" | "MITIGATED" | "ONGOING" | "ESCALATED"
resolved_at: "YYYY-MM-DD HH:MM UTC" # or null
resolution_action: "What was done to resolve/mitigate"
resolution_pr: "https://github.com/owner/repo/pull/{number}" # if applicable

# VERIFICATION OF FIX
fix_verification:
  verified: true/false
  verification_method: "Manual testing" | "Automated testing" | "Monitoring"
  verification_details: "How fix was verified"

# PREVENTION MEASURES
prevention_measures:
  - "Measure 1 to prevent recurrence"
  - "Measure 2 to prevent recurrence"

# INCIDENT POST-MORTEM (after resolution)
post_mortem_required: true/false
post_mortem_url: "COCKPIT/post-mortems/INC-XXX-post-mortem.md"

# LINKS
links:
  github_issue: "https://github.com/owner/repo/issues/{number}"
  incident_logs: "COCKPIT/logs/INC-{timestamp}-logs.txt"
  artifact_file: "COCKPIT/artifacts/INC-{timestamp}-{short-id}.md"
```

**Example**:

```yaml
ARTIFACT_TYPE: INCIDENT
artifact_id: "INC-20260123-005"
created_at: "2026-01-23 16:30 UTC"
created_by: "Reliability Agent"
detected_at: "2026-01-23 16:15 UTC"

founder_summary: "CRITICAL: Image upload service degraded - 40% of uploads failing with timeout errors"

incident_id: "INC-001"
severity: "CRITICAL"
affected_component: "Image upload and resizing service"
affected_users: "Approximately 2,000 users attempted uploads in last 30 minutes"

timeline:
  - timestamp: "2026-01-23 16:00 UTC"
    event: "Normal operations observed"
  - timestamp: "2026-01-23 16:10 UTC"
    event: "Upload timeout rate increased to 15%"
  - timestamp: "2026-01-23 16:15 UTC"
    event: "Upload timeout rate increased to 40%, detected by monitoring"
  - timestamp: "2026-01-23 16:20 UTC"
    event: "Incident declared, Reliability Agent investigating"
  - timestamp: "2026-01-23 16:30 UTC"
    event: "Root cause identified: external image resize API rate-limited"

impact_description: "Users experiencing upload failures with timeout errors. Impact on core user feature."
business_impact: "Negative user experience, potential churn, support ticket increase expected"
duration_in_minutes: 15

root_cause: "External image resize API (img.resizer.io) exceeded rate limit due to traffic surge from new feature release"
contributing_factors:
  - "New feature release increased upload volume by 400%"
  - "Rate limit on external API was set based on old traffic patterns"
  - "No automatic throttling or circuit breaker implemented"
root_cause_category: "INFRASTRUCTURE"

resolution_status: "MITIGATED"
resolved_at: null
resolution_action: "1. Switched to alternative resize provider (resize.cloud) with higher rate limit. 2. Implemented request queue with exponential backoff. 3. Added circuit breaker to fail fast when external service is overloaded."
resolution_pr: "https://github.com/owner/repo/pull/43"

fix_verification:
  verified: true
  verification_method: "Monitoring"
  verification_details: "Monitor shows upload timeout rate decreased from 40% to 2.5%, within threshold"

prevention_measures:
  - "Implement automatic rate limit detection with alerting"
  - "Add circuit breaker pattern to all external API calls"
  - "Resize provider selection should be configurable for fast failover"
  - "Perform load testing before feature releases that increase traffic"

post_mortem_required: true
post_mortem_url: "COCKPIT/post-mortems/INC-001-post-mortem.md"

links:
  github_issue: "https://github.com/owner/repo/issues/99"
  incident_logs: "COCKPIT/logs/INC-20260123-005-logs.txt"
  artifact_file: "COCKPIT/artifacts/INC-20260123-005.md"
```

---

### Artifact Type 6: TRAE_REVIEW

**Definition**: A TRAE_REVIEW artifact captures the external security and policy review provided by Trae, the read-only external reviewer, for T1-T4 changes.

**When Created**: When Trae completes a review for a T1-T4 PR (created by Factory based on Trae's verdict).

**Mandatory Fields**:

```yaml
ARTIFACT_TYPE: TRAE_REVIEW

artifact_id: "TRAE-{timestamp}-{pr-number}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "Factory (based on Trae verdict)"

# REVIEW CONTEXT
pr_number: {pr-number}
pr_url: "https://github.com/owner/repo/pull/{pr-number}"

# TRAE'S VERDICT
verdict: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "EMERGENCY_OVERRIDE"
signature: "trae-external-reviewer"

# REVIEW SCOPE
review_scope:
  - "List of files/directories reviewed by Trae"

# FINDINGS
security_findings:
  - "Finding 1 or empty list"
  - "Finding 2 or empty list"
policy_violations:
  - "Violation 1 or empty list"
  - "Violation 2 or empty list"

# RECOMMENDATIONS
recommendations: |
  Trae's recommendations and feedback.
  Include guidance for fixes if requested changes.

# METADATA
review_timestamp: "YYYY-MM-DD HH:MM UTC"
expiry_days: 7

# ARTIFACT LINKS
links:
  github_pr: "https://github.com/owner/repo/pull/{pr-number}"
  artifact_file: "COCKPIT/artifacts/TRAE_REVIEW/TRAE-{timestamp}-{pr-number}.yml"
```

**Fields Explained**:

| Field | Description |
|-------|-------------|
| `artifact_id` | Unique ID: TRAE-{YYYYMMDD}-{PR-NUMBER} |
| `created_at` | Timestamp when Factory created the artifact |
| `pr_number` | GitHub PR number being reviewed |
| `verdict` | Trae's verdict (APPROVE, REJECT, REQUEST_CHANGES, EMERGENCY_OVERRIDE) |
| `review_scope` | Files/directories Trae reviewed |
| `security_findings` | List of security issues found (or empty) |
| `policy_violations` | List of policy violations found (or empty) |
| `recommendations` | Trae's guidance for fixes or improvements |
| `review_timestamp` | Timestamp when Trae completed review |
| `expiry_days` | Artifact expires after X days (default: 7) |

**Verdict Types**:

| Verdict | Meaning | Merge Allowed |
|---------|---------|---------------|
| `APPROVE` | No issues, compliant with governance | ✅ Yes |
| `REJECT` | Critical security/policy issues found | ❌ No |
| `REQUEST_CHANGES` | Minor issues, should address | ⚠️ Depends on policy |
| `EMERGENCY_OVERRIDE` | Emergency situation, bypass review | ✅ Yes (with flag) |

**Example - Approved PR**:

```yaml
ARTIFACT_TYPE: TRAE_REVIEW
artifact_id: "TRAE-20260125-042"
created_at: "2026-01-25 10:30 UTC"
created_by: "Factory (based on Trae verdict)"

pr_number: 42
pr_url: "https://github.com/owner/repo/pull/42"

verdict: "APPROVE"
signature: "trae-external-reviewer"

review_scope:
  - "GOVERNANCE/GUARDRAILS.md"
  - "scripts/governance_validator.py"

security_findings: []
policy_violations: []

recommendations: "No security or policy issues found. Change is compliant with governance policies and safe to merge."

review_timestamp: "2026-01-25 10:30 UTC"
expiry_days: 7

links:
  github_pr: "https://github.com/owner/repo/pull/42"
  artifact_file: "COCKPIT/artifacts/TRAE_REVIEW/TRAE-20260125-042.yml"
```

**Example - Rejected PR (Security Issues)**:

```yaml
ARTIFACT_TYPE: TRAE_REVIEW
artifact_id: "TRAE-20260125-043"
created_at: "2026-01-25 11:00 UTC"
created_by: "Factory (based on Trae verdict)"

pr_number: 43
pr_url: "https://github.com/owner/repo/pull/43"

verdict: "REJECT"
signature: "trae-external-reviewer"

review_scope:
  - "APP/auth.py"

security_findings:
  - "Hardcoded password in APP/auth.py line 42: password = 'secret123'"
  - "SQL injection risk: User input directly interpolated into SQL query on line 58"

policy_violations: []

recommendations: |
  CRITICAL: Fix security issues before merging:
  1. Remove hardcoded password, use environment variables or secrets manager
  2. Use parameterized queries to prevent SQL injection
  3. Re-request Trae review after fixes

review_timestamp: "2026-01-25 11:00 UTC"
expiry_days: 7

links:
  github_pr: "https://github.com/owner/repo/pull/43"
  artifact_file: "COCKPIT/artifacts/TRAE_REVIEW/TRAE-20260125-043.yml"
```

**How Trae Artifacts Are Created**:

1. **Factory invokes Trae**: When T1-T4 PR is opened, Factory sends PR context to Trae
2. **Trae returns verdict**: Trae analyzes and returns verdict (JSON)
3. **Factory creates artifact**: Based on Trae's verdict, Factory creates TRAE_REVIEW artifact
4. **Machine Board validates**: Validator checks artifact exists and verdict==APPROVE
5. **PR allowed to merge**: Only if Trae review passes

**Artifact Expiry**:

- Artifacts expire after 7 days by default
- Expired artifacts require fresh Trae review
- PR updates (new commits) trigger artifact refresh

**Emergency Override**:

In emergencies, use `verdict: "EMERGENCY_OVERRIDE"` with:
```yaml
verdict: "EMERGENCY_OVERRIDE"
emergency_reason: "Trae service unavailable, critical security fix needed"
authorized_by: "@username"
post_merge_review_required: true
```

**See Also**:
- `AGENTS/TRAE.md` - Full Trae agent definition
- `RUNBOOKS/trae-review.md` - Invocation and protocol
- `COCKPIT/artifacts/TRAE_REVIEW/TEMPLATE.md` - Artifact template

---

## ARTIFACT LIFECYCLE

### Typical Artifact Flow

```
PLAN → EXECUTION → VERIFICATION → RELEASE
```

**Incident Flow** (occurs independently of normal flow):
```
DETECTED → INCIDENT CREATED → RESOLUTION → POST-MORTEM
```

**Trae Review Flow** (for T1-T4 changes):
```
FACTORY → TRAE → TRAE_REVIEW ARTIFACT → MACHINE BOARD VALIDATION
```

### Artifact Transitions

| From State | To State | Trigger |
|------------|----------|---------|
| PLAN CREATED | EXECUTION CREATED | Founder approves PLAN |
| EXECUTION IN PROGRESS | VERIFICATION CREATED | Execution complete |
| VERIFICATION PASS | RELEASE CREATED | Founder approves release (or auto-approve T3) |
| RELEASE DEPLOYED | MONITORING | Release deployed |
| INCIDENT DETECTED | INCIDENT CREATED | Monitoring detects issue |
| INCIDENT RESOLVED | POST-MORTEM | Incident resolved |

### Artifact Status Tracking

Each artifact has a `status` field:
- `NOT_STARTED`: Artifact created but not yet acted upon
- `IN_PROGRESS`: Work actively in progress
- `BLOCKED`: Work blocked by external factor
- `COMPLETE`: Artifact complete
- `CANCELED`: Work canceled

---

## ARTIFACT STORAGE

### File Structure

Artifacts are stored in the repository:

```
COCKPIT/
├── artifacts/
│   ├── PLAN-{timestamp}-{id}.md
│   ├── EXEC-{timestamp}-{id}.md
│   ├── VER-{timestamp}-{id}.md
│   ├── REL-{timestamp}-{id}.md
│   └── INC-{timestamp}-{id}.md
├── evidence/              # Screenshots, logs for verification
├── logs/                  # Deployment logs, incident logs
└── post-mortems/          # Post-mortem documents
```

### Artifact Index

COCKPIT/ARTIFACT_INDEX.md contains a master index of all artifacts:

```markdown
# Artifact Index

## Active Artifacts

| Artifact ID | Type | Status | Created | Link |
|-------------|------|--------|---------|------|
| PLAN-20260123-001 | PLAN | COMPLETE | 2026-01-23 | [view](artifacts/PLAN-20260123-001.md) |
| EXEC-20260123-002 | EXECUTION | COMPLETE | 2026-01-23 | [view](artifacts/EXEC-20260123-002.md) |
| VER-20260123-003 | VERIFICATION | COMPLETE | 2026-01-23 | [view](artifacts/VER-20260123-003.md) |
| REL-20260123-004 | RELEASE | COMPLETE | 2026-01-23 | [view](artifacts/REL-20260123-004.md) |
| INC-20260123-005 | INCIDENT | MITIGATED | 2026-01-23 | [view](artifacts/INC-20260123-005.md) |

## Artifact Relationships

- PLAN-20260123-001 → EXEC-20260123-002 → VER-20260123-003 → REL-20260123-004
```

---

## ARTIFACT VALIDATION

### Mandatory Field Validation

Every artifact must include:
- [ ] `ARTIFACT_TYPE` (one of PLAN, EXECUTION, VERIFICATION, RELEASE, INCIDENT)
- [ ] `founder_summary` (plain English, 1-3 sentences)
- [ ] `links.github_issue` or `links.github_pr` (GitHub reference)
- [ ] `artifact_file` (self-reference)
- [ ] Artifact-specific required fields

### Artifact Type-Specific Validation

| Artifact Type | Critical Fields |
|---------------|-----------------|
| PLAN | risk_tier, estimated_cost, acceptance_criteria |
| EXECUTION | execution_status, files_modified, tests_written |
| VERIFICATION | overall_status, acceptance_criteria_check, verification_proof |
| RELEASE | release_type, rollback_plan, deployment_verification |
| INCIDENT | severity, root_cause, resolution_status |

---

## COCKPIT INTEGRATION

### How Cockpit Uses Artifacts

1. **STATUS Panel**: Shows active artifacts and their status
2. **ACTIVE WORK Panel**: Shows in-progress execution artifacts
3. **APPROVALS Panel**: Shows PLAN artifacts waiting for approval
4. **RISKS Panel**: Shows INCIDENT artifacts with HIGH/CRITICAL severity
5. **RELEASES Panel**: Shows RELEASE artifacts and verification status

### Artifact Dashboard Actions

- View artifact (opens artifact file)
- Approve artifact (for PLAN and RELEASE artifacts)
- Request changes (adds feedback comment)
- View related artifacts (navigates through artifact chain)

---

## VERSION HISTORY

- v1.0 (Initial): Mandatory artifact types with founder summaries, links, risk tiers, cost estimates, verification proof

---

<!-- test: trae enforcement negative (this is a test change that should be reverted after validation) -->
<!-- test: trae enforcement positive (Test B: Trae APPROVE should allow this T1 PR) -->

**Document Version**: v1.0
**Last Updated**: 2026-01-25 by Ops/QA Droid
