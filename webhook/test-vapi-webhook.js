/**
 * Test Vapi Webhook Locally
 * Simulates Vapi function calls for bookShowing and getPropertyDetails
 * Usage: node test-vapi-webhook.js
 */

const http = require('http');

// Helper to make requests
function makeRequest(payload, label) {
  const data = JSON.stringify(payload);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/vapi/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log(`\n--- Testing ${label} ---`);

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', chunk => responseData += chunk);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      try {
        const parsed = JSON.parse(responseData);
        console.log('Response:', JSON.stringify(parsed, null, 2));
        if (parsed.results && parsed.results[0]) {
           // Vapi expects { results: [{ result: "..." }] } where result is stringified JSON often
           // Our server implementation returns { results: [{ result: JSON.stringify(actualResult) }] }
           // So we check if result contains "success": true
           const innerResult = parsed.results[0].result;
           console.log('Decoded Result:', innerResult);
        }
      } catch (e) {
        console.log('Raw Response:', responseData);
      }
    });
  });

  req.on('error', e => console.error(`Problem with request: ${e.message}`));
  req.write(data);
  req.end();
}

// 1. Test getPropertyDetails (Success case)
// Assuming we have a property in DB or it will fall through to not found but return valid JSON
const payloadGetProp = {
  message: {
    type: 'function-call',
    call: { id: 'call-123' },
    functionCall: {
      name: 'getPropertyDetails',
      parameters: {
        propertyId: 'AZ-FLAG-001' 
      }
    }
  }
};

// 2. Test getPropertyDetails with Injection Attempt
const payloadInjection = {
  message: {
    type: 'function-call',
    call: { id: 'call-injection' },
    functionCall: {
      name: 'getPropertyDetails',
      parameters: {
        propertyId: "100' OR '1'='1"
      }
    }
  }
};

// 3. Test bookShowing
const payloadBook = {
  message: {
    type: 'function-call',
    call: { id: 'call-456' },
    functionCall: {
      name: 'bookShowing',
      parameters: {
        propertyId: 'AZ-FLAG-001',
        propertyName: 'Test Property',
        callerName: 'Test Buyer',
        callerPhone: '+15551234567',
        preferredDate: '2026-02-01',
        preferredTime: '10:00 AM'
      }
    }
  }
};

// Run tests sequentially
setTimeout(() => makeRequest(payloadGetProp, 'getPropertyDetails (Normal)'), 0);
setTimeout(() => makeRequest(payloadInjection, 'getPropertyDetails (Injection)'), 1000);
setTimeout(() => makeRequest(payloadBook, 'bookShowing'), 2000);
