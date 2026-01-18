#!/usr/bin/env tsx

/**
 * Tenant Bootstrap Script - WI-039: Customer Onboarding Golden Path
 *
 * Idempotent script to bootstrap a new enterprise tenant with complete org structure.
 * Safe to re-run, provides dry-run mode, comprehensive validation.
 */

import { PrismaClient } from '@prisma/client';
import { Command } from 'commander';
import { z } from 'zod';

// Validation schemas
const BootstrapOptionsSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  orgName: z.string().min(1, 'Organization name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminName: z.string().optional(),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
});

type BootstrapOptions = z.infer<typeof BootstrapOptionsSchema>;

// Bootstrap result types
interface BootstrapResult {
  success: boolean;
  tenantId: string;
  created: {
    enterprise?: { id: string; name: string };
    agency?: { id: string; name: string };
    teams?: Array<{ id: string; name: string }>;
    member?: { id: string; userId: string; roles: string[] };
  };
  errors: string[];
  warnings: string[];
  actions: string[];
}

interface BootstrapContext {
  prisma: PrismaClient;
  options: BootstrapOptions;
  result: BootstrapResult;
}

/**
 * Main bootstrap function
 */
async function bootstrapTenant(
  options: BootstrapOptions
): Promise<BootstrapResult> {
  const prisma = new PrismaClient();
  const result: BootstrapResult = {
    success: false,
    tenantId: options.tenantId,
    created: {},
    errors: [],
    warnings: [],
    actions: [],
  };

  const context: BootstrapContext = { prisma, options, result };

  try {
    console.log(`🚀 Starting tenant bootstrap for: ${options.tenantId}`);
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Step 1: Validate tenant exists and is empty
    await validateTenantPrerequisites(context);

    // Step 2: Create enterprise
    await createEnterprise(context);

    // Step 3: Create agency
    await createAgency(context);

    // Step 4: Create teams
    await createTeams(context);

    // Step 5: Create admin member and assign roles
    await createAdminMember(context);

    // Step 6: Validate org structure
    await validateOrgStructure(context);

    // Step 7: Create default playbook bindings
    await createDefaultPlaybookBindings(context);

    result.success = true;
    console.log('✅ Tenant bootstrap completed successfully');
  } catch (error) {
    result.errors.push(`Bootstrap failed: ${error.message}`);
    console.error('❌ Bootstrap failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

/**
 * Validate tenant prerequisites
 */
async function validateTenantPrerequisites(
  context: BootstrapContext
): Promise<void> {
  const { prisma, options, result } = context;

  console.log('🔍 Validating tenant prerequisites...');

  // Check if tenant already has org structure
  const existingEnterprise = await prisma.enterprise.findFirst({
    where: { tenantId: options.tenantId },
  });

  if (existingEnterprise) {
    if (options.force) {
      result.warnings.push(
        'Tenant already has enterprise - proceeding with --force flag'
      );
      result.actions.push(
        `Found existing enterprise: ${existingEnterprise.name}`
      );
    } else {
      throw new Error(
        `Tenant ${options.tenantId} already has org structure. Use --force to override.`
      );
    }
  }

  // Check for existing members
  const existingMembers = await prisma.orgMember.findMany({
    where: { tenantId: options.tenantId },
  });

  if (existingMembers.length > 0) {
    result.warnings.push(`Found ${existingMembers.length} existing members`);
    result.actions.push(
      `Existing members: ${existingMembers.map(m => m.userId).join(', ')}`
    );
  }

  result.actions.push('Tenant prerequisites validated');
}

/**
 * Create enterprise
 */
async function createEnterprise(context: BootstrapContext): Promise<void> {
  const { prisma, options, result } = context;

  console.log('🏢 Creating enterprise...');

  const enterpriseName = options.orgName;
  const enterpriseData = {
    tenantId: options.tenantId,
    name: enterpriseName,
    description: `${enterpriseName} Enterprise Organization`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (options.dryRun) {
    result.actions.push(`WOULD CREATE Enterprise: ${enterpriseName}`);
    result.created.enterprise = { id: 'ent_dry_run', name: enterpriseName };
    return;
  }

  // Check if enterprise already exists
  let enterprise = await prisma.enterprise.findFirst({
    where: { tenantId: options.tenantId },
  });

  if (!enterprise) {
    enterprise = await prisma.enterprise.create({
      data: enterpriseData,
    });
    result.actions.push(
      `Created Enterprise: ${enterprise.name} (${enterprise.id})`
    );
  } else {
    result.actions.push(
      `Using existing Enterprise: ${enterprise.name} (${enterprise.id})`
    );
  }

  result.created.enterprise = { id: enterprise.id, name: enterprise.name };
}

/**
 * Create agency
 */
async function createAgency(context: BootstrapContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.enterprise) {
    throw new Error('Enterprise must be created before agency');
  }

  console.log('🏛️ Creating agency...');

  const agencyName = 'Sales Agency';
  const agencyData = {
    tenantId: options.tenantId,
    enterpriseId: result.created.enterprise.id,
    name: agencyName,
    description: `${options.orgName} primary sales agency`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (options.dryRun) {
    result.actions.push(`WOULD CREATE Agency: ${agencyName}`);
    result.created.agency = { id: 'agency_dry_run', name: agencyName };
    return;
  }

  // Check if agency already exists
  let agency = await prisma.agency.findFirst({
    where: {
      tenantId: options.tenantId,
      enterpriseId: result.created.enterprise.id,
    },
  });

  if (!agency) {
    agency = await prisma.agency.create({
      data: agencyData,
    });
    result.actions.push(`Created Agency: ${agency.name} (${agency.id})`);
  } else {
    result.actions.push(`Using existing Agency: ${agency.name} (${agency.id})`);
  }

  result.created.agency = { id: agency.id, name: agency.name };
}

/**
 * Create teams
 */
async function createTeams(context: BootstrapContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.agency) {
    throw new Error('Agency must be created before teams');
  }

  console.log('👥 Creating teams...');

  const teamDefinitions = [
    {
      name: 'Inbound Sales',
      description: 'Handles inbound leads and inquiries',
    },
    {
      name: 'Outbound Sales',
      description: 'Proactive outreach and prospecting',
    },
    {
      name: 'Enterprise Sales',
      description: 'Large deal and account management',
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
        id: `team_dry_run_${teamDef.name}`,
        name: teamDef.name,
      });
      continue;
    }

    // Check if team already exists
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
 * Create admin member and assign roles
 */
async function createAdminMember(context: BootstrapContext): Promise<void> {
  const { prisma, options, result } = context;

  if (!result.created.enterprise) {
    throw new Error('Enterprise must be created before member');
  }

  console.log('👤 Creating admin member...');

  const memberData = {
    tenantId: options.tenantId,
    userId: options.adminEmail,
    displayName: options.adminName || options.adminEmail.split('@')[0],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (options.dryRun) {
    result.actions.push(
      `WOULD CREATE Member: ${options.adminEmail} as ENTERPRISE_ADMIN`
    );
    result.created.member = {
      id: 'member_dry_run',
      userId: options.adminEmail,
      roles: ['ENTERPRISE_ADMIN'],
    };
    return;
  }

  // Check if member already exists
  let member = await prisma.orgMember.findFirst({
    where: { tenantId: options.tenantId, userId: options.adminEmail },
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

  // Assign enterprise admin role
  const roleAssignmentData = {
    tenantId: options.tenantId,
    memberId: member.id,
    role: 'ENTERPRISE_ADMIN',
    scopeType: 'enterprise' as const,
    scopeId: result.created.enterprise.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Check if role assignment already exists
  const existingAssignment = await prisma.roleAssignment.findFirst({
    where: {
      tenantId: options.tenantId,
      memberId: member.id,
      role: 'ENTERPRISE_ADMIN',
      scopeType: 'enterprise',
      scopeId: result.created.enterprise.id,
      revokedAt: null,
    },
  });

  if (!existingAssignment) {
    await prisma.roleAssignment.create({
      data: roleAssignmentData,
    });
    result.actions.push(
      `Assigned Role: ENTERPRISE_ADMIN to ${member.displayName}`
    );
  } else {
    result.actions.push(
      `Using existing Role: ENTERPRISE_ADMIN for ${member.displayName}`
    );
  }

  result.created.member = {
    id: member.id,
    userId: member.userId,
    roles: ['ENTERPRISE_ADMIN'],
  };
}

/**
 * Validate org structure invariants
 */
async function validateOrgStructure(context: BootstrapContext): Promise<void> {
  const { prisma, options, result } = context;

  console.log('🔍 Validating org structure...');

  if (options.dryRun) {
    result.actions.push('WOULD VALIDATE Org structure invariants');
    return;
  }

  const errors: string[] = [];

  // Check enterprise exists
  const enterprise = await prisma.enterprise.findFirst({
    where: { tenantId: options.tenantId },
  });
  if (!enterprise) {
    errors.push('Enterprise not found');
  }

  // Check agency exists
  const agency = await prisma.agency.findFirst({
    where: { tenantId: options.tenantId },
  });
  if (!agency) {
    errors.push('Agency not found');
  }

  // Check teams exist
  const teams = await prisma.team.findMany({
    where: { tenantId: options.tenantId },
  });
  if (teams.length < 3) {
    errors.push(`Expected 3 teams, found ${teams.length}`);
  }

  // Check admin member exists
  const adminMember = await prisma.orgMember.findFirst({
    where: { tenantId: options.tenantId, userId: options.adminEmail },
  });
  if (!adminMember) {
    errors.push('Admin member not found');
  }

  // Check admin role assignment
  const adminRole = await prisma.roleAssignment.findFirst({
    where: {
      tenantId: options.tenantId,
      memberId: adminMember?.id,
      role: 'ENTERPRISE_ADMIN',
      revokedAt: null,
    },
  });
  if (!adminRole) {
    errors.push('Admin role assignment not found');
  }

  if (errors.length > 0) {
    throw new Error(`Org structure validation failed: ${errors.join(', ')}`);
  }

  result.actions.push('Org structure validation passed');
}

/**
 * Create default playbook bindings
 */
async function createDefaultPlaybookBindings(
  context: BootstrapContext
): Promise<void> {
  const { options, result } = context;

  console.log('📋 Setting up default playbook bindings...');

  // This is a placeholder for playbook binding setup
  // In a real implementation, this would create default playbook versions
  // and bind them to the created teams

  if (options.dryRun) {
    result.actions.push('WOULD CREATE Default playbook bindings for teams');
    return;
  }

  // TODO: Implement actual playbook binding logic
  result.warnings.push(
    'Default playbook bindings not yet implemented - manual setup required'
  );
  result.actions.push('Default playbook bindings setup (placeholder)');
}

/**
 * Print results in human-readable format
 */
function printResults(result: BootstrapResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`TENANT BOOTSTRAP RESULTS - ${result.tenantId.toUpperCase()}`);
  console.log('='.repeat(60));

  if (result.success) {
    console.log('✅ STATUS: SUCCESS');
  } else {
    console.log('❌ STATUS: FAILED');
  }

  if (result.created.enterprise) {
    console.log(
      `🏢 Enterprise: ${result.created.enterprise.name} (${result.created.enterprise.id})`
    );
  }

  if (result.created.agency) {
    console.log(
      `🏛️ Agency: ${result.created.agency.name} (${result.created.agency.id})`
    );
  }

  if (result.created.teams && result.created.teams.length > 0) {
    console.log('👥 Teams:');
    result.created.teams.forEach(team => {
      console.log(`   - ${team.name} (${team.id})`);
    });
  }

  if (result.created.member) {
    console.log(`👤 Admin Member: ${result.created.member.userId}`);
    console.log(`   Roles: ${result.created.member.roles.join(', ')}`);
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
    console.log('1. Configure GHL integration mappings');
    console.log('2. Run opportunity backfill');
    console.log('3. Execute readiness check');
    console.log('4. Perform first execution test');
    console.log('5. Enable production operations');
  }
}

/**
 * Main CLI execution
 */
async function main() {
  const program = new Command();

  program
    .name('bootstrap-tenant')
    .description(
      'Bootstrap a new enterprise tenant with complete org structure'
    )
    .version('1.0.0')
    .requiredOption('-t, --tenant-id <id>', 'Tenant ID to bootstrap')
    .requiredOption('-o, --org-name <name>', 'Organization name')
    .requiredOption('-e, --admin-email <email>', 'Admin user email')
    .option('-n, --admin-name <name>', 'Admin display name (optional)')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--force', 'Override existing org structure')
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
    const validatedOptions = BootstrapOptionsSchema.parse(options);

    // Run bootstrap
    const result = await bootstrapTenant(validatedOptions);

    // Output results
    if (program.opts().json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResults(result);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Bootstrap failed:', error.message);
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

export { bootstrapTenant, BootstrapOptions };
