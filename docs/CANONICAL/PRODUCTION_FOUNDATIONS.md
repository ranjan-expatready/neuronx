# Production Foundations - Persistence Primitives

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-007 Production Persistence Inventory
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable definition of required production persistence primitives to replace all toy components identified in WI-007

## 1. Purpose & Scope

This document defines the complete set of production-grade persistence primitives required to replace all 10 toy components identified in WI-007. Each primitive is mapped to specific NeuronX domains and provides the foundation for $10M-scale deployment.

### Foundation Principles

- **Durability First:** All primitives must survive process restarts and node failures
- **Scalability:** Horizontal scaling support for multi-instance deployments
- **Consistency:** ACID guarantees where required, eventual consistency where acceptable
- **Observability:** Full monitoring, alerting, and performance metrics
- **Security:** Encryption at rest, access controls, audit trails

### Scope Boundaries

**IN SCOPE:** Production primitives for toy replacement
**OUT OF SCOPE:** Implementation details, infrastructure provisioning, migration scripts

## 2. Required Production Primitives

### Primitive 1: PostgreSQL Database (ACID + Complex Queries)

**Purpose:** Authoritative storage for business entities, audit trails, and complex transactional operations

**NeuronX Domain Mapping:**

- **Configuration:** ConfigRepository, TemplateService, tenant metadata
- **Entitlements:** Tier definitions, tenant entitlements, usage tracking
- **Payments:** PaymentRecord storage, payment audit trails
- **Voice:** VoiceAttemptRecord persistence, voice authorization audit
- **SLA:** SLATimer persistence, escalation event storage
- **Audit:** All audit trail persistence (replaces ConfigAudit in-memory)

**Technical Requirements:**

- **Engine:** PostgreSQL 15+ with pgvector extension
- **Storage:** 500GB+ SSD storage with automated backups
- **Replication:** Multi-AZ synchronous replication
- **Performance:** 1000+ concurrent connections, sub-10ms query latency
- **Security:** Row-level security (RLS) for tenant isolation

**Data Patterns:**

```sql
-- Tenant-scoped tables with automatic partitioning
CREATE TABLE payment_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) PARTITION BY HASH (tenant_id);

-- JSONB for complex nested structures
CREATE TABLE configurations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    config_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### Primitive 2: Redis Cluster (High-Performance Caching + Distributed State)

**Purpose:** High-performance caching, distributed locks, and session management with sub-millisecond latency

**NeuronX Domain Mapping:**

- **Rate Limiting:** Token bucket state (replaces InMemoryRateLimitStore) - WI-008 ✅
- **Scoring:** ML model results cache with tenant isolation, deterministic keys, versioning (replaces AdvancedScoringService cache) - WI-015 ✅
- **Session Management:** API authentication tokens, temporary state
- **Distributed Locks:** Prevent duplicate processing, ensure singleton operations
- **Real-time Features:** Live dashboards, real-time metrics aggregation

**Technical Requirements:**

- **Engine:** Redis 7+ Cluster with 3+ nodes
- **Storage:** 100GB+ RAM with persistence enabled
- **Replication:** Multi-AZ cluster with automatic failover
- **Performance:** Sub-1ms read/write latency, 1M+ operations/second
- **Security:** TLS encryption, ACL-based access controls

**Data Patterns:**

```redis
# Rate limiting with atomic operations - WI-008
SET tenant:api:rate-limit:{tenantId}:{endpoint} {bucketState} EX {ttl}

# Distributed locks with TTL
SET lock:process:{processId} {workerId} NX PX 30000

# ML/Scoring cache with tenant isolation, deterministic keys, versioning - WI-015
SET cache:{tenantId}:scoring:{inputHash}:{versionHash} {scoringResultJson} EX 900
# Key format ensures tenant isolation and deterministic cache hits
# Includes model version and config hash for automatic invalidation

# Session storage
SET session:{sessionId} {userData} EX 3600
```

---

### Primitive 3: Event Streaming Platform (Guaranteed Delivery + Outbox)

**Purpose:** Reliable event delivery, outbox pattern implementation, and distributed event processing

**NeuronX Domain Mapping:**

- **Event Bus:** Replace InMemoryEventBus with durable event streaming
- **Audit Events:** All audit trail events with guaranteed delivery
- **Integration Events:** Webhook delivery, external system notifications
- **Business Events:** Lead lifecycle, payment events, SLA breaches
- **Analytics Events:** Usage events, performance metrics, business intelligence

**Technical Requirements:**

- **Engine:** AWS EventBridge or Apache Kafka with 3+ brokers
- **Storage:** 1TB+ with 7-day retention, infinite archival
- **Throughput:** 10K+ events/second with guaranteed ordering
- **Durability:** 99.999% message durability, exactly-once delivery
- **Security:** End-to-end encryption, fine-grained access controls

**Architecture Pattern:**

```
NeuronX Service → Outbox Table (PostgreSQL) → Event Publisher → Event Stream → Event Consumers
                                      ↓
                               Transactional Outbox Pattern
```

---

### Primitive 4: Time-Series Database (Metrics + Analytics)

**Purpose:** High-volume metrics storage, time-series analytics, and performance monitoring data

**NeuronX Domain Mapping:**

- **Usage Metrics:** Replace UsageService in-memory arrays with time-series storage
- **Performance Metrics:** API latency, database query performance, cache hit rates
- **Business Metrics:** Lead conversion rates, payment success rates, SLA compliance
- **Operational Metrics:** System health, error rates, resource utilization
- **Audit Analytics:** Security events, compliance monitoring, anomaly detection

**Technical Requirements:**

- **Engine:** TimescaleDB (PostgreSQL extension) or InfluxDB 2.x
- **Storage:** 2TB+ with automatic data lifecycle management
- **Ingestion:** 100K+ data points/second with compression
- **Query Performance:** Sub-second queries on 1-year retention
- **Security:** Time-series specific access controls and retention policies

**Data Patterns:**

```sql
-- Usage events with automatic partitioning
CREATE TABLE usage_events (
    time TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    metric VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB,
    metadata JSONB
) PARTITION BY RANGE (time);

-- Continuous aggregates for billing
CREATE MATERIALIZED VIEW daily_usage
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    tenant_id,
    metric,
    sum(value) AS total_value
FROM usage_events
GROUP BY bucket, tenant_id, metric;
```

---

### Primitive 5: Secrets Manager (Secure Credential Storage)

**Purpose:** Secure storage and rotation of sensitive credentials, API keys, and encryption keys

**NeuronX Domain Mapping:**

- **API Credentials:** External service API keys (GHL, payment processors, voice platforms)
- **Database Credentials:** Connection strings, certificates
- **Encryption Keys:** Data encryption keys, JWT signing keys
- **Tenant Secrets:** Per-tenant API keys, webhook secrets
- **Certificate Storage:** SSL certificates, client certificates

**Technical Requirements:**

- **Engine:** AWS Secrets Manager or HashiCorp Vault
- **Storage:** Hardware Security Modules (HSM) backed
- **Rotation:** Automatic key rotation with zero-downtime
- **Access:** Fine-grained IAM policies, audit logging
- **Security:** FIPS 140-2 Level 3 compliance, envelope encryption

**Integration Pattern:**

```typescript
// Secure credential retrieval
const credentials = await secretsManager.getSecretValue({
  SecretId: `neuronx/${tenantId}/ghl-api-key`,
  VersionStage: 'AWSCURRENT',
});

// Automatic rotation handling
secretsManager.onRotation(async secretId => {
  await updateServiceCredentials(secretId);
});
```

---

### Primitive 6: Object Storage (File + Document Storage)

**Purpose:** Durable storage for files, documents, and large binary objects

**NeuronX Domain Mapping:**

- **Voice Recordings:** Call audio files with secure temporary access
- **Document Storage:** Lead attachments, contract documents
- **Export Files:** Bulk data exports, reports
- **Backup Storage:** Database backups, configuration snapshots
- **Media Assets:** Email templates, marketing assets

**Technical Requirements:**

- **Engine:** S3-compatible storage (AWS S3, MinIO)
- **Storage:** 5TB+ with multi-AZ replication
- **Durability:** 99.999999999% (11 9's)
- **Security:** Server-side encryption, pre-signed URLs, access logging
- **Performance:** Global CDN integration for low-latency access

---

### Primitive 7: Search/Indexing Engine (Complex Queries + Full-Text Search)

**Purpose:** Advanced search capabilities across structured and unstructured data

**NeuronX Domain Mapping:**

- **Lead Search:** Full-text search across lead profiles, notes, and interactions
- **Audit Search:** Complex queries across audit trails and event history
- **Analytics Queries:** Ad-hoc analysis of business metrics and performance data
- **Compliance Search:** Regulatory reporting and audit investigations
- **Configuration Search:** Template and configuration discovery

**Technical Requirements:**

- **Engine:** Elasticsearch 8.x or OpenSearch with 3+ nodes
- **Storage:** 1TB+ with automatic indexing and optimization
- **Query Performance:** Sub-100ms complex queries, real-time indexing
- **Security:** Index-level access controls, encrypted communication
- **Scalability:** Horizontal scaling with automatic rebalancing

## 3. Primitive Mapping to Toy Components

| Toy Component                 | Production Primitive | Primary Storage    | Backup/Failover         | Monitoring                |
| ----------------------------- | -------------------- | ------------------ | ----------------------- | ------------------------- |
| InMemoryRateLimitStore        | Redis Cluster        | Redis Memory       | Redis Replication       | Redis Exporter            |
| UsageService Storage          | Time-Series DB       | TimescaleDB        | PostgreSQL Streaming    | pg_stat_statements        |
| EntitlementService Storage    | PostgreSQL           | PostgreSQL         | Multi-AZ                | pg_stat_activity          |
| PaymentService Storage        | PostgreSQL           | PostgreSQL         | Synchronous Replication | Custom Payment Metrics    |
| ConfigRepository Storage      | PostgreSQL           | PostgreSQL         | Point-in-Time Recovery  | Configuration Audit Logs  |
| VoiceService Attempt Tracking | PostgreSQL           | PostgreSQL         | Read Replicas           | Voice Quality Metrics     |
| InMemoryEventBus              | Event Streaming      | EventBridge/Kafka  | Multi-AZ                | Event Delivery Metrics    |
| AdvancedScoringService Cache  | Redis Cluster        | Redis Memory       | Cluster Failover        | Cache Hit/Miss Ratios     |
| TemplateService Storage       | PostgreSQL           | PostgreSQL         | Automated Backups       | Template Usage Metrics    |
| SLAService Timer Management   | PostgreSQL + Redis   | PostgreSQL + Redis | Hybrid                  | SLA Compliance Dashboards |

## 4. Infrastructure Requirements

### Production Environment Requirements

#### Database Layer

- **CPU:** 16+ vCPUs per node
- **Memory:** 128GB+ RAM per node
- **Storage:** NVMe SSDs with 10K+ IOPS
- **Network:** 10Gbps+ dedicated networking
- **High Availability:** 3+ AZ deployment with automatic failover

#### Caching Layer

- **CPU:** 8+ vCPUs per node
- **Memory:** 256GB+ RAM per node
- **Storage:** Persistence enabled with AOF
- **Network:** Low-latency cluster networking
- **Scaling:** Auto-scaling based on memory pressure

#### Event Streaming

- **CPU:** 16+ vCPUs per broker
- **Memory:** 64GB+ RAM per broker
- **Storage:** High-IOPS disks for log segments
- **Network:** 10Gbps+ for inter-broker communication
- **Partitions:** 100+ partitions for parallel processing

### Monitoring & Observability

#### Key Metrics to Monitor

- **Database:** Connection pool utilization, slow query log, deadlock detection
- **Cache:** Hit/miss ratios, memory usage, eviction rates, latency
- **Events:** Delivery success rates, processing latency, queue depth
- **Storage:** IOPS, throughput, latency, error rates
- **Security:** Access patterns, failed authentication attempts, key rotation events

#### Alerting Thresholds

- **Database:** >80% connection pool usage, >1 second query latency
- **Cache:** <90% hit rate, >90% memory usage
- **Events:** >1% delivery failure rate, >30 second processing delay
- **Storage:** >70% capacity usage, >100ms latency spikes

## 5. Security & Compliance

### Data Encryption

- **At Rest:** AES-256 encryption for all persistent storage
- **In Transit:** TLS 1.3 for all network communication
- **Key Management:** Automatic key rotation every 90 days
- **Envelope Encryption:** Data encryption keys encrypted with master keys

### Access Controls

- **Database:** Row-level security (RLS) for tenant isolation
- **Cache:** ACL-based access with least-privilege permissions
- **Secrets:** IAM-based access with session-limited credentials
- **Audit:** All access logged with immutable audit trails

### Compliance Requirements

- **GDPR:** Data portability, right to erasure, consent management
- **SOX:** Financial data controls, audit trails, access logging
- **PCI-DSS:** Payment data isolation, encryption, access controls
- **HIPAA:** Protected health information handling (if applicable)

## 6. Performance Targets

### Latency Requirements

- **Database Reads:** P95 < 10ms for simple queries, < 100ms for complex
- **Database Writes:** P95 < 50ms for transactions
- **Cache Operations:** P99 < 5ms for all operations
- **Event Delivery:** P95 < 100ms end-to-end
- **API Responses:** P95 < 200ms for cached, < 500ms for computed

### Throughput Requirements

- **Database:** 10K+ read/write operations per second
- **Cache:** 100K+ operations per second per node
- **Events:** 50K+ events per second ingestion/delivery
- **Storage:** 1GB+ per second sustained throughput
- **Search:** 1K+ complex queries per second

### Scalability Targets

- **Horizontal Scaling:** 10x capacity increase without performance degradation
- **Tenant Isolation:** No performance impact from noisy neighbor tenants
- **Data Growth:** Linear performance scaling with 100x data growth
- **Concurrent Users:** Support 100K+ concurrent API users

## 7. Disaster Recovery

### Recovery Time Objectives (RTO)

- **Critical Data:** < 1 hour (payments, configurations, entitlements)
- **Operational Data:** < 4 hours (usage metrics, audit logs)
- **Cache Data:** < 15 minutes (automatic cluster recovery)
- **Event Data:** < 30 minutes (replay from outbox)

### Recovery Point Objectives (RPO)

- **Critical Data:** < 5 minutes data loss
- **Operational Data:** < 1 hour data loss
- **Event Data:** Zero data loss (guaranteed delivery)

### Backup Strategy

- **Database:** Daily full backups + hourly incremental + continuous WAL
- **Cache:** AOF persistence with cross-region replication
- **Events:** Multi-region replication with retention policies
- **Files:** Cross-region replication with versioning

---

**Production Foundations Status:** ✅ PRIMITIVES DEFINED
**Toy Components Addressed:** ✅ ALL 10 COVERED
**Infrastructure Ready:** ✅ REQUIREMENTS SPECIFIED
**Security Compliant:** ✅ CONTROLS DEFINED
**Performance Targets:** ✅ METRICS ESTABLISHED
**Disaster Recovery:** ✅ RTO/RPO DEFINED
