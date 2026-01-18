# API Endpoint Matrix

**Last verified:** 2026-01-03
**API Version:** 2021-04-15
**Sources:** [GHL API Reference](https://developers.gohighlevel.com/reference/api-reference)

## Matrix Key

| Column                | Description                                      |
| --------------------- | ------------------------------------------------ |
| **Module**            | GHL feature area (Contacts, Opportunities, etc.) |
| **Use Case**          | NeuronX business scenario                        |
| **Endpoint**          | API path and method                              |
| **Required Scope(s)** | OAuth scopes needed                              |
| **Context**           | Agency or Location level                         |
| **Idempotency**       | Safe retry behavior                              |
| **Rate Limit**        | Known throttling constraints                     |
| **Example**           | Minimal request/response sample                  |
| **Source**            | Official documentation link                      |

## Contacts Module

| Use Case                | Endpoint         | Method | Required Scope(s)   | Context  | Idempotency | Rate Limit | Example Request/Response                                                        |
| ----------------------- | ---------------- | ------ | ------------------- | -------- | ----------- | ---------- | ------------------------------------------------------------------------------- |
| Get contact by ID       | `/contacts/{id}` | GET    | `contacts.readonly` | Location | Safe        | 100/min    | `GET /contacts/contact_123` → `{id, email, phone, ...}`                         |
| List contacts           | `/contacts`      | GET    | `contacts.readonly` | Location | Safe        | 50/min     | `GET /contacts?locationId=loc_123&limit=100` → `{contacts: []}`                 |
| Create contact          | `/contacts`      | POST   | `contacts.write`    | Location | Not safe    | 50/min     | `POST /contacts` `{email, phone, locationId}` → `{contact: {...}}`              |
| Update contact          | `/contacts/{id}` | PUT    | `contacts.write`    | Location | Safe        | 50/min     | `PUT /contacts/contact_123` `{customField: value}` → `{contact: {...}}`         |
| Delete contact          | `/contacts/{id}` | DELETE | `contacts.write`    | Location | Safe        | 20/min     | `DELETE /contacts/contact_123` → `204 No Content`                               |
| Bulk contact operations | `/contacts/bulk` | POST   | `contacts.write`    | Location | Not safe    | 10/min     | `POST /contacts/bulk` `{operation, contacts: []}` → `{success: [], failed: []}` |

**Source:** [Contacts API](https://developers.gohighlevel.com/reference/contacts)

## Opportunities Module

| Use Case            | Endpoint                 | Method | Required Scope(s)        | Context  | Idempotency | Rate Limit | Example Request/Response                                                                   |
| ------------------- | ------------------------ | ------ | ------------------------ | -------- | ----------- | ---------- | ------------------------------------------------------------------------------------------ |
| Get opportunity     | `/opportunities/{id}`    | GET    | `opportunities.readonly` | Location | Safe        | 100/min    | `GET /opportunities/opp_123` → `{id, name, value, stage, ...}`                             |
| List opportunities  | `/opportunities`         | GET    | `opportunities.readonly` | Location | Safe        | 50/min     | `GET /opportunities?locationId=loc_123&pipelineId=pipe_456` → `{opportunities: []}`        |
| Create opportunity  | `/opportunities`         | POST   | `opportunities.write`    | Location | Not safe    | 30/min     | `POST /opportunities` `{name, contactId, pipelineId, locationId}` → `{opportunity: {...}}` |
| Update opportunity  | `/opportunities/{id}`    | PUT    | `opportunities.write`    | Location | Safe        | 30/min     | `PUT /opportunities/opp_123` `{stageId: "stage_789"}` → `{opportunity: {...}}`             |
| Delete opportunity  | `/opportunities/{id}`    | DELETE | `opportunities.write`    | Location | Safe        | 20/min     | `DELETE /opportunities/opp_123` → `204 No Content`                                         |
| Get pipeline stages | `/pipelines/{id}/stages` | GET    | `opportunities.readonly` | Location | Safe        | 100/min    | `GET /pipelines/pipe_123/stages` → `{stages: []}`                                          |

**Source:** [Opportunities API](https://developers.gohighlevel.com/reference/opportunities)

## Workflows Module

| Use Case         | Endpoint                  | Method | Required Scope(s)    | Context  | Idempotency | Rate Limit | Example Request/Response                                                                  |
| ---------------- | ------------------------- | ------ | -------------------- | -------- | ----------- | ---------- | ----------------------------------------------------------------------------------------- |
| List workflows   | `/workflows`              | GET    | `workflows.readonly` | Location | Safe        | 30/min     | `GET /workflows?locationId=loc_123` → `{workflows: []}`                                   |
| Get workflow     | `/workflows/{id}`         | GET    | `workflows.readonly` | Location | Safe        | 100/min    | `GET /workflows/workflow_123` → `{id, name, triggers, steps, ...}`                        |
| Trigger workflow | `/workflows/{id}/trigger` | POST   | `workflows.write`    | Location | Not safe    | 20/min     | `POST /workflows/workflow_123/trigger` `{contactId, eventData}` → `{executionId, status}` |
| Create workflow  | `/workflows`              | POST   | `workflows.write`    | Location | Not safe    | 10/min     | `POST /workflows` `{name, triggers, steps, locationId}` → `{workflow: {...}}`             |
| Update workflow  | `/workflows/{id}`         | PUT    | `workflows.write`    | Location | Safe        | 10/min     | `PUT /workflows/workflow_123` `{steps: [...]}` → `{workflow: {...}}`                      |
| Delete workflow  | `/workflows/{id}`         | DELETE | `workflows.write`    | Location | Safe        | 10/min     | `DELETE /workflows/workflow_123` → `204 No Content`                                       |

**Source:** [Workflows API](https://developers.gohighlevel.com/reference/workflows)

## Conversations Module

| Use Case            | Endpoint                  | Method | Required Scope(s)            | Context  | Idempotency | Rate Limit | Example Request/Response                                                                 |
| ------------------- | ------------------------- | ------ | ---------------------------- | -------- | ----------- | ---------- | ---------------------------------------------------------------------------------------- |
| List conversations  | `/conversations`          | GET    | `conversations.readonly`     | Location | Safe        | 30/min     | `GET /conversations?locationId=loc_123&status=active` → `{conversations: []}`            |
| Get conversation    | `/conversations/{id}`     | GET    | `conversations.readonly`     | Location | Safe        | 100/min    | `GET /conversations/conv_123` → `{id, contactId, messages, status, ...}`                 |
| Send message        | `/conversations/messages` | POST   | `conversations.message.send` | Location | Not safe    | 50/min     | `POST /conversations/messages` `{conversationId, type, message}` → `{message: {...}}`    |
| Create conversation | `/conversations`          | POST   | `conversations.write`        | Location | Not safe    | 30/min     | `POST /conversations` `{contactId, type, message, locationId}` → `{conversation: {...}}` |
| Update conversation | `/conversations/{id}`     | PUT    | `conversations.write`        | Location | Safe        | 30/min     | `PUT /conversations/conv_123` `{status: "closed"}` → `{conversation: {...}}`             |

**Source:** [Conversations API](https://developers.gohighlevel.com/reference/conversations)

## Campaigns Module

| Use Case           | Endpoint                | Method | Required Scope(s)    | Context  | Idempotency | Rate Limit | Example Request/Response                                                      |
| ------------------ | ----------------------- | ------ | -------------------- | -------- | ----------- | ---------- | ----------------------------------------------------------------------------- |
| List campaigns     | `/campaigns`            | GET    | `campaigns.readonly` | Location | Safe        | 30/min     | `GET /campaigns?locationId=loc_123` → `{campaigns: []}`                       |
| Get campaign       | `/campaigns/{id}`       | GET    | `campaigns.readonly` | Location | Safe        | 100/min    | `GET /campaigns/campaign_123` → `{id, name, steps, status, ...}`              |
| Create campaign    | `/campaigns`            | POST   | `campaigns.write`    | Location | Not safe    | 10/min     | `POST /campaigns` `{name, steps, triggers, locationId}` → `{campaign: {...}}` |
| Start campaign     | `/campaigns/{id}/start` | POST   | `campaigns.write`    | Location | Safe        | 20/min     | `POST /campaigns/campaign_123/start` → `{status: "running"}`                  |
| Stop campaign      | `/campaigns/{id}/stop`  | POST   | `campaigns.write`    | Location | Safe        | 20/min     | `POST /campaigns/campaign_123/stop` → `{status: "stopped"}`                   |
| Get campaign stats | `/campaigns/{id}/stats` | GET    | `campaigns.readonly` | Location | Safe        | 50/min     | `GET /campaigns/campaign_123/stats` → `{sent, opened, clicked, ...}`          |

**Source:** [Campaigns API](https://developers.gohighlevel.com/reference/campaigns)

## Calendars Module

| Use Case                  | Endpoint                  | Method | Required Scope(s)    | Context  | Idempotency | Rate Limit | Example Request/Response                                                                    |
| ------------------------- | ------------------------- | ------ | -------------------- | -------- | ----------- | ---------- | ------------------------------------------------------------------------------------------- |
| List calendar events      | `/calendars/events`       | GET    | `calendars.readonly` | Location | Safe        | 50/min     | `GET /calendars/events?locationId=loc_123&start=2024-01-01&end=2024-01-31` → `{events: []}` |
| Get calendar event        | `/calendars/events/{id}`  | GET    | `calendars.readonly` | Location | Safe        | 100/min    | `GET /calendars/events/event_123` → `{id, title, start, end, contactId, ...}`               |
| Create calendar event     | `/calendars/events`       | POST   | `calendars.write`    | Location | Not safe    | 30/min     | `POST /calendars/events` `{title, start, end, contactId, locationId}` → `{event: {...}}`    |
| Update calendar event     | `/calendars/events/{id}`  | PUT    | `calendars.write`    | Location | Safe        | 30/min     | `PUT /calendars/events/event_123` `{title: "Updated Title"}` → `{event: {...}}`             |
| Delete calendar event     | `/calendars/events/{id}`  | DELETE | `calendars.write`    | Location | Safe        | 20/min     | `DELETE /calendars/events/event_123` → `204 No Content`                                     |
| Get calendar availability | `/calendars/availability` | GET    | `calendars.readonly` | Location | Safe        | 30/min     | `GET /calendars/availability?locationId=loc_123&date=2024-01-15` → `{availableSlots: []}`   |

**Source:** [Calendars API](https://developers.gohighlevel.com/reference/calendars)

## Users Module

| Use Case             | Endpoint                  | Method | Required Scope(s) | Context | Idempotency | Rate Limit | Example Request/Response                                                        |
| -------------------- | ------------------------- | ------ | ----------------- | ------- | ----------- | ---------- | ------------------------------------------------------------------------------- |
| List users           | `/users`                  | GET    | `users.readonly`  | Agency  | Safe        | 30/min     | `GET /users?companyId=comp_123` → `{users: []}`                                 |
| Get user             | `/users/{id}`             | GET    | `users.readonly`  | Agency  | Safe        | 100/min    | `GET /users/user_123` → `{id, email, name, role, locations, ...}`               |
| Create user          | `/users`                  | POST   | `users.write`     | Agency  | Not safe    | 10/min     | `POST /users` `{email, name, roleId, locationIds, companyId}` → `{user: {...}}` |
| Update user          | `/users/{id}`             | PUT    | `users.write`     | Agency  | Safe        | 20/min     | `PUT /users/user_123` `{roleId: "role_456"}` → `{user: {...}}`                  |
| Delete user          | `/users/{id}`             | DELETE | `users.write`     | Agency  | Safe        | 10/min     | `DELETE /users/user_123` → `204 No Content`                                     |
| Get user permissions | `/users/{id}/permissions` | GET    | `users.readonly`  | Agency  | Safe        | 50/min     | `GET /users/user_123/permissions` → `{permissions: [], roles: []}`              |

**Source:** [Users API](https://developers.gohighlevel.com/reference/users)

## Locations/Agency Module

| Use Case         | Endpoint          | Method | Required Scope(s)    | Context | Idempotency | Rate Limit | Example Request/Response                                             |
| ---------------- | ----------------- | ------ | -------------------- | ------- | ----------- | ---------- | -------------------------------------------------------------------- |
| List locations   | `/locations`      | GET    | `locations.readonly` | Agency  | Safe        | 30/min     | `GET /locations?companyId=comp_123` → `{locations: []}`              |
| Get location     | `/locations/{id}` | GET    | `locations.readonly` | Agency  | Safe        | 100/min    | `GET /locations/loc_123` → `{id, name, address, settings, ...}`      |
| Create location  | `/locations`      | POST   | `locations.write`    | Agency  | Not safe    | 5/min      | `POST /locations` `{name, address, companyId}` → `{location: {...}}` |
| Update location  | `/locations/{id}` | PUT    | `locations.write`    | Agency  | Safe        | 10/min     | `PUT /locations/loc_123` `{settings: {...}}` → `{location: {...}}`   |
| Get company info | `/companies/{id}` | GET    | `companies.readonly` | Agency  | Safe        | 30/min     | `GET /companies/comp_123` → `{id, name, plan, settings, ...}`        |
| Update company   | `/companies/{id}` | PUT    | `companies.write`    | Agency  | Safe        | 10/min     | `PUT /companies/comp_123` `{settings: {...}}` → `{company: {...}}`   |

**Source:** [Locations API](https://developers.gohighlevel.com/reference/locations), [Companies API](https://developers.gohighlevel.com/reference/companies)

## Rate Limit Categories

| Category                 | Typical Limits | Notes                                 |
| ------------------------ | -------------- | ------------------------------------- |
| **Read Operations**      | 30-100/min     | Safe for background sync operations   |
| **Write Operations**     | 10-50/min      | Implement queuing for bulk operations |
| **Bulk Operations**      | 5-20/min       | Reserve for maintenance windows       |
| **Sensitive Operations** | 5-10/min       | User creation, location management    |

## Error Response Patterns

```json
// Rate Limit Exceeded
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 60
}

// Insufficient Scope
{
  "error": "insufficient_scope",
  "message": "Missing required scope: contacts.write"
}

// Invalid Location Context
{
  "error": "invalid_location",
  "message": "Contact does not belong to specified location"
}
```

## Implementation Recommendations

### Request Headers (Always Include)

```javascript
const headers = {
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Version: '2021-04-15',
};
```

### Error Handling Strategy

```javascript
async function apiCall(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);

    if (response.status === 401) {
      // Token expired - trigger refresh
      await refreshToken();
      return apiCall(endpoint, options); // Retry once
    }

    if (response.status === 429) {
      // Rate limited - exponential backoff
      const retryAfter = response.headers.get('retry-after');
      await sleep(parseInt(retryAfter) * 1000);
      return apiCall(endpoint, options);
    }

    if (response.status === 403) {
      // Insufficient scope or location access
      throw new Error('Insufficient permissions for operation');
    }

    return response.json();
  } catch (error) {
    // Log correlation ID for debugging
    console.error(`API Error [${correlationId}]:`, error);
    throw error;
  }
}
```

This endpoint matrix provides the complete API reference for NeuronX's GHL integration, with all critical information needed for reliable, production-ready implementations.
