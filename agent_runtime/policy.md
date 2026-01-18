# Agent Runtime Policy

**Risk Classification** | **HITL Requirements** | **Runtime Enforcement**

## Canonical References

**Canonical rules live in [/AGENTS.md](../AGENTS.md)**  
**SSOT index lives in [/docs/SSOT/index.md](../docs/SSOT/index.md)**  
**In conflicts, SSOT + AGENTS.md win.**

Defines risk tiers, human-in-the-loop requirements, and never-allowed actions for agent runtime execution. All policies align with and derive from canonical governance in [AGENTS.md](../AGENTS.md).

## Risk Tier Definitions

### Green Tier (Low Risk)

**Definition**: Changes with minimal blast radius, easily reversible, no production impact

**HITL Required**: Code review only (post-implementation)
**Agent Autonomy**: Full autonomy within boundaries
**Evidence Required**: Basic traceability and test coverage

**Examples**:
- Documentation updates
- Unit test additions
- Non-critical bug fixes in isolated components
- Code formatting and style improvements
- README and comment updates
- Log message improvements
- Configuration file updates (non-sensitive)

**Validation Criteria**:
- No breaking changes
- All existing tests pass
- No security implications
- Reversible without data loss

### Yellow Tier (Medium Risk)

**Definition**: Changes affecting user-facing functionality or system integration

**HITL Required**: Code review + product approval
**Agent Autonomy**: Implementation with pre-approval for complex changes
**Evidence Required**: Integration testing and impact assessment

**Examples**:
- New features with comprehensive tests
- API endpoint modifications (backward compatible)
- Database query optimizations
- Configuration parameter changes
- UI component modifications
- Integration with third-party services
- Performance improvements
- Error handling enhancements

**Validation Criteria**:
- Backward compatibility maintained
- Integration tests pass
- Performance benchmarks met
- Security review completed
- Rollback plan documented

### Red Tier (High Risk)

**Definition**: Changes with potential for data loss, security breaches, or system downtime

**HITL Required**: Code review + security review + product approval + manual testing
**Agent Autonomy**: Read-only analysis only; implementation requires explicit approval
**Evidence Required**: Security assessment, disaster recovery plan, extensive testing

**Examples**:
- Database schema changes
- Authentication/authorization modifications
- Security policy changes
- Breaking API changes
- Infrastructure configuration changes
- Data migration scripts
- External service credential updates
- Production deployment scripts

### Always Red (HITL Required)

**Definition**: Categories that are always classified as Red-tier regardless of scope or impact

**Always Red Categories**:
- auth/permissions/rbac
- payments/billing
- secrets/env/prod credentials
- destructive DB migrations (drop/alter)
- infra/terraform/k8s
- logging/audit tampering
- data export / PII access

**HITL Required**: All changes in these categories require explicit human approval and oversight

**Validation Criteria**:
- Security assessment completed
- Disaster recovery tested
- Data backup verified
- Rollback procedures validated
- Production testing completed
- Incident response plan updated

## Human-in-the-Loop (HITL) Requirements

### Approval Gates

**Green Tier**: Automated review assignment, standard merge process
**Yellow Tier**: Product team approval required, extended review window
**Red Tier**: Security team + product leadership approval, manual testing sign-off

### Escalation Triggers

- **Automatic**: Risk tier changes during implementation
- **Manual**: Agent uncertainty or evidence gaps
- **Emergency**: Policy violations or security concerns
- **Quality**: Test failures or evidence incompleteness

### HITL Process

1. **Risk Assessment**: Agent classifies change per tier definitions
2. **Evidence Package**: Complete evidence submitted for review
3. **Human Review**: Qualified reviewer assesses risk and evidence
4. **Approval/Modification**: Changes approved or sent back with requirements
5. **Implementation**: Approved changes proceed with oversight

## Never-Allowed Actions

### Production System Access

- **Database Operations**: No direct production database access
- **File System**: No production server file modifications
- **Network**: No production service API calls
- **Credentials**: No access to production secrets or keys

### Security Violations

- **Secrets Handling**: Never expose or modify production secrets
- **Authentication Bypass**: Never implement auth bypass mechanisms
- **Encryption Keys**: Never generate or modify encryption keys
- **Security Policies**: Never weaken security controls

### Data Operations

- **User Data**: Never access or modify user personal data
- **PII Handling**: Never process personally identifiable information
- **Data Deletion**: Never implement bulk data deletion without safeguards
- **Migration Scripts**: Never run data migrations without verified backups

### Infrastructure Changes

- **Production Deployment**: Never trigger production deployments
- **Infrastructure Config**: Never modify production infrastructure
- **Network Changes**: Never alter production network configurations
- **Resource Allocation**: Never change production resource limits

### Governance Violations

- **SSOT Modification**: Never modify canonical governance documents
- **CI/CD Bypass**: Never attempt to bypass CI/CD quality gates
- **Evidence Tampering**: Never modify or delete evidence artifacts
- **Audit Trail**: Never interfere with audit logging

## Runtime Policy Enforcement

### Risk Classification Process

1. **Initial Assessment**: Agent analyzes change scope and impact
2. **Evidence Gathering**: Collects supporting evidence from codebase
3. **Tier Assignment**: Maps to appropriate risk tier per definitions
4. **Validation**: Cross-references with SSOT policies
5. **Documentation**: Records classification with justification

### Policy Violation Handling

- **Detection**: Runtime monitors for policy violations
- **Immediate Halt**: Execution stops on policy breach
- **Evidence Capture**: Complete audit trail of violation
- **Escalation**: Immediate human intervention required
- **Remediation**: Rollback and corrective action planning

### Evidence Requirements by Tier

**Green Tier**:
- Code change evidence
- Test execution results
- Basic traceability links

**Yellow Tier**:
- Integration test results
- Impact assessment
- Rollback procedures
- Performance validation

**Red Tier**:
- Security assessment
- Disaster recovery plan
- Manual testing results
- Business approval documentation
- Incident response validation

## Continuous Policy Evolution

### Policy Updates

- **SSOT Alignment**: Policies derive from canonical governance
- **Evidence-Based**: Policy changes require evidence justification
- **Review Process**: Regular review of policy effectiveness
- **Training**: Agent systems updated with policy changes

### Metrics and Monitoring

- **Violation Rates**: Track policy compliance over time
- **Escalation Frequency**: Monitor HITL intervention patterns
- **Evidence Quality**: Assess evidence completeness and usefulness
- **Process Efficiency**: Measure time-to-approval by risk tier

---

**Policy Source**: Derived from [AGENTS.md](../AGENTS.md) risk tiers and HITL requirements
**Runtime Enforcement**: Policies implemented as execution guards in Phase 3
**See Also**: [agent_runtime/roles.md](roles.md) | [agent_runtime/tools.md](tools.md)