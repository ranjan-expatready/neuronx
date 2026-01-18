#!/usr/bin/env tsx

/**
 * UAT Seed NeuronX - WI-066: UAT Harness + Seed + Safety
 *
 * Creates deterministic, production-like test data in NeuronX for UAT testing.
 * Safe to re-run, idempotent, and creates isolated UAT tenant data.
 */

import { PrismaClient } from '@prisma/client';
import { Command } from 'commander';
import { z } from 'zod';

// Validation schemas
const SeedOptionsSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
  skipOpportunities: z.boolean().default(false),
});

type SeedOptions = z.infer<typeof SeedOptionsSchema>;

// Seed result types
interface SeedResult {
  success: boolean;
  tenantId: string;
  created: {
    enterprise?: { id: string; name: string };
    agency?: { id: string; name: string };
    teams?: Array<{ id: string; name: string }>;
    members?: Array<{ id: string; displayName: string; roles: string[] }>;
    opportunities?: Array<{ id: string; title: string; state: string }>;
    contacts?: Array<{ id: string; name: string }>;
  };
  errors: string[];
  warnings: string[];
  actions: string[];
}

interface SeedContext {
  prisma: PrismaClient;
  options: SeedOptions;
  result: SeedResult;
}

/**
 * Main seeding function
 */
async function seedNeuronx(options: SeedOptions): Promise<SeedResult> {
  const prisma = new PrismaClient();
  const result: SeedResult = {
    success: false,
    tenantId: options.tenantId,
    created: {},
    errors: [],
    warnings: [],
    actions: [],
  };

  const context: SeedContext = { prisma, options, result };

  try {
    console.log(
      `🌱 Starting NeuronX UAT seeding for tenant: ${options.tenantId}`
    );
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Step 1: Validate UAT environment safety
    await validateUatEnvironment(context);

    // Step 2: Create/update enterprise with UAT labeling
    await createOrUpdateEnterprise(context);

    // Step 3: Create/update agency
    await createOrUpdateAgency(context);

    // Step 4: Create teams
    await createTeams(context);

    // Step 5: Create team members
    await createTeamMembers(context);

    // Step 6: Create contacts (if not skipping opportunities)
    if (!options.skipOpportunities) {
      await createContacts(context);
    }

    // Step 7: Create opportunities with realistic data
    if (!options.skipOpportunities) {
      await createOpportunities(context);
    }

    // Step 8: Create decision explanations for some opportunities
    if (!options.skipOpportunities) {
      await createDecisionExplanations(context);
    }

    result.success = true;
    console.log('✅ NeuronX UAT seeding completed successfully');
  } catch (error) {
    result.errors.push(
      `Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

/**
 * Validate UAT environment safety
 */
async function validateUatEnvironment(context: SeedContext): Promise<void> {
  const { options, result } = context;

  console.log('🔍 Validating UAT environment safety...');

  // Check if this looks like a production tenant ID
  if (
    options.tenantId.includes('prod') ||
    options.tenantId.includes('production')
  ) {
    throw new Error(
      'SAFETY VIOLATION: Cannot seed data into production-like tenant IDs'
    );
  }

  // Check if tenant already has significant data (unless force is used)
  const existingEnterprise = await context.prisma.enterprise.findFirst({
    where: { tenantId: options.tenantId },
    include: {
      agencies: {
        include: {
          teams: true,
          opportunities: true,
        },
      },
    },
  });

  if (existingEnterprise && !options.force) {
    const totalOpportunities = existingEnterprise.agencies.reduce(
      (sum, agency) => sum + agency.opportunities.length,
      0
    );

    if (totalOpportunities > 10) {
      throw new Error(
        `Tenant ${options.tenantId} already has ${totalOpportunities} opportunities. ` +
          'Use --force to override or --skip-opportunities to avoid duplicates.'
      );
    }
  }

  result.actions.push('UAT environment safety validated');
}

/**
 * Create or update enterprise with UAT labeling
 */
async function createOrUpdateEnterprise(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  console.log('🏢 Creating/updating enterprise...');

  const enterpriseName = `[UAT] Acme Corporation`;
  const enterpriseData = {
    tenantId: options.tenantId,
    name: enterpriseName,
    description: `${enterpriseName} - UAT Test Environment`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (options.dryRun) {
    result.actions.push(`WOULD CREATE/UPDATE Enterprise: ${enterpriseName}`);
    result.created.enterprise = { id: 'uat_ent_dry_run', name: enterpriseName };
    return;
  }

  let enterprise = await prisma.enterprise.findFirst({
    where: { tenantId: options.tenantId },
  });

  if (enterprise) {
    enterprise = await prisma.enterprise.update({
      where: { id: enterprise.id },
      data: {
        name: enterpriseName,
        description: enterpriseData.description,
        updatedAt: new Date(),
      },
    });
    result.actions.push(
      `Updated existing Enterprise: ${enterprise.name} (${enterprise.id})`
    );
  } else {
    enterprise = await prisma.enterprise.create({
      data: enterpriseData,
    });
    result.actions.push(
      `Created Enterprise: ${enterprise.name} (${enterprise.id})`
    );
  }

  result.created.enterprise = { id: enterprise.id, name: enterprise.name };
}

/**
 * Create or update agency
 */
async function createOrUpdateAgency(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.enterprise) {
    throw new Error('Enterprise must be created before agency');
  }

  console.log('🏛️ Creating/updating agency...');

  const agencyName = 'Sales Operations';
  const agencyData = {
    tenantId: options.tenantId,
    enterpriseId: result.created.enterprise.id,
    name: agencyName,
    description: `${agencyName} - UAT Test Agency`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (options.dryRun) {
    result.actions.push(`WOULD CREATE/UPDATE Agency: ${agencyName}`);
    result.created.agency = { id: 'uat_agency_dry_run', name: agencyName };
    return;
  }

  let agency = await prisma.agency.findFirst({
    where: {
      tenantId: options.tenantId,
      enterpriseId: result.created.enterprise.id,
    },
  });

  if (agency) {
    agency = await prisma.agency.update({
      where: { id: agency.id },
      data: {
        name: agencyName,
        description: agencyData.description,
        updatedAt: new Date(),
      },
    });
    result.actions.push(
      `Updated existing Agency: ${agency.name} (${agency.id})`
    );
  } else {
    agency = await prisma.agency.create({
      data: agencyData,
    });
    result.actions.push(`Created Agency: ${agency.name} (${agency.id})`);
  }

  result.created.agency = { id: agency.id, name: agency.name };
}

/**
 * Create teams
 */
async function createTeams(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.agency) {
    throw new Error('Agency must be created before teams');
  }

  console.log('👥 Creating teams...');

  const teamDefinitions = [
    { name: 'Enterprise Sales', description: 'Handles large enterprise deals' },
    { name: 'Mid-Market Sales', description: 'Mid-size company opportunities' },
    { name: 'SMB Sales', description: 'Small business sales team' },
    {
      name: 'Channel Partners',
      description: 'Partner and reseller management',
    },
  ];

  const createdTeams: Array<{ id: string; name: string }> = [];

  for (const teamDef of teamDefinitions) {
    const teamData = {
      tenantId: options.tenantId,
      agencyId: result.created.agency.id,
      name: teamDef.name,
      description: teamDef.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.dryRun) {
      result.actions.push(`WOULD CREATE Team: ${teamDef.name}`);
      createdTeams.push({
        id: `uat_team_${teamDef.name.toLowerCase().replace(/\s+/g, '_')}`,
        name: teamDef.name,
      });
      continue;
    }

    let team = await prisma.team.findFirst({
      where: {
        tenantId: options.tenantId,
        agencyId: result.created.agency.id,
        name: teamDef.name,
      },
    });

    if (!team) {
      team = await prisma.team.create({
        data: teamData,
      });
      result.actions.push(`Created Team: ${team.name} (${team.id})`);
    } else {
      result.actions.push(`Using existing Team: ${team.name} (${team.id})`);
    }

    createdTeams.push({ id: team.id, name: team.name });
  }

  result.created.teams = createdTeams;
}

/**
 * Create team members
 */
async function createTeamMembers(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.enterprise) {
    throw new Error('Enterprise must be created before members');
  }

  console.log('👤 Creating team members...');

  const memberDefinitions = [
    {
      email: 'sarah.johnson@acme-uat.com',
      name: 'Sarah Johnson',
      roles: ['ENTERPRISE_ADMIN'],
    },
    {
      email: 'mike.chen@acme-uat.com',
      name: 'Mike Chen',
      roles: ['TEAM_LEAD'],
    },
    {
      email: 'lisa.rodriguez@acme-uat.com',
      name: 'Lisa Rodriguez',
      roles: ['SALES_REP'],
    },
    {
      email: 'david.kim@acme-uat.com',
      name: 'David Kim',
      roles: ['SALES_REP'],
    },
    {
      email: 'anna.patel@acme-uat.com',
      name: 'Anna Patel',
      roles: ['SALES_REP'],
    },
  ];

  const createdMembers: Array<{
    id: string;
    displayName: string;
    roles: string[];
  }> = [];

  for (const memberDef of memberDefinitions) {
    const memberData = {
      tenantId: options.tenantId,
      userId: memberDef.email,
      displayName: memberDef.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE Member: ${memberDef.name} (${memberDef.email})`
      );
      createdMembers.push({
        id: `uat_member_${memberDef.email.split('@')[0]}`,
        displayName: memberDef.name,
        roles: memberDef.roles,
      });
      continue;
    }

    let member = await prisma.orgMember.findFirst({
      where: { tenantId: options.tenantId, userId: memberDef.email },
    });

    if (!member) {
      member = await prisma.orgMember.create({
        data: memberData,
      });
      result.actions.push(
        `Created Member: ${member.displayName} (${member.userId})`
      );
    } else {
      result.actions.push(
        `Using existing Member: ${member.displayName} (${member.userId})`
      );
    }

    // Assign roles
    for (const role of memberDef.roles) {
      const roleAssignmentData = {
        tenantId: options.tenantId,
        memberId: member.id,
        role: role,
        scopeType: 'enterprise' as const,
        scopeId: result.created.enterprise.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingAssignment = await prisma.roleAssignment.findFirst({
        where: {
          tenantId: options.tenantId,
          memberId: member.id,
          role: role,
          scopeType: 'enterprise',
          scopeId: result.created.enterprise.id,
          revokedAt: null,
        },
      });

      if (!existingAssignment) {
        await prisma.roleAssignment.create({
          data: roleAssignmentData,
        });
        result.actions.push(`Assigned Role: ${role} to ${member.displayName}`);
      }
    }

    createdMembers.push({
      id: member.id,
      displayName: member.displayName,
      roles: memberDef.roles,
    });
  }

  result.created.members = createdMembers;
}

/**
 * Create contacts
 */
async function createContacts(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  console.log('📞 Creating contacts...');

  const contactDefinitions = [
    {
      name: 'John Smith',
      company: 'TechCorp Inc',
      email: 'john.smith@techcorp.com',
      phone: '+1555123456',
    },
    {
      name: 'Emily Davis',
      company: 'Global Solutions',
      email: 'emily.davis@globalsolutions.com',
      phone: '+1555123457',
    },
    {
      name: 'Robert Wilson',
      company: 'Innovate Ltd',
      email: 'robert.wilson@innovate.com',
      phone: '+1555123458',
    },
    {
      name: 'Maria Garcia',
      company: 'DataSys Corp',
      email: 'maria.garcia@datasys.com',
      phone: '+1555123459',
    },
    {
      name: 'James Brown',
      company: 'CloudTech',
      email: 'james.brown@cloudtech.com',
      phone: '+1555123460',
    },
    {
      name: 'Jennifer Lee',
      company: 'SmartSoft',
      email: 'jennifer.lee@smartsoft.com',
      phone: '+1555123461',
    },
    {
      name: 'Michael Taylor',
      company: 'NetWorks Inc',
      email: 'michael.taylor@networks.com',
      phone: '+1555123462',
    },
    {
      name: 'Linda Anderson',
      company: 'SecureIT',
      email: 'linda.anderson@secureit.com',
      phone: '+1555123463',
    },
  ];

  const createdContacts: Array<{ id: string; name: string }> = [];

  for (const contactDef of contactDefinitions) {
    const contactData = {
      tenantId: options.tenantId,
      name: contactDef.name,
      company: contactDef.company,
      email: contactDef.email,
      phone: contactDef.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE Contact: ${contactDef.name} (${contactDef.company})`
      );
      createdContacts.push({
        id: `uat_contact_${contactDef.email.split('@')[0]}`,
        name: contactDef.name,
      });
      continue;
    }

    // Use deterministic ID based on email to ensure idempotency
    const contactId = `uat_contact_${contactDef.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    let contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          ...contactData,
          id: contactId,
        },
      });
      result.actions.push(
        `Created Contact: ${contact.name} (${contact.company})`
      );
    } else {
      result.actions.push(
        `Using existing Contact: ${contact.name} (${contact.company})`
      );
    }

    createdContacts.push({ id: contact.id, name: contact.name });
  }

  result.created.contacts = createdContacts;
}

/**
 * Create opportunities with realistic data across different states
 */
async function createOpportunities(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.contacts || !result.created.teams) {
    throw new Error('Contacts and teams must be created before opportunities');
  }

  console.log('🎯 Creating opportunities...');

  const opportunityDefinitions = [
    // NEW state opportunities
    {
      title: 'TechCorp Website Redesign',
      value: 75000,
      contactId: result.created.contacts[0].id,
      teamId: result.created.teams[0].id,
      state: 'NEW',
      priority: 'HIGH',
    },
    {
      title: 'Global Solutions CRM Implementation',
      value: 125000,
      contactId: result.created.contacts[1].id,
      teamId: result.created.teams[1].id,
      state: 'NEW',
      priority: 'HIGH',
    },

    // CONTACT_ATTEMPTING state
    {
      title: 'Innovate Ltd Mobile App Development',
      value: 95000,
      contactId: result.created.contacts[2].id,
      teamId: result.created.teams[2].id,
      state: 'CONTACT_ATTEMPTING',
      priority: 'MEDIUM',
    },

    // QUALIFIED state
    {
      title: 'DataSys Corp Data Analytics Platform',
      value: 180000,
      contactId: result.created.contacts[3].id,
      teamId: result.created.teams[0].id,
      state: 'QUALIFIED',
      priority: 'HIGH',
    },
    {
      title: 'CloudTech Cloud Migration',
      value: 220000,
      contactId: result.created.contacts[4].id,
      teamId: result.created.teams[1].id,
      state: 'QUALIFIED',
      priority: 'CRITICAL',
    },

    // BOOKED state
    {
      title: 'SmartSoft AI Integration',
      value: 135000,
      contactId: result.created.contacts[5].id,
      teamId: result.created.teams[2].id,
      state: 'BOOKED',
      priority: 'HIGH',
    },

    // SLA at-risk examples
    {
      title: 'NetWorks Inc Network Security Upgrade',
      value: 85000,
      contactId: result.created.contacts[6].id,
      teamId: result.created.teams[3].id,
      state: 'CONTACT_ATTEMPTING',
      priority: 'HIGH',
      slaAtRisk: true,
    },
    {
      title: 'SecureIT Compliance Audit',
      value: 65000,
      contactId: result.created.contacts[7].id,
      teamId: result.created.teams[1].id,
      state: 'QUALIFIED',
      priority: 'MEDIUM',
      slaBreached: true,
    },
  ];

  const createdOpportunities: Array<{
    id: string;
    title: string;
    state: string;
  }> = [];

  for (const oppDef of opportunityDefinitions) {
    const opportunityData = {
      tenantId: options.tenantId,
      title: oppDef.title,
      value: oppDef.value,
      contactId: oppDef.contactId,
      teamId: oppDef.teamId,
      state: oppDef.state,
      priority: oppDef.priority,
      slaAtRisk: oppDef.slaAtRisk || false,
      slaBreached: oppDef.slaBreached || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE Opportunity: ${oppDef.title} (${oppDef.state}) - $${oppDef.value}`
      );
      createdOpportunities.push({
        id: `uat_opp_${oppDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: oppDef.title,
        state: oppDef.state,
      });
      continue;
    }

    // Use deterministic ID
    const opportunityId = `uat_opp_${oppDef.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;

    let opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      opportunity = await prisma.opportunity.create({
        data: {
          ...opportunityData,
          id: opportunityId,
        },
      });
      result.actions.push(
        `Created Opportunity: ${opportunity.title} (${opportunity.state}) - $${opportunity.value}`
      );
    } else {
      result.actions.push(
        `Using existing Opportunity: ${opportunity.title} (${opportunity.state})`
      );
    }

    createdOpportunities.push({
      id: opportunity.id,
      title: opportunity.title,
      state: opportunity.state,
    });
  }

  result.created.opportunities = createdOpportunities;
}

/**
 * Create decision explanations for qualified opportunities
 */
async function createDecisionExplanations(context: SeedContext): Promise<void> {
  const { prisma, options, result } = context;

  console.log('🧠 Creating decision explanations...');

  if (!result.created.opportunities) return;

  // Create explanations for qualified and booked opportunities
  const qualifiedOpportunities = result.created.opportunities.filter(
    opp => opp.state === 'QUALIFIED' || opp.state === 'BOOKED'
  );

  for (const opportunity of qualifiedOpportunities) {
    const explanationData = {
      tenantId: options.tenantId,
      opportunityId: opportunity.id,
      decisionType: 'qualification_decision',
      confidence: 0.85,
      reasoning: `Strong fit for ${opportunity.title}. Company shows clear need and budget alignment.`,
      factors: {
        companySize: 'enterprise',
        industry: 'technology',
        budget: 'aligned',
        timeline: 'urgent',
        competition: 'low',
      },
      recommendedActions: [
        'Schedule discovery call',
        'Prepare technical proposal',
        'Identify key stakeholders',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (options.dryRun) {
      result.actions.push(
        `WOULD CREATE Decision Explanation for: ${opportunity.title}`
      );
      continue;
    }

    // Check if explanation already exists
    const existingExplanation = await prisma.decisionExplanation.findFirst({
      where: {
        tenantId: options.tenantId,
        opportunityId: opportunity.id,
        decisionType: 'qualification_decision',
      },
    });

    if (!existingExplanation) {
      await prisma.decisionExplanation.create({
        data: explanationData,
      });
      result.actions.push(
        `Created Decision Explanation for: ${opportunity.title}`
      );
    } else {
      result.actions.push(
        `Using existing Decision Explanation for: ${opportunity.title}`
      );
    }
  }
}

/**
 * Print results in human-readable format
 */
function printResults(result: SeedResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`NEURONX UAT SEEDING RESULTS - ${result.tenantId.toUpperCase()}`);
  console.log('='.repeat(60));

  if (result.success) {
    console.log('✅ STATUS: SUCCESS');
  } else {
    console.log('❌ STATUS: FAILED');
  }

  if (result.created.enterprise) {
    console.log(`🏢 Enterprise: ${result.created.enterprise.name}`);
  }

  if (result.created.agency) {
    console.log(`🏛️ Agency: ${result.created.agency.name}`);
  }

  if (result.created.teams && result.created.teams.length > 0) {
    console.log('👥 Teams:');
    result.created.teams.forEach(team => {
      console.log(`   - ${team.name}`);
    });
  }

  if (result.created.members && result.created.members.length > 0) {
    console.log('👤 Members:');
    result.created.members.forEach(member => {
      console.log(`   - ${member.displayName} (${member.roles.join(', ')})`);
    });
  }

  if (result.created.contacts && result.created.contacts.length > 0) {
    console.log(`📞 Contacts: ${result.created.contacts.length} created`);
  }

  if (result.created.opportunities && result.created.opportunities.length > 0) {
    console.log('🎯 Opportunities:');
    const stateCounts = result.created.opportunities.reduce(
      (acc, opp) => {
        acc[opp.state] = (acc[opp.state] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(stateCounts).forEach(([state, count]) => {
      console.log(`   - ${state}: ${count} opportunities`);
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
    console.log('1. Run golden-run script to test end-to-end flows');
    console.log('2. Open Operator Console to see seeded data');
    console.log('3. Execute test scenarios with DRY_RUN mode');
  }
}

/**
 * Main CLI execution
 */
async function main() {
  const program = new Command();

  program
    .name('seed-neuronx')
    .description('Seed NeuronX with production-like UAT test data')
    .version('1.0.0')
    .requiredOption('-t, --tenant-id <id>', 'UAT tenant ID to seed')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--force', 'Override existing data')
    .option('--skip-opportunities', 'Skip creating opportunities and contacts')
    .option(
      '--json',
      'Output results as JSON instead of human-readable format'
    );

  program.parse();

  const options = program.opts();
  options.dryRun = options.dryRun || false;
  options.force = options.force || false;
  options.skipOpportunities = options.skipOpportunities || false;

  try {
    // Validate options
    const validatedOptions = SeedOptionsSchema.parse(options);

    // Run seeding
    const result = await seedNeuronx(validatedOptions);

    // Output results
    if (program.opts().json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResults(result);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
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

export { seedNeuronx, SeedOptions };
