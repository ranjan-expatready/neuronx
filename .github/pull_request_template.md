## What

[Brief description of the changes made in this PR]

## Why

[Explanation of why these changes are needed. Include context and business justification]

## How

[Detailed description of the implementation approach]

## How Verified

- [ ] Unit tests added/updated and passing
- [ ] Integration tests added/updated and passing (if applicable)
- [ ] Manual testing completed
- [ ] Code review completed
- [ ] Automated checks passing (linting, security scans)

## Spec Compliance (Required for Multi-File/Security/Architecture Changes)

- [ ] Spec artifact saved to `.factory/docs/` and referenced below
- [ ] Spec: .factory/docs/YYYY-MM-DD-descriptive-slug.md
- [ ] Spec N/A (only if single-file, low-risk, docs-only change): [REASON]

## Risks

[List any potential risks, breaking changes, or areas that need special attention]

## Rollback Plan

[Describe how to rollback these changes if needed]

## SSOT Compliance (docs/SSOT/\* - Single Source of Truth)

**Source**: docs/SSOT/02_GOVERNANCE.md lines 29-44, docs/SSOT/11_GITHUB_GOVERNANCE.md

### Traceability & Requirements

- [ ] Row added to `docs/TRACEABILITY.md` with acceptance criteria
- [ ] Acceptance criteria mapped to test coverage plan
- [ ] Requirements traceability verified (references docs/SSOT/01_MISSION.md)

### Testing Requirements

- [ ] Unit tests for all business logic (>85% coverage) per docs/SSOT/04_TEST_STRATEGY.md
- [ ] Contract tests for all external boundaries per docs/SSOT/04_TEST_STRATEGY.md
- [ ] E2E test if it's a critical user flow per docs/SSOT/04_TEST_STRATEGY.md
- [ ] All tests passing in CI/CD pipeline per docs/SSOT/03_QUALITY_BAR.md

### Documentation & Architecture

- [ ] `PRODUCT_LOG.md` updated for user-visible changes per docs/SSOT/02_GOVERNANCE.md
- [ ] `ENGINEERING_LOG.md` updated for architectural changes per docs/SSOT/02_GOVERNANCE.md
- [ ] Code follows ARCHITECTURE.md boundaries per docs/SSOT/02_GOVERNANCE.md
- [ ] ADR created for architectural decisions per docs/SSOT/02_GOVERNANCE.md

### Evidence & Memory

- [ ] Evidence artifacts created in `docs/EVIDENCE/` per docs/SSOT/09_EVIDENCE_INDEX.md
- [ ] Evidence links added to `docs/TRACEABILITY.md` per docs/SSOT/09_EVIDENCE_INDEX.md
- [ ] Session evidence captured in `docs/SSOT/10_AGENT_MEMORY.md` per docs/SSOT/10_AGENT_MEMORY.md
- [ ] STOP-SHIP ledger acknowledged per docs/SSOT/10_AGENT_MEMORY.md

## Documentation Updated

- [ ] Code comments added/updated
- [ ] README or user documentation updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] ADR created for architectural changes (if applicable)
- [ ] Changeset added (if user-facing change)

## Checklist

- [ ] Changes follow established code style guidelines
- [ ] No secrets or sensitive data committed
- [ ] Commit messages are clear and descriptive
- [ ] PR size is appropriate (see PR quality standards)
- [ ] Branch is up to date with base branch
- [ ] All required CI checks are passing
- [ ] Reviewed by at least one qualified reviewer
- [ ] Approved by code owner (if required)

## Related Issues

[Link to any related issues, e.g., Closes #123, Fixes #456]

## Screenshots/Logs

[Add screenshots or logs if applicable, especially for UI changes]

## Additional Notes

[Any additional context, implementation details, or follow-up work needed]

---

**By submitting this pull request, I confirm that:**

- [ ] My changes are ready for review and meet the Definition of Done
- [ ] I have tested these changes thoroughly
- [ ] I have updated all relevant documentation
- [ ] I understand the rollback procedures if needed
- [ ] I am accountable for the quality and correctness of these changes
