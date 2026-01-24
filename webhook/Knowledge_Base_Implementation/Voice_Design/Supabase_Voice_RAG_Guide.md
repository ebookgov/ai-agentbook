Supabase Vector RAG Implementation Manifest
Architectural Summary
This document outlines the strategic design for a robust Supabase Vector RAG system, emphasizing high-performance knowledge retrieval and seamless integration for voice AI applications. The core is a hybrid search methodology leveraging Supabase's `pgvector` for semantic search, PostgreSQL's full-text search (FTS), and JSONB metadata filtering, all fused using Reciprocal Rank Fusion (RRF).

Index Strategy
Vector Index (HNSW): Implemented on the `embedding` column of the `knowledge_chunks` table using Supabase `pgvector`.
Index Name: `idx_knowledge_embedding_hnsw`
Configuration: `m = 32`, `ef_construction = 64`
Performance Target: 99% recall with ~2.4ms query time for 1536-dimensional embeddings.
Full-Text Search (FTS): A GIN index (`idx_knowledge_content_fts`) on the `content_tsv` column for efficient keyword matching.
Metadata Filtering: A GIN index (`idx_knowledge_metadata`) on the `metadata` JSONB column for rapid filtering based on attributes like `topic`.
Hybrid Search Methodology
Combining vector similarity, full-text keyword search, and metadata filtering using Reciprocal Rank Fusion (RRF) for optimal relevance.

Vector Similarity: Semantic search via the HNSW index.
Full-Text Search (FTS): Keyword search against `content_tsv` using `websearch_to_tsquery`.
Metadata Filtering: Optional `topic` filter applied to both vector and FTS queries.
Reciprocal Rank Fusion (RRF): Results from vector and FTS (top 100 from each) are fused using `SUM(1.0 / (RRF_K + COALESCE(vector_rank, fts_rank)))`, with `RRF_K = 60`.
Implementation flexibility allows for an efficient PostgreSQL `execute_hybrid_search` function or Supabase Edge Functions.

An optional `query_cache` table is planned to achieve sub-10ms retrieval for frequent queries, further enhancing responsiveness.

Latency Budget
Target P95 latency of <100ms for the entire RAG pipeline, meticulously broken down:

Network ingress: 10ms
OpenAI embedding API call (query): 50ms
pgvector query execution (HNSW): 30ms
Keyword search (FTS, GIN): 10ms
RRF fusion & ranking (in-database): 5ms
Response formatting: 10ms
Network egress: 10ms
Key Performance Indicators (KPIs): P95 query latency <100ms, cold function start times <150ms.

JSON Blueprint
Project structure and key methods at a glance.

Project File Overview
Copy
{
  "supabase/migrations/create_rag_schema.sql": {
    "description": "SQL script for database schema and indexes.",
    "key_methods": [
      "CREATE EXTENSION IF NOT EXISTS vector",
      "CREATE TABLE knowledge_chunks",
      "CREATE INDEX idx_knowledge_embedding_hnsw",
      "CREATE INDEX idx_knowledge_content_fts",
      "CREATE INDEX idx_knowledge_metadata",
      "CREATE TABLE IF NOT EXISTS query_cache"
    ]
  },
  "supabase/functions/execute_hybrid_search.sql": {
    "description": "PostgreSQL function for hybrid search with RRF.",
    "key_methods": [
      "CREATE OR REPLACE FUNCTION execute_hybrid_search",
      "vector_search (CTE)",
      "fts_search (CTE)",
      "ranked_union (CTE)",
      "rrf_calculation (CTE)"
    ]
  },
  "scripts/embed_knowledge_base.py": {
    "description": "Python script for parsing, chunking, embedding, and storing.",
    "key_methods": [
      "parse_markdown_qa",
      "chunk_qa_content",
      "embed_batch",
      "init_db",
      "get_embedded_files",
      "insert_chunks_batch",
      "process_knowledge_base"
    ]
  },
  "supabase/functions/search-knowledge/index.ts": {
    "description": "Supabase Edge Function (Deno) for query handling and search.",
    "key_methods": [
      "generateEmbedding",
      "hybridSearch",
      "hybridSearchDirect (fallback)",
      "formatForVoice",
      "cosineSimilarity",
      "getQueryHash",
      "serve (main handler)"
    ]
  },
  "scripts/test_latency.sh": {
    "description": "Bash script for load testing and latency measurement.",
    "key_methods": [
      "test_query",
      "calculate P50, P95, P99 latency"
    ]
  }
}
SQL Code Module
Supabase `pgvector` setup, table definitions, and the hybrid search function.

supabase/migrations/create_rag_schema.sql & execute_hybrid_search.sql
Copy
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the knowledge_chunks table
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    content_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    metadata JSONB DEFAULT '{}'::JSONB,
    source_file TEXT,
    chunk_index INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT source_file_chunk_unique UNIQUE (source_file, chunk_index)
);

COMMENT ON TABLE public.knowledge_chunks IS 'Stores text chunks, their embeddings (OpenAI text-embedding-3-small, 1536-dim), and metadata for RAG.';
COMMENT ON COLUMN public.knowledge_chunks.embedding IS 'Vector embedding of the chunk content (OpenAI text-embedding-3-small, 1536 dimensions).';
COMMENT ON COLUMN public.knowledge_chunks.content_tsv IS 'Generated TSVECTOR for full-text search on content.';
COMMENT ON COLUMN public.knowledge_chunks.metadata IS 'JSONB column for additional structured metadata (e.g., {"topic": "Supabase", "version": "v1.0"}).';

-- Indexes for efficient search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 32, ef_construction = 64);
COMMENT ON INDEX idx_knowledge_embedding_hnsw IS 'HNSW index for fast approximate nearest neighbor (ANN) search on embeddings.';

CREATE INDEX IF NOT EXISTS idx_knowledge_content_fts ON public.knowledge_chunks USING GIN (content_tsv);
COMMENT ON INDEX idx_knowledge_content_fts IS 'GIN index for full-text search on chunk content.';

CREATE INDEX IF NOT EXISTS idx_knowledge_metadata ON public.knowledge_chunks USING GIN (metadata);
COMMENT ON INDEX idx_knowledge_metadata IS 'GIN index for efficient filtering and querying on JSONB metadata.';

-- Optional: Partial index for only active/relevant chunks
-- CREATE INDEX IF NOT EXISTS idx_knowledge_active_chunks ON public.knowledge_chunks (created_at) WHERE (metadata->>'status' = 'active');

-- Create query_cache table
CREATE TABLE IF NOT EXISTS public.query_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash BYTEA UNIQUE NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT[],
    confidence NUMERIC,
    hit_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.query_cache IS 'Caches responses for frequent queries to achieve sub-10ms retrieval. query_hash stores SHA-256 hash of query+topic.';

CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count ON public.query_cache (hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_cache_last_accessed ON public.query_cache (last_accessed DESC);

-- Create the execute_hybrid_search function
CREATE OR REPLACE FUNCTION public.execute_hybrid_search(
    p_embedding VECTOR(1536),
    p_query TEXT,
    p_topic TEXT DEFAULT NULL,
    p_limit INT DEFAULT 3,
    p_search_limit INT DEFAULT 100,
    p_rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    vector_rank INT,
    fts_rank INT,
    rrf_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            kc.id,
            kc.content,
            kc.metadata,
            RANK() OVER (ORDER BY kc.embedding <-> p_embedding) AS rank_num
        FROM
            public.knowledge_chunks kc
        WHERE
            (p_topic IS NULL OR kc.metadata->>'topic' = p_topic)
        ORDER BY
            kc.embedding <-> p_embedding
        LIMIT p_search_limit
    ),
    fts_search AS (
        SELECT
            kc.id,
            kc.content,
            kc.metadata,
            RANK() OVER (ORDER BY ts_rank_cd(kc.content_tsv, websearch_to_tsquery('english', p_query)) DESC) AS rank_num
        FROM
            public.knowledge_chunks kc
        WHERE
            websearch_to_tsquery('english', p_query) @@ kc.content_tsv
            AND (p_topic IS NULL OR kc.metadata->>'topic' = p_topic)
        ORDER BY
            ts_rank_cd(kc.content_tsv, websearch_to_tsquery('english', p_query)) DESC
        LIMIT p_search_limit
    ),
    ranked_union AS (
        SELECT
            id, content, metadata, rank_num AS vector_rank, NULL::INT AS fts_rank
        FROM
            vector_search
        UNION ALL
        SELECT
            id, content, metadata, NULL::INT AS vector_rank, rank_num AS fts_rank
        FROM
            fts_search
    )
    SELECT
        ru.id,
        ru.content,
        ru.metadata,
        MAX(ru.vector_rank) AS vector_rank,
        MAX(ru.fts_rank) AS fts_rank,
        SUM(1.0 / (p_rrf_k + COALESCE(ru.vector_rank, p_search_limit + 1)::NUMERIC)) +
        SUM(1.0 / (p_rrf_k + COALESCE(ru.fts_rank, p_search_limit + 1)::NUMERIC)) AS rrf_score
    FROM
        ranked_union ru
    GROUP BY
        ru.id, ru.content, ru.metadata
    ORDER BY
        rrf_score DESC
    LIMIT p_limit;
END;
$$;

-- Grant permissions for the RPC function
GRANT EXECUTE ON FUNCTION public.execute_hybrid_search TO anon, authenticated, service_role;
TypeScript Code Module
Supabase Edge Function (`search-knowledge/index.ts`) logic for handling queries.

supabase/functions/search-knowledge/index.ts
Copy
import { serve } from "https://deno.land/std@0.178.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";
import { createHash } from "https://deno.land/std@0.178.0/node/crypto.ts";

// CORS Headers for Edge Function flexibility
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Types ---
interface SearchRequest {
    query: string;
    topic?: string;
    limit?: number;
    use_cache?: boolean;
}

interface KnowledgeChunk {
    id: string;
    content: string;
    metadata: { [key: string]: any };
    vector_rank?: number;
    fts_rank?: number;
    rrf_score?: number;
}

interface VoiceResponse {
    answer: string;
    sources: string[];
    confidence: number;
    execution_time_ms: number;
    cached: boolean;
}

interface QueryCacheEntry {
    id: string;
    query_hash: string;
    answer: string;
    sources: string[];
    confidence: number;
    hit_count: number;
    created_at: string;
    last_accessed: string;
}

// --- Configuration & Clients ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));

const RRF_K = 60;
const RESULT_LIMIT = 3;
const SEARCH_LIMIT = 100;

// --- Utility Functions ---

/** Generates an embedding for a given text using OpenAI API. */
async function generateEmbedding(text: string): Promise {
    const response = await openai.createEmbedding({
        model: "text-embedding-3-small",
        input: text,
    });
    // Expected latency: ~50ms
    return response.data.data[0].embedding;
}

/** Performs hybrid search using Supabase RPC or client-side fallback. */
async function hybridSearch(
    embedding: number[],
    query: string,
    topic?: string,
    limit: number = RESULT_LIMIT,
    searchLimit: number = SEARCH_LIMIT,
    rrfK: number = RRF_K
): Promise {
    try {
        const { data, error } = await supabase.rpc('execute_hybrid_search', {
            p_embedding: embedding,
            p_query: query,
            p_topic: topic,
            p_limit: limit,
            p_search_limit: searchLimit,
            p_rrf_k: rrfK,
        });

        if (error) {
            console.error("RPC hybrid search failed:", error);
            // Fallback to client-side vector-only search if RPC fails
            return hybridSearchDirect(embedding, topic, limit);
        }
        return data as KnowledgeChunk[];
    } catch (e) {
        console.error("Error calling RPC:", e);
        // Fallback in case of network or unhandled RPC error
        return hybridSearchDirect(embedding, topic, limit);
    }
}

/** Client-side vector-only search (fallback). */
async function hybridSearchDirect(
    embedding: number[],
    topic?: string,
    limit: number = RESULT_LIMIT
): Promise {
    console.warn("Falling back to client-side vector-only search.");
    let query = supabase.from('knowledge_chunks')
        .select('id, content, metadata')
        .order('embedding <->', { ascending: true })
        .limit(limit);

    if (topic) {
        query = query.filter('metadata->>topic', 'eq', topic);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Client-side vector search failed:", error);
        return [];
    }
    return data as KnowledgeChunk[];
}

/** Formats retrieved chunks into a natural, voice-friendly answer. */
function formatForVoice(chunks: KnowledgeChunk[]): { answer: string; sources: string[]; confidence: number } {
    if (!chunks || chunks.length === 0) {
        return {
            answer: "I couldn't find specific information related to your query in my knowledge base.",
            sources: [],
            confidence: 0,
        };
    }

    const relevantContent = chunks.map(c => c.content).join(" ");
    const uniqueSources = Array.from(new Set(chunks.map(c => c.metadata?.source_file || 'Unknown Source')));
    const avgConfidence = chunks.reduce((sum, c) => sum + (c.rrf_score || 0), 0) / chunks.length;

    // Simple concatenation for voice output (can be enhanced with LLM summarization)
    let answer = `Based on the information, ${relevantContent}.`;

    // Truncate for voice output
    if (answer.length > 300) {
        answer = answer.substring(0, 297) + "...";
    }

    return {
        answer: answer.trim(),
        sources: uniqueSources,
        confidence: parseFloat(avgConfidence.toFixed(2)),
    };
}

/** Calculates cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

/** Generates a SHA-256 hash for query caching. */
function getQueryHash(query: string, topic?: string): string {
    const input = topic ? `${query}::${topic}` : query;
    return createHash("sha256").update(input).digest("hex");
}

// --- Main Handler ---
serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = performance.now();
    let cached = false;

    try {
        const { query, topic, limit = RESULT_LIMIT, use_cache = true }: SearchRequest = await req.json();

        if (!query) {
            return new Response(JSON.stringify({ error: "Query is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const queryHash = getQueryHash(query, topic);

        // --- Caching Logic ---
        if (use_cache) {
            const { data: cachedEntry, error: cacheError } = await supabase
                .from('query_cache')
                .select('*')
                .eq('query_hash', queryHash)
                .maybeSingle();

            if (cachedEntry && !cacheError) {
                // Cache hit
                cached = true;
                // Update hit_count and last_accessed in background
                supabase.from('query_cache')
                    .update({ hit_count: cachedEntry.hit_count + 1, last_accessed: new Date().toISOString() })
                    .eq('id', cachedEntry.id)
                    .then(({ error }) => {
                        if (error) console.error("Error updating cache entry:", error);
                    });

                const endTime = performance.now();
                return new Response(JSON.stringify({
                    answer: cachedEntry.answer,
                    sources: cachedEntry.sources,
                    confidence: cachedEntry.confidence,
                    execution_time_ms: endTime - startTime,
                    cached: true,
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }
        }

        // --- RAG Pipeline ---
        // 1. Generate embedding for the query
        const queryEmbedding = await generateEmbedding(query);

        // 2. Perform hybrid search
        const chunks = await hybridSearch(queryEmbedding, query, topic, limit);

        // 3. Format response for voice AI
        const { answer, sources, confidence } = formatForVoice(chunks);

        // --- Cache Update (if use_cache is true and results found) ---
        if (use_cache && chunks.length > 0) {
            const { error: insertError } = await supabase.from('query_cache').upsert(
                {
                    query_hash: queryHash,
                    answer: answer,
                    sources: sources,
                    confidence: confidence,
                    hit_count: 1,
                    last_accessed: new Date().toISOString(),
                },
                { onConflict: 'query_hash' }
            );
            if (insertError) console.error("Error inserting/upserting into cache:", insertError);
        }

        const endTime = performance.now();
        return new Response(JSON.stringify({
            answer,
            sources,
            confidence,
            execution_time_ms: endTime - startTime,
            cached,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Unhandled error:", error);
        const endTime = performance.now();
        return new Response(JSON.stringify({
            error: "Internal server error. Please try again.",
            execution_time_ms: endTime - startTime,
            cached,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
Python Code Module
Script (`embed_knowledge_base.py`) for the embedding pipeline.

scripts/embed_knowledge_base.py
Copy
import argparse
import os
import re
import yaml
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass, field
import hashlib
import psycopg
from psycopg.rows import dict_row

from openai import OpenAI
import tiktoken

# --- Configuration ---
TARGET_TOKENS = 400
OVERLAP_TOKENS = 50
BATCH_SIZE = 50  # Texts per OpenAI API call
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536

# OpenAI client (configured via env var or passed key)
openai_client = None

# --- Data Model ---
@dataclass
class Chunk:
    content: str
    source_file: str
    chunk_index: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: List[float] = field(default_factory=list)

    def to_dict(self):
        return {
            "content": self.content,
            "source_file": self.source_file,
            "chunk_index": self.chunk_index,
            "metadata": self.metadata,
            "embedding": self.embedding,
        }

    def content_hash(self) -> str:
        """Generates a hash of the content for change detection."""
        return hashlib.sha256(self.content.encode('utf-8')).hexdigest()

# --- Parsing Functions ---
def parse_markdown_qa(file_path: Path) -> List[Dict]:
    """
    Parses a Markdown file, extracts YAML frontmatter and Q&A pairs.
    Assumes Q&A pairs start with '## Question:' followed by 'Answer:' or similar.
    """
    content = file_path.read_text(encoding='utf-8')
    qa_pairs = []

    # Extract YAML frontmatter
    frontmatter_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
    global_metadata = {}
    if frontmatter_match:
        global_metadata = yaml.safe_load(frontmatter_match.group(1))
        content = content[frontmatter_match.end():] # Remove frontmatter

    # Split into sections by '## Question:'
    sections = re.split(r'(## Question:.*?(?=\n## Question:|$))', content, flags=re.DOTALL)
    sections = [s.strip() for s in sections if s.strip()]

    for section in sections:
        if section.startswith("## Question:"):
            question_match = re.match(r'## Question:\s*(.*?)\n\s*Answer:\s*(.*)', section, re.DOTALL)
            if question_match:
                question = question_match.group(1).strip()
                answer = question_match.group(2).strip()
                qa_pairs.append({
                    "question": question,
                    "answer": answer,
                    "metadata": global_metadata.copy() # Start with global, can be extended later
                })
            else:
                print(f"Warning: Could not parse Q&A in section from {file_path}:\n{section[:100]}...")
    return qa_pairs

# --- Chunking Function ---
def chunk_qa_content(qa_pairs: List[Dict], source_file: str) -> List[Chunk]:
    """
    Chunks Q&A content, ensuring Q&A pairs are ideally kept together.
    Splits long answers into multiple chunks if necessary.
    """
    tokenizer = tiktoken.encoding_for_model(EMBEDDING_MODEL)
    chunks: List[Chunk] = []
    chunk_idx = 0

    for qa_pair in qa_pairs:
        question = qa_pair["question"]
        answer = qa_pair["answer"]
        metadata = qa_pair["metadata"]

        full_text = f"Question: {question}\nAnswer: {answer}"
        tokens = tokenizer.encode(full_text)

        if len(tokens) <= TARGET_TOKENS:
            chunks.append(Chunk(
                content=full_text,
                source_file=source_file,
                chunk_index=chunk_idx,
                metadata=metadata
            ))
            chunk_idx += 1
        else:
            # If answer is too long, split it. Keep question with each part.
            answer_tokens = tokenizer.encode(answer)
            question_prefix = f"Question: {question}\nAnswer: "
            question_prefix_tokens = tokenizer.encode(question_prefix)

            current_answer_pos = 0
            while current_answer_pos < len(answer_tokens):
                # Calculate remaining capacity for answer tokens
                remaining_capacity = TARGET_TOKENS - len(question_prefix_tokens)

                # Determine end of current chunk for answer tokens
                chunk_end_pos = min(current_answer_pos + remaining_capacity, len(answer_tokens))

                # Decode the answer part for this chunk
                answer_chunk_tokens = answer_tokens[current_answer_pos:chunk_end_pos]
                answer_chunk_text = tokenizer.decode(answer_chunk_tokens)

                chunk_content = question_prefix + answer_chunk_text

                chunks.append(Chunk(
                    content=chunk_content,
                    source_file=source_file,
                    chunk_index=chunk_idx,
                    metadata=metadata
                ))
                chunk_idx += 1

                # Move to the next part, with overlap
                current_answer_pos += (remaining_capacity - OVERLAP_TOKENS)
                if current_answer_pos < 0: # Ensure it doesn't go negative if remaining_capacity < OVERLAP_TOKENS
                    current_answer_pos = 0
    return chunks

# --- Embedding Function ---
def embed_batch(texts: List[str]) -> List[List[float]]:
    """Generates embeddings for a batch of texts using OpenAI."""
    if not openai_client:
        raise ValueError("OpenAI client not initialized. Call init_openai_client().")

    response = openai_client.embeddings.create(
        input=texts,
        model=EMBEDDING_MODEL
    )

    # OpenAI guarantees order, but it's good practice to sort by index
    embeddings = sorted(response.data, key=lambda x: x.index)
    return [d.embedding for d in embeddings]

# --- Database Operations ---
def init_db(db_url: str):
    """Connects to the database and ensures vector extension is enabled."""
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        conn.commit()

def get_embedded_files(conn: psycopg.Connection) -> Set[str]:
    """Retrieves a set of source_file names already present in knowledge_chunks."""
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT source_file FROM public.knowledge_chunks;")
        return {row[0] for row in cur.fetchall()}

def insert_chunks_batch(conn: psycopg.Connection, chunks_with_embeddings: List[Chunk]):
    """Performs batch inserts or updates of chunks and their embeddings."""
    values = [
        (
            chunk.content,
            chunk.embedding,
            chunk.metadata,
            chunk.source_file,
            chunk.chunk_index
        )
        for chunk in chunks_with_embeddings
    ]

    with conn.cursor() as cur:
        # Using ON CONFLICT (source_file, chunk_index) DO UPDATE
        # to handle updates to existing chunks and insert new ones.
        # This allows for refreshing individual chunks without deleting the whole file.
        cur.executemany(
            """
            INSERT INTO public.knowledge_chunks (content, embedding, metadata, source_file, chunk_index)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (source_file, chunk_index) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
            """,
            values
        )
    conn.commit()

# --- Orchestration ---
def process_knowledge_base(
    kb_dir: Path, db_url: str, force_refresh: bool = False
):
    """
    Orchestrates the pipeline: discovers files, parses, chunks, embeds,
    and stores data in Supabase.
    """
    print(f"Processing knowledge base in: {kb_dir}")
    init_db(db_url)

    with psycopg.connect(db_url) as conn:
        already_embedded_files = get_embedded_files(conn) if not force_refresh else set()

        markdown_files = list(kb_dir.glob('**/*.md'))
        total_files = len(markdown_files)
        print(f"Found {total_files} Markdown files.")

        files_to_process = []
        for file_path in markdown_files:
            relative_path = str(file_path.relative_to(kb_dir))
            if relative_path not in already_embedded_files or force_refresh:
                files_to_process.append(file_path)
            else:
                print(f"Skipping '{relative_path}' (already embedded). Use --force-refresh to re-embed.")

        if not files_to_process:
            print("No new or modified files to process.")
            return

        all_chunks: List[Chunk] = []
        for i, file_path in enumerate(files_to_process):
            relative_path = str(file_path.relative_to(kb_dir))
            print(f"[{i+1}/{len(files_to_process)}] Processing file: {relative_path}")
            qa_pairs = parse_markdown_qa(file_path)
            file_chunks = chunk_qa_content(qa_pairs, relative_path)
            all_chunks.extend(file_chunks)

        print(f"Generated {len(all_chunks)} chunks in total.")

        # Batch embedding and insertion
        for i in range(0, len(all_chunks), BATCH_SIZE):
            batch_chunks = all_chunks[i:i + BATCH_SIZE]
            batch_texts = [chunk.content for chunk in batch_chunks]

            print(f"Embedding batch {i // BATCH_SIZE + 1}/{(len(all_chunks) - 1) // BATCH_SIZE + 1}...")
            batch_embeddings = embed_batch(batch_texts)

            for j, embedding in enumerate(batch_embeddings):
                batch_chunks[j].embedding = embedding

            print(f"Inserting batch {i // BATCH_SIZE + 1} into DB...")
            insert_chunks_batch(conn, batch_chunks)
            print(f"Batch {i // BATCH_SIZE + 1} inserted.")

    print("Knowledge base embedding complete.")

# --- CLI Entry Point ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Embed knowledge base Markdown files into Supabase pgvector."
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default="./knowledge_base",
        help="Directory containing Markdown knowledge base files.",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=os.getenv("DATABASE_URL"),
        help="Supabase database connection URL (e.g., postgresql://...). "
             "Falls back to DATABASE_URL environment variable.",
    )
    parser.add_argument(
        "--openai-key",
        type=str,
        default=os.getenv("OPENAI_API_KEY"),
        help="OpenAI API key. Falls back to OPENAI_API_KEY environment variable.",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force re-embedding of all files, even if already present.",
    )
    args = parser.parse_args()

    if not args.db_url:
        raise ValueError("Database URL not provided. Use --db-url or set DATABASE_URL env var.")
    if not args.openai_key:
        raise ValueError("OpenAI API key not provided. Use --openai-key or set OPENAI_API_KEY env var.")

    openai_client = OpenAI(api_key=args.openai_key)

    process_knowledge_base(
        kb_dir=args.dir, db_url=args.db_url, force_refresh=args.force_refresh
    )
