# WI-032: Operator Control Plane (Authoritative, Minimal UI)

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX is a complete sales operating system, but operators cannot observe its decisions, approve required actions, or intervene safely. This creates a black box system that cannot be trusted or controlled in production.

Without a control plane:

- Operators cannot understand why NeuronX makes decisions
- Human approval workflows cannot be executed
- System safety cannot be monitored
- Experiment results cannot be observed
- Critical interventions are impossible

This prevents NeuronX from being a viable product despite having all the backend authority.

## Solution Overview

Create a thin, authoritative operator control plane with exactly 4 screens:

1. **Opportunity Command View** - Read-mostly observation of NeuronX decisions
2. **Human Work Queue** - Actionable queue for approvals and assistance
3. **Experiment Insights** - Read-only experiment performance and recommendations
4. **System Health & Safety** - Real-time system status and safety monitoring

**Critical Constraints:**

- UI is a control surface, not logic
- NeuronX remains the sole authority
- All actions go through existing decision/approval endpoints
- No business logic in frontend
- Read-only by default, action-gated

## Acceptance Criteria

### AC-032.01: Opportunity Command View

- [x] Display opportunity ID, canonical stage, deal value, risk score
- [x] Show active playbook version and experiment assignment
- [x] Display latest DecisionResult with full context
- [x] Show evidence timeline with confidence scores
- [x] Display planned actions with SLA status
- [x] Show recent audit events (last 10)
- [x] ❌ No editing of stages, playbooks, or decisions

### AC-032.02: Human Work Queue

- [x] Filter by reason: approval_required, assisted_execution, high_risk_escalation
- [x] Display priority-based queues (urgent → normal → low)
- [x] Show SLA remaining time for urgent items
- [x] Allow approve, assist, escalate actions with notes
- [x] Actions call backend decision/approval endpoints only
- [x] All actions include correlation IDs
- [x] Items removed from queue after action

### AC-032.03: Experiment Insights

- [x] Display active, completed, terminated experiments
- [x] Show assignment counts and completion rates
- [x] Highlight best variant with improvement metrics
- [x] Display recommendations (promote, continue, investigate)
- [x] ❌ No experiment control or promotion buttons
- [x] Read-only statistical summaries

### AC-032.04: System Health & Safety

- [x] Component status: Stage Gate, Playbook Engine, Decision Engine, Experiments
- [x] Key metrics: opportunities processed, decisions made, actions executed
- [x] Enforcement status: stage gate mode, playbook enforcement, voice safety
- [x] Active alerts with acknowledge functionality
- [x] Safety incident tracking
- [x] Performance metrics and data completeness

### AC-032.05: Security & Authority

- [x] Role-based access: admin, operator, viewer
- [x] Read-only by default for all users
- [x] Action permissions: admin can approve all, operators have restrictions
- [x] All writes go through NeuronX decision endpoints
- [x] UI cannot mutate: stages, playbooks, decisions, experiments
- [x] Correlation IDs propagated on all actions

## Artifacts Produced

### Code Artifacts

- [x] `apps/operator-ui/` - Complete Next.js application
- [x] Four main pages: opportunities, work-queue, experiments, system
- [x] Authentication context with role-based permissions
- [x] API client for NeuronX backend communication
- [x] Type-safe interfaces for all data structures
- [x] Reusable UI components (Card, StatusBadge, Timeline, etc.)

### Test Artifacts

- [x] API client unit tests with mock responses
- [x] Component integration tests
- [x] Authentication flow tests
- [x] Role-based access control tests

### Documentation Artifacts

- [x] UI architecture and constraints documentation
- [x] API integration specifications
- [x] Operator workflow guides
- [x] Security and access control policies

## Technical Implementation

### Architecture

```
apps/operator-ui/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with auth
│   ├── page.tsx           # Dashboard
│   ├── opportunities/[id]/ # Opportunity detail
│   ├── work-queue/        # Human action queue
│   ├── experiments/       # Experiment insights
│   └── system/            # Health monitoring
├── components/            # Reusable UI
├── lib/                   # Utilities
│   ├── api-client.ts      # Backend communication
│   ├── auth.tsx          # Authentication context
│   ├── types.ts          # TypeScript definitions
│   └── ui.tsx            # UI components
└── __tests__/            # Test suites
```

### Authentication & Authorization

```typescript
interface UserSession {
  userId: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: string[];
}

const ROLE_PERMISSIONS = {
  admin: ['read:all', 'approve:all', 'assist:all', 'escalate:all'],
  operator: [
    'read:all',
    'approve:high_priority',
    'assist:all',
    'escalate:supervised',
  ],
  viewer: ['read:opportunities', 'read:experiments', 'read:system'],
};
```

### API Integration

```typescript
// All UI actions call existing NeuronX endpoints
const apiCalls = {
  getOpportunity: 'GET /opportunities/{id}',
  getWorkQueue: 'GET /work-queue',
  takeAction: 'POST /work-queue/actions',
  getExperiments: 'GET /experiments',
  getSystemHealth: 'GET /system/health',
  acknowledgeAlert: 'POST /system/alerts/{id}/acknowledge',
};
```

## Out of Scope

- CRM functionality (leads, contacts, accounts)
- Workflow builder or visual pipeline editor
- Playbook authoring or editing
- Direct stage manipulation
- Experiment creation or modification
- Advanced analytics or reporting dashboards
- User management or role administration
- Audit log deep-dives or advanced filtering

## Dependencies

- **WI-027**: Stage Gate (provides stage enforcement status)
- **WI-028**: Playbook Engine (provides playbook context)
- **WI-029**: Decision Engine (provides decision results)
- **WI-030**: Playbook Governance (provides versioning context)
- **WI-031**: Playbook Intelligence (provides experiment insights)
- **REQ-001**: Enterprise-grade reliability and UX
- **REQ-007**: Audit trail requirements

## Risk Mitigation

### Technical Risks

- **API coupling**: UI calls existing endpoints only, no new logic
- **State management**: Server state only, no complex client state
- **Performance**: Thin UI with minimal data processing
- **Security**: Read-only by default, action-gated permissions
- **Authority leakage**: UI cannot bypass NeuronX decisions

### Business Risks

- **Operator confusion**: Clear labeling of NeuronX authority
- **Action delays**: SLA indicators and priority queues
- **Safety incidents**: Real-time health monitoring and alerts
- **Trust erosion**: Transparent decision display and audit trails
- **Scope creep**: Strict 4-screen limit enforced

## Success Metrics

- **Authority preservation**: 100% of actions route through NeuronX
- **Operator efficiency**: <5 minute average task completion
- **System visibility**: 100% of decisions observable
- **Safety compliance**: Zero authority bypass incidents
- **User satisfaction**: >90% operator approval rating

## Future Extensions

- Advanced filtering and search capabilities
- Bulk actions for work queue items
- Real-time notifications for urgent items
- Historical trend analysis in system health
- Custom dashboard configurations per role
- Integration with external alerting systems
