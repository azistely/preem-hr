/**
 * Seed contribution_types_v2 with CMU data for Côte d'Ivoire
 *
 * Run with: npx tsx scripts/seed-contribution-types-v2.ts
 */

import { db } from '@/lib/db';
import { contributionTypesV2 } from '@/drizzle/schema';

async function seedContributionTypesV2() {
  console.log('Seeding contribution_types_v2 with CMU data...');

  const cmuContributions = [
    {
      code: 'cmu_employee',
      name: { en: 'CMU (Employee contribution)', fr: 'CMU (Cotisation salariale)' },
      countryCode: 'CI',
      employeeRate: null,
      employerRate: null,
      calculationBase: 'fixed',
      ceilingAmount: null,
      ceilingPeriod: null,
      fixedAmount: '1000.00',
      isVariableBySector: false,
      displayOrder: 4,
    },
    {
      code: 'cmu_employer_base',
      name: { en: 'CMU (Employer - single employee)', fr: 'CMU (Cotisation patronale - employé seul)' },
      countryCode: 'CI',
      employeeRate: null,
      employerRate: null,
      calculationBase: 'fixed',
      ceilingAmount: null,
      ceilingPeriod: null,
      fixedAmount: '500.00',
      isVariableBySector: false,
      displayOrder: 5,
    },
    {
      code: 'cmu_employer_family',
      name: { en: 'CMU (Employer - with family)', fr: 'CMU (Cotisation patronale - famille)' },
      countryCode: 'CI',
      employeeRate: null,
      employerRate: null,
      calculationBase: 'fixed',
      ceilingAmount: null,
      ceilingPeriod: null,
      fixedAmount: '4500.00',
      isVariableBySector: false,
      displayOrder: 6,
    },
  ];

  try {
    for (const contrib of cmuContributions) {
      await db.insert(contributionTypesV2).values(contrib).onConflictDoNothing();
      console.log(`✓ Inserted ${contrib.code}`);
    }

    console.log('\n✅ Successfully seeded contribution_types_v2 with CMU data');
  } catch (error) {
    console.error('❌ Error seeding contribution_types_v2:', error);
    throw error;
  }
}

// Run the seed
seedContributionTypesV2();
