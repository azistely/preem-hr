/**
 * Check if family status migration is needed and apply if necessary
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkAndMigrate() {
  try {
    console.log('Checking if family status columns exist...');

    // Check if columns exist
    const result: any = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employees'
      AND column_name IN ('marital_status', 'dependent_children', 'fiscal_parts', 'has_family')
      ORDER BY column_name;
    `);

    const rows = Array.isArray(result) ? result : (result.rows || []);
    const existingColumns = rows.map((r: any) => r.column_name);
    console.log('Existing family status columns:', existingColumns);

    if (existingColumns.length === 4) {
      console.log('✅ All family status columns already exist!');
      process.exit(0);
    }

    console.log(`⚠️  Missing ${4 - existingColumns.length} columns. Running migration...`);

    // Add columns one by one
    if (!existingColumns.includes('marital_status')) {
      await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)`);
      console.log('✓ Added marital_status column');
    }

    if (!existingColumns.includes('dependent_children')) {
      await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS dependent_children INTEGER DEFAULT 0`);
      console.log('✓ Added dependent_children column');
    }

    if (!existingColumns.includes('fiscal_parts')) {
      await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS fiscal_parts NUMERIC(3,1) DEFAULT 1.0`);
      console.log('✓ Added fiscal_parts column');
    }

    if (!existingColumns.includes('has_family')) {
      await db.execute(sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_family BOOLEAN DEFAULT false`);
      console.log('✓ Added has_family column');
    }

    // Add constraint
    try {
      await db.execute(sql`
        ALTER TABLE employees
        ADD CONSTRAINT valid_marital_status
        CHECK (
          (marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text]))
          OR (marital_status IS NULL)
        )
      `);
      console.log('✓ Added marital_status constraint');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('⚠️  Constraint already exists');
      } else {
        throw e;
      }
    }

    // Set defaults for existing employees
    await db.execute(sql`
      UPDATE employees
      SET
        marital_status = 'single',
        dependent_children = 0,
        fiscal_parts = 1.0,
        has_family = false
      WHERE marital_status IS NULL
    `);
    console.log('✓ Set default values for existing employees');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message || error);
    process.exit(1);
  }
}

checkAndMigrate();
