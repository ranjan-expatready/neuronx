/**
 * Surface Gates - WI-061: UI Infrastructure & Governance Layer
 *
 * Role-based UI surface access control driven by backend authority context
 */

import { UiSurface, SkillTier, UiSdkError } from '../types';
import { principalService } from '../auth/principal';

/**
 * Surface Gate Manager
 * Controls access to UI surfaces based on backend-provided authority
 */
export class SurfaceGateManager {
  private static instance: SurfaceGateManager;

  static getInstance(): SurfaceGateManager {
    if (!SurfaceGateManager.instance) {
      SurfaceGateManager.instance = new SurfaceGateManager();
    }
    return SurfaceGateManager.instance;
  }

  /**
   * Check if current user can access a specific UI surface
   */
  async canAccessSurface(surface: UiSurface): Promise<boolean> {
    try {
      const context = await principalService.getPrincipalContext();
      return context.availableSurfaces.includes(surface);
    } catch (error) {
      // Fail closed on errors
      console.warn('Failed to check surface access, denying access', {
        surface,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get all surfaces the current user can access
   */
  async getAccessibleSurfaces(): Promise<UiSurface[]> {
    try {
      const context = await principalService.getPrincipalContext();
      return context.availableSurfaces;
    } catch (error) {
      console.warn('Failed to get accessible surfaces', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Check surface access and throw error if denied
   */
  async requireSurfaceAccess(surface: UiSurface): Promise<void> {
    const hasAccess = await this.canAccessSurface(surface);
    if (!hasAccess) {
      throw new UiSdkError(
        `Access denied to surface: ${surface}`,
        'SURFACE_ACCESS_DENIED'
      );
    }
  }

  /**
   * Get default surface for current user (highest privilege available)
   */
  async getDefaultSurface(): Promise<UiSurface | null> {
    const accessibleSurfaces = await this.getAccessibleSurfaces();

    // Priority order: EXECUTIVE > MANAGER > OPERATOR
    if (accessibleSurfaces.includes(UiSurface.EXECUTIVE)) {
      return UiSurface.EXECUTIVE;
    }
    if (accessibleSurfaces.includes(UiSurface.MANAGER)) {
      return UiSurface.MANAGER;
    }
    if (accessibleSurfaces.includes(UiSurface.OPERATOR)) {
      return UiSurface.OPERATOR;
    }

    return null;
  }

  /**
   * Check if user has required skill tier for advanced operations
   */
  async hasRequiredSkillTier(minTier: SkillTier): Promise<boolean> {
    try {
      const skillTier = await principalService.getSkillTier();
      if (!skillTier) return false;

      return this.compareSkillTiers(skillTier as SkillTier, minTier) >= 0;
    } catch (error) {
      console.warn('Failed to check skill tier', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Require specific skill tier and throw error if insufficient
   */
  async requireSkillTier(minTier: SkillTier): Promise<void> {
    const hasTier = await this.hasRequiredSkillTier(minTier);
    if (!hasTier) {
      throw new UiSdkError(
        `Insufficient skill tier. Required: ${minTier}`,
        'INSUFFICIENT_SKILL_TIER'
      );
    }
  }

  /**
   * Compare skill tiers (higher number = more skilled)
   */
  private compareSkillTiers(tier1: SkillTier, tier2: SkillTier): number {
    const tierOrder = {
      [SkillTier.L1]: 1,
      [SkillTier.L2]: 2,
      [SkillTier.L3]: 3,
      [SkillTier.L4]: 4,
    };

    return tierOrder[tier1] - tierOrder[tier2];
  }
}

/**
 * Default surface gate manager instance
 */
export const surfaceGateManager = SurfaceGateManager.getInstance();

/**
 * Convenience functions for surface gating
 */
export const canAccessSurface = (surface: UiSurface) =>
  surfaceGateManager.canAccessSurface(surface);
export const getAccessibleSurfaces = () =>
  surfaceGateManager.getAccessibleSurfaces();
export const requireSurfaceAccess = (surface: UiSurface) =>
  surfaceGateManager.requireSurfaceAccess(surface);
export const getDefaultSurface = () => surfaceGateManager.getDefaultSurface();
export const hasRequiredSkillTier = (minTier: SkillTier) =>
  surfaceGateManager.hasRequiredSkillTier(minTier);
export const requireSkillTier = (minTier: SkillTier) =>
  surfaceGateManager.requireSkillTier(minTier);

/**
 * Surface-specific gate helpers
 */
export const canAccessOperatorConsole = () =>
  canAccessSurface(UiSurface.OPERATOR);
export const canAccessManagerConsole = () =>
  canAccessSurface(UiSurface.MANAGER);
export const canAccessExecDashboard = () =>
  canAccessSurface(UiSurface.EXECUTIVE);

export const requireOperatorConsole = () =>
  requireSurfaceAccess(UiSurface.OPERATOR);
export const requireManagerConsole = () =>
  requireSurfaceAccess(UiSurface.MANAGER);
export const requireExecDashboard = () =>
  requireSurfaceAccess(UiSurface.EXECUTIVE);
