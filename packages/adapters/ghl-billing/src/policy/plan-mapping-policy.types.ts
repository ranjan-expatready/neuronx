/**
 * Plan Mapping Policy Types - WI-045: GHL Product → Plan Mapping Hardening
 *
 * Defines the schema for mapping GHL products to NeuronX plan tiers.
 */

import { z } from 'zod';

// Plan tier enum (matches billing-entitlements)
export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// Fallback behavior options
export enum FallbackBehavior {
  BLOCK = 'block', // Block tenant access
  GRACE_WITH_ALERT = 'grace_with_alert', // Allow with alert and audit
  DEFAULT_TIER = 'default_tier', // Use specified default tier
}

// Product mapping with optional SKU/price matching
const ProductMappingSchema = z.object({
  ghlProductId: z.string().min(1),
  neuronxPlanTier: z.nativeEnum(PlanTier),
  description: z.string().optional(),
  // Optional SKU/price/variant matching for more precise mapping
  sku: z.string().optional(),
  priceId: z.string().optional(),
  variantId: z.string().optional(),
  // Metadata for audit and governance
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// Environment-specific overrides
const EnvironmentOverrideSchema = z.object({
  environment: z.enum(['development', 'staging', 'production', 'all']),
  mappings: z.array(ProductMappingSchema),
});

// Fallback configuration
const FallbackConfigSchema = z.object({
  behavior: z.nativeEnum(FallbackBehavior),
  defaultTier: z.nativeEnum(PlanTier).optional(), // Required if behavior is DEFAULT_TIER
  alertChannels: z.array(z.string()).optional(), // Email/webhook URLs for alerts
  gracePeriodDays: z.number().min(0).default(7),
});

// Main plan mapping policy schema
export const PlanMappingPolicySchema = z.object({
  // Version for policy management
  version: z.string().min(1),

  // Product mappings
  productMappings: z.array(ProductMappingSchema),

  // Environment-specific overrides (optional)
  environmentOverrides: z.array(EnvironmentOverrideSchema).optional(),

  // Fallback behavior for unmapped products
  fallback: FallbackConfigSchema,

  // Audit and governance
  auditEnabled: z.boolean().default(true),
  alertOnFallback: z.boolean().default(true),

  // Metadata
  description: z.string().optional(),
  lastUpdated: z.string().optional(),
  updatedBy: z.string().optional(),
});

// TypeScript types
export type PlanMappingPolicy = z.infer<typeof PlanMappingPolicySchema>;
export type ProductMapping = z.infer<typeof ProductMappingSchema>;
export type EnvironmentOverride = z.infer<typeof EnvironmentOverrideSchema>;
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

// Resolution result types
export interface PlanMappingResult {
  planTier: PlanTier;
  mapping: ProductMapping | null; // null if fallback was used
  fallbackUsed: boolean;
  reason: string;
}

export interface PlanMappingResolutionContext {
  ghlProductId: string;
  sku?: string;
  priceId?: string;
  variantId?: string;
  environment: string;
  tenantId: string;
}
