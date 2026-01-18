# GitHub Governance (SSOT)

**Source**: Extracted from docs/SSOT/02_GOVERNANCE.md, docs/SSOT/03_QUALITY_BAR.md, docs/SSOT/05_CI_CD.md, docs/SSOT/06_RELEASES_AND_TAGS.md
**Last Updated**: 2026-01-10
**Authority**: GitHub Branch Protection and CI/CD Enforcement Framework

## Branch Protection Rules for Main

### Required Status Checks (All Must Pass)

**Source**: docs/SSOT/03_QUALITY_BAR.md lines 36-47, docs/SSOT/05_CI_CD.md lines 162-166

#### Code Quality Gate

- **Quality Gate** (ci.yml): All formatting, linting, type checking, traceability, and evidence validation
- **PR Quality Checks** (pr-quality-checks.yml): Comprehensive validation including coverage and evidence system

#### Testing Gate

- **Test Coverage** (ci.yml): ≥85% line coverage enforced
- **Integration Tests** (ci.yml): Core-API Jest suite passing
- **Unit Tests** (ci.yml): Vitest suite with coverage requirements

#### Security Gate

- **Dependency Review** (dependency-review.yml): No moderate/high severity vulnerabilities
- **Secret Scanning** (secret-scan.yml): No secrets or credentials leaked
- **CodeQL Analysis** (codeql.yml): Automated security analysis passes

#### Specialized Validations

- **API Tests** (api-tests.yml): Postman collection validation
- **E2E Tests** (e2e-tests.yml): Critical user journey validation
- **Load Tests** (load-tests.yml): Performance regression checks
- **Redis Tests** (redis-tests.yml): Cache layer validation

### Review Requirements

**Source**: docs/SSOT/05_CI_CD.md lines 162-166

- **Required Reviews**: ≥1 approving review
- **Reviewers**: Must include qualified code reviewers familiar with the codebase
- **Dismiss Stale Reviews**: Automatic dismissal when new commits are pushed
- **Code Owner Reviews**: Required for changes to critical files (docs/SSOT/_, apps/_, packages/\*)
- **Conversation Resolution**: All discussions must be resolved before merge

### Merge Strategy

**Source**: docs/SSOT/06_RELEASES_AND_TAGS.md (pending)

- **Squash Merge**: Required for clean commit history
- **Linear History**: Enforced to maintain chronological commit order
- **Merge Commit Messages**: Must follow conventional commit format
- **Branch Naming**: `feature/`, `bugfix/`, `hotfix/`, `chore/` prefixes required

### Emergency Override Policy

**Source**: docs/SSOT/05_CI_CD.md lines 177-180

- **Administrator Only**: Repository admins only (engineering leadership)
- **Business Justification**: Must be documented with business impact assessment
- **Time Limited**: Maximum 24-hour bypass window
- **Post-Mortem Required**: Incident review and remediation plan within 48 hours
- **Audit Trail**: All bypasses logged in ENGINEERING_LOG.md

## CI/CD Pipeline Enforcement

### Pipeline Requirements

**Source**: docs/SSOT/05_CI_CD.md lines 146-151

- **Fast Feedback**: <3 minutes for unit + contract tests
- **Full Pipeline**: <6 minutes including E2E tests
- **Parallel Execution**: CPU cores utilized for test parallelism
- **Concurrency Control**: Automatic cancellation of redundant runs

### Quality Metrics Tracking

**Source**: docs/SSOT/03_QUALITY_BAR.md lines 141-152

- **Test Pass Rate**: >99% (excluding known flaky tests)
- **Coverage Percentage**: Trending upward, ≥85% maintained
- **Build Success Rate**: >95% for main branch
- **Time to Merge**: Average <2 days for compliant PRs

### Failure Handling

**Source**: docs/SSOT/05_CI_CD.md lines 185-194

- **Automatic Retry**: Transient failures (network timeouts, external service unavailability)
- **Failure Notification**: Slack alerts for pipeline failures
- **Rollback Procedures**: Automated rollback for failed deployments
- **Incident Response**: Escalation procedures for pipeline failures

## PR Template Enforcement

### Governance Checklist

**Source**: docs/SSOT/02_GOVERNANCE.md lines 29-44

#### Traceability Requirements

- [ ] Row added to `docs/TRACEABILITY.md` with acceptance criteria
- [ ] Acceptance criteria mapped to test coverage plan
- [ ] Requirements traceability verified before development begins

#### Testing Requirements

- [ ] Unit tests for all business logic (>85% coverage)
- [ ] Contract tests for all external boundaries
- [ ] E2E test if it's a critical user flow
- [ ] All tests passing in CI/CD pipeline

#### Documentation Requirements

- [ ] `PRODUCT_LOG.md` updated for user-visible changes
- [ ] `ENGINEERING_LOG.md` updated for architectural changes
- [ ] ADR created for architectural decisions

#### Code Quality Requirements

- [ ] Code follows ARCHITECTURE.md boundaries
- [ ] No architectural violations detected
- [ ] PR approved with governance checklist complete

### SSOT References Required

**Source**: docs/SSOT/02_GOVERNANCE.md lines 9-22

- [ ] `docs/SSOT/01_MISSION.md` - Scope validation
- [ ] `docs/SSOT/02_GOVERNANCE.md` - Architectural boundaries
- [ ] `docs/SSOT/03_QUALITY_BAR.md` - Quality requirements
- [ ] `docs/SSOT/04_TEST_STRATEGY.md` - Testing pyramid
- [ ] `docs/SSOT/10_AGENT_MEMORY.md` - Session state updates

## Evidence System Integration

### Evidence Requirements

**Source**: docs/SSOT/09_EVIDENCE_INDEX.md (pending)

- [ ] Evidence artifacts created in `docs/EVIDENCE/` with proper categorization
- [ ] Evidence links added to `docs/TRACEABILITY.md`
- [ ] Session evidence captured in `docs/SSOT/10_AGENT_MEMORY.md`
- [ ] Before/after metrics documented for all changes

### Validation Automation

**Source**: docs/SSOT/05_CI_CD.md lines 46-67

- **Traceability Validation**: `scripts/validate-traceability.ts`
- **Evidence Validation**: `scripts/validate-evidence.ts`
- **Agent Memory Validation**: `scripts/validate-agent-memory.ts`
- **Coverage Validation**: 85% threshold enforcement

## Security Enforcement

### Automated Security Checks

**Source**: docs/SSOT/03_QUALITY_BAR.md lines 49-53

- **Dependency Scanning**: Automated vulnerability detection
- **Secret Detection**: Pre-commit and CI scanning for hardcoded secrets
- **CodeQL Analysis**: Static application security testing
- **Input Validation**: Automated checks for security vulnerabilities

### Access Control

**Source**: docs/SSOT/05_CI_CD.md lines 167-171

- **Branch Protection**: Enforced for all protected branches
- **Admin Enforcement**: Rules apply to repository administrators
- **Emergency Bypass**: Documented process with leadership approval
- **Audit Logging**: All bypasses tracked and reviewed

## Continuous Improvement

### Governance Metrics

**Source**: docs/SSOT/03_QUALITY_BAR.md lines 190-196

- **Defect Detection**: % of defects caught by automated tests
- **Time to Feedback**: Average time from commit to quality results
- **Quality Confidence**: Team confidence in release quality
- **Customer Impact**: Production defect rates and severity

### Process Refinement

**Source**: docs/SSOT/05_CI_CD.md lines 197-210

- **Monthly Reviews**: Quality metrics and process effectiveness
- **Tool Updates**: Test frameworks and CI/CD improvements
- **Training**: Team skill development for quality practices
- **Automation**: Additional automated quality checks

## Implementation Status

### Completed

- [x] SSOT documentation created (this file)
- [x] CI/CD workflows verified and stable
- [x] PR template with governance checklist
- [x] Branch protection evidence documented
- [x] Failure mode documentation prepared

### Next Steps

- [ ] Configure GitHub branch protection UI settings
- [ ] Test emergency bypass procedures
- [ ] Implement governance metrics dashboard
- [ ] Add automated governance reminders

---

**This SSOT document serves as the canonical source for all GitHub governance rules. Changes must be made here first, then reflected in GitHub UI and CI/CD configurations.**
