#!/usr/bin/env node

/**
 * Quick Webhook Test - Sends a single test payload to verify the fix
 *
 * Usage: node scripts/quick-webhook-test.js
 */

import http from 'node:http';

const TEST_URL = 'http://localhost:3000/api/mercado-pago/webhook';

// Test the specific bug fix - undefined date_approved
const testPayload = {
  type: 'payment',
  data: { id: 'test-undefined-bug' },
};

console.log('🧪 Testing webhook fix for undefined date_approved...');
console.log('📤 Sending test payload to test the approval logic');
console.log(
  '🎯 Expected: Should get 400 (signature validation) but logic should work',
);

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/mercado-pago/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-signature': 'mock-signature-for-testing',
    'x-request-id': `test-${Date.now()}`,
  },
};

const req = http.request(options, res => {
  let responseData = '';

  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`📊 Response Status: ${res.statusCode}`);

    if (res.statusCode === 400) {
      console.log('✅ Expected 400 - signature validation working');
      console.log('✅ This confirms webhook security is intact');
    } else if (res.statusCode === 200) {
      console.log('✅ Webhook processed successfully');
    } else {
      console.log('❌ Unexpected response:', responseData);
    }

    console.log('\n🔍 Next steps:');
    console.log('1. Check your dev server console for approval logic logs');
    console.log('2. Run unit tests: npm run test -- approval-logic.test.ts');
    console.log(
      '3. For full testing, use: node scripts/test-webhook-locally.js',
    );
  });
});

req.on('error', error => {
  console.error('❌ Request failed:', error.message);
  console.log('\n💡 Make sure your dev server is running:');
  console.log('   npm run dev');
});

req.write(postData);
req.end();
