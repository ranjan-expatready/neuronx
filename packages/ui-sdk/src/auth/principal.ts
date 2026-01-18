/**
 * Principal/Auth Utilities - WI-061: UI Infrastructure & Governance Layer
 *
 * Read principal info from backend session/token. NO auth implementation.
 */

import { PrincipalContext, ApiResponse, UiSdkError } from '../types';
import { httpClient } from '../http/client';
import { CorrelationContext } from '../http/correlation';

/**
 * Principal Service for UI SDK
 * Reads principal context from backend without implementing authentication
 */
export class PrincipalService {
  private static instance: PrincipalService;
  private cachedContext: PrincipalContext | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PrincipalService {
    if (!PrincipalService.instance) {
      PrincipalService.instance = new PrincipalService();
    }
    return PrincipalService.instance;
  }

  /**
   * Get current principal context from backend
   * Caches result to avoid excessive API calls
   */
  async getPrincipalContext(): Promise<PrincipalContext> {
    const now = Date.now();

    // Return cached context if still valid
    if (this.cachedContext && now < this.cacheExpiry) {
      return this.cachedContext;
    }

    try {
      const response: ApiResponse<PrincipalContext> = await httpClient.get(
        '/me/context',
        {
          correlationId: CorrelationContext.get(),
        }
      );

      if (!response.success || !response.data) {
        throw new UiSdkError(
          response.error || 'Failed to get principal context',
          'PRINCIPAL_CONTEXT_ERROR',
          response.correlationId
        );
      }

      // Cache the result
      this.cachedContext = response.data;
      this.cacheExpiry = now + this.CACHE_TTL;

      // Set correlation ID for subsequent requests
      CorrelationContext.set(response.data.correlationId);

      return response.data;
    } catch (error) {
      // Clear cache on error
      this.cachedContext = null;
      this.cacheExpiry = 0;

      throw error;
    }
  }

  /**
   * Get current tenant ID
   */
  async getTenantId(): Promise<string> {
    const context = await this.getPrincipalContext();
    return context.tenantId;
  }

  /**
   * Get current user ID
   */
  async getUserId(): Promise<string> {
    const context = await this.getPrincipalContext();
    return context.userId;
  }

  /**
   * Check if user has specific capability
   */
  async hasCapability(capability: string): Promise<boolean> {
    const context = await this.getPrincipalContext();
    return context.capabilities.includes(capability);
  }

  /**
   * Check if user has access to specific surface
   */
  async hasSurfaceAccess(surface: string): Promise<boolean> {
    const context = await this.getPrincipalContext();
    return context.availableSurfaces.includes(surface as any);
  }

  /**
   * Get user skill tier
   */
  async getSkillTier(): Promise<string | undefined> {
    const context = await this.getPrincipalContext();
    return context.skillTier;
  }

  /**
   * Clear cached principal context (useful for logout or context changes)
   */
  clearCache(): void {
    this.cachedContext = null;
    this.cacheExpiry = 0;
  }

  /**
   * Force refresh of principal context
   */
  async refresh(): Promise<PrincipalContext> {
    this.clearCache();
    return this.getPrincipalContext();
  }
}

/**
 * Default principal service instance
 */
export const principalService = PrincipalService.getInstance();

/**
 * Convenience functions for common principal operations
 */
export const getPrincipalContext = () => principalService.getPrincipalContext();
export const getTenantId = () => principalService.getTenantId();
export const getUserId = () => principalService.getUserId();
export const hasCapability = (capability: string) =>
  principalService.hasCapability(capability);
export const hasSurfaceAccess = (surface: string) =>
  principalService.hasSurfaceAccess(surface);
export const getSkillTier = () => principalService.getSkillTier();
export const refreshPrincipal = () => principalService.refresh();
