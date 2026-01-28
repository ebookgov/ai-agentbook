-- ============================================================
-- 🛡️ SECURITY HARDENING MIGRATION (FIXED ORDER)
-- DATE: 2026-01-26
-- DESCRIPTION: Creates tables FIRST, then enables RLS and policies.
-- ============================================================

-- 1. Create Extension (Required for vector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Tables (IF NOT EXISTS)
-- We define them first to ensure RLS policies have a target.

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

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT UNIQUE NOT NULL,
    user_email TEXT,
    plan_id TEXT,
    status TEXT,
    start_time TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC,
    price_formatted TEXT,
    acreage TEXT,
    location JSONB,
    features JSONB,
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

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB DEFAULT '{}'::jsonb,
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_file, chunk_index)
);

-- 3. Enable RLS on all tables
ALTER TABLE public.demo_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 4. Create Service Role Policies (Full Access)

-- Policy for demo_calls
DROP POLICY IF EXISTS "Service Role Full Access" ON public.demo_calls;
CREATE POLICY "Service Role Full Access" ON public.demo_calls
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for subscriptions
DROP POLICY IF EXISTS "Service Role Full Access" ON public.subscriptions;
CREATE POLICY "Service Role Full Access" ON public.subscriptions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for properties
DROP POLICY IF EXISTS "Service Role Full Access" ON public.properties;
CREATE POLICY "Service Role Full Access" ON public.properties
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for knowledge_chunks
DROP POLICY IF EXISTS "Service Role Full Access" ON public.knowledge_chunks;
CREATE POLICY "Service Role Full Access" ON public.knowledge_chunks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Public/Anon Policies (DENY BY DEFAULT IMPLICITLY)
-- Explicitly adding read-only access for properties:
DROP POLICY IF EXISTS "Public Read Properties" ON public.properties;
CREATE POLICY "Public Read Properties" ON public.properties
    FOR SELECT
    TO anon, authenticated
    USING (status = 'active');

-- 6. Indexes (Performance)
CREATE INDEX IF NOT EXISTS idx_demo_calls_call_id ON public.demo_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_properties_id ON public.properties(property_id);
-- For knowledge_chunks, we use ivfflat for vector search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 7. Functions
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
