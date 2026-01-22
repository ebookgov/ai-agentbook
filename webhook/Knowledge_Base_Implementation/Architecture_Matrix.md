# Voice Agent Knowledge Architecture - Technical Reference
**Date:** January 21, 2026  
**Project:** Arizona Real Estate Voice Agent (Vapi.ai)  

---

## SYSTEM ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER MAKES CALL                             │
│                      (Phone/Browser/Vapi SDK)                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VAPI REALTIME API                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │   STT    │  │   LLM    │  │   TTS    │                          │
│  │ Deepgram │  │ GPT-4o   │  │ OpenAI   │                          │
│  │ 150ms    │  │ 300ms    │  │ 100ms    │                          │
│  └──────────┘  └────┬─────┘  └──────────┘                          │
│                     │                                               │
│                     ▼                                               │
│           ┌─────────────────┐                                      │
│           │  Tool Calling   │◄─────────┐                           │
│           │ (lookup_property)│           │                           │
│           └────────┬────────┘           │                           │
└────────────────────┼────────────────────┼───────────────────────────┘
                     │                    │
                     ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (Middleware)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 1. Check Redis Semantic Cache                              │  │
│  │    (embed query, check if seen before)                     │  │
│  │    ✓ HIT: Return cached property data (10-50ms)            │  │
│  │    ✗ MISS: Continue                                        │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 2. Check Pinecone Vector DB (Phase 2+)                      │  │
│  │    (semantic search on property address, water rights,etc)  │  │
│  │    Latency: <50ms                                           │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 3. Check Elasticsearch (Phase 2+)                           │  │
│  │    (full-text search on TCPA keywords, compliance terms)    │  │
│  │    Latency: <50ms                                           │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 4. Merge Results (RRF Algorithm)                            │  │
│  │    (combine Pinecone + Elasticsearch scores)                │  │
│  │    Return top-3 results                                     │  │
│  └────────┬──────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 5. Cache Result                                             │  │
│  │    (save to Redis for next 24 hours)                        │  │
│  │    Return to Vapi                                           │  │
│  └────────┬──────────────────────────────────────────────────┘  │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ (Latency: 10-100ms)
            │
            ▼
    ┌────────────────┐
    │  VAPI LLM      │
    │  Processes     │
    │  Property Data │
    │  (200ms)       │
    └────────────────┘
            │
            ▼
    ┌────────────────┐
    │  VAPI TTS      │
    │  Generates     │
    │  Speech        │
    │  (100ms)       │
    └────────────────┘
            │
            ▼
    ┌────────────────┐
    │  USER HEARS    │
    │  RESPONSE      │
    │  P95: 800ms    │
    └────────────────┘
```

---

## DATA FLOW: HAPPY PATH

**Scenario:** Customer calls asking about water rights at "123 Main St, Phoenix, AZ 85001"

### Step 1: STT (150ms)
```
Customer: "What are the water rights for 123 Main Street?"
         ↓
Deepgram Nova-3 converts to:
"What are the water rights for 123 Main Street?"
```

### Step 2: Vapi Invokes Tool (LLM decision)
```
System Prompt: "Use lookup_property tool when asked about property details"
         ↓
Tool Call Decision:
{
  "function": "lookup_property",
  "parameters": {
    "address": "123 Main St, Phoenix, AZ 85001",
    "query_type": "water_rights"
  }
}
```

### Step 3: FastAPI Backend (10-100ms)
```
Request: GET /api/lookup_property?address=123 Main St&query_type=water_rights

Cache Key: MD5("123 main st, phoenix, az 85001:water_rights")
         ↓
Redis Check: "property:a1b2c3d4" 
  ✗ Miss (first call)
         ↓
Pinecone Vector Search:
  - Embed query with text-embedding-3-small
  - Find similar properties (cosine similarity)
  - Results: ["123 Main St, Phoenix, AZ 85001", score: 0.98]
         ↓
Elasticsearch Full-Text:
  - Search for "water" + "123 main" + "phoenix"
  - Results: ["123 Main St, Phoenix, AZ 85001"]
         ↓
RRF Merge:
  - Pinecone score: 1/(60+0) = 0.0167
  - Elasticsearch score: 1/(60+0) = 0.0167
  - Combined: 0.0334
         ↓
Response:
{
  "success": true,
  "address": "123 Main St, Phoenix, AZ 85001",
  "type": "water_rights",
  "data": {
    "source": "groundwater",
    "acre_feet": 2.5,
    "adwr_certificate": "GWC-2020-001",
    "status": "valid",
    "disclosure": "This property has 2.5 acre-feet annual groundwater rights per ADWR certificate GWC-2020-001"
  },
  "retrieved_at": "2026-01-21T14:35:42.123Z"
}

Cache Result: Store in Redis for 24 hours
```

### Step 4: LLM Processes Response (300ms)
```
System: "You have retrieved property information. Disclose water rights clearly."
Tool Result: 
{
  "disclosure": "This property has 2.5 acre-feet annual groundwater rights per ADWR certificate GWC-2020-001"
}

LLM Output:
"This property at 123 Main Street has 2.5 acre-feet of annual groundwater rights according to ADWR certificate GWC-2020-001. This means you can use up to 2.5 acre-feet of water per year from the groundwater aquifer."
```

### Step 5: TTS (100ms)
```
OpenAI TTS converts to speech:
"This property at 123 Main Street has 2.5 acre-feet of annual groundwater rights..."
         ↓
Audio sent to customer
```

**Total Latency:** 150 + 50 + 300 + 100 = 600ms ✅ (Within 800ms budget)

---

## LATENCY BUDGET BREAKDOWN

```
┌─────────────────────────────────────────────────────────────────┐
│ VAPI REALTIME PIPELINE (Controlled by Vapi)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STT Latency                          ~150ms                   │
│  ├─ Audio buffer collection:          80ms                     │
│  └─ Deepgram inference:               70ms                     │
│                                                                 │
│  LLM Latency                          ~300ms                   │
│  ├─ Queue wait:                       20ms                     │
│  ├─ Token generation (200 tokens):    200ms                    │
│  ├─ Tool calling decision:            50ms                     │
│  └─ Tool response processing:         30ms                     │
│                                                                 │
│  >>> BACKEND CALL WINDOW (Our control) <<<                    │
│  Knowledge Retrieval                  <100ms ← TARGET          │
│  ├─ Redis lookup:                     1-5ms                    │
│  ├─ If miss: Pinecone vector search:  40ms                     │
│  ├─ If miss: Elasticsearch fulltext:  40ms                     │
│  ├─ RRF merge + serialize:            10ms                     │
│  └─ Network RTT:                      10-20ms                  │
│                                                                 │
│  >>> END OF BACKEND CALL                                       │
│                                                                 │
│  TTS Latency                          ~100ms                   │
│  ├─ OpenAI TTS generation:            80ms                     │
│  └─ Audio streaming start:            20ms                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ TOTAL END-TO-END LATENCY               ~600-800ms              │
│ (Vapi Benchmark: <800ms for competitiveness)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Our responsibility:** Keep retrieval <100ms (we have 150ms budget in LLM window)

---

## DATABASE SCHEMAS

### Pinecone Index: "arizona-properties"

**Metadata stored with each vector:**

```json
{
  "id": "prop_001",
  "values": [/* 1536-dim embedding from text-embedding-3-small */],
  "metadata": {
    "address": "123 Main St, Phoenix, AZ 85001",
    "city": "Phoenix",
    "county": "Maricopa",
    "zip": "85001",
    "water_source": "groundwater",
    "acre_feet": "2.5",
    "adwr_certificate": "GWC-2020-001",
    "solar_type": "roof_mounted",
    "solar_provider": "Sunrun",
    "hoa_name": "Paradise Valley Estates",
    "hoa_fee": "250",
    "property_type": "residential",
    "square_feet": "2,100",
    "year_built": "1998",
    "last_updated": "2026-01-21"
  }
}
```

**Index settings:**
```python
spec=ServerlessSpec(
    cloud="aws",
    region="us-west-2"
)
```

### Elasticsearch Index: "properties"

**Mapping:**

```json
{
  "mappings": {
    "properties": {
      "address": {
        "type": "text",
        "analyzer": "standard"
      },
      "city": {
        "type": "keyword"
      },
      "water_source": {
        "type": "keyword"
      },
      "acre_feet": {
        "type": "float"
      },
      "adwr_certificate": {
        "type": "keyword"
      },
      "solar_type": {
        "type": "keyword"
      },
      "hoa_name": {
        "type": "text"
      },
      "hoa_fee": {
        "type": "float"
      },
      "tcpa_compliant": {
        "type": "boolean"
      },
      "last_updated": {
        "type": "date"
      }
    }
  }
}
```

**Analyzer:** Standard (lowercase, stops words)

---

## CACHE STRATEGY COMPARISON

| Strategy | Hit Rate | Latency | Cost | Accuracy |
|----------|----------|---------|------|----------|
| **No Cache** | 0% | 800ms | $1.50/call | 100% |
| **Redis Semantic (Phase 1)** | 35-40% | 300ms avg | $0.82/call | 100% |
| **Pinecone + Elasticsearch (Phase 2)** | 45-50% | <100ms | $0.90/call | 98-99% |
| **Phase 1 + Audio Cache (Phase 3)** | 60-65% | <50ms avg | $0.92/call | 100% |

**Decision tree:**
```
Query comes in
    ├─ Exact match in Redis?
    │   ├─ Yes → Cache HIT (10ms)
    │   └─ No → Continue
    │
    ├─ Semantic match in Pinecone?
    │   ├─ Similarity >0.95 → Use cached property (50ms)
    │   └─ No or low similarity → Continue
    │
    ├─ Full-text match in Elasticsearch?
    │   ├─ Found → Combine with Pinecone (90ms total)
    │   └─ Not found → Continue
    │
    └─ Fall back to fresh query (100ms+)
```

---

## MONITORING METRICS

### Key Performance Indicators

```
1. LATENCY METRICS
   ├─ P50 latency: Target <400ms
   ├─ P95 latency: Target <800ms (SLA)
   ├─ P99 latency: Target <1200ms
   ├─ Cache retrieval latency: Target <50ms
   └─ LLM inference latency: Target <300ms

2. CACHE METRICS
   ├─ Semantic cache hit rate: Target >40%
   ├─ Audio cache hit rate: Target >30%
   ├─ Prompt cache hit rate: Target >80%
   └─ Redis memory usage: Target <2GB

3. ACCURACY METRICS
   ├─ Property retrieval accuracy: Target >95%
   ├─ Water rights disclosure accuracy: Target 100%
   ├─ TCPA compliance rate: Target 100%
   └─ Schema validation pass rate: Target 100%

4. COST METRICS
   ├─ Cost per call: Target <$1.00
   ├─ API cost per 1000 calls: Target <$800
   ├─ Infrastructure cost per call: Target <$0.15
   └─ Monthly spend: Target <$1,000

5. RELIABILITY METRICS
   ├─ Error rate: Target <1%
   ├─ Tool timeout rate: Target <0.5%
   ├─ Backend availability: Target >99.9%
   └─ Mean time to recovery: Target <5 minutes
```

### Grafana Dashboard Queries

```promql
# Latency percentiles
histogram_quantile(0.95, rate(vapi_latency_ms_bucket[5m]))

# Cache hit rate
rate(cache_hits_total[5m]) / rate(cache_requests_total[5m])

# Error rate
rate(errors_total[5m]) / rate(requests_total[5m])

# Cost per call
increase(api_cost_total[1h]) / increase(calls_total[1h])
```

---

## FAILURE MODES & RECOVERY

| Failure Mode | Symptom | Detection | Recovery |
|--------------|---------|-----------|----------|
| **Pinecone outage** | Latency spikes to 800ms+ | Vector search fails | Fall back to Elasticsearch only (-20% accuracy) |
| **Elasticsearch down** | Full-text search fails | ES connection error | Fall back to Pinecone only (-15% accuracy) |
| **Redis cache full** | Eviction warnings | Redis MEMORY command | Increase Redis instance size, clear old entries |
| **Vapi rate limit** | 429 errors from Vapi | Vapi API response | Queue requests, implement exponential backoff |
| **LLM context too long** | Token limit exceeded | OpenAI API error | Truncate property data, use summary instead |
| **ADWR data stale** | Outdated water rights | Compare to reference data | Trigger refresh from ADWR API |
| **TCPA violation detected** | Compliance alert | Consent tracking log shows gap | Block call, log violation, notify compliance team |
| **Audio encoding fails** | TTS error | OpenAI API error | Fall back to text-only response |

**All recovery procedures logged to CloudWatch + Slack alert**

---

## SECURITY & COMPLIANCE

### PII Handling

```
SENSITIVE DATA:
- Phone numbers
- Property addresses (quasi-identifiers)
- Water rights (public but sensitive)
- TCPA consent records

POLICIES:
✓ Encrypt at rest (S3 encryption, Redis SSL)
✓ Encrypt in transit (HTTPS/TLS)
✓ No logging of phone numbers (hash only)
✓ 30-day retention for TCPA records (then delete)
✓ Access control: Only backend can read, not client
✓ Audit logging: All property lookups logged with timestamp
```

### TCPA Compliance Checklist

- [ ] AI disclosure given on first message
- [ ] Consent verified before sales call
- [ ] Recording enabled + announcement made
- [ ] Do-not-call list checked (before Phase 3)
- [ ] Consent record stored (with timestamp, method)
- [ ] Consent audit trail available for compliance

### Arizona Water Rights Compliance

- [ ] ADWR certificate verified (not expired)
- [ ] Acre-feet accurately disclosed
- [ ] No overstatement of water availability
- [ ] Updated weekly from ADWR API
- [ ] Dispute resolution process defined

---

## ARCHITECTURE DECISION TREE

```
Do I need knowledge retrieval?
    ├─ No → No database needed
    └─ Yes → Which type?
        ├─ EXACT match (address lookup)?
        │   └─ Use Redis + PostgreSQL
        │
        ├─ SEMANTIC match (similar properties)?
        │   └─ Use Pinecone (vector search)
        │
        ├─ FULL-TEXT match (keywords: "water rights")?
        │   └─ Use Elasticsearch
        │
        └─ ALL OF ABOVE → Use hybrid (Phase 2+)
            └─ Combine with RRF algorithm

Need sub-100ms retrieval?
    ├─ No → Elasticsearch alone OK
    └─ Yes → Use Pinecone + cache

Need compliance tracking?
    ├─ No → Simple logging OK
    └─ Yes → Use PostgreSQL + audit log
```

---

## PRODUCTION DEPLOYMENT CHECKLIST

### Infrastructure
- [ ] AWS/GCP account configured
- [ ] S3 bucket created + encryption enabled
- [ ] RDS PostgreSQL ready (TCPA audit log)
- [ ] Redis cluster configured (6GB+ memory)
- [ ] Pinecone production index created
- [ ] Elasticsearch cluster ready (3 nodes)
- [ ] Auto-scaling configured (CPU/memory triggers)

### Security
- [ ] SSL certificates for all services
- [ ] VPC configured (private subnets for DBs)
- [ ] IAM roles created (least privilege)
- [ ] Secrets stored in AWS Secrets Manager
- [ ] VPN access for admin operations
- [ ] CloudTrail enabled for audit

### Monitoring
- [ ] CloudWatch dashboards created
- [ ] Grafana connected to Prometheus
- [ ] Alerts configured (latency, error rate, cost)
- [ ] On-call rotation established
- [ ] Runbooks written for all alerts
- [ ] Slack/PagerDuty integration working

### Testing
- [ ] Unit tests (>80% code coverage)
- [ ] Integration tests (all phases working)
- [ ] Load test (100 concurrent calls, P95 <800ms)
- [ ] Chaos engineering (simulate failures)
- [ ] Accuracy testing (50+ sample properties)
- [ ] TCPA compliance testing (all workflows)

### Documentation
- [ ] Architecture docs complete
- [ ] API documentation (FastAPI auto-docs)
- [ ] Runbooks for common issues
- [ ] Team training completed
- [ ] Postmortem templates created
- [ ] Change log maintained

---

## TROUBLESHOOTING GUIDE

### High Latency (P95 >800ms)

**Diagnosis:**
```bash
# Check Pinecone latency
curl -X POST https://api.pinecone.io/query \
  -H "Authorization: Bearer $PINECONE_API_KEY" \
  --time-connect

# Check Elasticsearch latency
curl http://localhost:9200/_search -d '{"query":{"match_all":{}}}' | jq .took

# Check FastAPI response time
curl http://localhost:8000/health -w "@curl-format.txt"
```

**Common causes:**
1. Redis not warmed (restart = slow)
   - Solution: Pre-warm cache on startup
2. Pinecone vector search slow
   - Solution: Check index stats, consider pod upgrade
3. Elasticsearch shards unbalanced
   - Solution: Check shard distribution, rebalance if needed
4. Network latency (AWS region)
   - Solution: Ensure backend in same region as databases

### Cache Not Hitting

**Diagnosis:**
```python
import redis

r = redis.Redis()
# Check what's in cache
for key in r.scan_iter("property:*"):
    print(r.ttl(key), r.strlen(key))

# Check hit ratio
GET /stats → hit_rate_percent
```

**Common causes:**
1. Query phrasing differs slightly
   - Solution: Normalize addresses (lowercase, remove punctuation)
2. TTL too short (24h might be too long)
   - Solution: Keep cached data fresh, reduce TTL
3. Cache key generation inconsistent
   - Solution: Use deterministic hash (MD5 same address format)

### Accuracy Issues

**Diagnosis:**
```python
# Test hybrid search accuracy
from test_phase2 import test_accuracy

test_accuracy(num_samples=50, target_accuracy=0.95)
```

**Common causes:**
1. Pinecone embeddings outdated
   - Solution: Re-embed all properties (weekly job)
2. Elasticsearch mapping incomplete
   - Solution: Add missing fields to mapping, re-index
3. RRF weights wrong
   - Solution: Tune weights based on ground truth

---

## COST ANALYSIS

### Monthly Breakdown (1,000 calls)

| Service | Usage | Cost |
|---------|-------|------|
| OpenAI API | 500K tokens | $0.15 |
| Deepgram STT | 1,000 calls | $0.39 |
| Vapi Platform | 1,000 calls | $0.20 |
| Pinecone | p1.x1 pod | $0.10 |
| Elasticsearch | 2vCPU/8GB | $0.08 |
| Redis | 6GB memory | $0.02 |
| S3 (audio cache) | 50GB stored | $0.01 |
| CloudWatch | Logs + metrics | $0.05 |
| AWS Data Transfer | Inter-AZ | $0.02 |
| **TOTAL** | | **$1.02** |

**Per-call cost:** $1.02 / 1,000 = **$0.00102** (~$0.001/call for infrastructure)

**ROI:** Saves $0.70-1.00 per call vs no optimization

---

## NEXT STEPS

1. **Phase 1 Deployment:** Start this week (3-5 days)
2. **Phase 2 Planning:** Week 2 (index data, prepare Pinecone)
3. **Phase 3 Hardening:** Week 7 (monitoring + production readiness)

---

**Document version:** 1.0  
**Last updated:** January 21, 2026  
**Status:** Reference guide for architects & engineers