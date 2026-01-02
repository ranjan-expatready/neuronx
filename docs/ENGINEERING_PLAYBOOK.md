# Sales OS Engineering Playbook

## Overview
This playbook is the single entry point for understanding how the Sales OS engineering organization operates. It serves as a living document that evolves with our practices and technologies.

## Table of Contents
- [Operating Principles](#operating-principles)
- [Repository Structure](#repository-structure)
- [Development Workflow](#development-workflow)
- [Code Quality Standards](#code-quality-standards)
- [Testing Strategy](#testing-strategy)
- [Security Practices](#security-practices)
- [Documentation System](#documentation-system)
- [Decision Making](#decision-making)
- [CI/CD Pipeline](#cicd-pipeline)
- [Memory and Context](#memory-and-context)

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

### Automated Checks
- Code linting and formatting
- Unit and integration tests
- Security vulnerability scanning
- Performance benchmarking
- Build verification

### Deployment Strategy
- Automated deployments to staging
- Manual promotion to production
- Rollback procedures documented
- Monitoring and alerting configured

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
