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

# Initialize Cerebras (OpenAI-compatible API)
openai_client = OpenAI(
    api_key=os.getenv("CEREBRAS_API_KEY"),
    base_url="https://api.cerebras.ai/v1"
)

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
