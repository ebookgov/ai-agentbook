-- ============================================================
-- 🛡️ MIGRATION: UPGRADE KNOWLEDGE SCHEMA (384D + STRICT TYPING)
-- DATE: 2026-01-27
-- DESCRIPTION: Creates the production-grade knowledge table with
--              validators, RLS, and HNSW indexes.
--              Configured for Local/Free embeddings (384 dims).
-- ============================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Table
CREATE TABLE IF NOT EXISTS public.arizona_land_assistant_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Categorization (Optimized for filtering)
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    
    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT NOT NULL,
    
    -- Metadata / Legal Context
    jurisdiction TEXT NOT NULL,
    authority TEXT,
    related_statute TEXT,
    
    -- Vector Embedding (HuggingFace/Local - Free)
    content_vector vector(384),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT type_enum_check CHECK (
        type IN ('agent_identity', 'compliance_guardrail', 'disclosure_item', 'mandatory_notice', 'faq', 'guide')
    ),
    CONSTRAINT title_length_check CHECK (char_length(title) <= 200),
    CONSTRAINT content_length_check CHECK (char_length(content) >= 10),
    CONSTRAINT statute_format_check CHECK (
        related_statute IS NULL OR 
        related_statute ~ '^[A-Z]+\.R\.S\. § [0-9-]+.*$'
    )
);

-- 3. Row Level Security (RLS)
ALTER TABLE public.arizona_land_assistant_knowledge ENABLE ROW LEVEL SECURITY;

-- Policy: Service Role (Full Access)
DROP POLICY IF EXISTS "Service Role Full Access" ON public.arizona_land_assistant_knowledge;
CREATE POLICY "Service Role Full Access" ON public.arizona_land_assistant_knowledge
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated/Anon Read Access (For RAG usage)
-- We allow reading all rows.
DROP POLICY IF EXISTS "Public Read Knowledge" ON public.arizona_land_assistant_knowledge;
CREATE POLICY "Public Read Knowledge" ON public.arizona_land_assistant_knowledge
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4. Indexes (Performance)

-- HNSW Index for Vectors (High Performance for >10k rows)
-- Standard recommendation: m=16, ef_construction=64
CREATE INDEX IF NOT EXISTS idx_az_knowledge_vector 
    ON public.arizona_land_assistant_knowledge 
    USING hnsw (content_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Structural Indexes
CREATE INDEX IF NOT EXISTS idx_az_knowledge_type_category 
    ON public.arizona_land_assistant_knowledge (type, category);

CREATE INDEX IF NOT EXISTS idx_az_knowledge_jurisdiction 
    ON public.arizona_land_assistant_knowledge (jurisdiction);

CREATE INDEX IF NOT EXISTS idx_az_knowledge_statute 
    ON public.arizona_land_assistant_knowledge (related_statute);

CREATE INDEX IF NOT EXISTS idx_az_knowledge_source 
    ON public.arizona_land_assistant_knowledge (source_url);

-- 5. Triggers (Data Integrity)

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger execution
DROP TRIGGER IF EXISTS set_updated_at ON public.arizona_land_assistant_knowledge;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.arizona_land_assistant_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Comment on table
COMMENT ON TABLE public.arizona_land_assistant_knowledge IS 
'Production knowledge base for Arizona Land Assistant. Contains 384d embeddings (Local/Free) and strict metadata validation.';

-- 6. RPC Function for Vector Search
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
    k.id,
    k.content,
    -- Construct metadata object for frontend/edge-function compatibility
    jsonb_build_object(
        'title', k.title,
        'type', k.type,
        'category', k.category,
        'jurisdiction', k.jurisdiction,
        'authority', k.authority,
        'related_statute', k.related_statute,
        'source_url', k.source_url
    ) as metadata,
    1 - (k.content_vector <=> query_embedding) AS similarity
  FROM public.arizona_land_assistant_knowledge k
  WHERE 1 - (k.content_vector <=> query_embedding) > match_threshold
  ORDER BY k.content_vector <=> query_embedding
  LIMIT match_count;
END;
$$;
