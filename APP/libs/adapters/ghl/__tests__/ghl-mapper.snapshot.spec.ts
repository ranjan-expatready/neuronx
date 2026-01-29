// Snapshot Tests for GHL Mapper
// Ensures consistent GHL ↔ Canonical data transformations

import { GhlMapper } from '../ghl.mapper';
import { GhlContact, GhlOpportunity, GhlPipeline } from '../ghl.types';

describe('GHL Mapper - Data Transformation Snapshots', () => {
  // Mock Date to ensure deterministic timestamps in snapshots
  const mockDate = new Date('2024-01-01T12:00:00.000Z');
  const originalDate = global.Date;

  beforeEach(() => {
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }

      static now() {
        return mockDate.getTime();
      }
    } as any;
  });

  afterEach(() => {
    global.Date = originalDate;
  });
  describe('Contact Mapping', () => {
    it('should map GHL contact to canonical Lead', () => {
      const ghlContact: GhlContact = {
        id: 'contact_123',
        locationId: 'loc_456',
        contactName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        tags: ['lead', 'website'],
        customFields: {
          company_size: '50-100',
          source: 'website',
        },
        dateAdded: '2024-01-01T10:00:00Z',
        dateUpdated: '2024-01-02T10:00:00Z',
      };

      const result = GhlMapper.mapContact(ghlContact, 'tenant_123');

      // Snapshot test - ensures consistent transformation
      expect(result).toMatchSnapshot();

      // Key assertions
      expect(result.id).toBe('contact_123');
      expect(result.tenantId).toBe('tenant_123');
      expect(result.externalId).toBe('contact_123');
      expect(result.email).toBe('john@example.com');
      expect(result.firstName).toBe('John');
      expect(result.tags).toEqual(['lead', 'website']);
      expect(result.customFields).toEqual({
        company_size: '50-100',
        source: 'website',
      });
    });

    it('should unmap Lead to GHL contact format', () => {
      const lead = {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'Acme Corp',
        tags: ['prospect', 'demo'],
        customFields: { industry: 'tech' },
      };

      const result = GhlMapper.unmapLead(lead);

      expect(result).toMatchSnapshot();
      expect(result.email).toBe('jane@example.com');
      expect(result.firstName).toBe('Jane');
      expect(result.tags).toEqual(['prospect', 'demo']);
    });
  });

  describe('Opportunity Mapping', () => {
    it('should map GHL opportunity to canonical Opportunity', () => {
      const ghlOpportunity: GhlOpportunity = {
        id: 'opp_789',
        locationId: 'loc_456',
        contactId: 'contact_123',
        name: 'Enterprise Deal',
        status: 'active',
        pipelineId: 'pipe_123',
        pipelineStageId: 'stage_002',
        assignedTo: 'user_456',
        value: 50000,
        currency: 'USD',
        customFields: { deal_type: 'enterprise' },
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
      };

      const result = GhlMapper.mapOpportunity(ghlOpportunity, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.id).toBe('opp_789');
      expect(result.name).toBe('Enterprise Deal');
      expect(result.value).toBe(50000);
      expect(result.stage).toBe('stage_002'); // Maps to stage ID
      expect(result.pipelineId).toBe('pipe_123');
    });
  });

  describe('Pipeline Mapping', () => {
    it('should map GHL pipeline with stages', () => {
      const ghlPipeline: GhlPipeline = {
        id: 'pipe_123',
        locationId: 'loc_456',
        name: 'Sales Pipeline',
        stages: [
          {
            id: 'stage_001',
            name: 'New Lead',
            order: 1,
          },
          {
            id: 'stage_002',
            name: 'Contacted',
            order: 2,
          },
          {
            id: 'stage_003',
            name: 'Qualified',
            order: 3,
          },
        ],
      };

      const result = GhlMapper.mapPipeline(ghlPipeline, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.stages).toHaveLength(3);
      expect(result.stages[0].name).toBe('New Lead');
      expect(result.stages[1].order).toBe(2);
    });
  });

  describe('Message Mapping', () => {
    it('should map different message types', () => {
      const emailMessage = {
        id: 'msg_123',
        conversationId: 'conv_456',
        message: 'Hello, interested in your services',
        type: 'email',
        direction: 'inbound',
        from: 'prospect@example.com',
        to: 'sales@company.com',
        createdAt: '2024-01-01T10:00:00Z',
      };

      const result = GhlMapper.mapMessage(emailMessage, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.type).toBe('email');
      expect(result.direction).toBe('inbound');
      expect(result.content).toBe('Hello, interested in your services');
    });

    it('should map SMS message', () => {
      const smsMessage = {
        id: 'msg_124',
        conversationId: 'conv_456',
        message: 'Thanks for the demo!',
        type: 'sms',
        direction: 'outbound',
        from: '+1234567890',
        to: '+0987654321',
        createdAt: '2024-01-01T10:15:00Z',
      };

      const result = GhlMapper.mapMessage(smsMessage, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.type).toBe('sms');
      expect(result.direction).toBe('outbound');
    });
  });

  describe('Workflow Mapping', () => {
    it('should map GHL workflow to canonical Workflow', () => {
      const ghlWorkflow = {
        id: 'workflow_123',
        locationId: 'loc_456',
        name: 'Lead Nurture Sequence',
        status: 'active',
        triggers: [
          {
            type: 'contact.tag',
            conditions: { tag: 'nurture' },
          },
        ],
        steps: [
          {
            id: 'step_001',
            type: 'email',
            name: 'Welcome Email',
            config: { templateId: 'template_123' },
            order: 1,
          },
        ],
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
      };

      const result = GhlMapper.mapWorkflow(ghlWorkflow, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.name).toBe('Lead Nurture Sequence');
      expect(result.triggerType).toBe('contact.tag');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('email');
    });
  });

  describe('User Mapping', () => {
    it('should map GHL user to canonical User', () => {
      const ghlUser = {
        id: 'user_123',
        email: 'sales@company.com',
        firstName: 'John',
        lastName: 'Sales',
        role: 'Sales Rep',
        permissions: ['contacts.read', 'opportunities.write'],
        lastLogin: '2024-01-01T09:00:00Z',
        createdAt: '2023-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      };

      const result = GhlMapper.mapUser(ghlUser, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.email).toBe('sales@company.com');
      expect(result.role).toBe('Sales Rep');
      expect(result.permissions).toEqual([
        'contacts.read',
        'opportunities.write',
      ]);
    });
  });

  describe('Calendar Event Mapping', () => {
    it('should map GHL calendar event', () => {
      const ghlEvent = {
        id: 'event_123',
        locationId: 'loc_456',
        title: 'Product Demo',
        startTime: '2024-01-15T14:00:00Z',
        endTime: '2024-01-15T15:00:00Z',
        contactId: 'contact_789',
        assignedTo: 'user_456',
        status: 'confirmed',
        attendees: ['user_456', 'contact_789'],
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
      };

      const result = GhlMapper.mapCalendarEvent(ghlEvent, 'tenant_123');

      expect(result).toMatchSnapshot();
      expect(result.title).toBe('Product Demo');
      expect(result.startTime).toEqual(new Date('2024-01-15T14:00:00Z'));
      expect(result.status).toBe('confirmed');
      expect(result.attendees).toEqual(['user_456', 'contact_789']);
    });
  });
});
