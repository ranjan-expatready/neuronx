/**
 * Branding Kit - WI-069: Branding Kit + UI Beautification
 *
 * Runtime theming system that loads branding configuration from server or local fallback.
 * Supports tenant-specific branding with CSS variable overrides.
 */

import { DesignTokens, defaultTokens } from '../tokens';

export interface BrandingKit {
  brandName: string;
  logoUrl?: string;
  tagline?: string;
  colors: {
    primary: string; // Hex color for primary brand color
    secondary?: string; // Optional secondary brand color
    accent?: string; // Optional accent color
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

/**
 * Default NeuronX branding kit
 */
export const defaultBrandingKit: BrandingKit = {
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
 * Convert branding kit to design tokens
 */
export function brandingKitToTokens(branding: BrandingKit): DesignTokens {
  const tokens = { ...defaultTokens };

  // Override primary color palette based on brand primary
  if (branding.colors.primary) {
    tokens.colors.primary = generateColorPalette(branding.colors.primary);
  }

  // Override secondary color if provided
  if (branding.colors.secondary) {
    tokens.colors.secondary = generateColorPalette(branding.colors.secondary);
  }

  // Update band colors to use accent if provided
  if (branding.colors.accent) {
    tokens.colors.band.green = branding.colors.accent;
  }

  // Override typography
  if (branding.typography?.fontFamily) {
    tokens.typography.fontFamily = branding.typography.fontFamily;
  }

  // Override border radius
  if (branding.borderRadius && tokens.borderRadius[branding.borderRadius]) {
    // Update default border radius to match brand preference
    const preferredRadius = tokens.borderRadius[branding.borderRadius];
    tokens.borderRadius.md = preferredRadius;
    tokens.borderRadius.lg = preferredRadius;
  }

  return tokens;
}

/**
 * Generate a 9-step color palette from a base color
 * This is a simplified version - in production, you'd use a proper color manipulation library
 */
function generateColorPalette(
  baseColor: string
): DesignTokens['colors']['primary'] {
  // For simplicity, return a blue palette by default
  // In production, this would analyze the base color and generate appropriate shades
  const isBlue = baseColor.includes('3b82f6') || baseColor.includes('2563eb');

  if (isBlue) {
    return {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: baseColor,
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    };
  }

  // For other colors, return a modified version
  // This is a placeholder - proper color palette generation would be more sophisticated
  return {
    50: lightenColor(baseColor, 0.9),
    100: lightenColor(baseColor, 0.8),
    200: lightenColor(baseColor, 0.6),
    300: lightenColor(baseColor, 0.4),
    400: lightenColor(baseColor, 0.2),
    500: baseColor,
    600: darkenColor(baseColor, 0.1),
    700: darkenColor(baseColor, 0.2),
    800: darkenColor(baseColor, 0.3),
    900: darkenColor(baseColor, 0.4),
  };
}

/**
 * Simple color manipulation functions
 * In production, use a proper color library like color.js or tinycolor2
 */
function lightenColor(color: string, amount: number): string {
  // Placeholder - return slightly modified color
  return color;
}

function darkenColor(color: string, amount: number): string {
  // Placeholder - return slightly modified color
  return color;
}

/**
 * Branding API client
 */
export class BrandingApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Load branding configuration from server
   */
  async loadBranding(tenantId?: string): Promise<BrandingKit> {
    try {
      const url = tenantId
        ? `${this.baseUrl}/ui/branding?tenantId=${tenantId}`
        : `${this.baseUrl}/ui/branding`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId && { 'x-tenant-id': tenantId }),
        },
      });

      if (response.ok) {
        const branding = await response.json();
        console.log('✅ Loaded branding from server:', branding.brandName);
        return branding;
      } else {
        console.warn('⚠️ Failed to load branding from server, using defaults');
        return defaultBrandingKit;
      }
    } catch (error) {
      console.warn('⚠️ Branding API unavailable, using defaults:', error);
      return defaultBrandingKit;
    }
  }

  /**
   * Load branding from local configuration file (fallback)
   */
  async loadLocalBranding(): Promise<BrandingKit> {
    try {
      // Try to load from public/config/branding.json
      const response = await fetch('/config/branding.json');
      if (response.ok) {
        const branding = await response.json();
        console.log('✅ Loaded local branding configuration');
        return branding;
      }
    } catch (error) {
      console.warn('⚠️ Local branding config not found');
    }

    return defaultBrandingKit;
  }
}

/**
 * Branding Manager - Central coordination for theming
 */
export class BrandingManager {
  private apiClient: BrandingApiClient;
  private currentBranding: BrandingKit | null = null;

  constructor(apiBaseUrl?: string) {
    this.apiClient = new BrandingApiClient(apiBaseUrl);
  }

  /**
   * Initialize branding system
   */
  async initialize(tenantId?: string): Promise<void> {
    // Try server-first approach
    let branding = await this.apiClient.loadBranding(tenantId);

    // Fallback to local config if server fails
    if (!branding || branding === defaultBrandingKit) {
      branding = await this.apiClient.loadLocalBranding();
    }

    this.currentBranding = branding;

    // Apply branding to design tokens
    const tokens = brandingKitToTokens(branding);

    // Apply tokens to DOM
    if (typeof document !== 'undefined') {
      const { applyTokens } = await import('../tokens');
      applyTokens(tokens);
    }

    console.log('🎨 Branding initialized:', branding.brandName);
  }

  /**
   * Get current branding configuration
   */
  getCurrentBranding(): BrandingKit | null {
    return this.currentBranding;
  }

  /**
   * Update branding at runtime
   */
  async updateBranding(newBranding: Partial<BrandingKit>): Promise<void> {
    if (!this.currentBranding) {
      throw new Error('Branding not initialized');
    }

    this.currentBranding = { ...this.currentBranding, ...newBranding };
    await this.initialize();
  }
}

// Global branding manager instance
export const brandingManager = new BrandingManager();
