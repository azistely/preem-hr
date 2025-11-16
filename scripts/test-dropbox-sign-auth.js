#!/usr/bin/env node

/**
 * Test Dropbox Sign API Authentication
 *
 * This script verifies that your DROPBOX_SIGN_API_KEY is valid
 * by making a simple API call to get account information.
 *
 * Usage:
 *   node scripts/test-dropbox-sign-auth.js
 */

require('dotenv').config({ path: '.env.local' });

const https = require('https');

const API_KEY = process.env.DROPBOX_SIGN_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: DROPBOX_SIGN_API_KEY not found in .env.local');
  console.error('\nPlease add your API key to .env.local:');
  console.error('DROPBOX_SIGN_API_KEY=your_api_key_here');
  process.exit(1);
}

console.log('🔍 Testing Dropbox Sign API authentication...\n');
console.log('API Key:', API_KEY.substring(0, 8) + '...' + API_KEY.substring(API_KEY.length - 8));
console.log('');

// Test the API key by getting account info
const options = {
  hostname: 'api.hellosign.com',
  port: 443,
  path: '/v3/account',
  method: 'GET',
  auth: `${API_KEY}:`,
  headers: {
    'User-Agent': 'Preem-HR-Test-Script',
    'Accept': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Status:', res.statusCode, res.statusMessage);
    console.log('');

    if (res.statusCode === 200) {
      const account = JSON.parse(data);
      console.log('✅ SUCCESS! API key is valid.\n');
      console.log('Account Details:');
      console.log('  - Email:', account.account?.email_address);
      console.log('  - Account ID:', account.account?.account_id);
      console.log('  - Paid Plan (HelloSign):', account.account?.is_paid_hs ? 'Yes' : 'No');
      console.log('  - Paid Plan (HelloFax):', account.account?.is_paid_hf ? 'Yes' : 'No');
      console.log('  - Account Locked:', account.account?.is_locked ? 'Yes' : 'No');

      if (account.account?.quotas) {
        console.log('\n  Quotas:');
        console.log('    - API Signature Requests Sent:', account.account.quotas.api_signature_requests_sent || 0);
        console.log('    - Documents Sent:', account.account.quotas.documents_sent || 0);
        if (account.account.quotas.api_signature_requests_left !== undefined) {
          console.log('    - API Signature Requests Left:', account.account.quotas.api_signature_requests_left);
        }
      }

      console.log('\n✅ You can now use signature requests in the application!');
      console.log('');
      console.log('Note: In development mode (NODE_ENV=development), signature requests');
      console.log('      will automatically use test mode and won\'t count against your quota.');
    } else if (res.statusCode === 401) {
      console.error('❌ AUTHENTICATION FAILED (401 Unauthorized)\n');
      console.error('This means your API key is invalid or expired.\n');
      console.error('To fix this:');
      console.error('  1. Go to: https://app.hellosign.com/home/myAccount#api');
      console.error('  2. Generate a new API key');
      console.error('  3. Update DROPBOX_SIGN_API_KEY in .env.local');
      console.error('  4. Restart your dev server\n');
      console.error('See docs/DROPBOX-SIGN-API-KEY-SETUP.md for detailed instructions.');
    } else {
      console.error('❌ Error:', res.statusCode, res.statusMessage);
      console.error('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('\nPlease check your internet connection and try again.');
});

req.end();
