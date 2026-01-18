/**
 * Playbook Registry - WI-028: Authoritative Playbook Engine
 *
 * Manages playbook loading, versioning, and tenant-specific overrides.
 * Currently uses static definitions; future versions will load from tenant config.
 */

import { Playbook } from './types';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

export interface PlaybookRegistry {
  /**
   * Get playbook for a tenant
   */
  getPlaybook(tenantId: string, playbookId: string): Promise<Playbook | null>;

  /**
   * List available playbooks for a tenant
   */
  listPlaybooks(tenantId: string): Promise<Playbook[]>;

  /**
   * Validate playbook schema
   */
  validatePlaybook(
    playbook: Playbook
  ): Promise<{ valid: boolean; errors: string[] }>;
}

/**
 * Default Inbound Lead Playbook - Version 1.0.0
 * This represents the canonical sales process for inbound leads.
 */
export const DEFAULT_INBOUND_LEAD_PLAYBOOK: Playbook = {
  playbookId: 'inbound_lead_v1',
  version: '1.0.0',
  name: 'Inbound Lead Qualification Playbook',
  description:
    'Standard process for qualifying inbound leads through initial contact and qualification',
  tenantId: undefined, // Global playbook

  entryStage: 'prospect_identified',

  stages: {
    prospect_identified: {
      stageId: 'prospect_identified',
      canonicalStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
      displayName: 'Prospect Identified',
      description: 'Lead has been captured but not yet contacted',

      mustDo: [
        {
          actionId: 'initial_contact_attempt',
          actionType: 'contact_attempt',
          channel: 'voice',
          slaMinutes: 15,
          evidenceRequired: 'call_attempt_logged',
          retryPolicy: {
            maxAttempts: 3,
            initialDelayMinutes: 5,
            backoffMultiplier: 2,
          },
          humanAllowed: true,
          aiAllowed: true,
        },
      ],

      onSuccess: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'call_connected',
        },
        nextStage: 'initial_contact',
      },

      onFailure: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'call_attempt_logged',
          threshold: 3, // All retries exhausted
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 60, // 1 hour to make initial contact
    },

    initial_contact: {
      stageId: 'initial_contact',
      canonicalStage: CanonicalOpportunityStage.INITIAL_CONTACT,
      displayName: 'Initial Contact Made',
      description: 'First successful contact established with prospect',

      mustDo: [
        {
          actionId: 'qualification_call',
          actionType: 'qualification_call',
          channel: 'voice',
          slaMinutes: 30,
          scriptId: 'qualification_v3',
          evidenceRequired: 'qualification_complete',
          humanAllowed: true,
          aiAllowed: false, // Qualification requires human judgment
        },
      ],

      onSuccess: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'qualification_complete',
        },
        nextStage: 'qualified',
      },

      onFailure: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'disqualification_complete',
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 1440, // 24 hours for qualification
    },

    qualified: {
      stageId: 'qualified',
      canonicalStage: CanonicalOpportunityStage.QUALIFIED,
      displayName: 'Qualified Lead',
      description:
        'Lead has been qualified and meets criteria for sales engagement',

      mustDo: [
        {
          actionId: 'needs_analysis_followup',
          actionType: 'followup',
          channel: 'email',
          slaMinutes: 1440, // 24 hours
          templateId: 'needs_analysis_email',
          evidenceRequired: 'followup_scheduled',
          humanAllowed: true,
          aiAllowed: true,
        },
      ],

      onSuccess: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'followup_scheduled',
        },
        nextStage: 'needs_analysis',
      },

      onFailure: {
        condition: {
          conditionType: 'time_elapsed',
          threshold: 2880, // 48 hours without action
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 10080, // 1 week
    },

    needs_analysis: {
      stageId: 'needs_analysis',
      canonicalStage: CanonicalOpportunityStage.NEEDS_ANALYSIS,
      displayName: 'Needs Analysis',
      description: 'Detailed requirements gathering and solution exploration',

      mustDo: [
        {
          actionId: 'discovery_meeting',
          actionType: 'schedule_meeting',
          channel: 'calendar',
          slaMinutes: 4320, // 3 days
          evidenceRequired: 'meeting_scheduled',
          humanAllowed: true,
          aiAllowed: false,
        },
      ],

      onSuccess: {
        condition: {
          conditionType: 'evidence_present',
          evidenceType: 'meeting_completed',
        },
        nextStage: 'proposal_sent',
      },

      onFailure: {
        condition: {
          conditionType: 'time_elapsed',
          threshold: 10080, // 1 week without meeting
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 20160, // 2 weeks
    },

    proposal_sent: {
      stageId: 'proposal_sent',
      canonicalStage: CanonicalOpportunityStage.PROPOSAL_SENT,
      displayName: 'Proposal Sent',
      description: 'Formal proposal has been delivered to prospect',

      mustDo: [
        {
          actionId: 'proposal_followup',
          actionType: 'followup',
          channel: 'email',
          slaMinutes: 2880, // 2 days
          templateId: 'proposal_followup',
          evidenceRequired: 'followup_scheduled',
          humanAllowed: true,
          aiAllowed: true,
        },
      ],

      onSuccess: {
        condition: {
          conditionType: 'manual_decision', // Human decision on next steps
        },
        nextStage: 'negotiation',
      },

      onFailure: {
        condition: {
          conditionType: 'time_elapsed',
          threshold: 20160, // 2 weeks without response
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 30240, // 3 weeks
    },

    negotiation: {
      stageId: 'negotiation',
      canonicalStage: CanonicalOpportunityStage.NEGOTIATION,
      displayName: 'Negotiation',
      description: 'Terms negotiation and deal closure process',

      mustDo: [], // Negotiation is human-driven

      onSuccess: {
        condition: {
          conditionType: 'manual_decision',
        },
        nextStage: 'committed',
      },

      onFailure: {
        condition: {
          conditionType: 'manual_decision',
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 43200, // 30 days
    },

    committed: {
      stageId: 'committed',
      canonicalStage: CanonicalOpportunityStage.COMMITTED,
      displayName: 'Committed',
      description: 'Deal is committed but not yet closed',

      mustDo: [], // Handled by implementation team

      onSuccess: {
        condition: {
          conditionType: 'manual_decision',
        },
        nextStage: 'closed_won',
      },

      onFailure: {
        condition: {
          conditionType: 'manual_decision',
        },
        nextStage: 'lost',
      },

      maxDurationMinutes: 10080, // 1 week
    },

    lost: {
      stageId: 'lost',
      canonicalStage: CanonicalOpportunityStage.CLOSED_LOST,
      displayName: 'Lost',
      description: 'Opportunity lost or disqualified',

      mustDo: [], // Terminal state

      onSuccess: {
        condition: {
          conditionType: 'evidence_absent', // No success condition
        },
        nextStage: 'lost', // Stay lost
      },

      onFailure: {
        condition: {
          conditionType: 'evidence_absent',
        },
        nextStage: 'lost', // Stay lost
      },
    },
  },

  defaultRetryPolicy: {
    maxAttempts: 3,
    initialDelayMinutes: 15,
    backoffMultiplier: 2,
    maxDelayMinutes: 1440, // 24 hours
  },

  maxOverallDurationDays: 90, // 90 days total

  createdAt: '2026-01-05T00:00:00Z',
  updatedAt: '2026-01-05T00:00:00Z',
  createdBy: 'system',
  isActive: true,
};

/**
 * In-memory playbook registry implementation
 */
export class InMemoryPlaybookRegistry implements PlaybookRegistry {
  private playbooks = new Map<string, Playbook>();

  constructor() {
    // Initialize with default playbooks
    this.registerPlaybook(DEFAULT_INBOUND_LEAD_PLAYBOOK);
  }

  async getPlaybook(
    tenantId: string,
    playbookId: string
  ): Promise<Playbook | null> {
    const key = `${tenantId}:${playbookId}`;

    // First try tenant-specific playbook
    if (this.playbooks.has(key)) {
      return this.playbooks.get(key)!;
    }

    // Fall back to global playbook
    const globalKey = `global:${playbookId}`;
    return this.playbooks.get(globalKey) || null;
  }

  async listPlaybooks(tenantId: string): Promise<Playbook[]> {
    const result: Playbook[] = [];

    // Add tenant-specific playbooks
    for (const [key, playbook] of this.playbooks.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        result.push(playbook);
      }
    }

    // Add global playbooks
    for (const [key, playbook] of this.playbooks.entries()) {
      if (key.startsWith('global:')) {
        result.push(playbook);
      }
    }

    return result;
  }

  async validatePlaybook(
    playbook: Playbook
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate basic structure
    if (!playbook.playbookId) {
      errors.push('playbookId is required');
    }

    if (!playbook.version) {
      errors.push('version is required');
    }

    if (!playbook.entryStage) {
      errors.push('entryStage is required');
    }

    if (!playbook.stages || Object.keys(playbook.stages).length === 0) {
      errors.push('stages must be defined with at least one stage');
    }

    // Validate entry stage exists
    if (playbook.entryStage && !playbook.stages[playbook.entryStage]) {
      errors.push(
        `entryStage '${playbook.entryStage}' does not exist in stages`
      );
    }

    // Validate each stage
    for (const [stageId, stage] of Object.entries(playbook.stages)) {
      // Validate stage structure
      if (!stage.canonicalStage) {
        errors.push(`Stage '${stageId}' missing canonicalStage`);
      }

      if (!stage.onSuccess?.nextStage) {
        errors.push(`Stage '${stageId}' missing onSuccess.nextStage`);
      }

      if (!stage.onFailure?.nextStage) {
        errors.push(`Stage '${stageId}' missing onFailure.nextStage`);
      }

      // Validate next stages exist
      if (
        stage.onSuccess?.nextStage &&
        !playbook.stages[stage.onSuccess.nextStage]
      ) {
        errors.push(
          `Stage '${stageId}' onSuccess.nextStage '${stage.onSuccess.nextStage}' does not exist`
        );
      }

      if (
        stage.onFailure?.nextStage &&
        !playbook.stages[stage.onFailure.nextStage]
      ) {
        errors.push(
          `Stage '${stageId}' onFailure.nextStage '${stage.onFailure.nextStage}' does not exist`
        );
      }

      // Validate actions
      for (const action of stage.mustDo) {
        if (!action.evidenceRequired) {
          errors.push(
            `Stage '${stageId}' action '${action.actionId}' missing evidenceRequired`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Register a playbook (used internally and for testing)
   */
  registerPlaybook(playbook: Playbook): void {
    const key = playbook.tenantId
      ? `${playbook.tenantId}:${playbook.playbookId}`
      : `global:${playbook.playbookId}`;

    this.playbooks.set(key, playbook);
  }
}
