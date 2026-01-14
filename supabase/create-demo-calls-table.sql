-- ============================================================
-- EbookGov AI Demo - Supabase Table Creation Script
-- Run this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/byllwcxvbxybaawrilec/sql/new
-- ============================================================

-- Table for storing all AI demo calls and bookings
CREATE TABLE IF NOT EXISTS public.demo_calls (
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
CREATE INDEX IF NOT EXISTS idx_demo_calls_call_id ON public.demo_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_demo_calls_created_at ON public.demo_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_calls_caller_phone ON public.demo_calls(caller_phone);

-- Add comment for documentation
COMMENT ON TABLE public.demo_calls IS 'Stores all EbookGov AI demo agent calls, bookings, and transfer requests';

-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'demo_calls' 
ORDER BY ordinal_position;
