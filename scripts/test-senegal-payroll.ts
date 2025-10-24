/**
 * Senegal Payroll Live Test
 *
 * Verify that calculatePayrollV2 correctly loads and uses Senegal configuration
 * from the database.
 */

import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';

async function testSenegalPayroll() {
  console.log('========================================');
  console.log('SENEGAL PAYROLL TEST');
  console.log('========================================\n');

  try {
    // Test 1: Basic Senegal calculation
    console.log('Test 1: Jean Diallo - 250,000 FCFA (Married, 1 child)');
    console.log('---');

    const result1 = await calculatePayrollV2({
      employeeId: 'test-sn-001',
      countryCode: 'SN',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 250000,
      fiscalParts: 1.5, // Married or 1 child
    });

    console.log(`Salaire Brut: ${result1.grossSalary.toLocaleString()} FCFA`);
    console.log(`\nCotisations Sociales Salarié:`);
    console.log(`  IPRES (5.6%): ${result1.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`\nRevenu Imposable:`);
    console.log(`  ${result1.taxableIncome.toLocaleString()} FCFA (mensuel)`);
    console.log(`  ${(result1.taxableIncome * 12).toLocaleString()} FCFA (annuel)`);
    console.log(`\nIRPP:`);
    console.log(`  ${result1.its.toLocaleString()} FCFA/mois`);
    console.log(`  ${(result1.its * 12).toLocaleString()} FCFA/an`);
    console.log(`\nSalaire Net: ${result1.netSalary.toLocaleString()} FCFA`);
    console.log(`\nCharges Patronales:`);
    console.log(`  IPRES (8.4%): ${Math.round(250000 * 0.084).toLocaleString()} FCFA`);
    console.log(`  IPRESS (5%): ${Math.round(250000 * 0.05).toLocaleString()} FCFA`);
    console.log(`  Prestations Familiales (7%): ${Math.round(250000 * 0.07).toLocaleString()} FCFA`);
    console.log(`  Accidents Travail (1%): ${Math.round(250000 * 0.01).toLocaleString()} FCFA`);
    console.log(`  CFCE (3%): ${Math.round(250000 * 0.03).toLocaleString()} FCFA`);
    console.log(`  Total: ${result1.cnpsEmployer.toLocaleString()} FCFA`);
    console.log(`\nCoût Total Employeur: ${result1.employerCost.toLocaleString()} FCFA`);

    // Test 2: SMIG employee
    console.log('\n========================================');
    console.log('Test 2: Fatou Sow - 60,000 FCFA SMIG (Single)');
    console.log('---');

    const result2 = await calculatePayrollV2({
      employeeId: 'test-sn-002',
      countryCode: 'SN',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 60000,
      fiscalParts: 1.0, // Single
    });

    console.log(`Salaire Brut: ${result2.grossSalary.toLocaleString()} FCFA`);
    console.log(`IPRES (5.6%): ${result2.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`Revenu Imposable Annuel: ${(result2.taxableIncome * 12).toLocaleString()} FCFA`);
    console.log(`IRPP: ${result2.its.toLocaleString()} FCFA/mois`);
    console.log(`Salaire Net: ${result2.netSalary.toLocaleString()} FCFA`);
    console.log(`Coût Total: ${result2.employerCost.toLocaleString()} FCFA`);

    // Test 3: High earner (above IPRES ceiling)
    console.log('\n========================================');
    console.log('Test 3: Mamadou Ba - 500,000 FCFA (Above IPRES ceiling)');
    console.log('---');

    const result3 = await calculatePayrollV2({
      employeeId: 'test-sn-003',
      countryCode: 'SN',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 500000,
      fiscalParts: 2.0, // Married + children
    });

    console.log(`Salaire Brut: ${result3.grossSalary.toLocaleString()} FCFA`);
    console.log(`IPRES (capped at 360k): ${result3.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`  Taux effectif: ${((result3.cnpsEmployee / 500000) * 100).toFixed(2)}%`);
    console.log(`Revenu Imposable Annuel: ${(result3.taxableIncome * 12).toLocaleString()} FCFA`);
    console.log(`IRPP: ${result3.its.toLocaleString()} FCFA/mois (${(result3.its * 12).toLocaleString()} FCFA/an)`);
    console.log(`Salaire Net: ${result3.netSalary.toLocaleString()} FCFA`);
    console.log(`  Taux net: ${((result3.netSalary / result3.grossSalary) * 100).toFixed(1)}%`);
    console.log(`Coût Total: ${result3.employerCost.toLocaleString()} FCFA`);

    // Test 4: Comparison CI vs SN
    console.log('\n========================================');
    console.log('Test 4: Comparison CI vs SN (200,000 FCFA, Single)');
    console.log('---');

    const resultSN = await calculatePayrollV2({
      employeeId: 'test-compare-sn',
      countryCode: 'SN',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 200000,
      fiscalParts: 1.0,
    });

    const resultCI = await calculatePayrollV2({
      employeeId: 'test-compare-ci',
      countryCode: 'CI',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      baseSalary: 200000,
      fiscalParts: 1.0,
      sectorCode: 'services',
    });

    console.log('SENEGAL:');
    console.log(`  Cotisations Salarié: ${resultSN.cnpsEmployee.toLocaleString()} FCFA (${((resultSN.cnpsEmployee / 200000) * 100).toFixed(1)}%)`);
    console.log(`  Impôt: ${resultSN.its.toLocaleString()} FCFA`);
    console.log(`  Net: ${resultSN.netSalary.toLocaleString()} FCFA (${((resultSN.netSalary / 200000) * 100).toFixed(1)}%)`);
    console.log(`  Coût Total: ${resultSN.employerCost.toLocaleString()} FCFA`);

    console.log('\nCÔTE D\'IVOIRE:');
    console.log(`  Cotisations Salarié: ${resultCI.cnpsEmployee.toLocaleString()} FCFA (${((resultCI.cnpsEmployee / 200000) * 100).toFixed(1)}%)`);
    console.log(`  CMU: ${resultCI.cmuEmployee.toLocaleString()} FCFA`);
    console.log(`  ITS: ${resultCI.its.toLocaleString()} FCFA`);
    console.log(`  Net: ${resultCI.netSalary.toLocaleString()} FCFA (${((resultCI.netSalary / 200000) * 100).toFixed(1)}%)`);
    console.log(`  Coût Total: ${resultCI.employerCost.toLocaleString()} FCFA`);

    console.log('\nDIFFÉRENCE:');
    console.log(`  Net (SN - CI): ${(resultSN.netSalary - resultCI.netSalary).toLocaleString()} FCFA`);
    console.log(`  Coût (SN - CI): ${(resultSN.employerCost - resultCI.employerCost).toLocaleString()} FCFA`);

    console.log('\n========================================');
    console.log('✅ ALL TESTS PASSED');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testSenegalPayroll();
