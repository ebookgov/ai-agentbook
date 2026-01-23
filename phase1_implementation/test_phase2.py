"""
Phase 2 Test Script - Hybrid RAG Verification
Tests hybrid search combining Pinecone + Elasticsearch
"""

import requests
import time
import json

BASE_URL = "http://127.0.0.1:8000"

# Test queries for hybrid search
HYBRID_TEST_QUERIES = [
    "property with groundwater rights in Phoenix",
    "Tesla solar panels",
    "HOA Paradise Valley Estates",
    "well water Sedona",
    "surface water Scottsdale"
]

# Test property lookups (backward compatibility)
PROPERTY_LOOKUPS = [
    {"address": "123 Main St, Phoenix, AZ 85001", "query_type": "water_rights"},
    {"address": "456 Desert Vista Dr, Scottsdale, AZ 85251", "query_type": "solar_lease"},
    {"address": "123 Main St, Phoenix, AZ 85001", "query_type": "hoa_rules"},
]

def test_health():
    """Test health endpoint and component status"""
    print("\n" + "=" * 60)
    print("HEALTH CHECK")
    print("=" * 60)
    
    try:
        print(f"Connecting to {BASE_URL}/health...")
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        health = response.json()
        
        print(f"Status: {health['status']}")
        print(f"Phase: {health.get('phase', 1)}")
        print("\nComponents:")
        for name, status in health.get('components', {}).items():
            indicator = "[OK]" if "healthy" in status else "[FAIL]"
            print(f"  {indicator} {name}: {status}")
        
        return health['status'] == 'healthy'
    except Exception as e:
        print(f"[FAIL] Health check failed: {e}")
        return False


def test_hybrid_search():
    """Test hybrid search endpoint"""
    print("\n" + "=" * 60)
    print("HYBRID SEARCH TESTS")
    print("=" * 60)
    
    latencies = []
    success_count = 0
    
    for query in HYBRID_TEST_QUERIES:
        print(f"\nQuery: '{query}'")
        
        start = time.time()
        try:
            response = requests.post(
                f"{BASE_URL}/api/hybrid_search",
                json={"query": query, "top_k": 3},
                timeout=30
            )
            latency = (time.time() - start) * 1000
            latencies.append(latency)
            
            if response.status_code == 200:
                data = response.json()
                cache_hit = data.get("cache_hit", False)
                results = data.get("results", [])
                
                print(f"  [OK] {len(results)} results | {latency:.1f}ms | Cache: {'HIT' if cache_hit else 'MISS'}")
                
                for i, result in enumerate(results[:3], 1):
                    addr = result.get('address', 'Unknown')[:40]
                    score = result.get('rrf_score', 0)
                    print(f"    {i}. {addr}... (RRF: {score:.4f})")
                
                success_count += 1
            else:
                print(f"  [FAIL] Status {response.status_code}: {response.text[:100]}")
        except Exception as e:
            print(f"  [FAIL] Error: {e}")
    
    print(f"\n--- Hybrid Search Summary ---")
    print(f"Success: {success_count}/{len(HYBRID_TEST_QUERIES)}")
    if latencies:
        print(f"Avg Latency: {sum(latencies)/len(latencies):.1f}ms")
        print(f"Min Latency: {min(latencies):.1f}ms")
        print(f"Max Latency: {max(latencies):.1f}ms")
    
    return success_count == len(HYBRID_TEST_QUERIES)


def test_property_lookup():
    """Test backward-compatible property lookup"""
    print("\n" + "=" * 60)
    print("PROPERTY LOOKUP TESTS (Phase 1 Compatibility)")
    print("=" * 60)
    
    success_count = 0
    
    for lookup in PROPERTY_LOOKUPS:
        print(f"\nAddress: {lookup['address'][:40]}...")
        print(f"Type: {lookup['query_type']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/lookup_property",
                json=lookup,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                cache_hit = data.get("cache_hit", False)
                latency = data.get("latency_ms", 0)
                
                print(f"  [OK] {latency:.1f}ms | Cache: {'HIT' if cache_hit else 'MISS'}")
                print(f"  Data: {json.dumps(data.get('data', {}), indent=2)[:200]}...")
                success_count += 1
            else:
                print(f"  [FAIL] Status {response.status_code}")
        except Exception as e:
            print(f"  [FAIL] Error: {e}")
    
    print(f"\n--- Property Lookup Summary ---")
    print(f"Success: {success_count}/{len(PROPERTY_LOOKUPS)}")
    
    return success_count == len(PROPERTY_LOOKUPS)


def test_cache_performance():
    """Test cache performance by repeating queries"""
    print("\n" + "=" * 60)
    print("CACHE PERFORMANCE TEST")
    print("=" * 60)
    
    query = "groundwater Phoenix"
    
    # First request (cache miss)
    print("\n1. First request (should be cache miss)...")
    start = time.time()
    response = requests.post(
        f"{BASE_URL}/api/hybrid_search",
        json={"query": query},
        timeout=30
    )
    first_latency = (time.time() - start) * 1000
    first_data = response.json()
    print(f"   Latency: {first_latency:.1f}ms | Cache: {'HIT' if first_data.get('cache_hit') else 'MISS'}")
    
    # Second request (should be cache hit)
    print("\n2. Second request (should be cache hit)...")
    start = time.time()
    response = requests.post(
        f"{BASE_URL}/api/hybrid_search",
        json={"query": query},
        timeout=30
    )
    second_latency = (time.time() - start) * 1000
    second_data = response.json()
    print(f"   Latency: {second_latency:.1f}ms | Cache: {'HIT' if second_data.get('cache_hit') else 'MISS'}")
    
    if second_data.get('cache_hit') and second_latency < first_latency:
        improvement = first_latency / second_latency if second_latency > 0 else 0
        print(f"\n[OK] Cache working! {improvement:.1f}x faster on cache hit")
        return True
    else:
        print("\n[WARN] Cache may not be working correctly")
        return False


def get_stats():
    """Get and display statistics"""
    print("\n" + "=" * 60)
    print("STATISTICS")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/stats")
    stats = response.json()
    
    print(f"Total Requests: {stats['total_requests']}")
    print(f"Cache Hits: {stats['cache_hits']}")
    print(f"Cache Misses: {stats['cache_misses']}")
    print(f"Hit Rate: {stats['hit_rate_percent']:.1f}%")
    print(f"Hybrid Searches: {stats.get('hybrid_searches', 0)}")
    print(f"Avg Latency (miss): {stats['avg_latency_ms']:.1f}ms")
    print(f"Avg Latency (hit): {stats['avg_cache_latency_ms']:.1f}ms")


if __name__ == "__main__":
    print("=" * 60)
    print("PHASE 2 HYBRID RAG TEST SUITE")
    print("=" * 60)
    
    # Reset stats first
    try:
        requests.post(f"{BASE_URL}/reset_stats")
    except:
        pass
    
    # Wait for server
    print("\n[INFO] Waiting for server...")
    for i in range(10):
        try:
            requests.get(f"{BASE_URL}/health", timeout=5)
            print("[OK] Server is ready!")
            break
        except:
            print(f"  Attempt {i+1}/10...")
            time.sleep(2)
    else:
        print("[FAIL] Server not responding. Make sure to run:")
        print("  cd phase1_implementation")
        print("  python main.py")
        exit(1)
    
    # Run tests
    results = {
        "health": test_health(),
        "hybrid_search": test_hybrid_search(),
        "property_lookup": test_property_lookup(),
        "cache": test_cache_performance(),
    }
    
    # Show stats
    get_stats()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[OK] ALL PHASE 2 TESTS PASSED!")
    else:
        print("[WARN] Some tests failed - review above for details")
    print("=" * 60)
