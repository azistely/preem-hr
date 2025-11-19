/**
 * Script to check which contracts have HTML content
 */

import { db } from '../db';
import { employmentContracts, employees } from '../drizzle/schema';
import { sql } from 'drizzle-orm';

async function checkContractHtml() {
  console.log('Checking contracts for HTML content...\n');

  // Query all contracts with HTML content status
  const contracts = await db
    .select({
      id: employmentContracts.id,
      employeeId: employmentContracts.employeeId,
      contractType: employmentContracts.contractType,
      contractNumber: employmentContracts.contractNumber,
      hasHtml: sql<boolean>`contract_html_content IS NOT NULL AND LENGTH(contract_html_content) > 0`,
      htmlLength: sql<number>`LENGTH(contract_html_content)`,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employmentContracts)
    .leftJoin(employees, sql`${employees.id} = ${employmentContracts.employeeId}`)
    .orderBy(sql`CASE WHEN contract_html_content IS NOT NULL THEN 0 ELSE 1 END, ${employmentContracts.createdAt} DESC`)
    .limit(15);

  console.log('Contract HTML Content Status:');
  console.log('==============================\n');

  const withHtml = contracts.filter((c) => c.hasHtml);
  const withoutHtml = contracts.filter((c) => !c.hasHtml);

  console.log(`📊 Summary:`);
  console.log(`  - Contracts WITH HTML: ${withHtml.length}`);
  console.log(`  - Contracts WITHOUT HTML: ${withoutHtml.length}`);
  console.log(`  - Total checked: ${contracts.length}\n`);

  if (withHtml.length > 0) {
    console.log('✅ Contracts WITH HTML content:');
    console.log('================================');
    withHtml.forEach((c) => {
      console.log(`  - ${c.contractType} | ${c.firstName} ${c.lastName}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Number: ${c.contractNumber || 'N/A'}`);
      console.log(`    HTML Length: ${c.htmlLength?.toLocaleString() || 0} chars\n`);
    });
  }

  if (withoutHtml.length > 0) {
    console.log('❌ Contracts WITHOUT HTML content:');
    console.log('===================================');
    withoutHtml.forEach((c) => {
      console.log(`  - ${c.contractType} | ${c.firstName} ${c.lastName}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Number: ${c.contractNumber || 'N/A'}\n`);
    });
  }
}

checkContractHtml()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
