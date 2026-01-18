#!/usr/bin/env tsx

/**
 * Migrations Validation Script - WI-026: Release & Environment Hardening
 *
 * Validates Prisma schema and migrations for deployment safety.
 * Ensures no schema changes without corresponding migrations.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function validateMigrations() {
  console.log('🗃️  Validating Prisma schema and migrations...');

  const prismaDir = path.join(process.cwd(), 'apps/core-api/prisma');
  const schemaPath = path.join(prismaDir, 'schema.prisma');
  const migrationsDir = path.join(prismaDir, 'migrations');

  try {
    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Prisma schema file not found');
    }

    // Check if migrations directory exists (skip in development/demo)
    if (!fs.existsSync(migrationsDir)) {
      console.log(
        '⚠️  Migrations directory not found, skipping migration validation (development/demo setup)'
      );
      console.log('✅ Migrations validation skipped');
      process.exit(0);
    }

    // Validate schema format
    console.log('   Checking schema format...');
    execSync('npx prisma format --schema=' + schemaPath, { stdio: 'pipe' });
    console.log('   ✅ Schema format is valid');

    // Check for uncommitted migrations (drift detection)
    console.log('   Checking for schema drift...');
    const driftOutput = execSync(
      'npx prisma migrate diff --from-migrations ./migrations --to-schema-datamodel ' +
        schemaPath +
        ' --script',
      {
        cwd: prismaDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      }
    );

    if (driftOutput.trim()) {
      console.error(
        '❌ Schema drift detected! Schema has changes not reflected in migrations.'
      );
      console.error('Please run: npx prisma migrate dev');
      console.error('Drift details:', driftOutput);
      process.exit(1);
    }

    console.log('   ✅ No schema drift detected');

    // Generate client to ensure schema is valid
    console.log('   Generating Prisma client...');
    execSync('npx prisma generate --schema=' + schemaPath, { stdio: 'pipe' });
    console.log('   ✅ Prisma client generated successfully');

    console.log('✅ Migrations validation passed');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migrations validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateMigrations();
}
