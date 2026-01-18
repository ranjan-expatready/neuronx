/**
 * Capability Map Tests - WI-035: Tenant & Organization Authority Model
 */

import { describe, it, expect } from 'vitest';
import { CapabilityMap, OrgRole, Capability } from '../capability-map';

describe('CapabilityMap', () => {
  describe('getCapabilitiesForRole', () => {
    it('should return all capabilities for ENTERPRISE_ADMIN', () => {
      const capabilities = CapabilityMap.getCapabilitiesForRole(
        OrgRole.ENTERPRISE_ADMIN
      );
      expect(capabilities).toContain(Capability.READ_ALL);
      expect(capabilities).toContain(Capability.OVERRIDE_DECISION_ENGINE);
      expect(capabilities.length).toBeGreaterThan(5);
    });

    it('should return limited capabilities for OPERATOR', () => {
      const capabilities = CapabilityMap.getCapabilitiesForRole(
        OrgRole.OPERATOR
      );
      expect(capabilities).toContain(Capability.ASSIST_EXECUTION);
      expect(capabilities).not.toContain(Capability.OVERRIDE_DECISION_ENGINE);
      expect(capabilities.length).toBeLessThan(5);
    });

    it('should return read-only capabilities for VIEWER', () => {
      const capabilities = CapabilityMap.getCapabilitiesForRole(OrgRole.VIEWER);
      expect(capabilities).toContain(Capability.READ_ALL);
      expect(capabilities).not.toContain(Capability.ASSIST_EXECUTION);
      expect(capabilities.length).toBe(1);
    });
  });

  describe('roleHasCapability', () => {
    it('should return true for enterprise admin capabilities', () => {
      expect(
        CapabilityMap.roleHasCapability(
          OrgRole.ENTERPRISE_ADMIN,
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toBe(true);
      expect(
        CapabilityMap.roleHasCapability(
          OrgRole.ENTERPRISE_ADMIN,
          Capability.READ_ALL
        )
      ).toBe(true);
    });

    it('should return false for insufficient role capabilities', () => {
      expect(
        CapabilityMap.roleHasCapability(
          OrgRole.OPERATOR,
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toBe(false);
      expect(
        CapabilityMap.roleHasCapability(
          OrgRole.VIEWER,
          Capability.ASSIST_EXECUTION
        )
      ).toBe(false);
    });
  });

  describe('getRolesWithCapability', () => {
    it('should return roles that have the specified capability', () => {
      const roles = CapabilityMap.getRolesWithCapability(
        Capability.OVERRIDE_DECISION_ENGINE
      );
      expect(roles).toContain(OrgRole.ENTERPRISE_ADMIN);
      expect(roles).not.toContain(OrgRole.OPERATOR);
    });

    it('should return multiple roles for common capabilities', () => {
      const roles = CapabilityMap.getRolesWithCapability(
        Capability.ASSIST_EXECUTION
      );
      expect(roles.length).toBeGreaterThan(1);
      expect(roles).toContain(OrgRole.OPERATOR);
      expect(roles).toContain(OrgRole.TEAM_LEAD);
    });
  });

  describe('validateCapabilityAssignment', () => {
    it('should validate correct capability assignments', () => {
      expect(
        CapabilityMap.validateCapabilityAssignment(
          OrgRole.ENTERPRISE_ADMIN,
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toBe(true);
      expect(
        CapabilityMap.validateCapabilityAssignment(
          OrgRole.OPERATOR,
          Capability.ASSIST_EXECUTION
        )
      ).toBe(true);
    });

    it('should reject invalid capability assignments', () => {
      expect(
        CapabilityMap.validateCapabilityAssignment(
          OrgRole.OPERATOR,
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toBe(false);
      expect(
        CapabilityMap.validateCapabilityAssignment(
          OrgRole.VIEWER,
          Capability.ASSIST_EXECUTION
        )
      ).toBe(false);
    });
  });

  describe('isAdministrativeCapability', () => {
    it('should identify administrative capabilities', () => {
      expect(
        CapabilityMap.isAdministrativeCapability(
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toBe(true);
      expect(
        CapabilityMap.isAdministrativeCapability(
          Capability.MANAGE_ORG_STRUCTURE
        )
      ).toBe(true);
      expect(
        CapabilityMap.isAdministrativeCapability(
          Capability.PROMOTE_PLAYBOOK_VERSION
        )
      ).toBe(true);
    });

    it('should identify non-administrative capabilities', () => {
      expect(
        CapabilityMap.isAdministrativeCapability(Capability.READ_ALL)
      ).toBe(false);
      expect(
        CapabilityMap.isAdministrativeCapability(Capability.ASSIST_EXECUTION)
      ).toBe(false);
    });
  });

  describe('isExecutionCapability', () => {
    it('should identify execution capabilities', () => {
      expect(
        CapabilityMap.isExecutionCapability(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        )
      ).toBe(true);
      expect(
        CapabilityMap.isExecutionCapability(Capability.ASSIST_EXECUTION)
      ).toBe(true);
      expect(
        CapabilityMap.isExecutionCapability(Capability.REVOKE_EXECUTION_TOKENS)
      ).toBe(true);
    });

    it('should identify non-execution capabilities', () => {
      expect(CapabilityMap.isExecutionCapability(Capability.READ_ALL)).toBe(
        false
      );
      expect(
        CapabilityMap.isExecutionCapability(Capability.OVERRIDE_DECISION_ENGINE)
      ).toBe(false);
    });
  });

  describe('getEscalationPath', () => {
    it('should return escalation path for critical capabilities', () => {
      const path = CapabilityMap.getEscalationPath(
        Capability.OVERRIDE_DECISION_ENGINE
      );
      expect(path).toContain(OrgRole.ENTERPRISE_ADMIN);
    });

    it('should return escalation path for approval capabilities', () => {
      const path = CapabilityMap.getEscalationPath(
        Capability.APPROVE_HIGH_RISK_EXECUTION
      );
      expect(path.length).toBeGreaterThan(1);
      expect(path).toContain(OrgRole.TEAM_LEAD);
      expect(path).toContain(OrgRole.AGENCY_ADMIN);
    });
  });

  describe('getCapabilityDescription', () => {
    it('should return descriptions for capabilities', () => {
      expect(
        CapabilityMap.getCapabilityDescription(Capability.READ_ALL)
      ).toContain('Read access');
      expect(
        CapabilityMap.getCapabilityDescription(
          Capability.OVERRIDE_DECISION_ENGINE
        )
      ).toContain('Override');
    });
  });

  describe('getRoleDescription', () => {
    it('should return descriptions for roles', () => {
      expect(
        CapabilityMap.getRoleDescription(OrgRole.ENTERPRISE_ADMIN)
      ).toContain('enterprise control');
      expect(CapabilityMap.getRoleDescription(OrgRole.OPERATOR)).toContain(
        'execution operations'
      );
    });
  });
});
