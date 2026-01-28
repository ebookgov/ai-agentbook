-- Run this in the Supabase SQL Editor to setup the RAG pipeline

-- 1. Enable vector extension
create extension if not exists vector;

-- 2. Create knowledge_chunks table for HuggingFace embeddings (384 dimensions)
create table if not exists public.knowledge_chunks (
    id uuid primary key default gen_random_uuid(),
    source_file text not null,
    chunk_index integer not null,
    content text not null,
    embedding vector(384), -- HuggingFace all-MiniLM-L6-v2
    metadata jsonb default '{}'::jsonb,
    content_hash text, -- For tracking file changes
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(source_file, chunk_index)
);

-- Indexes for performance
create index if not exists idx_knowledge_chunks_embedding on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_knowledge_chunks_metadata on public.knowledge_chunks using gin (metadata);
create index if not exists idx_knowledge_chunks_source on public.knowledge_chunks(source_file);

-- 3. Create match_knowledge function for vector search RPC
create or replace function match_knowledge (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;
