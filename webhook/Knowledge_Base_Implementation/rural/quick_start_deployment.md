# Supabase Vector RAG: Quick Start Deployment (30 Minutes)

**Goal**: Deploy sub-100ms voice RAG from zero to production  
**Estimated Time**: 30 minutes for setup + 1 hour for knowledge base embedding  
**Prerequisites**: Supabase account, OpenAI API key, TypeScript knowledge

---

## STEP 1: Clone Repository & Setup Environment (5 min)

```bash
# Clone or initialize Supabase project
supabase init my-voice-rag
cd my-voice-rag

# Create .env file
cat > .env.local << EOF
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:[PASS]@[HOST]:6543/postgres
EOF

# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-id [PROJECT_ID]
```

---

## STEP 2: Deploy Database Schema (5 min)

```bash
# Create migration file
supabase migration new create_knowledge_chunks_table

# Edit: supabase/migrations/[TIMESTAMP]_create_knowledge_chunks_table.sql
# Paste the SQL schema from Section 2 of main guide (entire CREATE TABLE + indexes)

# Apply locally first
supabase db push

# Deploy to production
supabase db push --remote

# Verify table exists
psql $DATABASE_URL -c "\d knowledge_chunks"
# Should show: knowledge_chunks, idx_knowledge_embedding_hnsw, idx_knowledge_content_fts
```

---

## STEP 3: Deploy Edge Function (5 min)

```bash
# Create Edge Function directory
mkdir -p supabase/functions/search-knowledge

# Create index.ts from Section 4 of main guide
cat > supabase/functions/search-knowledge/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

// ... (paste complete function code from guide Section 4)
EOF

# Set secrets
supabase secrets set OPENAI_API_KEY=$OPENAI_API_KEY

# Deploy locally to test
supabase functions serve search-knowledge

# In another terminal, test
curl -X POST http://localhost:54321/functions/v1/search-knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'

# Expected response (with empty DB):
# {"answer": "I don't have information...", "sources": [], "confidence": 0, "execution_ms": 150}

# Deploy to production
supabase functions deploy search-knowledge --remote
```

---

## STEP 4: Embed Knowledge Base (15 min)

```bash
# Create Python environment
python3 -m venv venv
source venv/bin/activate
pip install psycopg openai tiktoken

# Create embed_knowledge_base.py from Section 3 of main guide
cat > embed_knowledge_base.py << 'EOF'
#!/usr/bin/env python3
# ... (paste complete Python script from guide Section 3)
EOF

# Run embedding pipeline
python embed_knowledge_base.py \
  --dir /path/to/Knowledge_Base_Implementation/ \
  --db-url postgresql://postgres:[PASS]@[HOST]:6543/postgres \
  --openai-key sk-...

# Monitor progress (should show):
# Found 50 Markdown files in /path/to/...
# → file1.md
#    150 chunks from 30 Q&A pairs
# [1] Embedding 50 texts...
# ✓ Embedding pipeline complete!
#   Total chunks: 5,000
#   Files processed: 50
#   Avg tokens/chunk: ~400
```

---

## STEP 5: Test & Validate (5 min)

```bash
# Test Edge Function with real query
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/search-knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Does this property have water rights?",
    "topic": "water_rights"
  }'

# Expected response:
# {
#   "answer": "Water rights in Arizona are complex. Properties may have surface water rights, 
#              grandfathered groundwater rights, or rely on a municipal system. Check the 
#              seller's disclosure.",
#   "sources": ["water_rights_faq.md", "arizona_property_guide.md"],
#   "confidence": 0.94,
#   "execution_ms": 87
# }

# If latency > 150ms, check:
# 1. OpenAI API latency: Enable debug in Edge Function logs
# 2. Index health: SELECT COUNT(*) FROM knowledge_chunks; 
#                  (should be > 100)
# 3. Cold start: Invoke twice, second should be <120ms

# Load test (optional)
for i in {1..50}; do
  time curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/search-knowledge \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"test query $i\"}"
done
```

---

## STEP 6: Monitor in Production (Ongoing)

### Dashboard Metrics (Supabase Console)

```
1. Functions Dashboard
   ├─ search-knowledge invocations
   ├─ Success rate (should be > 99%)
   └─ Execution time distribution (P50, P95, P99)

2. Database Performance
   ├─ Query performance insights
   ├─ Index health (should show all 3 indexes as active)
   └─ Row count in knowledge_chunks (should grow as you add docs)
```

### Key Queries to Run Weekly

```sql
-- 1. Verify index health
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'knowledge_chunks'
ORDER BY idx_scan DESC;

-- Expected:
-- idx_knowledge_embedding_hnsw: 1000+ scans/week
-- idx_knowledge_content_fts: 500+ scans/week
-- idx_knowledge_metadata: <100 scans/week (optional filter)

-- 2. Check query latency trend
SELECT
  date_trunc('day', created_at) as day,
  COUNT(*) as queries,
  ROUND(AVG(execution_ms)::numeric, 1) as avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms)::numeric, 1) as p95_ms
FROM function_logs
WHERE function_name = 'search-knowledge'
  AND created_at > now() - interval '7 days'
GROUP BY day
ORDER BY day DESC;

-- 3. Monitor cache performance (if using query_cache table)
SELECT
  ROUND(100.0 * hits / total, 1) as cache_hit_rate_pct,
  hits, total, ROUND(hits * 90 / total, 0) as ms_saved
FROM (
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN query_cache.id IS NOT NULL THEN 1 ELSE 0 END) as hits
  FROM search_requests sr
  LEFT JOIN query_cache ON sr.query_hash = query_cache.query_hash
  WHERE sr.created_at > now() - interval '24 hours'
) stats;
```

---

## PRODUCTION CHECKLIST

Before going live with Vapi integration:

```
Database:
  ☐ Migration applied (supabase db push --remote)
  ☐ All 3 indexes created (check pg_stat_user_indexes)
  ☐ Knowledge base embedded (≥100 chunks in knowledge_chunks table)
  ☐ Query returns results in <120ms (test 10x)
  
Edge Function:
  ☐ Function deployed (supabase functions deploy --remote)
  ☐ OpenAI API key set in secrets
  ☐ Endpoint responds with proper JSON format
  ☐ Error handling tested (embedding failure, empty results)
  
Performance:
  ☐ P95 latency < 100ms (measured on 100 queries)
  ☐ Cache hit rate > 10% (if using cache)
  ☐ Error rate < 1%
  ☐ Cold start < 150ms (first query after 1h)
  
Answer Quality:
  ☐ Test 10 sample questions → 90%+ relevance
  ☐ Fallback responses tested (no matching results)
  ☐ Voice formatting <300 chars (readable for TTS)
  ☐ Sources properly attributed
  
Monitoring:
  ☐ Supabase dashboard configured
  ☐ Edge Function logs visible
  ☐ PagerDuty alert for error rate > 5%
  ☐ Weekly latency trend check
```

---

## COMMON ISSUES & FIXES

### "HNSW index not used" (Seq Scan instead)

```sql
-- Problem: Index not being used, query takes 500ms+
-- Cause: Index not built or query optimizer chose sequential scan

-- Fix:
ANALYZE knowledge_chunks;  -- Update statistics
VACUUM knowledge_chunks;    -- Clean up deleted rows

-- Verify index exists:
SELECT * FROM pg_indexes 
WHERE tablename = 'knowledge_chunks' AND indexname LIKE '%hnsw%';

-- Force index use (last resort):
EXPLAIN ANALYZE
SELECT id, content FROM knowledge_chunks
ORDER BY embedding <-> '[0.001, 0.002, ...]'::vector LIMIT 3;

-- Should show "Index Scan using idx_knowledge_embedding_hnsw"
```

### "OpenAI API timeout" (52ms → 3000ms)

```bash
# Problem: Embedding generation taking >1s
# Cause: Rate limit or OpenAI overloaded

# Fix 1: Retry with backoff
# In Edge Function, add:
# const maxRetries = 3;
# let embeddings;
# for (let i = 0; i < maxRetries; i++) {
#   try { embeddings = await generateEmbedding(query); break; }
#   catch { if (i < maxRetries-1) await delay(1000 * Math.pow(2, i)); }
# }

# Fix 2: Check rate limit status
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-..." | jq '.data[0].id'

# Fix 3: Use batch API for knowledge base updates
# (not for real-time queries, but for offline embedding)
```

### "Answer quality < 90%" (returning wrong chunks)

```sql
-- Problem: Top results don't contain correct answer
-- Cause: Embedding similarity not matching semantic relevance

-- Fix 1: Check chunk quality
SELECT 
  id, 
  content,
  array_length(string_to_array(content, ' '), 1) as word_count
FROM knowledge_chunks
ORDER BY word_count ASC
LIMIT 5;

-- Chunks should be 50-500 words (300-2000 tokens)
-- Too small: loses context; too large: dilutes relevance

-- Fix 2: Test embedding quality
-- If "water rights" query returns solar lease chunk with 0.99 similarity,
-- the embedding model might be miscalibrated

-- Fix 3: Increase ef_search
-- Re-run hybrid search with ef_search=150 (was 100)
SET hnsw.ef_search = 150;
-- Will be slower (3-4ms) but more accurate

-- Fix 4: Adjust RRF k parameter
-- Test k=40 (boost high rankers) vs k=60 (balanced)
-- See Advanced Tuning guide for A/B testing
```

---

## NEXT INTEGRATIONS

### 1. Connect to Vapi (Voice AI)

```javascript
// In Vapi webhook configuration:
// POST https://[PROJECT_ID].supabase.co/functions/v1/search-knowledge

{
  "endpoint": "https://[PROJECT_ID].supabase.co/functions/v1/search-knowledge",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer [ANON_KEY]"  // Optional, depends on RLS
  },
  "body": {
    "query": "{{user_query}}",  // Vapi variable
    "topic": "{{conversation_topic}}"  // Optional
  }
}
```

### 2. Add Caching Layer (Redis)

```typescript
// In Edge Function, before OpenAI call:
import { Redis } from "https://esm.sh/redis@4.6.0/mod.ts";

const redis = new Redis({
  hostname: Deno.env.get("REDIS_HOST"),
  port: 6379,
  password: Deno.env.get("REDIS_PASSWORD"),
});

// Check cache
const cached = await redis.get(`embedding:${query}`);
if (cached) return JSON.parse(cached);

// Store result
await redis.setex(`embedding:${query}`, 86400, JSON.stringify(result));
```

### 3. Custom Chunking Strategy

```python
# For domain-specific content, implement custom chunking
# Example: FAQ with section headers

def chunk_faq_style(text):
    # Split on "Q:" and "A:" markers, keep pairs together
    import re
    qa_pattern = r'Q:\s*(.*?)\nA:\s*(.*?)(?=Q:|$)'
    matches = re.findall(qa_pattern, text, re.DOTALL)
    return [f"Q: {q}\nA: {a.strip()}" for q, a in matches]

# Replace chunk_qa_content() in embed_knowledge_base.py with custom logic
```

---

## COST ESTIMATE (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Supabase 2XL Compute | 24/7 | $50 |
| Supabase Storage (1GB) | Knowledge base | $0.25 |
| OpenAI Embeddings | 100K queries @ 200 tokens | $4 |
| Vapi | Integration fees | Variable |
| **Total** | | **~$54/month** |

**Scaling**: Each 10x in queries (up to 1M/month) costs +$40 (compute upgrade).

---

## SUPPORT & RESOURCES

- **Supabase Docs**: https://supabase.com/docs
- **pgvector GitHub**: https://github.com/pgvector/pgvector
- **OpenAI API Docs**: https://platform.openai.com/docs
- **This Guide Section 2**: Full schema + indexes
- **This Guide Section 3**: Embedding pipeline
- **This Guide Section 4**: Edge Function code
- **Advanced Tuning Guide**: Parameter optimization for <100ms

---

**Deployed**: January 2026  
**Ready for production**: Yes ✓  
**Tested with**: Supabase v2.0+, pgvector 0.5.0+, OpenAI text-embedding-3-small
