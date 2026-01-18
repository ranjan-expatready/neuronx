/**
 * Decision Explainability Package - WI-052: Decision Explainability Engine
 *
 * Provides structured, machine-readable explanations for NeuronX decisions.
 */

// Types and schemas
export * from './explanation-types';

// Core services
export { DecisionExplainabilityEngine } from './decision-explainability-engine';
export { ExplanationStorageService } from './explanation-storage.service';

// Builders
export { ExplanationBuilder } from './builders/explanation.builder';
export { PolicyFactorBuilder } from './builders/policy-factor.builder';
export { AuthorityFactorBuilder } from './builders/authority-factor.builder';
export { BillingFactorBuilder } from './builders/billing-factor.builder';
export { DriftFactorBuilder } from './builders/drift-factor.builder';

// Factors
export { FactorExtractor } from './factors/factor-extractor';

// Module exports for NestJS
export const DECISION_EXPLAINABILITY_PROVIDERS = [
  DecisionExplainabilityEngine,
  ExplanationStorageService,
  ExplanationBuilder,
  FactorExtractor,
];

export const DECISION_EXPLAINABILITY_CONTROLLERS = [
  // Controllers will be added when API endpoints are implemented
];
