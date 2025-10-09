/**
 * Script to run database migrations
 * Usage: npx tsx scripts/run-migration.ts <migration-file>
 */

import { readFileSync } from 'fs';
import { db } from '../db';
import { sql as drizzleSql } from 'drizzle-orm';

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log(`Running migration: ${migrationFile}`);

    const sqlContent = readFileSync(migrationFile, 'utf-8');

    // Execute the entire SQL file as one statement
    await db.execute(drizzleSql.raw(sqlContent));

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message || error);

    // If columns already exist, that's OK
    if (error.message?.includes('already exists')) {
      console.log('⚠️  Some columns already exist - this might be OK');
      process.exit(0);
    }

    process.exit(1);
  }
}

runMigration();
