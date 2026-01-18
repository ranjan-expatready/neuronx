# Agent Runtime Memory Hierarchy

**Memory Architecture** | **Data Persistence** | **Knowledge Management**

## Canonical References

**Canonical rules live in [/AGENTS.md](../AGENTS.md)**  
**SSOT index lives in [/docs/SSOT/index.md](../docs/SSOT/index.md)**  
**In conflicts, SSOT + AGENTS.md win.**

Defines the hierarchical memory architecture for NeuronX agent runtime, ensuring proper separation between canonical truth, enforcement evidence, and execution context.

## Memory Hierarchy Overview

```
┌─────────────────────────────────┐
│      Repository & SSOT          │ ← Canonical Truth
│   (docs/SSOT/, AGENTS.md, etc.) │
├─────────────────────────────────┤
│         CI/CD Artifacts         │ ← Enforcement Evidence
│   (test results, coverage, etc.)│
├─────────────────────────────────┤
│        Agent Runtime            │ ← Execution Context
│   (session state, plans, etc.)  │
├─────────────────────────────────┤
│         ContextStream           │ ← Cross-Session Recall
│   (historical patterns, etc.)   │
├─────────────────────────────────┤
│            Redis                │ ← Ephemeral Cache
│   (temporary state, locks, etc.)│
└─────────────────────────────────┘
```

## Repository & SSOT (Canonical Truth)

**Persistence**: Permanent, version-controlled, canonical
**Owner**: Development team via PR process
**Purpose**: Single source of truth for all governance and requirements

**Contents**:
- `docs/SSOT/` - Complete governance framework
- `AGENTS.md` - Agent operating rules
- `CONTRIBUTING.md` - Contribution guidelines
- Architecture documentation
- Requirements and specifications
- Governance policies and procedures

**Agent Runtime Role**:
- **Read-Only**: Agents consume policies and requirements
- **Never Modified**: Runtime cannot alter canonical sources
- **Validation Source**: All runtime decisions validated against SSOT

**Update Rules**:
- Modified only through standard PR process
- Requires governance checklist completion
- Subject to branch protection and reviews
- Changes audited and versioned

## CI/CD Artifacts (Enforcement Evidence)

**Persistence**: Build artifacts, retained per retention policy
**Owner**: CI/CD pipeline automation
**Purpose**: Evidence of quality gate enforcement and validation

**Contents**:
- Test execution results and coverage reports
- Linting and type checking outputs
- Security scan results
- Build artifacts and logs
- Performance benchmark results
- Evidence validation outputs

**Agent Runtime Role**:
- **Consumption**: Agents verify their outputs against CI standards
- **Validation**: Runtime uses CI results to confirm compliance
- **Evidence**: CI artifacts provide proof of quality enforcement

**Update Rules**:
- Generated automatically by CI/CD pipelines
- Cannot be modified by agents
- Retained according to organizational policies
- Used for audit trails and compliance verification

## Agent Runtime (Execution Context)

**Persistence**: Session-based, preserved across role transitions
**Owner**: Agent runtime orchestration
**Purpose**: Maintain execution state and coordination across agent roles

**Contents**:
- Session state and progress tracking
- Role handoff evidence and validation
- Execution plans and specifications
- Risk assessments and classifications
- Evidence chains and audit trails
- Intermediate results and context

**Agent Runtime Role**:
- **Active Management**: Runtime maintains and coordinates session state
- **Evidence Collection**: Builds audit trails for all actions
- **State Preservation**: Enables resumable, deterministic execution

**Update Rules**:
- Managed by runtime orchestration layer
- Preserved across session interruptions
- Subject to evidence validation requirements
- Archived after successful completion

## ContextStream (Cross-Session Recall)

**Persistence**: Long-term, queryable knowledge base
**Owner**: Data platform team
**Purpose**: Historical context and pattern recognition across sessions

**Contents**:
- Historical decision patterns and outcomes
- Cross-project learnings and best practices
- Long-term trend analysis
- Knowledge base for informed decision making
- Pattern recognition data
- Session summaries and insights

**Agent Runtime Role**:
- **Read-Heavy**: Agents query historical context for informed execution
- **Write-Light**: Runtime contributes session summaries and learnings
- **Context Awareness**: Provides continuity across development sessions

**Update Rules**:
- Read access for all agents during planning
- Write access limited to verified session summaries
- Subject to data retention and privacy policies
- Used for continuous improvement and pattern recognition

## Redis (Ephemeral Cache)

**Persistence**: Temporary, TTL-based expiration
**Owner**: Infrastructure team
**Purpose**: High-performance temporary storage for execution optimization

**Contents**:
- Session locks and coordination
- Intermediate computation results
- Frequently accessed reference data
- Temporary data structures for processing
- Cache for external API responses
- Runtime coordination state

**Agent Runtime Role**:
- **Optional Enhancement**: Improves performance but not required for core functionality
- **Temporary Storage**: Never used for permanent data or evidence
- **Coordination**: Supports multi-agent coordination and locking

**Update Rules**:
- TTL-based automatic expiration
- No permanent data storage
- Infrastructure-managed with redundancy
- Performance optimization only

## Data Residency Rules

### What Must Never Live Only in Memory

**Critical Governance Data**:
- SSOT documents and policies
- Agent operating rules
- Security and compliance requirements
- Architectural boundaries and constraints

**Evidence and Audit Trails**:
- Test results and coverage reports
- Security scan outputs
- Code review decisions and approvals
- Change history and rollback procedures

**Business Requirements**:
- User stories and acceptance criteria
- Business rules and validation logic
- Compliance and regulatory requirements
- Service level agreements

### Memory-Only Data (Acceptable)

**Session State**:
- Current execution progress
- Temporary computation results
- UI interaction state
- Debug information during execution

**Performance Optimizations**:
- Cached computation results
- Frequently accessed reference data
- Temporary indexes and structures
- Coordination locks and semaphores

## Memory Update Timing

### Post-Merge Only

**SSOT Updates**:
- New requirements and policies
- Architecture decisions and changes
- Governance framework modifications
- Quality standard updates

**Evidence Archives**:
- Completed project evidence
- Successful deployment records
- Quality metric baselines
- Compliance verification results

### Session-Based Updates

**Runtime State**:
- Execution progress and checkpoints
- Risk reclassification decisions
- Evidence collection status
- Role transition handoffs

**ContextStream Contributions**:
- Session learnings and insights
- Pattern recognition updates
- Decision outcome tracking
- Process improvement suggestions

### Real-Time Updates

**Redis Operations**:
- Lock acquisition and release
- Cache population and invalidation
- Coordination state changes
- Performance metric updates

## Memory Consistency Guarantees

### Data Integrity

- **SSOT Authority**: All policies derive from canonical sources
- **Evidence Completeness**: Audit trails maintained across all operations
- **State Consistency**: Session state preserved and recoverable
- **Knowledge Accuracy**: ContextStream data validated before integration

### Synchronization Rules

- **Read-After-Write**: Memory updates visible immediately to reading agents
- **Consistency Guarantees**: Strong consistency for governance data
- **Eventual Consistency**: Acceptable for performance optimization data
- **Conflict Resolution**: Last-write-wins with audit trails for governance conflicts

---

**Design Only**: Memory architecture defined for Phase 3 implementation
**See Also**: [agent_runtime/README.md](README.md) | [docs/SSOT/10_AGENT_MEMORY.md](../docs/SSOT/10_AGENT_MEMORY.md)