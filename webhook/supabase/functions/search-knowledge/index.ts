// Supabase Edge Function: Hybrid vector + keyword RAG search
// Deploy: supabase functions deploy search-knowledge
// Endpoint: POST https://[project].supabase.co/functions/v1/search-knowledge

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface SearchRequest {
  query: string;
  topic?: string;  // Optional filter: "water_rights", "solar_leases", etc.
  limit?: number;
  use_cache?: boolean;
}

interface KnowledgeChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  vector_rank: number;
  fts_rank: number;
  rrf_score: number;
}

// ──────────────────────────────────────────────────────────────────
// Configuration & Clients
// ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// RRF parameters
const RRF_K = 60;          // RRF constant (tunable)
const RESULT_LIMIT = 3;    // Top 3 chunks for voice response
const SEARCH_LIMIT = 100;  // Pre-rank 100 from each method before fusion

// ──────────────────────────────────────────────────────────────────
// OpenAI Embedding (Single Query)
// ──────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  /**
   * Generate 1536-dim embedding via OpenAI text-embedding-3-small.
   * Latency: ~50ms for single query (acceptable in 100ms budget).
   */
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} ${errorText}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

// ──────────────────────────────────────────────────────────────────
// Hybrid Search: RRF Fusion (Vector + Keyword)
// ──────────────────────────────────────────────────────────────────

async function hybridSearch(
  embedding: number[],
  query: string,
  topicFilter?: string
): Promise<KnowledgeChunk[]> {
  /**
   * Execute hybrid search combining:
   *   1. Vector similarity (HNSW index, cosine distance)
   *   2. Full-text search (GIN tsvector index)
   *   3. Reciprocal Rank Fusion (RRF) = 1/(k + rank)
   */
  
  const { data, error } = await supabase.rpc("execute_hybrid_search", {
    p_embedding: embedding,
    p_query: query,
    p_topic: topicFilter || null,
    p_match_count: RESULT_LIMIT,
    p_search_limit: SEARCH_LIMIT,
    p_rrf_k: RRF_K
  });
  
  if (error) {
    console.error("Hybrid search failed, falling back to vector-only:", error);
    // Fallback: Vector-only search if SQL function fails or doesn't exist
    const { data: vectorData, error: vectorError } = await supabase.rpc("match_knowledge_chunks", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: RESULT_LIMIT
    });

    if (vectorError) {
         // Final Fallback: Simple text search if vector RPC also fails (rare)
         console.error("Vector fallback failed:", vectorError);
         return [];
    }

    return (vectorData || []).map((chunk: any, idx: number) => ({
      ...chunk,
      vector_rank: idx + 1,
      fts_rank: 0,
      rrf_score: 1.0 / (RRF_K + idx + 1),
    }));
  }
  
  return data as KnowledgeChunk[];
}

// ──────────────────────────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { query, topic } = await req.json() as SearchRequest;

    if (!query) {
      return new Response(JSON.stringify({ error: "Query required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const start = performance.now();

    // 1. Generate Embedding (~50ms)
    const embedding = await generateEmbedding(query);

    // 2. Hybrid Search (~40ms)
    const results = await hybridSearch(embedding, query, topic);

    // 3. Format Response (~5ms)
    const formattedResponse = {
      answer: results.length > 0 
        ? results.map(r => r.content).join("\n\n") 
        : "I couldn't find specific information on that topic in my knowledge base.",
      sources: [...new Set(results.map(r => r.metadata.source_url || "knowledge_base"))],
      confidence: results.length > 0 ? results[0].rrf_score : 0,
      execution_ms: Math.round(performance.now() - start),
      results: results // Debugging
    };

    return new Response(JSON.stringify(formattedResponse), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
