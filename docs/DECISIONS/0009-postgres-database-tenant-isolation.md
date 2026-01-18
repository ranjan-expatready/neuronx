# 0009: Postgres Database with Tenant Isolation

## Status

Accepted

## Context

NeuronX requires a robust, ACID-compliant database that supports:

- **Multi-tenant architecture**: Efficient tenant isolation without physical separation
- **Event sourcing**: Immutable event storage with high write throughput
- **Complex queries**: Analytical queries across tenant-scoped data
- **JSON support**: Flexible schema evolution and metadata storage
- **Performance**: High concurrency with proper indexing strategies
- **Compliance**: Audit trails, point-in-time recovery, encryption
- **Scalability**: Horizontal scaling through read replicas and partitioning

Database choice impacts:

- Data consistency and integrity guarantees
- Query performance and optimization capabilities
- Operational complexity and maintenance overhead
- Cost of infrastructure and licensing
- Integration with ORM and migration tools
- Future scaling and high availability requirements

Poor database choice leads to:

- Performance bottlenecks under tenant load
- Complex tenant isolation implementation
- Data consistency issues
- High operational overhead
- Scaling limitations
- Compliance and audit challenges

## Decision

Adopt PostgreSQL as the primary database with tenant_id-based isolation.

**Key Features Utilized:**

- **ACID Transactions**: Strong consistency for financial and business data
- **JSONB**: Flexible storage for events, configurations, and metadata
- **Partitioning**: Tenant-based partitioning for performance optimization
- **Full-text Search**: Advanced search capabilities for sales intelligence
- **PostGIS**: Location-based features for territory management (future)
- **Extensions**: Additional capabilities through PostgreSQL ecosystem
- **Replication**: High availability and read scaling

**Tenant Isolation Implementation:**

- All tables include `tenant_id` column
- Row-Level Security (RLS) policies enforce tenant boundaries
- Connection pooling with tenant context
- Automatic tenant filtering in all queries

## Consequences

### Positive

- **ACID Compliance**: Strong consistency guarantees for business-critical operations
- **Rich Feature Set**: JSONB, full-text search, advanced indexing, partitioning
- **Performance**: Excellent query optimization and concurrent access
- **Scalability**: Proven at massive scale (Instagram, Apple, etc.)
- **Ecosystem**: Comprehensive tooling, ORMs, and community support
- **Cost Effective**: Open-source with enterprise support options
- **JSON Support**: Perfect for event sourcing and flexible schemas

### Negative

- **Operational Complexity**: Requires expertise in PostgreSQL administration
- **Resource Intensive**: Higher memory and storage requirements
- **Connection Limits**: Careful connection pool management required
- **Migration Complexity**: Schema changes affect all tenants simultaneously

### Risks

- **Performance Degradation**: Poor query patterns can impact all tenants
- **Tenant Hotspots**: Uneven tenant load distribution
- **Backup/Restore Complexity**: Tenant-aware backup strategies required
- **Upgrade Challenges**: Major version upgrades require careful planning

## Alternatives Considered

### Alternative 1: MySQL/MariaDB

- **Pros**: Familiar, widely adopted, good performance
- **Cons**: Weaker JSON support, less advanced features, licensing concerns
- **Rejected**: Inferior JSON and advanced querying capabilities

### Alternative 2: MongoDB

- **Pros**: Flexible schemas, good for events, developer-friendly
- **Cons**: Eventual consistency, complex multi-tenant isolation, ACID limitations
- **Rejected**: ACID requirements and tenant isolation complexity

### Alternative 3: CockroachDB

- **Pros**: Distributed, PostgreSQL-compatible, strong consistency
- **Cons**: Higher complexity, newer technology, smaller ecosystem
- **Rejected**: Operational complexity and maturity concerns

### Alternative 4: Amazon Aurora PostgreSQL

- **Pros**: Managed PostgreSQL, high availability, auto-scaling
- **Cons**: Vendor lock-in, higher cost, less control
- **Rejected**: Prefer self-managed for cost and control reasons

## Implementation Strategy

### Schema Design Principles

```sql
-- Core tenant isolation pattern
CREATE TABLE events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  INDEX idx_events_tenant_type (tenant_id, event_type),
  INDEX idx_events_tenant_created (tenant_id, created_at)
);

-- Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_tenant_id());
```

### Indexing Strategy

- **Composite Indexes**: tenant_id + business fields for common queries
- **Partial Indexes**: Filtered indexes for active data only
- **GIN Indexes**: For JSONB fields in events and configurations
- **BRIN Indexes**: For time-series data (events, audit logs)

### Partitioning Strategy

- **Range Partitioning**: By tenant_id ranges for large tenants
- **Time Partitioning**: By month for event and audit data
- **Hash Partitioning**: Even distribution for high-throughput tables

### Performance Optimization

- **Connection Pooling**: PgBouncer for efficient connection management
- **Query Optimization**: EXPLAIN ANALYZE for performance monitoring
- **Caching**: Redis for frequently accessed tenant configurations
- **Read Replicas**: Offload analytical queries from primary

### High Availability

- **Streaming Replication**: Synchronous standby for failover
- **Logical Replication**: Flexible replication topologies
- **Point-in-Time Recovery**: Granular backup and restore capabilities
- **Automated Failover**: Patroni or similar for orchestration

## Related ADRs

- 0006: Tenant Isolation Strategy
- 0010: Prisma ORM and Migrations
- 0005: Core Engine is Event-Driven

## Notes

PostgreSQL provides the robust foundation required for NeuronX's event-driven, multi-tenant architecture. Its ACID guarantees ensure data consistency, while JSONB support enables flexible event storage and schema evolution.

Key success factors:

- Proper tenant isolation through RLS and application-level filtering
- Comprehensive indexing strategy for query performance
- Regular performance monitoring and optimization
- Careful schema evolution to minimize tenant impact
- Backup and recovery strategies that respect tenant boundaries

The database choice enables NeuronX to scale to thousands of tenants while maintaining strong consistency and performance guarantees.
