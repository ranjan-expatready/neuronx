# WI-063: Manager Console – Team Intelligence & Coaching Surface

## Objective

Create a Manager Console that provides team performance intelligence and coaching insights without execution authority. Enable managers to understand team dynamics, identify coaching opportunities, and monitor performance trends while maintaining strict governance boundaries.

## Context

Operators have access to execution capabilities through the Operator Console. Managers need visibility into team performance without the ability to directly execute actions. The Scorecard Engine (WI-065) provides the intelligence foundation, but managers need a curated view focused on coaching and team management rather than individual task execution.

This work item creates the Manager Console as a read-only intelligence surface that transforms raw metrics into actionable coaching insights.

## Scope

### In Scope

- **Manager Console UI**: New Next.js application at `/manager` route
- **Surface Access Control**: MANAGER and EXECUTIVE role-based access
- **Team Scorecard Display**: Aggregate team-level metrics from MANAGER surface scorecards
- **Rep Performance Table**: Individual rep metrics with coaching signals
- **Rep Drilldown Drawer**: Detailed performance analysis for selected reps
- **Coaching Recommendations**: AI-driven coaching suggestions based on performance patterns
- **Read-Only Intelligence**: No FSM state changes, no action execution

### Out of Scope

- **Executive Dashboard**: Separate work item (WI-064)
- **CRM Integration**: No direct CRM write-back capabilities
- **Real-time Updates**: Polling-based refresh (WebSocket future enhancement)
- **Custom Reporting**: Pre-defined views only
- **Action Assignment**: Managers can observe but not execute

## Implementation Details

### 1. Manager Console Architecture

#### Application Structure

```
apps/manager-ui/
├── app/
│   ├── globals.css          # Tailwind styles + custom components
│   ├── layout.tsx           # Root layout with navigation
│   ├── page.tsx             # Main manager console route
│   └── manager/
│       ├── components/
│       │   ├── ManagerConsole.tsx      # Main console component
│       │   ├── TeamScorecardTable.tsx  # Rep performance table
│       │   └── RepDrilldownDrawer.tsx  # Detailed rep analysis
│       └── page.tsx                    # Manager route handler
├── lib/
│   ├── auth.tsx             # MANAGER/EXECUTIVE role auth
│   ├── api-client.ts        # Scorecard API integration
│   └── types.ts             # Manager-specific types
├── components/
│   └── Navigation.tsx       # Manager navigation with surface indicators
└── package.json             # Manager UI dependencies
```

#### Role-Based Access Control

```typescript
enum UserRole {
  ADMIN = 'admin',
  EXECUTIVE = 'executive', // Can access all surfaces
  MANAGER = 'manager', // Can access MANAGER + OPERATOR surfaces
  OPERATOR = 'operator', // Can access OPERATOR surface only
  VIEWER = 'viewer', // Read-only access
}

const surfaceAccessMatrix = {
  OPERATOR: ['admin', 'executive', 'manager', 'operator'],
  MANAGER: ['admin', 'executive', 'manager'],
  EXECUTIVE: ['admin', 'executive'],
};
```

### 2. Team Intelligence Display

#### Team Scorecard Overview

```
┌─────────────────────────────────────────────────┐
│  🏆 Sales Team Alpha Performance (Last 7 days)   │
│  [Team Lead→Contact Rate 68.5% 🟡]               │
│  [Team SLA Breach Rate 6.1% 🟡]                 │
│  [Team Governance Violations 7 🔴]              │
├─────────────────────────────────────────────────┤
│  Overall Performance: YELLOW                    │
└─────────────────────────────────────────────────┘
```

#### Component Structure

```typescript
interface TeamScorecard {
  teamId: string;
  teamName: string;
  metrics: TeamMetric[];
  overallBand: 'GREEN' | 'YELLOW' | 'RED';
  generatedAt: string;
  correlationId: string;
}

function ManagerConsole() {
  const { user } = useAuth();

  // Fetch MANAGER surface scorecard for user's team
  const scorecard = await scorecardApi.getScorecard(
    'tenant-001',
    'MANAGER',
    '7d',
    { teamId: user.teamId }
  );

  return (
    <div>
      <TeamScorecardDisplay scorecard={scorecard} />
      <RepPerformanceTable reps={teamReps} />
    </div>
  );
}
```

### 3. Rep Performance Intelligence

#### Performance Table Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Rep Name       │ Status │ Lead→Contact │ SLA Breach │ Blocked │ Last Activity │ Actions │
├─────────────────┼────────┼──────────────┼────────────┼─────────┼───────────────┼─────────┤
│ Alice Johnson  │ 🟢     │ 87.5% 🟢     │ 1.2% 🟢    │ 0 🟢    │ 2h ago       │ Details │
│ Bob Smith      │ 🟡     │ 72.3% 🟡     │ 4.8% 🟡    │ 2 🟡    │ 4h ago       │ Details │
│ Carol Davis    │ 🔴     │ 45.6% 🔴     │ 12.3% 🔴   │ 5 🔴    │ 1d ago       │ Details │
└─────────────────────────────────────────────────────────────────┘
```

#### Coaching Insights Dashboard

```
┌─────────────────┬─────────────────┬─────────────────┐
│ 🔴 High Priority │ 🟡 Monitor      │ 🟢 Top Performers│
│ 1 Rep           │ 1 Rep           │ 1 Rep           │
│ Needs immediate │ Showing warning │ Performing well │
│ attention       │ signs           │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

#### Table Component Features

- **Sortable Columns**: Click headers to sort by metric values
- **Color-Coded Bands**: Visual performance indicators
- **Last Activity**: Time since last rep action
- **Coaching Signals**: Highlight reps needing attention
- **Drilldown Access**: Click "Details" for full analysis

### 4. Rep Drilldown Intelligence

#### Detailed Performance Analysis

```
┌─────────────────────────────────────────────────┐
│ 🟢 Alice Johnson                      [×]       │
├─────────────────────────────────────────────────┤
│ Team: sales-team-alpha • Last: 2h ago          │
│ Overall Performance: GREEN                     │
├─────────────────────────────────────────────────┤
│ COACHING RECOMMENDATION                        │
│ 🟢 Monitor and Reinforce                        │
│ • Continue monitoring performance               │
│ • Share best practices with team                │
│ • Consider as peer coach                        │
└─────────────────────────────────────────────────┘
```

#### Performance Metrics Breakdown

```
SALES EFFECTIVENESS
• Lead→Contact Rate: 87.5% 🟢
  Source: FSM • Records: 40 • Policy: v1.0.0
• Contact→Qualified Rate: 68.2% 🟢
  Source: FSM • Records: 34 • Policy: v1.0.0

OPERATIONAL EXCELLENCE
• SLA Breach Rate: 1.2% 🟢
  Source: FSM • Records: 83 • Policy: v1.0.0
• Execution Success Rate: 94.1% 🟢
  Source: audit_log • Records: 85 • Policy: v1.0.0

GOVERNANCE & RISK
• Blocked Actions: 0 🟢
  Source: audit_log • Records: 0 • Policy: v1.0.0
```

#### Recent Activity Timeline

```
RECENT ACTIVITY
• Lead contacted (2h ago)
  ID: activity_001 • Duration: 5 min • Outcome: successful

• SLA check (4h ago)
  ID: activity_002 • Status: at_risk • Time remaining: 2h

• Action blocked (1d ago)
  ID: activity_003 • Type: bulk_email • Reason: governance_policy
```

### 5. Coaching Intelligence Engine

#### Automated Coaching Recommendations

```typescript
function getCoachingRecommendation(metrics: RepMetric[]): CoachingInsight {
  const redMetrics = metrics.filter(m => m.band === 'RED').length;
  const yellowMetrics = metrics.filter(m => m.band === 'YELLOW').length;

  if (redMetrics > 0) {
    return {
      priority: 'HIGH',
      title: 'Immediate Intervention Required',
      actions: [
        'Schedule one-on-one coaching session today',
        'Review recent blocked actions and root causes',
        'Provide additional training on SLA management',
        'Monitor closely for next 24-48 hours',
      ],
    };
  } else if (yellowMetrics > 1) {
    return {
      priority: 'MEDIUM',
      title: 'Proactive Coaching Recommended',
      actions: [
        'Schedule coaching session within this week',
        'Review lead contact techniques',
        'Discuss SLA management strategies',
        'Set specific improvement goals',
      ],
    };
  } else {
    return {
      priority: 'LOW',
      title: 'Monitor and Reinforce',
      actions: [
        'Continue monitoring performance',
        'Share best practices with team',
        'Consider as peer coach for struggling reps',
        'Recognize good performance',
      ],
    };
  }
}
```

#### Priority-Based Coaching Queue

- **🔴 HIGH PRIORITY**: Immediate intervention needed
- **🟡 MEDIUM PRIORITY**: Proactive coaching recommended
- **🟢 LOW PRIORITY**: Monitor and reinforce positive behaviors

### 6. API Integration Architecture

#### Scorecard Data Fetching

```typescript
// MANAGER surface scorecard for team overview
const teamScorecard = await scorecardApi.getScorecard(
  tenantId,
  'MANAGER',
  '7d',
  {
    teamId: user.teamId,
    correlationId: generateCorrelationId(),
  }
);

// Individual rep drilldown data
const repDrilldown = await scorecardApi.getRepDrilldown(tenantId, repId, '7d', {
  page: 1,
  limit: 20,
  correlationId: generateCorrelationId(),
});
```

#### Response Processing

```typescript
// Transform API response to UI components
const uiScorecard: TeamScorecard = {
  teamId: apiResponse.tenantId,
  teamName: `Team ${user.teamId}`,
  metrics: apiResponse.sections.flatMap(section => section.metrics),
  overallBand: apiResponse.overallBand,
  generatedAt: new Date().toISOString(),
  correlationId: apiResponse.correlationId,
};
```

### 7. Governance & Security

#### Surface Access Control

```typescript
function RequireSurfaceAccess({ surface, children, fallback }) {
  const { hasSurfaceAccess } = useAuth();

  if (!hasSurfaceAccess(surface)) {
    return fallback || <AccessDenied />;
  }

  return children;
}

// Usage in manager console
<RequireSurfaceAccess surface="MANAGER">
  <ManagerConsole />
</RequireSurfaceAccess>
```

#### Read-Only Intelligence

- **No FSM State Changes**: Managers cannot modify opportunity states
- **No Action Execution**: Managers cannot trigger workflows or actions
- **No CRM Write-Back**: All data flows from authoritative sources only
- **Audit Trail**: All intelligence access is logged with correlation IDs
- **Immutable Evidence**: Scorecard data cannot be modified by managers

## Acceptance Criteria

### Functional Requirements

- [x] **Manager Console UI**: Dedicated surface at `/manager` route
- [x] **Surface Access Control**: MANAGER and EXECUTIVE roles only
- [x] **Team Scorecard Display**: Aggregate team metrics from MANAGER surface
- [x] **Rep Performance Table**: Individual rep metrics with color bands
- [x] **Coaching Insights**: Automated recommendations based on performance
- [x] **Rep Drilldown Drawer**: Detailed analysis for selected reps
- [x] **Read-Only Intelligence**: No execution capabilities for managers

### Technical Requirements

- [x] **Server-Driven Data**: All metrics from authoritative APIs
- [x] **Correlation ID Tracking**: Full audit trail for all requests
- [x] **Performance Optimized**: Efficient data loading and pagination
- [x] **Responsive Design**: Works across desktop and tablet devices
- [x] **Error Handling**: Graceful degradation with clear error states
- [x] **Type Safety**: Full TypeScript coverage with proper interfaces

### Governance Requirements

- [x] **No Business Logic**: Pure data display and coaching insights
- [x] **Immutable Evidence**: Cannot modify or override scorecard data
- [x] **Access Isolation**: Team-scoped data access only
- [x] **Audit Compliance**: All intelligence access is logged
- [x] **Role Boundaries**: Clear separation between observation and execution

## Testing Strategy

### Unit Testing

```typescript
describe('ManagerConsole', () => {
  it('displays team scorecard with correct color bands', () => {
    // Given team scorecard data
    // When component renders
    // Then metrics display with appropriate colors
  });

  it('shows coaching recommendations based on performance', () => {
    // Given rep with RED performance metrics
    // When drilldown opens
    // Then shows HIGH priority coaching recommendations
  });
});

describe('TeamScorecardTable', () => {
  it('sorts reps by performance metrics', () => {
    // Given rep performance data
    // When user clicks column header
    // Then table sorts by selected metric
  });

  it('displays coaching priority indicators', () => {
    // Given mixed performance data
    // When table renders
    // Then shows correct priority counts
  });
});
```

### Integration Testing

```typescript
describe('Manager Console Integration', () => {
  it('loads team data on mount', () => {
    // Given manager with team access
    // When console loads
    // Then fetches and displays team scorecard
  });

  it('enforces surface access control', () => {
    // Given operator role user
    // When accessing manager route
    // Then shows access denied
  });

  it('handles drilldown interactions', () => {
    // Given rep performance table
    // When user clicks rep details
    // Then opens drilldown with correct data
  });
});
```

### API Testing

```typescript
describe('Scorecard API Integration', () => {
  it('fetches MANAGER surface data', () => {
    // Given manager credentials
    // When requesting scorecard
    // Then returns MANAGER surface data
  });

  it('includes team filtering', () => {
    // Given team-scoped request
    // When API called
    // Then returns team-specific metrics
  });
});
```

## Risk Mitigation

### Performance Risks

- **Lazy Loading**: Drilldown data loaded only on demand
- **Pagination**: Large datasets split into manageable chunks
- **Caching**: API responses cached for reasonable periods
- **Optimistic UI**: Immediate feedback during data operations

### Data Consistency Risks

- **Server Authority**: All intelligence from authoritative sources
- **No Client Caching**: Fresh data on each navigation
- **Error Boundaries**: Component failures isolated
- **Graceful Degradation**: Missing data doesn't break interface

### User Experience Risks

- **Loading States**: Clear feedback during data fetching
- **Error Recovery**: Automatic retry for transient failures
- **Progressive Enhancement**: Basic functionality works without JavaScript
- **Keyboard Navigation**: Full accessibility support

## Dependencies

### Runtime Dependencies

- `@neuronx/scorecard-engine` - Backend scorecard calculation engine
- `next.js` - React framework for manager UI
- `react` - UI component library
- `tailwindcss` - Utility-first CSS framework
- `@heroicons/react` - Icon components

### API Dependencies

- `GET /api/scorecards/:tenantId?surface=MANAGER` - Team scorecard data
- `GET /api/scorecards/:tenantId/drilldown` - Rep drilldown data

### Development Dependencies

- `@types/react` - TypeScript definitions
- `vitest` - Testing framework
- `@testing-library/react` - React testing utilities

## Rollback Plan

### Immediate Rollback

1. **Route Removal**: Remove manager route from application
2. **Component Deletion**: Delete manager UI components
3. **API Cleanup**: Remove manager-specific API calls
4. **Navigation Update**: Remove manager links from navigation

### Gradual Rollback

1. **Feature Flag**: Add feature flag to disable manager console
2. **Access Control**: Restrict manager role access temporarily
3. **Fallback UI**: Show maintenance message instead of console
4. **Data Preservation**: Maintain audit logs for troubleshooting

### Complete Removal

1. **Application Deletion**: Remove `apps/manager-ui/` directory
2. **Build Configuration**: Remove manager UI from build pipeline
3. **Documentation**: Update docs to reflect feature removal
4. **Database Cleanup**: Remove manager-specific audit events

## Success Metrics

### User Adoption Metrics

- **Daily Active Managers**: Percentage of managers using console daily
- **Drilldown Usage**: Average number of rep drilldowns per session
- **Coaching Actions**: Correlation between insights and coaching activities
- **Session Duration**: Average time managers spend in console

### Performance Metrics

- **Load Time**: Time to display team scorecard (< 2 seconds)
- **Drilldown Speed**: Time to open rep details (< 1 second)
- **API Response Time**: Average scorecard API response (< 500ms)
- **Error Rate**: Percentage of failed requests (< 1%)

### Business Impact Metrics

- **Coaching Effectiveness**: Improvement in rep performance after coaching
- **Time to Insight**: Reduction in time to identify coaching opportunities
- **Team Performance**: Correlation between console usage and team metrics
- **Manager Productivity**: Time saved through automated insights

## Future Enhancements

### Phase 2 Features (WI-068)

- **Real-time Updates**: WebSocket-based live performance monitoring
- **Custom Coaching Plans**: Manager-defined improvement goals
- **Peer Coaching Network**: Top performers mentoring others
- **Trend Analysis**: Historical performance visualization
- **Predictive Coaching**: AI-driven early warning systems

### Integration Opportunities

- **Executive Dashboard** (WI-064): Cross-team performance aggregation
- **HR Integration**: Performance data feeds into reviews
- **Learning Management**: Targeted training recommendations
- **Communication Tools**: Automated coaching reminders
- **Mobile Access**: Responsive mobile manager interface

This implementation establishes the Manager Console as the cornerstone of team intelligence and coaching, providing managers with actionable insights while maintaining strict governance boundaries and preserving operator execution authority.
