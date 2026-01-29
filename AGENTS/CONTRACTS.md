# Contracts — Agent Outputs and Deliverables

## Overview

This document defines the specific contracts for each agent — the precise outputs and deliverables each agent must produce for different task types. These contracts ensure predictability, quality, and consistency across all autonomous work.

---

## CONTRACT STRUCTURE

Each contract includes:

1. **Trigger**: When this contract applies
2. **Input**: Required information to begin work
3. **Output**: Specific deliverables required
4. **Validation Criteria**: How to verify contract fulfillment
5. **Next State**: Where the system proceeds after contract completion
6. **Exception Handling**: What to do if constraints cannot be met

---

## PRODUCT AGENT CONTRACTS

### CONTRACT P-1: Parse Raw Requirement

**Trigger**: Human provides informal requirement

**Input**:
```
Human Task: Natural language description of feature/change
Example: "I want users to be able to upload profile pictures"
```

**Output**:
```yaml USER_STORY.md, "User can upload their profile picture"
  description: "Standard JPEG/PNG upload with max 5MB, auto-thumbnail"
  acceptance_criteria:
    - Upload button exists on profile page
    - File selection dialog accepts images
    - Validation rejects non-image files
    - Image size limited to 5MB
    - Thumbnail generated automatically
    - Success message displayed after upload
    - Error message for upload failures
  risk_tier: "T3"
  dependencies: []
  estimated_cost: $15
```

**Validation Criteria**:
- User story follows standard format
- Acceptance criteria are specific and testable
- Risk tier correctly assigned
- Dependencies identified
- Cost estimate reasonable

**Next State**: PLANNING (Code Agent to begin implementation)

**Exception Handling**:
- If ambiguous: Ask clarifying questions, WAITING_FOR_HUMAN state
- If unrealistic expectations: Push back with constraints

---

### CONTRACT P-2: Prioritize Backlog

**Trigger**: New backlog items added or priorities need adjustment

**Input**:
- Current backlog items
- Founder's priorities or strategic direction

**Output**:
```yaml BACKLOG/prioritized_tasks.yaml
backlog:
  - id: "US-001"
    title: "User registration flow"
    priority: "P0"
    complexity: "Medium"
    business_value: "Critical — MVP requirement"
  - id: "US-002"
    title: "Dashboard analytics"
    priority: "P1"
    complexity: "High"
    business_value: "High — user retention"
  - id: "US-003"
    title: "User profile customization"
    priority: "P2"
    complexity: "Low"
    business_value: "Medium — user satisfaction"
recommended_next: ["US-001"]
blocked_on: {}
```

**Validation Criteria**:
- All items have priority assigned
- Dependencies correctly identified
- Business value rational explained
- Recommended next task makes sense

**Next State**: PLANNING (proceeds with top backlog item)

---

### CONTRACT P-3: Clarify Ambiguity

**Trigger**: Requirement contains unclear elements

**Input**:
- Ambiguous requirement text

**Output**:
```
CLARIFICATION_REQUEST
Ambiguity detected in: [specific text]

Questions to resolve:
1. Should users see other users' profiles, or only their own?
2. What happens if upload fails — do we retry automatically?
3. Where should uploaded images be stored (which service)?

Please provide clarity to proceed.

Options to consider:
A: [Option A description]
B: [Option B description]
C: [Option C description]
```

**Validation Criteria**:
- Specific ambiguities identified
- Questions are clear and specific
- Options provided where helpful
- State transition to WAITING_FOR_HUMAN

**Next State**: WAITING_FOR_HUMAN (await founder response)

---

## CODE AGENT CONTRACTS

### CONTRACT C-1: Implement Feature

**Trigger**: User story accepted, ready to implement

**Input**:
```yaml
USER_STORY.md: User story with acceptance criteria
EXISTING_CODE: Relevant codebase files
ARCHITECTURE_DOC: Any relevant architecture docs
```

**Output**:
```diff
--- app/routes/users.py (original)
+++ app/routes/users.py (modified)
@@ -10,0 +11,6 @@
+@router.post("/{user_id}/avatar")
+async def upload_avatar(
+    user_id: int,
+    file: UploadFile,
+    db: Session
+):
+    """Upload and process user avatar image."""
+    # Validate file type and size
+    # Store in S3 (or local in dev)
+    # Generate thumbnail
+    # Update database
+    # Return success
```

Plus:
- `tests/users/test_avatar.py`: New test file
- `migrations/add_avatar_column.sql`: If DB changes needed
- `README_CHANGELOG.md`: Update changelog

**Validation Criteria**:
- Code compiles/runs without errors
- Linting passes
- Type checking passes (if applicable)
- All acceptance criteria addressed
- Tests for new code written
- Follows existing patterns

**Next State**: RELIABILITY_VALIDATION

---

### CONTRACT C-2: Fix Bug

**Trigger**: Bug report received

**Input**:
```
BUG_REPORT: Description of issue, reproduction steps, expected behavior
ERROR_LOGS: Any available logs or stack traces
```

**Output**:
```python
# Fix location: app/services/auth.py, line 45

# Before (buggy)
# return user.permissions.is_admin

# After (fixed)
return user.permissions.has_role("admin") if user.permissions else False
```

Plus:
- `tests/auth/test_permission_check.py`: Test covering bug
- `BACKLOG/bugs/BUG-XXX.md`: Documentation of bug and fix

**Validation Criteria**:
- Fix addresses root cause
- Minimal changes made
- Test reproduces original bug
- Test verifies fix works
- No regressions introduced

**Next State**: RELIABILITY_VALIDATION

---

### CONTRACT C-3: Refactor Code

**Trigger**: Technical debt identified or cleanup needed

**Input**:
```
REFACTOR_TASK: What needs refactoring
CODE_TO_REFACTOR: Target code files
REFACTORING_GOAL: Desired outcome
```

**Output**:
```diff
--- app/services/payment.py (original)
+++ app/services/payment.py (refactored)
@@ -20,15 +20,10 @@
-def process_payment(user_id, amount, card_number, exp_date, cvv):
-    # Old monolithic function
-    ...
-
-def validate_card(card):
-    ...
-
-def create_transaction(user_id, amount):
-    ...
-
+class PaymentProcessor:
+    def __init__(self, user):
+        self.user = user
+
+    def process(self, amount, payment_method):
+        """Process payment using validated payment method"""
+        self._validate_payment_method(payment_method)
+        transaction = self._create_transaction(amount)
+        return self._execute_payment(transaction)
```

Plus:
- All existing tests still pass
- New tests if behavior was ambiguous
- REFACTORING_NOTES.md documenting change

**Validation Criteria**:
- External behavior unchanged
- Code is more maintainable
- All tests pass
- No new functionality added
- Rationale documented

**Next State**: RELIABILITY_VALIDATION

---

### CONTRACT C-4: Optimize Performance

**Trigger**: Performance bottleneck identified

**Input**:
```
PERFORMANCE_ISSUE: Slow operation, location, impact
METRICS: Current performance data
TARGET: Desired performance metrics
```

**Output**:
```python
# Optimization: Caching layer
# Location: app/services/data.py
# Before: O(n) database query
@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    return user

# After: O(1) cache
@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session):
    # Try cache first
    cached = cache.get(f"user:{user_id}")
    if cached:
        return cached
    # Cache miss - query DB and populate cache
    user = db.query(User).filter(User.id == user_id).first()
    cache.set(f"user:{user_id}", user, ttl=300)
    return user
```

Plus:
- `tests/performance/test_user_lookup.py`: Performance test
- OPTIMIZATION_NOTES.md: Before/after metrics

**Validation Criteria**:
- Target metrics met (or significant improvement)
- Code remains readable and maintainable
- No functionality regression
- Performance test added
- Metrics documented

**Next State**: RELIABILITY_VALIDATION

---

## RELIABILITY AGENT CONTRACTS

### CONTRACT R-1: Validate Code Quality

**Trigger**: Code changes ready for validation

**Input**:
- New/modified source files
- Test files
- Configuration changes

**Output**:
```yaml
VALIDATION_REPORT.md
status: "PASS" | "FAIL" | "WARN"
code_quality:
  linting: "PASS" (0 errors, 3 warnings)
  type_checking: "PASS"
  code_duplication: "PASS" (< 5%)
  cyclomatic_complexity: "PASS" (< 15 per function)
testing:
  unit_tests: "PASS" (15/15 passing, 92% coverage)
  integration_tests: "PASS" (8/8 passing)
  e2e_tests: "PASS" (5/5 passing)
  flaky_tests: "NONE"
security:
  vulnerabilities: "NONE"
  secrets_detected: "NONE"
  sql_injection: "NONE"
dependencies:
  outdated: "2 (minor updates available)"
  vulnerable: "NONE"

recommendations:
  - Consider caching user lookups (see OPTIMIZATION_NOTES.md)
  - Update dependency: requests==2.28.1 → 2.31.0
```

**Validation Criteria**:
- All quality checks performed
- Clear pass/fail status
- Specific issues identified
- Actionable recommendations

**Next State**:
- PASS → READY_FOR_DEPLOY
- FAIL → RETURN_TO_CODE
- WARN → MAY_PROCEED_WITH_ACK

---

### CONTRACT R-2: Performance Assessment

**Trigger**: Changes potentially affecting performance

**Input**:
- Modified code
- Load test data

**Output**:
```yaml
PERFORMANCE_REPORT.md
operation: "User profile lookup"
baseline:
  mean_ms: 245
  p95_ms: 890
  p99_ms: 1200
after_change:
  mean_ms: 45  # 82% improvement
  p95_ms: 78
  p99_ms: 120
conclusion: "IMPROVEMENT — significant performance gain"
impact: "Positive — improves user experience"
recommendation: "DEPLOY"
```

**Validation Criteria**:
- Baseline metrics provided
- After-change metrics measured
- Comparison calculated
- Clear recommendation

**Next State**: PROCEED_WITH_DEPLOY or OPTIMIZE_FURTHER

---

### CONTRACT R-3: Security Review

**Trigger**: Code changes, especially security-sensitive areas

**Input**:
- Code changes
- Areas modified (auth, payments, data handling)

**Output**:
```yaml
SECURITY_REVIEW.md
scope: ["authentication", "password handling", "session management"]
findings:
  - severity: "INFO"
    issue: "Password strength requirements documented in comments"
    recommendation: "Enforce via validation library"
  - severity: "PASS"
    check: "No hardcoded secrets"
    result: "CONFIRMED - no secrets in code"
  - severity: "PASS"
    check: "SQL injection protection"
    result: "CONFIRMED - using parameterized queries"
  - severity: "PASS"
    check: "XSS protection"
    result: "CONFIRMED - input sanitization present"

overall: "APPROVE_FOR_STAGING"
production_gate: "Requires additional review before production deploy"
```

**Validation Criteria**:
- Security areas reviewed
- Findings classified by severity
- Approvals/warnings clear
- Production requirements specified

**Next State**: STAGING_DEPLOY or FIX_ISSUES

---

### CONTRACT R-4: Incident Analysis

**Trigger**: Error, failure, or anomaly detected

**Input**:
- Error logs or stack traces
- Context (what was happening)
- Metrics data

**Output**:
```yaml INCIDENT_REPORT.md
incident_id: "INC-001"
severity: "MEDIUM"
summary: "Database connection timeout during peak load"
timeline:
  - "14:23:15 UTC": API calls start returning 503 errors"
  - "14:23:20 UTC": Monitoring alert triggered"
  - "14:25:00 UTC": Automated recovery: connection pool reset"
  - "14:25:30 UTC": System recovered"

root_cause: "Connection pool exhausted, max_connections too low"
resolution: "Increased max_connections from 10 to 50 immediate"
affected_users: "Estimated 23 users experienced errors"
impact: "5-minute outage degraded login experience"
immediate_actions:
  - Increased connection pool size
  - Added connection pool timeout alert

long_term_preventions:
  - Implement auto-scaling for connection pool
  - Add circuit breaker for DB calls
  - Improve queueing for DB operations
status: "RESOLVED"
```

**Validation Criteria**:
- Incident clearly described
- Root cause identified
- Actions documented
- Preventive measures specified
- Resolution confirmed

**Next State**: UPDATE_RUNBOOKS, CONTINUE_OPERATIONS

---

## KNOWLEDGE AGENT CONTRACTS

### CONTRACT K-1: Capture Decision

**Trigger**: Any agent makes a decision

**Input**:
- Decision what was made
- Rationale
- Alternatives considered
- Context

**Output**:
```markdown
# Decision: Technology Choice - Database

**Date**: 2024-01-15
**Made By**: Code Agent (on behalf of Product Agent)
**Decision**: Use PostgreSQL for primary database

## Context
Building MVP for SaaS platform, need to store user data, transactions, and relationships.

## Options Considered
1. **PostgreSQL** ✓ (CHOSEN)
   - Pros: Relational, ACID compliance, JSON support, mature ecosystem
   - Cons: Requires infrastructure, scaling complexity
   - Cost: Free (self-hosted) or $15+/month (managed)

2. **MongoDB**
   - Pros: Schema flexibility, horizontal scaling
   - Cons: Less transactional, eventual consistency
   - Cost: Free tier available

3. **SQLite**
   - Pros: Simple, zero-config
   - Cons: Single-file, not scalable
   - Cost: Free

## Rationale
PostgreSQL chosen because:
- Data has clear relationships (users → accounts → transactions)
- Need transactional consistency for payments
- JSON support gives flexibility for future changes
- Can start with lightweight hosting, scale later
- Industry-standard, well-supported

## Impact
- Infrastructure: Need PostgreSQL instance
- Code: Use SQLAlchemy ORM
- Migration: Schema migrations via Alembic

## Links to Code
- `DATABASE_URL` in `.env.example`
- `models.py` uses SQLAlchemy types

## Reversibility
Medium risk - migration to different DB would require schema changes
```

**Validation Criteria**:
- Decision clearly stated
- Options enumerated
- Rationale explains "why"
- Impact documented
- Reversibility assessed
- Linked to actual code

**Next State**: DECISION_CAPTURED, SYSTEM_MEMORY_UPDATED

---

### CONTRACT K-2: Document Pattern

**Trigger**: Reusable code pattern discovered or established

**Input**:
- Pattern location in codebase
- How it works
- When to use it

**Output**:
```markdown
# Pattern: Repository Layer

## Description
Isolates database access logic from business logic.

## Location
`app/db/repositories/` directory

## Structure
```python
class UserRepository(BaseRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def create(self, data: dict) -> User:
        user = User(**data)
        self.db.add(user)
        self.db.commit()
        return user
```

## Usage
```python
# In service layer
def process_withdrawal(user_id: int, amount: float):
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    # Process withdrawal...
    user_repo.update(user_id, {"balance": new_balance})
```

## Benefits
- Separation of concerns
- Easier testing (mock repositories)
- Reusable across services
- Clear location for DB queries

## Anti-Patterns AVOID
- Writing raw SQL in route handlers
- Mixing DB queries with business logic
- Not using transactions appropriately

## Examples in Codebase
- `app/db/repositories/user.py`
- `app/db/repositories/account.py`
- `app/db/repositories/transaction.py`
```

**Validation Criteria**:
- Pattern clearly described
- Usage example provided
- Benefits explained
- Anti-patterns identified
- Code references included

**Next State**: PATTERN_REGISTERED

---

### CONTRACT K-3: Update Runbook

**Trigger**: New operation, infrastructure change, or incident

**Input**:
- What changed or what operation exists
- How to perform it
- What to watch for

**Output**:
```markdown
# Runbook: User Login Troubleshooting

## Purpose
Diagnose and resolve user login issues.

## Symptoms
- User cannot log in
- "Invalid credentials" error
- Login timeout
- Session not persisting

## Diagnosis Steps

### 1. Check User Exists
```bash
# Query database
SELECT * FROM users WHERE email = 'user@example.com';
```
Expected: User record found

### 2. Check Password Hash
```python
# Test password verification
from app.auth import verify_password
verify_password("plaintext_password", stored_hash)
```
Expected: Returns True

### 3. Check Session
```bash
# Check session cookie
# In browser dev tools, view application cookies
```
Expected: Session token present

### 4. Check Logs
```bash
tail -f logs/app.log | grep -i "login\|auth"
```
Expected: No error messages

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "User not found" | Email incorrect | User must register |
| "Invalid credentials" | Wrong password | Reset password via forgot password |
| Login timeout | Database slow | Check DB performance, increase timeout |
| Session lost | CSRF token invalid | Clear cache, re-login |

## Escalation
If issue persists after 15 min:
1. Check if DB is healthy: `RUNBOOK/database_health.md`
2. Check auth service status
3. Alert Engineering: [create ticket]

## Related
- `RUNBOOK/database_backup.md`
- `RUNBOOK/reset_user_password.md`
```

**Validation Criteria**:
- Clear purpose
- Step-by-step diagnosis
- Common issues documented
- Escalation path defined
- Related runbooks referenced

**Next State**: RUNBOOK_UPDATED

---

## ADVISOR AGENT CONTRACTS

### CONTRACT A-1: Code Review (Advisory)

**Trigger**: Code Agent requests review

**Input**:
- Code to review
- Context (what it does)

**Output**:
```
ADVISORY REVIEW — User Authentication Module

Overall Assessment: SOLID, minor suggestions

Observations:
1. Password Hashing
   ✓ Using bcrypt (good, industry standard)
   ✓ Salt handled correctly

2. Session Management
   ✓ Token-based sessions (stateless, good)
   ✓ Expiration set (24h, reasonable)

3. Error Handling
   ✓ Graceful errors returned
   ⚠ Suggestion: Log authentication failures for security monitoring

4. Security
   ✓ No credentials in logs
   ✓ Rate limiting present
   ⚠ Suggestion: Consider account lockout after N failed attempts

Suggestions (not executed):
- Add logging for failed auth attempts (security monitoring)
- Consider adding account lockout after 5 failed attempts
- Document the token structure in README

Patterns Observed:
- Clean separation of auth logic
- Following REST conventions
- Good error messages

Questions for consideration:
- Should we support password strength requirements?
- Should we support multi-factor authentication?
- Should we support social logins (Google, GitHub)?

Note: These are advisory recommendations only.
Implementation requires explicit request to Code Agent.
```

**Validation Criteria**:
- No code modifications made
- Clear assessment provided
- Specific suggestions articulated
- Options explored
- One-writer rule explicitly acknowledged

**Next State**: ADVISORY_PROVIDED

---

### CONTRACT A-2: Architecture Recommendation

**Trigger**: System architecture question

**Input**:
- Architecture scenario
- Constraints and requirements

**Output**:
```
ARCHITECTURE ADVISORY — File Upload Storage

Scenario: User avatar uploads, expected 1000 users, avg 1 image/user

Approaches Considered:

1. Direct Storage to Application Server
   Cost: Free (existing storage)
   Pros: Simple to implement
   Cons: Doesn't scale, backups separate, server I/O load
   Recommendation: Good for MVP phase, but won't scale

2. Amazon S3
   Cost: ~$0.023/GB/month (negligible for 1000 users ~5GB)
   Pros: Scalable to billions, built-in redundancy, CDN integration
   Cons: External dependency, API complexity
   Recommendation: BEST CHOICE — scalable, affordable, industry standard

3. CloudFront + S3
   Cost: S3 + $0.085/GB transfer (still negligible)
   Pros: Fastest delivery globally, automatic scaling
   Cons: Additional complexity
   Recommendation: Overkill for <10k users

4. Firebase Storage
   Cost: $5GB free, then $0.026/GB
   Pros: Easy integration, free tier generous
   Cons: Vendor lock-in, less flexible than S3
   Recommendation: Good alternative if already using Firebase

Recommendation:
START WITH: Option 1 (local storage) for MVP
MIGRATE TO: Option 2 (S3) when hitting 500 users

Migration Path:
- Add S3 client library
- Deploy dual-write (local + S3)
- Update reads to prefer S3, fallback to local
- Complete migration, remove local storage
```

**Validation Criteria**:
- Multiple options analyzed
- Cost implications considered
- Scalability assessed
- Clear recommendation provided
- Migration path included

**Next State**: ADVISORY_PROVIDED

---

## CONTRACT VALIDATION

Every contract output must pass validation before state transition:

1. **Completeness Check**: All required fields present
2. **Format Check**: Output in correct format (YAML, markdown, etc.)
3. **Quality Check**: Content meets minimum standards
4. **Consistency Check**: Consistent with other contracts
5. **Safety Check**: Does not violate guardrails

---

## VERSION HISTORY

- v1.0 (Initial): All contracts defined for all agents and all task types
