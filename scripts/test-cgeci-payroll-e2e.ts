/**
 * End-to-End Payroll Calculation Test for CGECI Barème
 *
 * Tests the complete payroll calculation flow using database-driven
 * configurations for Côte d'Ivoire with CGECI minimum wages.
 *
 * Test Scenario:
 * - Employee: Category C (coefficient 240), Sector: BTP
 * - Base Salary: 180,000 FCFA (above minimum for category C)
 * - Period: October 2025
 * - Days Worked: 22 days (full month)
 *
 * Expected Calculations:
 * 1. Gross Salary: 180,000 FCFA
 * 2. CNPS Employee (6.3%): 11,340 FCFA
 * 3. CMU Employee: 1,000 FCFA (fixed)
 * 4. Taxable Income: Gross - CNPS - CMU
 * 5. ITS (progressive brackets)
 * 6. Net Salary: Gross - CNPS - CMU - ITS
 * 7. Employer costs: CNPS Employer, CMU Employer, FDFP
 *
 * Date: 2025-10-23
 */

import { db } from '../lib/db';
import { employees, employeeSalaries, payrollRuns, payrollLineItems } from '../lib/db/schema';
import { calculatePayrollV2 } from '../features/payroll/services/payroll-calculation-v2';
import { sql } from 'drizzle-orm';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'; // Assuming first tenant
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

interface TestResults {
  employee: any;
  payrollRun: any;
  calculation: any;
  validations: {
    minimumWageCheck: boolean;
    grossSalaryCorrect: boolean;
    cnpsEmployeeCorrect: boolean;
    cmuEmployeeCorrect: boolean;
    itsCalculationCorrect: boolean;
    netSalaryCorrect: boolean;
    employerCostsCorrect: boolean;
  };
  summary: {
    grossSalary: number;
    cnpsEmployee: number;
    cmuEmployee: number;
    taxableIncome: number;
    its: number;
    netSalary: number;
    cnpsEmployer: number;
    cmuEmployer: number;
    fdfp: number;
    totalEmployerCost: number;
  };
}

/**
 * Create test employee in category C, BTP sector
 */
async function createTestEmployee(): Promise<string> {
  console.log('📝 Creating test employee...');

  const [employee] = await db.insert(employees).values({
    tenantId: TEST_TENANT_ID,
    employeeNumber: `TEST-CGECI-${Date.now()}`,
    firstName: 'Jean',
    lastName: 'Kouassi',
    email: `jean.kouassi.test.${Date.now()}@test.com`,

    // Category C, BTP sector
    categoryCode: 'C',
    sectorCodeCgeci: 'BTP',

    // Rate type
    rateType: 'MONTHLY',

    // Tax information
    fiscalParts: '1.0', // Single, no children

    // Employment details
    hireDate: '2024-01-01',

    // Country
    countryCode: 'CI',

    // Status
    status: 'active',
  }).returning();

  // Create salary record: 180,000 FCFA (above minimum for category C)
  await db.insert(employeeSalaries).values({
    tenantId: TEST_TENANT_ID,
    employeeId: employee.id,
    baseSalary: '180000',
    currency: 'XOF',
    payFrequency: 'monthly',
    effectiveFrom: '2024-01-01',
    components: [],
  });

  console.log(`✅ Created employee: ${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`);
  console.log(`   Category: ${employee.categoryCode}`);
  console.log(`   Sector: ${employee.sectorCodeCgeci}`);
  console.log(`   Base Salary: 180,000 FCFA`);

  return employee.id;
}

/**
 * Create test payroll run for October 2025
 */
async function createTestPayrollRun(employeeId: string): Promise<string> {
  console.log('\n📅 Creating test payroll run for October 2025...');

  const [payrollRun] = await db.insert(payrollRuns).values({
    tenantId: TEST_TENANT_ID,
    runNumber: `TEST-2025-10-${Date.now()}`,
    name: 'Test Payroll October 2025',
    periodStart: '2025-10-01',
    periodEnd: '2025-10-31',
    payDate: '2025-11-05',
    countryCode: 'CI',
    status: 'draft',
    createdBy: TEST_USER_ID,
  }).returning();

  console.log(`✅ Created payroll run: ${payrollRun.name} (${payrollRun.runNumber})`);
  console.log(`   Period: ${payrollRun.periodStart} - ${payrollRun.periodEnd}`);
  console.log(`   Pay Date: ${payrollRun.payDate}`);

  return payrollRun.id;
}

/**
 * Run payroll calculation for test employee
 */
async function runPayrollCalculation(employeeId: string, payrollRunId: string): Promise<any> {
  console.log('\n💰 Running payroll calculation...');

  // Fetch employee data
  const [employee] = await db
    .select()
    .from(employees)
    .where(sql`id = ${employeeId}`)
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Run calculation using calculatePayrollV2 (database-driven)
  const calculation = await calculatePayrollV2({
    employeeId: employee.id,
    baseSalary: 180000, // Category C BTP minimum is 180,000 FCFA
    periodStart: new Date('2025-10-01'),
    periodEnd: new Date('2025-10-31'),
    overtimeHours: [],
    bonuses: 0,
    countryCode: 'CI',
  });

  console.log('✅ Calculation completed!');
  return calculation;
}

/**
 * Validate calculation results
 */
function validateCalculation(calculation: any, employee: any): TestResults['validations'] {
  console.log('\n🔍 Validating calculation results...\n');

  const validations: TestResults['validations'] = {
    minimumWageCheck: false,
    grossSalaryCorrect: false,
    cnpsEmployeeCorrect: false,
    cmuEmployeeCorrect: false,
    itsCalculationCorrect: false,
    netSalaryCorrect: false,
    employerCostsCorrect: false,
  };

  // 1. Minimum Wage Check
  const baseSalary = parseFloat(employee.baseSalary);
  const minWageCategory = 180000; // Approximate minimum for category C in BTP
  validations.minimumWageCheck = baseSalary >= 75000; // At least SMIG
  console.log(`1️⃣  Minimum Wage Check: ${validations.minimumWageCheck ? '✅' : '❌'}`);
  console.log(`   Base Salary: ${baseSalary} FCFA >= SMIG (75,000 FCFA)`);

  // 2. Gross Salary Calculation
  const expectedGross = baseSalary;
  const actualGross = parseFloat(calculation.grossSalary);
  validations.grossSalaryCorrect = Math.abs(actualGross - expectedGross) < 1;
  console.log(`2️⃣  Gross Salary: ${validations.grossSalaryCorrect ? '✅' : '❌'}`);
  console.log(`   Expected: ${expectedGross} FCFA`);
  console.log(`   Actual: ${actualGross} FCFA`);

  // 3. CNPS Employee Contribution (6.3%)
  const expectedCNPS = baseSalary * 0.063;
  const actualCNPS = parseFloat(calculation.cnpsEmployee || '0');
  validations.cnpsEmployeeCorrect = Math.abs(actualCNPS - expectedCNPS) < 1;
  console.log(`3️⃣  CNPS Employee (6.3%): ${validations.cnpsEmployeeCorrect ? '✅' : '❌'}`);
  console.log(`   Expected: ${expectedCNPS.toFixed(2)} FCFA`);
  console.log(`   Actual: ${actualCNPS} FCFA`);

  // 4. CMU Employee Contribution (fixed 1,000 FCFA)
  const expectedCMU = 1000;
  const actualCMU = parseFloat(calculation.cmuEmployee || '0');
  validations.cmuEmployeeCorrect = Math.abs(actualCMU - expectedCMU) < 1;
  console.log(`4️⃣  CMU Employee: ${validations.cmuEmployeeCorrect ? '✅' : '❌'}`);
  console.log(`   Expected: ${expectedCMU} FCFA (fixed)`);
  console.log(`   Actual: ${actualCMU} FCFA`);

  // 5. ITS Calculation (progressive brackets)
  const taxableIncome = baseSalary - expectedCNPS - expectedCMU;
  const fiscalParts = employee.fiscalParts || 1.0;
  const quotient = taxableIncome / fiscalParts;

  let expectedITS = 0;
  // ITS Brackets for CI (2023):
  // 0-75,000: 0%
  // 75,001-240,000: 16%
  // 240,001-800,000: 21%
  // etc.
  if (quotient > 75000) {
    const bracket1 = Math.min(quotient - 75000, 165000) * 0.16;
    const bracket2 = quotient > 240000 ? Math.min(quotient - 240000, 560000) * 0.21 : 0;
    const bracket3 = quotient > 800000 ? Math.min(quotient - 800000, 1600000) * 0.24 : 0;
    const bracket4 = quotient > 2400000 ? Math.min(quotient - 2400000, 5600000) * 0.28 : 0;
    const bracket5 = quotient > 8000000 ? (quotient - 8000000) * 0.32 : 0;
    expectedITS = (bracket1 + bracket2 + bracket3 + bracket4 + bracket5) * fiscalParts;
  }

  const actualITS = parseFloat(calculation.its || '0');
  validations.itsCalculationCorrect = Math.abs(actualITS - expectedITS) < 10; // Allow 10 FCFA margin
  console.log(`5️⃣  ITS (Progressive Tax): ${validations.itsCalculationCorrect ? '✅' : '❌'}`);
  console.log(`   Taxable Income: ${taxableIncome.toFixed(2)} FCFA`);
  console.log(`   Quotient Familial: ${quotient.toFixed(2)} FCFA (parts: ${fiscalParts})`);
  console.log(`   Expected ITS: ${expectedITS.toFixed(2)} FCFA`);
  console.log(`   Actual ITS: ${actualITS} FCFA`);

  // 6. Net Salary Calculation
  const expectedNet = baseSalary - expectedCNPS - expectedCMU - expectedITS;
  const actualNet = parseFloat(calculation.netSalary);
  validations.netSalaryCorrect = Math.abs(actualNet - expectedNet) < 10;
  console.log(`6️⃣  Net Salary: ${validations.netSalaryCorrect ? '✅' : '❌'}`);
  console.log(`   Expected: ${expectedNet.toFixed(2)} FCFA`);
  console.log(`   Actual: ${actualNet} FCFA`);

  // 7. Employer Costs
  const expectedCNPSEmployer = baseSalary * 0.077; // 7.7% pension
  const expectedCMUEmployer = Math.min(Math.max(baseSalary * 0.025, 500), 4500); // 2.5% with bounds
  const expectedFDFP = baseSalary * 0.01; // 1% (TAP 0.4% + TFPC 0.6%)
  const expectedTotalEmployer = baseSalary + expectedCNPSEmployer + expectedCMUEmployer + expectedFDFP;

  const actualEmployerCost = parseFloat(calculation.totalEmployerCost || '0');
  validations.employerCostsCorrect = Math.abs(actualEmployerCost - expectedTotalEmployer) < 50;
  console.log(`7️⃣  Employer Costs: ${validations.employerCostsCorrect ? '✅' : '❌'}`);
  console.log(`   CNPS Employer (7.7%): ${expectedCNPSEmployer.toFixed(2)} FCFA`);
  console.log(`   CMU Employer (2.5%): ${expectedCMUEmployer.toFixed(2)} FCFA`);
  console.log(`   FDFP (1%): ${expectedFDFP.toFixed(2)} FCFA`);
  console.log(`   Expected Total: ${expectedTotalEmployer.toFixed(2)} FCFA`);
  console.log(`   Actual Total: ${actualEmployerCost} FCFA`);

  return validations;
}

/**
 * Generate summary report
 */
function generateSummary(calculation: any): TestResults['summary'] {
  return {
    grossSalary: parseFloat(calculation.grossSalary),
    cnpsEmployee: parseFloat(calculation.cnpsEmployee || '0'),
    cmuEmployee: parseFloat(calculation.cmuEmployee || '0'),
    taxableIncome: parseFloat(calculation.grossSalary) - parseFloat(calculation.cnpsEmployee || '0') - parseFloat(calculation.cmuEmployee || '0'),
    its: parseFloat(calculation.its || '0'),
    netSalary: parseFloat(calculation.netSalary),
    cnpsEmployer: parseFloat(calculation.cnpsEmployer || '0'),
    cmuEmployer: parseFloat(calculation.cmuEmployer || '0'),
    fdfp: parseFloat(calculation.totalOtherTaxes || '0'),
    totalEmployerCost: parseFloat(calculation.totalEmployerCost || '0'),
  };
}

/**
 * Print final report
 */
function printFinalReport(results: TestResults) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 END-TO-END PAYROLL CALCULATION TEST REPORT');
  console.log('='.repeat(70));

  console.log('\n👤 Employee Information:');
  console.log(`   Name: ${results.employee.firstName} ${results.employee.lastName}`);
  console.log(`   Employee #: ${results.employee.employeeNumber}`);
  console.log(`   Category: ${results.employee.categoryCode} (${results.employee.sectorCode})`);
  console.log(`   Base Salary: ${results.employee.baseSalary} FCFA`);
  console.log(`   Fiscal Parts: ${results.employee.fiscalParts}`);

  console.log('\n💵 Calculation Summary:');
  console.log(`   Gross Salary: ${results.summary.grossSalary.toLocaleString()} FCFA`);
  console.log(`   - CNPS Employee (6.3%): ${results.summary.cnpsEmployee.toLocaleString()} FCFA`);
  console.log(`   - CMU Employee: ${results.summary.cmuEmployee.toLocaleString()} FCFA`);
  console.log(`   = Taxable Income: ${results.summary.taxableIncome.toLocaleString()} FCFA`);
  console.log(`   - ITS: ${results.summary.its.toLocaleString()} FCFA`);
  console.log(`   ────────────────────────────`);
  console.log(`   = Net Salary: ${results.summary.netSalary.toLocaleString()} FCFA`);

  console.log('\n🏢 Employer Costs:');
  console.log(`   + CNPS Employer (7.7%): ${results.summary.cnpsEmployer.toLocaleString()} FCFA`);
  console.log(`   + CMU Employer (2.5%): ${results.summary.cmuEmployer.toLocaleString()} FCFA`);
  console.log(`   + FDFP (1%): ${results.summary.fdfp.toLocaleString()} FCFA`);
  console.log(`   ────────────────────────────`);
  console.log(`   = Total Employer Cost: ${results.summary.totalEmployerCost.toLocaleString()} FCFA`);

  console.log('\n✅ Validation Results:');
  const allValidations = Object.values(results.validations);
  const passedCount = allValidations.filter(v => v).length;
  const totalCount = allValidations.length;

  Object.entries(results.validations).forEach(([key, value]) => {
    const icon = value ? '✅' : '❌';
    const label = key.replace(/([A-Z])/g, ' $1').trim();
    console.log(`   ${icon} ${label}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`OVERALL RESULT: ${passedCount}/${totalCount} validations passed`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED! Payroll calculation is working correctly.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please review the calculation logic.');
  }
  console.log('='.repeat(70));
}

/**
 * Cleanup test data
 */
async function cleanup(employeeId: string, payrollRunId: string) {
  console.log('\n🧹 Cleaning up test data...');

  await db.delete(payrollLineItems).where(sql`payroll_run_id = ${payrollRunId}`);
  await db.delete(payrollRuns).where(sql`id = ${payrollRunId}`);
  await db.delete(employees).where(sql`id = ${employeeId}`);

  console.log('✅ Cleanup completed!');
}

/**
 * Main test execution
 */
async function runE2ETest() {
  let employeeId: string | null = null;
  let payrollRunId: string | null = null;

  try {
    console.log('🚀 Starting End-to-End Payroll Calculation Test\n');
    console.log('Test Scenario: Category C Employee in BTP Sector');
    console.log('Base Salary: 180,000 FCFA (October 2025)\n');

    // Step 1: Create test employee
    employeeId = await createTestEmployee();

    // Step 2: Create test payroll run
    payrollRunId = await createTestPayrollRun(employeeId);

    // Step 3: Run payroll calculation
    const calculation = await runPayrollCalculation(employeeId, payrollRunId);

    // Step 4: Fetch employee data for validation
    const [employee] = await db
      .select()
      .from(employees)
      .where(sql`id = ${employeeId}`)
      .limit(1);

    // Step 5: Validate results
    const validations = validateCalculation(calculation, employee);

    // Step 6: Generate summary
    const summary = generateSummary(calculation);

    // Step 7: Print final report
    const results: TestResults = {
      employee,
      payrollRun: await db.select().from(payrollRuns).where(sql`id = ${payrollRunId}`).limit(1).then(r => r[0]),
      calculation,
      validations,
      summary,
    };

    printFinalReport(results);

    // Step 8: Cleanup
    if (employeeId && payrollRunId) {
      await cleanup(employeeId, payrollRunId);
    }

    // Exit with appropriate code
    const allPassed = Object.values(validations).every(v => v);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);

    // Cleanup on error
    if (employeeId && payrollRunId) {
      try {
        await cleanup(employeeId, payrollRunId);
      } catch (cleanupError) {
        console.error('Failed to cleanup:', cleanupError);
      }
    }

    process.exit(1);
  }
}

// Execute the test
runE2ETest();
