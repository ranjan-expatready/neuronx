/**
 * UI Service - WI-069: Branding Kit + UI Beautification
 *
 * Service for UI theming and branding configuration.
 * Provides server-driven branding with tenant-specific customization.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface BrandingKit {
  brandName: string;
  logoUrl?: string;
  tagline?: string;
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  typography?: {
    fontFamily?: string;
    headingFontFamily?: string;
  };
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  shadows?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  tenantId?: string;
  version: string;
  lastModified: string;
}

@Injectable()
export class UiService {
  private readonly logger = new Logger(UiService.name);

  /**
   * Default NeuronX branding
   */
  private readonly defaultBranding: BrandingKit = {
    brandName: 'NeuronX',
    logoUrl: '/logo.svg',
    tagline: 'Intelligent Sales Automation',
    colors: {
      primary: '#3b82f6', // Blue-500
      secondary: '#64748b', // Slate-500
      accent: '#10b981', // Emerald-500
    },
    typography: {
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      headingFontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    borderRadius: 'lg',
    shadows: 'md',
    version: '1.0.0',
    lastModified: new Date().toISOString(),
  };

  /**
   * Tenant-specific branding configurations
   * In production, this would come from a database or configuration service
   */
  private readonly tenantBranding: Record<string, Partial<BrandingKit>> = {
    // Example tenant customizations
    'tenant-demo': {
      brandName: 'DemoCorp NeuronX',
      colors: {
        primary: '#7c3aed', // Purple-500
        secondary: '#64748b',
        accent: '#f59e0b', // Amber-500
      },
      version: '1.0.1',
      lastModified: new Date().toISOString(),
    },
    'uat-tenant-001': {
      brandName: 'UAT NeuronX',
      tagline: 'Testing Environment',
      colors: {
        primary: '#ef4444', // Red-500 (indicates test environment)
        secondary: '#64748b',
        accent: '#3b82f6',
      },
      version: '1.0.2',
      lastModified: new Date().toISOString(),
    },
  };

  /**
   * Get branding configuration for tenant
   */
  getBranding(tenantId?: string, requestedVersion?: string): BrandingKit {
    this.logger.log(`Getting branding for tenant: ${tenantId || 'default'}`);

    let branding = { ...this.defaultBranding };

    // Apply tenant-specific customizations
    if (tenantId && this.tenantBranding[tenantId]) {
      const tenantOverrides = this.tenantBranding[tenantId];
      branding = {
        ...branding,
        ...tenantOverrides,
        tenantId,
        colors: { ...branding.colors, ...tenantOverrides.colors },
        typography: { ...branding.typography, ...tenantOverrides.typography },
      };
    }

    // Handle version-specific branding (future enhancement)
    if (requestedVersion && requestedVersion !== branding.version) {
      this.logger.warn(
        `Requested version ${requestedVersion} not available, returning ${branding.version}`
      );
    }

    this.logger.log(
      `Returning branding: ${branding.brandName} v${branding.version}`
    );
    return branding;
  }

  /**
   * Update tenant branding (admin functionality)
   * In production, this would require proper authorization
   */
  updateTenantBranding(
    tenantId: string,
    updates: Partial<BrandingKit>
  ): BrandingKit {
    this.logger.log(`Updating branding for tenant: ${tenantId}`);

    if (!this.tenantBranding[tenantId]) {
      this.tenantBranding[tenantId] = {};
    }

    this.tenantBranding[tenantId] = {
      ...this.tenantBranding[tenantId],
      ...updates,
      lastModified: new Date().toISOString(),
    };

    return this.getBranding(tenantId);
  }

  /**
   * Validate branding configuration
   */
  validateBranding(branding: BrandingKit): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!branding.brandName || branding.brandName.trim().length === 0) {
      errors.push('brandName is required');
    }

    if (
      !branding.colors?.primary ||
      !this.isValidHexColor(branding.colors.primary)
    ) {
      errors.push('primary color must be a valid hex color');
    }

    if (
      branding.colors?.secondary &&
      !this.isValidHexColor(branding.colors.secondary)
    ) {
      errors.push('secondary color must be a valid hex color');
    }

    if (
      branding.colors?.accent &&
      !this.isValidHexColor(branding.colors.accent)
    ) {
      errors.push('accent color must be a valid hex color');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if string is a valid hex color
   */
  private isValidHexColor(color: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(color);
  }
}
