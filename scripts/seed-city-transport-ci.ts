/**
 * Seed City Transport Minimums for Côte d'Ivoire
 *
 * Legal basis: Arrêté du 30 janvier 2020
 * Source: Commission consultative du Travail - 15 janvier 2020
 *
 * Effective rates:
 * - Abidjan: 30,000 FCFA/month (1,000 FCFA/day)
 * - Bouaké: 24,000 FCFA/month (800 FCFA/day)
 * - Other cities: 20,000 FCFA/month (667 FCFA/day)
 */

import { db } from '../lib/db';
import { cityTransportMinimums } from '../lib/db/schema';

const CI_CITY_TRANSPORT_DATA = [
  {
    countryCode: 'CI',
    cityName: 'Abidjan',
    cityNameNormalized: 'abidjan',
    displayName: {
      fr: 'Abidjan',
      en: 'Abidjan',
    },
    monthlyMinimum: '30000',
    dailyRate: '1000', // 30,000 / 30 days
    taxExemptionCap: '30000',
    effectiveFrom: '2020-01-30',
    effectiveTo: null,
    legalReference: {
      fr: 'Arrêté du 30 janvier 2020',
      article: 'Article 3',
      details: `Prime minimum mensuelle de transport fixée à 30 000 FCFA pour le District d'Abidjan (passage de 25 000 FCFA à 30 000 FCFA)`,
      source: 'Commission consultative du Travail du 15 janvier 2020',
    },
  },
  {
    countryCode: 'CI',
    cityName: 'Bouaké',
    cityNameNormalized: 'bouake',
    displayName: {
      fr: 'Bouaké',
      en: 'Bouake',
    },
    monthlyMinimum: '24000',
    dailyRate: '800', // 24,000 / 30 days
    taxExemptionCap: '30000',
    effectiveFrom: '2020-01-30',
    effectiveTo: null,
    legalReference: {
      fr: 'Arrêté du 30 janvier 2020',
      article: 'Article 3',
      details: `Prime minimum mensuelle de transport fixée à 24 000 FCFA pour la ville de Bouaké (passage de 21 000 FCFA à 24 000 FCFA)`,
      source: 'Commission consultative du Travail du 15 janvier 2020',
    },
  },
  {
    countryCode: 'CI',
    cityName: 'OTHER',
    cityNameNormalized: 'other',
    displayName: {
      fr: 'Autres villes de l\'intérieur',
      en: 'Other interior cities',
    },
    monthlyMinimum: '20000',
    dailyRate: '667', // 20,000 / 30 days ≈ 667
    taxExemptionCap: '30000',
    effectiveFrom: '2020-01-30',
    effectiveTo: null,
    legalReference: {
      fr: 'Arrêté du 30 janvier 2020',
      article: 'Article 3',
      details: `Prime minimum mensuelle de transport fixée à 20 000 FCFA pour les autres villes de l'intérieur (passage de 17 000 FCFA à 20 000 FCFA)`,
      source: 'Commission consultative du Travail du 15 janvier 2020',
    },
  },
];

async function main() {
  console.log('🌍 Seeding Côte d\'Ivoire city transport minimums...\n');

  for (const cityData of CI_CITY_TRANSPORT_DATA) {
    try {
      const inserted = await db
        .insert(cityTransportMinimums)
        .values(cityData)
        .onConflictDoUpdate({
          target: [
            cityTransportMinimums.countryCode,
            cityTransportMinimums.cityNameNormalized,
            cityTransportMinimums.effectiveFrom,
          ],
          set: {
            monthlyMinimum: cityData.monthlyMinimum,
            dailyRate: cityData.dailyRate,
            taxExemptionCap: cityData.taxExemptionCap,
            displayName: cityData.displayName,
            legalReference: cityData.legalReference,
            updatedAt: new Date(),
          },
        })
        .returning();

      const displayName = (cityData.displayName as { fr: string }).fr;
      console.log(`✅ ${displayName}: ${cityData.monthlyMinimum} FCFA/mois (${cityData.dailyRate} FCFA/jour)`);
    } catch (error) {
      console.error(`❌ Error seeding ${cityData.cityName}:`, error);
      throw error;
    }
  }

  console.log('\n✨ City transport minimums seeded successfully!');
  console.log('\nSummary:');
  console.log('- Abidjan: 30,000 FCFA/month (1,000 FCFA/day)');
  console.log('- Bouaké: 24,000 FCFA/month (800 FCFA/day)');
  console.log('- Other cities: 20,000 FCFA/month (667 FCFA/day)');
  console.log('\n📜 Legal basis: Arrêté du 30 janvier 2020');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
