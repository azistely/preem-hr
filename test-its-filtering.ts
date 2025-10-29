/**
 * Test script to debug ITS tax filtering
 */

import { db } from './lib/db';
import { otherTaxes } from './drizzle/schema';
import { eq, and, or, lte, gte, isNull } from 'drizzle-orm';

async function testITSFiltering() {
  console.log('🔍 Testing ITS Tax Filtering\n');

  // 1. Load taxes from database
  const dateStr = '2025-10-29';
  const taxes = await db
    .select()
    .from(otherTaxes)
    .where(
      and(
        eq(otherTaxes.countryCode, 'CI'),
        lte(otherTaxes.effectiveFrom, dateStr),
        or(
          isNull(otherTaxes.effectiveTo),
          gte(otherTaxes.effectiveTo, dateStr)
        )
      )
    );

  console.log(`📊 Loaded ${taxes.length} taxes from database\n`);

  // 2. Filter ITS taxes
  const itsTaxes = taxes.filter(t => t.code?.includes('its_employer'));
  console.log(`🎯 ITS Taxes found: ${itsTaxes.length}`);
  itsTaxes.forEach(tax => {
    console.log(`  - ${tax.code}: appliesToEmployeeType = "${tax.appliesToEmployeeType}"`);
  });

  // 3. Simulate filtering for expatriate employee
  console.log('\n🧪 Simulating filtering for EXPATRIATE employee (isExpat = true):\n');
  const isExpat = true;
  const employeeType = isExpat ? 'expat' : 'local';
  console.log(`   Employee type: "${employeeType}"\n`);

  for (const tax of itsTaxes) {
    console.log(`   Checking ${tax.code}:`);
    console.log(`     - appliesToEmployeeType: "${tax.appliesToEmployeeType}"`);
    console.log(`     - employeeType: "${employeeType}"`);
    console.log(`     - Match: ${tax.appliesToEmployeeType === employeeType}`);

    if (tax.appliesToEmployeeType) {
      if (tax.appliesToEmployeeType !== employeeType) {
        console.log(`     - ❌ SKIPPED (does not match employee type)\n`);
      } else {
        console.log(`     - ✅ INCLUDED (matches employee type)\n`);
      }
    } else {
      console.log(`     - ✅ INCLUDED (no employee type filter)\n`);
    }
  }

  // 4. Simulate filtering for local employee
  console.log('\n🧪 Simulating filtering for LOCAL employee (isExpat = false):\n');
  const isLocal = false;
  const localEmployeeType = isLocal ? 'expat' : 'local';
  console.log(`   Employee type: "${localEmployeeType}"\n`);

  for (const tax of itsTaxes) {
    console.log(`   Checking ${tax.code}:`);
    console.log(`     - appliesToEmployeeType: "${tax.appliesToEmployeeType}"`);
    console.log(`     - employeeType: "${localEmployeeType}"`);
    console.log(`     - Match: ${tax.appliesToEmployeeType === localEmployeeType}`);

    if (tax.appliesToEmployeeType) {
      if (tax.appliesToEmployeeType !== localEmployeeType) {
        console.log(`     - ❌ SKIPPED (does not match employee type)\n`);
      } else {
        console.log(`     - ✅ INCLUDED (matches employee type)\n`);
      }
    } else {
      console.log(`     - ✅ INCLUDED (no employee type filter)\n`);
    }
  }

  process.exit(0);
}

testITSFiltering().catch(console.error);
