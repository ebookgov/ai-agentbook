# Phase 1: Prompt Caching + Semantic Cache

This directory contains the Phase 1 implementation for the Arizona Real Estate Voice Agent backend.

## Files

- **main.py** - FastAPI backend with Redis semantic caching
- **docker-compose.yml** - Docker setup for Redis + FastAPI
- **Dockerfile** - Container configuration for FastAPI
- **requirements.txt** - Python dependencies
- **test_phase1.py** - Benchmark test script

## Quick Start

### 1. Set Environment Variables

```bash
# .env file is already created with your Cerebras API key
# If you need to change it, edit phase1_implementation/.env
```

### 2. Start Services

```bash
# Build and start containers
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 3. Run Tests

```bash
# Install test dependencies
pip install requests

# Run benchmark
python test_phase1.py
```

### 4. Check Health

```bash
# Health check
curl http://localhost:8000/health

# Cache statistics
curl http://localhost:8000/stats
```

## Expected Results

- **Cache Hit Latency:** ~10-50ms
- **Cache Miss Latency:** ~100-300ms
- **Cache Hit Rate:** >50% on repeat queries
- **Improvement Factor:** 3-6x faster on hits

## API Endpoints

### POST /api/lookup_property

```json
{
  "address": "123 Main St, Phoenix, AZ 85001",
  "query_type": "water_rights"
}
```

### GET /health

Returns service health status

### GET /stats

Returns cache performance statistics

### POST /reset_stats

Resets cache statistics

## Next Steps

After verifying Phase 1 works:

1. Update Vapi assistant webhook URL
2. Test end-to-end call flow
3. Proceed to Phase 2 (Hybrid RAG)
