/**
 * Seed Evaluation Templates Script
 *
 * Run with: npx tsx scripts/seed-evaluation-templates.ts
 *
 * This script seeds the default evaluation templates into the database.
 * Templates are marked as `isSystem: true` and visible to all tenants.
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { hrFormTemplates } from '../lib/db/schema/hr-forms';
import type { FormDefinition, FormScoringConfig, RatingScaleConfig } from '../lib/db/schema/hr-forms';
import { DEFAULT_EVALUATION_TEMPLATES } from '../lib/db/seeds/evaluation-templates';
import { tenants } from '../lib/db/schema/tenants';

async function main() {
  console.log('🌱 Starting evaluation templates seed...\n');

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Create database connection
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    // Get the first tenant to use as the owner (system templates need a tenant)
    const [firstTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(1);

    if (!firstTenant) {
      console.error('❌ No tenant found in database. Please create a tenant first.');
      process.exit(1);
    }

    console.log(`📌 Using tenant: ${firstTenant.id}\n`);

    const results: { name: string; status: string }[] = [];

    for (const template of DEFAULT_EVALUATION_TEMPLATES) {
      // Check if template already exists
      const [existing] = await db
        .select({ id: hrFormTemplates.id })
        .from(hrFormTemplates)
        .where(and(
          eq(hrFormTemplates.slug, template.slug),
          eq(hrFormTemplates.isSystem, true)
        ))
        .limit(1);

      if (existing) {
        console.log(`⏭️  ${template.name} - Already exists`);
        results.push({ name: template.name, status: 'exists' });
        continue;
      }

      // Insert template
      await db.insert(hrFormTemplates).values({
        tenantId: firstTenant.id,
        name: template.name,
        slug: template.slug,
        description: template.description,
        module: template.module,
        category: template.category,
        definition: template.definition as FormDefinition,
        scoringEnabled: template.scoringEnabled,
        scoringConfig: template.scoringConfig as FormScoringConfig | null,
        defaultRatingScale: template.defaultRatingScale as RatingScaleConfig,
        isSystem: true,
        isActive: true,
        version: 1,
      });

      console.log(`✅ ${template.name} - Created`);
      results.push({ name: template.name, status: 'created' });
    }

    // Summary
    const created = results.filter(r => r.status === 'created').length;
    const existing = results.filter(r => r.status === 'exists').length;

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Existing: ${existing}`);
    console.log(`   📁 Total: ${results.length}`);

    console.log('\n🎉 Seed completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
