/**
 * Evidence Linking - WI-061: UI Infrastructure & Governance Layer
 *
 * Build links/IDs to evidence for "Why?" and "Evidence" UI elements.
 * All evidence is traceable and correlated.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { EvidenceLink, EvidenceLinkType } from '../types';
import { getTenantId } from '../auth/principal';
import { CorrelationContext } from '../http/correlation';

/**
 * Evidence Link Builder
 * Creates traceable links to evidence for UI display
 */
export class EvidenceLinkBuilder {
  private static instance: EvidenceLinkBuilder;

  static getInstance(): EvidenceLinkBuilder {
    if (!EvidenceLinkBuilder.instance) {
      EvidenceLinkBuilder.instance = new EvidenceLinkBuilder();
    }
    return EvidenceLinkBuilder.instance;
  }

  /**
   * Build link to decision explanation
   */
  async buildDecisionExplanationLink(
    decisionId: string
  ): Promise<EvidenceLink> {
    const tenantId = await getTenantId();
    const correlationId = CorrelationContext.get();

    return {
      type: EvidenceLinkType.DECISION_EXPLANATION,
      id: decisionId,
      url: `/explainability/decisions/${decisionId}?tenantId=${tenantId}`,
      description: `Decision explanation for ${decisionId}`,
    };
  }

  /**
   * Build link to readiness report
   */
  async buildReadinessReportLink(reportId?: string): Promise<EvidenceLink> {
    const tenantId = await getTenantId();
    const _correlationId = CorrelationContext.get();

    const id = reportId || `readiness_${Date.now()}`;
    return {
      type: EvidenceLinkType.READINESS_REPORT,
      id,
      url: `/readiness/${tenantId}?correlationId=${_correlationId}`,
      description: `Tenant readiness report for ${tenantId}`,
    };
  }

  /**
   * Build link to drift violation
   */
  async buildDriftViolationLink(violationId: string): Promise<EvidenceLink> {
    const tenantId = await getTenantId();

    return {
      type: EvidenceLinkType.DRIFT_VIOLATION,
      id: violationId,
      url: `/ghl/violations/${violationId}?tenantId=${tenantId}`,
      description: `GHL drift violation ${violationId}`,
    };
  }

  /**
   * Build link to audit log entry
   */
  async buildAuditLogLink(auditId: string): Promise<EvidenceLink> {
    const tenantId = await getTenantId();

    return {
      type: EvidenceLinkType.AUDIT_LOG,
      id: auditId,
      url: `/audit/logs/${auditId}?tenantId=${tenantId}`,
      description: `Audit log entry ${auditId}`,
    };
  }

  /**
   * Build link to policy reference
   */
  async buildPolicyReferenceLink(
    policyName: string,
    version?: string
  ): Promise<EvidenceLink> {
    const tenantId = await getTenantId();
    const versionSuffix = version ? `?version=${version}` : '';

    return {
      type: EvidenceLinkType.POLICY_REFERENCE,
      id: `${policyName}${version ? `:${version}` : ''}`,
      url: `/policies/${policyName}${versionSuffix}`,
      description: `Policy reference: ${policyName}${version ? ` v${version}` : ''}`,
    };
  }

  /**
   * Build multiple evidence links for a decision context
   */
  async buildDecisionContextLinks(
    decisionId: string,
    options: {
      includeReadiness?: boolean;
      includeAudit?: boolean;
      policyReferences?: string[];
    } = {}
  ): Promise<EvidenceLink[]> {
    const links: EvidenceLink[] = [];

    // Always include decision explanation
    links.push(await this.buildDecisionExplanationLink(decisionId));

    // Include readiness if requested
    if (options.includeReadiness) {
      links.push(await this.buildReadinessReportLink());
    }

    // Include audit if requested
    if (options.includeAudit) {
      links.push(await this.buildAuditLogLink(`decision_${decisionId}`));
    }

    // Include policy references
    if (options.policyReferences) {
      for (const policy of options.policyReferences) {
        links.push(await this.buildPolicyReferenceLink(policy));
      }
    }

    return links;
  }

  /**
   * Build evidence links for an action context
   */
  async buildActionContextLinks(
    actionId: string,
    planId?: string,
    options: {
      includeViolations?: boolean;
      includeAudit?: boolean;
    } = {}
  ): Promise<EvidenceLink[]> {
    const links: EvidenceLink[] = [];

    // Include audit log for the action
    if (options.includeAudit) {
      links.push(await this.buildAuditLogLink(actionId));
    }

    // Include plan-related evidence if available
    if (planId) {
      links.push(await this.buildAuditLogLink(`plan_${planId}`));
    }

    // Include drift violations if relevant
    if (options.includeViolations) {
      // This would be determined by the action context
      // For now, just include a generic link
      links.push(await this.buildDriftViolationLink(`action_${actionId}`));
    }

    return links;
  }

  /**
   * Generate evidence summary for UI display
   */
  async generateEvidenceSummary(links: EvidenceLink[]): Promise<{
    totalCount: number;
    categories: Record<EvidenceLinkType, number>;
    primaryLink?: EvidenceLink;
  }> {
    const categories = links.reduce(
      (acc, link) => {
        acc[link.type] = (acc[link.type] || 0) + 1;
        return acc;
      },
      {} as Record<EvidenceLinkType, number>
    );

    return {
      totalCount: links.length,
      categories,
      primaryLink:
        links.find(
          link => link.type === EvidenceLinkType.DECISION_EXPLANATION
        ) || links[0],
    };
  }
}

/**
 * Default evidence link builder instance
 */
export const evidenceLinkBuilder = EvidenceLinkBuilder.getInstance();

/**
 * Convenience functions for evidence linking
 */
export const buildDecisionExplanationLink = (decisionId: string) =>
  evidenceLinkBuilder.buildDecisionExplanationLink(decisionId);
export const buildReadinessReportLink = (reportId?: string) =>
  evidenceLinkBuilder.buildReadinessReportLink(reportId);
export const buildDriftViolationLink = (violationId: string) =>
  evidenceLinkBuilder.buildDriftViolationLink(violationId);
export const buildAuditLogLink = (auditId: string) =>
  evidenceLinkBuilder.buildAuditLogLink(auditId);
export const buildPolicyReferenceLink = (
  policyName: string,
  version?: string
) => evidenceLinkBuilder.buildPolicyReferenceLink(policyName, version);
export const buildDecisionContextLinks = (decisionId: string, options?: any) =>
  evidenceLinkBuilder.buildDecisionContextLinks(decisionId, options);
export const buildActionContextLinks = (
  actionId: string,
  planId?: string,
  options?: any
) => evidenceLinkBuilder.buildActionContextLinks(actionId, planId, options);
export const generateEvidenceSummary = (links: EvidenceLink[]) =>
  evidenceLinkBuilder.generateEvidenceSummary(links);
