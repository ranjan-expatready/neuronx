/**
 * Authority Resolver Tests - WI-035: Tenant & Organization Authority Model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuthorityResolver,
  OrgRole,
  Capability,
  OrgAuthzError,
  InsufficientCapabilitiesError,
} from '../authority-resolver';

describe('AuthorityResolver', () => {
  let resolver: AuthorityResolver;

  beforeEach(() => {
    resolver = new AuthorityResolver();
  });

  describe('resolveCapabilities', () => {
    it('should resolve capabilities from role assignments', () => {
      const context = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_1',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: OrgRole.OPERATOR,
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const capabilities = resolver.resolveCapabilities(context);

      expect(capabilities.has(Capability.ASSIST_EXECUTION)).toBe(true);
      expect(capabilities.has(Capability.APPROVE_MEDIUM_RISK_EXECUTION)).toBe(
        true
      );
      expect(capabilities.has(Capability.OVERRIDE_DECISION_ENGINE)).toBe(false);
    });

    it('should combine capabilities from multiple role assignments', () => {
      const context = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_1',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: OrgRole.OPERATOR,
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ra_2',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: OrgRole.VIEWER,
            scopeType: 'enterprise',
            scopeId: 'ent_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const capabilities = resolver.resolveCapabilities(context);

      expect(capabilities.has(Capability.ASSIST_EXECUTION)).toBe(true);
      expect(capabilities.has(Capability.READ_ALL)).toBe(true);
    });

    it('should ignore revoked role assignments', () => {
      const context = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_1',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: OrgRole.OPERATOR,
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
            revokedAt: new Date(), // Revoked
          },
        ],
      };

      const capabilities = resolver.resolveCapabilities(context);

      expect(capabilities.size).toBe(0);
    });
  });

  describe('hasCapability', () => {
    const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
      {
        id: 'ra_1',
        tenantId: 'tenant_1',
        memberId: 'member_1',
        role: OrgRole.OPERATOR,
        scopeType: 'team',
        scopeId: 'team_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    it('should return true for capabilities the user has', () => {
      expect(resolver.hasCapability(context, Capability.ASSIST_EXECUTION)).toBe(
        true
      );
      expect(
        resolver.hasCapability(
          context,
          Capability.APPROVE_MEDIUM_RISK_EXECUTION
        )
      ).toBe(true);
    });

    it('should return false for capabilities the user does not have', () => {
      expect(
        resolver.hasCapability(context, Capability.OVERRIDE_DECISION_ENGINE)
      ).toBe(false);
      expect(
        resolver.hasCapability(context, Capability.PROMOTE_PLAYBOOK_VERSION)
      ).toBe(false);
    });
  });

  describe('assertCapability', () => {
    const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
      {
        id: 'ra_1',
        tenantId: 'tenant_1',
        memberId: 'member_1',
        role: OrgRole.OPERATOR,
        scopeType: 'team',
        scopeId: 'team_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    it('should not throw for capabilities the user has', () => {
      expect(() =>
        resolver.assertCapability(context, Capability.ASSIST_EXECUTION)
      ).not.toThrow();
    });

    it('should throw InsufficientCapabilitiesError for missing capabilities', () => {
      expect(() =>
        resolver.assertCapability(context, Capability.OVERRIDE_DECISION_ENGINE)
      ).toThrow(InsufficientCapabilitiesError);
    });
  });

  describe('scope checks', () => {
    // Note: These tests assume no parent scope access for now
    // TODO: Update when parent scope inheritance is implemented

    it('should allow direct team scope access', () => {
      const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
        {
          id: 'ra_1',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.OPERATOR,
          scopeType: 'team',
          scopeId: 'team_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(resolver.canActOnTeam(context, 'team_1')).toBe(true);
      expect(resolver.canActOnTeam(context, 'team_2')).toBe(false);
    });

    it('should allow direct enterprise scope access', () => {
      const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
        {
          id: 'ra_1',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.ENTERPRISE_ADMIN,
          scopeType: 'enterprise',
          scopeId: 'ent_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(resolver.canActOnEnterprise(context, 'ent_1')).toBe(true);
      expect(resolver.canActOnEnterprise(context, 'ent_2')).toBe(false);
    });
  });

  describe('assertSufficientAuthority', () => {
    const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
      {
        id: 'ra_1',
        tenantId: 'tenant_1',
        memberId: 'member_1',
        role: OrgRole.OPERATOR,
        scopeType: 'team',
        scopeId: 'team_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    it('should not throw for sufficient authority', () => {
      expect(() =>
        resolver.assertSufficientAuthority(context, [
          Capability.ASSIST_EXECUTION,
        ])
      ).not.toThrow();
    });

    it('should throw for insufficient capabilities', () => {
      expect(() =>
        resolver.assertSufficientAuthority(context, [
          Capability.OVERRIDE_DECISION_ENGINE,
        ])
      ).toThrow(InsufficientCapabilitiesError);
    });
  });

  describe('getHighestRole', () => {
    it('should return the highest role from assignments', () => {
      const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
        {
          id: 'ra_1',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.OPERATOR,
          scopeType: 'team',
          scopeId: 'team_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ra_2',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.TEAM_LEAD,
          scopeType: 'team',
          scopeId: 'team_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(resolver.getHighestRole(context)).toBe(OrgRole.TEAM_LEAD);
    });
  });

  describe('capability categorization', () => {
    it('should identify administrative capabilities', () => {
      const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
        {
          id: 'ra_1',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.ENTERPRISE_ADMIN,
          scopeType: 'enterprise',
          scopeId: 'ent_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(resolver.hasAdministrativeCapabilities(context)).toBe(true);
    });

    it('should identify execution capabilities', () => {
      const context = resolver.createContext('tenant_1', 'member_1', 'user_1', [
        {
          id: 'ra_1',
          tenantId: 'tenant_1',
          memberId: 'member_1',
          role: OrgRole.OPERATOR,
          scopeType: 'team',
          scopeId: 'team_1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      expect(resolver.hasExecutionCapabilities(context)).toBe(true);
    });
  });
});
