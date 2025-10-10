// @ts-nocheck
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function checkTimeTables() {
  console.log('Checking time-related tables...\n');

  // Check which tables exist
  const tables = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND (tablename LIKE '%time%' OR tablename LIKE '%overtime%' OR tablename LIKE '%geofence%')
    ORDER BY tablename;
  `);

  console.log('📋 Existing tables:');
  if (tables.rows && tables.rows.length > 0) {
    tables.rows.forEach((row: any) => console.log(`  ✓ ${row.tablename}`));
  } else {
    console.log('  No time-related tables found');
  }

  // Check time_off_policies
  console.log('\n📊 time_off_policies:');
  const policies = await db.execute(sql`SELECT COUNT(*) FROM time_off_policies`);
  console.log(`  Rows: ${policies.rows[0].count}`);

  // Check time_off_balances
  console.log('\n📊 time_off_balances:');
  const balances = await db.execute(sql`SELECT COUNT(*) FROM time_off_balances`);
  console.log(`  Rows: ${balances.rows[0].count}`);

  // Check time_off_requests
  console.log('\n📊 time_off_requests:');
  const requests = await db.execute(sql`SELECT COUNT(*) FROM time_off_requests`);
  console.log(`  Rows: ${requests.rows[0].count}`);

  // Check time_entries
  console.log('\n📊 time_entries:');
  const entries = await db.execute(sql`SELECT COUNT(*) FROM time_entries`);
  console.log(`  Rows: ${entries.rows[0].count}`);

  // Check public_holidays
  console.log('\n📊 public_holidays:');
  const holidays = await db.execute(sql`SELECT COUNT(*) FROM public_holidays`);
  console.log(`  Rows: ${holidays.rows[0].count}`);

  process.exit(0);
}

checkTimeTables().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
