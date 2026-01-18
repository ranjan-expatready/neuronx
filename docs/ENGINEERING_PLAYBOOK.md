# NeuronX Engineering Playbook

## Overview

This playbook is the single entry point for understanding how the Sales OS engineering organization operates. It serves as a living document that evolves with our practices and technologies.

## Table of Contents

- [Single Source of Truth](#single-source-of-truth)
- [Operating Principles](#operating-principles)
- [Repository Structure](#repository-structure)
- [Development Workflow](#development-workflow)
- [Code Quality Standards](#code-quality-standards)
- [Testing Strategy](#testing-strategy)
- [Security Practices](#security-practices)
- [Documentation System](#documentation-system)
- [Decision Making](#decision-making)
- [CI/CD Pipeline](#cicd-pipeline)
- [Release Management](#release-management)
- [Branch Protection Policy](#branch-protection-policy)
- [Memory and Context](#memory-and-context)

## Single Source of Truth

### Documentation Hierarchy

Repository artifacts serve as the definitive source of truth. No external documentation or verbal agreements override these canonical sources:

1. **`docs/REQUIREMENTS.md`** - **CANONICAL**: Product requirements, scope boundaries, user personas
2. **`docs/ARCHITECTURE.md`** - **CANONICAL**: System architecture, module boundaries, data flow
3. **`docs/DECISIONS/`** - **CANONICAL**: Architecture decisions with context and rationale
4. **`docs/TRACEABILITY.md`** - **CANONICAL**: Feature-to-test verification matrix
5. **`docs/PRODUCT_LOG.md`** - **CANONICAL**: User-visible changes and milestones
6. **`docs/ENGINEERING_LOG.md`** - **CANONICAL**: Technical changes and architectural rationale

### Reference Documentation

These provide supporting context but are not canonical:

- **`docs/source/playbook.pdf`** - **REFERENCE**: Supporting evidence, not definitive specification
- **`docs/ENGINEERING_PLAYBOOK.md`** - **REFERENCE**: Process documentation, not product specification
- **External Links** - **REFERENCE**: Industry standards, API documentation, research papers

### Governance Enforcement

- All product decisions must be traceable to `REQUIREMENTS.md`
- All architectural decisions must be recorded as ADRs
- All features must have traceability rows before development begins
- No code changes without corresponding documentation updates
- PR template enforces compliance checks

### Drift Prevention

- Regular audits ensure documentation matches implementation
- Automated rules prevent architectural violations
- Single source of truth eliminates conflicting interpretations
- All team members reference canonical documents for decisions

## Operating Principles

### Core Philosophy

- **Quality over Speed**: Governance and documentation come before rapid development
- **Audit-Ready**: Repository must be suitable for external audits at any time
- **Scalable Foundation**: Architecture designed to support 1000x growth
- **Team-First**: Practices optimized for collaborative development

### Development Loop

All work follows: **PLAN → IMPLEMENT → VERIFY → DOCUMENT**

## Repository Structure

```
Sales OS/
├── .cursor/rules/          # AI governance rules
├── .github/               # GitHub configuration
├── docs/                  # Documentation
│   ├── DECISIONS/        # Architecture Decision Records
│   ├── PROJECT_CHARTER.md
│   └── ENGINEERING_PLAYBOOK.md
├── memory/               # Persistent context and knowledge
├── src/                  # Application source code (future)
├── tests/                # Test suites (future)
├── .gitignore
└── README.md
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical bug fixes

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes following PLAN → IMPLEMENT → VERIFY → DOCUMENT
3. Create PR with complete description
4. Automated checks pass (tests, linting, security)
5. Code review by qualified reviewer
6. Merge after approval

### Commit Standards

- Use conventional commits: `type(scope): description`
- Keep commits atomic and focused
- Reference issue numbers when applicable
- Write clear, imperative commit messages

## Code Quality Standards

### Style Guidelines

- Follow language-specific style guides
- Use consistent naming conventions
- Maintain readable code structure
- Include appropriate error handling

### Code Review Requirements

- All changes require review
- Focus on logic, security, and maintainability
- Reviewers check against established rules
- No merging of failing automated checks

## Testing Strategy

### Test Pyramid

- **Unit Tests (70%)**: Individual component testing
- **Integration Tests (20%)**: Component interaction testing
- **E2E Tests (10%)**: Full workflow testing

### Coverage Requirements

- Unit tests: 80%+ line coverage
- Integration tests: 70%+ path coverage
- Critical paths: 90%+ coverage
- New features: 100% coverage required

## Security Practices

### Development Security

- Never commit secrets or credentials
- Use secure coding practices
- Regular dependency updates
- Automated security scanning

### Access Control

- Principle of least privilege
- Regular access reviews
- Secure authentication mechanisms
- Encrypted communications

## Documentation System

### Types of Documentation

- **Code Documentation**: Inline comments and API docs
- **Architecture Docs**: System design and decisions
- **User Guides**: Feature usage and configuration
- **Operational Docs**: Deployment and maintenance

### Documentation Standards

- Keep documentation current with code
- Use consistent formatting and structure
- Include code examples where helpful
- Review documentation during PR process

## Decision Making

### Architecture Decisions

- Documented as Architecture Decision Records (ADRs)
- Follow ADR template in `docs/DECISIONS/`
- Reviewed by technical leadership
- Stored in version control

### Technical Choices

- Evaluate options against project charter
- Consider scalability, maintainability, security
- Document rationale and trade-offs
- Revisit decisions regularly

## CI/CD Pipeline

### Required CI Checks

All pull requests must pass these quality gates:

#### Code Quality

- **Formatting**: Prettier format check passes
- **Linting**: ESLint with TypeScript rules passes
- **Type Checking**: TypeScript compilation passes

#### Testing

- **Unit Tests**: Vitest test suite passes
- **Coverage**: Minimum 85% line coverage enforced
- **Test Results**: All tests deterministic and reliable

#### Security

- **Dependency Review**: No moderate/high severity vulnerabilities
- **Secret Scanning**: No secrets or credentials leaked
- **CodeQL Analysis**: Automated security analysis passes

### CI Workflow

- Runs on every PR and push to `main`
- Uses Node.js 20 LTS and pnpm package manager
- Parallel execution for fast feedback
- Coverage threshold enforced programmatically
- Concurrency control prevents redundant runs

### Deployment Strategy

- Automated deployments to staging
- Manual promotion to production
- Rollback procedures documented
- Monitoring and alerting configured

## Release Management

### Changesets Workflow

Sales OS uses [Changesets](https://github.com/changesets/changesets) for automated versioning and changelog management:

- **When to Add a Changeset**: For any user-facing change, new feature, bug fix, or breaking change
- **Changeset Types**:
  - `patch`: Bug fixes and minor improvements
  - `minor`: New features that are backward compatible
  - `major`: Breaking changes
- **Process**:
  1. Run `pnpm changeset` to create a changeset file
  2. Describe the change and select the appropriate version bump
  3. Commit the changeset file with your changes
  4. CI automatically creates/updates a "Version Packages" PR
  5. Review and merge the version PR to trigger release

### Release Cadence

- **Automated**: Every merge batch that includes changesets triggers a release
- **Version Packages PR**: Automatically created/updated when changesets are detected
- **Release Trigger**: Merging the Version Packages PR creates GitHub releases and publishes packages

### Release Process

1. **Development**: Create changesets for user-facing changes
2. **CI Detection**: Release workflow detects changesets on main branch pushes
3. **Version PR**: Automated PR created with version bumps and changelog
4. **Review & Merge**: Version PR reviewed and merged
5. **Release**: GitHub release created with changelog and artifacts published

### Commands

- `pnpm changeset`: Create a new changeset
- `pnpm version-packages`: Update versions (used in CI)
- `pnpm release`: Publish packages (used in CI)

### Governance

- All releases must include a changeset describing the change
- Version bumps are determined by changeset types (patch/minor/major)
- Releases are immutable once published
- Breaking changes require major version bumps

## Agent Model Policy

### FAANG-Grade Model Routing Guidelines

NeuronX implements deterministic model routing for Cursor + Cline agents to ensure FAANG-grade quality and performance:

#### PLAN Model (Thinking & Analysis)

**Primary**: `deepseek-v3.2` - Complex reasoning, architectural analysis, comprehensive audits
**Secondary**: `qwen3-next` - Deep technical analysis, multi-file refactoring planning
**Use Case**: Planning phases, requirement analysis, architectural decisions, complex problem solving

#### ACT Model (Implementation & Coding)

**Primary**: `gemini-3-flash-preview` - Fast, accurate code generation and editing
**Secondary**: `qwen3-coder-30b` - Heavy refactoring, large code changes, complex implementations
**Use Case**: Code writing, bug fixes, feature implementation, test generation

#### Escalation Model (Critical Changes)

**Trigger**: >10 files changed OR cross-package refactor OR high-risk changes
**Model**: `devstral-2` - Maximum safety and accuracy for critical operations
**Use Case**: Database schema changes, security-critical code, breaking API changes

#### Automation Model (Completions)

**Model**: `nemotron-3-nano` - Optimized for code completion and autocomplete
**Use Case**: Code suggestions, import completion, syntax assistance

### Model Selection Rules

- **Default to Primary**: Use primary models for standard operations
- **Escalate When**: Risk assessment indicates higher safety needed
- **Performance Priority**: Use faster models for routine tasks, accurate models for complex work
- **Quality Gates**: All models must maintain 85%+ code coverage and pass CI quality checks

### Implementation

- **Configuration**: Models configured in agent settings with automatic routing
- **Fallback**: Secondary models automatically used if primary unavailable
- **Monitoring**: Model performance tracked for continuous optimization
- **Updates**: Model routing rules updated based on performance data

## Branch Protection Policy

### Main Branch Protection

The `main` branch is protected to ensure code quality and prevent unauthorized changes:

- **Required Reviews**: At least 1 approving review required
- **Status Checks**: All CI quality gates must pass:
  - `CI / Quality Gate`: Code formatting, linting, type checking, and coverage
  - `CodeQL / Analyze`: Security code analysis
  - `Secret Scan / Secret Scan`: Secret leakage detection
- **Pull Request Required**: All changes must go through pull request review
- **Conversation Resolution**: All PR conversations must be resolved
- **Admin Enforcement**: Rules apply to administrators
- **Force Push Blocked**: No force pushes allowed
- **Deletion Blocked**: Branch deletion not permitted
- **Stale Review Dismissal**: Reviews dismissed when new commits are pushed

### Enforcement

Branch protection rules are automatically enforced via `scripts/github_enforce.sh` which configures GitHub's branch protection API. This script should be run after repository setup and whenever protection rules need updating.

### Bypass Policy

Branch protection cannot be bypassed except by repository administrators in emergency situations. All bypasses should be documented and reviewed.

## DevContext MCP

### Configuration

NeuronX uses DevContext MCP for intelligent codebase indexing and context awareness:

**Indexed Paths:**

- `docs/**`: Requirements, architecture, ADRs, specifications
- `apps/**`: Application source code and implementations
- `packages/**`: Shared libraries and utilities
- `.cursor/rules/**`: Governance rules and policies

**Excluded Paths:**

- `node_modules/**`: Dependencies
- `dist/**`, `build/**`: Build artifacts
- Log files and system files

**Configuration File:** `.cursor/devcontext.json`

### Usage

DevContext provides contextual awareness for:

- Architecture decisions and rationale
- Code patterns and conventions
- Business logic and domain models
- Testing strategies and practices
- Governance rules and compliance

### Maintenance

- DevContext automatically indexes on file changes
- Review indexing status regularly for accuracy
- Update configuration as project structure evolves
- Use for onboarding and knowledge transfer

## Memory and Context

### Persistent Memory

- `memory/PROJECT_CONTEXT.md`: Current project state
- `memory/COMPONENT_MAP.md`: System component relationships
- `memory/KNOWN_ISSUES.md`: Outstanding issues and workarounds
- `memory/CHANGELOG_AI.md`: AI-assisted changes log

### Context Maintenance

- Update memory files with significant changes
- Use memory for onboarding new team members
- Review and update quarterly
- Essential for AI-assisted development

## Getting Started

### New Team Members

1. Read this playbook completely
2. Review project charter and ADRs
3. Set up development environment
4. Complete onboarding checklist
5. Pair with experienced team member

### Development Setup

1. Clone repository
2. Install dependencies
3. Run test suite
4. Set up local environment
5. Verify CI/CD access

## Contact and Support

### Engineering Leadership

- **Technical Lead**: Responsible for technical direction
- **Engineering Manager**: Team management and process
- **QA Lead**: Quality assurance and testing

### Communication Channels

- **Slack**: Daily communication and collaboration
- **GitHub Issues**: Bug reports and feature requests
- **Architecture Reviews**: Technical decision discussions
- **Retrospectives**: Process improvement discussions

---

This playbook evolves with our practices. Submit PRs to improve or update any section.
