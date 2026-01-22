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
            print(f"  [OK] Success | Latency: {latency:.1f}ms | Cache: {'HIT' if cache_hit else 'MISS'}")
        else:
            print(f"  [FAIL] Error: {response.status_code}")
    
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
    print("\n[OK] Phase 1 test complete!")

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
