/**
 * EbookGov AI Squad Deployment Script - Fixed Version
 * 
 * This version:
 * 1. Creates 4 standalone assistants first
 * 2. Then creates the Squad referencing them by ID
 * 
 * Usage: node vapi/create-squad-v2.js
 */

require('dotenv').config({ path: './.env' });
const fs = require('fs');
const path = require('path');

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY?.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '').trim();
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://ai-agentbook.onrender.com/api/vapi/webhook';

if (!VAPI_API_KEY) {
  console.error('❌ VAPI_PRIVATE_KEY not found in .env');
  process.exit(1);
}

// Load squad config
const squadConfigPath = path.join(__dirname, 'squad-config.json');
const squadConfig = JSON.parse(fs.readFileSync(squadConfigPath, 'utf8'));

// Create a single assistant via API
async function createAssistant(assistantConfig, isFirstMember = false) {
  const assistant = assistantConfig.assistant;
  
  // Build function tools (not handoff - those go on squad level)
  const tools = [];
  for (const tool of (assistant.model.tools || [])) {
    if (tool.type === 'function') {
      tools.push({
        type: 'function',
        function: tool.function,
        server: {
          url: WEBHOOK_URL
        }
      });
    }
  }
  
  const payload = {
    name: assistant.name,
    model: {
      provider: assistant.model.provider,
      model: assistant.model.model,
      temperature: assistant.model.temperature,
      maxTokens: assistant.model.maxTokens,
      messages: assistant.model.messages,
      ...(tools.length > 0 ? { tools } : {})
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
    // Server URL for function calls
    serverUrl: WEBHOOK_URL,
    // First message only for first member
    ...(isFirstMember && assistant.firstMessage ? { firstMessage: assistant.firstMessage } : {}),
    // Latency optimizations
    responseDelaySeconds: 0,
    llmRequestDelaySeconds: 0,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600
  };

  try {
    // Check if assistant already exists
    const listResponse = await fetch('https://api.vapi.ai/assistant', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    const existingAssistants = await listResponse.json();
    const existing = existingAssistants.find(a => a.name === assistant.name);
    
    if (existing) {
      console.log(`   📝 Updating existing assistant: ${assistant.name} (${existing.id})`);
      
      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${existing.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        console.error(`   ❌ Failed to update ${assistant.name}:`, error);
        return null;
      }
      
      const data = await updateResponse.json();
      console.log(`   ✅ Updated: ${data.id}`);
      return data;
    }
    
    // Create new assistant
    console.log(`   🆕 Creating assistant: ${assistant.name}`);
    
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`   ❌ Failed to create ${assistant.name}:`, error);
      return null;
    }

    const data = await response.json();
    console.log(`   ✅ Created: ${data.id}`);
    return data;

  } catch (error) {
    console.error(`   ❌ Error with ${assistant.name}:`, error.message);
    return null;
  }
}

// Extract handoff destinations for a member
function getHandoffDestinations(assistantConfig, assistantIdMap) {
  const destinations = [];
  
  for (const tool of (assistantConfig.assistant.model.tools || [])) {
    if (tool.type === 'handoff' && tool.destinations) {
      for (const dest of tool.destinations) {
        if (dest.type === 'assistant') {
          const targetId = assistantIdMap[dest.assistantName];
          if (targetId) {
            destinations.push({
              type: 'assistant',
              assistantId: targetId,
              description: dest.description
            });
          }
        }
      }
    }
  }
  
  return destinations;
}

// Delete existing squad
async function deleteExistingSquad(name) {
  try {
    const listResponse = await fetch('https://api.vapi.ai/squad', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    const squads = await listResponse.json();
    const existing = squads.find(s => s.name === name);
    
    if (existing) {
      console.log(`\n🗑️  Deleting existing Squad: ${existing.id}`);
      await fetch(`https://api.vapi.ai/squad/${existing.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
      });
      console.log('   ✅ Deleted');
    }
  } catch (error) {
    console.log('   ⚠️  Could not delete existing squad:', error.message);
  }
}

// Create Squad with assistant references
async function createSquad(assistantIdMap) {
  // Delete existing squad first
  await deleteExistingSquad(squadConfig.name);
  
  const members = squadConfig.members.map((member, index) => {
    const assistantId = assistantIdMap[member.assistant.name];
    const destinations = getHandoffDestinations(member, assistantIdMap);
    
    return {
      assistantId: assistantId,
      ...(destinations.length > 0 ? { assistantDestinations: destinations } : {})
    };
  });

  const payload = {
    name: squadConfig.name,
    members: members
  };

  console.log('\n📦 Creating Squad with member IDs:');
  members.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.assistantId}`);
    if (m.assistantDestinations) {
      m.assistantDestinations.forEach(d => console.log(`      → ${d.assistantId}`));
    }
  });

  try {
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
      console.error('\n❌ Failed to create Squad:', data);
      return null;
    }

    console.log('\n✅ Squad created successfully!');
    console.log(`   Squad ID: ${data.id}`);
    
    // Save squad ID
    fs.writeFileSync(path.join(__dirname, 'squad-id.txt'), data.id);
    
    return data;

  } catch (error) {
    console.error('\n❌ Error creating Squad:', error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EbookGov AI Squad Deployment (Fixed)');
  console.log('═══════════════════════════════════════════\n');
  
  // Step 1: Create all assistants
  console.log('📋 Step 1: Creating/Updating Assistants\n');
  
  const assistantIdMap = {};
  
  for (let i = 0; i < squadConfig.members.length; i++) {
    const member = squadConfig.members[i];
    const result = await createAssistant(member, i === 0);
    
    if (result) {
      assistantIdMap[member.assistant.name] = result.id;
    } else {
      console.error(`\n❌ Failed to create ${member.assistant.name}. Aborting.`);
      process.exit(1);
    }
  }
  
  console.log('\n📋 Assistant ID Map:');
  for (const [name, id] of Object.entries(assistantIdMap)) {
    console.log(`   ${name}: ${id}`);
  }
  
  // Step 2: Create Squad
  console.log('\n📋 Step 2: Creating Squad\n');
  
  const squad = await createSquad(assistantIdMap);
  
  if (squad) {
    console.log('\n═══════════════════════════════════════════');
    console.log('  ✅ DEPLOYMENT COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log(`\n   Squad ID: ${squad.id}`);
    console.log('\n📞 Next Steps:');
    console.log('   1. Go to https://dashboard.vapi.ai/phone-numbers');
    console.log('   2. Click on your phone number');
    console.log('   3. Under "Inbound", select "Squad"');
    console.log(`   4. Select "${squadConfig.name}"`);
    console.log('   5. Save changes');
    console.log('');
  }
}

main();
