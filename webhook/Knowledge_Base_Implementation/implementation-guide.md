# Voice Agent Knowledge Architecture - Implementation Guide

**Project:** AI Voice Agent for Arizona Real Estate (Vapi.ai)  
**Last Updated:** January 21, 2026  
**Duration:** 12 weeks (3 phases)

---

## PHASE 1: PROMPT CACHING + SEMANTIC CACHE (WEEKS 1-2)

### Architecture Overview

```
User Call
    ↓
Vapi Webhook
    ↓
FastAPI Backend (middleware)
    ├─ Check Redis semantic cache
    ├─ Check OpenAI prompt cache
    └─ If miss → call OpenAI API
    ↓
Response → TTS → User
```

**Expected improvements:**

- Latency: 800ms → 300ms (repeat questions)
- Cost: $1.50 → $0.80 per call

---

### Step 1: Create Vapi Assistant Config

Copy this JSON into Vapi Dashboard (Assistants → Create Assistant):

```json
{
  "name": "Arizona Real Estate Agent",
  "voiceProvider": "openai",
  "voiceSettings": {
    "provider": "openai",
    "voiceId": "shimmer"
  },
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxDurationSeconds": 600,
  "backgroundSound": "off",
  "analysisPlan": {
    "summaryPoints": ["property_address", "water_rights_status", "asking_price"],
    "successEvaluationRubric": "Accurately disclosed water rights and TCPA compliance"
  },
  "firstMessageMode": "text-in-streaming",
  "firstMessage": "Hi! I'm your AI assistant for Arizona properties. I'm disclosing that I'm an AI. How can I help you today?",
  "systemPrompt": "You are an Arizona real estate specialist AI. You MUST disclose that you are AI before discussing the property. You know about water rights, solar leases, HOA rules, and TCPA regulations.\n\nWater Rights Rules:\n- Always disclose water source (groundwater, surface, reclaimed)\n- Provide acre-feet per year if known\n- Never misrepresent availability\n- Link to ADWR certificate if available\n\nTCPA Compliance:\n- Get explicit consent before making sales calls\n- Include AI disclosure (already provided)\n- Respect do-not-call lists\n\nSolar Lease Rules:\n- Disclose contract terms clearly\n- Mention buyout options\n- Explain power purchase agreement impacts\n\nHOA Rules:\n- Share monthly fees and major restrictions\n- Check solar panel approval status\n- Warn about special assessments\n\nAlways be helpful, honest, and compliance-focused.",
  "endCallMessage": "Thanks for calling. Have a great day!",
  "recordCall": true,
  "tool": {
    "async": false,
    "function": {
      "description": "Look up Arizona property information",
      "name": "lookup_property",
      "parameters": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string",
            "description": "Full property address"
          },
          "query_type": {
            "type": "string",
            "enum": ["water_rights", "solar_lease", "hoa_rules", "general_info"],
            "description": "Type of information needed"
          }
        },
        "required": ["address", "query_type"]
      }
    },
    "server": {
      "url": "https://your-domain.com/api/lookup_property",
      "timeoutSeconds": 15
    }
  }
}
```

**To deploy:**

1. Go to Vapi Dashboard → Assistants
2. Click "Create Assistant"
3. Paste the above JSON (or fill fields manually)
4. Get the `assistantId` from the created assistant
5. Save for later use in FastAPI

---

### Step 2: FastAPI Backend (Semantic Cache)

Create file: `main.py`

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import redis
import json
import hashlib
import time
from datetime import datetime
import os
from openai import OpenAI

app = FastAPI()

# Initialize Redis for semantic cache (works with Docker and local)
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=6379,
    db=0,
    decode_responses=True
)

# Initialize OpenAI
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Arizona property database (mock - replace with real DB)
PROPERTY_DB = {
    "123 Main St, Phoenix, AZ 85001": {
        "water_rights": {
            "source": "groundwater",
            "acre_feet": 2.5,
            "adwr_certificate": "GWC-2020-001",
            "status": "valid",
            "disclosure": "Property has 2.5 acre-feet annual groundwater rights per ADWR certificate GWC-2020-001"
        },
        "solar_lease": {
            "provider": "Sunrun",
            "monthly_payment": 89,
            "contract_end": "2044-12-31",
            "buyout_price": 15000
        },
        "hoa": {
            "name": "Paradise Valley Estates",
            "monthly_fee": 250,
            "restrictions": ["Max 2 vehicles", "Solar panels allowed (roof-mounted only)", "Landscaping approval required"]
        }
    }
}

# Cache hit/miss tracking
cache_stats = {
    "hits": 0,
    "misses": 0,
    "total_latency": 0,
    "cache_latency": 0
}

def generate_cache_key(address: str, query_type: str) -> str:
    """Generate Redis cache key from property address + query type"""
    key_input = f"{address.lower()}:{query_type}"
    return f"property:{hashlib.md5(key_input.encode()).hexdigest()}"

@app.post("/api/lookup_property")
async def lookup_property(request: Request):
    """
    Called by Vapi when lookup_property tool is invoked.
    
    Expected input:
    {
        "address": "123 Main St, Phoenix, AZ 85001",
        "query_type": "water_rights"
    }
    
    Returns property info + caching stats
    """
    
    request_start = time.time()
    
    try:
        body = await request.json()
        address = body.get("address", "").strip()
        query_type = body.get("query_type", "general_info")
        
        if not address:
            return JSONResponse({
                "error": "Address required",
                "success": False
            }, status_code=400)
        
        # Check Redis cache first
        cache_key = generate_cache_key(address, query_type)
        cached_result = redis_client.get(cache_key)
        
        if cached_result:
            # Cache hit!
            cache_stats["hits"] += 1
            cache_latency = time.time() - request_start
            cache_stats["cache_latency"] += cache_latency
            
            print(f"✅ CACHE HIT: {address} ({query_type}) - {cache_latency*1000:.1f}ms")
            
            result = json.loads(cached_result)
            result["cache_hit"] = True
            result["latency_ms"] = cache_latency * 1000
            return JSONResponse(result)
        
        # Cache miss - look up in database
        cache_stats["misses"] += 1
        
        if address not in PROPERTY_DB:
            # Not in mock DB - would hit real database here
            return JSONResponse({
                "error": f"Property not found: {address}",
                "success": False,
                "cache_hit": False
            }, status_code=404)
        
        property_data = PROPERTY_DB[address]
        
        # Get requested information
        if query_type == "water_rights":
            result = {
                "success": True,
                "address": address,
                "type": "water_rights",
                "data": property_data["water_rights"],
                "retrieved_at": datetime.now().isoformat()
            }
        elif query_type == "solar_lease":
            result = {
                "success": True,
                "address": address,
                "type": "solar_lease",
                "data": property_data["solar_lease"],
                "retrieved_at": datetime.now().isoformat()
            }
        elif query_type == "hoa_rules":
            result = {
                "success": True,
                "address": address,
                "type": "hoa_rules",
                "data": property_data["hoa"],
                "retrieved_at": datetime.now().isoformat()
            }
        else:  # general_info
            result = {
                "success": True,
                "address": address,
                "type": "general_info",
                "data": property_data,
                "retrieved_at": datetime.now().isoformat()
            }
        
        # Cache the result for 24 hours
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        total_latency = time.time() - request_start
        cache_stats["total_latency"] += total_latency
        
        result["cache_hit"] = False
        result["latency_ms"] = total_latency * 1000
        
        print(f"❌ CACHE MISS: {address} ({query_type}) - {total_latency*1000:.1f}ms")
        
        return JSONResponse(result)
    
    except Exception as e:
        print(f"Error in lookup_property: {str(e)}")
        return JSONResponse({
            "error": str(e),
            "success": False
        }, status_code=500)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/stats")
async def get_cache_stats():
    """Get cache hit/miss statistics"""
    total_requests = cache_stats["hits"] + cache_stats["misses"]
    hit_rate = (cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
    avg_latency = (cache_stats["total_latency"] / cache_stats["misses"] * 1000) if cache_stats["misses"] > 0 else 0
    avg_cache_latency = (cache_stats["cache_latency"] / cache_stats["hits"] * 1000) if cache_stats["hits"] > 0 else 0
    
    return {
        "total_requests": total_requests,
        "cache_hits": cache_stats["hits"],
        "cache_misses": cache_stats["misses"],
        "hit_rate_percent": hit_rate,
        "avg_latency_ms": avg_latency,
        "avg_cache_latency_ms": avg_cache_latency,
        "improvement_factor": avg_latency / avg_cache_latency if avg_cache_latency > 0 else 0
    }

@app.post("/reset_stats")
async def reset_stats():
    """Reset cache statistics"""
    global cache_stats
    cache_stats = {
        "hits": 0,
        "misses": 0,
        "total_latency": 0,
        "cache_latency": 0
    }
    return {"message": "Stats reset"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

### Step 3: Docker Compose (Redis Setup)

Create file: `docker-compose.yml`

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  fastapi:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      redis:
        condition: service_healthy
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_HOST=redis
    volumes:
      - .:/app

volumes:
  redis_data:
```

**Create Dockerfile:**

Create file: `Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Create requirements.txt:**

Create file: `requirements.txt`

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
redis==5.0.1
openai==1.3.0
pydantic==2.5.0
python-dotenv==1.0.0
```

**To run:**

```bash
# Start containers
docker-compose up -d

# Check logs
docker-compose logs -f fastapi

# Stop
docker-compose down
```

---

### Step 4: Testing Script (Measure Improvement)

Create file: `test_phase1.py`

```python
import requests
import time
import json
import statistics

BASE_URL = "http://localhost:8000"

test_queries = [
    {
        "address": "123 Main St, Phoenix, AZ 85001",
        "query_type": "water_rights"
    },
    {
        "address": "123 Main St, Phoenix, AZ 85001",
        "query_type": "water_rights"  # Repeat - should be cached
    },
    {
        "address": "123 Main St, Phoenix, AZ 85001",
        "query_type": "solar_lease"
    },
    {
        "address": "123 Main St, Phoenix, AZ 85001",
        "query_type": "solar_lease"  # Repeat - should be cached
    },
]

def run_test():
    """Run test queries and measure latency"""
    print("\n" + "="*60)
    print("PHASE 1 BENCHMARK TEST")
    print("="*60 + "\n")
    
    latencies = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"Test {i}: {query['address'][:30]}... ({query['query_type']})")
        
        start = time.time()
        response = requests.post(f"{BASE_URL}/api/lookup_property", json=query)
        latency = (time.time() - start) * 1000
        
        latencies.append(latency)
        
        if response.status_code == 200:
            data = response.json()
            cache_hit = data.get("cache_hit", False)
            print(f"  ✅ Success | Latency: {latency:.1f}ms | Cache: {'HIT' if cache_hit else 'MISS'}")
        else:
            print(f"  ❌ Error: {response.status_code}")
    
    # Get stats
    stats_response = requests.get(f"{BASE_URL}/stats")
    stats = stats_response.json()
    
    print("\n" + "-"*60)
    print("RESULTS")
    print("-"*60)
    print(f"Total Requests: {stats['total_requests']}")
    print(f"Cache Hits: {stats['cache_hits']}")
    print(f"Cache Misses: {stats['cache_misses']}")
    print(f"Hit Rate: {stats['hit_rate_percent']:.1f}%")
    print(f"Avg Latency (misses): {stats['avg_latency_ms']:.1f}ms")
    print(f"Avg Latency (hits): {stats['avg_cache_latency_ms']:.1f}ms")
    print(f"Improvement Factor: {stats['improvement_factor']:.1f}x faster")
    print("\n✅ Phase 1 test complete!")

if __name__ == "__main__":
    # First, reset stats
    requests.post(f"{BASE_URL}/reset_stats")
    
    # Wait for server
    for _ in range(5):
        try:
            requests.get(f"{BASE_URL}/health")
            break
        except:
            time.sleep(1)
    
    run_test()
```

**To run:**

```bash
python test_phase1.py
```

---

### Phase 1 Checklist

- [ ] Created Vapi Assistant with config JSON
- [ ] Got assistantId from Vapi dashboard
- [ ] Created FastAPI main.py
- [ ] Created docker-compose.yml
- [ ] Ran: `docker-compose up -d`
- [ ] Ran: `python test_phase1.py`
- [ ] Confirmed cache hits on repeat queries
- [ ] Measured latency improvement (target: -60% on repeats)
- [ ] Updated Vapi webhook URL to your FastAPI server
- [ ] Made a test call through Vapi (check logs)

---

## PHASE 2: HYBRID RAG (WEEKS 3-6)

### Architecture Addition

```
FastAPI Backend (from Phase 1)
    ├─ Check Redis semantic cache (Phase 1)
    ├─ If miss:
    │   ├─ Call Pinecone (vector search)
    │   ├─ Call Elasticsearch (full-text)
    │   └─ Merge results (RRF algorithm)
    └─ Cache result + return
```

### Step 1: Pinecone Setup

```python
# Install: pip install pinecone-client

from pinecone import Pinecone

pc = Pinecone(api_key="your-pinecone-api-key")

# Create index
pc.create_index(
    name="arizona-properties",
    dimension=1536,  # text-embedding-3-small
    metric="cosine",
    spec=ServerlessSpec(
        cloud="aws",
        region="us-west-2"
    )
)

# Index property data
from openai import OpenAI

client = OpenAI()
index = pc.Index("arizona-properties")

properties = [
    {
        "id": "prop_001",
        "address": "123 Main St, Phoenix, AZ 85001",
        "water_source": "groundwater",
        "acre_feet": 2.5,
        "solar": "roof_mounted",
        "hoa": "Paradise Valley Estates"
    },
    # ... more properties
]

for prop in properties:
    text = f"{prop['address']} water {prop['water_source']} solar {prop['solar']} hoa {prop['hoa']}"
    
    embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    ).data[0].embedding
    
    index.upsert([(prop['id'], embedding, {"address": prop['address']})])
```

### Step 2: Elasticsearch Setup

```yaml
# Add to docker-compose.yml

elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - ES_JAVA_OPTS=-Xms512m -Xmx512m
  ports:
    - "9200:9200"
  volumes:
    - elasticsearch_data:/usr/share/elasticsearch/data

volumes:
  elasticsearch_data:
```

### Step 3: Hybrid Retrieval (RRF)

```python
# Add to main.py (Phase 2 enhancement)

from pinecone import Pinecone
from elasticsearch import Elasticsearch
import numpy as np

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
es_client = Elasticsearch(["http://localhost:9200"])

def hybrid_search(query: str, top_k: int = 3):
    """
    Hybrid retrieval using RRF (Reciprocal Rank Fusion)
    Combines vector search (Pinecone) + full-text (Elasticsearch)
    """
    
    # Vector search via Pinecone
    query_embedding = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    ).data[0].embedding
    
    index = pc.Index("arizona-properties")
    vector_results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )
    
    # Full-text search via Elasticsearch
    es_results = es_client.search(
        index="properties",
        body={
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["address", "water_source", "solar_type", "hoa_name"]
                }
            },
            "size": top_k
        }
    )
    
    # RRF scoring
    rrf_scores = {}
    
    for i, result in enumerate(vector_results['matches']):
        doc_id = result['metadata']['address']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (60 + i)
    
    for i, hit in enumerate(es_results['hits']['hits']):
        doc_id = hit['_source']['address']
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1 / (60 + i)
    
    # Sort by RRF score
    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    return [{"address": addr, "score": score} for addr, score in ranked[:top_k]]
```

### Phase 2 Checklist

- [ ] Created Pinecone index "arizona-properties"
- [ ] Indexed 100+ Arizona properties with embeddings
- [ ] Set up Elasticsearch in docker-compose.yml
- [ ] Ran: `docker-compose up -d elasticsearch`
- [ ] Implemented hybrid_search function in FastAPI
- [ ] Updated lookup_property to use hybrid search
- [ ] Ran: `python test_phase1.py` (should still work)
- [ ] Measured retrieval latency (target: <100ms)
- [ ] Tested accuracy on 50 sample queries (target: >95%)
- [ ] Verified water rights disclosure accuracy (target: 100%)

---

## PHASE 3: AUDIO CACHING + PRODUCTION (WEEKS 7-12)

### Audio Caching Implementation

```python
# Add to main.py

import boto3

s3_client = boto3.client('s3')
AUDIO_BUCKET = "your-audio-cache-bucket"

def cache_audio_response(script: str, voice_id: str) -> str:
    """
    Cache TTS audio in S3 + Redis
    Return S3 URL if exists, generate if not
    """
    
    script_hash = hashlib.md5(f"{script}:{voice_id}".encode()).hexdigest()
    cache_key = f"audio:{script_hash}"
    
    # Check Redis hot cache
    cached_url = redis_client.get(cache_key)
    if cached_url:
        print(f"✅ Audio cache HIT: {script_hash}")
        return cached_url
    
    # Check S3
    try:
        s3_url = f"s3://{AUDIO_BUCKET}/{script_hash}.mp3"
        s3_client.head_object(Bucket=AUDIO_BUCKET, Key=f"{script_hash}.mp3")
        print(f"✅ S3 cache HIT: {script_hash}")
        
        # Warm Redis
        redis_client.setex(cache_key, 3600, s3_url)
        return s3_url
    except:
        pass
    
    # Generate via OpenAI TTS
    print(f"❌ Audio cache MISS: {script_hash} - generating...")
    
    audio_response = openai_client.audio.speech.create(
        model="tts-1",
        voice=voice_id,
        input=script
    )
    
    # Save to S3
    s3_client.upload_fileobj(
        audio_response.content,
        AUDIO_BUCKET,
        f"{script_hash}.mp3",
        ExtraArgs={'ContentType': 'audio/mpeg'}
    )
    
    s3_url = f"s3://{AUDIO_BUCKET}/{script_hash}.mp3"
    redis_client.setex(cache_key, 3600, s3_url)
    
    return s3_url
```

### Production Monitoring

```python
# Add to main.py

from prometheus_client import Counter, Histogram, start_http_server

# Metrics
call_count = Counter('vapi_calls_total', 'Total calls', ['status'])
latency_histogram = Histogram('vapi_latency_ms', 'Latency in ms', buckets=[100, 300, 500, 800, 1000])
cache_hit_rate = Gauge('cache_hit_rate', 'Cache hit rate')

@app.middleware("http")
async def add_metrics(request: Request, call_next):
    """Middleware to capture metrics"""
    start = time.time()
    response = await call_next(request)
    latency = (time.time() - start) * 1000
    
    latency_histogram.observe(latency)
    call_count.labels(status=response.status_code).inc()
    
    return response

# Start Prometheus metrics endpoint
start_http_server(8001)
```

### TCPA Compliance Logging

```python
# Add to main.py

def log_tcpa_event(phone: str, event_type: str, consent_status: str, ai_disclosure_given: bool):
    """Log TCPA compliance event"""
    
    event = {
        "timestamp": datetime.now().isoformat(),
        "phone": phone,
        "event_type": event_type,  # "call_initiated", "ai_disclosed", "consent_verified"
        "consent_status": consent_status,  # "verified", "not_verified", "explicit"
        "ai_disclosure": ai_disclosure_given
    }
    
    # Save to PostgreSQL for audit trail
    # (pseudocode)
    # db.tcpa_events.insert_one(event)
    
    print(f"📋 TCPA Event: {event_type} | Phone: {phone} | Consent: {consent_status}")
    
    return event
```

### Phase 3 Checklist

- [ ] Set up S3 bucket for audio cache
- [ ] Implemented cache_audio_response function
- [ ] Set up Prometheus metrics collection
- [ ] Created Grafana dashboard (latency, cache hit rate, error rate)
- [ ] Implemented TCPA compliance logging
- [ ] Tested with 100 concurrent calls (load test)
- [ ] Verified latency P95 <800ms
- [ ] Verified error rate <1%
- [ ] Created runbooks for on-call engineers
- [ ] Trained team on monitoring + troubleshooting
- [ ] Deployed to production environment
- [ ] Set up alerts for latency spikes, error rate >1%

---

## DEPLOYMENT CHECKLIST (ALL PHASES)

### Pre-Deployment

- [ ] All code reviewed by 2+ engineers
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass (Phase 1, 2, 3 separately)
- [ ] Load test passed (100+ concurrent calls)
- [ ] Security review completed (no PII in logs, encryption at rest)
- [ ] TCPA compliance verified (consent tracking working)
- [ ] Rollback plan documented

### Deployment (Night/Weekend)

- [ ] Backup databases (Redis, Elasticsearch, Pinecone)
- [ ] Deploy to staging environment
- [ ] Run smoke tests (Phase 1-3 all working)
- [ ] Deploy to production (blue-green if possible)
- [ ] Monitor error rate for 30 minutes
- [ ] Verify latency metrics within budget

### Post-Deployment

- [ ] Verify Vapi calls working end-to-end
- [ ] Check cache hit rates (target: >40% semantic, >30% audio)
- [ ] Verify cost per call (target: <$1.00)
- [ ] Team standby for 24 hours
- [ ] Document any issues + fixes

---

## REQUIREMENTS

### Python Dependencies

```bash
pip install fastapi uvicorn redis openai pinecone-client elasticsearch boto3 prometheus-client psycopg2-binary pydantic
```

### Environment Variables

```bash
export OPENAI_API_KEY="sk-..."
export PINECONE_API_KEY="..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export VAPI_API_KEY="..."
export VAPI_ASSISTANT_ID="..."
```

### Infrastructure

- AWS Account (or GCP)
- S3 bucket for audio cache
- Pinecone account (free tier available)
- Vapi.ai account with API key

---

## MONITORING DASHBOARD (GRAFANA)

Key metrics to track:

```sql
-- Latency (P50, P95, P99)
SELECT quantile(0.95)(latency_ms) FROM vapi_calls;

-- Cache hit rate
SELECT COUNT(*) FILTER (WHERE cache_hit = true) / COUNT(*) FROM lookups;

-- Cost per call
SELECT SUM(cost) / COUNT(*) FROM vapi_calls;

-- Error rate
SELECT COUNT(*) FILTER (WHERE error = true) / COUNT(*) FROM vapi_calls;

-- TCPA violations
SELECT COUNT(*) FROM tcpa_events WHERE consent_status = 'not_verified';
```

---

## SUCCESS METRICS (FINAL)

When Phase 3 is complete:

| Metric | Target | Actual |
|--------|--------|--------|
| Voice-to-voice latency P95 | <800ms | ___ |
| Semantic cache hit rate | >40% | ___ |
| Audio cache hit rate | >30% | ___ |
| Property retrieval accuracy | >95% | ___ |
| Water rights disclosure accuracy | 100% | ___ |
| TCPA compliance | 100% | ___ |
| System uptime | >99.9% | ___ |
| Cost per call | <$1.00 | ___ |

---

**Document version:** 1.1  
**Last updated:** January 22, 2026  
**Status:** Ready for implementation
