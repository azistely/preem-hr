/**
 * Test script to debug RuleLoader.getCountryConfig
 * Run with: npx tsx test-rule-loader.ts
 */

import 'dotenv/config';
import { ruleLoader } from './features/payroll/services/rule-loader';

async function testRuleLoader() {
  console.log('Testing RuleLoader.getCountryConfig for CI...\n');

  try {
    const config = await Promise.race([
      ruleLoader.getCountryConfig('CI', new Date()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
      )
    ]);

    console.log('✅ SUCCESS! Config loaded for CI');
    console.log('\n📊 Country:', JSON.stringify(config.country, null, 2));
    console.log('\n💰 Tax System:', JSON.stringify(config.taxSystem, null, 2));
    console.log('\n🏥 Social Scheme:', JSON.stringify(config.socialScheme, null, 2));
    console.log('\n📝 Other Taxes:', JSON.stringify(config.otherTaxes, null, 2));

    console.log('\n✅ All data loaded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

testRuleLoader();
