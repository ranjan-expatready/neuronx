# Auth and Token Lifecycle

**Last verified:** 2026-01-03
**Sources:** [GHL OAuth Documentation](https://developers.gohighlevel.com/reference/authentication-1), [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)

## OAuth Flow Overview

GoHighLevel uses OAuth 2.0 Authorization Code Grant flow for API access. The flow involves browser-based user authorization followed by server-side token exchange.

### Complete OAuth Flow

```
1. User clicks "Install NeuronX" in GHL Marketplace
   ↓
2. Browser redirects to: /oauth/authorize?client_id=...&redirect_uri=...&scope=...
   ↓
3. User selects Agency/Location and clicks "Authorize"
   ↓
4. GHL redirects to NeuronX callback with: ?code=AUTH_CODE
   ↓
5. NeuronX exchanges code for tokens (POST /oauth/token)
   ↓
6. NeuronX receives: access_token, refresh_token, companyId, locationIds
   ↓
7. NeuronX stores tokens and completes installation
```

## Token Types and Structure

### Company Token (Primary)

Received during initial OAuth installation:

```json
{
  "access_token": "ghl_company_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ghl_refresh_company_xxx",
  "companyId": "company_123",
  "locationIds": ["loc_456", "loc_789"],
  "scope": "companies.readonly locations.readonly contacts.readonly",
  "created_at": 1640995200
}
```

### Location Tokens (Optional)

Sometimes provided during OAuth, or requested separately:

```json
{
  "access_token": "ghl_location_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ghl_refresh_location_xxx",
  "locationId": "loc_456",
  "scope": "contacts.write opportunities.write workflows.read",
  "created_at": 1640995200
}
```

## Token Storage Strategy for NeuronX

### Multi-Tenant Token Storage

Since NeuronX is multi-tenant and GHL has agency/location hierarchy, tokens must be stored with proper isolation:

```typescript
interface NeuronxTokenStorage {
  // Primary: Company token for agency-level operations
  companyToken: TokenRecord;

  // Secondary: Location-specific tokens for workspace operations
  locationTokens: Map<string, TokenRecord>; // locationId -> token
}

interface TokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date; // computed from expires_in
  tokenType: 'company' | 'location';
  locationId?: string; // for location tokens
  scope: string[];
  lastRefreshed: Date;
}
```

### Database Schema

```sql
-- Token storage in NeuronX database
CREATE TABLE ghl_tokens (
  id UUID PRIMARY KEY,
  neuronx_tenant_id UUID NOT NULL,
  neuronx_workspace_id UUID,           -- NULL for company tokens
  ghl_location_id VARCHAR(255),        -- NULL for company tokens
  token_type VARCHAR(50) NOT NULL,     -- 'company' or 'location'
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  scope TEXT[],                        -- PostgreSQL array
  last_refreshed TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(neuronx_tenant_id, ghl_location_id) -- One token per location
);
```

### Token Retrieval Pattern

```typescript
class GhlTokenService {
  async getTokenForWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<TokenRecord> {
    // Try location-specific token first
    const locationToken = await this.getLocationToken(tenantId, workspaceId);
    if (locationToken && this.isValid(locationToken)) {
      return locationToken;
    }

    // Fall back to company token
    const companyToken = await this.getCompanyToken(tenantId);
    if (companyToken && this.isValid(companyToken)) {
      return companyToken;
    }

    throw new Error('No valid GHL token available');
  }

  private isValid(token: TokenRecord): boolean {
    // Add 5-minute buffer for API calls
    return token.expiresAt > new Date(Date.now() + 5 * 60 * 1000);
  }
}
```

## Token Refresh Logic

### Automatic Refresh Flow

```typescript
class TokenRefreshService {
  async ensureValidToken(token: TokenRecord): Promise<TokenRecord> {
    if (this.isValid(token)) {
      return token;
    }

    return await this.refreshToken(token);
  }

  private async refreshToken(token: TokenRecord): Promise<TokenRecord> {
    const response = await fetch(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: process.env.GHL_CLIENT_ID,
          client_secret: process.env.GHL_CLIENT_SECRET,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const newTokenData = await response.json();

    return {
      ...token,
      accessToken: newTokenData.access_token,
      refreshToken: newTokenData.refresh_token || token.refreshToken,
      expiresAt: new Date(Date.now() + newTokenData.expires_in * 1000),
      lastRefreshed: new Date(),
    };
  }
}
```

### Refresh Failure Handling

- **Retry Logic:** 3 attempts with exponential backoff
- **User Notification:** Alert NeuronX admin to re-authorize
- **Graceful Degradation:** Continue with expired token for read operations
- **Audit Logging:** Log all refresh attempts and failures

## Failure Modes and Recovery

### Authentication Failures

#### 401 Unauthorized (Token Expired)

```typescript
// Automatic recovery
try {
  await ghlApi.call(endpoint, token);
} catch (error) {
  if (error.status === 401) {
    const freshToken = await tokenService.refresh(token);
    // Retry with fresh token
    return await ghlApi.call(endpoint, freshToken);
  }
  throw error;
}
```

#### 403 Forbidden (Insufficient Scope)

- **Cause:** Token lacks required OAuth scope
- **Recovery:** Re-authorization required with additional scopes
- **Prevention:** Request all needed scopes during initial OAuth

#### 429 Too Many Requests (Rate Limited)

- **Cause:** Exceeded GHL API rate limits
- **Recovery:** Implement exponential backoff
- **Prevention:** Monitor usage and implement queuing

### Token Revocation Scenarios

#### User Uninstalls App

- **Detection:** Webhook or API call returns 401
- **Recovery:** Remove tokens, notify NeuronX admin
- **Prevention:** Monitor for deauthorization webhooks

#### Location Access Revoked

- **Detection:** API calls to specific location return 403
- **Recovery:** Request new location token or remove location access
- **Prevention:** Regular token validation checks

#### Company Token Expires

- **Detection:** All API calls return 401
- **Recovery:** Full re-authorization required
- **Prevention:** Implement refresh token rotation

## Multi-Tenant Token Management

### Token Provisioning Flow

```typescript
class GhlAuthService {
  async handleOAuthCallback(code: string): Promise<void> {
    // 1. Exchange code for initial tokens
    const tokens = await this.exchangeCodeForTokens(code);

    // 2. Extract tenant information
    const tenantInfo = await this.getTenantInfo(tokens.companyToken);

    // 3. Create NeuronX tenant if doesn't exist
    const neuronxTenant = await this.createNeuronxTenant(tenantInfo);

    // 4. Store company token
    await this.storeToken({
      neuronxTenantId: neuronxTenant.id,
      tokenType: 'company',
      ...tokens.companyToken,
    });

    // 5. Store location tokens if provided
    for (const locationToken of tokens.locationTokens || []) {
      const workspace = await this.findOrCreateWorkspace(
        neuronxTenant.id,
        locationToken.locationId
      );
      await this.storeToken({
        neuronxTenantId: neuronxTenant.id,
        neuronxWorkspaceId: workspace.id,
        ghlLocationId: locationToken.locationId,
        tokenType: 'location',
        ...locationToken,
      });
    }
  }
}
```

### Token Validation and Rotation

- **Daily Validation:** Check token validity for all active tenants
- **Proactive Refresh:** Refresh tokens before expiration (24h buffer)
- **Batch Operations:** Refresh multiple tokens efficiently
- **Failure Alerts:** Notify admins of refresh failures

### Security Considerations

- **Token Encryption:** Encrypt tokens at rest using tenant-specific keys
- **Access Logging:** Log all token usage for audit trails
- **Rotation Policy:** Regular token rotation for enhanced security
- **Scope Minimization:** Request only necessary OAuth scopes

## Integration Testing Strategy

### Token Mocking for Unit Tests

```typescript
const mockValidToken = {
  accessToken: 'ghl_test_token',
  refreshToken: 'ghl_test_refresh',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  tokenType: 'location' as const,
  locationId: 'loc_test',
  scope: ['contacts.readonly', 'opportunities.write'],
  lastRefreshed: new Date(),
};
```

### OAuth Flow Testing

- **Mock OAuth Server:** Simulate GHL OAuth endpoints for testing
- **Token Expiration Tests:** Verify refresh logic works correctly
- **Scope Validation:** Ensure API calls respect token scopes
- **Multi-Tenant Isolation:** Verify tokens don't leak between tenants

This authentication system provides the foundation for secure, scalable GHL integration in NeuronX's multi-tenant architecture.
