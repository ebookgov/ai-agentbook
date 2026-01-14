/**
 * EbookGov AI Squad Deployment Script
 * Creates the multi-assistant Squad in Vapi via API
 * 
 * Usage: node vapi/create-squad.js
 */

require('dotenv').config({ path: './.env' });
const fs = require('fs');
const path = require('path');

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY?.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '').trim();
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://susanna-unfed-nathaly.ngrok-free.dev/api/vapi/webhook';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_PRIVATE_KEY not found in .env');
  process.exit(1);
}

// Load squad config
const squadConfigPath = path.join(__dirname, 'squad-config.json');
const squadConfig = JSON.parse(fs.readFileSync(squadConfigPath, 'utf8'));

// Transform squad config to Vapi API format
function buildSquadPayload() {
  return {
    name: squadConfig.name,
    members: squadConfig.members.map((member, index) => {
      const assistant = member.assistant;
      
      return {
        assistant: {
          name: assistant.name,
          model: {
            provider: assistant.model.provider,
            model: assistant.model.model,
            temperature: assistant.model.temperature,
            maxTokens: assistant.model.maxTokens,
            messages: assistant.model.messages
          },
          voice: {
            provider: assistant.voice.provider,
            voiceId: assistant.voice.voiceId,
            stability: assistant.voice.stability,
            similarityBoost: assistant.voice.similarityBoost
          },
          transcriber: {
            provider: assistant.transcriber.provider,
            model: assistant.transcriber.model,
            language: assistant.transcriber.language
          },
          // Add server URL for function calls
          server: {
            url: WEBHOOK_URL
          },
          // First member gets the first message
          ...(index === 0 && assistant.firstMessage ? { firstMessage: assistant.firstMessage } : {}),
          // Latency optimizations
          responseDelaySeconds: 0,
          llmRequestDelaySeconds: 0,
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 600
        },
        // Transfer destinations (handoff tools)
        assistantDestinations: extractHandoffDestinations(assistant.model.tools || [])
      };
    })
  };
}

// Extract handoff destinations from tools
function extractHandoffDestinations(tools) {
  const destinations = [];
  
  for (const tool of tools) {
    if (tool.type === 'handoff' && tool.destinations) {
      for (const dest of tool.destinations) {
        if (dest.type === 'assistant') {
          destinations.push({
            type: 'assistant',
            assistantName: dest.assistantName,
            message: dest.description,
            description: dest.description
          });
        }
      }
    }
  }
  
  return destinations;
}

// Create Squad via Vapi API
async function createSquad() {
  const payload = buildSquadPayload();
  
  console.log('📦 Squad Configuration:');
  console.log(`   Name: ${payload.name}`);
  console.log(`   Members: ${payload.members.length}`);
  payload.members.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.assistant.name}`);
    if (m.assistantDestinations?.length > 0) {
      m.assistantDestinations.forEach(d => console.log(`      → ${d.assistantName}`));
    }
  });
  console.log('');

  try {
    console.log('🚀 Creating Squad in Vapi...');
    
    const response = await fetch('https://api.vapi.ai/squad', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to create Squad:', data);
      
      // If squad exists, try to update it
      if (data.message?.includes('already exists') || response.status === 409) {
        console.log('ℹ️  Squad may already exist. Attempting to list squads...');
        return await listAndUpdateSquad(payload);
      }
      
      process.exit(1);
    }

    console.log('✅ Squad created successfully!');
    console.log(`   Squad ID: ${data.id}`);
    console.log(`   Created: ${data.createdAt}`);
    console.log('');
    console.log('📞 Next Steps:');
    console.log('   1. Go to https://dashboard.vapi.ai/phone-numbers');
    console.log('   2. Click on your phone number (+19287230429)');
    console.log('   3. Under "Inbound", select "Squad" instead of "Assistant"');
    console.log(`   4. Select "${payload.name}" from the dropdown`);
    console.log('   5. Save changes');
    
    // Save squad ID for reference
    fs.writeFileSync(
      path.join(__dirname, 'squad-id.txt'),
      data.id
    );
    
    return data;

  } catch (error) {
    console.error('❌ Error creating Squad:', error.message);
    process.exit(1);
  }
}

// List existing squads and update if needed
async function listAndUpdateSquad(payload) {
  try {
    const listResponse = await fetch('https://api.vapi.ai/squad', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const squads = await listResponse.json();
    const existingSquad = squads.find(s => s.name === payload.name);
    
    if (existingSquad) {
      console.log(`📝 Found existing Squad: ${existingSquad.id}`);
      console.log('   Updating Squad...');
      
      const updateResponse = await fetch(`https://api.vapi.ai/squad/${existingSquad.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const updateData = await updateResponse.json();
      
      if (!updateResponse.ok) {
        console.error('❌ Failed to update Squad:', updateData);
        process.exit(1);
      }
      
      console.log('✅ Squad updated successfully!');
      console.log(`   Squad ID: ${updateData.id}`);
      
      fs.writeFileSync(
        path.join(__dirname, 'squad-id.txt'),
        updateData.id
      );
      
      return updateData;
    }
    
    console.log('⚠️  No existing squad found with that name.');
    return null;
    
  } catch (error) {
    console.error('❌ Error listing/updating Squad:', error.message);
    process.exit(1);
  }
}

// Run
createSquad();
