# NeuronX Cipher Safety Policy

## Overview

Cipher is NeuronX's AI safety and governance layer that provides controlled oversight of automated decision-making processes. It serves as a guardrail system ensuring that AI-driven operations align with business policies, risk tolerances, and compliance requirements.

**Status:** Phase 4B Preparation - Controlled Activation
**Mode:** Monitor-only (no blocking actions)
**Scope:** Lead qualification and routing decisions

## Core Principles

### 1. Minimal Viable Safety

- Start with minimal scope focused on highest-risk decisions
- Monitor-only mode initially (log decisions, don't block)
- Easy rollback capability via configuration toggle

### 2. Transparent Decision Making

- All Cipher decisions are logged with full context
- No black-box decision processes
- Clear reasoning provided for all decisions

### 3. Business-Aligned Oversight

- Policies owned by business stakeholders
- Risk assessments drive decision thresholds
- Compliance requirements baked into decision logic

### 4. Operational Safety

- Circuit breaker pattern for automatic disable on failures
- Comprehensive monitoring and alerting
- Manual override capabilities for emergency situations

## Policy Configuration

### Policy Structure

```json
{
  "version": "1.0.0",
  "policy": {
    "enabled": false,
    "mode": "monitor",
    "scope": { ... },
    "checkpoints": { ... },
    "decisionRules": { ... },
    "logging": { ... },
    "emergency": { ... }
  }
}
```

### Configuration Fields

#### `enabled` (boolean)

- **Owner:** Engineering Team
- **Purpose:** Master toggle for Cipher activation
- **Default:** `false` (disabled)
- **Reasoning:** Allows safe rollout and instant rollback if issues arise

#### `mode` (string)

- **Owner:** Engineering Team
- **Values:** `"monitor"`, `"enforce"`, `"disabled"`
- **Current:** `"monitor"`
- **Reasoning:** Start with observation-only to validate behavior before enforcement

#### `scope.allowedOperations` (array)

- **Owner:** Product Team
- **Current:** `["lead_qualification_check", "lead_routing_decision"]`
- **Reasoning:** Focus on highest-value, highest-risk decisions first

#### `scope.disallowedOperations` (array)

- **Owner:** Security Team
- **Current:** `["direct_crm_modification", "bulk_data_export", "user_permission_changes", "system_configuration_modification"]`
- **Reasoning:** Explicitly prohibit high-risk operations that should never be automated

## Checkpoints

### Lead Qualification Checkpoint

**Trigger:** `sales.lead.scored` event
**Purpose:** Review lead scores before qualification decisions
**Decision Types:**

- `allow` - Proceed with qualification
- `deny` - Block qualification, route to manual review
- `suggest_threshold_adjustment` - Recommend different threshold

**Context Required:**

- `leadId`, `score`, `leadData`, `tenantId`

**Business Reasoning:**

- Prevent over-qualification of low-quality leads
- Flag anomalous scoring patterns
- Ensure compliance with industry-specific regulations

### Lead Routing Checkpoint

**Trigger:** `sales.lead.qualified` event
**Purpose:** Review routing decisions before team assignment
**Decision Types:**

- `allow` - Proceed with routing
- `deny` - Block routing, assign to overflow queue
- `suggest_alternative_routing` - Recommend different team

**Context Required:**

- `leadId`, `qualificationResult`, `routingCandidates`, `tenantId`

**Business Reasoning:**

- Ensure balanced workload distribution
- Prevent routing to inappropriate teams
- Maintain service level agreements

## Decision Rules

### Score Anomaly Detection

**Rule:** `scoreAnomalyDetection`
**Owner:** Data Science Team
**Purpose:** Identify statistically anomalous lead scores

**Parameters:**

- `scoreDeviationThreshold: 2.0` - Flag scores 2+ standard deviations from mean
- `minimumSampleSize: 100` - Require sufficient data for statistical analysis

**Action:** `flag_for_review`
**Reasoning:** Catch scoring algorithm drift or data quality issues

### Industry Risk Assessment

**Rule:** `industryRiskAssessment`
**Owner:** Compliance Team
**Purpose:** Apply additional scrutiny to regulated industries

**Parameters:**

- `highRiskIndustries: ["cryptocurrency", "gambling", "pharmaceuticals"]`

**Action:** `require_additional_review`
**Reasoning:** Compliance with industry-specific regulations and risk policies

### Company Size Validation

**Rule:** `companySizeValidation`
**Owner:** Data Team
**Purpose:** Validate company size data reasonableness

**Parameters:**

- `maxReasonableSize: 100000`
- `minReasonableSize: 1`

**Action:** `flag_if_outlier`
**Reasoning:** Prevent processing of obviously incorrect data

## Logging and Monitoring

### Log Configuration

```json
{
  "logging": {
    "enabled": true,
    "level": "info",
    "includeContext": true,
    "excludeFields": ["passwords", "tokens", "secrets", "personalData"],
    "retentionDays": 90
  }
}
```

### Alert Thresholds

- `deniedDecisionsPerHour: 10` - Alert if too many decisions are denied
- `anomalyFlagsPerHour: 5` - Alert if too many anomalies are flagged

### Monitoring Dashboard

Cipher provides metrics for:

- Decision acceptance/rejection rates
- Processing latency distribution
- Anomaly detection frequency
- Checkpoint coverage percentage

## Emergency Controls

### Circuit Breaker

```json
{
  "emergency": {
    "circuitBreakerEnabled": true,
    "maxConsecutiveFailures": 5,
    "failureWindowMinutes": 10,
    "autoDisableOnFailure": true
  }
}
```

**Behavior:** If Cipher fails 5 times in 10 minutes, automatically disable to prevent system impact.

### Manual Override

**Process:**

1. Set `policy.enabled = false` in configuration
2. Restart affected services
3. Log incident with root cause
4. Re-enable after fix validation

## Operational Procedures

### Enabling Cipher

1. **Pre-Enable Checklist:**
   - [ ] All unit tests passing
   - [ ] Integration tests passing
   - [ ] Monitoring dashboard configured
   - [ ] On-call engineer available

2. **Enable Steps:**
   - Update `config/cipher_policy.json` set `"enabled": true`
   - Restart core-api service
   - Monitor logs for 30 minutes
   - Verify no increased error rates

3. **Post-Enable Validation:**
   - Check Cipher decision logs
   - Verify monitoring alerts working
   - Confirm no performance degradation

### Policy Updates

1. **Change Process:**
   - Create draft policy change
   - Run through testing pipeline
   - Review with security team
   - Deploy during maintenance window

2. **Approval Required:**
   - Security Team for risk-related changes
   - Legal Team for compliance changes
   - Engineering Team for technical changes

### Incident Response

**If Cipher Causes Issues:**

1. Immediate: Set `policy.enabled = false`
2. Investigation: Review Cipher logs for root cause
3. Mitigation: Implement fix or rollback
4. Prevention: Add test case for the failure scenario

## Testing Strategy

### Unit Tests

- Mock Cipher service for allow/deny/suggest scenarios
- Verify core logic branches correctly
- Ensure no secrets in logs

### Integration Tests

- Use dummy Cipher policy in test environment
- Trigger qualification and routing flows
- Confirm Cipher intercepts without breaking flows

### Load Tests

- Measure performance impact of Cipher checks
- Verify circuit breaker activation under load
- Test concurrent decision processing

## Future Evolution

### Phase 4B Expansion

- Add more decision types (opportunity creation, task assignment)
- Implement enforcement mode with blocking capabilities
- Add machine learning-based anomaly detection

### Advanced Features

- Real-time policy updates without restarts
- A/B testing of policy changes
- Automated policy optimization

## Ownership and Contacts

- **Engineering Owner:** Platform Team
- **Security Owner:** Security Team
- **Business Owner:** Revenue Operations Team
- **Emergency Contact:** security@neuronx.ai

## Change Log

| Date       | Version | Change                        | Author           |
| ---------- | ------- | ----------------------------- | ---------------- |
| 2026-01-03 | 1.0.0   | Initial controlled activation | Engineering Team |
