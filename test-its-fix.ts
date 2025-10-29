/**
 * Test script to verify ITS filtering fix
 */
import { clearConfigCache } from './features/payroll-config';
import { loadCountryConfig } from './features/payroll-config/repositories/payroll-config-repository';

async function testITSFix() {
  console.log('🧹 Clearing config cache...\n');
  clearConfigCache();

  console.log('📊 Loading country config for CI...\n');
  const config = await loadCountryConfig('CI', new Date());

  if (!config) {
    console.error('❌ No config found!');
    process.exit(1);
  }

  console.log(`✅ Loaded ${config.otherTaxes.length} other taxes\n`);

  // Filter ITS employer taxes
  const itsTaxes = config.otherTaxes.filter(t => t.code?.includes('its_employer'));

  console.log('🎯 ITS Employer Taxes:');
  itsTaxes.forEach(tax => {
    console.log(`\n  ${tax.code}:`);
    console.log(`    appliesToEmployeeType: "${tax.appliesToEmployeeType}"`);
    console.log(`    rate: ${(tax.taxRate * 100).toFixed(1)}%`);
    console.log(`    paidBy: ${tax.paidBy}`);
  });

  // Test filtering logic for expatriate
  console.log('\n\n🧪 Testing filter logic for EXPATRIATE employee:');
  const isExpat = true;
  const employeeType = isExpat ? 'expat' : 'local';
  console.log(`  Employee type: "${employeeType}"\n`);

  const filteredForExpat = itsTaxes.filter(tax => {
    if (tax.appliesToEmployeeType) {
      const matches = tax.appliesToEmployeeType === employeeType;
      console.log(`  ${tax.code}: appliesToEmployeeType="${tax.appliesToEmployeeType}" === "${employeeType}" ? ${matches ? '✅ INCLUDED' : '❌ SKIPPED'}`);
      return matches;
    } else {
      console.log(`  ${tax.code}: No filter (undefined/null) - ✅ INCLUDED by default`);
      return true;
    }
  });

  console.log(`\n  Result: ${filteredForExpat.length} tax(es) will be applied`);
  if (filteredForExpat.length === 1 && filteredForExpat[0].code === 'its_employer_expat') {
    console.log('  ✅ CORRECT: Only expatriate ITS tax included!');
  } else {
    console.log('  ❌ ERROR: Wrong taxes included!');
  }

  // Test filtering logic for local
  console.log('\n\n🧪 Testing filter logic for LOCAL employee:');
  const isLocal = false;
  const localEmployeeType = isLocal ? 'expat' : 'local';
  console.log(`  Employee type: "${localEmployeeType}"\n`);

  const filteredForLocal = itsTaxes.filter(tax => {
    if (tax.appliesToEmployeeType) {
      const matches = tax.appliesToEmployeeType === localEmployeeType;
      console.log(`  ${tax.code}: appliesToEmployeeType="${tax.appliesToEmployeeType}" === "${localEmployeeType}" ? ${matches ? '✅ INCLUDED' : '❌ SKIPPED'}`);
      return matches;
    } else {
      console.log(`  ${tax.code}: No filter (undefined/null) - ✅ INCLUDED by default`);
      return true;
    }
  });

  console.log(`\n  Result: ${filteredForLocal.length} tax(es) will be applied`);
  if (filteredForLocal.length === 1 && filteredForLocal[0].code === 'its_employer_local') {
    console.log('  ✅ CORRECT: Only local ITS tax included!');
  } else {
    console.log('  ❌ ERROR: Wrong taxes included!');
  }

  console.log('\n✅ Test complete!\n');
  process.exit(0);
}

testITSFix().catch(console.error);
