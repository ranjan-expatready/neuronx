# WI-067: Operator Intelligence Overlay (Scorecards + Drilldowns)

## Objective

Transform the Operator Console from a basic task UI into an intelligent sales cockpit by integrating scorecard metrics and drill-down capabilities. Enable operators to understand system performance and make data-driven decisions without violating governance boundaries.

## Context

The Operator Console currently provides basic task management and work queue functionality. However, operators lack visibility into system performance, conversion metrics, and operational health. The scorecard engine (WI-065) provides comprehensive analytics, but this intelligence is not accessible to operators.

This work item bridges that gap by adding intelligence overlays that surface key metrics and enable drill-down into evidence, creating immediate perceived value without architectural risk.

## Scope

### In Scope

- **ScorecardStrip Component**: Horizontal strip displaying key metrics with color-coded performance bands
- **ScorecardDrilldownDrawer**: Modal drawer showing detailed metric evidence and contributing records
- **API Integration**: Server-driven data fetching with proper correlation ID propagation
- **OPERATOR Surface**: Metrics specifically curated for front-line operators
- **7-Day Time Range**: Default view focusing on recent performance
- **Evidence Links**: Every metric includes source attribution and drill-down capability

### Out of Scope

- MANAGER or EXECUTIVE dashboards (separate work items)
- Custom metric definitions or calculations
- Real-time metric updates (polling-based refresh)
- Advanced filtering or time range selection
- Metric export or sharing functionality
- Chart visualizations (tables only)

## Implementation Details

### 1. Scorecard Strip Component

#### Location & Layout

```
┌─────────────────────────────────────────────────┐
│  UAT Banner (when applicable)                   │
├─────────────────────────────────────────────────┤
│  🏆 Scorecard Strip (Last 7 days)               │
│  [Lead→Contact 85.5% 🟢] [SLA Breach 1.8% 🟢]   │
│  [Voice Compliance 96.2% 🟢] [Retry Rate 4.1% 🟡]│
└─────────────────────────────────────────────────┘
```

#### Component Structure

```typescript
interface ScorecardStripProps {
  tenantId: string;
  onMetricClick?: (metric: ScorecardMetric) => void;
}

function ScorecardStrip({ tenantId, onMetricClick }) {
  // Fetches /api/scorecards/:tenantId?surface=OPERATOR&timeRange=7d
  // Displays first 5 metrics with color-coded bands
  // Clickable to trigger drill-down
}
```

#### Metric Display Rules

- **Maximum 5 metrics** displayed (configurable)
- **Color coding**: 🟢 GREEN, 🟡 YELLOW, 🔴 RED
- **Format**: "Label: Value Unit" (e.g., "Lead→Contact: 85.5%")
- **Click handling**: Opens drill-down drawer with full metric details

### 2. Scorecard Drilldown Drawer

#### Drawer Layout

```
┌─────────────────────────────────────────────────┐
│ 🟢 Lead→Contact Rate (85.5%)          [×]       │
├─────────────────────────────────────────────────┤
│ Source: FSM | Policy: v1.0.0 | Records: 200    │
├─────────────────────────────────────────────────┤
│ CONTRIBUTING RECORDS                           │
│                                                 │
│ • Opportunity ABC123 | contacted | 2h ago      │
│   Details: stage=CONTACT_ATTEMPTING, value=50000│
│                                                 │
│ • Opportunity DEF456 | contacted | 4h ago      │
│   Details: stage=CONTACT_ATTEMPTING, value=75000│
│                                                 │
│ [Previous]  Page 1 of 5  [Next]                 │
└─────────────────────────────────────────────────┘
```

#### Component Structure

```typescript
interface ScorecardDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  metric: ScorecardMetric | null;
}

function ScorecardDrilldownDrawer({ isOpen, onClose, tenantId, metric }) {
  // Fetches /api/scorecards/:tenantId/drilldown?metricKey=...
  // Displays metric evidence header + paginated records
  // Shows source, policy version, correlation IDs
}
```

#### Evidence Display

- **Metric header**: Label, current value, performance band
- **Evidence metadata**: Source system, policy version, record count
- **Records table**: ID, type, timestamp, key details
- **Pagination**: 20 records per page with navigation controls

### 3. API Integration

#### Scorecard Fetching

```typescript
// GET /api/scorecards/:tenantId
const response = await scorecardApi.getScorecard(tenantId, 'OPERATOR', '7d', {
  correlationId: generateCorrelationId(),
  includeDetails: true,
});
```

#### Drill-down Fetching

```typescript
// GET /api/scorecards/:tenantId/drilldown
const response = await scorecardApi.getMetricDrilldown(
  tenantId,
  metricKey,
  '7d',
  {
    correlationId: generateCorrelationId(),
    page: 1,
    limit: 20,
  }
);
```

#### Response Handling

```typescript
if (result.success) {
  setScorecardData(result.data);
  // Display metrics with proper bands
} else {
  setError(result.error);
  // Show neutral/error state
}
```

### 4. Operator Console Integration

#### Component Hierarchy

```
OperatorConsole
├── UatBanner (conditional)
├── ScorecardStrip (new)
├── ReadinessBanner
├── WorkQueuePanel
├── DetailPanel
│   ├── ActionBar
│   └── ScorecardDrilldownDrawer (modal)
```

#### State Management

```typescript
function OperatorConsole() {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const handleMetricClick = metric => {
    setSelectedMetric(metric);
    setIsDrilldownOpen(true);
  };

  const handleCloseDrilldown = () => {
    setIsDrilldownOpen(false);
    setSelectedMetric(null);
  };
}
```

### 5. Governance & Security

#### Server-Driven Only

- **No client calculations**: All values come from API responses
- **No metric inference**: UI renders exactly what server provides
- **No business logic**: Pure display and interaction handling

#### Correlation ID Propagation

```typescript
// Every API call includes correlation ID
const correlationId = generateCorrelationId();

// Logged in development mode for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('Scorecard correlation ID:', correlationId);
}
```

#### Error Handling

- **Loading states**: Skeleton UI during data fetching
- **Error states**: Neutral display with error messaging
- **Graceful degradation**: Missing data doesn't break the UI
- **Retry logic**: Automatic retry for transient failures

## Acceptance Criteria

### Functional Requirements

- [x] **Scorecard Strip**: Displays key metrics with color-coded bands
- [x] **Drill-down Drawer**: Shows detailed evidence for clicked metrics
- [x] **API Integration**: Proper server communication with correlation IDs
- [x] **OPERATOR Surface**: Metrics curated for front-line operators
- [x] **7-Day Default**: Focus on recent performance trends
- [x] **Evidence Links**: Complete source attribution and timestamps

### Technical Requirements

- [x] **No Business Logic**: Pure server-driven data display
- [x] **Type Safety**: Full TypeScript coverage with proper interfaces
- [x] **Error Handling**: Graceful degradation for API failures
- [x] **Performance**: Sub-second rendering, efficient pagination
- [x] **Accessibility**: Keyboard navigation and screen reader support
- [x] **Responsive**: Works on different screen sizes

### Governance Requirements

- [x] **Correlation IDs**: Every API call includes traceable correlation
- [x] **Audit Trail**: All interactions are logged for compliance
- [x] **Tenant Isolation**: Proper tenant headers on all requests
- [x] **No Mock Data**: All data comes from production APIs
- [x] **Immutable Evidence**: Evidence references cannot be modified

## Testing Strategy

### Unit Testing

```typescript
describe('ScorecardStrip', () => {
  it('displays metrics with correct color bands', () => {
    // Given scorecard data with GREEN/YELLOW/RED metrics
    // When component renders
    // Then correct colors and icons are displayed
  });

  it('handles loading and error states', () => {
    // Given API failure
    // When component renders
    // Then shows error message without breaking
  });
});

describe('ScorecardDrilldownDrawer', () => {
  it('displays paginated records correctly', () => {
    // Given drill-down data with multiple pages
    // When user navigates pages
    // Then correct records are displayed
  });

  it('shows evidence metadata', () => {
    // Given metric with evidence
    // When drawer opens
    // Then source, policy version, and record count are visible
  });
});
```

### Integration Testing

```typescript
describe('Operator Console Integration', () => {
  it('scorecard strip appears above work queue', () => {
    // Given operator console loads
    // When page renders
    // Then scorecard strip is visible and functional
  });

  it('drill-down opens on metric click', () => {
    // Given scorecard strip with metrics
    // When user clicks a metric
    // Then drill-down drawer opens with correct data
  });
});
```

### API Testing

```typescript
describe('Scorecard API Integration', () => {
  it('fetches scorecard data with correlation ID', () => {
    // Given tenant ID and parameters
    // When API is called
    // Then request includes proper headers and correlation ID
  });

  it('handles API errors gracefully', () => {
    // Given API returns error
    // When component renders
    // Then error state is displayed without crashes
  });
});
```

## Risk Mitigation

### Performance Risks

- **Lazy Loading**: Drill-down data loaded only when requested
- **Pagination**: Large datasets paginated to prevent memory issues
- **Caching**: API responses cached for reasonable periods
- **Optimistic UI**: Immediate feedback during loading states

### Data Consistency Risks

- **Server Authority**: All data comes from authoritative sources
- **No Caching**: Fresh data on each page load (acceptable for dashboard)
- **Error Boundaries**: Component failures don't affect entire console
- **Graceful Degradation**: Missing metrics don't break the interface

### User Experience Risks

- **Loading States**: Clear feedback during data fetching
- **Error Recovery**: Automatic retry for transient failures
- **Progressive Enhancement**: Basic functionality works without JavaScript
- **Keyboard Navigation**: Full accessibility support

## Dependencies

### Runtime Dependencies

- `@neuronx/scorecard-engine` - Backend scorecard calculation engine
- `react` - UI framework
- `next.js` - Application framework
- `tailwindcss` - Styling framework

### API Dependencies

- `GET /api/scorecards/:tenantId` - Scorecard data endpoint
- `GET /api/scorecards/:tenantId/drilldown` - Drill-down data endpoint

### Development Dependencies

- `@types/react` - TypeScript definitions
- `jest` - Testing framework
- `@testing-library/react` - React testing utilities

## Rollback Plan

### Immediate Rollback

1. **Component Removal**: Remove ScorecardStrip and ScorecardDrilldownDrawer imports
2. **UI Cleanup**: Remove scorecard-related JSX from OperatorConsole
3. **API Cleanup**: Remove scorecardApi methods from api-client.ts
4. **File Deletion**: Remove scorecard component files

### Gradual Rollback

1. **Feature Flag**: Add feature flag to conditionally render scorecard components
2. **API Fallback**: Graceful degradation when scorecard APIs are unavailable
3. **User Communication**: Notify users of temporary feature unavailability
4. **Data Preservation**: Maintain audit logs for troubleshooting

### Complete Removal

1. **Component Files**: Delete ScorecardStrip.tsx and ScorecardDrilldownDrawer.tsx
2. **API Methods**: Remove scorecardApi from api-client.ts
3. **State Cleanup**: Remove scorecard-related state from OperatorConsole
4. **Documentation**: Update docs to reflect feature removal

## Success Metrics

### User Adoption Metrics

- **Click-through Rate**: Percentage of operators clicking scorecard metrics
- **Drill-down Usage**: Average number of drill-down sessions per operator
- **Session Duration**: Time spent viewing scorecard information
- **Feature Retention**: Percentage of sessions using scorecard features

### Performance Metrics

- **Load Time**: Time to display scorecard strip (< 500ms)
- **Drill-down Speed**: Time to open drawer with data (< 1s)
- **Error Rate**: Percentage of failed scorecard API calls (< 1%)
- **Memory Usage**: Additional memory footprint (< 10MB)

### Business Impact Metrics

- **Decision Quality**: Correlation between scorecard usage and successful outcomes
- **Time to Insight**: Reduction in time to identify performance issues
- **Operator Efficiency**: Improvement in task completion rates
- **System Understanding**: Increase in operator-reported system comprehension

## Future Enhancements

### Phase 2 Features (WI-068)

- **Real-time Updates**: WebSocket-based live metric updates
- **Metric Customization**: User-configurable metric selection
- **Trend Visualization**: Mini charts showing metric evolution
- **Alert Integration**: Visual indicators for metric threshold breaches

### Integration Opportunities

- **Manager Dashboard** (WI-063): Team-level scorecard aggregation
- **Executive Dashboard** (WI-064): Cross-tenant performance insights
- **Mobile Support**: Responsive scorecard access for mobile operators
- **Notification System**: Push notifications for critical metric changes

This implementation provides immediate value by transforming the Operator Console into an intelligence-driven interface, enabling operators to understand system performance and make data-driven decisions while maintaining strict governance and architectural purity.
