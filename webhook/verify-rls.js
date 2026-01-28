/**
 * Verify RLS Security
 * Usage: node verify-rls.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_TOKEN; // checking ANON access
const supabaseServiceKey = process.env.SUPABASE_ACCESS_SECRET_KEY; // checking ADMIN access

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing credentials in .env');
  process.exit(1);
}

// Client 1: Anonymous User (Should be blocked from internal tables)
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Client 2: Service Role (Should have full access)
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function verifySecurity() {
  console.log('🛡️  Verifying RLS Policies...\n');

  // Test 1: Public access to 'demo_calls' (Should FAIL)
  console.log('TEST 1: Anonymous Access to "demo_calls"...');
  const { data: publicData, error: publicError } = await anonClient
    .from('demo_calls')
    .select('*')
    .limit(1);

  if (publicError) {
    console.log('   ✅ PASS: Error received as expected (Access Denied).');
  } else if (publicData.length === 0) {
    console.log('   ❓ PASS/WARN: No data returned. (Could be empty table or RLS hiding rows).');
  } else {
    console.log('   ❌ FAIL: Anonymous user could read data!');
  }

  // Test 2: Service Role access to 'demo_calls' (Should SUCCEED)
  console.log('\nTEST 2: Service Role Access to "demo_calls"...');
  const { data: adminData, error: adminError } = await adminClient
    .from('demo_calls')
    .select('*')
    .limit(1);

  if (adminError) {
    console.log('   ❌ FAIL: Service role blocked:', adminError.message);
  } else {
    console.log('   ✅ PASS: Service role has access.');
  }

  // Test 3: Public access to 'properties' (Should SUCCEED for active items)
  console.log('\nTEST 3: Anonymous Access to "properties"...');
  const { error: propError } = await anonClient
    .from('properties')
    .select('*')
    .limit(1);

  if (propError) {
    console.log('   ❌ FAIL: Properties should be public read-only:', propError.message);
  } else {
    console.log('   ✅ PASS: Public can read properties.');
  }

  console.log('\n🏁 Verification Complete.');
}

verifySecurity();
