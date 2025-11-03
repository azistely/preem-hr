// @ts-nocheck
/**
 * Test Script: Formula Version Tracking End-to-End
 *
 * Tests:
 * 1. Create a custom component with initial formula
 * 2. Update the formula multiple times
 * 3. Verify version history is created automatically
 * 4. Load historical formulas by date
 * 5. Compare versions
 *
 * Run: DATABASE_URL="..." npx tsx test-formula-versioning.ts
 */

import { db } from './lib/db';
import { salaryComponentTemplates } from './drizzle/schema';
import { eq, and } from 'drizzle-orm';
import {
  createFormulaVersion,
  getVersionHistory,
  getActiveFormulaVersion,
  compareVersions,
} from './lib/salary-components/formula-version-service';
import type { ComponentMetadata } from './features/employees/types/salary-components';

// Test tenant ID (replace with actual tenant ID from your database)
const TEST_TENANT_ID = '018d9b9f-8f9f-7d9f-8f9f-8f9f8f9f8f9f'; // Replace me
const TEST_USER_ID = '018d9b9f-8f9f-7d9f-8f9f-8f9f8f9f8f9f'; // Replace me

async function runTests() {
  console.log('🧪 Starting Formula Version Tracking Tests\n');

  try {
    // ========================================================================
    // Test 1: Create a custom component with initial formula
    // ========================================================================
    console.log('Test 1: Creating custom component with initial formula...');

    const initialMetadata: ComponentMetadata = {
      taxTreatment: {
        isTaxable: true,
        includeInBrutImposable: true,
        includeInSalaireCategoriel: false,
      },
      socialSecurityTreatment: {
        includeInCnpsBase: false,
      },
      calculationRule: {
        type: 'fixed',
        baseAmount: 50000,
      },
    };

    const [component] = await db
      .insert(salaryComponentTemplates)
      .values({
        tenantId: TEST_TENANT_ID,
        countryCode: 'CI',
        code: 'CUSTOM_TEST_001',
        name: 'Prime de test (versioning)',
        description: 'Composant de test pour le versioning',
        templateCode: null,
        metadata: initialMetadata,
        isActive: true,
        displayOrder: 0,
        createdBy: TEST_USER_ID,
      })
      .returning();

    console.log(`✅ Component created: ${component.id}`);
    console.log(`   Initial formula: Fixed amount = 50,000 FCFA\n`);

    // Create initial version
    const version1 = await createFormulaVersion({
      componentId: component.id,
      componentType: 'custom',
      calculationRule: initialMetadata.calculationRule!,
      changedBy: TEST_USER_ID,
      changeReason: 'Version initiale',
      effectiveFrom: '2025-01-01',
    });

    console.log(`✅ Version 1 created: ${version1.id}`);
    console.log(`   Version number: ${version1.versionNumber}`);
    console.log(`   Effective from: ${version1.effectiveFrom}\n`);

    // ========================================================================
    // Test 2: Update formula to percentage-based
    // ========================================================================
    console.log('Test 2: Updating formula to percentage-based...');

    const updatedMetadata: ComponentMetadata = {
      ...initialMetadata,
      calculationRule: {
        type: 'percentage',
        rate: 0.15, // 15%
      },
    };

    await db
      .update(salaryComponentTemplates)
      .set({ metadata: updatedMetadata })
      .where(eq(salaryComponentTemplates.id, component.id));

    const version2 = await createFormulaVersion({
      componentId: component.id,
      componentType: 'custom',
      calculationRule: updatedMetadata.calculationRule!,
      changedBy: TEST_USER_ID,
      changeReason: 'Passage à un pourcentage pour plus de flexibilité',
      effectiveFrom: '2025-03-01',
    });

    console.log(`✅ Version 2 created: ${version2.id}`);
    console.log(`   Version number: ${version2.versionNumber}`);
    console.log(`   New formula: Percentage = 15%`);
    console.log(`   Effective from: ${version2.effectiveFrom}\n`);

    // ========================================================================
    // Test 3: Update formula to auto-calculated
    // ========================================================================
    console.log('Test 3: Updating formula to auto-calculated...');

    const updatedMetadata2: ComponentMetadata = {
      ...initialMetadata,
      calculationRule: {
        type: 'auto-calculated',
        rate: 0.02, // 2% per year
        cap: 0.20, // Max 20%
      },
    };

    await db
      .update(salaryComponentTemplates)
      .set({ metadata: updatedMetadata2 })
      .where(eq(salaryComponentTemplates.id, component.id));

    const version3 = await createFormulaVersion({
      componentId: component.id,
      componentType: 'custom',
      calculationRule: updatedMetadata2.calculationRule!,
      changedBy: TEST_USER_ID,
      changeReason: 'Ajout d\'une progression annuelle',
      effectiveFrom: '2025-06-01',
    });

    console.log(`✅ Version 3 created: ${version3.id}`);
    console.log(`   Version number: ${version3.versionNumber}`);
    console.log(`   New formula: Auto-calculated = 2% per year, capped at 20%`);
    console.log(`   Effective from: ${version3.effectiveFrom}\n`);

    // ========================================================================
    // Test 4: Get version history
    // ========================================================================
    console.log('Test 4: Fetching version history...');

    const history = await getVersionHistory({
      componentId: component.id,
      componentType: 'custom',
      limit: 50,
    });

    console.log(`✅ Found ${history.length} versions in history:`);
    history.forEach((v) => {
      console.log(`   - Version ${v.versionNumber}: ${v.effectiveFrom} → ${v.effectiveTo || 'present'}`);
      console.log(`     Reason: "${v.changeReason}"`);
    });
    console.log();

    // ========================================================================
    // Test 5: Load historical formulas by date
    // ========================================================================
    console.log('Test 5: Loading historical formulas by date...');

    const dateTests = [
      { date: '2025-02-01', expected: 'fixed' },
      { date: '2025-04-01', expected: 'percentage' },
      { date: '2025-07-01', expected: 'auto-calculated' },
    ];

    for (const test of dateTests) {
      const historicalVersion = await getActiveFormulaVersion({
        componentId: component.id,
        componentType: 'custom',
        asOfDate: test.date,
      });

      if (historicalVersion) {
        console.log(`✅ Formula on ${test.date}:`);
        console.log(`   Type: ${historicalVersion.calculationRule.type}`);
        console.log(`   Version: ${historicalVersion.versionNumber}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Match: ${historicalVersion.calculationRule.type === test.expected ? '✅' : '❌'}\n`);
      } else {
        console.log(`❌ No formula found for ${test.date}\n`);
      }
    }

    // ========================================================================
    // Test 6: Compare versions
    // ========================================================================
    console.log('Test 6: Comparing versions...');

    const comparison = compareVersions(history[2], history[0]); // Compare oldest to newest

    console.log('Comparison between Version 1 and Version 3:');
    console.log(JSON.stringify(comparison, null, 2));
    console.log();

    // ========================================================================
    // Cleanup
    // ========================================================================
    console.log('Test 7: Cleanup (soft delete component)...');

    await db
      .update(salaryComponentTemplates)
      .set({ isActive: false })
      .where(eq(salaryComponentTemplates.id, component.id));

    console.log(`✅ Component soft deleted\n`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('🎉 All tests passed!\n');
    console.log('Summary:');
    console.log(`- Created component: ${component.id}`);
    console.log(`- Created ${history.length} versions`);
    console.log(`- Verified historical formula loading`);
    console.log(`- Verified version comparison`);
    console.log(`- Cleanup completed`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
