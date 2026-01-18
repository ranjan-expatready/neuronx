# NeuronX Releases and Versioning (SSOT)

**Source**: Extracted from .github/workflows/release.yml, .changeset/config.json
**Last Updated**: 2026-01-10
**Authority**: Release Management Process

## Changesets Workflow

NeuronX uses [Changesets](https://github.com/changesets/changesets) for automated versioning and changelog management.

### When to Create Changesets

- **User-facing changes**: New features, bug fixes, breaking changes
- **API modifications**: Endpoint changes, contract updates
- **Configuration changes**: New settings or behavioral changes
- **Security fixes**: Vulnerability patches and security improvements

### Changeset Types

#### Patch (`patch`)

- Bug fixes and minor improvements
- Internal refactoring without user impact
- Documentation updates and typo fixes
- Performance optimizations without API changes

#### Minor (`minor`)

- New features that are backward compatible
- New API endpoints or optional parameters
- Enhanced functionality without breaking changes
- New configuration options

#### Major (`major`)

- Breaking changes to APIs or contracts
- Removal of deprecated features
- Significant behavioral changes
- Major architectural modifications

## Release Process

### Development Phase

1. **Create Changeset**: `pnpm changeset`
2. **Describe Change**: Provide clear description of what changed and why
3. **Select Version Bump**: Choose appropriate semantic version increment
4. **Commit Changeset**: Include changeset file with feature code

### Automated Release Phase

1. **Detection**: CI detects changesets on main branch pushes
2. **Version PR Creation**: Automated PR created with version bumps and changelog
3. **Review & Merge**: Version PR reviewed and approved
4. **Release Creation**: GitHub release created with changelog and artifacts
5. **Package Publishing**: NPM packages published with new versions

## Versioning Strategy

### Semantic Versioning (SemVer)

- **MAJOR.MINOR.PATCH** format (e.g., 1.2.3)
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### Pre-release Versions

- **Alpha**: `-alpha.1`, `-alpha.2` (unstable, for testing)
- **Beta**: `-beta.1`, `-beta.2` (feature complete, bug fixing)
- **RC**: `-rc.1`, `-rc.2` (release candidate, final validation)

## Release Workflow Configuration

### Base Branch

- **Main Branch**: `main` (production releases)
- **Development**: Feature development occurs on feature branches

### Publishing Access

- **Restricted Access**: Publishing limited to authorized maintainers
- **NPM Registry**: Packages published to npm registry
- **GitHub Releases**: Automated release creation with assets

### Internal Dependencies

- **Update Strategy**: `patch` updates for internal package dependencies
- **Peer Dependencies**: Only update when out of range for safety

## Release Commands

### Development Commands

```bash
# Create a new changeset
pnpm changeset

# Version packages (used in CI)
pnpm version-packages

# Publish packages (used in CI)
pnpm release
```

### Manual Release (Emergency)

```bash
# Force a release (only for emergencies)
pnpm changeset version
pnpm release
```

## Release Artifacts

### NPM Packages

- **Scoped Packages**: Published under `@neuronx/` scope
- **Version Tags**: Automatic tagging with version numbers
- **Changelog**: Included in package metadata

### GitHub Releases

- **Release Notes**: Generated from changesets
- **Assets**: Build artifacts and documentation
- **Tags**: Version tags for checkout and rollback

## Release Cadence

### Automated Releases

- **Trigger**: Every merge to main with changesets
- **Frequency**: Multiple releases per day possible
- **Timing**: Immediate after CI passes

### Manual Releases

- **Emergency**: Critical security fixes or hotfixes
- **Override**: Administrator approval required
- **Documentation**: Must include incident report

## Quality Gates for Releases

### Pre-release Validation

- **CI/CD**: All tests pass, coverage ≥85%
- **Security**: No critical vulnerabilities
- **Documentation**: Changelog complete and accurate
- **Evidence**: Release evidence captured

### Post-release Validation

- **Smoke Tests**: Basic functionality verification
- **Monitoring**: Error rate and performance monitoring
- **Rollback Plan**: Documented rollback procedures

## Rollback Procedures

### Automated Rollback

- **Version Tags**: Each release tagged for quick rollback
- **Database**: Migration rollback scripts available
- **Configuration**: Feature flags for disabling new features

### Manual Rollback

1. **Identify Issue**: Determine scope and impact of release
2. **Stop Deployment**: Halt further rollouts if applicable
3. **Revert Code**: Checkout previous version tag
4. **Database**: Run rollback migrations if needed
5. **Monitor**: Validate system stability after rollback

## Release Communication

### Internal Communication

- **Slack Notifications**: Release status and changelogs
- **Engineering Log**: Release details documented
- **Incident Reports**: Issues and resolutions tracked

### External Communication

- **Changelog**: Public release notes for stakeholders
- **Product Log**: User-visible changes communicated
- **Support Documentation**: Updated for new features

## Release Metrics

### Success Metrics

- **Deployment Success Rate**: >99% successful deployments
- **Rollback Frequency**: <1% of releases require rollback
- **Time to Deploy**: <15 minutes from merge to production

### Quality Metrics

- **Defect Rate**: <0.1% post-release defects
- **Performance Impact**: <5% performance regression
- **Security Incidents**: Zero post-release security issues

## Future Evolution

### SaaS Release Strategy

- **Multi-tenant Deployments**: Environment-specific releases
- **Feature Flags**: Gradual rollout with feature toggles
- **Canary Releases**: Percentage-based rollout testing

### Advanced Automation

- **Blue-Green Deployments**: Zero-downtime releases
- **Automated Testing**: Multi-environment validation
- **Performance Regression**: Automated performance testing

## Governance Compliance

### Release Documentation

- **ADR References**: Architectural decisions documented
- **Evidence Capture**: Release evidence maintained
- **Audit Trail**: Complete history of changes and approvals

### Approval Requirements

- **Code Review**: All changes reviewed and approved
- **Security Review**: Security implications assessed
- **Product Review**: User impact validated

## Emergency Release Process

### Criteria for Emergency Release

- **Security Vulnerability**: Critical security issues
- **Data Loss Prevention**: Issues causing data corruption
- **Service Outage**: Critical functionality unavailable
- **Legal Compliance**: Regulatory requirement violations

### Emergency Process

1. **Assessment**: Security/product team validates emergency
2. **Approval**: Engineering leadership approval obtained
3. **Bypass**: Normal quality gates may be bypassed
4. **Documentation**: Emergency release fully documented
5. **Post-mortem**: Incident review conducted within 24 hours
