# 0010: Prisma ORM and Migrations

## Status

Accepted

## Context

NeuronX requires a robust ORM and migration system that supports:

- **Type Safety**: Compile-time guarantees between database schema and application code
- **Migration Safety**: Zero-downtime migrations with rollback capabilities
- **Multi-tenant Awareness**: Tenant-aware query generation and migration execution
- **Event Sourcing**: Efficient querying and indexing of event data
- **Schema Evolution**: Safe schema changes across tenant boundaries
- **Developer Experience**: Excellent tooling and debugging capabilities

ORM choice impacts:

- Developer productivity and code quality
- Database query performance and optimization
- Migration safety and rollback capabilities
- Integration with TypeScript and NestJS
- Testing strategies and data seeding
- Future database changes and refactoring

Poor ORM choice leads to:

- Runtime SQL errors and type mismatches
- Unsafe migrations causing data loss
- Complex multi-tenant query patterns
- Difficult testing and debugging
- Performance bottlenecks from N+1 queries
- Schema drift between environments

## Decision

Adopt Prisma as the ORM and migration system for NeuronX.

**Key Features Utilized:**

- **Type Safety**: Auto-generated TypeScript types from database schema
- **Migration System**: Declarative schema changes with rollback support
- **Query Builder**: Type-safe query construction with optimizations
- **Multi-tenant Support**: Extension patterns for tenant-aware queries
- **Studio**: Visual database exploration and debugging
- **Client Extensions**: Custom query behaviors and middleware
- **Data Proxy**: Connection pooling and performance optimization

**Migration Strategy:**

- **Declarative Schema**: Schema changes as code with version control
- **Zero-Downtime**: Backward-compatible migrations where possible
- **Tenant-Aware**: Migrations respect tenant isolation boundaries
- **Rollback Support**: Safe rollback procedures for failed deployments

## Consequences

### Positive

- **Type Safety**: Compile-time guarantees prevent runtime errors
- **Developer Experience**: Excellent tooling and auto-completion
- **Migration Safety**: Automated rollback and validation
- **Performance**: Optimized query generation and connection pooling
- **Multi-tenant Ready**: Extensions support tenant-aware patterns
- **Testing**: Easy test database setup and teardown
- **Evolution**: Safe schema refactoring and optimization

### Negative

- **Learning Curve**: New query patterns and schema definition syntax
- **Complexity**: Advanced features require deeper understanding
- **Lock-in**: Prisma-specific patterns and tooling
- **Bundle Size**: Client library adds to application size
- **Migration Coordination**: Requires careful planning for multi-tenant impacts

### Risks

- **Migration Failures**: Complex migrations can fail mid-deployment
- **Performance Regression**: ORM abstractions can hide inefficient queries
- **Version Compatibility**: Prisma version upgrades may require code changes
- **Debugging Challenges**: ORM-generated SQL may be complex to optimize

## Alternatives Considered

### Alternative 1: TypeORM

- **Pros**: Decorator-based, familiar patterns, good TypeScript support
- **Cons**: Less mature migration system, complex multi-tenant patterns
- **Rejected**: Migration safety and multi-tenant support inferior to Prisma

### Alternative 2: MikroORM

- **Pros**: Identity Map, excellent performance, flexible
- **Cons**: Smaller ecosystem, less enterprise adoption
- **Rejected**: Less mature tooling and community support

### Alternative 3: Sequelize

- **Pros**: Mature, battle-tested, good migration support
- **Cons**: Less type-safe, callback-based patterns, older architecture
- **Rejected**: Type safety and modern patterns not as strong

### Alternative 4: Drizzle ORM

- **Pros**: Excellent type safety, lightweight, modern
- **Cons**: Newer technology, less proven at scale, smaller ecosystem
- **Rejected**: Maturity and ecosystem concerns for enterprise use

## Implementation Strategy

### Schema Definition

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspaces Workspace[]
  events      Event[]
  configs     Config[]

  @@map("tenants")
}

model Event {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  type      String
  data      Json
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([tenantId, type])
  @@index([tenantId, createdAt])
  @@map("events")
}
```

### Client Extensions for Multi-Tenancy

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query, operation, model }) {
        // Inject tenant context into all queries
        const tenantId = getCurrentTenantId();
        if (tenantId && model !== 'Tenant') {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
    },
  },
});

export { prisma };
```

### Migration Workflow

```bash
# Development workflow
npx prisma migrate dev --name add-user-table

# Production deployment
npx prisma migrate deploy

# Rollback (if needed)
npx prisma migrate reset
```

### Testing Strategy

- **Unit Tests**: Mock Prisma client for service testing
- **Integration Tests**: Test containers with real database
- **Migration Tests**: Validate migrations don't break existing data
- **Performance Tests**: Query optimization and N+1 prevention

### Performance Optimization

- **Connection Pooling**: Built-in connection management
- **Query Optimization**: Automatic query batching and caching
- **Indexing**: Prisma-aware index recommendations
- **Monitoring**: Query performance tracking and alerting

## Related ADRs

- 0009: Postgres Database with Tenant Isolation
- 0008: NestJS Backend Framework
- 0006: Tenant Isolation Strategy

## Notes

Prisma provides the type-safe, migration-safe foundation required for NeuronX's multi-tenant, event-driven architecture. Its client extensions enable clean multi-tenant patterns, while its migration system ensures safe schema evolution.

Key success factors:

- Strict adherence to Prisma patterns and conventions
- Comprehensive testing of migrations and queries
- Performance monitoring and query optimization
- Careful planning of schema changes across tenants
- Regular evaluation of generated SQL and optimization opportunities

The ORM choice enables NeuronX to maintain type safety and migration safety while supporting complex multi-tenant querying patterns.
