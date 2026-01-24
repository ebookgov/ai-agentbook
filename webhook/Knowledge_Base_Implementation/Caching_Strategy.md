# Voice AI Caching Strategy

> **Target:** 55-75% latency reduction, 75-90% cost savings via 3-tier cache architecture

---

## Quick Reference: Expected Results

| Metric | Baseline | With Caching | Improvement |
|--------|----------|--------------|-------------|
| Response Latency | 1080-1850ms | 530-750ms | 55-75% faster |
| Cost per Call | $0.10 | $0.01-0.025 | 75-90% savings |
| Cache Hit Rate | 0% | 70-80% | Real estate queries |

---

## 3-Tier Cache Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VOICE REQUEST                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  L1: IN-MEMORY (Property Context)                   Latency: <1ms│
│  ├─ Selected property data (price, beds, amenities)             │
│  ├─ User preferences (budget, location)                         │
│  └─ Session state                                                │
│  TTL: Session duration | Size: 1-10MB per conversation          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (if not found)
┌─────────────────────────────────────────────────────────────────┐
│  L2: SEMANTIC CACHE (Postgres `query_cache`)    Latency: 20-50ms │
│  ├─ Built directly into Supabase (same DB as Knowledge Base)    │
│  ├─ Hash or Vector match of query string                        │
│  └─ "What's the price?" ≈ "How much?" → Same cached response    │
│  TTL: 1-24 hours | Hit Rate: 70%+                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (if cache miss)
┌─────────────────────────────────────────────────────────────────┐
│  L3: VECTOR DB + RAG                          Latency: 580-1130ms│
│  ├─ Full property retrieval (Pinecone/Qdrant)                   │
│  ├─ LLM synthesis with prompt caching                           │
│  └─ Store result in L2 for future hits                          │
│  LLM Prompt Caching: 75% cost reduction, 80% latency reduction  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Latency by Request Type

| Scenario | L1 | L2 | L3 | Total Latency |
|----------|----|----|----|--------------:|
| Repeat Q ("What's the price?") | <1ms | HIT | — | **350-550ms** |
| Similar Q ("How much?") | <1ms | HIT | — | **350-550ms** |
| New property question | <1ms | MISS | 500-1000ms | **850-1350ms** |
| **Average (70% hit)** | — | — | — | **530-750ms** |

---

## L1: In-Memory Property Context

### Structure

```json
{
  "session_id": "user_123",
  "selected_property": {
    "id": "prop_456",
    "address": "456 Oak St",
    "price": "$750k",
    "bedrooms": 3,
    "bathrooms": 2,
    "parking": "2-car garage",
    "amenities": ["gym", "pool", "rooftop"]
  },
  "user_preferences": {
    "budget_min": 500000,
    "budget_max": 1000000,
    "bedrooms": [2, 3, 4],
    "location": "downtown"
  }
}
```

### When to Load

- User selects property → Load full data into memory
- Subsequent questions hit L1 cache in **<1ms**

---

## L2: Semantic Cache Configuration

### Implementation: Postgres-Native

We chose to implement the Semantic Cache directly in Postgres (`query_cache` table) to simplify infrastructure. This avoids managing a separate Redis vector instance.

```sql
CREATE TABLE query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash BYTEA UNIQUE NOT NULL, -- SHA256 of normalized query
  answer TEXT NOT NULL,
  confidence NUMERIC,
  last_accessed TIMESTAMPTZ DEFAULT now()
);
```

**Why this wins:**
- **Zero extra latency:** No network hop to external cache; it lives next to the data.
- **Atomic:** Updates to knowledge base can instantly invalidate cache in the same transaction.
- **Cost:** Included in Supabase plan.

### Tuning Parameters (`query_cache` table)

```yaml
similarity_threshold: 0.88      # Stricter = fewer false positives
match_count: 1                  # Return only the best match
embedding_model: "text-embedding-3-small" (or similar)
ttl_hours: 24                   # 24h for property data
```

*(Note: Redis migration planned only if Postgres latency consistently exceeds 100ms)*

### Real Estate FAQ Pre-Warming

```python
faq_templates = {
    "What's the price of {property}?": "Listed at ${price}.",
    "How many bedrooms?": "{bedrooms} bedrooms, {bathrooms} baths.",
    "Is parking included?": "Yes, includes {parking}.",
    "When can I view?": "Available {available_times}.",
    "What's the HOA fee?": "Monthly HOA is ${hoa}.",
}
# Warm cache at startup with top 20 FAQs
```

---

## L3: LLM Response Caching

### What to Cache vs. Not Cache

| Cache ✅ | Don't Cache ❌ |
|----------|---------------|
| System prompt | Individual user utterances |
| Property context | Tool call results |
| Standard FAQs | Dynamic recommendations |

### Prompt Structure for Caching

```
Turn 1: [System prompt]        ← Cached once
        [Property context]     ← Cached per property
        [User query]           ← New each turn
        → Response

Turn 2: [Reuse cached prefix]
        [New context]
        [User query]
        → 50-70% faster
```

### Provider-Specific

| Provider | Min Tokens | Cost Reduction | Latency Reduction |
|----------|------------|----------------|-------------------|
| OpenAI | 1024 | 75% | 80% |
| Anthropic | 1408 | 75% | Up to 85% |
| Google | 1024 | 50-75% | 60-80% |

---

## Latency Budget Allocation

**Target: Sub-800ms total voice latency**

| Component | Budget | Notes |
|-----------|--------|-------|
| STT | 200-250ms | Fixed (Deepgram) |
| Intent extraction | 10-20ms | In-memory |
| Cache lookups (L1+L2) | 50-100ms | Combined |
| LLM (cached hit) | 0ms | — |
| LLM (uncached) | 500-800ms | ~30% of requests |
| TTS | 200-400ms | Parallel with LLM |
| Network/buffer | 50-100ms | Streaming |
| **Total** | **800-1000ms** | User-perceptible |

---

## Implementation Phases

### Phase 1: Semantic Cache (L2)

- **Effort:** 2-4 weeks
- **ROI:** 50-75% latency reduction, 60-70% cost savings
- **Effort:** 2-4 weeks
- **ROI:** 50-75% latency reduction, 60-70% cost savings
- **Stack:** Supabase `query_cache` (Postgres)
  - *Redis reserved for Calendar Locking*

### Phase 2: LLM Response Caching (L3)

- **Effort:** 1-2 weeks
- **ROI:** 30-50% additional cost savings
- **Stack:** OpenAI/Anthropic native caching

### Phase 3: Conversation Context (L1)

- **Effort:** 3-6 weeks
- **ROI:** 40-60% latency reduction for multi-turn
- **Stack:** In-memory + context summarization

**Total Timeline:** 6-12 weeks for full 3-tier system

---

## Monitoring Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| L2 semantic hit rate | >70% | <60% |
| L2 cache latency | <100ms | >150ms |
| L3 vector search | <50ms p95 | >100ms |
| TTFT (hit) | <500ms | >600ms |
| TTFT (miss) | <1200ms | >1500ms |

---

## Real Estate Specifics

### Expected Hit Rates by Property Popularity

| Property Type | Day 1 | Week 1 |
|---------------|-------|--------|
| New listing (cold) | 0% | 70%+ |
| Popular (100+ inquiries/day) | 80%+ | 85%+ |

### High-Value Cache Patterns

- Property overview: "Tell me about 456 Oak St"
- Availability: "Can I view this weekend?"
- Financing: "What's your current rate?"
- Comparables: "How does this compare to nearby?"

---

## Key Citations

- **OpenAI Prompt Caching:** 75% cost, 80% latency reduction
- **ConvoCache (arxiv):** 89-90% hit rate on dialogue
- **GPT Semantic Cache:** 68.8% API call reduction
- **Pinecone:** 30-50ms vector search latency
- **Qdrant:** 2-5ms p50 (self-hosted)

---

*Source: Perplexity Deep Research, January 2026*
