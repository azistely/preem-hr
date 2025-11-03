/**
 * Diagnostic Script: Check Payroll Review Feature Status
 *
 * Run with: npx tsx check-payroll-review-status.ts
 *
 * This script checks:
 * 1. Database tables exist
 * 2. Sample payroll run status
 * 3. Verification data
 * 4. Validation issues
 */

import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function checkPayrollReviewStatus() {
  console.log('🔍 Checking Payroll Review Feature Status...\n');

  try {
    // 1. Check if verification tables exist
    console.log('1️⃣ Checking database tables...');
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('payroll_verification_status', 'payroll_validation_issues')
      ORDER BY table_name;
    `);

    if (tables.rows.length === 2) {
      console.log('   ✅ Both tables exist:');
      tables.rows.forEach((row: any) => {
        console.log(`      - ${row.table_name}`);
      });
    } else {
      console.log('   ❌ Missing tables!');
      console.log('   Run migration: supabase/migrations/20251102_add_payroll_verification_tables.sql');
      return;
    }

    // 2. Find a calculated payroll run
    console.log('\n2️⃣ Looking for calculated payroll runs...');
    const runs = await db.execute(sql`
      SELECT
        id,
        name,
        status,
        period_start,
        period_end,
        total_net,
        employee_count,
        created_at
      FROM payroll_runs
      WHERE status IN ('calculated', 'processing')
      ORDER BY created_at DESC
      LIMIT 5;
    `);

    if (runs.rows.length === 0) {
      console.log('   ⚠️  No calculated payroll runs found');
      console.log('   Create a payroll run and calculate it first');
      return;
    }

    console.log(`   ✅ Found ${runs.rows.length} calculated run(s):`);
    runs.rows.forEach((run: any, idx: number) => {
      console.log(`   ${idx + 1}. ${run.name || 'Unnamed'} (${run.status})`);
      console.log(`      ID: ${run.id}`);
      console.log(`      Period: ${run.period_start} → ${run.period_end}`);
      console.log(`      Employees: ${run.employee_count || 0}`);
      console.log(`      Total Net: ${run.total_net ? Number(run.total_net).toLocaleString('fr-FR') + ' FCFA' : 'N/A'}`);
    });

    const sampleRun = runs.rows[0] as any;
    const runId = sampleRun.id;

    // 3. Check verification status for sample run
    console.log(`\n3️⃣ Checking verification status for: ${sampleRun.name || sampleRun.id}`);
    const verificationData = await db.execute(sql`
      SELECT
        status,
        COUNT(*) as count
      FROM payroll_verification_status
      WHERE payroll_run_id = ${runId}
      GROUP BY status
      ORDER BY status;
    `);

    if (verificationData.rows.length === 0) {
      console.log('   ⚠️  No verification data yet');
      console.log('   This is normal - data is created when HR manager reviews');
    } else {
      console.log('   ✅ Verification breakdown:');
      verificationData.rows.forEach((row: any) => {
        const icon = {
          verified: '✅',
          flagged: '⚠️',
          unverified: '❌',
          auto_ok: '🤖'
        }[row.status] || '❓';
        console.log(`      ${icon} ${row.status}: ${row.count} employee(s)`);
      });
    }

    // 4. Check validation issues
    console.log(`\n4️⃣ Checking validation issues...`);
    const issues = await db.execute(sql`
      SELECT
        issue_type,
        category,
        COUNT(*) as count
      FROM payroll_validation_issues
      WHERE payroll_run_id = ${runId}
        AND resolved = false
      GROUP BY issue_type, category
      ORDER BY issue_type, category;
    `);

    if (issues.rows.length === 0) {
      console.log('   ✅ No validation issues detected (or validation not run yet)');
    } else {
      console.log('   ⚠️  Issues detected:');
      issues.rows.forEach((row: any) => {
        const icon = {
          error: '🔴',
          warning: '⚠️',
          info: 'ℹ️'
        }[row.issue_type] || '❓';
        console.log(`      ${icon} ${row.issue_type} / ${row.category}: ${row.count}`);
      });
    }

    // 5. Check line items count
    console.log(`\n5️⃣ Checking line items...`);
    const lineItems = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM payroll_line_items
      WHERE payroll_run_id = ${runId};
    `);

    const lineItemCount = (lineItems.rows[0] as any).count;
    console.log(`   ✅ ${lineItemCount} employee(s) in this payroll run`);

    // 6. Check time entries (for overtime breakdown)
    console.log(`\n6️⃣ Checking time entries availability...`);
    const timeEntries = await db.execute(sql`
      SELECT
        COUNT(DISTINCT te.employee_id) as employees_with_time_entries,
        COUNT(*) as total_entries
      FROM time_entries te
      JOIN payroll_line_items pli ON pli.employee_id = te.employee_id
      WHERE pli.payroll_run_id = ${runId}
        AND te.clock_in >= ${sampleRun.period_start}
        AND te.clock_in <= ${sampleRun.period_end};
    `);

    const timeData = timeEntries.rows[0] as any;
    if (timeData.employees_with_time_entries > 0) {
      console.log(`   ✅ ${timeData.employees_with_time_entries} employee(s) have time entries`);
      console.log(`      Total entries: ${timeData.total_entries}`);
    } else {
      console.log('   ⚠️  No time entries found for this period');
      console.log('   Overtime breakdown will show "Aucune donnée de pointage disponible"');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Database tables: OK`);
    console.log(`✅ Calculated runs found: ${runs.rows.length}`);
    console.log(`📝 Sample run ID: ${runId}`);
    console.log(`👥 Employees in run: ${lineItemCount}`);
    console.log(`⏱️  Time entries: ${timeData.employees_with_time_entries} employees`);
    console.log(`📊 Verification data: ${verificationData.rows.length > 0 ? 'Available' : 'Not yet created'}`);
    console.log(`🚨 Validation issues: ${issues.rows.length > 0 ? 'Detected' : 'None'}`);

    console.log('\n💡 To test the UI, navigate to:');
    console.log(`   http://localhost:3001/payroll/runs/${runId}`);

    console.log('\n📖 For full feature guide, see:');
    console.log('   PAYROLL_REVIEW_UI_GUIDE.md');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the check
checkPayrollReviewStatus()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
