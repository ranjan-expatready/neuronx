# 0013: Clerk Authentication and RBAC

## Status

Accepted

## Context

NeuronX requires robust authentication and authorization for:

- **Multi-Tenant User Management**: User identities scoped to tenants and workspaces
- **Role-Based Access Control**: Granular permissions for different user types
- **Secure API Access**: JWT-based authentication for service-to-service calls
- **Compliance**: Audit trails for user actions and permission changes
- **Developer Experience**: Simple integration and management
- **Scalability**: Handle thousands of users across hundreds of tenants
- **Security**: Enterprise-grade security with MFA, SSO, and breach protection

Authentication choice impacts:

- Security posture and compliance capabilities
- Developer productivity and integration complexity
- User experience and onboarding friction
- Operational overhead and cost
- Future feature development (SSO, SCIM, etc.)
- Regulatory compliance and audit requirements

Poor authentication leads to:

- Security vulnerabilities and data breaches
- Complex user management and support overhead
- Poor user experience and adoption barriers
- Compliance violations and legal risks
- Development slowdown from custom auth implementation
- Scaling challenges with user growth

## Decision

Adopt Clerk for authentication and user management, with custom RBAC implementation for NeuronX-specific permissions.

**Clerk Responsibilities:**

- **User Registration**: Email/password, social logins, SSO integration
- **Authentication**: JWT token issuance and validation
- **User Management**: Profile management, password reset, MFA
- **Session Management**: Secure session handling and refresh tokens
- **Security Features**: Breach detection, suspicious activity monitoring

**Custom RBAC Implementation:**

- **Role Definitions**: Tenant/workspace-specific roles and permissions
- **Permission Checking**: Request-scoped authorization enforcement
- **Audit Logging**: Permission checks and access decisions
- **Dynamic Permissions**: Runtime permission evaluation based on context

**Abstraction Layer:**

- **AuthService**: Abstract interface for authentication operations
- **UserService**: Abstract interface for user management
- **PermissionService**: Abstract interface for authorization checks
- **AuditService**: Abstract interface for security event logging

## Consequences

### Positive

- **Developer Experience**: Excellent SDKs and documentation
- **Security**: Enterprise-grade security with continuous updates
- **Scalability**: Handles millions of users out of the box
- **Compliance**: SOC 2 compliant with comprehensive audit trails
- **User Experience**: Smooth authentication flows and user management
- **Integration**: Easy integration with NestJS and React applications
- **Cost Effective**: Generous free tier with predictable scaling costs

### Negative

- **Vendor Dependency**: Reliance on Clerk's service availability and pricing
- **Customization Limits**: Some advanced features may require workarounds
- **Data Residency**: User data stored in Clerk's infrastructure
- **Migration Complexity**: Switching providers requires careful planning
- **Feature Gaps**: May need custom implementation for specialized requirements

### Risks

- **Service Outages**: Authentication service downtime affects all users
- **Pricing Changes**: Unexpected cost increases with user growth
- **Feature Limitations**: Advanced requirements may not be supported
- **Data Privacy**: User data subject to Clerk's privacy policies
- **Integration Changes**: API changes can break authentication flows

## Alternatives Considered

### Alternative 1: Auth0

- **Pros**: Feature-rich, enterprise-focused, extensive integrations
- **Cons**: Complex pricing, steeper learning curve, higher cost
- **Rejected**: Complexity and cost for NeuronX's current stage

### Alternative 2: Firebase Auth

- **Pros**: Simple, cost-effective, good integration with GCP
- **Cons**: Limited customization, vendor lock-in concerns
- **Rejected**: Limited RBAC capabilities and customization

### Alternative 3: Custom Implementation

- **Pros**: Full control, custom features, no vendor dependency
- **Cons**: Massive development overhead, security risks, compliance challenges
- **Rejected**: Too risky and resource-intensive for product focus

### Alternative 4: AWS Cognito

- **Pros**: Integrated with AWS ecosystem, cost-effective
- **Cons**: Complex setup, limited developer experience
- **Rejected**: Steep learning curve and integration challenges

## Implementation Strategy

### Clerk Integration Pattern

```typescript
// Auth service abstraction
@Injectable()
export class ClerkAuthService implements AuthService {
  constructor(private clerkClient: ClerkClient) {}

  async validateToken(token: string): Promise<UserContext> {
    try {
      const payload = await this.clerkClient.verifyToken(token);
      return {
        userId: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: await this.getPermissions(payload.sub, payload.tenantId),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.clerkClient.users.getUser(userId);
    return this.mapClerkUserToNeuronxProfile(user);
  }
}
```

### RBAC Implementation

```typescript
// Permission definitions
export enum Permission {
  LEAD_READ = 'lead:read',
  LEAD_WRITE = 'lead:write',
  WORKFLOW_EXECUTE = 'workflow:execute',
  CONFIG_MANAGE = 'config:manage',
  TENANT_ADMIN = 'tenant:admin',
}

// Role definitions
export const Roles = {
  SALES_REP: [Permission.LEAD_READ, Permission.LEAD_WRITE],
  SALES_MANAGER: [
    Permission.LEAD_READ,
    Permission.LEAD_WRITE,
    Permission.WORKFLOW_EXECUTE,
  ],
  REVENUE_OPS: [Permission.LEAD_READ, Permission.CONFIG_MANAGE],
  TENANT_ADMIN: Object.values(Permission),
} as const;

// Authorization guard
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserContext;
    const requiredPermissions = this.getRequiredPermissions(context);

    return this.permissionService.hasPermissions(user, requiredPermissions);
  }
}
```

### Multi-Tenant User Management

- **User Provisioning**: Automatic user creation in tenant contexts
- **Role Assignment**: Workspace and tenant-level role management
- **Permission Inheritance**: Tenant roles apply across workspaces
- **SSO Integration**: Enterprise SSO support through Clerk
- **SCIM Support**: Automated user provisioning and deprovisioning

### Security Implementation

- **JWT Validation**: Request-level token validation and user context extraction
- **Session Management**: Secure session handling with refresh token rotation
- **MFA Enforcement**: Required MFA for sensitive operations
- **Audit Logging**: All authentication and authorization events logged
- **Rate Limiting**: Brute force protection and abuse prevention

### Tenant Context Propagation

```typescript
// Global guard for tenant context
@Injectable()
export class TenantContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserContext;

    // Set tenant context for the request
    TenantContextService.setCurrentTenant(user.tenantId);

    // Validate tenant access
    const tenant = await this.tenantService.getTenant(user.tenantId);
    if (!tenant || !tenant.active) {
      throw new ForbiddenException('Tenant access denied');
    }

    return true;
  }
}
```

### Authorization Patterns

- **Declarative Permissions**: Decorator-based permission requirements
- **Context-Aware Checks**: Permission evaluation based on resource ownership
- **Hierarchical Access**: Tenant admins can access workspace resources
- **Time-Based Permissions**: Temporary elevated access for support scenarios

### Monitoring and Compliance

- **Authentication Metrics**: Login success/failure rates, MFA adoption
- **Authorization Auditing**: Permission check logs with full context
- **Security Events**: Suspicious activity detection and alerting
- **Compliance Reporting**: User access and permission change audit trails

## Related ADRs

- 0008: NestJS Backend Framework
- 0006: Tenant Isolation Strategy
- 0014: REST API with OpenAPI First

## Notes

Clerk provides the scalable, secure authentication foundation required for NeuronX's multi-tenant SaaS model, while custom RBAC enables fine-grained, business-specific authorization.

Key success factors:

- Clean abstraction layer prevents tight coupling to Clerk
- Comprehensive RBAC design covers all user personas and use cases
- Proper tenant context propagation throughout request lifecycle
- Security monitoring and audit logging for compliance
- User experience optimization for authentication flows
- Cost monitoring and user growth planning

The authentication choice enables NeuronX to provide enterprise-grade security while maintaining excellent developer and user experiences.
