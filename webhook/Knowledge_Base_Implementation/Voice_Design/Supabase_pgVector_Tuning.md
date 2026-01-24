Supabase Vector RAG Implementation Manifest
A comprehensive guide to building a high-performance Retrieval Augmented Generation system with Supabase.

Architectural Summary
Index Strategy
The primary index for vector data leverages HNSW (Hierarchical Navigable Small World) due to its superior query latency (1.5-2.4ms), throughput (40.5 QPS), recall (0.99+), and stability, significantly outperforming IVFFlat. Recommended HNSW configuration includes m=32 (connections per node) for balanced recall and speed, and ef_construction=64-128 for accurate index building. During query time, ef_search is adjustable to balance speed and recall, with a baseline of 100 recommended for voice RAG. Partial indexes optimize searches on filtered data (e.g., by metadata topic), reducing search space. Storage optimization considers pgvector_float4 and dimension reduction (e.g., 1536 to 256 for text-embedding-3-small) for cost and memory efficiency with minimal recall trade-off.

Hybrid Search Methodology
Our approach fuses semantic vector search (HNSW) with traditional Full-Text Search (FTS) and metadata filtering, primarily using Reciprocal Rank Fusion (RRF). Vector search operates on embedding columns for semantic similarity. FTS is implemented via PostgreSQL's built-in text search with GIN indexes on content_tsv, supporting various query types and custom dictionaries. Metadata filtering pre-filters data based on fields like topic before vector search, enhancing performance. RRF combines results using the formula 1/(k + vector_rank) + 1/(k + fts_rank), where the k parameter is tuned (default 60, test 40 for vector bias, 80 for emphasizing vector results when FTS is noisy) to optimize relevance@3.

Latency Budget
The overall target is sub-100ms latency for voice RAG. Database query execution is projected at 8-9ms (2.4ms vector, 5ms FTS, 0.5ms RRF). Supabase query execution, including gateway overhead, averages 38ms. OpenAI Embedding API calls add approximately 52ms (dominated by network roundtrip). Edge Function cold starts add ~50ms but are mitigated by keep-alive cron jobs. Query latency scales linearly with dataset size for HNSW. Caching is crucial: cache hits are <10ms, misses ~100ms. Scaling impacts are managed through Redis caching, partitioning, and read replicas for higher query volumes. P95 latency exceeding 100-150ms indicates immediate attention is required.

JSON Blueprint
This outlines the file structure and key methods for the RAG implementation across various components.

{
  "property">"supabase": {
    "property">"migrations": {
      "property">"V1__initial_setup.sql": {
        // Database schema, extensions, indexes, core RAG search functions.
        "property">"description": "Core database setup",
        "property">"methods": [
          "CREATE EXTENSION vector, unaccent, pgcrypto",
          "CREATE TABLE knowledge_chunks",
          "CREATE INDEX knowledge_chunks_embedding_hnsw",
          "CREATE TEXT SEARCH CONFIGURATION",
          "CREATE OR REPLACE FUNCTION rpc_hybrid_search_documents"
        ]
      }
    },
    "property">"pg_config_tuning.sql": {
      // PostgreSQL server configuration for performance tuning.
      "property">"description": "PostgreSQL tuning settings",
      "property">"methods": [
        "ALTER SYSTEM SET hnsw.ef_search = 100",
        "shared_buffers", "maintenance_work_mem"
      ]
    },
    "property">"functions": {
      "property">"rag-query": {
        "property">"index.ts": {
          // Supabase Edge Function: main RAG API endpoint.
          "property">"description": "Main RAG API",
          "property">"methods": [
            "handleRequest", "checkQueryCache", "getOpenAIEmbedding",
            "callHybridSearchRpc", "callLLMApi", "storeQueryCache"
          ]
        }
      },
      "property">"keep-alive": {
        "property">"index.ts": {
          // Supabase Edge Function: cold start mitigation.
          "property">"description": "Cold start mitigation",
          "property">"methods": [ "handleRequest", "pingRagQueryFunction" ]
        }
      }
    },
    "property">"admin": {
        "property">"cache_management.sql": {
            // SQL scripts for managing the query cache.
            "property">"description": "Cache management SQL",
            "property">"methods": [
                "TRUNCATE TABLE query_cache",
                "DELETE FROM query_cache WHERE last_accessed < NOW() - INTERVAL '30 days'"
            ]
        }
    }
  },
  "property">"scripts": {
    "property">"ingest_documents.ts": {
      // Local script for document processing, embedding, ingestion.
      "property">"description": "Document ingestion pipeline",
      "property">"methods": [
        "mainIngestionPipeline", "loadAndChunkDocuments",
        "generateBatchEmbeddings", "upsertKnowledgeChunks"
      ]
    }
  },
  "property">"utils": {
    "property">"openai_client.ts": {
      // Utility for interacting with OpenAI API.
      "property">"description": "OpenAI API client",
      "property">"methods": [ "initializeOpenAIClient", "createEmbedding" ]
    },
    "property">"supabase_client.ts": {
      // Centralized Supabase client initialization.
      "property">"description": "Supabase client utility",
      "property">"methods": [ "getSupabaseClient" ]
    }
  },
  "property">"config": {
    "property">"rag_parameters.ts": {
      // Configuration file for HNSW, FTS, RRF tuning.
      "property">"description": "RAG tuning parameters",
      "property">"constants": [
        "HNSW_M_DEFAULT", "HNSW_EF_SEARCH_BALANCED",
        "RRF_K_BALANCED", "OPENAI_EMBEDDING_MODEL"
      ]
    }
  }
}

SQL Code Module
This module defines the database schema, indexes, and functions for the RAG system.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS 'vector' WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS 'pgcrypto' WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS 'uuid-ossp' WITH SCHEMA public;

-- Table: public.knowledge_chunks
CREATE TABLE public.knowledge_chunks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text NOT NULL,
    embedding vector(1536) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    content_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(content, ''))
    ) STORED,
    source_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for knowledge_chunks
CREATE INDEX knowledge_chunks_embedding_hnsw ON public.knowledge_chunks
USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 64);

CREATE INDEX knowledge_chunks_content_tsv_gin ON public.knowledge_chunks
USING gin (content_tsv) WITH (fastupdate = ON);

-- Partial HNSW index for specific metadata filtering
CREATE INDEX knowledge_chunks_embedding_water_rights_hnsw ON public.knowledge_chunks
USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 64)
WHERE (metadata->>'topic') = 'water_rights';

-- Trigger for updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at_on_knowledge_chunks()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER set_updated_at_on_knowledge_chunks
BEFORE UPDATE ON public.knowledge_chunks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_on_knowledge_chunks();

-- Text Search Tuning Example
CREATE TEXT SEARCH DICTIONARY public.water_dict (
    TEMPLATE = simple,
    STOPWORDS = 'english'
);
CREATE TEXT SEARCH CONFIGURATION public.water_config (
    COPY = english
);
ALTER TEXT SEARCH CONFIGURATION public.water_config
ALTER MAPPING FOR asciiword, asciihword, hword, word
WITH public.water_dict;

-- Table: public.query_cache
CREATE TABLE public.query_cache (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash text UNIQUE NOT NULL,
    query_text text NOT NULL,
    answer text NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb,
    confidence float,
    hit_count integer DEFAULT 1,
    last_accessed timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    source_files text[] -- For smart invalidation
);

-- Trigger for query_cache updates (hit_count, last_accessed)
CREATE OR REPLACE FUNCTION public.update_query_cache_trigger_function()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.hit_count = OLD.hit_count + 1;
    NEW.last_accessed = now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER update_query_cache_trigger
BEFORE UPDATE ON public.query_cache
FOR EACH ROW EXECUTE FUNCTION public.update_query_cache_trigger_function();

-- RPC Function: public.match_documents (hybrid search)
CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector(1536),
    query_text text,
    match_count int DEFAULT 10,
    ef_search_param int DEFAULT 100,
    rrf_k_param int DEFAULT 60,
    filter_topic text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float,
    vector_rank int,
    fts_rank int,
    rrf_score float
)
LANGUAGE plpgsql AS $$
DECLARE
    vector_results TABLE (id uuid, content text, metadata jsonb, similarity float, rank int);
    fts_results TABLE (id uuid, content text, metadata jsonb, rank int);
BEGIN
    -- Temporarily set hnsw.ef_search for the session
    EXECUTE format('SET hnsw.ef_search = %L', ef_search_param);

    -- Perform vector search
    INSERT INTO vector_results
    SELECT
        id, content, metadata, 1 - (embedding <=> query_embedding) AS similarity,
        ROW_NUMBER() OVER (ORDER BY (embedding <=> query_embedding)) AS rank
    FROM
        public.knowledge_chunks
    WHERE
        (filter_topic IS NULL OR (metadata->>'topic') = filter_topic)
    ORDER BY embedding <=> query_embedding
    LIMIT match_count * 2; -- Fetch more for RRF

    -- Perform Full-Text Search
    INSERT INTO fts_results
    SELECT
        id, content, metadata,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM
        public.knowledge_chunks
    WHERE
        content_tsv @@ websearch_to_tsquery('english', query_text)
        AND (filter_topic IS NULL OR (metadata->>'topic') = filter_topic)
    ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 2; -- Fetch more for RRF

    -- Combine results using Reciprocal Rank Fusion (RRF)
    RETURN QUERY
    SELECT
        COALESCE(vr.id, fr.id) AS id,
        COALESCE(vr.content, fr.content) AS content,
        COALESCE(vr.metadata, fr.metadata) AS metadata,
        COALESCE(vr.similarity, 0.0) AS similarity,
        COALESCE(vr.rank, 0) AS vector_rank,
        COALESCE(fr.rank, 0) AS fts_rank,
        (1.0 / (rrf_k_param + COALESCE(vr.rank, rrf_k_param + match_count))) +
        (1.0 / (rrf_k_param + COALESCE(fr.rank, rrf_k_param + match_count))) AS rrf_score
    FROM
        vector_results vr
    FULL JOIN
        fts_results fr ON vr.id = fr.id
    ORDER BY rrf_score DESC
    LIMIT match_count;
END;
$$;

-- Row-Level Security (RLS)
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.knowledge_chunks
FOR SELECT TO authenticated, anon USING (TRUE);

ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage cache" ON public.query_cache
FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Cache Management Examples
-- TRUNCATE TABLE public.query_cache;
-- DELETE FROM public.query_cache WHERE 'water_rights.md' = ANY(source_files);

TypeScript Code Module
This module defines the Supabase Edge Function for handling RAG queries, including embedding generation, caching, and hybrid search orchestration.

<span class="comment">// supabase/functions/rag-query/index.ts</span>
<span class=<span class="string">"keyword"</span>>import</span> { createClient } <span class=<span class="string">"keyword"</span>>from</span> <span class="string">'https:<span class="comment">//esm.sh/<span class="decorator">@supabase</span>/supabase-js@<span class="number">2.42</span>.<span class="number">0</span>'</span>;</span>
<span class=<span class="string">"keyword"</span>>import</span> { <span class=<span class="string">"type"</span>>OpenAI</span> } <span class=<span class="string">"keyword"</span>>from</span> <span class="string">'https:<span class="comment">//esm.sh/openai@<span class="number">4.29</span>.<span class="number">0</span>'</span>;</span>
<span class=<span class="string">"keyword"</span>>import</span> { sha256 } <span class=<span class="string">"keyword"</span>>from</span> <span class="string">'https:<span class="comment">//deno.land/std@<span class="number">0.224</span>.<span class="number">0</span>/crypto/sha256.ts'</span>;</span>

<span class=<span class="string">"keyword"</span>>interface</span> <span class=<span class="string">"type"</span>>QueryPayload</span> {
    query: <span class=<span class="string">"type"</span>>string</span>;
    topic?: <span class=<span class="string">"type"</span>>string</span>;
    ef_search?: <span class=<span class="string">"type"</span>>number</span>;
    rrf_k?: <span class=<span class="string">"type"</span>>number</span>;
    limit?: <span class=<span class="string">"type"</span>>number</span>;
}

<span class=<span class="string">"keyword"</span>>interface</span> <span class=<span class="string">"type"</span>>SearchResultChunk</span> {
    id: <span class=<span class="string">"type"</span>>string</span>;
    content: <span class=<span class="string">"type"</span>>string</span>;
    metadata: <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Record</span></span><<span class=<span class="string">"type"</span>>string</span>, <span class=<span class="string">"type"</span>>any</span>>;
    similarity: <span class=<span class="string">"type"</span>>number</span>;
    rrf_score: <span class=<span class="string">"type"</span>>number</span>;
}

<span class=<span class="string">"keyword"</span>>interface</span> <span class=<span class="string">"type"</span>>CachedResult</span> {
    id: <span class=<span class="string">"type"</span>>string</span>;
    query_hash: <span class=<span class="string">"type"</span>>string</span>;
    answer: <span class=<span class="string">"type"</span>>string</span>;
    sources: <span class=<span class="string">"type"</span>>any</span>[];
    confidence: <span class=<span class="string">"type"</span>>number</span>;
    hit_count: <span class=<span class="string">"type"</span>>number</span>;
    last_accessed: <span class=<span class="string">"type"</span>>string</span>;
}

<span class=<span class="string">"keyword"</span>>const</span> <span class=<span class="string">"type"</span>>OPENAI_API_KEY</span> = <span class=<span class="string">"type"</span>>Deno</span>.env.<span class=<span class="string">"keyword"</span>>get</span>(<span class="string">'<span class="type">OPENAI_API_KEY</span>'</span>);
<span class=<span class="string">"keyword"</span>>const</span> <span class=<span class="string">"type"</span>>SUPABASE_URL</span> = <span class=<span class="string">"type"</span>>Deno</span>.env.<span class=<span class="string">"keyword"</span>>get</span>(<span class="string">'<span class="type">SUPABASE_URL</span>'</span>);
<span class=<span class="string">"keyword"</span>>const</span> <span class=<span class="string">"type"</span>>SUPABASE_ANON_KEY</span> = <span class=<span class="string">"type"</span>>Deno</span>.env.<span class=<span class="string">"keyword"</span>>get</span>(<span class="string">'<span class="type">SUPABASE_ANON_KEY</span>'</span>);

<span class=<span class="string">"keyword"</span>>const</span> openai = <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"function"</span>>OpenAI</span>({ apiKey: <span class=<span class="string">"type"</span>>OPENAI_API_KEY</span> });

<span class=<span class="string">"keyword"</span>>async</span> <span class=<span class="string">"keyword"</span>>function</span> <span class=<span class="string">"function"</span>>generateEmbedding</span>(text: <span class=<span class="string">"type"</span>>string</span>): <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Promise</span></span><<span class=<span class="string">"type"</span>>number</span>[]> {
    <span class=<span class="string">"keyword"</span>>const</span> response = <span class=<span class="string">"keyword"</span>>await</span> openai.embeddings.<span class=<span class="string">"function"</span>>create</span>({
        model: <span class="string">"text-embedding-<span class="number">3</span>-small"</span>,
        input: text,
        dimensions: <span class="number">1536</span>,
    });
    <span class=<span class="string">"keyword"</span>>return</span> response.data[<span class="number">0</span>].embedding;
}

<span class=<span class="string">"keyword"</span>>function</span> <span class=<span class="string">"function"</span>>generateQueryHash</span>(query: <span class=<span class="string">"type"</span>>string</span>, topic?: <span class=<span class="string">"type"</span>>string</span>, ef_search?: <span class=<span class="string">"type"</span>>number</span>, rrf_k?: <span class=<span class="string">"type"</span>>number</span>): <span class=<span class="string">"type"</span>>string</span> {
    <span class=<span class="string">"keyword"</span>>const</span> payload = <span class=<span class="string">"type"</span>>JSON</span>.<span class=<span class="string">"function"</span>>stringify</span>({ query, topic, ef_search, rrf_k });
    <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"function"</span>>sha256</span>(payload).<span class=<span class="string">"function"</span>>toString</span>();
}

@<span class=<span class="string">"type"</span>>Deno</span>.<span class=<span class="string">"function"</span>>serve</span>({ port: <span class="number">8000</span> })
<span class=<span class="string">"keyword"</span>>async</span> <span class=<span class="string">"keyword"</span>>function</span> <span class=<span class="string">"function"</span>>handler</span>(req: <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Request</span></span>): <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Promise</span></span><<span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Response</span></span>> {
    <span class="comment">// <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Set</span></span> <span class=<span class="string">"type"</span>>CORS</span> headers</span>
    <span class=<span class="string">"keyword"</span>>const</span> headers = {
        <span class="string">'<span class="type">Access</span>-<span class="type">Control</span>-<span class="type">Allow</span>-<span class="type">Origin</span>'</span>: <span class="string">'*'</span>,
        <span class="string">'<span class="type">Access</span>-<span class="type">Control</span>-<span class="type">Allow</span>-<span class="type">Headers</span>'</span>: <span class="string">'authorization, x-client-info, apikey, content-<span class="keyword">type</span>'</span>,
        <span class="string">'<span class="type">Content</span>-<span class="type">Type</span>'</span>: <span class="string">'application/json'</span>,
    };

    <span class="comment">// <span class=<span class="string">"type"</span>>Handle</span> <span class=<span class="string">"type"</span>>CORS</span> preflight request</span>
    <span class=<span class="string">"keyword"</span>>if</span> (req.method === <span class="string">'<span class="type">OPTIONS</span>'</span>) {
        <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Response</span></span>(<span class="string">'ok'</span>, { headers });
    }

    <span class=<span class="string">"keyword"</span>>try</span> {
        <span class=<span class="string">"keyword"</span>>if</span> (!<span class=<span class="string">"type"</span>>OPENAI_API_KEY</span> || !<span class=<span class="string">"type"</span>>SUPABASE_URL</span> || !<span class=<span class="string">"type"</span>>SUPABASE_ANON_KEY</span>) {
            <span class=<span class="string">"keyword"</span>>throw</span> <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Error</span></span>(<span class="string">"<span class="</span>type<span class="string">">Missing</span> environment variables."</span>);
        }

        <span class=<span class="string">"keyword"</span>>const</span> supabaseClient = <span class=<span class="string">"function"</span>>createClient</span>(
            <span class=<span class="string">"type"</span>>SUPABASE_URL</span>,
            <span class=<span class="string">"type"</span>>SUPABASE_ANON_KEY</span>
        );

        <span class=<span class="string">"keyword"</span>>const</span> { query, topic, ef_search, rrf_k, limit } = <span class=<span class="string">"keyword"</span>>await</span> req.<span class=<span class="string">"function"</span>>json</span>() <span class=<span class="string">"keyword"</span>>as</span> <span class=<span class="string">"type"</span>>QueryPayload</span>;

        <span class=<span class="string">"keyword"</span>>const</span> queryHash = <span class=<span class="string">"function"</span>>generateQueryHash</span>(query, topic, ef_search, rrf_k);

        <span class="comment">// <span class="number">1</span>. <span class=<span class="string">"type"</span>>Check</span> <span class=<span class="string">"type"</span>>Query</span> <span class=<span class="string">"type"</span>>Cache</span></span>
        <span class=<span class="string">"keyword"</span>>const</span> { data: cachedResults } = <span class=<span class="string">"keyword"</span>>await</span> supabaseClient
            .<span class=<span class="string">"keyword"</span>>from</span>(<span class="string">'query_cache'</span>)
            .select<<span class=<span class="string">"type"</span>>CachedResult</span>>(<span class="string">'*'</span>)
            .<span class=<span class="string">"function"</span>>eq</span>(<span class="string">'query_hash'</span>, queryHash)
            .<span class=<span class="string">"function"</span>>single</span>();

        <span class=<span class="string">"keyword"</span>>if</span> (cachedResults) {
            <span class="comment">// <span class=<span class="string">"type"</span>>Asynchronously</span> update hit_count and last_accessed</span>
            supabaseClient
                .<span class=<span class="string">"keyword"</span>>from</span>(<span class="string">'query_cache'</span>)
                .<span class=<span class="string">"function"</span>>update</span>({ last_accessed: <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Date</span></span>().<span class=<span class="string">"function"</span>>toISOString</span>() })
                .<span class=<span class="string">"function"</span>>eq</span>(<span class="string">'id'</span>, cachedResults.id)
                .<span class=<span class="string">"function"</span>>then</span>((_) => <span class=<span class="string">"type"</span>>console</span>.<span class=<span class="string">"function"</span>>log</span>(<span class="string">'<span class="type">Cache</span> hit updated'</span>))
                .<span class=<span class="string">"keyword"</span>>catch</span>((e) => <span class=<span class="string">"type"</span>>console</span>.<span class=<span class="string">"function"</span>>error</span>(<span class="string">'<span class="type"><span class="type">Error</span></span> updating cache hit:'</span>, e));

            <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Response</span></span>(<span class=<span class="string">"type"</span>>JSON</span>.<span class=<span class="string">"function"</span>>stringify</span>({
                answer: cachedResults.answer,
                sources: cachedResults.sources,
                confidence: cachedResults.confidence,
                cached: <span class=<span class="string">"keyword"</span>>true</span>,
            }), { headers, status: <span class="number">200</span> });
        }

        <span class="comment">// <span class="number">2</span>. <span class=<span class="string">"type"</span>>Generate</span> <span class=<span class="string">"type"</span>>Embedding</span> <span class=<span class="string">"keyword"</span>>for</span> the query</span>
        <span class=<span class="string">"keyword"</span>>const</span> queryEmbedding = <span class=<span class="string">"keyword"</span>>await</span> <span class=<span class="string">"function"</span>>generateEmbedding</span>(query);

        <span class="comment">// <span class="number">3</span>. <span class=<span class="string">"type"</span>>Perform</span> <span class=<span class="string">"type"</span>>Hybrid</span> <span class=<span class="string">"type"</span>>Search</span> via <span class=<span class="string">"type"</span>>RPC</span></span>
        <span class=<span class="string">"keyword"</span>>const</span> { data: searchResults, error } = <span class=<span class="string">"keyword"</span>>await</span> supabaseClient
            .<span class=<span class="string">"function"</span>>rpc</span>(<span class="string">'match_documents'</span>, {
                query_embedding: queryEmbedding,
                query_text: query,
                match_count: limit || <span class="number">5</span>,
                ef_search_param: ef_search || <span class="number">100</span>,
                rrf_k_param: rrf_k || <span class="number">60</span>,
                filter_topic: topic || <span class=<span class="string">"keyword"</span>>null</span>,
            });

        <span class=<span class="string">"keyword"</span>>if</span> (error) <span class=<span class="string">"keyword"</span>>throw</span> error;

        <span class=<span class="string">"keyword"</span>>let</span> answer: <span class=<span class="string">"type"</span>>string</span>;
        <span class=<span class="string">"keyword"</span>>let</span> sources: <span class=<span class="string">"type"</span>>any</span>[] = [];
        <span class=<span class="string">"keyword"</span>>let</span> confidence = <span class="number">0.0</span>;

        <span class=<span class="string">"keyword"</span>>if</span> (!searchResults || searchResults.length === <span class="number">0</span>) {
            answer = <span class="string">"<span class="</span>type<span class="string">">No</span> relevant information found <span class="</span>keyword<span class="string">">for</span> your query."</span>;
        } <span class=<span class="string">"keyword"</span>>else</span> {
            <span class="comment">// <span class=<span class="string">"type"</span>>Basic</span> answer <span class=<span class="string">"function"</span>>synthesis </span>(<span class=<span class="string">"keyword"</span>>in</span> a real app, <span class=<span class="string">"keyword"</span>>this</span> would go to an <span class=<span class="string">"type"</span>>LLM</span>)</span>
            <span class=<span class="string">"keyword"</span>>const</span> context = searchResults.<span class=<span class="string">"function"</span>>map</span>((s: <span class=<span class="string">"type"</span>>SearchResultChunk</span>) => s.content).<span class=<span class="string">"function"</span>>join</span>(<span class="string">"\\n\\n"</span>);
            answer = <span class="string">`<span class="type">Based</span> on the provided documents, here's some information related to your query: ${context.<span class="function">substring</span>(<span class="number">0</span>, <span class="number">500</span>)}...`</span>;
            sources = searchResults.<span class=<span class="string">"function"</span>>map</span>((s: <span class=<span class="string">"type"</span>>SearchResultChunk</span>) => ({
                id: s.id,
                content_preview: s.content.<span class=<span class="string">"function"</span>>substring</span>(<span class="number">0</span>, <span class="number">100</span>) + <span class="string">'...'</span>,
                metadata: s.metadata,
                rrf_score: s.rrf_score,
            }));
            confidence = searchResults[<span class="number">0</span>].rrf_score; <span class="comment">// <span class=<span class="string">"type"</span>>Simple</span> confidence <span class=<span class="string">"keyword"</span>>from</span> top result</span>
        }

        <span class="comment">// <span class="number">4</span>. <span class=<span class="string">"type"</span>>Cache</span> <span class=<span class="string">"type"</span>>New</span> <span class=<span class="string">"type"</span>>Result</span> (asynchronously)</span>
        supabaseClient
            .<span class=<span class="string">"keyword"</span>>from</span>(<span class="string">'query_cache'</span>)
            .<span class=<span class="string">"function"</span>>upsert</span>({
                query_hash: queryHash,
                query_text: query,
                answer: answer,
                sources: sources,
                confidence: confidence,
                last_accessed: <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Date</span></span>().<span class=<span class="string">"function"</span>>toISOString</span>(),
                hit_count: <span class="number">1</span>,
                <span class="comment">// source_files: [...] // <span class=<span class="string">"type"</span>>Populate</span> <span class=<span class="string">"keyword"</span>>if</span> known</span>
            }, { onConflict: <span class="string">'query_hash'</span> })
            .<span class=<span class="string">"function"</span>>then</span>((_) => <span class=<span class="string">"type"</span>>console</span>.<span class=<span class="string">"function"</span>>log</span>(<span class="string">'<span class="type">Query</span> cached'</span>))
            .<span class=<span class="string">"keyword"</span>>catch</span>((e) => <span class=<span class="string">"type"</span>>console</span>.<span class=<span class="string">"function"</span>>error</span>(<span class="string">'<span class="type"><span class="type">Error</span></span> caching query:'</span>, e));

        <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Response</span></span>(<span class=<span class="string">"type"</span>>JSON</span>.<span class=<span class="string">"function"</span>>stringify</span>({ answer, sources, confidence, cached: <span class=<span class="string">"keyword"</span>>false</span> }), { headers, status: <span class="number">200</span> });

    } <span class=<span class="string">"keyword"</span>>catch</span> (error) {
        <span class=<span class="string">"type"</span>>console</span>.<span class=<span class="string">"function"</span>>error</span>(error.message);
        <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"keyword"</span>>new</span> <span class=<span class="string">"type"</span>><span class=<span class="string">"type"</span>>Response</span></span>(<span class=<span class="string">"type"</span>>JSON</span>.<span class=<span class="string">"function"</span>>stringify</span>({ error: error.message }), {
            headers,
            status: <span class="number">500</span>,
        });
    }
}

Python Code Module
This module provides a Python script for the document ingestion and embedding pipeline.

<span class="comment"># scripts/ingest_documents.py</span>
<span class=<span class="string">"keyword"</span>>import</span> os
<span class=<span class="string">"keyword"</span>>import</span> uuid
<span class=<span class="string">"keyword"</span>>from</span> typing <span class=<span class="string">"keyword"</span>>import</span> <span class=<span class="string">"type"</span>>List</span>, <span class=<span class="string">"type"</span>>Dict</span>, <span class=<span class="string">"type"</span>>Any</span>
<span class=<span class="string">"keyword"</span>>from</span> supabase <span class=<span class="string">"keyword"</span>>import</span> create_client, <span class=<span class="string">"type"</span>>Client</span>
<span class=<span class="string">"keyword"</span>>from</span> openai <span class=<span class="string">"keyword"</span>>import</span> <span class=<span class="string">"type"</span>>OpenAI</span>
<span class=<span class="string">"keyword"</span>>from</span> langchain_text_splitters <span class=<span class="string">"keyword"</span>>import</span> <span class=<span class="string">"type"</span>>RecursiveCharacterTextSplitter</span>
<span class=<span class="string">"keyword"</span>>import</span> hashlib
<span class=<span class="string">"keyword"</span>>import</span> time

<span class="comment"># <span class=<span class="string">"type"</span>>Environment</span> variables</span>
<span class=<span class="string">"type"</span>>SUPABASE_URL</span>: <span class=<span class="string">"builtin"</span>>str</span> = os.environ.<span class=<span class="string">"function"</span>>get</span>(<span class="string">"<span class="</span>type<span class="string">">SUPABASE_URL</span>"</span>)
<span class=<span class="string">"type"</span>>SUPABASE_SERVICE_ROLE_KEY</span>: <span class=<span class="string">"builtin"</span>>str</span> = os.environ.<span class=<span class="string">"function"</span>>get</span>(<span class="string">"<span class="</span>type<span class="string">">SUPABASE_SERVICE_ROLE_KEY</span>"</span>)
<span class=<span class="string">"type"</span>>OPENAI_API_KEY</span>: <span class=<span class="string">"builtin"</span>>str</span> = os.environ.<span class=<span class="string">"function"</span>>get</span>(<span class="string">"<span class="</span>type<span class="string">">OPENAI_API_KEY</span>"</span>)

<span class="comment"># <span class=<span class="string">"type"</span>>Initialize</span> clients</span>
supabase: <span class=<span class="string">"type"</span>>Client</span> = <span class=<span class="string">"function"</span>>create_client</span>(<span class=<span class="string">"type"</span>>SUPABASE_URL</span>, <span class=<span class="string">"type"</span>>SUPABASE_SERVICE_ROLE_KEY</span>)
openai_client = <span class=<span class="string">"function"</span>>OpenAI</span>(api_key=<span class=<span class="string">"type"</span>>OPENAI_API_KEY</span>)

<span class="comment"># <span class=<span class="string">"type"</span>>Configuration</span></span>
<span class=<span class="string">"type"</span>>EMBEDDING_MODEL</span>: <span class=<span class="string">"builtin"</span>>str</span> = <span class="string">'text-embedding-<span class="number">3</span>-small'</span>
<span class=<span class="string">"type"</span>>EMBEDDING_DIMENSIONS</span>: <span class=<span class="string">"builtin"</span>>int</span> = <span class="number">1536</span>
<span class=<span class="string">"type"</span>>CHUNK_SIZE</span>: <span class=<span class="string">"builtin"</span>>int</span> = <span class="number">1000</span>
<span class=<span class="string">"type"</span>>CHUNK_OVERLAP</span>: <span class=<span class="string">"builtin"</span>>int</span> = <span class="number">200</span>
<span class=<span class="string">"type"</span>>DOCUMENTS_TABLE_NAME</span>: <span class=<span class="string">"builtin"</span>>str</span> = <span class="string">'knowledge_chunks'</span>

<span class="comment"># <span class=<span class="string">"type"</span>>Illustrative</span> <span class=<span class="string">"type"</span>>SQL</span> <span class=<span class="string">"type"</span>>Setup</span> (run this <span class=<span class="string">"keyword"</span>>in</span> <span class=<span class="string">"type"</span>>Supabase</span> <span class=<span class="string">"type"</span>>SQL</span> editor)</span>
<span class="comment"># <span class=<span class="string">"type"</span>>CREATE</span> <span class=<span class="string">"type"</span>>TABLE</span> <span class=<span class="string">"function"</span>>knowledge_chunks </span>(</span>
<span class="comment">#     id <span class=<span class="string">"type"</span>>UUID</span> <span class=<span class="string">"type"</span>>PRIMARY</span> <span class=<span class="string">"type"</span>>KEY</span> <span class=<span class="string">"type"</span>>DEFAULT</span> <span class=<span class="string">"function"</span>>uuid_generate_v4</span>(),</span>
<span class="comment">#     content <span class=<span class="string">"type"</span>>TEXT</span> <span class=<span class="string">"type"</span>>NOT</span> <span class=<span class="string">"type"</span>>NULL</span>,</span>
<span class="comment">#     embedding <span class=<span class="string">"function"</span>>VECTOR</span>(<span class="number">1536</span>) <span class=<span class="string">"type"</span>>NOT</span> <span class=<span class="string">"type"</span>>NULL</span>,</span>
<span class="comment">#     metadata <span class=<span class="string">"type"</span>>JSONB</span> <span class=<span class="string">"type"</span>>DEFAULT</span> <span class="string">'{}'</span>::jsonb,</span>
<span class="comment">#     content_tsv <span class=<span class="string">"type"</span>>TSVECTOR</span> <span class=<span class="string">"type"</span>>GENERATED</span> <span class=<span class="string">"type"</span>>ALWAYS</span> <span class=<span class="string">"type"</span>>AS</span> (<span class=<span class="string">"function"</span>>to_tsvector</span>(<span class="string">'english'</span>, <span class=<span class="string">"function"</span>>coalesce</span>(content, <span class="string">''</span>))) <span class=<span class="string">"type"</span>>STORED</span>,</span>
<span class="comment">#     source_url <span class=<span class="string">"type"</span>>TEXT</span>,</span>
<span class="comment">#     created_at <span class=<span class="string">"type"</span>>TIMESTAMPTZ</span> <span class=<span class="string">"type"</span>>DEFAULT</span> <span class=<span class="string">"function"</span>>now</span>(),</span>
<span class="comment">#     updated_at <span class=<span class="string">"type"</span>>TIMESTAMPTZ</span> <span class=<span class="string">"type"</span>>DEFAULT</span> <span class=<span class="string">"function"</span>>now</span>()</span>
<span class="comment"># );</span>
<span class="comment"># <span class=<span class="string">"type"</span>>CREATE</span> <span class=<span class="string">"type"</span>>INDEX</span> knowledge_chunks_embedding_hnsw <span class=<span class="string">"type"</span>>ON</span> knowledge_chunks <span class=<span class="string">"type"</span>>USING</span> <span class=<span class="string">"function"</span>>hnsw </span>(embedding vector_cosine_ops) <span class=<span class="string">"type"</span>>WITH</span> (m = <span class="number">32</span>, ef_construction = <span class="number">64</span>);</span>
<span class="comment"># <span class=<span class="string">"type"</span>>CREATE</span> <span class=<span class="string">"type"</span>>INDEX</span> knowledge_chunks_content_tsv_gin <span class=<span class="string">"type"</span>>ON</span> knowledge_chunks <span class=<span class="string">"type"</span>>USING</span> <span class=<span class="string">"function"</span>>gin </span>(content_tsv) <span class=<span class="string">"type"</span>>WITH</span> (fastupdate = on);</span>
<span class="comment"># -- <span class=<span class="string">"type"</span>>Trigger</span> <span class=<span class="string">"keyword"</span>>for</span> updated_at</span>
<span class="comment"># <span class=<span class="string">"type"</span>>CREATE</span> <span class=<span class="string">"type"</span>>OR</span> <span class=<span class="string">"type"</span>>REPLACE</span> <span class=<span class="string">"type"</span>>FUNCTION</span> <span class=<span class="string">"function"</span>>set_updated_at_on_knowledge_chunks</span>() <span class=<span class="string">"type"</span>>RETURNS</span> <span class=<span class="string">"type"</span>>TRIGGER</span> <span class=<span class="string">"type"</span>>LANGUAGE</span> plpgsql <span class=<span class="string">"type"</span>>AS</span> $$ <span class=<span class="string">"type"</span>>BEGIN</span> <span class=<span class="string">"type"</span>>NEW</span>.updated_at = <span class=<span class="string">"function"</span>>now</span>(); <span class=<span class="string">"type"</span>>RETURN</span> <span class=<span class="string">"type"</span>>NEW</span>; <span class=<span class="string">"type"</span>>END</span>; $$;</span>
<span class="comment"># <span class=<span class="string">"type"</span>>CREATE</span> <span class=<span class="string">"type"</span>>TRIGGER</span> set_updated_at_on_knowledge_chunks <span class=<span class="string">"type"</span>>BEFORE</span> <span class=<span class="string">"type"</span>>UPDATE</span> <span class=<span class="string">"type"</span>>ON</span> knowledge_chunks <span class=<span class="string">"type"</span>>FOR</span> <span class=<span class="string">"type"</span>>EACH</span> <span class=<span class="string">"type"</span>>ROW</span> <span class=<span class="string">"type"</span>>EXECUTE</span> <span class=<span class="string">"type"</span>>FUNCTION</span> <span class=<span class="string">"function"</span>>set_updated_at_on_knowledge_chunks</span>();</span>

<span class=<span class="string">"type"</span>>DOCUMENT_CONTENT</span> = <span class="string">"""
<span class="comment">## <span class="type">Advanced</span> <span class="type">Supabase</span> pgvector <span class="type">Optimization</span> <span class="type">Guide</span></span>
<span class="type">This</span> guide details advanced strategies <span class="keyword">for</span> optimizing your <span class="type">Supabase</span> pgvector setup, focusing on performance, cost-efficiency, <span class="keyword">and</span> scalability.

<span class="comment">### <span class="type">Indexing</span> <span class="type">Strategies</span></span>
<span class="type">For</span> most workloads, <span class="type">HNSW</span> (<span class="type">Hierarchical</span> <span class="type">Navigable</span> <span class="type">Small</span> <span class="type">World</span>) <span class="keyword">is</span> the recommended vector index. <span class="type">It</span> provides superior recall <span class="keyword">and</span> query latency compared to <span class="type">IVFFlat</span>.
*   **<span class="type">HNSW</span> <span class="type">Parameters</span>**:
    *   `m` (connections per node): <span class="type">Typically</span> between <span class="number">16</span>-<span class="number">64</span>. <span class="type">Higher</span> values improve recall but increase index size <span class="keyword">and</span> build time. <span class="type">A</span> good starting point <span class="keyword">is</span> <span class="number">32</span>.
    *   `ef_construction` (exploration factor during build): <span class="type">Influences</span> index quality. <span class="type">Higher</span> <span class="function">values </span>(e.g., <span class="number">64</span>-<span class="number">128</span>) lead to better recall but longer build times.
    *   `ef_search` (exploration factor at query time): <span class="type">Dictates</span> search accuracy vs. speed. <span class="type">Adjustable</span> at query time. <span class="type">For</span> voice <span class="type">RAG</span>, <span class="number">100</span> <span class="keyword">is</span> a balanced choice.

<span class="comment">### <span class="type">Hybrid</span> <span class="type">Search</span> <span class="keyword">with</span> <span class="type">RRF</span></span>
<span class="type">Combine</span> <span class="function">semantic </span>(vector) search <span class="keyword">with</span> <span class="function">keyword </span>(<span class="type">Full</span>-<span class="type">Text</span> <span class="type">Search</span> - <span class="type">FTS</span>) using <span class="type">Reciprocal</span> <span class="type">Rank</span> <span class="type">Fusion</span> (<span class="type">RRF</span>).
<span class="number">1</span>.  **<span class="type">Vector</span> <span class="type">Search</span>**: <span class="type">Uses</span> `embedding` column <span class="keyword">with</span> <span class="type">HNSW</span> index.
<span class="number">2</span>.  **<span class="type">FTS</span>**: <span class="type">Uses</span> `content_tsv` column <span class="keyword">with</span> <span class="type">GIN</span> index. <span class="type">PostgreSQL</span>'s `websearch_to_tsquery` <span class="keyword">is</span> excellent <span class="keyword">for</span> user queries.
<span class="number">3</span>.  **<span class="type">RRF</span>**: <span class="type">Blends</span> results <span class="keyword">from</span> both, giving a final score. <span class="type">The</span> `k` parameter <span class="keyword">in</span> <span class="type">RRF</span> (e.g., <span class="number">60</span>) tunes the weighting.

<span class="comment">### <span class="type">Latency</span> <span class="type">Management</span></span>
*   **<span class="type">Target</span>**: <100ms <span class="keyword">for</span> real-time applications.
*   **<span class="type">Components</span>**: <span class="type">Database</span> <span class="function">query </span>(<span class="number">8</span>-9ms), <span class="type">Supabase</span> <span class="type">Gateway</span> (29ms), <span class="type">OpenAI</span> <span class="type">Embeddings</span> (50ms).
*   **<span class="type">Caching</span>**: <span class="type">Implement</span> query caching to reduce redundant embedding calls <span class="keyword">and</span> database lookups. <span class="type">Redis</span> <span class="keyword">is</span> ideal <span class="keyword">for</span> this.
*   **<span class="type">Cold</span> <span class="type">Starts</span>**: <span class="type">Mitigate</span> <span class="type">Supabase</span> <span class="type">Edge</span> <span class="type">Function</span> cold starts <span class="keyword">with</span> periodic keep-alive pings.

<span class="comment">### <span class="type">Storage</span> <span class="type">Optimization</span></span>
*   <span class="type">Use</span> `pgvector_float4` <span class="keyword">for</span> <span class="number">4</span>-byte <span class="builtin">float</span> embeddings to halve storage costs <span class="keyword">if</span> precision allows.
*   <span class="type">Consider</span> dimensionality <span class="function">reduction </span>(e.g., <span class="type">PCA</span>) <span class="keyword">from</span> <span class="number">1536</span> to <span class="number">256</span> dimensions using models like `text-embedding-<span class="number">3</span>-small` <span class="keyword">with</span> minimal recall impact.
"""</span>

<span class=<span class="string">"keyword"</span>>def</span> <span class=<span class="string">"function"</span>>get_chunks</span>(text: <span class=<span class="string">"builtin"</span>>str</span>) -> <span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"builtin"</span>>str</span>]:
    text_splitter = <span class=<span class="string">"function"</span>>RecursiveCharacterTextSplitter</span>(
        chunk_size=<span class=<span class="string">"type"</span>>CHUNK_SIZE</span>,
        chunk_overlap=<span class=<span class="string">"type"</span>>CHUNK_OVERLAP</span>,
        length_function=<span class=<span class="string">"builtin"</span>>len</span>,
        is_separator_regex=<span class=<span class="string">"keyword"</span>><span class=<span class="string">"type"</span>>False</span></span>,
    )
    <span class=<span class="string">"keyword"</span>>return</span> text_splitter.<span class=<span class="string">"function"</span>>split_text</span>(text)

<span class=<span class="string">"keyword"</span>>def</span> <span class=<span class="string">"function"</span>>generate_embeddings_batch</span>(texts: <span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"builtin"</span>>str</span>]) -> <span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"builtin"</span>>float</span>]]:
    embeddings = []
    retries = <span class="number">3</span>
    delay = <span class="number">1</span>  <span class="comment"># seconds</span>
    <span class=<span class="string">"keyword"</span>>for</span> i <span class=<span class="string">"keyword"</span>>in</span> <span class=<span class="string">"builtin"</span>>range</span>(retries):
        <span class=<span class="string">"keyword"</span>>try</span>:
            response = openai_client.embeddings.<span class=<span class="string">"function"</span>>create</span>(
                model=<span class=<span class="string">"type"</span>>EMBEDDING_MODEL</span>,
                input=texts,
                dimensions=<span class=<span class="string">"type"</span>>EMBEDDING_DIMENSIONS</span>,
            )
            <span class=<span class="string">"keyword"</span>>return</span> [d.embedding <span class=<span class="string">"keyword"</span>>for</span> d <span class=<span class="string">"keyword"</span>>in</span> response.data]
        <span class=<span class="string">"keyword"</span>>except</span> <span class=<span class="string">"builtin"</span>><span class=<span class="string">"type"</span>>Exception</span></span> <span class=<span class="string">"keyword"</span>>as</span> e:
            <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Error</span> generating embeddings: {e}. <span class="</span>type<span class="string">">Retrying</span> <span class="</span>keyword<span class="string">">in</span> {delay}s..."</span>)
            time.<span class=<span class="string">"function"</span>>sleep</span>(delay)
            delay *= <span class="number">2</span>  <span class="comment"># <span class=<span class="string">"type"</span>>Exponential</span> backoff</span>
    raise <span class=<span class="string">"builtin"</span>><span class=<span class="string">"type"</span>>Exception</span></span>(<span class="string">"<span class="</span>type<span class="string">">Failed</span> to generate embeddings after multiple retries."</span>)

<span class=<span class="string">"keyword"</span>>def</span> <span class=<span class="string">"function"</span>>create_deterministic_uuid</span>(content: <span class=<span class="string">"builtin"</span>>str</span>, source_doc_name: <span class=<span class="string">"builtin"</span>>str</span>, chunk_index: <span class=<span class="string">"builtin"</span>>int</span>) -> <span class=<span class="string">"builtin"</span>>str</span>:
    <span class="comment"># <span class=<span class="string">"type"</span>>Use</span> a namespace <span class=<span class="string">"type"</span>>UUID</span> <span class=<span class="string">"keyword"</span>>and</span> a unique string <span class=<span class="string">"keyword"</span>>for</span> deterministic <span class=<span class="string">"type"</span>>UUIDs</span></span>
    namespace_uuid = uuid.<span class=<span class="string">"function"</span>>UUID</span>(<span class="string">'<span class="number">12345678</span>-<span class="number">1234</span>-<span class="number">5678</span>-<span class="number">1234</span>-<span class="number">567812345678</span>'</span>) <span class="comment"># <span class=<span class="string">"type"</span>>A</span> fixed namespace <span class=<span class="string">"type"</span>>UUID</span></span>
    unique_string = <span class=<span class="string">"builtin"</span>>f</span><span class="string">"{source_doc_name}-{chunk_index}-{hashlib.<span class="</span>function<span class="string">">sha256</span>(content.<span class="</span>function<span class="string">">encode</span>()).<span class="</span>function<span class="string">">hexdigest</span>()}"</span>
    <span class=<span class="string">"keyword"</span>>return</span> <span class=<span class="string">"builtin"</span>>str</span>(uuid.<span class=<span class="string">"function"</span>>uuid5</span>(namespace_uuid, unique_string))

<span class=<span class="string">"keyword"</span>>def</span> <span class=<span class="string">"function"</span>>upsert_chunks_to_supabase</span>(chunks: <span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"builtin"</span>>str</span>], embeddings: <span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"type"</span>>List</span>[<span class=<span class="string">"builtin"</span>>float</span>]], source_doc_name: <span class=<span class="string">"builtin"</span>>str</span>, metadata: <span class=<span class="string">"type"</span>>Dict</span>[<span class=<span class="string">"builtin"</span>>str</span>, <span class=<span class="string">"type"</span>>Any</span>]) -> <span class=<span class="string">"keyword"</span>><span class=<span class="string">"type"</span>>None</span></span>:
    data_to_upsert = []
    <span class=<span class="string">"keyword"</span>>for</span> i, (chunk_content, embedding) <span class=<span class="string">"keyword"</span>>in</span> <span class=<span class="string">"builtin"</span>>enumerate</span>(<span class=<span class="string">"builtin"</span>>zip</span>(chunks, embeddings)):
        chunk_id = <span class=<span class="string">"function"</span>>create_deterministic_uuid</span>(chunk_content, source_doc_name, i)
        chunk_metadata = {<span class="string">"chunk_index"</span>: i, <span class="string">"source_document"</span>: source_doc_name, **metadata}
        data_to_upsert.<span class=<span class="string">"function"</span>>append</span>({
            <span class="string">"id"</span>: chunk_id,
            <span class="string">"content"</span>: chunk_content,
            <span class="string">"embedding"</span>: embedding,
            <span class="string">"metadata"</span>: chunk_metadata,
            <span class="string">"source_url"</span>: metadata.<span class=<span class="string">"function"</span>>get</span>(<span class="string">"source_url"</span>),
        })

    <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Upserting</span> {<span class="</span>builtin<span class="string">">len</span>(data_to_upsert)} chunks to <span class="</span>type<span class="string">">Supabase</span>..."</span>)
    response = supabase.<span class=<span class="string">"function"</span>>from_</span>(<span class=<span class="string">"type"</span>>DOCUMENTS_TABLE_NAME</span>).<span class=<span class="string">"function"</span>>upsert</span>(
        data_to_upsert,
        on_conflict=<span class="string">"id"</span>  <span class="comment"># <span class=<span class="string">"type"</span>>Use</span> <span class="string">'id'</span> <span class=<span class="string">"keyword"</span>>for</span> idempotent upserts</span>
    ).<span class=<span class="string">"function"</span>>execute</span>()

    <span class=<span class="string">"keyword"</span>>if</span> response.data:
        <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Successfully</span> upserted {<span class="</span>builtin<span class="string">">len</span>(response.data)} chunks."</span>)
    <span class=<span class="string">"keyword"</span>>else</span>:
        <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Error</span> during upsert: {response.error}"</span>)

<span class=<span class="string">"keyword"</span>>def</span> <span class=<span class="string">"function"</span>>main</span>():
    <span class=<span class="string">"builtin"</span>>print</span>(<span class="string">"<span class="</span>type<span class="string">">Starting</span> document ingestion pipeline..."</span>)
    source_name = <span class="string">"<span class="</span>type<span class="string">">Advanced</span> <span class="</span>type<span class="string">">Supabase</span> pgvector <span class="</span>type<span class="string">">Optimization</span> <span class="</span>type<span class="string">">Guide</span>"</span>
    doc_metadata = {<span class="string">"topic"</span>: <span class="string">"supabase-rag-optimization"</span>, <span class="string">"version"</span>: <span class="string">"<span class="number">1.0</span>"</span>}

    <span class="comment"># <span class="number">1</span>. <span class=<span class="string">"type"</span>>Get</span> chunks</span>
    chunks = <span class=<span class="string">"function"</span>>get_chunks</span>(<span class=<span class="string">"type"</span>>DOCUMENT_CONTENT</span>)
    <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Split</span> document into {<span class="</span>builtin<span class="string">">len</span>(chunks)} chunks."</span>)

    <span class="comment"># <span class="number">2</span>. <span class=<span class="string">"type"</span>>Generate</span> embeddings <span class=<span class="string">"keyword"</span>>in</span> batches</span>
    embeddings = <span class=<span class="string">"function"</span>>generate_embeddings_batch</span>(chunks)
    <span class=<span class="string">"builtin"</span>>print</span>(<span class=<span class="string">"builtin"</span>>f</span><span class="string">"<span class="</span>type<span class="string">">Generated</span> {<span class="</span>builtin<span class="string">">len</span>(embeddings)} embeddings."</span>)

    <span class="comment"># <span class="number">3</span>. <span class=<span class="string">"type"</span>>Upsert</span> to <span class=<span class="string">"type"</span>>Supabase</span></span>
    <span class=<span class="string">"function"</span>>upsert_chunks_to_supabase</span>(chunks, embeddings, source_name, doc_metadata)
    <span class=<span class="string">"builtin"</span>>print</span>(<span class="string">"<span class="</span>type<span class="string">">Document</span> ingestion pipeline finished."</span>)

<span class=<span class="string">"keyword"</span>>if</span> __name__ == <span class="string">"__main__"</span>:
    <span class=<span class="string">"function"</span>>main</span>()
