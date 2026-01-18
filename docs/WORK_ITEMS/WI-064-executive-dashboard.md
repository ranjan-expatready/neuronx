# WI-064: Executive Dashboard – Business Confidence Surface

## Objective

Create an Executive Dashboard that provides high-level business confidence indicators for strategic decision making. Executives need to understand system health, governance compliance, revenue integrity, and growth efficiency without getting lost in operational details.

## Context

The Scorecard Engine (WI-065) provides comprehensive metrics, but executives don't have time to parse detailed operational data. They need a high-level view that answers: "Can we confidently scale?" "Are there any fires I need to know about?" "What's our overall business health?"

This dashboard serves as the "confidence layer" - clean, fast, and focused purely on strategic indicators.

## Scope

### In Scope

- **Executive UI Surface**: `/executive` route with EXECUTIVE role access only
- **Business Confidence Cards**: 4 key areas (System Readiness, Governance Risk, Revenue Integrity, Growth Efficiency)
- **High-Level Indicators**: GREEN/YELLOW/RED status only (no raw numbers)
- **Trend Arrows**: Server-calculated 7d vs 30d trends (↑ ↓ →)
- **Evidence Access**: "Why is this red?" links showing aggregate evidence
- **No Individual Data**: No rep names, no specific transactions, no personal information

### Out of Scope

- **Detailed Metrics**: No raw numbers or percentages in main view
- **Operational Controls**: No buttons to change system state
- **Historical Charts**: No time-series graphs or trend lines
- **Manager Features**: No drill-down to individual performance
- **Custom Dashboards**: No user configuration or personalization

## Implementation Details

### 1. Executive Dashboard Architecture

#### Application Structure

```
apps/executive-ui/
├── app/
│   ├── globals.css              ✅ Executive styling + gradients
│   ├── layout.tsx               ✅ Navigation with confidence theme
│   ├── page.tsx                 ✅ EXECUTIVE access gate
│   └── executive/
│       ├── components/
│       │   ├── ExecutiveDashboard.tsx    ✅ Main confidence dashboard
│       │   ├── ConfidenceCard.tsx        ✅ Individual confidence indicators
│       │   └── EvidenceDrawer.tsx        ✅ Evidence explanations
├── lib/
│   ├── auth.tsx                 ✅ EXECUTIVE role enforcement
│   ├── api-client.ts            ✅ Scorecard API integration
│   └── types.ts                 ✅ Executive-specific types
└── components/
│   └── Navigation.tsx           ✅ Executive navigation
```

#### Surface Access Control

```typescript
// EXECUTIVE role required - most restrictive surface
function RequireExecutiveAccess({ children, fallback }) {
  const { hasSurfaceAccess } = useAuth();

  if (!hasSurfaceAccess('EXECUTIVE')) {
    return fallback || <AccessDenied />;
  }

  return children;
}

// Usage in executive dashboard
<RequireExecutiveAccess>
  <ExecutiveDashboard />
</RequireExecutiveAccess>
```

### 2. Business Confidence Framework

#### Confidence Categories

```
🔴 RED:    Immediate executive attention required
🟡 YELLOW: Monitor closely, consider mitigation
🟢 GREEN:  Full confidence to scale and invest
```

#### Core Confidence Areas

1. **System Readiness**: Infrastructure health and operational stability
2. **Governance Risk**: Compliance violations and control effectiveness
3. **Revenue Integrity**: Billing accuracy and financial system health
4. **Growth Efficiency**: Conversion rates and business scalability

#### Confidence Card Design

```
┌─────────────────────────────────────┐
│  🟢 System Readiness ↑             │
│                                     │
│  STRONG                            │
│                                     │
│  All systems operational            │
│  and performing well                │
│                                     │
│  [?] ← Click for evidence          │
└─────────────────────────────────────┘
```

### 3. Executive Scorecard Integration

#### EXECUTIVE Surface API

```typescript
// GET /api/scorecards/:tenantId?surface=EXECUTIVE&timeRange=7d
interface ExecutiveScorecard {
  tenantId: string;
  surface: 'EXECUTIVE';
  sections: ExecutiveSection[];
  overallBand: 'GREEN' | 'YELLOW' | 'RED';
  correlationId: string;
}

interface ExecutiveSection {
  key: string; // 'system_readiness', 'governance_risk', etc.
  title: string; // Human-readable title
  description: string; // One-line explanation
  band: 'GREEN' | 'YELLOW' | 'RED';
  trend: 'up' | 'down' | 'flat'; // 7d vs 30d comparison
  confidence: number; // 0-100 confidence score
  evidence: EvidenceRef; // Reference for evidence drawer
}
```

#### Server-Calculated Trends

```typescript
// Trend calculation on server side
function calculateTrend(
  current: number,
  previous: number
): 'up' | 'down' | 'flat' {
  const change = (current - previous) / previous;

  if (change > 0.05) return 'up'; // >5% improvement
  if (change < -0.05) return 'down'; // >5% degradation
  return 'flat'; // Within 5% variance
}
```

### 4. Evidence Access (Not Drill-Down)

#### Evidence Drawer Philosophy

- **Aggregate Only**: No individual records or personal data
- **Policy References**: Show which policies are being evaluated
- **Supporting Metrics**: High-level supporting data points
- **Correlation IDs**: Full audit traceability
- **No Actions**: Pure information surface

#### Evidence Structure

```typescript
interface EvidenceData {
  evidenceKey: string;
  title: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  summary: string; // Executive-friendly explanation
  details: EvidenceDetail[]; // Supporting data points
  source: string; // Data source system
  policyVersion: string; // Policy version used
  recordCount: number; // Aggregate record count
  correlationIds: string[]; // Audit traceability
  lastUpdated: string;
}

interface EvidenceDetail {
  label: string; // Metric name
  value: string | number; // Current value
  trend?: 'up' | 'down' | 'flat'; // Trend indicator
  explanation?: string; // Why this matters
}
```

### 5. Executive User Experience

#### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  🏆 Business Confidence Dashboard               │
│  Strategic indicators for confident scaling     │
│                                                 │
│  Overall Business Confidence: GREEN 🟢          │
├─────────────────────────────────────────────────┤
│  [System Readiness] [Governance Risk]          │
│  [Revenue Integrity] [Growth Efficiency]       │
├─────────────────────────────────────────────────┤
│  📊 Strategic Implications                      │
│  • GREEN: Full confidence to scale              │
│  • YELLOW: Monitor closely                      │
│  • RED: Immediate attention required            │
└─────────────────────────────────────────────────┘
```

#### Reading Time Target: < 30 seconds

- **Immediate Visual Assessment**: Color-coded confidence bands
- **Quick Status Summary**: One-line explanations per card
- **Optional Deep Dive**: Evidence drawer for detailed understanding
- **Clear Action Framework**: Confidence levels map to strategic decisions

### 6. Governance & Security

#### Read-Only Intelligence

- **No FSM State Changes**: Cannot modify any system state
- **No Action Execution**: No workflow triggers or commands
- **No Data Modification**: Cannot update any business data
- **No Individual Access**: No rep-level or customer-level data
- **Audit Trail**: All evidence access is fully logged

#### Surface Isolation

```typescript
// EXECUTIVE surface access matrix
const surfaceAccess = {
  OPERATOR: ['admin', 'executive', 'manager', 'operator'],
  MANAGER: ['admin', 'executive', 'manager'],
  EXECUTIVE: ['admin', 'executive']                    // Most restrictive
};

// Automatic enforcement
if (!hasSurfaceAccess('EXECUTIVE')) {
  return <AccessDenied />;
}
```

### 7. API Integration Architecture

#### Scorecard Fetching

```typescript
// Executive scorecard loading
const scorecard = await executiveApi.getExecutiveScorecard(
  tenantId,
  '7d', // Default to 7-day view
  { correlationId: generateCorrelationId() }
);

// Transform to confidence cards
const confidenceCards = scorecard.sections.map(section => ({
  title: section.title,
  status: section.band,
  trend: section.trend,
  value: getConfidenceLabel(section.band), // "Strong", "Monitor", "Critical"
  subtitle: section.description,
  evidenceKey: section.key,
}));
```

#### Evidence Loading

```typescript
// Evidence drawer data
const evidence = await executiveApi.getEvidenceDetails(
  tenantId,
  evidenceKey,
  '7d',
  { correlationId: generateCorrelationId() }
);

// Display aggregate evidence only
<EvidenceDrawer
  evidenceData={evidence}
  showAggregateOnly={true}  // No individual records
/>
```

## Acceptance Criteria

### Functional Requirements

- [x] **Executive Dashboard UI**: Dedicated surface at `/executive` route
- [x] **EXECUTIVE Role Access**: Surface access restricted to executive roles
- [x] **Confidence Cards**: 4 key business areas with color-coded status
- [x] **Trend Indicators**: Server-calculated directional arrows
- [x] **Evidence Access**: "Why" links showing aggregate evidence
- [x] **High-Level Only**: No raw metrics or individual data in main view
- [x] **<30 Second Read**: Executive can assess confidence in under 30 seconds

### Technical Requirements

- [x] **Server-Driven Data**: All intelligence from authoritative APIs
- [x] **Correlation ID Tracking**: Full audit trail for evidence access
- [x] **Performance Optimized**: < 2 second load times
- [x] **Responsive Design**: Works on executive devices (tablets, laptops)
- [x] **Error Handling**: Graceful degradation with clear messaging
- [x] **Type Safety**: Full TypeScript coverage for executive types

### Governance Requirements

- [x] **Read-Only Surface**: No system state modifications possible
- [x] **No Individual Data**: Aggregate evidence only
- [x] **Audit Compliance**: All evidence access logged
- [x] **Surface Isolation**: Proper executive-only access control
- [x] **Immutable Evidence**: Cannot modify or override confidence data

## Testing Strategy

### Unit Testing

```typescript
describe('ExecutiveDashboard', () => {
  it('displays confidence cards with correct status colors', () => {
    // Given executive scorecard data
    // When dashboard renders
    // Then confidence cards show appropriate colors and trends
  });

  it('enforces EXECUTIVE surface access', () => {
    // Given non-executive role
    // When accessing executive route
    // Then access denied with appropriate messaging
  });
});

describe('ConfidenceCard', () => {
  it('shows trend indicators correctly', () => {
    // Given card with trend data
    // When component renders
    // Then appropriate trend arrow is displayed
  });

  it('triggers evidence drawer on click', () => {
    // Given confidence card
    // When question mark is clicked
    // Then evidence drawer opens with correct data
  });
});
```

### Integration Testing

```typescript
describe('Executive Dashboard Integration', () => {
  it('loads executive scorecard on mount', () => {
    // Given executive user authentication
    // When dashboard loads
    // Then executive scorecard API is called
  });

  it('displays evidence drawer on card interaction', () => {
    // Given loaded confidence cards
    // When user clicks evidence button
    // Then evidence drawer opens with aggregate data
  });

  it('handles API errors gracefully', () => {
    // Given API failure
    // When dashboard loads
    // Then error state displayed without crashes
  });
});
```

### Governance Testing

```typescript
describe('Executive Surface Governance', () => {
  it('prevents non-executive access', () => {
    // Given manager role user
    // When accessing executive route
    // Then access denied with clear messaging
  });

  it('logs all evidence access', () => {
    // Given evidence drawer access
    // When evidence is viewed
    // Then access is logged with correlation ID
  });

  it('shows no individual data', () => {
    // Given evidence drawer
    // When displaying data
    // Then only aggregate metrics shown
  });
});
```

## Risk Mitigation

### Performance Risks

- **Lazy Loading**: Evidence drawer data loaded only on demand
- **Caching Strategy**: API responses cached for reasonable periods
- **Minimal Bundle**: Executive UI keeps bundle size small
- **Progressive Loading**: Cards appear with staggered animation

### Data Consistency Risks

- **Server Authority**: All confidence data from authoritative sources
- **No Client Calculations**: Trends and status calculated server-side
- **Immutable Evidence**: Evidence references cannot be modified
- **Correlation Tracking**: All data access fully traceable

### User Experience Risks

- **Loading States**: Clear feedback during data fetching
- **Error Recovery**: Automatic retry for transient failures
- **Progressive Enhancement**: Core functionality works without JavaScript
- **Accessibility**: Full keyboard navigation and screen reader support

## Dependencies

### Runtime Dependencies

- `@neuronx/scorecard-engine` - Executive scorecard calculation
- `next.js` - React framework for executive UI
- `react` - UI component library
- `tailwindcss` - Utility-first CSS framework
- `@heroicons/react` - Icon components

### API Dependencies

- `GET /api/scorecards/:tenantId?surface=EXECUTIVE` - Executive scorecard data
- `GET /api/scorecards/:tenantId/evidence` - Evidence details

### Development Dependencies

- `@types/react` - TypeScript definitions
- `vitest` - Testing framework
- `@testing-library/react` - React testing utilities

## Rollback Plan

### Immediate Rollback

1. **Route Removal**: Remove executive route from application
2. **Component Deletion**: Delete executive UI components
3. **API Cleanup**: Remove executive-specific API calls
4. **Navigation Update**: Remove executive links from navigation

### Gradual Rollback

1. **Feature Flag**: Add feature flag to disable executive dashboard
2. **Access Control**: Temporarily restrict executive role access
3. **Fallback UI**: Show maintenance message instead of dashboard
4. **Data Preservation**: Maintain audit logs for troubleshooting

### Complete Removal

1. **Application Deletion**: Remove `apps/executive-ui/` directory
2. **Build Configuration**: Remove executive UI from build pipeline
3. **Documentation**: Update docs to reflect feature removal
4. **Database Cleanup**: Remove executive-specific audit events

## Success Metrics

### User Adoption Metrics

- **Daily Executive Logins**: Percentage of executives accessing dashboard daily
- **Evidence Access Rate**: Percentage of confidence cards where evidence is viewed
- **Session Duration**: Average time executives spend reviewing confidence data
- **Mobile Access**: Percentage of access from tablets/mobile devices

### Performance Metrics

- **Load Time**: Time to display confidence dashboard (< 2 seconds)
- **Evidence Access Time**: Time to open evidence drawer (< 1 second)
- **API Response Time**: Average executive scorecard response (< 500ms)
- **Error Rate**: Percentage of failed executive API calls (< 1%)

### Business Impact Metrics

- **Confidence Assessment Time**: Time for executives to assess business health (< 30 seconds)
- **Strategic Decision Correlation**: Link between confidence indicators and business decisions
- **Issue Discovery Rate**: Percentage of business issues caught by confidence monitoring
- **Executive Productivity**: Time saved through automated confidence assessment

## Future Enhancements

### Phase 2 Features (WI-068)

- **Real-time Confidence Updates**: WebSocket-based live indicator updates
- **Confidence History**: Trend visualization over time periods
- **Custom Confidence Areas**: Executive-defined business confidence categories
- **Alert Integration**: Automated notifications for confidence changes
- **Executive Briefing**: PDF reports with confidence data

### Integration Opportunities

- **Board Reporting**: Automated confidence reports for board meetings
- **Investor Communications**: Confidence data for investor updates
- **Risk Management**: Integration with enterprise risk systems
- **Compliance Reporting**: Confidence data for regulatory requirements
- **M&A Due Diligence**: Confidence assessment for acquisition targets

This implementation provides executives with the high-level business confidence they need to make strategic scaling decisions, while maintaining strict governance boundaries and ensuring all intelligence is evidence-backed and audit-compliant.
