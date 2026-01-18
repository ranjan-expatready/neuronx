# 0008: NestJS Backend Framework

## Status

Accepted

## Context

NeuronX requires a scalable, enterprise-grade backend framework that supports:

- **Event-driven architecture**: Controllers, modules, and dependency injection for clean event handling
- **TypeScript native**: Full type safety and developer experience
- **Modular architecture**: Clear boundaries between business logic, adapters, and infrastructure
- **Testing**: Comprehensive testing utilities and patterns
- **Enterprise features**: Guards, interceptors, pipes for cross-cutting concerns
- **OpenAPI generation**: Automatic API documentation and client SDK generation
- **Microservices ready**: Module-based architecture supporting future decomposition

The framework choice impacts:

- Developer productivity and learning curve
- Code organization and maintainability
- Testing strategy and tooling
- Performance and scalability characteristics
- Integration with chosen database and messaging technologies
- Future evolution to microservices architecture

Poor framework choice leads to:

- Inconsistent code patterns and architectural violations
- Difficult testing and debugging
- Scaling bottlenecks and performance issues
- High maintenance overhead
- Developer dissatisfaction and turnover

## Decision

Adopt NestJS as the backend framework for all NeuronX APIs and services.

**Key Features Utilized:**

- **Modules**: Clean separation of business domains (Sales Core, Adapters, Platform)
- **Dependency Injection**: Testable services and clean architecture
- **Guards**: Tenant context enforcement and RBAC
- **Interceptors**: Request correlation, audit logging, performance monitoring
- **Pipes**: Input validation and transformation
- **Decorators**: Metadata-driven configuration and behavior
- **Dynamic Modules**: Runtime configuration of adapters and features

## Consequences

### Positive

- **Developer Experience**: Excellent TypeScript support, decorators, and tooling
- **Architecture Alignment**: Modules map perfectly to NeuronX's architectural boundaries
- **Testing**: Built-in testing utilities and patterns
- **Enterprise Ready**: Production-tested at scale by major companies
- **OpenAPI**: Automatic API documentation generation
- **Community**: Large ecosystem and active maintenance
- **Future-Proof**: Supports microservices evolution

### Negative

- **Learning Curve**: Angular-inspired patterns may be unfamiliar to some developers
- **Opinionated**: Framework conventions must be followed
- **Bundle Size**: Includes features that may not be used initially
- **Node.js Ecosystem**: Tied to Node.js runtime characteristics

### Risks

- **Vendor Lock-in**: NestJS-specific patterns and conventions
- **Performance Overhead**: Framework abstractions add latency
- **Debugging Complexity**: Multiple layers of decorators and DI resolution
- **Upgrade Path**: Major version upgrades may require significant changes

## Alternatives Considered

### Alternative 1: Express.js + TypeScript

- **Pros**: Minimal, flexible, familiar to many developers
- **Cons**: Manual structure, boilerplate code, testing challenges, no built-in patterns
- **Rejected**: Requires too much custom architecture and patterns

### Alternative 2: Fastify + TypeScript

- **Pros**: High performance, plugin ecosystem, JSON schema validation
- **Cons**: Less opinionated, requires more architectural decisions
- **Rejected**: Performance benefits outweighed by architectural consistency needs

### Alternative 3: Koa.js + TypeScript

- **Pros**: Lightweight, async/await native, extensible
- **Cons**: Minimal built-in features, requires significant custom work
- **Rejected**: Too low-level for enterprise application needs

### Alternative 4: AdonisJS

- **Pros**: Full-stack, ORM included, good TypeScript support
- **Cons**: Smaller community, less enterprise adoption
- **Rejected**: Less mature ecosystem compared to NestJS

## Implementation Strategy

### Application Structure

```
apps/
├── core-api/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── sales/           # Sales Core module
│   │   ├── platform/        # Platform services
│   │   └── shared/          # Shared utilities
│   └── test/
├── control-plane-api/
│   └── src/
├── adapters/
│   └── ghl-webhook/
│       └── src/
```

### Core Modules

- **SalesCoreModule**: Lead scoring, workflows, intelligence
- **PlatformModule**: Tenant management, RBAC, billing, audit
- **AdapterModule**: Dynamic adapter registration and management
- **EventingModule**: Event publishing and consumption
- **ConfigModule**: Configuration management and validation

### Cross-Cutting Concerns

- **TenantGuard**: Enforces tenant context on all requests
- **AuditInterceptor**: Logs all API calls for compliance
- **CorrelationInterceptor**: Manages request tracing
- **ValidationPipe**: Input validation using Zod schemas

### Testing Strategy

- **Unit Tests**: Service and utility testing with Jest
- **E2E Tests**: API endpoint testing with Supertest
- **Contract Tests**: API contract validation
- **Integration Tests**: Database and external service testing

## Related ADRs

- 0009: Postgres Database with Tenant Isolation
- 0010: Prisma ORM and Migrations
- 0014: REST API with OpenAPI First

## Notes

NestJS provides the architectural foundation for NeuronX's event-driven, modular design. Its module system aligns perfectly with our architectural boundaries, and its enterprise features support our compliance and scalability requirements.

Key success factors:

- Strict adherence to module boundaries
- Comprehensive testing coverage
- Proper use of dependency injection
- Effective use of guards and interceptors for cross-cutting concerns
- Regular evaluation of performance implications

The framework choice enables NeuronX to build a maintainable, scalable, and well-tested enterprise application while providing excellent developer experience.
