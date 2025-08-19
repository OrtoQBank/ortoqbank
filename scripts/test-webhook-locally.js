#!/usr/bin/env node

/**
 * Local Webhook Testing Script
 *
 * This script simulates webhook calls to your local development server
 * WITHOUT requiring real payments or external services.
 *
 * Usage: node scripts/test-webhook-locally.js
 */

import http from 'node:http';

const WEBHOOK_URL = 'http://localhost:3000/api/mercado-pago/webhook';

// Test scenarios that simulate real Mercado Pago webhook payloads
const testScenarios = [
  {
    name: '✅ Approved PIX Payment',
    description: 'PIX payment that was successfully paid',
    mockApiResponse: {
      id: 1_234_567_890,
      status: 'approved',
      status_detail: 'accredited',
      date_approved: '2023-12-01T14:30:00.000-04:00',
      payment_method_id: 'pix',
      transaction_amount: 29.9,
      currency_id: 'BRL',
      external_reference: 'test-123',
    },
    webhookPayload: {
      type: 'payment',
      data: { id: 1_234_567_890 },
    },
    expectedBehavior:
      'Should process payment and call handleMercadoPagoPayment',
  },
  {
    name: '❌ Pending PIX Payment',
    description: 'PIX payment that has not been paid yet',
    mockApiResponse: {
      id: 1_234_567_891,
      status: 'pending',
      status_detail: 'pending_waiting_payment',
      date_approved: null,
      payment_method_id: 'pix',
      transaction_amount: 29.9,
      external_reference: 'test-124',
    },
    webhookPayload: {
      type: 'payment',
      data: { id: 1_234_567_891 },
    },
    expectedBehavior: 'Should NOT process payment (date_approved is null)',
  },
  {
    name: '🐛 Malformed Data (undefined date_approved)',
    description: 'Payment with undefined date_approved (edge case)',
    mockApiResponse: {
      id: 1_234_567_892,
      status: 'pending',
      // date_approved is undefined (missing)
      payment_method_id: 'pix',
      transaction_amount: 29.9,
    },
    webhookPayload: {
      type: 'payment',
      data: { id: 1_234_567_892 },
    },
    expectedBehavior: 'Should NOT process payment (date_approved is undefined)',
  },
];

async function sendWebhookRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/mercado-pago/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        // Add mock signature headers if needed
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
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData,
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 TESTING WEBHOOK LOCALLY');
  console.log('==========================\n');

  console.log(
    '⚠️  IMPORTANT: Make sure your Next.js dev server is running on http://localhost:3000',
  );
  console.log('   Run: npm run dev\n');

  for (const scenario of testScenarios) {
    console.log(`🧪 Testing: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log(`🎯 Expected: ${scenario.expectedBehavior}\n`);

    try {
      const response = await sendWebhookRequest(scenario.webhookPayload);

      console.log(`📊 Response Status: ${response.statusCode}`);

      if (response.statusCode === 200) {
        console.log('✅ Webhook request successful');
      } else {
        console.log('❌ Webhook request failed');
        console.log(`   Response: ${response.body}`);
      }

      console.log('---\n');
    } catch (error) {
      console.log('❌ Request failed:', error.message);
      console.log('   Make sure your dev server is running!\n');
    }
  }

  console.log('📋 MANUAL VERIFICATION STEPS:');
  console.log('1. Check your dev server console logs');
  console.log(
    '2. Look for "Payment approved, processing..." vs "Payment not approved, skipping processing"',
  );
  console.log(
    '3. Verify that only the approved PIX payment triggers processing',
  );
  console.log('4. Check Sentry dashboard for logged events (if configured)');
}

// Show usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/test-webhook-locally.js');
  console.log('');
  console.log(
    'This script sends test webhook payloads to your local development server.',
  );
  console.log('Make sure to run "npm run dev" first!');
  process.exit(0);
}

try {
  await runTests();
} catch (error) {
  console.error(error);
}
