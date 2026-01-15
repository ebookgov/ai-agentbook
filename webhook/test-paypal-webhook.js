/**
 * Test PayPal Webhook Locally
 * Simulates a PayPal BILLING.SUBSCRIPTION.ACTIVATED event
 * Usage: node test-paypal-webhook.js
 */

const http = require('http');

const testPayload = {
  event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
  resource: {
    id: 'I-TEST12345678',
    plan_id: 'P-AIAGENT-MONTHLY',
    start_time: new Date().toISOString(),
    subscriber: {
      email_address: 'test@example.com',
      name: {
        given_name: 'Test',
        surname: 'User'
      }
    },
    status: 'ACTIVE'
  }
};

const data = JSON.stringify(testPayload);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/paypal/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    // Simulated PayPal headers (real ones come from PayPal)
    'paypal-transmission-id': 'test-transmission-id-123',
    'paypal-transmission-time': new Date().toISOString(),
    'paypal-transmission-sig': 'test-signature',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/test-cert'
  }
};

console.log('Sending test PayPal webhook to http://localhost:3000/api/paypal/webhook');
console.log('Payload:', JSON.stringify(testPayload, null, 2));

const req = http.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log(`\nResponse Status: ${res.statusCode}`);
    console.log('Response Body:', responseData);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Webhook test successful!');
      console.log('Check your Supabase "subscriptions" table for the new record.');
    } else {
      console.log('\n❌ Webhook test failed.');
    }
  });
});

req.on('error', (error) => {
  console.error('Error sending request:', error.message);
  console.log('\nMake sure the server is running: npm start');
});

req.write(data);
req.end();
