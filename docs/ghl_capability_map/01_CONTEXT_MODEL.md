# GHL Context Model

**Last verified:** 2026-01-03
**Sources:** [GHL API Reference](https://developers.gohighlevel.com/reference/locations-1), [GHL Authentication](https://developers.gohighlevel.com/reference/authentication-1)

## GHL Conceptual Hierarchy

GoHighLevel uses a hierarchical model for organizing data and permissions. Understanding this model is critical for NeuronX's multi-tenant architecture and token management.

```
Agency (Top Level)
├── Users (Agency-level permissions)
├── Locations/Sub-accounts (Business units)
│   ├── Contacts (Customers)
│   ├── Opportunities (Sales deals)
│   ├── Pipelines (Sales processes)
│   ├── Workflows (Automation)
│   ├── Campaigns (Marketing)
│   └── Communications (Emails, SMS, etc.)
└── Settings (Agency-wide configuration)
```

## Key Entities

### Agency

- **Definition:** Top-level organizational container (typically a business with multiple locations)
- **Purpose:** Manages users, billing, and cross-location settings
- **Token Type:** Company token (granted during OAuth install)
- **Scope:** All locations under the agency
- **NeuronX Mapping:** Maps to NeuronX "tenant" concept

### Location/Sub-account

- **Definition:** Individual business locations or departments (e.g., "Main Office", "Downtown Branch")
- **Purpose:** Contains customer data, sales processes, and local operations
- **Token Type:** Location-specific tokens (derived from company token)
- **Scope:** Data and operations within that location only
- **NeuronX Mapping:** Maps to NeuronX "workspace" concept

### Users

- **Definition:** Agency or location staff members
- **Purpose:** Access and manage agency/location data
- **Permissions:** Role-based access control (admin, manager, user)
- **Context:** Can have agency-level or location-specific permissions

### Company vs Location Tokens

#### Company Token (Agency Level)

```json
{
  "access_token": "ghl_company_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "companyId": "company_123",
  "locationIds": ["loc_456", "loc_789"],
  "scope": "companies.readonly locations.readonly contacts.readonly"
}
```

**Capabilities:**

- ✅ Read agency information
- ✅ List all locations
- ✅ Access location-specific data (with location context)
- ❌ Create/modify agency settings
- ❌ Access billing information

**Use Cases:**

- Initial OAuth setup and location discovery
- Cross-location analytics and reporting
- Agency-wide configuration management

#### Location Token (Sub-account Level)

```json
{
  "access_token": "ghl_location_xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "locationId": "loc_456",
  "scope": "contacts.write opportunities.write workflows.read"
}
```

**Capabilities:**

- ✅ Full CRUD on location-specific data
- ✅ Execute workflows and automations
- ✅ Send communications from location
- ❌ Access other locations' data
- ❌ Modify agency settings

**Use Cases:**

- Contact management and updates
- Opportunity creation and tracking
- Workflow execution and monitoring
- Communication sending

## Data Isolation Model

### Location-Scoped Data

- **Contacts:** Customer records belong to specific locations
- **Opportunities:** Sales deals are location-specific
- **Pipelines:** Sales processes can be location-specific
- **Workflows:** Automations may be location or agency-wide
- **Communications:** Sent from and associated with locations

### Agency-Scoped Data

- **Users:** Can access multiple locations based on permissions
- **Custom Fields:** May be agency-wide or location-specific
- **Tags:** Can be shared across locations
- **Campaigns:** May span multiple locations

## Token Lifecycle in NeuronX

### OAuth Installation Flow

1. **Agency Install:** User authorizes at agency level
2. **Company Token:** NeuronX receives company-level access token
3. **Location Discovery:** Use company token to list all locations
4. **Location Tokens:** Request location-specific tokens as needed
5. **Token Storage:** Store tokens by locationId for NeuronX workspace mapping

### Token Storage Strategy

```typescript
interface TokenStorage {
  // Company-level token for agency operations
  companyToken: StoredToken;

  // Location-specific tokens mapped to NeuronX workspaces
  locationTokens: Record<string, StoredToken>; // locationId -> token
}

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  locationId?: string; // undefined for company tokens
  scope: string[];
}
```

### Multi-Tenant Mapping

```
GHL Agency → NeuronX Tenant
├── GHL Location A → NeuronX Workspace A
├── GHL Location B → NeuronX Workspace B
└── GHL Location C → NeuronX Workspace C
```

### Permission Inheritance

- **Agency Users:** Can access all locations (NeuronX tenant admins)
- **Location Users:** Can access specific locations (NeuronX workspace users)
- **Role Mapping:** GHL roles map to NeuronX permission sets

## API Context Requirements

### Location Context Headers

Many GHL APIs require explicit location context:

```bash
# Required for location-specific operations
Authorization: Bearer {location_token}
Version: 2021-04-15
Content-Type: application/json

# Body or query parameter
{
  "locationId": "loc_456"  // Often required even with location token
}
```

### Company Context Headers

Agency-level operations use company tokens:

```bash
Authorization: Bearer {company_token}
Version: 2021-04-15
Content-Type: application/json
```

## Common Integration Patterns

### Initial Setup (Company Token)

```typescript
// 1. OAuth callback - receive company token
// 2. Discover locations
GET /locations
Authorization: Bearer {company_token}

// 3. Request location tokens if needed
// Note: GHL may provide location tokens during OAuth
```

### Data Operations (Location Token)

```typescript
// Contact operations
GET /contacts?locationId={locationId}
Authorization: Bearer {location_token}

// Opportunity creation
POST /opportunities
Authorization: Bearer {location_token}
Content-Type: application/json

{
  "locationId": "{locationId}",
  "contactId": "{contactId}",
  "name": "New Opportunity",
  "pipelineId": "{pipelineId}"
}
```

### Webhook Context

Webhooks include location context in payload:

```json
{
  "event": "contact.created",
  "locationId": "loc_456",
  "contact": {
    "id": "contact_123",
    "locationId": "loc_456"
    // ... contact data
  }
}
```

## NeuronX Architecture Implications

### Tenant Isolation

- **Company Token:** Stored at NeuronX tenant level
- **Location Tokens:** Stored at NeuronX workspace level
- **Data Segregation:** Location data automatically isolated by token scope

### Permission Mapping

- **Agency Level:** NeuronX tenant administrators
- **Location Level:** NeuronX workspace users with location-specific permissions
- **Role Translation:** GHL roles map to NeuronX permission sets

### Error Handling

- **Invalid Location:** 403 Forbidden (location token doesn't match requested location)
- **Insufficient Scope:** 403 Forbidden (token lacks required permissions)
- **Token Expired:** 401 Unauthorized (requires refresh or re-auth)

Understanding GHL's context model is essential for building NeuronX's multi-tenant architecture. The agency/location hierarchy directly maps to NeuronX's tenant/workspace model, enabling clean data isolation and permission management.
