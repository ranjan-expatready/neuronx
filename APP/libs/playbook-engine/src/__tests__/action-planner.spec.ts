/**
 * Action Planner Tests - WI-028: Authoritative Playbook Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActionPlannerImpl, DEFAULT_INBOUND_LEAD_PLAYBOOK } from '../index';

describe('ActionPlanner', () => {
  let planner: ActionPlannerImpl;

  beforeEach(() => {
    planner = new ActionPlannerImpl();
  });

  describe('planStageActions', () => {
    it('should generate execution commands for stage actions', () => {
      const commands = planner.planStageActions(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(commands).toHaveLength(1);
      const command = commands[0];

      expect(command.commandType).toBe('EXECUTE_CONTACT');
      expect(command.channel).toBe('voice');
      expect(command.opportunityId).toBe('opp-123');
      expect(command.tenantId).toBe('tenant-456');
      expect(command.playbookId).toBe('inbound_lead_v1');
      expect(command.stageId).toBe('prospect_identified');
      expect(command.actionId).toBe('initial_contact_attempt');
      expect(command.evidenceRequired).toBe('call_attempt_logged');
      expect(command.humanAllowed).toBe(true);
      expect(command.aiAllowed).toBe(true);
      expect(command.correlationId).toBe('corr-789');
    });

    it('should return empty array for non-existent stage', () => {
      const commands = planner.planStageActions(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'nonexistent_stage',
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(commands).toEqual([]);
    });
  });

  describe('planAction', () => {
    it('should create EXECUTE_CONTACT command for contact_attempt action', () => {
      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.prospect_identified;
      const action = stage.mustDo[0];

      const command = planner.planAction(
        action,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.commandType).toBe('EXECUTE_CONTACT');
      expect(command.channel).toBe('voice');
      expect(command.contactData).toEqual({});
      expect(command.scriptId).toBeUndefined();
    });

    it('should create EXECUTE_CONTACT command for qualification_call action', () => {
      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.initial_contact;
      const action = stage.mustDo[0];

      const command = planner.planAction(
        action,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.commandType).toBe('EXECUTE_CONTACT');
      expect(command.channel).toBe('voice');
      expect(command.scriptId).toBe('qualification_v3');
      expect(command.humanAllowed).toBe(true);
      expect(command.aiAllowed).toBe(false); // Qualification requires human
    });

    it('should create SEND_MESSAGE command for send_message action', () => {
      const mockAction = {
        actionId: 'send_followup',
        actionType: 'send_message' as const,
        channel: 'email' as const,
        slaMinutes: 1440,
        templateId: 'followup_template',
        evidenceRequired: 'message_sent' as const,
        humanAllowed: true,
        aiAllowed: true,
      };

      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.prospect_identified;

      const command = planner.planAction(
        mockAction,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.commandType).toBe('SEND_MESSAGE');
      expect(command.channel).toBe('email');
      expect(command.messageData).toEqual({
        templateId: 'followup_template',
        body: '',
        variables: {},
      });
    });

    it('should create SCHEDULE_MEETING command for schedule_meeting action', () => {
      const mockAction = {
        actionId: 'schedule_discovery',
        actionType: 'schedule_meeting' as const,
        channel: 'calendar' as const,
        slaMinutes: 4320,
        evidenceRequired: 'meeting_scheduled' as const,
        humanAllowed: true,
        aiAllowed: false,
      };

      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.needs_analysis;

      const command = planner.planAction(
        mockAction,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.commandType).toBe('SCHEDULE_MEETING');
      expect(command.channel).toBe('calendar');
      expect(command.meetingData).toEqual({
        title: `Meeting for ${stage.displayName}`,
        durationMinutes: 60,
      });
    });
  });

  describe('priority calculation', () => {
    it('should set urgent priority for very short SLA', () => {
      const mockAction = {
        actionId: 'urgent_action',
        actionType: 'contact_attempt' as const,
        channel: 'voice' as const,
        slaMinutes: 15, // Very short SLA
        evidenceRequired: 'call_attempt_logged' as const,
        humanAllowed: true,
        aiAllowed: true,
      };

      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.prospect_identified;

      const command = planner.planAction(
        mockAction,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.priority).toBe('urgent');
    });

    it('should set high priority for short SLA', () => {
      const mockAction = {
        actionId: 'high_priority_action',
        actionType: 'contact_attempt' as const,
        channel: 'voice' as const,
        slaMinutes: 60, // Short SLA
        evidenceRequired: 'call_attempt_logged' as const,
        humanAllowed: true,
        aiAllowed: true,
      };

      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.prospect_identified;

      const command = planner.planAction(
        mockAction,
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        stage,
        'opp-123',
        'tenant-456',
        'corr-789'
      );

      expect(command.priority).toBe('high');
    });

    it('should set normal priority for standard SLA', () => {
      const command = planner.planStageActions(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        'opp-123',
        'tenant-456',
        'corr-789'
      )[0];

      expect(command.priority).toBe('normal');
    });
  });
});
