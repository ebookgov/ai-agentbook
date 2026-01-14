/**
 * Vapi Assistant Setup Script
 * Creates or updates the EbookGov AI booking agent assistant
 * 
 * Usage: node setup-vapi.js
 * 
 * Requires: VAPI_PRIVATE_KEY in .env
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: '../.env' });

// Read configuration files
const assistantConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'assistant-config.json'), 'utf8')
);
const systemPrompt = fs.readFileSync(
  path.join(__dirname, 'system-prompt.txt'), 
  'utf8'
);

// Extract the private key ID from the PEM format in .env
// Format in .env: -----BEGIN PRIVATE KEY-----{key-id}-----END PRIVATE KEY-----
const privateKeyRaw = process.env.VAPI_PRIVATE_KEY || '';
const privateKeyId = privateKeyRaw
  .replace('-----BEGIN PRIVATE KEY-----', '')
  .replace('-----END PRIVATE KEY-----', '')
  .trim();

const publicKeyRaw = process.env.VAPI_PUBLIC_KEY || '';
const publicKeyId = publicKeyRaw
  .replace('-----BEGIN PUBLIC KEY-----', '')
  .replace('-----END PUBLIC KEY-----', '')
  .trim();

// Use the public key as the API bearer token
// Note: Vapi uses the public key ID as the bearer token for basic API access
const VAPI_API_KEY = publicKeyId;

console.log('='.repeat(60));
console.log('EbookGov AI - Vapi Assistant Setup');
console.log('='.repeat(60));
console.log('');
console.log('Available credentials:');
console.log('  Private Key ID:', privateKeyId ? `${privateKeyId.substring(0, 8)}...` : 'Not found');
console.log('  Public Key ID:', publicKeyId ? `${publicKeyId.substring(0, 8)}...` : 'Not found');
console.log('  Phone Number:', process.env.VAPI_PHONE_NUMBER || 'Not found');
console.log('');

// Prepare the assistant payload
const assistantPayload = {
  name: assistantConfig.name,
  model: {
    provider: assistantConfig.model.provider,
    model: assistantConfig.model.model,
    temperature: assistantConfig.model.temperature,
    maxTokens: assistantConfig.model.maxTokens,
    messages: [
      {
        role: "system",
        content: systemPrompt
      }
    ],
    tools: assistantConfig.functions.map(fn => ({
      type: "function",
      function: fn
    }))
  },
  voice: assistantConfig.voice,
  transcriber: assistantConfig.transcriber,
  firstMessage: assistantConfig.firstMessage,
  silenceTimeoutSeconds: assistantConfig.silenceTimeoutSeconds,
  maxDurationSeconds: assistantConfig.maxDurationSeconds,
  backgroundSound: assistantConfig.backgroundSound,
  backchannelingEnabled: assistantConfig.backchannelingEnabled,
  responseDelaySeconds: assistantConfig.responseDelaySeconds,
  endCallFunctionEnabled: assistantConfig.endCallFunctionEnabled,
  recordingEnabled: assistantConfig.recordingEnabled
};

// Output the configuration for manual setup via Vapi Dashboard
console.log('='.repeat(60));
console.log('MANUAL SETUP INSTRUCTIONS');
console.log('='.repeat(60));
console.log('');
console.log('1. Go to https://dashboard.vapi.ai');
console.log('2. Create a new Assistant with these settings:');
console.log('');
console.log('--- BASIC SETTINGS ---');
console.log(`Name: ${assistantConfig.name}`);
console.log('');
console.log('--- VOICE ---');
console.log(`Provider: ${assistantConfig.voice.provider}`);
console.log(`Voice ID: ${assistantConfig.voice.voiceId}`);
console.log(`Stability: ${assistantConfig.voice.stability}`);
console.log(`Similarity Boost: ${assistantConfig.voice.similarityBoost}`);
console.log('');
console.log('--- MODEL ---');
console.log(`Provider: ${assistantConfig.model.provider}`);
console.log(`Model: ${assistantConfig.model.model}`);
console.log(`Temperature: ${assistantConfig.model.temperature}`);
console.log(`Max Tokens: ${assistantConfig.model.maxTokens}`);
console.log('');
console.log('--- TRANSCRIBER ---');
console.log(`Provider: ${assistantConfig.transcriber.provider}`);
console.log(`Model: ${assistantConfig.transcriber.model}`);
console.log(`Language: ${assistantConfig.transcriber.language}`);
console.log('');
console.log('--- FIRST MESSAGE ---');
console.log(assistantConfig.firstMessage);
console.log('');
console.log('--- SYSTEM PROMPT ---');
console.log('Copy from: vapi/system-prompt.txt');
console.log('');
console.log('--- FUNCTIONS ---');
assistantConfig.functions.forEach((fn, i) => {
  console.log(`${i + 1}. ${fn.name}: ${fn.description.substring(0, 60)}...`);
});
console.log('');
console.log('Function JSON is in: vapi/assistant-config.json');
console.log('');
console.log('--- WEBHOOK URL ---');
console.log('Set to: https://your-domain.com/api/vapi/webhook');
console.log('');
console.log('--- PHONE NUMBER ---');
console.log(`Assign: ${process.env.VAPI_PHONE_NUMBER}`);
console.log('');
console.log('='.repeat(60));
console.log('');

// Save the full payload for reference
const outputPath = path.join(__dirname, 'assistant-payload.json');
fs.writeFileSync(outputPath, JSON.stringify(assistantPayload, null, 2));
console.log(`Full API payload saved to: ${outputPath}`);
console.log('');
console.log('You can use this payload with the Vapi API:');
console.log('POST https://api.vapi.ai/assistant');
console.log('Authorization: Bearer YOUR_API_KEY');
console.log('');

// Try to make API call if we have a valid key
async function createAssistant() {
  console.log('Attempting to create assistant via API...');
  
  const postData = JSON.stringify(assistantPayload);
  
  const options = {
    hostname: 'api.vapi.ai',
    port: 443,
    path: '/assistant',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`API Response Status: ${res.statusCode}`);
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201 || res.statusCode === 200) {
            console.log('✅ Assistant created successfully!');
            console.log('Assistant ID:', response.id);
            resolve(response);
          } else {
            console.log('❌ API Error:', response.message || response.error || data);
            reject(response);
          }
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.log('❌ Request failed:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Only attempt API call if we have credentials
if (VAPI_API_KEY && VAPI_API_KEY.length > 10) {
  createAssistant()
    .then(() => {
      console.log('\n✅ Setup complete!');
    })
    .catch(() => {
      console.log('\n⚠️  API call failed. Please use manual setup via Vapi Dashboard.');
      console.log('Dashboard: https://dashboard.vapi.ai');
    });
} else {
  console.log('⚠️  No valid API key found. Please use manual setup via Vapi Dashboard.');
  console.log('Dashboard: https://dashboard.vapi.ai');
}
