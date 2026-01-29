/**
 * Branding Initializer - WI-069: Branding Kit + UI Beautification
 *
 * Client-side component that initializes branding on app startup.
 * Loads tenant-specific branding from API and applies design tokens.
 */

'use client';

import { useEffect } from 'react';
import { brandingManager } from '@neuronx/ui-design-system';

export function BrandingInitializer() {
  useEffect(() => {
    // Initialize branding on client-side mount
    // This will load branding from API and apply design tokens
    brandingManager
      .initialize('uat-tenant-001') // TODO: Get from auth context
      .catch(error => {
        console.warn('Failed to initialize branding:', error);
        // Continue with default branding
      });
  }, []);

  // This component doesn't render anything
  return null;
}
