/**
 * GHL Deep Links - WI-061: UI Infrastructure & Governance Layer
 *
 * Pure functions to map NeuronX entities to GHL URLs based on tenant location.
 * UI links out to GHL for CRM editing; NeuronX overlays intelligence.
 */

import { GhlDeepLink, GhlLinkType, UiSdkError } from '../types';
import { getTenantId } from '../auth/principal';

/**
 * GHL Deep Link Builder
 * Creates navigation links from NeuronX entities to GHL CRM
 */
export class GhlDeepLinkBuilder {
  private static instance: GhlDeepLinkBuilder;

  // GHL URL patterns by entity type
  private static readonly GHL_URL_PATTERNS = {
    [GhlLinkType.OPPORTUNITY]: '/opportunities/{id}',
    [GhlLinkType.CONTACT]: '/contacts/{id}',
    [GhlLinkType.PIPELINE]: '/pipelines/{id}',
    [GhlLinkType.CALENDAR]: '/calendar',
    [GhlLinkType.DASHBOARD]: '/dashboard',
  };

  static getInstance(): GhlDeepLinkBuilder {
    if (!GhlDeepLinkBuilder.instance) {
      GhlDeepLinkBuilder.instance = new GhlDeepLinkBuilder();
    }
    return GhlDeepLinkBuilder.instance;
  }

  /**
   * Build deep link to GHL opportunity
   */
  async buildOpportunityLink(opportunityId: string): Promise<GhlDeepLink> {
    const tenantId = await getTenantId();
    const baseUrl = await this.getGhlBaseUrl(tenantId);

    return {
      url: `${baseUrl}${GhlDeepLinkBuilder.GHL_URL_PATTERNS[GhlLinkType.OPPORTUNITY].replace('{id}', opportunityId)}`,
      type: GhlLinkType.OPPORTUNITY,
      entityId: opportunityId,
      tenantId,
    };
  }

  /**
   * Build deep link to GHL contact
   */
  async buildContactLink(contactId: string): Promise<GhlDeepLink> {
    const tenantId = await getTenantId();
    const baseUrl = await this.getGhlBaseUrl(tenantId);

    return {
      url: `${baseUrl}${GhlDeepLinkBuilder.GHL_URL_PATTERNS[GhlLinkType.CONTACT].replace('{id}', contactId)}`,
      type: GhlLinkType.CONTACT,
      entityId: contactId,
      tenantId,
    };
  }

  /**
   * Build deep link to GHL pipeline
   */
  async buildPipelineLink(pipelineId: string): Promise<GhlDeepLink> {
    const tenantId = await getTenantId();
    const baseUrl = await this.getGhlBaseUrl(tenantId);

    return {
      url: `${baseUrl}${GhlDeepLinkBuilder.GHL_URL_PATTERNS[GhlLinkType.PIPELINE].replace('{id}', pipelineId)}`,
      type: GhlLinkType.PIPELINE,
      entityId: pipelineId,
      tenantId,
    };
  }

  /**
   * Build deep link to GHL calendar
   */
  async buildCalendarLink(): Promise<GhlDeepLink> {
    const tenantId = await getTenantId();
    const baseUrl = await this.getGhlBaseUrl(tenantId);

    return {
      url: `${baseUrl}${GhlDeepLinkBuilder.GHL_URL_PATTERNS[GhlLinkType.CALENDAR]}`,
      type: GhlLinkType.CALENDAR,
      entityId: 'calendar',
      tenantId,
    };
  }

  /**
   * Build deep link to GHL dashboard
   */
  async buildDashboardLink(): Promise<GhlDeepLink> {
    const tenantId = await getTenantId();
    const baseUrl = await this.getGhlBaseUrl(tenantId);

    return {
      url: `${baseUrl}${GhlDeepLinkBuilder.GHL_URL_PATTERNS[GhlLinkType.DASHBOARD]}`,
      type: GhlLinkType.DASHBOARD,
      entityId: 'dashboard',
      tenantId,
    };
  }

  /**
   * Build contextual deep link based on entity type and ID
   */
  async buildContextualLink(
    entityType: GhlLinkType,
    entityId: string
  ): Promise<GhlDeepLink> {
    switch (entityType) {
      case GhlLinkType.OPPORTUNITY:
        return this.buildOpportunityLink(entityId);
      case GhlLinkType.CONTACT:
        return this.buildContactLink(entityId);
      case GhlLinkType.PIPELINE:
        return this.buildPipelineLink(entityId);
      case GhlLinkType.CALENDAR:
        return this.buildCalendarLink();
      case GhlLinkType.DASHBOARD:
        return this.buildDashboardLink();
      default:
        throw new UiSdkError(
          `Unsupported GHL link type: ${entityType}`,
          'UNSUPPORTED_GHL_LINK_TYPE'
        );
    }
  }

  /**
   * Open deep link in new tab/window
   */
  async openDeepLink(link: GhlDeepLink): Promise<void> {
    try {
      // In browser environment, open in new tab
      if (typeof window !== 'undefined') {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      } else {
        // In server environment, log the URL
        console.log(`GHL Deep Link: ${link.url}`);
      }
    } catch (error) {
      throw new UiSdkError(
        `Failed to open GHL deep link: ${(error as Error).message}`,
        'GHL_DEEP_LINK_OPEN_FAILED'
      );
    }
  }

  /**
   * Get GHL base URL for tenant
   * TODO: This should be fetched from tenant configuration
   * For now, use environment variable or default
   */
  private async getGhlBaseUrl(tenantId: string): Promise<string> {
    try {
      // TODO: Fetch from tenant configuration endpoint
      // For now, use environment variable or construct from tenant ID
      const baseUrl =
        process.env.NEXT_PUBLIC_GHL_BASE_URL || `https://app.gohighlevel.com`; // Default GHL URL

      // In production, this would be tenant-specific
      // e.g., https://tenant-specific-subdomain.gohighlevel.com
      return baseUrl;
    } catch (error) {
      console.warn('Failed to get GHL base URL, using default', {
        tenantId,
        error: (error as Error).message,
      });
      return 'https://app.gohighlevel.com';
    }
  }

  /**
   * Validate if a URL is a valid GHL deep link
   */
  isValidGhlUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('gohighlevel.com') ||
        urlObj.hostname.includes('ghl.com')
      );
    } catch {
      return false;
    }
  }
}

/**
 * Default GHL deep link builder instance
 */
export const ghlDeepLinkBuilder = GhlDeepLinkBuilder.getInstance();

/**
 * Convenience functions for GHL deep linking
 */
export const buildOpportunityLink = (opportunityId: string) =>
  ghlDeepLinkBuilder.buildOpportunityLink(opportunityId);
export const buildContactLink = (contactId: string) =>
  ghlDeepLinkBuilder.buildContactLink(contactId);
export const buildPipelineLink = (pipelineId: string) =>
  ghlDeepLinkBuilder.buildPipelineLink(pipelineId);
export const buildCalendarLink = () => ghlDeepLinkBuilder.buildCalendarLink();
export const buildDashboardLink = () => ghlDeepLinkBuilder.buildDashboardLink();
export const buildContextualLink = (
  entityType: GhlLinkType,
  entityId: string
) => ghlDeepLinkBuilder.buildContextualLink(entityType, entityId);
export const openDeepLink = (link: GhlDeepLink) =>
  ghlDeepLinkBuilder.openDeepLink(link);
export const isValidGhlUrl = (url: string) =>
  ghlDeepLinkBuilder.isValidGhlUrl(url);
