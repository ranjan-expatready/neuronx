# NeuronX

**AI-Driven Sales Orchestration Platform** | **FAANG-Grade Quality** | **Multi-Tenant SaaS**

NeuronX provides AI-driven sales orchestration as the intelligence layer, delivering measurable business outcomes through automated lead qualification, intelligent routing, and predictive analytics while maintaining complete platform independence.

## What is NeuronX?

NeuronX is a world-class sales operating system that serves as the intelligence layer between sales teams and execution platforms. It provides:

- **15% improvement in lead scoring accuracy** (vs manual assessment)
- **20% reduction in assignment errors** through predictive routing
- **Sub-5 second orchestration latency** for critical sales paths
- **Enterprise-grade auditability** with complete event sourcing
- **Platform independence** - works with GHL, Salesforce, or custom platforms

### Core Capabilities

- **Lead Intelligence**: AI-powered scoring and qualification algorithms
- **Smart Routing**: Predictive assignment based on rep skills and availability
- **Orchestration Engine**: Multi-channel communication coordination (SMS, email, voice)
- **Evidence-Based Governance**: Complete audit trail for compliance
- **Adapter-First Architecture**: Clean separation between intelligence and execution

### Architecture Principles

- **Intelligence Layer Ownership**: All business logic resides in NeuronX core
- **Platform Agnosticism**: Works with any execution platform via adapters
- **Clean Interfaces**: Stateless protocol translation between systems
- **Multi-Tenant Security**: Row-level isolation with enterprise-grade access controls

## Quick Start

### Prerequisites

```bash
# Required versions
node >=22 <23
pnpm >=9.0.0
```

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd neuronx

# Install dependencies
pnpm install --frozen-lockfile

# Configure environment
cp env-example.txt .env
# Edit .env with required values

# Run quality checks
pnpm run ci

# Start development servers
pnpm run dev:core-api
```

### Testing

```bash
# Run complete test suite
pnpm run test:all

# Run with coverage
pnpm run test:coverage

# E2E testing
pnpm run test:e2e
```

## Documentation

### Single Source of Truth (SSOT)

All governance, requirements, and technical decisions are documented in our SSOT system:

- **[SSOT Index](docs/SSOT/index.md)** - Complete documentation navigation
- **[AGENTS.md](AGENTS.md)** - AI agent operating rules and governance
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines and quality standards

### Key Documentation

- **[Mission & Architecture](docs/SSOT/01_MISSION.md)** - Core purpose and architectural principles
- **[Governance Model](docs/SSOT/02_GOVERNANCE.md)** - No-drift policy and vendor boundaries
- **[Quality Standards](docs/SSOT/03_QUALITY_BAR.md)** - Definition of Done and CI/CD requirements
- **[Testing Strategy](docs/SSOT/04_TEST_STRATEGY.md)** - Test pyramid and coverage requirements

## Development Workflow

### Branch Protection & CI/CD

NeuronX enforces FAANG-grade quality gates:

- **Required Status Checks**: Formatting, linting, type checking, coverage (≥85%)
- **Security Scanning**: Secrets, dependencies, CodeQL analysis

## Factory Integration

For Factory AI sessions, see [FACTORY_PLAYBOOK.md](FACTORY_PLAYBOOK.md) for integration guidelines.
Use the bootstrap script to quickly assess project state:

```bash
./scripts/factory_session_bootstrap.sh
```
- **Review Requirements**: Code owners, security review for critical changes
- **Evidence-Based**: All changes require traceability and evidence artifacts

### Pull Request Process

1. Use the [PR template](.github/pull_request_template.md)
2. Complete all governance checklist items
3. Add evidence to `docs/TRACEABILITY.md`
4. Create evidence artifacts in `docs/EVIDENCE/`
5. Update `PRODUCT_LOG.md` or `ENGINEERING_LOG.md`

## Architecture Overview

### Intelligence Layer (NeuronX Core)

```
apps/core-api/          # NestJS API server
packages/decision-engine/    # AI scoring algorithms
packages/voice-orchestration/ # Multi-channel coordination
packages/adapters/          # Protocol translation layer
```

### Execution Platforms (Via Adapters)

- **GoHighLevel (GHL)**: Primary DFY execution platform
- **Salesforce**: Enterprise CRM integration
- **Custom Platforms**: API-based execution environments

### Technology Stack

- **Runtime**: Node.js 22+, TypeScript 5.0+
- **Framework**: NestJS, Fastify
- **Testing**: Vitest (unit), Jest (integration), Playwright (E2E)
- **Database**: PostgreSQL with Prisma ORM
- **Infrastructure**: Docker, Kubernetes, Redis
- **CI/CD**: GitHub Actions with comprehensive quality gates

## Quality Standards

### Code Coverage
- **Unit Tests**: >85% coverage for business logic
- **Integration Tests**: 100% coverage for external boundaries
- **E2E Tests**: 100% coverage for critical user journeys

### Performance Benchmarks
- **API Response Time**: P95 <200ms for core APIs
- **Orchestration Latency**: <5 seconds for critical paths
- **Test Execution**: <6 minutes for full CI pipeline

### Security Requirements
- **No Secrets**: Automated scanning prevents credential leaks
- **Dependency Security**: No moderate/high severity vulnerabilities
- **Access Control**: RBAC enforced across all operations
- **Audit Trail**: Complete event sourcing for compliance

## Subsystems

### Ollama Gateway
A FastAPI gateway for OpenAI-compatible access to Ollama models with Cursor integration.

**[Setup Guide](README_OLLAMA_GATEWAY.md)** | Used for local AI model hosting and development

## Contributing

We welcome contributions that align with our governance model and quality standards.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Complete contribution guidelines
- **[AGENTS.md](AGENTS.md)** - AI agent operating rules
- **[Code of Conduct](docs/GOVERNANCE.md)** - Community standards

### Getting Help

- **Issues**: GitHub issues for bugs and feature requests
- **Discussions**: GitHub discussions for questions and proposals
- **Documentation**: [SSOT Index](docs/SSOT/index.md) for complete technical reference

## License

[License information]

---

**NeuronX** - Transforming sales operations through AI-driven intelligence and platform-independent orchestration.