# Contributing to NeuronX

Welcome! This guide helps you contribute effectively to NeuronX while maintaining our FAANG-grade quality standards.

## Quick Start

### Local Development Setup

1. **Prerequisites**
   ```bash
   # Required versions
   node >=22 <23
   pnpm >=9.0.0
   ```

2. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd neuronx
   pnpm install --frozen-lockfile
   ```

3. **Environment Configuration**
   ```bash
   cp env-example.txt .env
   # Edit .env with required values
   ```

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Run Quality Checks Locally**
   ```bash
   # Format code
   pnpm run format

   # Lint code
   pnpm run lint

   # Type check
   pnpm run typecheck

   # Run tests
   pnpm run test:unit      # Unit tests with Vitest
   pnpm run test:integration  # Integration tests with Jest
   pnpm run test:e2e       # End-to-end tests with Playwright

   # Validate governance requirements
   pnpm run validate:traceability
   pnpm run validate:evidence
   ```

## Testing Requirements

### Test Pyramid Structure

NeuronX follows a strict testing pyramid with specific coverage targets:

- **Unit Tests (70%)**: `pnpm run test:unit`
  - Business logic, algorithms, state machines
  - >85% code coverage required
  - Located in `tests/unit/` and `packages/**/__tests__/`

- **Integration Tests (20%)**: `pnpm run test:integration`
  - External API boundaries and adapter contracts
  - Located in `tests/contract/` and `apps/core-api/test/`

- **E2E Tests (10%)**: `pnpm run test:e2e`
  - Critical user journeys only
  - Located in `tests/e2e/` and `cypress/`

### Before You Commit

```bash
# Run complete test suite
pnpm run test:all

# Verify coverage meets 85% threshold
pnpm run test:coverage

# Validate all governance requirements
pnpm run ci
```

## Governance Requirements

### Definition of Done

All contributions must satisfy our [Definition of Done](docs/SSOT/03_QUALITY_BAR.md) checklist:

- [ ] Row added to `docs/TRACEABILITY.md` with acceptance criteria
- [ ] Unit tests implemented with >85% coverage
- [ ] Integration tests for external boundaries
- [ ] E2E tests for critical user flows (if applicable)
- [ ] Documentation updated (`PRODUCT_LOG.md` or `ENGINEERING_LOG.md`)
- [ ] ADR created for architectural decisions
- [ ] Evidence artifacts created in `docs/EVIDENCE/`

### Pull Request Process

1. **Use PR Template**: All PRs must use `.github/pull_request_template.md`

2. **Complete Governance Checklist**: Every checkbox in the PR template must be completed

3. **Required Reviews**:
   - ≥1 approving code review
   - Code owner approval for critical files
   - Security review for auth/security changes

4. **Branch Protection**: All CI quality gates must pass:
   - Code formatting and linting
   - TypeScript type checking
   - Test coverage (≥85%)
   - Security scanning
   - Traceability validation

### Architectural Decisions

**When to Create an ADR**: Any architectural or significant technical decision that:
- Changes system boundaries or module responsibilities
- Modifies technology stack
- Impacts security or performance architecture

**ADR Process**:
1. Draft ADR following template in `docs/DECISIONS/`
2. Technical review by qualified reviewers
3. Approval and merge to establish precedent
4. Implementation follows ADR specifications

See [docs/SSOT/02_GOVERNANCE.md](docs/SSOT/02_GOVERNANCE.md) lines 133-146 for complete ADR process.

## Proposing Governance Changes

### Process for Changing Rules

1. **SSOT-First**: Update the relevant SSOT document first
2. **Evidence Required**: Provide evidence justifying the change
3. **Review Required**: Governance changes require FAANG-grade approval
4. **Implementation**: Reflect changes in CI/CD and tooling after SSOT approval

### Who Can Propose Changes

- **Technical Leadership**: Tech leads and architects for technical governance
- **Engineering Managers**: For process and quality bar changes
- **Security Team**: For security policy modifications
- **Product Team**: For requirements and scope changes

## Code Standards

### Formatting & Style

```bash
# Check formatting
pnpm run format:check

# Auto-fix formatting
pnpm run format
```

### Linting

```bash
# Check linting
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix
```

### TypeScript

- Strict type checking enforced
- No `any` types without documented justification
- Interface contracts must be maintained

## Security Requirements

### Automated Checks

- **Secret Scanning**: No hardcoded secrets or credentials
- **Dependency Review**: No moderate/high severity vulnerabilities
- **CodeQL Analysis**: Static application security testing
- **Input Validation**: All external inputs must be validated

### Manual Reviews

Security-sensitive changes require additional review:
- Authentication and authorization logic
- Data encryption and privacy handling
- External API integrations
- Database schema modifications

## Documentation Updates

### When to Update Documentation

- **User-Visible Changes**: Update `PRODUCT_LOG.md`
- **Technical Changes**: Update `ENGINEERING_LOG.md`
- **API Changes**: Update API documentation
- **New Features**: Add to `docs/TRACEABILITY.md`

### Evidence Requirements

All changes must include evidence artifacts in `docs/EVIDENCE/`:
- Before/after screenshots for UI changes
- Performance benchmarks for optimizations
- Test results and coverage reports
- Integration verification proofs

## Getting Help

### Resources

- **[AGENTS.md](AGENTS.md)**: Canonical agent operating rules
- **[docs/SSOT/index.md](docs/SSOT/index.md)**: Complete documentation index
- **[docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)**: Detailed testing guidance
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: System architecture and boundaries

### Communication

- **Issues**: Use GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for questions and proposals
- **PR Reviews**: Address all reviewer feedback before merge

## Recognition

Contributors who consistently follow these guidelines and maintain high-quality standards will be recognized through:
- Code review acknowledgments
- Contribution highlights in release notes
- Invitations to participate in architecture decisions

Thank you for contributing to NeuronX! Your adherence to these standards ensures we maintain FAANG-grade quality while delivering exceptional AI-driven sales orchestration capabilities.