/**
 * Utility Functions - WI-069: Branding Kit + UI Beautification
 *
 * Helper functions for the design system.
 */

import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

/**
 * Utility function to merge Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get performance band color class
 */
export function getBandColorClass(
  band: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
): string {
  switch (band) {
    case 'GREEN':
      return 'text-green-700 bg-green-100 border-green-200';
    case 'YELLOW':
      return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    case 'RED':
      return 'text-red-700 bg-red-100 border-red-200';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-200';
  }
}

/**
 * Get performance band icon
 */
export function getBandIcon(
  band: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
): string {
  switch (band) {
    case 'GREEN':
      return '🟢';
    case 'YELLOW':
      return '🟡';
    case 'RED':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Format confidence value
 */
export function formatConfidence(confidence: number): string {
  if (confidence >= 90) return 'Strong';
  if (confidence >= 70) return 'Good';
  if (confidence >= 50) return 'Fair';
  return 'Needs Attention';
}

/**
 * Generate correlation ID for UI interactions
 */
export function generateCorrelationId(prefix: string = 'ui'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
