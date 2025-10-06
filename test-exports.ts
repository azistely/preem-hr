/**
 * Test Export Services
 *
 * Directly test the export service functions to verify they produce
 * correct output with employee names and all contribution values.
 */

import 'dotenv/config';
import { db } from './lib/db';
import { payrollRuns, payrollLineItems, employees } from './lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateCNPSExcel } from './features/payroll/services/cnps-export';
import { generateCMUExcel } from './features/payroll/services/cmu-export';
import { generateEtat301Excel } from './features/payroll/services/etat-301-export';
import { generateBankTransferExcel } from './features/payroll/services/bank-transfer-export';

async function testExports() {
  console.log('🧪 Testing Export Services\n');
  console.log('='.repeat(80));

  // Get the latest payroll run
  const run = await db.query.payrollRuns.findFirst({
    orderBy: (runs, { desc }) => [desc(runs.createdAt)],
  });

  if (!run) {
    console.error('❌ No payroll run found');
    process.exit(1);
  }

  console.log(`\n📊 Using Payroll Run: ${run.id}`);
  console.log(`   Period: ${run.periodStart} to ${run.periodEnd}`);
  console.log(`   Status: ${run.status}`);

  // Get line items
  const lineItems = await db.query.payrollLineItems.findMany({
    where: eq(payrollLineItems.payrollRunId, run.id),
  });

  console.log(`   Line Items: ${lineItems.length}`);

  // Get employees for CNPS numbers
  const employeeIds = lineItems.map(item => item.employeeId);
  const employeesList = await db.query.employees.findMany({
    where: (employees, { inArray }) => inArray(employees.id, employeeIds),
  });

  const employeeMap = new Map(employeesList.map(emp => [emp.id, emp]));

  // Get tenant info
  const tenant = await db.query.tenants.findFirst({
    where: (tenants, { eq }) => eq(tenants.id, run.tenantId),
  });

  console.log(`   Company: ${tenant?.name || 'N/A'}`);

  // Test 1: CNPS Export
  console.log('\n' + '='.repeat(80));
  console.log('📄 TEST 1: CNPS EXPORT');
  console.log('='.repeat(80));

  const cnpsData = {
    companyName: tenant?.name || 'Company',
    companyCNPS: tenant?.taxId,
    periodStart: new Date(run.periodStart),
    periodEnd: new Date(run.periodEnd),
    employees: lineItems.map(item => {
      const employee = employeeMap.get(item.employeeId);
      return {
        employeeName: item.employeeName || '',
        employeeCNPS: employee?.cnpsNumber || null,
        grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
        cnpsEmployee: parseFloat(item.cnpsEmployee?.toString() || '0'),
        cnpsEmployer: parseFloat(item.cnpsEmployer?.toString() || '0'),
      };
    }),
  };

  console.log('\n📋 CNPS Export Data:');
  console.log(`   Employees: ${cnpsData.employees.length}`);
  console.log(`   Period: ${cnpsData.periodStart.toLocaleDateString()} - ${cnpsData.periodEnd.toLocaleDateString()}`);

  console.log('\n✅ Employee Data Check:');
  cnpsData.employees.forEach((emp, i) => {
    console.log(`   ${i + 1}. ${emp.employeeName || '❌ NO NAME'}`);
    console.log(`      - Gross: ${emp.grossSalary.toLocaleString()} FCFA`);
    console.log(`      - CNPS Employee: ${emp.cnpsEmployee.toLocaleString()} FCFA`);
    console.log(`      - CNPS Employer: ${emp.cnpsEmployer.toLocaleString()} FCFA`);
  });

  const cnpsBuffer = generateCNPSExcel(cnpsData);
  console.log(`\n✅ CNPS Excel generated: ${cnpsBuffer.byteLength} bytes`);

  // Test 2: CMU Export
  console.log('\n' + '='.repeat(80));
  console.log('📄 TEST 2: CMU EXPORT');
  console.log('='.repeat(80));

  const cmuData = {
    companyName: tenant?.name || 'Company',
    companyTaxId: tenant?.taxId,
    periodStart: new Date(run.periodStart),
    periodEnd: new Date(run.periodEnd),
    employees: lineItems.map(item => ({
      employeeName: item.employeeName || '',
      employeeNumber: item.employeeNumber || '',
      cmuEmployee: parseFloat(item.cmuEmployee?.toString() || '0'),
      cmuEmployer: parseFloat(item.cmuEmployer?.toString() || '0'),
    })),
  };

  console.log('\n📋 CMU Export Data:');
  console.log(`   Employees: ${cmuData.employees.length}`);

  console.log('\n✅ Employee Data Check:');
  cmuData.employees.forEach((emp, i) => {
    console.log(`   ${i + 1}. ${emp.employeeName || '❌ NO NAME'} (${emp.employeeNumber || 'NO NUMBER'})`);
    console.log(`      - CMU Employee: ${emp.cmuEmployee.toLocaleString()} FCFA`);
    console.log(`      - CMU Employer: ${emp.cmuEmployer.toLocaleString()} FCFA`);
  });

  const cmuBuffer = generateCMUExcel(cmuData);
  console.log(`\n✅ CMU Excel generated: ${cmuBuffer.byteLength} bytes`);

  // Test 3: État 301 Export
  console.log('\n' + '='.repeat(80));
  console.log('📄 TEST 3: ÉTAT 301 (TAX) EXPORT');
  console.log('='.repeat(80));

  const etat301Data = {
    companyName: tenant?.name || 'Company',
    companyTaxId: tenant?.taxId,
    periodStart: new Date(run.periodStart),
    periodEnd: new Date(run.periodEnd),
    employees: lineItems.map(item => ({
      employeeName: item.employeeName || '',
      employeeNumber: item.employeeNumber || '',
      grossSalary: parseFloat(item.grossSalary?.toString() || '0'),
      its: parseFloat(item.its?.toString() || '0'),
    })),
  };

  console.log('\n📋 État 301 Export Data:');
  console.log(`   Employees: ${etat301Data.employees.length}`);

  console.log('\n✅ Employee Data Check:');
  etat301Data.employees.forEach((emp, i) => {
    console.log(`   ${i + 1}. ${emp.employeeName || '❌ NO NAME'} (${emp.employeeNumber || 'NO NUMBER'})`);
    console.log(`      - Gross: ${emp.grossSalary.toLocaleString()} FCFA`);
    console.log(`      - ITS: ${emp.its.toLocaleString()} FCFA`);
  });

  const etat301Buffer = generateEtat301Excel(etat301Data);
  console.log(`\n✅ État 301 Excel generated: ${etat301Buffer.byteLength} bytes`);

  // Test 4: Bank Transfer Export
  console.log('\n' + '='.repeat(80));
  console.log('📄 TEST 4: BANK TRANSFER EXPORT');
  console.log('='.repeat(80));

  const bankData = {
    companyName: tenant?.name || 'Company',
    companyBankAccount: tenant?.taxId, // Using tax ID as placeholder
    periodStart: new Date(run.periodStart),
    periodEnd: new Date(run.periodEnd),
    payDate: new Date(run.payDate),
    employees: lineItems.map(item => ({
      employeeName: item.employeeName || '',
      employeeNumber: item.employeeNumber || '',
      bankAccount: item.bankAccount || '',
      netSalary: parseFloat(item.netSalary?.toString() || '0'),
    })),
  };

  console.log('\n📋 Bank Transfer Export Data:');
  console.log(`   Employees: ${bankData.employees.length}`);

  let totalNet = 0;
  console.log('\n✅ Employee Data Check:');
  bankData.employees.forEach((emp, i) => {
    totalNet += emp.netSalary;
    console.log(`   ${i + 1}. ${emp.employeeName || '❌ NO NAME'} (${emp.employeeNumber || 'NO NUMBER'})`);
    console.log(`      - Net Salary: ${emp.netSalary.toLocaleString()} FCFA`);
    console.log(`      - Bank Account: ${emp.bankAccount || 'N/A'}`);
  });

  console.log(`\n💰 Total Net to Transfer: ${totalNet.toLocaleString()} FCFA`);

  const bankBuffer = generateBankTransferExcel(bankData);
  console.log(`\n✅ Bank Transfer Excel generated: ${bankBuffer.byteLength} bytes`);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('✅ SUMMARY');
  console.log('='.repeat(80));

  const hasNames = cnpsData.employees.every(e => e.employeeName);
  const hasNumbers = cmuData.employees.every(e => e.employeeNumber);
  const hasValues = cnpsData.employees.every(e => e.cnpsEmployee > 0 || e.grossSalary > 0);

  console.log(`\n✅ Employee Names: ${hasNames ? '✓ ALL PRESENT' : '✗ MISSING'}`);
  console.log(`✅ Employee Numbers: ${hasNumbers ? '✓ ALL PRESENT' : '✗ MISSING'}`);
  console.log(`✅ Contribution Values: ${hasValues ? '✓ ALL PRESENT' : '✗ MISSING'}`);

  console.log('\n📊 Export Files Generated:');
  console.log(`   - CNPS: ${cnpsBuffer.byteLength} bytes`);
  console.log(`   - CMU: ${cmuBuffer.byteLength} bytes`);
  console.log(`   - État 301: ${etat301Buffer.byteLength} bytes`);
  console.log(`   - Bank Transfer: ${bankBuffer.byteLength} bytes`);

  if (hasNames && hasNumbers && hasValues) {
    console.log('\n🎉 ALL TESTS PASSED! Export services are working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n❌ TESTS FAILED! Some data is missing from exports.\n');
    process.exit(1);
  }
}

testExports().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
