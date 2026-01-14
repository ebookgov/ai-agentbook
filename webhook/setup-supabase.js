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
      console.error('Error checking table:', checkError.message);
    } else {
      console.log('✅ Table "demo_calls" exists and is accessible!');
      console.log('Current record count:', existingTable?.length || 0);
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
