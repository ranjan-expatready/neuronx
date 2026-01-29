# Skills Policy — Antigravity Agent Skills Policy

## Overview

This document defines a strict policy for any Antigravity "Agent Skills" / third-party agent capability kits that may be integrated with the Autonomous Engineering OS. The policy ensures that all skills align with governance principles and do not compromise system integrity.

---

## POLICY PHILOSOPHY

### Principle: Governance Sovereignty

The Autonomous Engineering OS operates under defined governance (GOVERNANCE/, AGENTS/, QUALITY_GATES). No skill or third-party kit may override, bypass, or weaken these governance guardrails.

**Sovereignty Hierarchy**:
1. **GOVERNANCE/**: Highest authority (guardrails, risk tiers, cost policy, approval gates)
2. **AGENTS/**: Agent definitions and roles (CTO Agent, Product Agent, Code Agent, etc.)
3. **Quality Gates**: Engineering standards and Definition of Done
4. **COCKPIT/**: Founder interface and artifacts
5. **Skills/Additions**: Third-party capabilities (must respect all of the above)

**Skills are Subservient**: Skills are tools that agents can use, but skills must never dictate behavior or override governance.

---

## SKILL ADMISSION CRITERIA

### Mandatory Criteria for Skill Approval

A skill or kit may be integrated ONLY if:

1. **Explicitly Reviewed and Listed**:
   - Skill is reviewed by CTO Agent and Founder
   - Skill is explicitly listed in this document's APPROVED SKILLS section
   - Skills NOT listed are UNAUTHORIZED and must NOT be used

2. **Does Not Override Governance**:
   - Skill does not modify GOVERNANCE/ files or behavior
   - Skill does not modify AGENTS/ file behavior or roles
   - Skill does not modify QUALITY_GATES or quality requirements
   - Skill does not modify COCKPIT/ approval workflow or gates

3. **Well-Defined Scope**:
   - Skill has a clear, narrow purpose
   - Skill's capabilities are well-documented
   - Skill's limitations are well-documented

4. **Auditable**:
   - Skill's actions are visible and recorded
   - Skill cannot execute hidden or undocumented operations
   - Skill's behavior is deterministic or clearly documented

5. **Reversible**:
   - Skill's actions can be rolled back if needed
   - Skill does not modify data without audit trail
   - Skill does not commit to protected areas without triggers

6. **Safe by Default**:
   - Skill's default behavior is safe and conservative
   - Skill requires explicit permission for risky operations
   - Skill has safety checks and validation

---

## SKILL CLASSIFICATIONS

### Classification Categories

**Class 1: Informational Skills**
- Read-only operations
- Information gathering and reporting
- Documentation generation
- No side effects, no modifications

**Class 2: Analytical Skills**
- Code analysis and recommendations
- Performance analysis
- Security scanning
- Recommendations only, no automated changes

**Class 3: Development Skills**
- Code generation assistance
- Test generation
- Refactoring suggestions
- Changes require gate and approval triggers

**Class 4: Operations Skills**
- Deployment automation
- Infrastructure management
- Monitoring and alerting
- Changes require gate and approval triggers

**Class 5: Integration Skills**
- Third-party service integrations
- API interactions
- External data sync
- HIGH RISK — requires additional review

### Risk Matrix by Skill Class

| Class | Risk | Audit Required | Sandbox Evaluation | Approval Required |
|-------|------|----------------|---------------------|-------------------|
| Informational | LOW | Basic | Recommended | No (with listing) |
| Analytical | MEDIUM | Full | Required | Yes after review |
| Development | MEDIUM-HIGH | Full | Required | Yes after review |
| Operations | HIGH | Full | Required | Yes after review |
| Integration | HIGH | Full | Required | Yes + extra review |

---

## APPROVAL PROCESS FOR SKILLS

### Step 1: Skill Proposal

Anyone (Founder, CTO Agent, or contributor) can propose a skill by:

1. Creating a skill proposal document in COCKPIT/skills/proposals/
2. Documenting skill purpose, capabilities, and risk classification
3. Identifying how skill will be used
4. Identifying governance dependencies

**Skill Proposal Template**:

```yaml
SKILL_PROPOSAL

proposal_id: "SKILL-PROPOSAL-{timestamp}-{name}"
proposed_date: "YYYY-MM-DD HH:MM UTC"
proposed_by: "[Name]"

skill_name: "[Name of skill]"
skill_type: "[INFORMATIONAL | ANALYTICAL | DEVELOPMENT | OPERATIONS | INTEGRATION]"
source: "[Antigravity built-in, Third-party, Custom]"

# SKILL DESCRIPTION
description: |
  Clear description of what the skill does.
  Include capabilities and limitations.

# CAPABILITIES
capabilities:
  - "Capability 1"
  - "Capability 2"

# GOVERNANCE CHECK
governance_dependencies:
  - "Which GOVERNANCE files this skill respects"
  - "Which AGENTS/ files this skill works with"
  - "Which APPROVAL GATES this skill triggers"

# RISK ASSESSMENT
risk_level: "[LOW | MEDIUM | HIGH]"
risk_justification: "Why this risk level"
risk_mitigation: "How risks are mitigated"

# AUDIT REQUIREMENTS
audit_trail: "How skill actions are audited"
logging: "How skill actions are logged"
transparency: "How to see what skill is doing"

# SANDBOX EVALUATION PLAN (Required for Class 2-5)
sandbox_evaluation:
  - "Test case 1: What will be tested"
  - "Test case 2: What will be tested"

# FILES TO MODIFY
files_modified:
  - "SKILLS/[skill_name]/skill.md"
  - "COCKPIT/SKILLS_POLICY.md (add to approved list)"
```

### Step 2: Governance Review

CTO Agent reviews skill proposal against:

1. **Governance Compatibility**:
   - [ ] Does not override GOVERNANCE/ guardrails
   - [ ] Works within AGENTS/ framework
   - [ ] Respects QUALITY_GATES
   - [ ] Triggers appropriate APPROVAL_GATES

2. **Safety Evaluation**:
   - [ ] Safe by default behavior
   - [ ] Reversible operations
   - [ ] Auditable actions
   - [ ] Clear error handling

3. **Scope Validation**:
   - [ ] Well-defined purpose
   - [ ] Narrow scope (not too broad)
   - [ ] Clear limitations

4. **Classification Validation**:
   - [ ] Risk level appropriate for classification
   - [ ] Proper mitigation strategies

### Step 3: Sandbox Evaluation (Class 2-5 Required)

For Class 2-5 skills, sandbox evaluation is MANDATORY:

1. **Create Sandbox Environment**:
   - Separate branch for testing
   - Isolated test data
   - No impact to production

2. **Execute Test Cases**:
   - Run defined test cases from proposal
   - Document results
   - Identify any unexpected behavior

3. **Audit Trail Verification**:
   - Verify all skill actions are logged
   - Verify audit trail is complete
   - Verify transparency of actions

4. **Risk Validation**:
   - Verify skill does not exceed authorized scope
   - Verify skill respects all gates
   - Verify skill fails safely on errors

**Sandbox Evaluation Report Template**:

```yaml
SANDBOX_EVALUATION_REPORT

skill_name: "[Skill name]"
evaluation_date: "YYYY-MM-DD HH:MM UTC"
evaluated_by: "CTO Agent"

test_cases:
  - case_id: 1
    description: "Test case description"
    result: "PASS | FAIL"
    notes: "Observations"

governance_compliance:
  respects_guardrails: true/false
  respects_approval_gates: true/false
  respects_quality_gates: true/false

audit_trail_verification:
  all_actions_logged: true/false
  complete_audit_trail: true/false

risk_verification:
  scope_respected: true/false
  safe_failures: true/false

recommendation: "APPROVE | REJECT | MODIFY | FURTHER_TESTING"
recommendation_justification: "Why this recommendation"
```

### Step 4: Founder Approval

After sandbox evaluation (if required), Founder reviews:

1. **Proposal Document**
2. **Governance Review** (from Step 2)
3. **Sandbox Evaluation Report** (from Step 3, if applicable)

**Founder Actions**:
- **APPROVE**: Skill is added to APPROVED SKILLS list
- **REJECT**: Skill is not approved, proposal archived
- **REQUEST_CHANGES**: Feedback provided, proposal resubmitted
- **POSTPONE**: Decision deferred, proposal kept open

### Step 5: Skill Integration

If approved:

1. **Create SKILLS/ directory structure**:
   ```
   SKILLS/
   └── [skill_name]/
       ├── skill.md
       ├── README.md
       └── examples/
   ```

2. **Document Skill**: Create skill.md with full documentation

3. **Update SKILLS_POLICY.md**: Add skill to APPROVED SKILLS section

4. **Commit to Repository**: Add skill files to repository

5. **Update Prompts**: Update AGENTS/PROMPT_TEMPLATES.md if skill is referenced

---

## APPROVED SKILLS

### Active Skills (Approved and Authorized)

As of [Date], the following skills are approved:

#### Skill: Code Analysis (Class 2: Analytical)

**Skill ID**: SKILL-001

**Classification**: ANALYTICAL (MEDIUM risk)

**Description**: Analyzes code for quality issues, security vulnerabilities, and best practice violations. Provides recommendations only, does not modify code.

**Governance Dependencies**:
- Respects GOVERNANCE/DEFINITION_OF_DONE.md
- Works with AGENTS/Code Agent role
- Does not trigger approval gates (analytical only)

**Audit Requirements**:
- All analysis results logged to COCKPIT/evidence/
- Analysis timestamp recorded

**Approval Date**: [Date]

**Approved By**: [Founder]

---

#### Skill: Test Generation (Class 3: Development)

**Skill ID**: SKILL-002

**Classification**: DEVELOPMENT (MEDIUM-HIGH risk)

**Description**: Generates unit tests based on code analysis. Generates test code only, does not modify production code.

**Governance Dependencies**:
- Respects GOVERNANCE/QUALITY_GATES.md (coverage requirements)
- Works with AGENTS/Code Agent role
- Triggers approval gates if test code modification required

**Audit Requirements**:
- All generated tests include author attribution
- Test generation logged to COCKPIT/evidence/

**Approval Date**: [Date]

**Approved By**: [Founder]

---

#### Skill: Documentation Generation (Class 1: Informational)

**Skill ID**: SKILL-003

**Classification**: INFORMATIONAL (LOW risk)

**Description**: Generates documentation from code comments and structure. Read-only operation.

**Governance Dependencies**:
- Respects GOVERNANCE/GUARDRAILS.md (documentation sources policy)
- Does not modify any repository structure
- Does not trigger approval gates (read-only)

**Audit Requirements**:
- All generated documentation includes timestamp
- Source files referenced in documentation

**Approval Date**: [Date]

**Approved By**: [Founder]

---

### No Other Skills Authorized

Any skill not listed in the APPROVED SKILLS section is UNAUTHORIZED.

**UNAUTHORIZED SKILLS MUST NOT BE USED**.

---

## PROHIBITED SKILL BEHAVIORS

### Absolute Prohibitions

Skills must NEVER:

1. **Override Governance**:
   - Modify GOVERNANCE/ files
   - Change guardrail behavior
   - Bypass approval gates
   - Modify risk tier classifications

2. **Modify AGENTS/ Framework**:
   - Change agent role definitions
   - Modify agent prompt templates
   - Alter state machine behavior

3. **Bypass Quality Gates**:
   - Skip test requirements
   - Ignore coverage requirements
   - Disable quality checks

4. **Execute Without Audit**:
   - Commit changes without logging
   - Modify files without traceability
   - Execute hidden operations

5. **Access Sensitive Data Without Permission**:
   - Read credentials or secrets
   - Access user data without explicit permission
   - Modify billing or payment data

6. **Modify Protected Areas Without Permission**:
   - GOVERNANCE/ directory
   - AGENTS/ directory
   - State tracking files (STATE/)
   - Cockpit configuration (COCKPIT/)

### Violation Handling

If a skill is detected violating policies:

1. **Immediate Stop**: Skill usage is stopped immediately
2. **Incident Created**: INCIDENT artifact created for governance violation
3. **Audit Initiated**: Full audit of skill's actions
4. **Rollback If Possible**: Revert unauthorized changes
5. **Skill Removed**: Skill is removed from APPROVED SKILLS list
6. **Review Process**: Review how violation occurred and prevent recurrence

---

## SKILL MONITORING AND MAINTENANCE

### Ongoing Monitoring

CTO Agent monitors approved skills:

1. **Skill Usage Tracking**:
   - Which skills are used and how often
   - Which agents use which skills
   - Skill effectiveness metrics

2. **Compliance Checking**:
   - Do skills still respect governance?
   - Have governance changed that affect skills?
   - Do skills still meet admission criteria?

3. **Performance Monitoring**:
   - Skill performance metrics
   - Error rates
   - User satisfaction

### Skill Maintenance

1. **Regular Review**: Quarterly review of approved skills
2. **Update Governance**: Update skill documentation as governance evolves
3. **Retire Skills**: Remove skills that are no longer needed or become incompatible
4. **Version Tracking**: Track skill versions and updates

### Skill Retirement Process

When a skill is no longer needed or compatible:

1. **Create Retirement Proposal**: Document reason for retirement
2. **Founder Approval**: Founder approves retirement
3. **Update Documentation**:
   - Remove from APPROVED SKILLS list
   - Document retirement date and reason
   - Archive skill documentation

---

## SKILL AUDIT CAPABILITIES

### What Must Be Auditable

For every skill, the following must be auditable:

1. **Skill Usage**:
   - When was the skill used?
   - Which agent used the skill?
   - What was the skill used for?

2. **Skill Actions**:
   - What actions did the skill take?
   - What files were created/modified?
   - What changes were made?

3. **Skill Results**:
   - What was the outcome?
   - Were there any errors?
   - Was there any unexpected behavior?

4. **Skill Performance**:
   - How long did the skill run?
   - What resources did it consume?
   - What was the cost?

### Audit Log Location

Skill audit logs are stored in:
```
COCKPIT/evidence/skill-audit/[skill_name]/[timestamp].log
```

### Audit Query

To audit a skill:
```bash
# Find all audit logs for a skill
find COCKPIT/evidence/skill-audit -name "[skill_name]*"

# Check recent skill usage
grep -h "skill_name" STATE/STATUS_LEDGER.md
```

---

## SKILL INTEGRATION WITH AGENTS

### How Agents Use Skills

1. **Agent Identifies Need**: Agent determines a skill would be helpful
2. **Check Approval**: Agent verifies skill is in APPROVED SKILLS list
3. **Load Skill**: Agent loads skill documentation and capabilities
4. **Execute Skill**: Agent invokes skill, passing context
5. **Log Usage**: Agent logs skill usage to audit trail
6. **Apply Results**: Agent uses skill output (subject to gates)

### Skill Selection Guidelines

Agents select skills based on:

1. **Task Appropriateness**: Is the skill right for the task?
2. **Risk Level**: Is the skill's risk appropriate for the task?
3. **Governance Compliance**: Does the skill respect gates?
4. **Previous Results**: Has the skill been reliable?

### Skill Failure Handling

If a skill fails during execution:

1. **Log Failure**: Document failure in skill audit log
2. **Fallback**: Use alternative approach if available
3. **Report**: If failure is critical, report to Founder
4. **Investigate**: Review why skill failed and if fix is needed

---

## CURATED SKILL SET PREFERENCE

### Philosophy: Small, Curated Set

**Preference for Quality Over Quantity**: The Autonomous Engineering OS should use a small, curated set of high-quality skills rather than many skills.

**Reasons**:
- Easier to maintain and audit
- Clearer understanding of system capabilities
- Reduced complexity and potential for conflicts
- Better alignment with governance

### Ideal Skill Set Size

- **10-20 skills maximum**: This is the upper bound for manageable complexity
- **Focus on high-impact skills**: Prioritize skills that provide significant value
- **Avoid skill proliferation**: Each new skill must have strong justification

### Skill Categories for Curated Set

Recommended skill categories:

1. **Analysis Skills** (2-3 skills):
   - Code analysis
   - Performance analysis
   - Security scanning

2. **Documentation Skills** (1-2 skills):
   - Documentation generation
   - README generation

3. **Test Skills** (1-2 skills):
   - Test generation
   - Test optimization

4. **Deployment Skills** (1-2 skills):
   - Deployment automation
   - Rollback automation

5. **Integration Skills** (2-3 skills):
   - Specific third-party service integrations
   - API interactions

**Total: 7-12 skills** is a reasonable range

---

## SANDBOX EVALUATION REQUIREMENTS

### What Must Be Tested

For Class 2-5 skills, sandbox evaluation must test:

1. **Governance Compliance**:
   - Does skill respect guardrails?
   - Does skill trigger appropriate gates?
   - Does skill respect quality gates?

2. **Safety**:
   - Does skill fail safely?
   - Are error conditions handled correctly?
   - Are operations reversible?

3. **Audit Trail**:
   - Are all actions logged?
   - Is audit trail complete?
   - Can actions be traced back?

4. **Scope**:
   - Does skill stay within authorized scope?
   - Does skill attempt unauthorized operations?
   - Are limitations respected?

### Sandbox Environment Setup

```
# Create sandbox branch
git checkout -b sandbox/skill-[skill-name]-evaluation

# Create sandbox directory structure
mkdir -p COCKPIT/sandbox/[skill-name]
mkdir -p COCKPIT/evidence/skill-audit/[skill-name]

# Setup test data
mkdir -p COCKPIT/sandbox/[skill-name]/test-data
```

### Sandbox Evaluation Checklist

```bash
[ ] Test case 1: [Description] - [PASS/FAIL]
[ ] Test case 2: [Description] - [PASS/FAIL]
[ ] Test case 3: [Description] - [PASS/FAIL]

[ ] Governance compliance verified
[ ] Safety verified
[ ] Audit trail verified
[ ] Scope verified

[ ] Sandbox evaluation report created
[ ] Report submitted for Founder approval
```

---

## SKILL PROPOSALS IN PROGRESS

### Current Proposals (Under Review)

*No proposals currently under review.*

---

## VERSION HISTORY

- v1.0 (Initial): Skills policy with admission criteria, approval process, approved skills list, prohibited behaviors

---

**Document Version**: v1.0
**Last Updated**: 2026-01-23 by CTO Agent
