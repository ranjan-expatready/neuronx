# Tenant Model

## Recommended Architecture: Single Database + Tenant ID

### Database Strategy

Use a single logical database with tenant_id as the primary isolation mechanism.

**Table Structure Pattern:**

```sql
-- All tables include tenant_id
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  workspace_id UUID,
  -- other columns
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tenant-scoped indexes
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_tenant_workspace ON leads(tenant_id, workspace_id);
```

**Benefits:**

- Simplified operations (single DB cluster)
- Easier cross-tenant analytics
- Reduced infrastructure complexity
- Better resource utilization

### Isolation Mechanisms

#### Data Isolation

- **Row-Level Security**: All queries filtered by tenant_id
- **Foreign Key Constraints**: Enforce tenant boundaries
- **Audit Triggers**: Log cross-tenant access attempts

#### Query Patterns

```typescript
// Always include tenant filter
const leads = await db.leads.findMany({
  where: {
    tenantId: context.tenantId,
    workspaceId: context.workspaceId, // optional
  },
});
```

#### Performance Isolation

- **Connection Pooling**: Per-tenant connection limits
- **Query Timeouts**: Prevent long-running tenant queries
- **Resource Quotas**: CPU/memory limits per tenant

## Isolation Boundaries

### Strict Boundaries

- **Data**: No tenant data mixing under any circumstances
- **Configuration**: Tenant configs isolated from other tenants
- **Events**: Event streams scoped to tenant boundaries
- **Processing**: Background jobs isolated by tenant

### Shared Resources

- **Code**: Single codebase with tenant-aware logic
- **Schema**: Shared table structures with tenant_id columns
- **Infrastructure**: Shared compute/storage with isolation controls

### Security Boundaries

- **Authentication**: Tenant-specific user identities
- **Authorization**: Tenant-scoped permissions
- **Audit**: Tenant-isolated audit trails
- **Encryption**: Tenant-specific encryption keys

## Configuration Scoping

### Hierarchical Configuration

Configuration follows inheritance hierarchy: Global → Tenant → Workspace

#### Global Configuration

System-wide defaults and limits:

```typescript
{
  "maxLeadsPerTenant": 100000,
  "defaultScoringAlgorithm": "v2",
  "emailRateLimit": 1000,
  "auditRetentionDays": 2555
}
```

#### Tenant Configuration

Tenant-specific overrides:

```typescript
{
  "tenantId": "uuid-123",
  "scoring": {
    "algorithm": "custom-v3",
    "weights": { "industry": 0.3, "size": 0.4 }
  },
  "workflows": {
    "maxConcurrent": 50,
    "timeoutMinutes": 30
  }
}
```

#### Workspace Configuration

Department/unit-specific settings:

```typescript
{
  "tenantId": "uuid-123",
  "workspaceId": "sales-team-a",
  "territory": "west-coast",
  "assignmentRules": ["geo-based", "capacity-based"],
  "notificationChannels": ["slack", "email"]
}
```

### Configuration Resolution

```typescript
function resolveConfig(key: string, context: TenantContext): any {
  // Check workspace first
  const workspaceValue = getWorkspaceConfig(context.workspaceId, key);
  if (workspaceValue !== undefined) return workspaceValue;

  // Then tenant
  const tenantValue = getTenantConfig(context.tenantId, key);
  if (tenantValue !== undefined) return tenantValue;

  // Finally global default
  return getGlobalConfig(key);
}
```

### Configuration Management

- **Versioning**: Configuration changes are versioned and auditable
- **Validation**: Configuration schemas enforced at all levels
- **Caching**: Configuration cached with tenant-specific TTL
- **Hot Reload**: Configuration changes take effect without restart

## SaaS Evolution Path

### Phase 1: DFY Mode (Current)

- Single tenant per deployment
- Tenant_id maps to client organization
- Workspace represents client sub-units
- Configuration managed by NeuronX team

### Phase 2: Hybrid Mode (Transition)

- Multi-tenant database with isolation
- Self-service configuration interfaces
- Tenant onboarding automation
- Gradual migration of DFY tenants

### Phase 3: Pure SaaS Mode (Future)

- Full multi-tenant with tenant self-management
- Marketplace for tenant-specific customizations
- Automated scaling per tenant load
- Enterprise features (SSO, audit exports, compliance)

## Migration Strategy

### Schema Evolution

```sql
-- Add tenant_id to existing tables
ALTER TABLE leads ADD COLUMN tenant_id UUID;
CREATE INDEX CONCURRENTLY idx_leads_tenant ON leads(tenant_id);

-- Populate tenant_id for existing data
UPDATE leads SET tenant_id = 'client-uuid' WHERE tenant_id IS NULL;
ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;
```

### Application Changes

- Add tenant context to all operations
- Implement tenant filtering in queries
- Add configuration scoping logic
- Update audit logging for tenant isolation

### Testing Strategy

- Tenant isolation tests (data leakage prevention)
- Configuration scoping tests (inheritance validation)
- Performance tests (multi-tenant load simulation)
- Migration tests (data integrity during transition)

## Operational Considerations

### Monitoring

- **Tenant Metrics**: Per-tenant resource usage, error rates, performance
- **Isolation Alerts**: Cross-tenant access attempts, data leakage detection
- **Configuration Drift**: Configuration inconsistencies across environments

### Backup and Recovery

- **Tenant-Specific Backups**: Ability to backup/restore individual tenants
- **Point-in-Time Recovery**: Tenant-scoped recovery operations
- **Cross-Tenant Consistency**: Ensure backup operations don't affect other tenants

### Scaling

- **Horizontal Scaling**: Database read replicas for tenant load distribution
- **Tenant Sharding**: Future option for extreme scale (1000+ tenants)
- **Resource Pools**: Shared infrastructure with tenant-specific quotas

### Compliance

- **Data Residency**: Tenant data location controls
- **Retention Policies**: Tenant-specific data retention rules
- **Audit Exports**: Tenant-scoped audit trail exports
- **GDPR/CCPA**: Tenant-level data subject rights handling
