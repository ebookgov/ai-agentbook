"""
Phase 2 FastAPI Backend - Hybrid RAG with Semantic Cache
Combines Redis caching, Pinecone vector search, and Elasticsearch full-text
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import redis
import json
import hashlib
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="Arizona Property API - Phase 2 Hybrid RAG")

# Initialize Redis for semantic cache
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=6379,
    db=0,
    decode_responses=True
)

# Initialize Pinecone (lazy loading)
pinecone_index = None

# Initialize Elasticsearch (lazy loading)
es_client = None

# Initialize embedding model (lazy loading)
embedding_model = None

def get_pinecone_index():
    """Lazy load Pinecone index"""
    global pinecone_index
    if pinecone_index is None:
        from pinecone import Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        pinecone_index = pc.Index("arizona-properties")
    return pinecone_index

def get_es_client():
    """Lazy load Elasticsearch client"""
    global es_client
    if es_client is None:
        from elasticsearch import Elasticsearch
        es_host = os.getenv("ELASTICSEARCH_HOST", "localhost")
        es_client = Elasticsearch([f"http://{es_host}:9200"])
    return es_client

def get_embedding_model():
    """Lazy load embedding model"""
    global embedding_model
    if embedding_model is None:
        from sentence_transformers import SentenceTransformer
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    return embedding_model

# Cache hit/miss tracking
cache_stats = {
    "hits": 0,
    "misses": 0,
    "total_latency": 0,
    "cache_latency": 0,
    "hybrid_searches": 0
}

def generate_cache_key(query: str) -> str:
    """Generate Redis cache key from query"""
    return f"hybrid:{hashlib.md5(query.lower().encode()).hexdigest()}"


def hybrid_search(query: str, top_k: int = 5) -> list:
    """
    Hybrid retrieval using RRF (Reciprocal Rank Fusion)
    Combines vector search (Pinecone) + full-text (Elasticsearch)
    """
    cache_stats["hybrid_searches"] += 1
    
    # Generate embedding for vector search
    model = get_embedding_model()
    query_embedding = model.encode(query).tolist()
    
    # Vector search via Pinecone
    index = get_pinecone_index()
    vector_results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )
    
    # Full-text search via Elasticsearch
    es = get_es_client()
    es_results = es.search(
        index="properties",
        body={
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["address", "city", "water_source", "solar_provider", "hoa_name"]
                }
            },
            "size": top_k
        }
    )
    
    # RRF scoring (k=60 is standard)
    rrf_scores = {}
    k = 60
    
    # Score from Pinecone results
    for i, match in enumerate(vector_results.matches):
        address = match.metadata.get('address', match.id)
        rrf_scores[address] = rrf_scores.get(address, 0) + 1 / (k + i + 1)
    
    # Score from Elasticsearch results
    for i, hit in enumerate(es_results['hits']['hits']):
        address = hit['_source']['address']
        rrf_scores[address] = rrf_scores.get(address, 0) + 1 / (k + i + 1)
    
    # Sort by RRF score (descending)
    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Build result with metadata
    results = []
    for address, score in ranked[:top_k]:
        # Get metadata from Pinecone or ES
        metadata = {}
        for match in vector_results.matches:
            if match.metadata.get('address') == address:
                metadata = dict(match.metadata)
                break
        
        if not metadata:
            for hit in es_results['hits']['hits']:
                if hit['_source']['address'] == address:
                    metadata = hit['_source']
                    break
        
        results.append({
            "address": address,
            "rrf_score": score,
            "metadata": metadata
        })
    
    return results


@app.post("/api/hybrid_search")
async def api_hybrid_search(request: Request):
    """
    Hybrid search endpoint combining vector + full-text search
    
    Input: {"query": "property with groundwater in Phoenix"}
    Output: Ranked list of matching properties
    """
    request_start = time.time()
    
    try:
        body = await request.json()
        query = body.get("query", "").strip()
        top_k = body.get("top_k", 5)
        
        if not query:
            return JSONResponse({
                "error": "Query required",
                "success": False
            }, status_code=400)
        
        # Check cache first
        cache_key = generate_cache_key(query)
        cached_result = redis_client.get(cache_key)
        
        if cached_result:
            cache_stats["hits"] += 1
            cache_latency = time.time() - request_start
            cache_stats["cache_latency"] += cache_latency
            
            result = json.loads(cached_result)
            result["cache_hit"] = True
            result["latency_ms"] = cache_latency * 1000
            print(f"[CACHE HIT] {query[:50]} - {cache_latency*1000:.1f}ms")
            return JSONResponse(result)
        
        # Cache miss - perform hybrid search
        cache_stats["misses"] += 1
        
        results = hybrid_search(query, top_k)
        
        result = {
            "success": True,
            "query": query,
            "results": results,
            "result_count": len(results),
            "retrieved_at": datetime.now().isoformat()
        }
        
        # Cache for 1 hour
        redis_client.setex(cache_key, 3600, json.dumps(result))
        
        total_latency = time.time() - request_start
        cache_stats["total_latency"] += total_latency
        
        result["cache_hit"] = False
        result["latency_ms"] = total_latency * 1000
        
        print(f"[CACHE MISS] {query[:50]} - {total_latency*1000:.1f}ms")
        
        return JSONResponse(result)
    
    except Exception as e:
        print(f"Error in hybrid_search: {str(e)}")
        return JSONResponse({
            "error": str(e),
            "success": False
        }, status_code=500)


@app.post("/api/lookup_property")
async def lookup_property(request: Request):
    """
    Property lookup endpoint (Phase 1 compatible)
    Now uses hybrid search for property retrieval
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
        
        # Check cache first
        cache_key = f"property:{hashlib.md5(f'{address.lower()}:{query_type}'.encode()).hexdigest()}"
        cached_result = redis_client.get(cache_key)
        
        if cached_result:
            cache_stats["hits"] += 1
            cache_latency = time.time() - request_start
            cache_stats["cache_latency"] += cache_latency
            
            result = json.loads(cached_result)
            result["cache_hit"] = True
            result["latency_ms"] = cache_latency * 1000
            print(f"[CACHE HIT] {address} ({query_type}) - {cache_latency*1000:.1f}ms")
            return JSONResponse(result)
        
        # Cache miss - use hybrid search to find property
        cache_stats["misses"] += 1
        
        results = hybrid_search(address, top_k=1)
        
        if not results:
            return JSONResponse({
                "error": f"Property not found: {address}",
                "success": False,
                "cache_hit": False
            }, status_code=404)
        
        property_data = results[0]["metadata"]
        
        # Format response based on query_type
        if query_type == "water_rights":
            data = {
                "source": property_data.get("water_source", "unknown"),
                "acre_feet": property_data.get("acre_feet", 0),
                "adwr_certificate": property_data.get("adwr_certificate", ""),
                "status": "valid"
            }
        elif query_type == "solar_lease":
            data = {
                "type": property_data.get("solar", "none"),
                "provider": property_data.get("solar_provider", "")
            }
        elif query_type == "hoa_rules":
            data = {
                "name": property_data.get("hoa_name", ""),
                "monthly_fee": property_data.get("hoa_fee", 0)
            }
        else:
            data = property_data
        
        result = {
            "success": True,
            "address": results[0]["address"],
            "type": query_type,
            "data": data,
            "rrf_score": results[0]["rrf_score"],
            "retrieved_at": datetime.now().isoformat()
        }
        
        # Cache for 24 hours
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        total_latency = time.time() - request_start
        cache_stats["total_latency"] += total_latency
        
        result["cache_hit"] = False
        result["latency_ms"] = total_latency * 1000
        
        print(f"[CACHE MISS] {address} ({query_type}) - {total_latency*1000:.1f}ms")
        
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
    status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "phase": 2,
        "components": {
            "redis": "unknown",
            "pinecone": "unknown",
            "elasticsearch": "unknown"
        }
    }
    
    # Check Redis
    try:
        redis_client.ping()
        status["components"]["redis"] = "healthy"
    except:
        status["components"]["redis"] = "unhealthy"
    
    # Check Pinecone
    try:
        index = get_pinecone_index()
        stats = index.describe_index_stats()
        status["components"]["pinecone"] = f"healthy ({stats.total_vector_count} vectors)"
    except Exception as e:
        status["components"]["pinecone"] = f"unhealthy: {str(e)}"
    
    # Check Elasticsearch
    try:
        es = get_es_client()
        es.info()
        count = es.count(index="properties")['count']
        status["components"]["elasticsearch"] = f"healthy ({count} docs)"
    except Exception as e:
        status["components"]["elasticsearch"] = f"unhealthy: {str(e)}"
    
    return status


@app.get("/stats")
async def get_cache_stats():
    """Get cache and hybrid search statistics"""
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
        "improvement_factor": avg_latency / avg_cache_latency if avg_cache_latency > 0 else 0,
        "hybrid_searches": cache_stats["hybrid_searches"]
    }


@app.post("/reset_stats")
async def reset_stats():
    """Reset cache statistics"""
    global cache_stats
    cache_stats = {
        "hits": 0,
        "misses": 0,
        "total_latency": 0,
        "cache_latency": 0,
        "hybrid_searches": 0
    }
    return {"message": "Stats reset"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
