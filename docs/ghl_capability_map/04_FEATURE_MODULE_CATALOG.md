# Feature Module Catalog

**Last verified:** 2026-01-03
**Sources:** [GHL API Reference](https://developers.gohighlevel.com/reference/api-reference), [GHL Feature Overview](https://www.gohighlevel.com/features)

## Contacts Module

### What It Is

Core customer relationship management with contact records, custom fields, tags, and lifecycle tracking.

### Core Objects

- **Contact Records:** Customer profiles with standard fields (name, email, phone, address)
- **Custom Fields:** Flexible data extension for business-specific information
- **Tags:** Categorization and segmentation labels
- **Contact Lists:** Grouped collections for targeted operations
- **Contact Activities:** Interaction history and engagement tracking

### Common Automations

- **Lead Capture:** Form submissions automatically create/update contacts
- **Tag-Based Workflows:** Contact tagging triggers automated sequences
- **Lifecycle Management:** Contact status changes based on engagement
- **Data Enrichment:** Automatic contact information updates from integrations

### What NeuronX Can Leverage

- **Lead Ingestion:** Real-time contact creation from various sources
- **Contact Scoring:** Custom fields for ML model inputs and scoring results
- **Segmentation:** Tag-based audience creation for targeted campaigns
- **Data Synchronization:** Bidirectional sync with NeuronX contact database
- **Lifecycle Tracking:** Contact journey analytics and optimization

### Constraints / Gotchas

- **Location Scoping:** Contacts belong to specific locations, no cross-location access
- **Custom Field Limits:** 50 custom fields per contact (soft limit)
- **Bulk Operations:** Rate-limited for large contact updates
- **Duplicate Handling:** No built-in deduplication, requires custom logic
- **GDPR Compliance:** Contact deletion affects associated opportunities and communications

**Source:** [Contacts API](https://developers.gohighlevel.com/reference/contacts)

## Opportunities Module

### What It Is

Sales pipeline management with deal tracking, stage progression, and revenue forecasting.

### Core Objects

- **Opportunity Records:** Sales deals with values, stages, and timelines
- **Pipeline Stages:** Configurable sales process steps
- **Opportunity Contacts:** Associated customer relationships
- **Activities:** Sales interactions and task tracking
- **Forecasting:** Revenue projections and analytics

### Common Automations

- **Stage Progression:** Automatic advancement based on activities or time
- **Task Creation:** Follow-up tasks generated based on stage entry
- **Notification Triggers:** Email/SMS alerts for stage changes
- **SLA Monitoring:** Time-based escalation for stuck opportunities

### What NeuronX Can Leverage

- **Pipeline Intelligence:** AI-driven opportunity scoring and prioritization
- **Automated Progression:** Rule-based stage advancement
- **Forecasting Enhancement:** ML-powered revenue predictions
- **Activity Tracking:** Comprehensive sales interaction logging
- **Performance Analytics:** Conversion rate optimization and bottleneck identification

### Constraints / Gotchas

- **Pipeline Limits:** Maximum 100 stages per pipeline
- **Currency Handling:** Single currency per opportunity (location setting)
- **Contact Association:** One primary contact per opportunity
- **Historical Tracking:** Full audit trail of stage changes and value updates
- **Bulk Operations:** Limited bulk update capabilities for opportunities

**Source:** [Opportunities API](https://developers.gohighlevel.com/reference/opportunities)

## Workflows Module

### What It Is

Visual automation builder for creating complex business processes and customer journeys.

### Core Objects

- **Workflow Templates:** Pre-built automation sequences
- **Workflow Instances:** Active running automations
- **Trigger Conditions:** Events that start workflow execution
- **Action Steps:** Individual automation actions (email, SMS, update, wait, etc.)
- **Workflow Analytics:** Performance metrics and conversion tracking

### Common Automations

- **Lead Nurturing:** Multi-touch email sequences based on engagement
- **Customer Onboarding:** Automated welcome series and setup processes
- **Re-engagement Campaigns:** Win-back sequences for inactive contacts
- **Lifecycle Management:** Birthday emails, anniversary sequences
- **Sales Follow-up:** Automated follow-up sequences after opportunities

### What NeuronX Can Leverage

- **Intelligent Triggers:** AI-driven workflow initiation based on scoring
- **Dynamic Content:** Personalized messaging based on contact attributes
- **Performance Optimization:** A/B testing and optimization of workflow steps
- **Cross-Channel Orchestration:** Coordinated email, SMS, and call sequences
- **Conditional Branching:** Complex decision trees based on contact behavior

### Constraints / Gotchas

- **Step Limits:** Maximum 50 steps per workflow
- **Execution Delays:** Minimum 1-minute delays between steps
- **Trigger Limits:** Maximum 10 active workflows per contact
- **Testing Challenges:** No sandbox environment for workflow testing
- **Version Control:** Limited workflow versioning and rollback

**Source:** [Workflows API](https://developers.gohighlevel.com/reference/workflows)

## Conversations Module

### What It Is

Omnichannel communication management for email, SMS, phone, and social media interactions.

### Core Objects

- **Conversation Threads:** Customer interaction histories
- **Messages:** Individual communications within threads
- **Channels:** Email, SMS, Facebook, Instagram, etc.
- **Templates:** Pre-built message templates
- **Automation Rules:** Auto-responses and routing rules

### Common Automations

- **Auto-Responses:** Instant replies to common inquiries
- **Routing Rules:** Automatic assignment based on keywords or sender
- **Escalation Triggers:** Automatic manager notification for urgent issues
- **Follow-up Sequences:** Automated follow-up messages
- **Satisfaction Surveys:** Post-interaction feedback collection

### What NeuronX Can Leverage

- **Intelligent Routing:** AI-powered conversation assignment and prioritization
- **Automated Responses:** Smart auto-replies based on conversation context
- **Sentiment Analysis:** Real-time conversation monitoring and alerts
- **Multi-Channel Orchestration:** Coordinated responses across channels
- **Performance Analytics:** Conversation quality and resolution time tracking

### Constraints / Gotchas

- **Channel Limits:** Varies by plan (email/SMS limits apply)
- **Message Retention:** 90-day conversation history limit
- **Attachment Handling:** Size limits vary by channel
- **International SMS:** Additional costs and restrictions
- **API Rate Limits:** Strict limits on message sending endpoints

**Source:** [Conversations API](https://developers.gohighlevel.com/reference/conversations)

## Campaigns Module

### What It Is

Marketing campaign management with email, SMS, and social media campaign creation and execution.

### Core Objects

- **Campaign Records:** Marketing campaign definitions
- **Campaign Contacts:** Target audience lists
- **Campaign Steps:** Individual campaign actions (send, wait, condition, etc.)
- **Campaign Analytics:** Delivery rates, open rates, click rates, conversions
- **A/B Testing:** Campaign variation testing and optimization

### Common Automations

- **Drip Campaigns:** Timed email sequences for lead nurturing
- **Re-engagement Campaigns:** Win-back campaigns for inactive contacts
- **Promotional Campaigns:** Product launch and special offer campaigns
- **Lifecycle Campaigns:** Birthday, anniversary, and milestone campaigns
- **Educational Campaigns:** Content marketing and thought leadership

### What NeuronX Can Leverage

- **Intelligent Targeting:** AI-driven audience segmentation and campaign triggers
- **Dynamic Content:** Personalized campaign content based on contact profiles
- **Performance Optimization:** ML-powered campaign optimization and A/B testing
- **Multi-Touch Orchestration:** Coordinated campaigns across multiple channels
- **Predictive Analytics:** Campaign performance forecasting and ROI prediction

### Constraints / Gotchas

- **Sending Limits:** Daily/weekly email and SMS limits by plan
- **Template Limits:** Maximum 100 campaign templates
- **A/B Testing:** Limited to 2-3 variations per campaign
- **Scheduling:** Minimum 15-minute delays between campaign steps
- **Unsubscribe Handling:** Manual unsubscribe list management required

**Source:** [Campaigns API](https://developers.gohighlevel.com/reference/campaigns)

## Calendars Module

### What It Is

Appointment scheduling and calendar management for meetings, calls, and events.

### Core Objects

- **Calendar Events:** Scheduled appointments and meetings
- **Calendar Resources:** Available time slots and booking rules
- **Contact Bookings:** Customer appointment reservations
- **Availability Rules:** Business hours and booking restrictions
- **Reminder Systems:** Automated appointment reminders

### Common Automations

- **Booking Confirmations:** Automatic confirmation emails/SMS
- **Reminder Sequences:** Pre-appointment reminder schedules
- **No-Show Handling:** Follow-up sequences for missed appointments
- **Rescheduling Workflows:** Automated rescheduling and confirmation
- **Capacity Management:** Automatic blocking of overbooked time slots

### What NeuronX Can Leverage

- **Intelligent Scheduling:** AI-optimized appointment booking and routing
- **Automated Follow-up:** Smart post-appointment sequences
- **Performance Analytics:** Booking conversion and no-show rate optimization
- **Resource Optimization:** Dynamic calendar availability based on sales capacity
- **Integration Orchestration:** Calendar events trigger related sales activities

### Constraints / Gotchas

- **Time Zone Handling:** UTC storage with local display conversion
- **Concurrency Issues:** Race conditions with simultaneous bookings
- **Cancellation Policies:** No built-in cancellation fee handling
- **Integration Limits:** Limited third-party calendar sync options
- **Reminder Limits:** Maximum 3 reminders per appointment

**Source:** [Calendars API](https://developers.gohighlevel.com/reference/calendars)

## Users Module

### What It Is

User account management and permission system for agency and location staff.

### Core Objects

- **User Accounts:** Staff member profiles and credentials
- **Role Definitions:** Permission sets and access levels
- **Location Assignments:** User access to specific locations
- **Permission Matrix:** Granular feature access controls
- **Activity Logs:** User action tracking and audit trails

### Common Automations

- **User Provisioning:** Automatic account creation for new hires
- **Role Transitions:** Automated permission updates for role changes
- **Access Reviews:** Periodic permission audit and cleanup
- **Onboarding Sequences:** Welcome emails and training assignments
- **Offboarding Processes:** Account deactivation and data cleanup

### What NeuronX Can Leverage

- **User Synchronization:** Automatic user provisioning in NeuronX
- **Permission Mapping:** GHL role translation to NeuronX permissions
- **Activity Monitoring:** User behavior analytics and performance tracking
- **Access Control:** Location-based user access management
- **Compliance Auditing:** User action logging for regulatory requirements

### Constraints / Gotchas

- **Role Complexity:** Limited custom role creation capabilities
- **Location Limits:** Users can access maximum 50 locations
- **API Limitations:** No bulk user operations
- **Audit Retention:** 1-year activity log retention
- **SSO Limitations:** Basic SAML support, no advanced federation

**Source:** [Users API](https://developers.gohighlevel.com/reference/users)

## Integration Assessment

### High-Value Modules for NeuronX

1. **Contacts** - Core lead management and data foundation
2. **Opportunities** - Sales pipeline intelligence and automation
3. **Workflows** - Process automation and customer journeys
4. **Conversations** - Multi-channel communication orchestration

### Medium-Value Modules

1. **Campaigns** - Marketing automation and lead nurturing
2. **Calendars** - Appointment scheduling and follow-up
3. **Users** - Team management and permission synchronization

### Low-Value Modules

1. **Advanced Analytics** - NeuronX provides superior analytics
2. **Invoice Management** - Outside NeuronX's sales focus
3. **Membership Management** - Niche use cases

This module catalog provides the foundation for mapping NeuronX features to specific GHL capabilities while understanding constraints and automation opportunities.
