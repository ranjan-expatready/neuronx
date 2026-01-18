#!/usr/bin/env tsx

/**
 * UAT Seed GHL - WI-066: UAT Harness + Seed + Safety
 *
 * Creates production-like test data in UAT GHL accounts for end-to-end testing.
 * ONLY runs when LIVE_UAT mode is enabled and GHL location allowlists are configured.
 * Requires GHL API access and proper authentication.
 */

import { Command } from 'commander';
import { z } from 'zod';
import { getUatConfig } from '@neuronx/uat-harness';

// Validation schemas
const GhlSeedOptionsSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  ghlLocationId: z.string().min(1, 'GHL location ID is required'),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
});

type GhlSeedOptions = z.infer<typeof GhlSeedOptionsSchema>;

// GHL API client interface (simplified for this implementation)
interface GhlApiClient {
  createContact(contact: any): Promise<{ id: string }>;
  createOpportunity(opportunity: any): Promise<{ id: string }>;
  createTask(task: any): Promise<{ id: string }>;
}

// Seed result types
interface GhlSeedResult {
  success: boolean;
  tenantId: string;
  ghlLocationId: string;
  created: {
    contacts?: Array<{ id: string; name: string; ghlId: string }>;
    opportunities?: Array<{ id: string; title: string; ghlId: string }>;
    tasks?: Array<{ id: string; title: string; ghlId: string }>;
  };
  errors: string[];
  warnings: string[];
  actions: string[];
}

interface GhlSeedContext {
  options: GhlSeedOptions;
  result: GhlSeedResult;
  ghlClient?: GhlApiClient;
}

/**
 * Main GHL seeding function
 */
async function seedGhl(options: GhlSeedOptions): Promise<GhlSeedResult> {
  const result: GhlSeedResult = {
    success: false,
    tenantId: options.tenantId,
    ghlLocationId: options.ghlLocationId,
    created: {},
    errors: [],
    warnings: [],
    actions: [],
  };

  const context: GhlSeedContext = { options, result };

  try {
    console.log(
      `🌱 Starting GHL UAT seeding for tenant: ${options.tenantId}, location: ${options.ghlLocationId}`
    );
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No external API calls will be made');
    }

    // Step 1: Validate UAT environment and GHL safety
    await validateGhlUatEnvironment(context);

    // Step 2: Initialize GHL API client (mocked for safety)
    await initializeGhlClient(context);

    // Step 3: Create GHL contacts
    await createGhlContacts(context);

    // Step 4: Create GHL opportunities
    await createGhlOpportunities(context);

    // Step 5: Create GHL tasks
    await createGhlTasks(context);

    result.success = true;
    console.log('✅ GHL UAT seeding completed successfully');
  } catch (error) {
    result.errors.push(
      `GHL seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    console.error('❌ GHL seeding failed:', error.message);
  }

  return result;
}

/**
 * Validate GHL UAT environment safety
 */
async function validateGhlUatEnvironment(
  context: GhlSeedContext
): Promise<void> {
  const { options, result } = context;

  console.log('🔍 Validating GHL UAT environment safety...');

  const uatConfig = getUatConfig();

  // Must be in UAT environment
  if (uatConfig.neuronxEnv !== 'uat') {
    throw new Error(
      `GHL seeding only allowed in UAT environment (current: ${uatConfig.neuronxEnv})`
    );
  }

  // Must have kill switch disabled (LIVE_UAT mode)
  if (uatConfig.uatKillSwitch) {
    throw new Error(
      'GHL seeding requires LIVE_UAT mode (kill switch must be disabled)'
    );
  }

  // Must be allowlisted tenant
  if (!uatConfig.uatTenantIds.includes(options.tenantId)) {
    throw new Error(`Tenant ${options.tenantId} not in UAT allowlist`);
  }

  // Must be allowlisted GHL location
  if (!uatConfig.uatGhlLocationIds.includes(options.ghlLocationId)) {
    throw new Error(
      `GHL location ${options.ghlLocationId} not in UAT allowlist`
    );
  }

  // Check if this looks like a production location ID
  if (
    options.ghlLocationId.includes('prod') ||
    options.ghlLocationId.includes('production')
  ) {
    throw new Error(
      'SAFETY VIOLATION: Cannot seed data into production-like GHL location IDs'
    );
  }

  result.actions.push('GHL UAT environment safety validated');
  result.warnings.push(
    'WARNING: This script will make real API calls to GHL - ensure test credentials are configured'
  );
}

/**
 * Initialize GHL API client
 */
async function initializeGhlClient(context: GhlSeedContext): Promise<void> {
  const { options, result } = context;

  console.log('🔗 Initializing GHL API client...');

  if (options.dryRun) {
    result.actions.push(
      'WOULD INITIALIZE GHL API client (dry run - no actual connection)'
    );
    return;
  }

  // TODO: Implement actual GHL API client initialization
  // This would require GHL API credentials and proper authentication
  // For now, we'll create a mock client that logs what it would do

  context.ghlClient = {
    createContact: async (contact: any) => {
      console.log(
        `📞 WOULD CREATE GHL Contact: ${contact.name} (${contact.email})`
      );
      return { id: `ghl_contact_mock_${Date.now()}` };
    },
    createOpportunity: async (opportunity: any) => {
      console.log(
        `🎯 WOULD CREATE GHL Opportunity: ${opportunity.title} ($${opportunity.value})`
      );
      return { id: `ghl_opp_mock_${Date.now()}` };
    },
    createTask: async (task: any) => {
      console.log(`📋 WOULD CREATE GHL Task: ${task.title} (${task.dueDate})`);
      return { id: `ghl_task_mock_${Date.now()}` };
    },
  };

  result.actions.push('GHL API client initialized (mock implementation)');
  result.warnings.push(
    'WARNING: Using mock GHL client - actual GHL API integration not yet implemented'
  );
}

/**
 * Create GHL contacts
 */
async function createGhlContacts(context: GhlSeedContext): Promise<void> {
  const { options, result, ghlClient } = context;

  console.log('📞 Creating GHL contacts...');

  const contactDefinitions = [
    {
      name: '[UAT] John Smith',
      email: 'john.smith.uat@techcorp.com',
      phone: '+1555123456',
      company: 'TechCorp Inc - UAT',
      tags: ['uat', 'test-data'],
    },
    {
      name: '[UAT] Emily Davis',
      email: 'emily.davis.uat@globalsolutions.com',
      phone: '+1555123457',
      company: 'Global Solutions - UAT',
      tags: ['uat', 'qualified-lead'],
    },
    {
      name: '[UAT] Robert Wilson',
      email: 'robert.wilson.uat@innovate.com',
      phone: '+1555123458',
      company: 'Innovate Ltd - UAT',
      tags: ['uat', 'hot-lead'],
    },
  ];

  const createdContacts: Array<{ id: string; name: string; ghlId: string }> =
    [];

  for (const contactDef of contactDefinitions) {
    if (options.dryRun) {
      result.actions.push(`WOULD CREATE GHL Contact: ${contactDef.name}`);
      createdContacts.push({
        id: `uat_ghl_contact_${contactDef.email.split('@')[0]}`,
        name: contactDef.name,
        ghlId: 'dry_run_mock_id',
      });
      continue;
    }

    if (!ghlClient) {
      throw new Error('GHL client not initialized');
    }

    try {
      const ghlResult = await ghlClient.createContact(contactDef);
      const contactId = `uat_ghl_contact_${contactDef.email.split('@')[0]}`;

      createdContacts.push({
        id: contactId,
        name: contactDef.name,
        ghlId: ghlResult.id,
      });

      result.actions.push(
        `Created GHL Contact: ${contactDef.name} (${ghlResult.id})`
      );
    } catch (error) {
      result.errors.push(
        `Failed to create GHL contact ${contactDef.name}: ${error}`
      );
    }
  }

  result.created.contacts = createdContacts;
}

/**
 * Create GHL opportunities
 */
async function createGhlOpportunities(context: GhlSeedContext): Promise<void> {
  const { options, result, ghlClient } = context;

  if (!result.created.contacts) {
    throw new Error('GHL contacts must be created before opportunities');
  }

  console.log('🎯 Creating GHL opportunities...');

  const opportunityDefinitions = [
    {
      title: '[UAT] TechCorp Website Redesign',
      value: 75000,
      contactId: result.created.contacts[0].ghlId,
      status: 'open',
      pipeline: 'sales',
      tags: ['uat', 'high-value'],
    },
    {
      title: '[UAT] Global Solutions CRM Implementation',
      value: 125000,
      contactId: result.created.contacts[1].ghlId,
      status: 'qualified',
      pipeline: 'sales',
      tags: ['uat', 'enterprise'],
    },
  ];

  const createdOpportunities: Array<{
    id: string;
    title: string;
    ghlId: string;
  }> = [];

  for (const oppDef of opportunityDefinitions) {
    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE GHL Opportunity: ${oppDef.title} ($${oppDef.value})`
      );
      createdOpportunities.push({
        id: `uat_ghl_opp_${oppDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: oppDef.title,
        ghlId: 'dry_run_mock_id',
      });
      continue;
    }

    if (!ghlClient) {
      throw new Error('GHL client not initialized');
    }

    try {
      const ghlResult = await ghlClient.createOpportunity(oppDef);
      const opportunityId = `uat_ghl_opp_${oppDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;

      createdOpportunities.push({
        id: opportunityId,
        title: oppDef.title,
        ghlId: ghlResult.id,
      });

      result.actions.push(
        `Created GHL Opportunity: ${oppDef.title} (${ghlResult.id})`
      );
    } catch (error) {
      result.errors.push(
        `Failed to create GHL opportunity ${oppDef.title}: ${error}`
      );
    }
  }

  result.created.opportunities = createdOpportunities;
}

/**
 * Create GHL tasks
 */
async function createGhlTasks(context: GhlSeedContext): Promise<void> {
  const { options, result, ghlClient } = context;

  console.log('📋 Creating GHL tasks...');

  const taskDefinitions = [
    {
      title: '[UAT] Follow up with TechCorp',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      contactId: result.created.contacts?.[0].ghlId,
      type: 'call',
      priority: 'high',
      tags: ['uat', 'follow-up'],
    },
    {
      title: '[UAT] Schedule demo for Global Solutions',
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      contactId: result.created.contacts?.[1].ghlId,
      type: 'meeting',
      priority: 'high',
      tags: ['uat', 'demo'],
    },
  ];

  const createdTasks: Array<{ id: string; title: string; ghlId: string }> = [];

  for (const taskDef of taskDefinitions) {
    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE GHL Task: ${taskDef.title} (${taskDef.dueDate})`
      );
      createdTasks.push({
        id: `uat_ghl_task_${taskDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: taskDef.title,
        ghlId: 'dry_run_mock_id',
      });
      continue;
    }

    if (!ghlClient) {
      throw new Error('GHL client not initialized');
    }

    try {
      const ghlResult = await ghlClient.createTask(taskDef);
      const taskId = `uat_ghl_task_${taskDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;

      createdTasks.push({
        id: taskId,
        title: taskDef.title,
        ghlId: ghlResult.id,
      });

      result.actions.push(
        `Created GHL Task: ${taskDef.title} (${ghlResult.id})`
      );
    } catch (error) {
      result.errors.push(
        `Failed to create GHL task ${taskDef.title}: ${error}`
      );
    }
  }

  result.created.tasks = createdTasks;
}

/**
 * Print results in human-readable format
 */
function printResults(result: GhlSeedResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`GHL UAT SEEDING RESULTS - ${result.tenantId.toUpperCase()}`);
  console.log(`LOCATION: ${result.ghlLocationId}`);
  console.log('='.repeat(60));

  if (result.success) {
    console.log('✅ STATUS: SUCCESS');
  } else {
    console.log('❌ STATUS: FAILED');
  }

  if (result.created.contacts && result.created.contacts.length > 0) {
    console.log(`📞 GHL Contacts: ${result.created.contacts.length} created`);
    result.created.contacts.forEach(contact => {
      console.log(`   - ${contact.name} (GHL ID: ${contact.ghlId})`);
    });
  }

  if (result.created.opportunities && result.created.opportunities.length > 0) {
    console.log(
      `🎯 GHL Opportunities: ${result.created.opportunities.length} created`
    );
    result.created.opportunities.forEach(opp => {
      console.log(`   - ${opp.title} (GHL ID: ${opp.ghlId})`);
    });
  }

  if (result.created.tasks && result.created.tasks.length > 0) {
    console.log(`📋 GHL Tasks: ${result.created.tasks.length} created`);
    result.created.tasks.forEach(task => {
      console.log(`   - ${task.title} (GHL ID: ${task.ghlId})`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    result.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }

  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    result.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
  }

  console.log('\n📋 ACTIONS PERFORMED:');
  result.actions.forEach(action => {
    console.log(`   • ${action}`);
  });

  console.log('\n' + '='.repeat(60));

  if (result.success) {
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Verify GHL data in your test account');
    console.log('2. Run golden-run script to test NeuronX ↔ GHL integration');
    console.log('3. Monitor for any production data pollution');
  }
}

/**
 * Main CLI execution
 */
async function main() {
  const program = new Command();

  program
    .name('seed-ghl')
    .description('Seed UAT GHL account with test data (LIVE_UAT mode only)')
    .version('1.0.0')
    .requiredOption('-t, --tenant-id <id>', 'UAT tenant ID')
    .requiredOption('-l, --ghl-location-id <id>', 'GHL location ID to seed')
    .option('--dry-run', 'Show what would be done without making API calls')
    .option('--force', 'Override existing GHL data')
    .option(
      '--json',
      'Output results as JSON instead of human-readable format'
    );

  program.parse();

  const options = program.opts();
  options.dryRun = options.dryRun || false;
  options.force = options.force || false;

  try {
    // Validate options
    const validatedOptions = GhlSeedOptionsSchema.parse(options);

    // Run GHL seeding
    const result = await seedGhl(validatedOptions);

    // Output results
    if (program.opts().json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResults(result);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ GHL seeding failed:', error.message);
    console.error('\nUsage:');
    program.help();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { seedGhl, GhlSeedOptions };
