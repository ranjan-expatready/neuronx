# 0006: Tenant Isolation Strategy

## Status

Accepted

## Context

NeuronX must support both DFY deployments (single tenant per client) and future SaaS multi-tenancy (many tenants in shared infrastructure). The isolation strategy directly impacts:

- **Data Security**: Preventing tenant data leakage or unauthorized access
- **Performance**: Ensuring one tenant's load doesn't affect others
- **Compliance**: Meeting regulatory requirements for data isolation
- **Operational Complexity**: Managing shared vs. dedicated resources
- **Migration Path**: Seamless evolution from DFY to SaaS
- **Cost Efficiency**: Maximizing resource utilization in SaaS mode

Poor isolation leads to:

- Security vulnerabilities and data breaches
- Noisy neighbor problems affecting performance
- Compliance violations and legal risks
- Complex migration paths and technical debt
- Inefficient resource utilization

The tenant model must support the full evolution from single-tenant DFY deployments to multi-tenant SaaS while maintaining strong isolation guarantees.

## Decision

Implement tenant isolation using a **single shared database with tenant_id columns** and **application-level enforcement**:

- **Database Layer**: Single logical database with tenant_id on all tables
- **Application Layer**: Mandatory tenant context on all operations
- **Query Filtering**: Automatic tenant_id injection in all database queries
- **Access Control**: Tenant-scoped authentication and authorization
- **Resource Isolation**: Connection pooling and rate limiting per tenant
- **Configuration Scoping**: Hierarchical config resolution (Global → Tenant → Workspace)

## Consequences

### Positive

- **Operational Simplicity**: Single database cluster to manage and monitor
- **Resource Efficiency**: Better utilization through resource pooling
- **Migration Friendly**: DFY tenants map naturally to SaaS tenant records
- **Cross-Tenant Analytics**: Possible future features for anonymized insights
- **Scaling Flexibility**: Horizontal scaling benefits all tenants simultaneously
- **Cost Optimization**: Reduced infrastructure overhead compared to per-tenant databases

### Negative

- **Query Performance**: Additional tenant filtering on all queries
- **Complex Indexing**: tenant_id must be included in all performance-critical indexes
- **Backup Complexity**: Tenant-specific backup/restore requires careful filtering
- **Monitoring Overhead**: Per-tenant metrics collection and alerting
- **Hotspot Risk**: Uneven tenant load distribution can cause performance issues

### Risks

- **Data Leakage**: Query mistakes could expose other tenants' data
- **Performance Degradation**: Noisy neighbors affecting shared resources
- **Compliance Concerns**: Regulators may require physical separation
- **Migration Complexity**: Schema changes affect all tenants simultaneously
- **Debugging Difficulty**: Cross-tenant issues harder to isolate

## Alternatives Considered

### Alternative 1: Separate Database Per Tenant

- **Pros**: Perfect isolation, compliance-friendly, performance guarantees
- **Cons**: High operational complexity, inefficient resource usage, expensive scaling
- **Rejected**: Operational overhead incompatible with SaaS economics and DFY-to-SaaS migration

### Alternative 2: Schema Separation (Shared DB, Separate Schemas)

- **Pros**: Better isolation than tenant_id, easier backup/restore
- **Cons**: Complex schema management, migration challenges, still shared resources
- **Rejected**: Migration complexity and still vulnerable to noisy neighbor issues

### Alternative 3: Physical Separation (Separate Clusters)

- **Pros**: Ultimate isolation and performance guarantees
- **Cons**: Highest cost, complex orchestration, limited resource sharing
- **Rejected**: Cost prohibitive for broad SaaS adoption and DFY economics

### Alternative 4: Application-Level Multi-Tenancy Only

- **Pros**: Simple implementation, flexible deployment models
- **Cons**: Weak isolation, compliance risks, performance issues
- **Rejected**: Insufficient security and isolation for enterprise requirements

## Implementation Strategy

### Database Schema Design

```sql
-- Core pattern for all tenant-scoped tables
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID,
  -- business fields
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,

  -- tenant-scoped indexes
  INDEX idx_leads_tenant_created (tenant_id, created_at),
  INDEX idx_leads_tenant_workspace (tenant_id, workspace_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### Application-Level Enforcement

```typescript
// Context propagation through all operations
interface TenantContext {
  tenantId: string;
  workspaceId?: string;
  actorId: string;
  permissions: Permission[];
}

// Automatic tenant filtering
class TenantAwareRepository {
  async findLeads(criteria: LeadCriteria, context: TenantContext) {
    return this.db.leads.findMany({
      where: {
        tenantId: context.tenantId, // Always required
        workspaceId: context.workspaceId, // Optional
        ...criteria,
      },
    });
  }
}
```

### Query Performance Optimization

- **Composite Indexes**: tenant_id + business fields for common queries
- **Partitioning**: Future option for high-volume tenants
- **Connection Pooling**: Per-tenant limits to prevent resource exhaustion
- **Query Monitoring**: Slow query alerts with tenant attribution

### Security Implementation

- **Row-Level Security**: Database-level tenant filtering where supported
- **Parameter Injection**: Forced tenant_id in all parameterized queries
- **Audit Logging**: All queries logged with tenant context
- **Access Patterns**: Deny-by-default with explicit tenant grants

### Migration Strategy

1. **DFY Phase**: Single tenant per deployment, tenant_id = client_id
2. **Hybrid Phase**: Multi-tenant schema with existing DFY tenants
3. **SaaS Phase**: Full multi-tenancy with self-service onboarding
4. **Scaling Phase**: Add partitioning for high-volume tenants

### Monitoring and Alerting

- **Per-Tenant Metrics**: Query latency, error rates, resource usage
- **Isolation Violations**: Alerts for queries without tenant filtering
- **Performance Thresholds**: Tenant-specific SLOs and alerts
- **Capacity Planning**: Usage trends for scaling decisions

## Compliance and Security

### Data Protection

- **Encryption**: Tenant-specific encryption keys for sensitive data
- **Retention**: Tenant-configurable data retention policies
- **Deletion**: Secure deletion with audit trails
- **Backup**: Tenant-specific backup capabilities

### Regulatory Compliance

- **GDPR**: Tenant-level data subject rights and processing
- **SOX**: Tenant-isolated audit trails and controls
- **Industry Standards**: SOC 2, ISO 27001 compliance framework

### Operational Security

- **Access Control**: Tenant-scoped user authentication and authorization
- **Audit Trails**: Complete audit logs with tenant attribution
- **Incident Response**: Tenant-specific incident isolation and response
- **Penetration Testing**: Multi-tenant security validation

## Related ADRs

- 0005: Core engine is event-driven
- 0007: Adapter-first vendor integration
- 0003: DFY-first GTM with SaaS evolution

## Notes

This tenant isolation strategy enables NeuronX to:

1. **Start Simple**: DFY deployments work naturally in multi-tenant schema
2. **Scale Efficiently**: Shared infrastructure maximizes resource utilization
3. **Maintain Security**: Strong isolation prevents data leakage and compliance issues
4. **Support Evolution**: Seamless migration from DFY to SaaS without architectural changes
5. **Enable Features**: Cross-tenant analytics and marketplace capabilities

Key success factors:

- Zero-tolerance for tenant data mixing
- Comprehensive query filtering enforcement
- Performance monitoring and optimization
- Regular security audits and penetration testing
- Clear migration path with backward compatibility

The single database approach balances operational simplicity with enterprise-grade isolation, enabling both DFY profitability and SaaS scalability.
