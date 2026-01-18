// Rep Skill & Governance Model
// Skill-based permissions and human behavior governance

// Core exports
export * from './rep-authorization.service';

// Policy exports (with type aliases to resolve conflicts)
export * from './rep-skill-policy.loader';
export * from './rep-skill-policy.resolver';

export {
  SkillTier,
  AuthorizationAction,
  OverrideType,
  CertificationType,
  AdvancementCriterion,
} from './rep-skill.enums';

export type {
  SkillTier as PolicySkillTier,
  AuthorizationAction as PolicyAuthorizationAction,
  OverrideType as PolicyOverrideType,
  CertificationType as PolicyCertificationType,
  AdvancementCriterion as PolicyAdvancementCriterion,
} from './rep-skill.enums';

export type {
  RepSkillPolicy,
  SkillTierPermissions,
  RiskRestrictions,
  OverridePolicy,
  TrainingRequirements,
  AdvancementCriteria,
  AuditPolicies,
  EmergencyProcedures,
} from './rep-skill-policy.schema';
