# Definition of Done

## Overview

This document defines the criteria that must be met for work items (features, bugfixes, refactorings, etc.) to be considered complete within the Autonomous Engineering OS.

No work is considered "done" until ALL criteria for its category are satisfied.

---

## DEFINITION OF DONE (By Item Type)

### DoD-1: Feature Development

**Status**: `IN_PROGRESS` → `DONE` when:

**Code Quality**
- ✅ Code compiles and runs without errors
- ✅ Linting passes with no new violations
- ✅ Type checking passes (if applicable)
- ✅ Code follows existing patterns in codebase
- ✅ No hardcoded values (use environment variables or config)
- ✅ Proper error handling implemented

**Testing**
- ✅ Unit tests written for new logic (>80% coverage minimum)
- ✅ Integration tests for API boundaries
- ✅ All tests pass in local environment
- ✅ Edge cases tested and handled
- ✅ Tests are deterministic (no flaky tests)

**Documentation**
- ✅ Product requirements documented in PRODUCT/
- ✅ In-code comments for complex logic
- ✅ API documentation updated (if endpoints affected)
- ✅ User-facing documentation updated (if applicable)
- ✅ ARCHITECTURE/ updated for significant changes

**Deployment Readiness**
- ✅ Migration scripts written (if database changes)
- ✅ Rollback plan documented
- ✅ No breaking changes without migration guide
- ✅ Config changes documented
- ✅ CI/CD pipeline accepts changes

**Validation**
- ✅ Feature tested in staging environment
- ✅ Manual smoke test completed
- ✅ Performance impact assessed
- ✅ Security review passed for sensitive areas

**Integration**
- ✅ No regressions in existing features
- ✅ Dependencies version-locked
- ✅ Zero secrets committed to repository

### DoD-2: Bug Fix

**Status**: `IN_PROGRESS` → `DONE` when:

**Root Cause**
- ✅ Root cause identified and documented
- ✅ Reproduction steps documented
- ✅ Preventive measures documented

**Code Quality**
- ✅ Fix addresses root cause, not symptoms
- ✅ Minimal code change (principle of least change)
- ✅ Linting and type checking pass
- ✅ Existing patterns followed

**Testing**
- ✅ Test case added that reproduces bug
- ✅ Test verifies fix works
- ✅ All existing tests still pass
- ✅ Edge cases around fix tested

**Documentation**
- ✅ Bug documented in BACKLOG/ with resolution
- ✅ Related code comments updated
- ✅ If user-facing, release notes prepared
- ✅ Impact to existing users documented

**Validation**
- ✅ Fix tested in staging
- ✅ No new issues introduced
- ✅ Related issues searched and addressed

### DoD-3: Refactoring

**Status**: `IN_PROGRESS` → `DONE` when:

**Code Quality**
- ✅ External behavior unchanged
- ✅ API contracts maintained
- ✅ Code structure improved
- ✅ Duplication reduced
- ✅ Performance maintained or improved

**Testing**
- ✅ All existing tests pass
- ✅ No functionality changed (verified by tests)
- ✅ New tests added if behavior ambiguity

**Documentation**
- ✅ Refactoring rationale documented
- ✅ ARCHITECTURE/ updated for structural changes
- ✅ Migration notes if API surfaces changed
- ✅ Deprecation notices if applicable

**Validation**
- ✅ Manual verification of unchanged behavior
- ✅ No regressions in production

### DoD-4: Performance Optimization

**Status**: `IN_PROGRESS` → `DONE` when:

**Measurements**
- ✅ Baseline performance documented
- ✅ New performance measured and compared
- ✅ Target metrics met (>30% improvement minimum)

**Code Quality**
- ✅ Optimization is maintainable
- ✅ No premature optimization
- ✅ Code readability maintained

**Testing**
- ✅ All existing tests pass
- ✅ Performance tests added
- ✅ Load tests pass with improvement

**Documentation**
- ✅ Before/after metrics documented
- ✅ Optimization technique documented
- ✅ Known limitations documented
- ✅ Monitoring/alerting configured

**Validation**
- ✅ Tested in staging with realistic load
- ✅ No degradation under concurrent load

### DoD-5: Security Fix

**Status**: `IN_PROGRESS` → `DONE` when:

**Analysis**
- ✅ Vulnerability type documented
- ✅ Attack vector identified
- ✅ Impact assessment completed
- ✅ CVSS score documented (if applicable)

**Fix Quality**
- ✅ Fix addresses vulnerability completely
- ✅ Defense in depth applied where possible
- ✅ No new attack surfaces introduced
- ✅ Logging added for detection

**Testing**
- ✅ Exploit test case added
- ✅ Vulnerability no longer exploitable
- ✅ Security scan passes
- ✅ Penetration testing approved (if critical)

**Documentation**
- ✅ Security advisory prepared
- ✅ Patch release notes documented
- ✅ Upgrade instructions provided
- ✅ CVE details referenced (if applicable)

**Validation**
- ✅ Independent security review (if high severity)
- ✅ Staging deployment verified
- ✅ Monitoring/alerting configured

### DoD-6: Infrastructure/DevOps

**Status**: `IN_PROGRESS` → `DONE` when:

**Code Quality**
- ✅ Infrastructure as code follows patterns
- ✅ No secrets in code/config
- ✅ Git ignored files properly excluded
- ✅ Idempotent (safe to re-run)

**Testing**
- ✅ Infrastructure tested in staging
- ✅ Rollback procedure tested
- ✅ Scaling behavior tested
- ✅ Failover tested (if applicable)

**Documentation**
- ✅ Infrastructure diagram updated
- ✅ Runbook created or updated
- ✅ Dependencies documented
- ✅ On-call procedures updated

**Validation**
- ✅ Production-like environment validated
- ✅ Monitoring/alerting verified
- ✅ Backup/restore tested

### DoD-7: Documentation

**Status**: `IN_PROGRESS` → `DONE` when:

**Quality**
- ✅ Content is accurate and current
- ✅ Clear and concise language
- ✅ Examples included where helpful
- ✅ Diagrams are clear and correct

**Validation**
- ✅ All code examples tested
- ✅ Links are valid and working
- ✅ Spelling and grammar checked

**Organization**
- ✅ Located in appropriate directory
- ✅ Cross-references work
- ✅ Version information included
- ✅ Last updated timestamp added

---

## SHARED CRITERIA (Applies to All Item Types)

### Quality Gates

**Code Quality**
- ✅ No console.log or debug statements
- ✅ No commented-out code blocks
- ✅ No TODO/FIXME without associated ticket
- ✅ No commented out tests
- ✅ Line lengths within reasonable limits

**Repository Hygiene**
- ✅ Git commit message follows format
- ✅ No merge commits (prefer rebase)
- ✅ Branches deleted after merge
- ✅ No accidental file uploads

**Environment**
- ✅ Works across supported environments
- ✅ Environment variables documented
- ✅ No hardcoded environment-specific values

### Sign-off Criteria

Before marking any item as DONE, the system must:

1. **Self-Review**: Run internal checklist against DoD
2. **Automated Checks**: CI/CD pipeline passes
3. **Documentation Check**: Required docs present
4. **Risk Assessment**: No unaddressed risks
5. **Cost Validation**: Within expected budget

---

## DEFINITION OF READY (Before Starting Work)

To prevent waste, these criteria must be met BEFORE work begins:

**For Features**
- ✅ User story written and understood
- ✅ Acceptance criteria defined
- ✅ Technical feasibility confirmed
- ✅ Dependencies identified
- ✅ Risk tier assigned
- ✅ Estimates provided

**For Bugs**
- ✅ Bug reproducible
- ✅ Impact assessed
- ✅ Root cause suspected
- ✅ Fix approach identified

**For Refactoring**
- ✅ Technical debt documented
- ✅ Approach justified
- ✅ Tests exist or will be added
- ✅ No conflicting priorities

---

## WORKFLOW STATES

```
BACKLOG → READY → IN_PROGRESS → IN_REVIEW → DONE → ARCHIVED
              ↓         ↓          ↓
            BLOCKED  WAITING_FOR_REBASE  FAILED_TESTS
```

**State Transitions:**
- `BACKLOG` → `READY`: Definition of Ready met
- `READY` → `IN_PROGRESS`: Work started, estimated cost
- `IN_PROGRESS` → `IN_REVIEW`: DoD checklist complete, ready for validation
- `IN_REVIEW` → `DONE`: All checks pass, approved
- `IN_REVIEW` → `FAILED_TESTS`: CI/CD failed, fix required
- `IN_PROGRESS` → `BLOCKED`: Unresolved blocker
- `DONE` → `ARCHIVED`: After successful deployment (or time threshold)

---

## VIOLATION HANDLING

If DoD is not met but item is marked DONE:

1. Identify missing criterion
2. Block deployment
3. Alert human with gap
4. Complete missing work
5. Re-validate before proceeding

---

## VERSION HISTORY

- v1.0 (Initial): DoD for all item types, Definition of Ready, workflow states
