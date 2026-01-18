# SDKs and Client Strategy

**Last verified:** 2026-01-03
**Sources:** [GHL SDK Documentation](https://developers.gohighlevel.com/reference/sdks), [GHL API Reference](https://developers.gohighlevel.com/reference/api-reference)

## Official GHL SDKs

GoHighLevel provides official SDKs for major programming languages to simplify integration development.

### Node.js SDK

**Package:** `@gohighlevel/api`
**Version:** Latest available (check npm registry)
**Features:**

- **OAuth 2.0 Helpers:** Complete authorization code flow implementation
- **Token Management:** Automatic token refresh and storage
- **API Client:** Type-safe methods for all GHL endpoints
- **Webhook Handlers:** Built-in signature verification and event parsing
- **Rate Limiting:** Automatic retry with exponential backoff
- **Error Handling:** Structured error responses and recovery

**Capabilities:**

- ✅ Full REST API coverage
- ✅ TypeScript support with type definitions
- ✅ Promise-based async/await patterns
- ✅ Automatic pagination handling
- ✅ Request/response logging
- ✅ Environment-specific configuration

**Source:** [Node.js SDK](https://www.npmjs.com/package/@gohighlevel/api)

### Python SDK

**Package:** `gohighlevel-api`
**Version:** Latest available (check PyPI)
**Features:**

- **OAuth Integration:** Django/Flask integration helpers
- **Token Persistence:** Database-backed token storage
- **Async Support:** Full asyncio compatibility
- **Data Models:** Python classes for GHL entities
- **Batch Operations:** Bulk API operation support

**Capabilities:**

- ✅ Python 3.8+ support
- ✅ Django ORM integration
- ✅ Comprehensive documentation
- ✅ Test utilities included

**Source:** [Python SDK](https://pypi.org/project/gohighlevel-api/)

### PHP SDK

**Package:** `gohighlevel/gohighlevel-api`
**Version:** Latest available (check Packagist)
**Features:**

- **Laravel Integration:** First-class Laravel support
- **PSR Standards:** PSR-7 HTTP, PSR-17 factories
- **Middleware Support:** Custom request/response middleware
- **Caching Layer:** Built-in response caching

**Capabilities:**

- ✅ PHP 8.0+ support
- ✅ Composer package management
- ✅ Laravel service provider
- ✅ Comprehensive test suite

**Source:** [PHP SDK](https://packagist.org/packages/gohighlevel/gohighlevel-api)

## SDK Feature Comparison

| Feature              | Node.js SDK               | Python SDK       | PHP SDK          | Custom Client            |
| -------------------- | ------------------------- | ---------------- | ---------------- | ------------------------ |
| **OAuth Flow**       | ✅ Full implementation    | ✅ Basic support | ✅ Basic support | 🔄 Manual implementation |
| **Token Refresh**    | ✅ Automatic              | ✅ Manual        | ✅ Manual        | 🔄 Manual implementation |
| **Type Safety**      | ✅ TypeScript             | ⚠️ Partial       | ❌ None          | ✅ Full control          |
| **Rate Limiting**    | ✅ Built-in               | ⚠️ Basic         | ❌ None          | ✅ Custom implementation |
| **Webhook Handling** | ✅ Signature verification | ⚠️ Basic         | ❌ None          | ✅ Custom implementation |
| **Maintenance**      | 🔄 GHL managed            | 🔄 GHL managed   | 🔄 GHL managed   | ✅ Full control          |
| **Customization**    | ⚠️ Limited                | ⚠️ Limited       | ⚠️ Limited       | ✅ Full customization    |

## NeuronX Client Strategy Recommendation

### Decision: Use Custom TypeScript Client

**Rationale for Custom Client:**

1. **Stack Alignment:** NeuronX uses TypeScript/NestJS - native SDK support provides better integration
2. **Full Control:** Custom client allows precise error handling, logging, and observability
3. **Performance:** Direct HTTP calls eliminate SDK abstraction overhead
4. **Security:** Custom implementation enables tenant-specific token handling and encryption
5. **Testing:** Full control over mocks and test scenarios
6. **Maintenance:** No external dependency on SDK release cycles

**When SDK Could Be Considered:**

- **Rapid Prototyping:** Quick proof-of-concepts where development speed > control
- **Simple Integrations:** Basic CRUD operations without complex business logic
- **Resource Constraints:** Limited development time or team size

### Recommended Custom Client Architecture

```typescript
// Core client interface
export interface GhlApiClient {
  // Authentication
  authenticate(code: string): Promise<TokenResponse>;
  refreshToken(token: RefreshToken): Promise<TokenResponse>;

  // Core operations
  getContacts(params: ContactQuery): Promise<Contact[]>;
  createContact(data: ContactCreate): Promise<Contact>;
  updateContact(id: string, data: ContactUpdate): Promise<Contact>;

  // Batch operations
  batchCreateContacts(contacts: ContactCreate[]): Promise<BatchResult>;

  // Webhook operations
  validateWebhookSignature(signature: string, payload: any): boolean;
  parseWebhookEvent(payload: any): WebhookEvent;
}

// Implementation with NestJS integration
@Injectable()
export class GhlApiClientImpl implements GhlApiClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService
  ) {}

  async makeRequest<T>(
    endpoint: string,
    options: RequestOptions,
    tenantId: string
  ): Promise<T> {
    const token = await this.getValidToken(tenantId);
    const requestId = generateRequestId();

    try {
      const response = await this.httpService.request({
        ...options,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token.accessToken}`,
          'X-Request-ID': requestId,
          Version: '2021-04-15',
        },
      });

      this.metricsService.recordApiCall(endpoint, 'success', tenantId);
      return response.data;
    } catch (error) {
      this.metricsService.recordApiCall(endpoint, 'error', tenantId);
      throw this.handleError(error, requestId);
    }
  }
}
```

### Implementation Strategy

#### Phase 1: Core Client (Week 1-2)

- [ ] HTTP client setup with Axios/HttpService
- [ ] Authentication flow implementation
- [ ] Basic CRUD operations for Contacts
- [ ] Error handling and retry logic
- [ ] Unit tests and integration tests

#### Phase 2: Advanced Features (Week 3-4)

- [ ] Batch operations support
- [ ] Webhook signature validation
- [ ] Rate limiting and queue management
- [ ] Comprehensive error handling
- [ ] Performance monitoring

#### Phase 3: Production Hardening (Week 5-6)

- [ ] Circuit breaker pattern
- [ ] Advanced retry strategies
- [ ] Request deduplication
- [ ] Comprehensive logging
- [ ] Load testing and optimization

### Migration Path

**If Starting with SDK:**

1. Use SDK for initial development and prototyping
2. Identify performance bottlenecks and missing features
3. Gradually replace SDK calls with custom implementation
4. Complete migration within 4-6 weeks

**Direct Custom Implementation:**

1. Faster to implement production-ready patterns from start
2. Better alignment with existing codebase patterns
3. Easier to add custom requirements and optimizations

### Testing Strategy

#### Unit Testing

```typescript
describe('GhlApiClient', () => {
  it('should handle token refresh automatically', async () => {
    // Mock expired token
    const expiredToken = createExpiredToken();

    // Call API method
    const result = await client.getContacts(tenantId);

    // Verify token was refreshed and API called with new token
    expect(mockHttpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh_token_123',
        }),
      })
    );
  });
});
```

#### Integration Testing

```typescript
describe('GHL API Integration', () => {
  it('should create contact and retrieve it', async () => {
    // Create contact
    const created = await client.createContact({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });

    // Retrieve contact
    const retrieved = await client.getContact(created.id);

    expect(retrieved.email).toBe('test@example.com');
  });
});
```

#### Contract Testing

```typescript
describe('GHL API Contract', () => {
  it('should match documented response schema', async () => {
    const response = await client.getContacts();

    // Validate against OpenAPI schema
    expect(response).toMatchSchema(contactListSchema);
  });
});
```

This custom client strategy provides maximum control, performance, and maintainability for NeuronX's TypeScript/NestJS architecture while ensuring reliable GHL integration.
