// Native fetch (Node 18+)
async function testPropertyLookup() {
  const url = 'http://localhost:3000/api/vapi/webhook';
  
  console.log('🧪 Testing Property Lookup via Webhook...');
  
  try {
    const payload = {
      message: {
        type: 'function-call',
        functionCall: {
          name: 'getPropertyDetails',
          parameters: {
            propertyId: 'AZ-FLAG-001'
          }
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.results[0].result);
    
    if (result.success && result.property.property_id === 'AZ-FLAG-001') {
      console.log('✅ SUCCESS: Webhook returned correct property details from Database!');
      console.log(`   Name: ${result.property.name}`);
      console.log(`   Price: ${result.property.price_formatted}`);
    } else {
      console.error('❌ FAILED: Webhook did not return expected data.');
      console.log('Response:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ ERROR: Could not connect to webhook server.');
    console.error('   Make sure your server is running on port 3000!');
    console.error(`   Error details: ${error.message}`);
    if (error.cause) console.error('   Cause:', error.cause);
  }
}

testPropertyLookup();
