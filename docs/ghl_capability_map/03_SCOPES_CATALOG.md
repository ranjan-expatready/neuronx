# OAuth Scopes Catalog

**Last verified:** 2026-01-03
**Sources:** [GHL OAuth Scopes](https://developers.gohighlevel.com/reference/authentication-1), [GHL API Reference](https://developers.gohighlevel.com/reference/api-reference)

## Scope Assessment Framework

### Risk Levels

- **🟢 Low Risk:** Read-only operations, no sensitive data, reversible actions
- **🟡 Medium Risk:** Write operations, customer data modification, requires trust
- **🔴 High Risk:** Billing changes, permanent deletions, sensitive operations

### Scope Categories

- **Read Operations:** Access to view data and configurations
- **Write Operations:** Ability to create, update, or delete data
- **Sensitive Operations:** Access to billing, user management, or security settings

## Core Scopes for NeuronX

| Scope                    | What It Enables                                   | Risk Level | NeuronX Features                                       | Source Link                                                                     |
| ------------------------ | ------------------------------------------------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `contacts.readonly`      | Read contact records, custom fields, tags         | 🟢 Low     | Lead ingestion, scoring display, reporting             | [Contacts API](https://developers.gohighlevel.com/reference/contacts)           |
| `contacts.write`         | Create, update, delete contacts and custom fields | 🟡 Medium  | Contact synchronization, lead updates, data enrichment | [Contacts API](https://developers.gohighlevel.com/reference/contacts)           |
| `opportunities.readonly` | Read opportunity records, pipeline stages, values | 🟢 Low     | Pipeline reporting, opportunity tracking               | [Opportunities API](https://developers.gohighlevel.com/reference/opportunities) |
| `opportunities.write`    | Create, update opportunities, change stages       | 🟡 Medium  | Deal creation, stage progression, value updates        | [Opportunities API](https://developers.gohighlevel.com/reference/opportunities) |
| `campaigns.readonly`     | Read campaign configurations and performance      | 🟢 Low     | Campaign analytics, performance reporting              | [Campaigns API](https://developers.gohighlevel.com/reference/campaigns)         |
| `campaigns.write`        | Create, update, send campaigns                    | 🔴 High    | Automated campaign triggering, sequence management     | [Campaigns API](https://developers.gohighlevel.com/reference/campaigns)         |
| `workflows.readonly`     | Read workflow configurations and triggers         | 🟢 Low     | Workflow monitoring, automation analysis               | [Workflows API](https://developers.gohighlevel.com/reference/workflows)         |
| `workflows.write`        | Create, update, trigger workflows                 | 🔴 High    | Automated workflow execution, lead nurturing           | [Workflows API](https://developers.gohighlevel.com/reference/workflows)         |

## Communication Scopes

| Scope                          | What It Enables                        | Risk Level | NeuronX Features                                 | Source Link                                                                     |
| ------------------------------ | -------------------------------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `conversations.readonly`       | Read conversation history and messages | 🟢 Low     | Communication tracking, response analysis        | [Conversations API](https://developers.gohighlevel.com/reference/conversations) |
| `conversations.write`          | Send messages, create conversations    | 🟡 Medium  | Automated responses, communication orchestration | [Conversations API](https://developers.gohighlevel.com/reference/conversations) |
| `conversations.message.send`   | Send messages via SMS, email, etc.     | 🟡 Medium  | Multi-channel communication, sequence execution  | [Messages API](https://developers.gohighlevel.com/reference/messages)           |
| `conversations.message.delete` | Delete sent messages                   | 🟡 Medium  | Message cleanup, compliance management           | [Messages API](https://developers.gohighlevel.com/reference/messages)           |

## Administrative Scopes

| Scope                | What It Enables                       | Risk Level | NeuronX Features                        | Source Link                                                             |
| -------------------- | ------------------------------------- | ---------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `locations.readonly` | Read location/sub-account information | 🟢 Low     | Multi-tenant setup, location discovery  | [Locations API](https://developers.gohighlevel.com/reference/locations) |
| `locations.write`    | Create, update location settings      | 🔴 High    | Location management, configuration      | [Locations API](https://developers.gohighlevel.com/reference/locations) |
| `users.readonly`     | Read user accounts and permissions    | 🟢 Low     | User management, permission mapping     | [Users API](https://developers.gohighlevel.com/reference/users)         |
| `users.write`        | Create, update user accounts          | 🔴 High    | User provisioning, role management      | [Users API](https://developers.gohighlevel.com/reference/users)         |
| `companies.readonly` | Read agency/company information       | 🟢 Low     | Agency setup, billing integration       | [Companies API](https://developers.gohighlevel.com/reference/companies) |
| `companies.write`    | Update company settings               | 🔴 High    | Agency configuration, integration setup | [Companies API](https://developers.gohighlevel.com/reference/companies) |

## Sensitive/High-Risk Scopes

| Scope              | What It Enables                | Risk Level | Why High Risk                             | Source Link                                                             |
| ------------------ | ------------------------------ | ---------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `locations.delete` | Delete locations/sub-accounts  | 🔴 High    | Permanent data loss, business disruption  | [Locations API](https://developers.gohighlevel.com/reference/locations) |
| `contacts.delete`  | Delete contact records         | 🔴 High    | GDPR compliance, data recovery challenges | [Contacts API](https://developers.gohighlevel.com/reference/contacts)   |
| `users.delete`     | Delete user accounts           | 🔴 High    | Access disruption, security implications  | [Users API](https://developers.gohighlevel.com/reference/users)         |
| `campaigns.delete` | Delete campaign configurations | 🔴 High    | Historical data loss, compliance issues   | [Campaigns API](https://developers.gohighlevel.com/reference/campaigns) |
| `billing.readonly` | Read billing information       | 🟡 Medium  | Financial data access, privacy concerns   | [Billing API](https://developers.gohighlevel.com/reference/billing)     |
| `billing.write`    | Modify billing settings        | 🔴 High    | Financial impact, unauthorized changes    | [Billing API](https://developers.gohighlevel.com/reference/billing)     |

## NeuronX MVP Scope Requirements

### Essential Scopes (Must Request)

```typescript
const essentialScopes = [
  'contacts.readonly', // Lead ingestion and display
  'contacts.write', // Contact synchronization
  'opportunities.readonly', // Pipeline reporting
  'opportunities.write', // Deal management
  'locations.readonly', // Multi-tenant setup
  'workflows.readonly', // Workflow monitoring
];
```

### Recommended Scopes (Should Request)

```typescript
const recommendedScopes = [
  'campaigns.readonly', // Campaign analytics
  'conversations.readonly', // Communication tracking
  'users.readonly', // User management
];
```

### Optional Scopes (Nice to Have)

```typescript
const optionalScopes = [
  'campaigns.write', // Automated campaigns
  'conversations.write', // Automated responses
  'workflows.write', // Workflow automation
  'conversations.message.send', // Communication orchestration
];
```

## Scope Request Strategy

### Initial Installation

Request minimal essential scopes first to reduce user friction:

```typescript
const initialScopes = essentialScopes.join(' ');
// "contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly workflows.readonly"
```

### Progressive Authorization

After initial installation, request additional scopes as features are enabled:

```typescript
const expansionScopes = recommendedScopes.concat(optionalScopes);
// Request in batches to avoid overwhelming users
```

### Scope Change Handling

When adding new scopes:

1. **User Communication:** Explain why additional permissions are needed
2. **Graceful Degradation:** Features work without optional scopes
3. **Re-authorization Flow:** Guide users through scope expansion
4. **Audit Logging:** Track scope changes and user consents

## Security and Compliance Considerations

### Data Privacy

- **Minimal Scopes:** Request only necessary permissions
- **Purpose Limitation:** Use scopes only for stated purposes
- **Data Retention:** Comply with data retention requirements
- **User Consent:** Maintain clear records of scope authorizations

### Risk Mitigation

- **Scope Auditing:** Regularly review granted scopes vs. usage
- **Access Logging:** Log all API calls with scope context
- **Revocation Handling:** Gracefully handle scope revocation
- **Security Reviews:** Regular assessment of scope requirements

### Compliance Frameworks

- **GDPR:** Data processing purposes must match authorized scopes
- **SOX:** Financial data access requires appropriate controls
- **Industry Standards:** Align with security best practices

## Implementation Guidelines

### Scope Validation

```typescript
class ScopeValidator {
  hasRequiredScopes(token: TokenRecord, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => token.scope.includes(scope));
  }

  getMissingScopes(token: TokenRecord, requiredScopes: string[]): string[] {
    return requiredScopes.filter(scope => !token.scope.includes(scope));
  }
}
```

### Error Handling

```typescript
class GhlApiClient {
  async call(endpoint: string, token: TokenRecord, requiredScopes: string[]) {
    if (!this.scopeValidator.hasRequiredScopes(token, requiredScopes)) {
      throw new Error(
        `Missing required scopes: ${this.scopeValidator.getMissingScopes(token, requiredScopes).join(', ')}`
      );
    }

    // Proceed with API call
    return await this.makeRequest(endpoint, token);
  }
}
```

### User Experience

- **Clear Permissions:** Explain what each scope enables in plain language
- **Progressive Disclosure:** Request scopes as features are used
- **Opt-in Design:** Users can decline optional scopes without breaking core functionality
- **Transparency:** Show active scopes and their usage in NeuronX interface

This scope catalog ensures NeuronX requests appropriate permissions while maintaining security, compliance, and user trust.
