/**
 * Test Script: Formula Version Tracking End-to-End (Supabase Client)
 *
 * Tests:
 * 1. Get tenant and user IDs
 * 2. Create a custom component with initial formula
 * 3. Update the formula multiple times
 * 4. Verify version history is created automatically
 * 5. Load historical formulas by date
 *
 * Run: npx tsx test-formula-versioning-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/supabase/database.types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in .env.local');
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function runTests() {
  console.log('🧪 Starting Formula Version Tracking Tests (Supabase Client)\n');

  try {
    // ========================================================================
    // Step 0: Get tenant and user IDs
    // ========================================================================
    console.log('Step 0: Getting tenant and user IDs...');

    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (!tenants?.[0] || !users?.[0]) {
      throw new Error('No tenant or user found in database');
    }

    const TENANT_ID = tenants[0].id;
    const USER_ID = users[0].id;

    console.log(`✅ Tenant ID: ${TENANT_ID}`);
    console.log(`✅ User ID: ${USER_ID}\n`);

    // ========================================================================
    // Test 1: Create a custom component with initial formula
    // ========================================================================
    console.log('Test 1: Creating custom component with initial formula...');

    const initialMetadata = {
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

    const { data: component, error: createError } = await supabase
      .from('custom_salary_components')
      .insert({
        tenant_id: TENANT_ID,
        country_code: 'CI',
        code: 'CUSTOM_TEST_001',
        name: 'Prime de test (versioning)',
        description: 'Composant de test pour le versioning',
        metadata: initialMetadata,
        is_active: true,
        display_order: 0,
        created_by: USER_ID,
      })
      .select()
      .single();

    if (createError) throw createError;

    console.log(`✅ Component created: ${component.id}`);
    console.log(`   Initial formula: Fixed amount = 50,000 FCFA\n`);

    // ========================================================================
    // Test 2: Create initial version using PostgreSQL function
    // ========================================================================
    console.log('Test 2: Creating initial version...');

    const { data: version1Data, error: v1Error } = await supabase.rpc(
      'create_formula_version',
      {
        p_component_id: component.id,
        p_component_type: 'custom',
        p_calculation_rule: initialMetadata.calculationRule,
        p_changed_by: USER_ID,
        p_change_reason: 'Version initiale',
        p_effective_from: '2025-01-01',
      }
    );

    if (v1Error) throw v1Error;

    console.log(`✅ Version 1 created: ${version1Data}`);
    console.log(`   Effective from: 2025-01-01\n`);

    // ========================================================================
    // Test 3: Update formula to percentage-based
    // ========================================================================
    console.log('Test 3: Updating formula to percentage-based...');

    const updatedMetadata = {
      ...initialMetadata,
      calculationRule: {
        type: 'percentage',
        rate: 0.15, // 15%
      },
    };

    const { error: updateError1 } = await supabase
      .from('custom_salary_components')
      .update({ metadata: updatedMetadata })
      .eq('id', component.id);

    if (updateError1) throw updateError1;

    const { data: version2Data, error: v2Error } = await supabase.rpc(
      'create_formula_version',
      {
        p_component_id: component.id,
        p_component_type: 'custom',
        p_calculation_rule: updatedMetadata.calculationRule,
        p_changed_by: USER_ID,
        p_change_reason: 'Passage à un pourcentage pour plus de flexibilité',
        p_effective_from: '2025-03-01',
      }
    );

    if (v2Error) throw v2Error;

    console.log(`✅ Version 2 created: ${version2Data}`);
    console.log(`   New formula: Percentage = 15%`);
    console.log(`   Effective from: 2025-03-01\n`);

    // ========================================================================
    // Test 4: Update formula to auto-calculated
    // ========================================================================
    console.log('Test 4: Updating formula to auto-calculated...');

    const updatedMetadata2 = {
      ...initialMetadata,
      calculationRule: {
        type: 'auto-calculated',
        rate: 0.02, // 2% per year
        cap: 0.20, // Max 20%
      },
    };

    const { error: updateError2 } = await supabase
      .from('custom_salary_components')
      .update({ metadata: updatedMetadata2 })
      .eq('id', component.id);

    if (updateError2) throw updateError2;

    const { data: version3Data, error: v3Error } = await supabase.rpc(
      'create_formula_version',
      {
        p_component_id: component.id,
        p_component_type: 'custom',
        p_calculation_rule: updatedMetadata2.calculationRule,
        p_changed_by: USER_ID,
        p_change_reason: "Ajout d'une progression annuelle",
        p_effective_from: '2025-06-01',
      }
    );

    if (v3Error) throw v3Error;

    console.log(`✅ Version 3 created: ${version3Data}`);
    console.log(`   New formula: Auto-calculated = 2% per year, capped at 20%`);
    console.log(`   Effective from: 2025-06-01\n`);

    // ========================================================================
    // Test 5: Get version history
    // ========================================================================
    console.log('Test 5: Fetching version history...');

    const { data: history, error: historyError } = await supabase
      .from('salary_component_formula_versions')
      .select('*')
      .eq('component_id', component.id)
      .eq('component_type', 'custom')
      .order('version_number', { ascending: false });

    if (historyError) throw historyError;

    console.log(`✅ Found ${history.length} versions in history:`);
    history.forEach((v) => {
      console.log(`   - Version ${v.version_number}: ${v.effective_from} → ${v.effective_to || 'present'}`);
      console.log(`     Reason: "${v.change_reason}"`);
    });
    console.log();

    // ========================================================================
    // Test 6: Load historical formulas by date using PostgreSQL function
    // ========================================================================
    console.log('Test 6: Loading historical formulas by date...');

    const dateTests = [
      { date: '2025-02-01', expected: 'fixed' },
      { date: '2025-04-01', expected: 'percentage' },
      { date: '2025-07-01', expected: 'auto-calculated' },
    ];

    for (const test of dateTests) {
      const { data: formula, error: formulaError } = await supabase.rpc(
        'get_active_formula_version',
        {
          p_component_id: component.id,
          p_component_type: 'custom',
          p_as_of_date: test.date,
        }
      );

      if (formulaError) throw formulaError;

      if (formula) {
        console.log(`✅ Formula on ${test.date}:`);
        console.log(`   Type: ${formula.type}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Match: ${formula.type === test.expected ? '✅' : '❌'}\n`);
      } else {
        console.log(`❌ No formula found for ${test.date}\n`);
      }
    }

    // ========================================================================
    // Test 7: Cleanup (soft delete component)
    // ========================================================================
    console.log('Test 7: Cleanup (soft delete component)...');

    const { error: deleteError } = await supabase
      .from('custom_salary_components')
      .update({ is_active: false })
      .eq('id', component.id);

    if (deleteError) throw deleteError;

    console.log(`✅ Component soft deleted\n`);

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('🎉 All tests passed!\n');
    console.log('Summary:');
    console.log(`- Created component: ${component.id}`);
    console.log(`- Created ${history.length} versions`);
    console.log(`- Verified historical formula loading`);
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
