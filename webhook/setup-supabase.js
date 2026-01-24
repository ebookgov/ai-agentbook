/**
 * Supabase Setup Script
 * Run this once to create the demo_calls table
 * Usage: node setup-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_ACCESS_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_ACCESS_SECRET_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('Setting up Supabase database...\n');
  console.log('Project URL:', supabaseUrl);

  try {
    // Test connection by checking if table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('demo_calls')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('Table "demo_calls" does not exist. Please create it via Supabase Dashboard.\n');
      console.log('Go to: https://supabase.com/dashboard/project/byllwcxvbxybaawrilec/sql/new');
      console.log('\nRun this SQL:\n');
      console.log(`
-- Table for storing all AI demo calls and bookings
CREATE TABLE public.demo_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id TEXT UNIQUE NOT NULL,
    caller_name TEXT,
    caller_phone TEXT,
    property_id TEXT,
    property_name TEXT,
    preferred_date TEXT,
    preferred_time TEXT,
    call_status TEXT DEFAULT 'in_progress',
    booking_confirmed BOOLEAN DEFAULT FALSE,
    transfer_requested BOOLEAN DEFAULT FALSE,
    transfer_completed BOOLEAN DEFAULT FALSE,
    call_duration_seconds INTEGER,
    call_transcript TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_demo_calls_call_id ON public.demo_calls(call_id);
CREATE INDEX idx_demo_calls_created_at ON public.demo_calls(created_at DESC);
CREATE INDEX idx_demo_calls_caller_phone ON public.demo_calls(caller_phone);

-- Add comment for documentation
COMMENT ON TABLE public.demo_calls IS 'Stores all AI demo agent calls for EbookGov Real Estate Agent';
      `);
    } else if (checkError) {
      console.error('Error checking table "demo_calls":', checkError.message);
    } else {
      console.log('✅ Table "demo_calls" exists.');
    }

    // ---------------------------------------------------------
    // 2. Setup 'subscriptions' table
    // ---------------------------------------------------------
    const { error: subCheckError } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);

    if (subCheckError && subCheckError.code === '42P01') {
      console.log('\nCreating table "subscriptions"...');
      // Note: In a real Supabase setup, we'd run raw SQL via the dashboard or a migration tool.
      // Since the JS client can't run DDL, we'll log the SQL for the user.
      console.log('⚠️  Table "subscriptions" does not exist. Please run this SQL in Supabase Dashboard:');
      console.log(`
-- Table for storing PayPal subscriptions
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT UNIQUE NOT NULL,
    user_email TEXT,
    plan_id TEXT,
    status TEXT, -- active, cancelled, suspended, past_due
    start_time TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_sub_id ON public.subscriptions(subscription_id);
CREATE INDEX idx_subscriptions_email ON public.subscriptions(user_email);
      `);
    } else if (subCheckError) {
      console.error('Error checking table "subscriptions":', subCheckError.message);
    } else {
      console.log('✅ Table "subscriptions" exists.');
    }

    // ---------------------------------------------------------
    // 3. Setup 'properties' table
    // ---------------------------------------------------------
    const { error: propCheckError } = await supabase
      .from('properties')
      .select('id')
      .limit(1);

    if (propCheckError && propCheckError.code === '42P01') {
      console.log('\nCreating table "properties"...');
      console.log('⚠️  Table "properties" does not exist. Please run this SQL in Supabase Dashboard:');
      console.log(`
-- Table for real estate properties
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC,
    price_formatted TEXT,
    acreage TEXT,
    location JSONB, -- { city, state, zip, address }
    features JSONB, -- { bedrooms, bathrooms, sqft, structure }
    highlights TEXT[],
    financing JSONB,
    water_rights JSONB,
    solar_lease JSONB,
    hoa JSONB,
    tax_info JSONB,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_id ON public.properties(property_id);
CREATE INDEX idx_properties_name ON public.properties USING GIN (to_tsvector('english', name));
      `);
    } else if (propCheckError) {
      console.error('Error checking table "properties":', propCheckError.message);
    } else {
      console.log('✅ Table "properties" exists.');
    }

    // Test insert
    console.log('\nTesting insert...');
    const testRecord = {
      call_id: `TEST-${Date.now()}`,
      caller_name: 'Test User',
      caller_phone: '+1-555-TEST',
      property_id: 'AZ-FLAG-001',
      property_name: 'Test Property',
      call_status: 'test'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('demo_calls')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.error('Insert test failed:', insertError.message);
      if (insertError.code === '42P01') {
        console.log('\n⚠️  Please create the table first using the SQL above.');
      }
    } else {
      console.log('✅ Insert test successful!');
      console.log('Test record ID:', insertData[0]?.id);

      // Clean up test record
      await supabase.from('demo_calls').delete().eq('call_id', testRecord.call_id);
      console.log('✅ Test record cleaned up.');
    }

    console.log('\n✅ Supabase setup complete!');

  } catch (error) {
    console.error('Setup error:', error.message);
  }
}

setupDatabase();
