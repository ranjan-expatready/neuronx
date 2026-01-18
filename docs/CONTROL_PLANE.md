# Control Plane Specification

## Overview

The Control Plane is NeuronX's configuration management system that enables safe, auditable, and tenant-aware configuration of business rules, workflows, and system behavior. It provides a secure interface for Revenue Operations teams to customize NeuronX without code changes.

## Core Responsibilities

### Configuration Management

- **Versioned Configurations**: All configuration changes are versioned and immutable
- **Hierarchical Resolution**: Global → Tenant → Workspace inheritance
- **Validation**: Schema-based validation with business rule enforcement
- **Audit Trail**: Complete history of who changed what and when
- **Rollback**: Safe rollback to previous configuration versions

### Safe Rollout

- **Draft Mode**: Test configurations before activation
- **Gradual Rollout**: Percentage-based rollout to workspaces/tenants
- **Monitoring**: Real-time monitoring of configuration impact
- **Automatic Rollback**: Health-based automatic rollback on failures
- **Approval Workflows**: Multi-step approval for critical changes

### Multi-Tenant Isolation

- **Tenant Boundaries**: Strict isolation between tenant configurations
- **Workspace Scoping**: Department/unit-specific configuration overrides
- **Security**: Role-based access control for configuration changes
- **Performance**: Efficient configuration resolution and caching

## Configuration Schema

### Configuration Types

#### Business Rules Configuration

```typescript
interface BusinessRulesConfig {
  leadScoring: {
    algorithm: 'v1' | 'v2' | 'v3';
    weights: {
      industry: number;
      companySize: number;
      engagement: number;
      behavior: number;
    };
    thresholds: {
      hot: number; // > 80
      warm: number; // 40-80
      cold: number; // < 40
    };
  };
  workflowTriggers: {
    autoAssignment: boolean;
    nurtureSequences: boolean;
    qualificationChecks: boolean;
  };
  notificationRules: {
    emailAlerts: boolean;
    slackNotifications: boolean;
    priorityThreshold: number;
  };
}
```

#### System Limits Configuration

```typescript
interface SystemLimitsConfig {
  rateLimits: {
    apiRequestsPerMinute: number;
    leadImportsPerHour: number;
    emailSendsPerDay: number;
  };
  quotas: {
    activeWorkflows: number;
    concurrentUsers: number;
    storedEvents: number;
  };
  timeouts: {
    apiRequestTimeout: number; // seconds
    workflowStepTimeout: number; // minutes
    adapterCallTimeout: number; // seconds
  };
}
```

#### Integration Configuration

```typescript
interface IntegrationConfig {
  adapters: {
    [adapterName: string]: {
      enabled: boolean;
      credentials: Record<string, string>;
      mappings: Record<string, string>;
      limits: {
        rateLimit: number;
        concurrency: number;
      };
    };
  };
  webhooks: {
    endpoints: Array<{
      url: string;
      events: string[];
      secret: string;
      retries: number;
    }>;
  };
}
```

### Schema Validation with Zod

```typescript
import { z } from 'zod';

// Business rules schema
export const BusinessRulesSchema = z.object({
  leadScoring: z.object({
    algorithm: z.enum(['v1', 'v2', 'v3']),
    weights: z
      .object({
        industry: z.number().min(0).max(1),
        companySize: z.number().min(0).max(1),
        engagement: z.number().min(0).max(1),
        behavior: z.number().min(0).max(1),
      })
      .refine(
        weights => Object.values(weights).reduce((sum, w) => sum + w, 0) === 1,
        'Weights must sum to 1'
      ),
    thresholds: z
      .object({
        hot: z.number().min(0).max(100),
        warm: z.number().min(0).max(100),
        cold: z.number().min(0).max(100),
      })
      .refine(
        thresholds =>
          thresholds.hot > thresholds.warm && thresholds.warm > thresholds.cold,
        'Thresholds must be in descending order'
      ),
  }),
  workflowTriggers: z.object({
    autoAssignment: z.boolean(),
    nurtureSequences: z.boolean(),
    qualificationChecks: z.boolean(),
  }),
  notificationRules: z.object({
    emailAlerts: z.boolean(),
    slackNotifications: z.boolean(),
    priorityThreshold: z.number().min(0).max(100),
  }),
});

// Complete tenant config schema
export const TenantConfigSchema = z.object({
  businessRules: BusinessRulesSchema,
  systemLimits: SystemLimitsSchema,
  integrations: IntegrationSchema,
  metadata: z.object({
    version: z.string(),
    createdBy: z.string(),
    createdAt: z.date(),
    description: z.string().optional(),
  }),
});
```

## Configuration Lifecycle

### 1. Draft Creation

```typescript
// Create draft configuration
const draft = await controlPlane.createDraft({
  tenantId: 'tenant-123',
  type: 'businessRules',
  config: {
    leadScoring: {
      algorithm: 'v3',
      weights: {
        industry: 0.4,
        companySize: 0.3,
        engagement: 0.2,
        behavior: 0.1,
      },
      thresholds: { hot: 85, warm: 60, cold: 30 },
    },
  },
  description: 'Updated lead scoring algorithm with improved weights',
});
```

### 2. Validation

```typescript
// Validate against schema and business rules
const validation = await controlPlane.validateDraft(draft.id);

// Validation results
{
  valid: true,
  errors: [],
  warnings: [
    'Lead scoring algorithm change may affect existing qualified leads'
  ],
  impact: {
    affectedEntities: 1250,
    riskLevel: 'medium'
  }
}
```

### 3. Review & Approval

```typescript
// Submit for approval
await controlPlane.submitForReview(draft.id, {
  reviewers: ['revenue-ops-lead', 'engineering-manager'],
  requiredApprovals: 2,
  autoApproveAfter: '7 days',
});

// Approve draft
await controlPlane.approveDraft(draft.id, {
  reviewerId: 'revenue-ops-lead',
  comments: 'Weights look good, proceeding with rollout',
});
```

### 4. Gradual Rollout

```typescript
// Start gradual rollout
const rollout = await controlPlane.startRollout(draft.id, {
  strategy: 'percentage',
  targets: [
    { workspaceId: 'workspace-1', percentage: 10 },
    { workspaceId: 'workspace-2', percentage: 25 },
    { workspaceId: 'workspace-3', percentage: 50 },
  ],
  monitoring: {
    metrics: ['lead_score_accuracy', 'workflow_completion_rate'],
    rollbackThreshold: 0.05, // 5% degradation triggers rollback
  },
});
```

### 5. Full Activation

```typescript
// Activate configuration for all workspaces
await controlPlane.activateConfig(draft.id, {
  comment: 'Configuration performing well in rollout, activating for all users',
});
```

## Tenant Resolution Algorithm

### Hierarchical Resolution

```typescript
function resolveConfig<T>(
  tenantId: string,
  workspaceId?: string,
  key: string
): T {
  // 1. Check workspace-specific override
  if (workspaceId) {
    const workspaceConfig = getWorkspaceConfig(tenantId, workspaceId, key);
    if (workspaceConfig) return workspaceConfig;
  }

  // 2. Check tenant-level configuration
  const tenantConfig = getTenantConfig(tenantId, key);
  if (tenantConfig) return tenantConfig;

  // 3. Fall back to global defaults
  return getGlobalConfig(key);
}
```

### Caching Strategy

```typescript
// Multi-level caching for performance
class ConfigCache {
  private localCache = new Map<string, CachedConfig>();
  private redisCache: Redis;

  async get(tenantId: string, workspaceId: string, key: string) {
    const cacheKey = `${tenantId}:${workspaceId}:${key}`;

    // 1. Check local cache (request-scoped)
    const localValue = this.localCache.get(cacheKey);
    if (localValue && !this.isExpired(localValue)) {
      return localValue.data;
    }

    // 2. Check Redis cache (shared across instances)
    const redisValue = await this.redisCache.get(cacheKey);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      this.localCache.set(cacheKey, parsed);
      return parsed.data;
    }

    // 3. Resolve from database
    const resolved = await this.resolveFromDatabase(tenantId, workspaceId, key);

    // Cache for future requests
    const cached: CachedConfig = {
      data: resolved,
      expiresAt: Date.now() + CACHE_TTL,
    };

    this.localCache.set(cacheKey, cached);
    await this.redisCache.setex(
      cacheKey,
      CACHE_TTL / 1000,
      JSON.stringify(cached)
    );

    return resolved;
  }
}
```

## Audit and Compliance

### Audit Trail Structure

```sql
CREATE TABLE config_audit (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID,
  config_type VARCHAR(50) NOT NULL,
  config_key VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, ROLLBACK
  old_value JSONB,
  new_value JSONB,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(20) NOT NULL, -- USER, SYSTEM, API
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  correlation_id UUID,
  ip_address INET,
  user_agent TEXT,
  reason TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_config_audit_tenant_timestamp ON config_audit(tenant_id, timestamp DESC);
CREATE INDEX idx_config_audit_actor ON config_audit(actor_id, timestamp DESC);
```

### Audit Query Capabilities

```typescript
// Query audit trail
const auditTrail = await controlPlane.getAuditTrail({
  tenantId: 'tenant-123',
  configType: 'businessRules',
  dateRange: { from: '2024-01-01', to: '2024-01-31' },
  actorId: 'user-456',
  action: 'UPDATE',
});

// Compliance reporting
const complianceReport = await controlPlane.generateComplianceReport({
  tenantId: 'tenant-123',
  reportType: 'GDPR',
  dateRange: { from: '2024-01-01', to: '2024-12-31' },
});
```

## Rollout Strategies

### Percentage-Based Rollout

```typescript
const rollout = {
  strategy: 'percentage',
  config: {
    initialPercentage: 5,
    incrementPercentage: 5,
    maxPercentage: 100,
    evaluationPeriodMinutes: 30,
    successCriteria: {
      errorRateThreshold: 0.01, // 1% error rate
      performanceDegradation: 0.05, // 5% performance drop
    },
  },
};
```

### Workspace-Based Rollout

```typescript
const rollout = {
  strategy: 'workspace',
  config: {
    targetWorkspaces: ['workspace-1', 'workspace-2', 'workspace-3'],
    rolloutOrder: 'sequential', // parallel, sequential, custom
    monitoringPerWorkspace: true,
  },
};
```

### Time-Based Rollout

```typescript
const rollout = {
  strategy: 'time',
  config: {
    startTime: '2024-02-01T09:00:00Z',
    durationHours: 24,
    checkpoints: [
      { time: '25%', percentage: 10 },
      { time: '50%', percentage: 25 },
      { time: '75%', percentage: 50 },
      { time: '100%', percentage: 100 },
    ],
  },
};
```

## Monitoring and Alerting

### Rollout Metrics

- **Configuration Adoption**: Percentage of tenants/workspaces using new config
- **Performance Impact**: Response times, error rates, resource utilization
- **Business Impact**: Lead scoring accuracy, workflow completion rates
- **User Feedback**: Error reports, support tickets related to config changes

### Automated Rollback Triggers

```typescript
const rollbackTriggers = {
  errorRate: {
    threshold: 0.05, // 5% error rate
    window: '5 minutes',
    consecutivePeriods: 3,
  },
  performance: {
    metric: 'p95_response_time',
    threshold: 1.5, // 50% increase
    window: '10 minutes',
  },
  business: {
    metric: 'lead_score_accuracy',
    threshold: 0.8, // Drop below 80%
    window: '15 minutes',
  },
};
```

### Alert Configuration

```typescript
const alerts = {
  rollout: {
    channels: ['slack', 'email', 'pagerdut'],
    severity: 'high',
    message:
      'Configuration rollout {{rolloutId}} triggered automatic rollback due to {{trigger}}',
  },
  monitoring: {
    channels: ['slack'],
    severity: 'medium',
    message:
      'Configuration rollout {{rolloutId}} showing {{metric}} degradation',
  },
};
```

## API Interface

### REST API Endpoints

```
POST   /api/v1/control-plane/drafts              # Create draft
GET    /api/v1/control-plane/drafts/{id}         # Get draft
PUT    /api/v1/control-plane/drafts/{id}         # Update draft
POST   /api/v1/control-plane/drafts/{id}/validate # Validate draft
POST   /api/v1/control-plane/drafts/{id}/review   # Submit for review
POST   /api/v1/control-plane/drafts/{id}/approve  # Approve draft
POST   /api/v1/control-plane/drafts/{id}/rollout  # Start rollout
POST   /api/v1/control-plane/drafts/{id}/activate # Activate config
GET    /api/v1/control-plane/config/{key}        # Resolve config
GET    /api/v1/control-plane/audit               # Query audit trail
```

### SDK Interface

```typescript
interface ControlPlaneService {
  // Draft management
  createDraft(config: ConfigInput): Promise<Draft>;
  updateDraft(id: string, config: ConfigInput): Promise<Draft>;
  validateDraft(id: string): Promise<ValidationResult>;
  submitForReview(id: string, options: ReviewOptions): Promise<void>;

  // Rollout management
  startRollout(draftId: string, strategy: RolloutStrategy): Promise<Rollout>;
  getRolloutStatus(rolloutId: string): Promise<RolloutStatus>;
  pauseRollout(rolloutId: string): Promise<void>;
  rollbackRollout(rolloutId: string, reason: string): Promise<void>;

  // Configuration resolution
  resolveConfig<T>(key: string, context: TenantContext): Promise<T>;

  // Audit and compliance
  getAuditTrail(query: AuditQuery): Promise<AuditEntry[]>;
  generateComplianceReport(query: ComplianceQuery): Promise<Report>;
}
```

## Phase 4A Configuration Schema

### Lead Qualification & Opportunity Management

```typescript
interface Phase4AConfig {
  qualification: {
    threshold: number; // Minimum score for qualification (0-100)
    rules: {
      requireEmail: boolean; // Must have valid email
      requirePhone: boolean; // Must have phone number
      industryPriority: Record<string, number>; // Industry-specific multipliers
      companySizeMin: number; // Minimum company size
    };
  };
  routing: {
    countryTeamMap: Record<string, string>; // Country -> team mapping
    defaultTeam: string; // Fallback team for unmapped countries
    capacityLimits: {
      maxLeadsPerRep: number; // Maximum active leads per rep
      maxLeadsPerTeam: number; // Maximum active leads per team
    };
  };
  sla: {
    windowMinutes: number; // SLA window for qualified leads
    warningThreshold: number; // Minutes before escalation warning
    gracePeriodMinutes: number; // Grace period after SLA expiry
  };
  escalation: {
    actionType: 'task' | 'message' | 'notification';
    recipients: string[]; // Who to notify for escalations
    autoCreateTask: boolean; // Create task automatically
    taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  };
  scoring: {
    weights: {
      industry: number; // Industry relevance weight
      companySize: number; // Company size weight
      engagement: number; // Engagement signals weight
      behavior: number; // Behavioral data weight
      conversation: number; // Conversation quality weight
    };
    conversationSignals: {
      responseTimeWeight: number; // How much response time affects score
      messageLengthWeight: number; // Message length impact
      sentimentWeight: number; // Sentiment analysis weight
      topicRelevanceWeight: number; // Topic relevance to business
    };
  };
}
```

### Zod Schema Validation

```typescript
import { z } from 'zod';

// Phase 4A configuration schema
export const Phase4AConfigSchema = z.object({
  qualification: z.object({
    threshold: z.number().min(0).max(100),
    rules: z.object({
      requireEmail: z.boolean(),
      requirePhone: z.boolean(),
      industryPriority: z.record(z.string(), z.number().min(0).max(2)),
      companySizeMin: z.number().min(0),
    }),
  }),
  routing: z.object({
    countryTeamMap: z.record(z.string(), z.string()),
    defaultTeam: z.string().min(1),
    capacityLimits: z.object({
      maxLeadsPerRep: z.number().min(1),
      maxLeadsPerTeam: z.number().min(1),
    }),
  }),
  sla: z
    .object({
      windowMinutes: z.number().min(1).max(1440), // Max 24 hours
      warningThreshold: z.number().min(1),
      gracePeriodMinutes: z.number().min(0),
    })
    .refine(
      data => data.warningThreshold < data.windowMinutes,
      'Warning threshold must be less than SLA window'
    ),
  escalation: z.object({
    actionType: z.enum(['task', 'message', 'notification']),
    recipients: z.array(z.string().email()),
    autoCreateTask: z.boolean(),
    taskPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  }),
  scoring: z.object({
    weights: z
      .object({
        industry: z.number().min(0).max(1),
        companySize: z.number().min(0).max(1),
        engagement: z.number().min(0).max(1),
        behavior: z.number().min(0).max(1),
        conversation: z.number().min(0).max(1),
      })
      .refine(
        weights =>
          Math.abs(Object.values(weights).reduce((sum, w) => sum + w, 0) - 1) <
          0.001,
        'Scoring weights must sum to 1.0'
      ),
    conversationSignals: z.object({
      responseTimeWeight: z.number().min(0).max(1),
      messageLengthWeight: z.number().min(0).max(1),
      sentimentWeight: z.number().min(0).max(1),
      topicRelevanceWeight: z.number().min(0).max(1),
    }),
  }),
});
```

### Rollout Notes

- **Gradual Rollout Recommended**: Start with 10% of leads for qualification/opportunity creation
- **Monitoring Required**: Watch for scoring accuracy and routing distribution
- **Fallback Behavior**: All features must have safe defaults when config is missing
- **Audit Trail**: All configuration changes must be logged with business impact assessment

## Phase 4B Configuration Schema

### AI-Enhanced Scoring Configuration

```typescript
interface Phase4BScoringConfig {
  enhancedWeights: {
    baseScore: number; // Weight for original scoring (0-1)
    sentimentScore: number; // Weight for conversation sentiment (0-1)
    timingScore: number; // Weight for interaction timing (0-1)
    frequencyScore: number; // Weight for interaction frequency (0-1)
    industryAdjustment: number; // Industry-specific adjustment factor (0.8-1.2)
  };
  sentimentThreshold: {
    positive: number; // Sentiment score threshold for positive (0-1)
    negative: number; // Sentiment score threshold for negative (0-1)
  };
  conversationSignals: {
    responseTimeWeight: number; // How much response time affects score (0-1)
    messageLengthWeight: number; // Message length impact on score (0-1)
    topicRelevanceWeight: number; // Topic relevance to business (0-1)
  };
}
```

### Predictive Routing Configuration

```typescript
interface Phase4BRoutingConfig {
  predictionWeights: {
    leadScore: number; // Weight for lead qualification score (0-1)
    industryMatch: number; // Weight for industry expertise (0-1)
    performanceHistory: number; // Weight for past conversion rates (0-1)
    capacityLoad: number; // Weight for current workload (0-1)
    geographicMatch: number; // Weight for regional alignment (0-1)
  };
  confidenceThreshold: {
    high: number; // High confidence threshold (0-1)
    medium: number; // Medium confidence threshold (0-1)
    low: number; // Low confidence threshold (0-1)
  };
  teamAttributes: Record<
    string,
    {
      industryExpertise: string[]; // Industries this team specializes in
      performanceScore: number; // Historical performance rating (0-1)
      capacityLimit: number; // Maximum concurrent leads
      regions: string[]; // Geographic regions served
    }
  >;
}
```

### AI Explainability Configuration

```typescript
interface Phase4BExplainabilityConfig {
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  confidenceDisplay: boolean; // Show confidence scores in explanations
  factorContribution: boolean; // Show contribution of each factor
  reasoningTemplates: {
    highConfidence: string; // Template for high confidence explanations
    mediumConfidence: string; // Template for medium confidence explanations
    lowConfidence: string; // Template for low confidence explanations
  };
}
```

### Zod Schema Validation

```typescript
import { z } from 'zod';

// Phase 4B enhanced scoring schema
export const Phase4BScoringSchema = z.object({
  enhancedWeights: z
    .object({
      baseScore: z.number().min(0).max(1),
      sentimentScore: z.number().min(0).max(1),
      timingScore: z.number().min(0).max(1),
      frequencyScore: z.number().min(0).max(1),
      industryAdjustment: z.number().min(0.8).max(1.2),
    })
    .refine(
      weights =>
        Math.abs(Object.values(weights).reduce((sum, w) => sum + w, 0) - 1) <
        0.001,
      'Enhanced weights must sum to 1.0'
    ),
  sentimentThreshold: z.object({
    positive: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
  }),
  conversationSignals: z.object({
    responseTimeWeight: z.number().min(0).max(1),
    messageLengthWeight: z.number().min(0).max(1),
    topicRelevanceWeight: z.number().min(0).max(1),
  }),
});

// Phase 4B predictive routing schema
export const Phase4BRoutingSchema = z.object({
  predictionWeights: z
    .object({
      leadScore: z.number().min(0).max(1),
      industryMatch: z.number().min(0).max(1),
      performanceHistory: z.number().min(0).max(1),
      capacityLoad: z.number().min(0).max(1),
      geographicMatch: z.number().min(0).max(1),
    })
    .refine(
      weights =>
        Math.abs(Object.values(weights).reduce((sum, w) => sum + w, 0) - 1) <
        0.001,
      'Prediction weights must sum to 1.0'
    ),
  confidenceThreshold: z
    .object({
      high: z.number().min(0).max(1),
      medium: z.number().min(0).max(1),
      low: z.number().min(0).max(1),
    })
    .refine(
      thresholds =>
        thresholds.high > thresholds.medium &&
        thresholds.medium > thresholds.low,
      'Confidence thresholds must be in descending order'
    ),
  teamAttributes: z.record(
    z.string(),
    z.object({
      industryExpertise: z.array(z.string()),
      performanceScore: z.number().min(0).max(1),
      capacityLimit: z.number().min(1),
      regions: z.array(z.string()),
    })
  ),
});

// Phase 4B explainability schema
export const Phase4BExplainabilitySchema = z.object({
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']),
  confidenceDisplay: z.boolean(),
  factorContribution: z.boolean(),
  reasoningTemplates: z.object({
    highConfidence: z.string().min(1),
    mediumConfidence: z.string().min(1),
    lowConfidence: z.string().min(1),
  }),
});
```

### Rollout Notes for Phase 4B

- **AI Feature Activation**: Start with 5% of leads for AI-enhanced scoring
- **Routing Suggestions**: Enable predictive routing for 10% of qualified leads
- **Cipher Monitoring**: All AI decisions logged in monitor mode initially
- **Performance Monitoring**: Track latency impact and decision accuracy
- **Gradual Rollout**: Increase AI feature usage by 10% weekly based on performance
- **Fallback Ready**: Rule-based decisions remain available if AI features are disabled

This Control Plane specification provides the foundation for safe, auditable, and tenant-aware configuration management in NeuronX's multi-tenant architecture.
