# 0014: REST API with OpenAPI First

## Status

Accepted

## Context

NeuronX requires well-designed, developer-friendly APIs for:

- **Internal Services**: Clean service-to-service communication
- **External Integrations**: Third-party system integrations and webhooks
- **Frontend Applications**: React/Vue/Angular application consumption
- **Mobile Applications**: iOS/Android app data access
- **Partner Integrations**: B2B API access for technology partners
- **Future Evolution**: API versioning and backward compatibility
- **Documentation**: Self-documenting APIs with interactive exploration

API design choice impacts:

- Developer experience for internal and external consumers
- Integration complexity and maintenance overhead
- API evolution and versioning strategies
- Testing approaches and contract validation
- Documentation quality and discoverability
- Compliance with industry standards and best practices

Poor API design leads to:

- Complex integrations and high maintenance costs
- Breaking changes that affect partners and customers
- Poor developer experience and adoption barriers
- Testing challenges and unreliable integrations
- Documentation drift and confusion
- Security vulnerabilities from improper design

## Decision

Adopt REST API design with OpenAPI-first development approach.

**REST Principles:**

- **Resource-Based**: Clear resource identification and relationships
- **HTTP Methods**: Proper use of GET, POST, PUT, DELETE, PATCH
- **Stateless**: No server-side session state
- **Content Negotiation**: JSON as primary format with proper content types
- **Hypermedia**: Link relationships for API discoverability

**OpenAPI First:**

- **Specification First**: API design precedes implementation
- **Code Generation**: Automated client and server code generation
- **Contract Testing**: API specification as source of truth for testing
- **Documentation**: Auto-generated interactive API documentation
- **Validation**: Request/response validation against OpenAPI spec

**API Evolution:**

- **Semantic Versioning**: Major.minor.patch for API changes
- **Backward Compatibility**: New fields optional, existing fields preserved
- **Deprecation Warnings**: Clear deprecation notices and migration guides
- **Version Headers**: API versioning through custom headers

## Consequences

### Positive

- **Developer Experience**: Self-documenting, explorable APIs
- **Consistency**: Standardized patterns across all endpoints
- **Testability**: Contract testing against OpenAPI specifications
- **Tooling**: Rich ecosystem of API tools and client libraries
- **Evolution**: Safe API versioning and backward compatibility
- **Adoption**: Industry standard familiar to most developers
- **Integration**: Easy integration with frontend frameworks and tools

### Negative

- **Design Discipline**: Requires careful upfront API design
- **Specification Maintenance**: OpenAPI specs must be kept current
- **Tooling Complexity**: Multiple tools and processes to manage
- **Performance Considerations**: REST overhead for high-frequency operations
- **Learning Curve**: Understanding REST and OpenAPI best practices

### Risks

- **Specification Drift**: Implementation diverging from specification
- **Version Complexity**: Managing multiple API versions simultaneously
- **Over-Engineering**: REST constraints may be too rigid for simple operations
- **Performance Bottlenecks**: Chatty APIs for complex operations
- **Documentation Maintenance**: Keeping specs and docs synchronized

## Alternatives Considered

### Alternative 1: GraphQL

- **Pros**: Flexible queries, single endpoint, type safety
- **Cons**: Complexity, caching challenges, REST familiarity
- **Rejected**: Overkill for current use cases, complexity for simple CRUD operations

### Alternative 2: gRPC

- **Pros**: High performance, strong typing, bidirectional streaming
- **Cons**: Browser compatibility, REST ecosystem familiarity
- **Rejected**: Internal service communication better served by REST

### Alternative 3: tRPC

- **Pros**: Type safety, simple integration, no schemas
- **Cons**: New technology, limited ecosystem, framework coupling
- **Rejected**: Too new and framework-specific for enterprise APIs

### Alternative 4: REST with JSON Schema

- **Pros**: Familiar patterns, flexible validation
- **Cons**: Less tooling, manual documentation, no code generation
- **Rejected**: Inferior tooling and developer experience compared to OpenAPI

## Implementation Strategy

### API Design Principles

- **Resource Naming**: `/api/v1/tenants/{tenantId}/workspaces/{workspaceId}/leads`
- **HTTP Status Codes**: Proper use of 200, 201, 400, 401, 403, 404, 500
- **Content Types**: `application/json` with UTF-8 encoding
- **Pagination**: Cursor-based pagination for large result sets
- **Filtering**: Query parameter filtering with validation
- **Sorting**: Standardized sorting parameters

### OpenAPI Specification Structure

```yaml
openapi: 3.0.3
info:
  title: NeuronX Core API
  version: 1.0.0
  description: Core API for NeuronX sales orchestration platform

servers:
  - url: https://api.neuronx.com/v1
    description: Production server

paths:
  /tenants/{tenantId}/leads:
    get:
      summary: List leads
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Lead'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

components:
  schemas:
    Lead:
      type: object
      properties:
        id:
          type: string
        tenantId:
          type: string
        email:
          type: string
          format: email
        score:
          type: number
          minimum: 0
          maximum: 100
```

### NestJS OpenAPI Integration

```typescript
// Controller with OpenAPI decorators
@Controller('leads')
@ApiTags('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads' })
  @ApiResponse({
    status: 200,
    description: 'Leads retrieved successfully',
    type: LeadsResponse,
  })
  @ApiQuery({ name: 'page', required: false })
  async findAll(
    @Query() query: LeadsQuery,
    @TenantId() tenantId: string
  ): Promise<LeadsResponse> {
    return this.leadsService.findAll(tenantId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  @ApiResponse({
    status: 201,
    description: 'Lead created successfully',
    type: LeadResponse,
  })
  async create(
    @Body() createLeadDto: CreateLeadDto,
    @TenantId() tenantId: string
  ): Promise<LeadResponse> {
    return this.leadsService.create(tenantId, createLeadDto);
  }
}
```

### API Versioning Strategy

```typescript
// Version header approach
@Controller('leads')
@ApiTags('leads')
export class LeadsController {
  @Get()
  @ApiHeader({
    name: 'X-API-Version',
    description: 'API version',
    required: false,
    schema: { type: 'string', default: '2024-01-01' },
  })
  async findAll(@Headers('x-api-version') apiVersion?: string) {
    const version = apiVersion || '2024-01-01';
    return this.leadsService.findAll(version);
  }
}
```

### Request Validation and Transformation

```typescript
// DTO with class-validator and OpenAPI
export class CreateLeadDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lastName?: string;
}

// Controller with validation pipe
@Post()
async create(
  @Body(ValidationPipe) createLeadDto: CreateLeadDto,
  @TenantId() tenantId: string
) {
  return this.leadsService.create(tenantId, createLeadDto);
}
```

### Error Handling and Responses

```typescript
// Standardized error responses
@ApiResponse({
  status: 400,
  description: 'Bad Request',
  schema: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' }
        }
      }
    }
  }
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized'
})
@ApiResponse({
  status: 403,
  description: 'Forbidden'
})
```

### API Testing Strategy

- **Contract Tests**: Validate responses against OpenAPI spec
- **Integration Tests**: End-to-end API testing with real database
- **Performance Tests**: Load testing critical API endpoints
- **Security Tests**: Authentication and authorization validation

### Documentation and Developer Experience

- **Swagger UI**: Interactive API documentation at `/api/docs`
- **Redoc**: Alternative documentation format
- **Client SDKs**: Auto-generated TypeScript clients
- **Postman Collections**: Importable API collections
- **Rate Limiting**: Clear rate limit headers and documentation

## Related ADRs

- 0008: NestJS Backend Framework
- 0013: Clerk Authentication and RBAC
- 0012: OpenTelemetry and Sentry Observability

## Notes

REST with OpenAPI-first provides the reliable, well-documented API foundation required for NeuronX's multi-tenant, event-driven architecture. The specification-first approach ensures consistency and enables automated tooling.

Key success factors:

- Strict adherence to REST principles and HTTP conventions
- Comprehensive OpenAPI specifications kept in sync with code
- Automated testing against API contracts
- Clear versioning and deprecation strategies
- Excellent documentation and developer experience
- Performance monitoring and optimization of API endpoints

The API design choice enables NeuronX to provide enterprise-grade APIs while maintaining excellent developer and integration experiences.
