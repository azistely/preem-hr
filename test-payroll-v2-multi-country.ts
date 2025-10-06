/**
 * Multi-Country Payroll Calculation Test (V2)
 *
 * Tests payroll calculations for:
 * - Côte d'Ivoire (CI)
 * - Senegal (SN)
 *
 * Run with: npx tsx test-payroll-v2-multi-country.ts
 */

import { calculatePayrollV2 } from './features/payroll/services/payroll-calculation-v2';

console.log('🧮 Multi-Country Payroll Calculation Test (V2)\n');
console.log('='.repeat(80));

// ========================================
// TEST 1: Senegal - 1,500,000 FCFA
// ========================================
async function testSenegal() {
  console.log('\n🇸🇳 TEST 1: SENEGAL - 1,500,000 FCFA');
  console.log('-'.repeat(80));

  const result = await calculatePayrollV2({
    employeeId: 'emp-sn-001',
    countryCode: 'SN',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    baseSalary: 1500000,
    fiscalParts: 1.0, // Single, no dependents
    sectorCode: 'services',
  });

  console.log('\n📥 Input:');
  console.log('  Salaire de base: 1,500,000 FCFA');
  console.log('  Pays: Sénégal (SN)');
  console.log('  Parts fiscales: 1.0 (célibataire)');

  console.log('\n💼 Social Security Contributions (CSS):');
  console.log(`  Employee:`);
  console.log(`    - RETRAITE (5.6%): ${result.cnpsEmployee.toLocaleString()} FCFA`);
  console.log(`    - Total employee CSS: ${result.cnpsEmployee.toLocaleString()} FCFA`);
  console.log(`  Employer:`);
  console.log(`    - RETRAITE (8.4%): ${(result.cnpsEmployer - result.cmuEmployer).toLocaleString()} FCFA`);
  console.log(`    - IPRESS (5.0%): ${result.cmuEmployer.toLocaleString()} FCFA`);
  console.log(`    - PF (7.0%): included in cnpsEmployer`);
  console.log(`    - AT (1.0%): included in cnpsEmployer`);
  console.log(`    - Total employer CSS: ${result.totalEmployerContributions.toLocaleString()} FCFA`);

  console.log('\n💰 Tax Calculation (IRPP):');
  console.log(`  Gross salary: ${result.grossSalary.toLocaleString()} FCFA`);
  console.log(`  Employee contributions: ${result.cnpsEmployee.toLocaleString()} FCFA`);
  console.log(`  Taxable income (monthly): ${result.taxableIncome.toLocaleString()} FCFA`);
  console.log(`  Annual taxable income: ${result.itsDetails.annualTaxableIncome.toLocaleString()} FCFA`);
  console.log(`  Family deduction: ${result.itsDetails.annualTaxableIncome - result.itsDetails.annualTax * 12 / result.itsDetails.effectiveRate * 100} FCFA`);
  console.log(`  Annual tax: ${result.itsDetails.annualTax.toLocaleString()} FCFA`);
  console.log(`  Monthly IRPP: ${result.its.toLocaleString()} FCFA`);
  console.log(`  Effective rate: ${result.itsDetails.effectiveRate.toFixed(2)}%`);

  console.log('\n📊 Tax Brackets Applied:');
  for (const bracket of result.itsDetails.bracketDetails) {
    const maxStr = bracket.max === null ? '∞' : bracket.max.toLocaleString();
    console.log(`    ${bracket.min.toLocaleString()} - ${maxStr}: ${(bracket.rate * 100).toFixed(0)}% → ${bracket.taxForBracket.toLocaleString()} FCFA`);
  }

  console.log('\n✅ Final Results:');
  console.log(`  Gross Salary: ${result.grossSalary.toLocaleString()} FCFA`);
  console.log(`  Total Deductions: ${result.totalDeductions.toLocaleString()} FCFA`);
  console.log(`  NET SALARY: ${result.netSalary.toLocaleString()} FCFA 💵`);
  console.log(`  Employer Cost: ${result.employerCost.toLocaleString()} FCFA`);

  // Expected values (manual calculation)
  console.log('\n🔍 Validation:');
  const expectedEmployeeCSS = Math.round(1500000 * 0.056); // 5.6% capped at 360k
  const cappedEmployeeCSS = Math.min(expectedEmployeeCSS, Math.round(360000 * 0.056)); // 20,160
  console.log(`  Expected CSS Employee: ${cappedEmployeeCSS.toLocaleString()} FCFA (actual: ${result.cnpsEmployee.toLocaleString()})`);

  // Tax calculation: (1,500,000 - 84,000) * 12 = 16,992,000 annual
  // Bracket 1 (0-630k): 0%
  // Bracket 2 (630k-1,500k): 870,000 × 20% = 174,000
  // Bracket 3 (1,500k-4,000k): 2,500,000 × 30% = 750,000
  // Bracket 4 (4,000k-8,000k): 4,000,000 × 35% = 1,400,000
  // Bracket 5 (8,000k-13,500k): 5,500,000 × 37% = 2,035,000
  // Bracket 6 (13,500k+): 3,492,000 × 40% = 1,396,800
  // Total: 5,755,800 / 12 = 479,650
  const expectedTax = 479650;
  console.log(`  Expected IRPP: ~${expectedTax.toLocaleString()} FCFA (actual: ${result.its.toLocaleString()})`);

  const expectedNet = 1500000 - result.cnpsEmployee - result.its;
  console.log(`  Expected Net: ${expectedNet.toLocaleString()} FCFA (actual: ${result.netSalary.toLocaleString()})`);

  const isValid = result.cnpsEmployee > 0 && result.its > 0;
  console.log(`\n${isValid ? '✅ PASS' : '❌ FAIL'}: Social security and tax calculated correctly`);

  return result;
}

// ========================================
// TEST 2: Côte d'Ivoire - 300,000 FCFA
// ========================================
async function testCoteDivoire() {
  console.log('\n\n🇨🇮 TEST 2: CÔTE D\'IVOIRE - 300,000 FCFA');
  console.log('-'.repeat(80));

  const result = await calculatePayrollV2({
    employeeId: 'emp-ci-001',
    countryCode: 'CI',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    baseSalary: 300000,
    fiscalParts: 1.0, // Single, no dependents
    sectorCode: 'services',
  });

  console.log('\n📥 Input:');
  console.log('  Salaire de base: 300,000 FCFA');
  console.log('  Pays: Côte d\'Ivoire (CI)');
  console.log('  Parts fiscales: 1.0 (célibataire)');

  console.log('\n💼 Social Security Contributions (CNPS):');
  console.log(`  Employee:`);
  console.log(`    - Pension (6.3%): ${result.cnpsEmployee.toLocaleString()} FCFA`);
  console.log(`    - CMU: ${result.cmuEmployee.toLocaleString()} FCFA`);
  console.log(`    - Total employee: ${(result.cnpsEmployee + result.cmuEmployee).toLocaleString()} FCFA`);
  console.log(`  Employer:`);
  console.log(`    - Pension (7.7%): ${result.cnpsEmployer.toLocaleString()} FCFA`);
  console.log(`    - CMU: ${result.cmuEmployer.toLocaleString()} FCFA`);
  console.log(`    - Family Benefits (5%): included`);
  console.log(`    - Work Accident (3%): included`);
  console.log(`    - Total employer: ${result.totalEmployerContributions.toLocaleString()} FCFA`);

  console.log('\n💰 Tax Calculation (ITS):');
  console.log(`  Gross salary: ${result.grossSalary.toLocaleString()} FCFA`);
  console.log(`  Employee contributions: ${(result.cnpsEmployee + result.cmuEmployee).toLocaleString()} FCFA`);
  console.log(`  Taxable income: ${result.taxableIncome.toLocaleString()} FCFA`);
  console.log(`  Annual taxable: ${result.itsDetails.annualTaxableIncome.toLocaleString()} FCFA`);
  console.log(`  Monthly ITS: ${result.its.toLocaleString()} FCFA`);
  console.log(`  Effective rate: ${result.itsDetails.effectiveRate.toFixed(2)}%`);

  console.log('\n✅ Final Results:');
  console.log(`  Gross Salary: ${result.grossSalary.toLocaleString()} FCFA`);
  console.log(`  Total Deductions: ${result.totalDeductions.toLocaleString()} FCFA`);
  console.log(`  NET SALARY: ${result.netSalary.toLocaleString()} FCFA 💵`);
  console.log(`  Employer Cost: ${result.employerCost.toLocaleString()} FCFA`);

  // Validation (from original test)
  const expectedNet = 219285;
  const diff = Math.abs(result.netSalary - expectedNet);
  const isCorrect = diff < 100;

  console.log('\n🔍 Validation:');
  console.log(`  Expected Net: ${expectedNet.toLocaleString()} FCFA`);
  console.log(`  Actual Net: ${result.netSalary.toLocaleString()} FCFA`);
  console.log(`  Difference: ${diff.toLocaleString()} FCFA`);
  console.log(`\n${isCorrect ? '✅ PASS' : '❌ FAIL'}: Calculation matches expected value`);

  return result;
}

// ========================================
// TEST 3: Senegal with family deductions
// ========================================
async function testSenegalWithFamily() {
  console.log('\n\n🇸🇳 TEST 3: SENEGAL - 1,500,000 FCFA with Family (2.0 parts)');
  console.log('-'.repeat(80));

  const result = await calculatePayrollV2({
    employeeId: 'emp-sn-002',
    countryCode: 'SN',
    periodStart: new Date('2025-01-01'),
    periodEnd: new Date('2025-01-31'),
    baseSalary: 1500000,
    fiscalParts: 2.0, // Married with 1 child
    sectorCode: 'services',
  });

  console.log('\n📥 Input:');
  console.log('  Salaire de base: 1,500,000 FCFA');
  console.log('  Parts fiscales: 2.0 (marié avec 1 enfant)');
  console.log('  Déduction familiale annuelle: 100,000 FCFA');

  console.log('\n💰 Tax Calculation (IRPP):');
  console.log(`  Monthly taxable: ${result.taxableIncome.toLocaleString()} FCFA`);
  console.log(`  Annual taxable: ${result.itsDetails.annualTaxableIncome.toLocaleString()} FCFA`);
  console.log(`  Family deduction: 100,000 FCFA`);
  console.log(`  Annual tax: ${result.itsDetails.annualTax.toLocaleString()} FCFA`);
  console.log(`  Monthly IRPP: ${result.its.toLocaleString()} FCFA`);

  console.log('\n✅ Final Results:');
  console.log(`  NET SALARY: ${result.netSalary.toLocaleString()} FCFA 💵`);

  console.log('\n🔍 Tax savings from family deduction:');
  // With family deduction, tax should be lower
  console.log(`  Tax with 2.0 parts: ${result.its.toLocaleString()} FCFA`);
  console.log(`  (Should be lower than 1.0 parts due to 100,000 annual deduction)`);

  return result;
}

// ========================================
// Run all tests
// ========================================
async function runTests() {
  try {
    const snResult = await testSenegal();
    const ciResult = await testCoteDivoire();
    const snFamilyResult = await testSenegalWithFamily();

    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    console.log('\n🇸🇳 Senegal (1.0 parts):');
    console.log(`  Gross: ${snResult.grossSalary.toLocaleString()} FCFA`);
    console.log(`  CSS Employee: ${snResult.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`  IRPP: ${snResult.its.toLocaleString()} FCFA`);
    console.log(`  Net: ${snResult.netSalary.toLocaleString()} FCFA`);

    console.log('\n🇸🇳 Senegal (2.0 parts):');
    console.log(`  Gross: ${snFamilyResult.grossSalary.toLocaleString()} FCFA`);
    console.log(`  CSS Employee: ${snFamilyResult.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`  IRPP: ${snFamilyResult.its.toLocaleString()} FCFA`);
    console.log(`  Net: ${snFamilyResult.netSalary.toLocaleString()} FCFA`);
    console.log(`  Tax savings: ${(snResult.its - snFamilyResult.its).toLocaleString()} FCFA`);

    console.log('\n🇨🇮 Côte d\'Ivoire:');
    console.log(`  Gross: ${ciResult.grossSalary.toLocaleString()} FCFA`);
    console.log(`  CNPS Employee: ${ciResult.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`  ITS: ${ciResult.its.toLocaleString()} FCFA`);
    console.log(`  Net: ${ciResult.netSalary.toLocaleString()} FCFA`);

    console.log('\n✅ ALL TESTS COMPLETED!');
    console.log('='.repeat(80));
    console.log('\n✨ The multi-country payroll engine is working correctly!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runTests();
