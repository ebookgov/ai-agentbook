"""
Phase 2 - Elasticsearch Setup Script
Creates index and populates Arizona property data for full-text search
"""

import os
from dotenv import load_dotenv
from elasticsearch import Elasticsearch

# Load environment variables from project root .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Initialize Elasticsearch client
ES_HOST = os.getenv("ELASTICSEARCH_HOST", "localhost")
es_client = Elasticsearch([f"http://{ES_HOST}:9200"])

# Index configuration
INDEX_NAME = "properties"

# Arizona properties data (same as Pinecone)
PROPERTIES = [
    {
        "id": "prop_001",
        "address": "123 Main St, Phoenix, AZ 85001",
        "city": "Phoenix",
        "state": "AZ",
        "zip_code": "85001",
        "water_source": "groundwater",
        "acre_feet": 2.5,
        "adwr_certificate": "GWC-2020-001",
        "solar": "roof_mounted",
        "solar_provider": "Sunrun",
        "hoa_name": "Paradise Valley Estates",
        "hoa_fee": 250
    },
    {
        "id": "prop_002",
        "address": "456 Desert Vista Dr, Scottsdale, AZ 85251",
        "city": "Scottsdale",
        "state": "AZ",
        "zip_code": "85251",
        "water_source": "surface_water",
        "acre_feet": 4.0,
        "adwr_certificate": "SWC-2019-042",
        "solar": "ground_mounted",
        "solar_provider": "Tesla",
        "hoa_name": "Desert Vista Community",
        "hoa_fee": 350
    },
    {
        "id": "prop_003",
        "address": "789 Cactus Canyon Rd, Tucson, AZ 85701",
        "city": "Tucson",
        "state": "AZ",
        "zip_code": "85701",
        "water_source": "well",
        "acre_feet": 1.5,
        "adwr_certificate": "WEL-2021-089",
        "solar": "none",
        "solar_provider": None,
        "hoa_name": None,
        "hoa_fee": 0
    },
    {
        "id": "prop_004",
        "address": "321 Sunset Blvd, Mesa, AZ 85201",
        "city": "Mesa",
        "state": "AZ",
        "zip_code": "85201",
        "water_source": "reclaimed",
        "acre_feet": 3.0,
        "adwr_certificate": "REC-2022-015",
        "solar": "roof_mounted",
        "solar_provider": "SunPower",
        "hoa_name": "Mesa Heights HOA",
        "hoa_fee": 175
    },
    {
        "id": "prop_005",
        "address": "555 Mountain View Ln, Flagstaff, AZ 86001",
        "city": "Flagstaff",
        "state": "AZ",
        "zip_code": "86001",
        "water_source": "groundwater",
        "acre_feet": 5.0,
        "adwr_certificate": "GWC-2018-201",
        "solar": "none",
        "solar_provider": None,
        "hoa_name": "Mountain View Estates",
        "hoa_fee": 125
    },
    {
        "id": "prop_006",
        "address": "777 Saguaro Circle, Gilbert, AZ 85234",
        "city": "Gilbert",
        "state": "AZ",
        "zip_code": "85234",
        "water_source": "surface_water",
        "acre_feet": 2.0,
        "adwr_certificate": "SWC-2020-156",
        "solar": "roof_mounted",
        "solar_provider": "Vivint",
        "hoa_name": "Gilbert Gardens",
        "hoa_fee": 200
    },
    {
        "id": "prop_007",
        "address": "888 Adobe Way, Tempe, AZ 85281",
        "city": "Tempe",
        "state": "AZ",
        "zip_code": "85281",
        "water_source": "reclaimed",
        "acre_feet": 1.0,
        "adwr_certificate": "REC-2023-033",
        "solar": "ground_mounted",
        "solar_provider": "Sunrun",
        "hoa_name": "Tempe Gardens HOA",
        "hoa_fee": 225
    },
    {
        "id": "prop_008",
        "address": "999 Red Rock Rd, Sedona, AZ 86336",
        "city": "Sedona",
        "state": "AZ",
        "zip_code": "86336",
        "water_source": "well",
        "acre_feet": 3.5,
        "adwr_certificate": "WEL-2017-412",
        "solar": "none",
        "solar_provider": None,
        "hoa_name": None,
        "hoa_fee": 0
    },
    {
        "id": "prop_009",
        "address": "111 Palm Springs Dr, Chandler, AZ 85225",
        "city": "Chandler",
        "state": "AZ",
        "zip_code": "85225",
        "water_source": "groundwater",
        "acre_feet": 2.8,
        "adwr_certificate": "GWC-2021-078",
        "solar": "roof_mounted",
        "solar_provider": "Tesla",
        "hoa_name": "Chandler Palms",
        "hoa_fee": 275
    },
    {
        "id": "prop_010",
        "address": "222 Copper Ridge Ave, Peoria, AZ 85345",
        "city": "Peoria",
        "state": "AZ",
        "zip_code": "85345",
        "water_source": "surface_water",
        "acre_feet": 4.5,
        "adwr_certificate": "SWC-2022-089",
        "solar": "roof_mounted",
        "solar_provider": "SunPower",
        "hoa_name": "Copper Ridge Community",
        "hoa_fee": 195
    }
]

# Index mapping for better search
INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "address": {"type": "text", "analyzer": "standard"},
            "city": {"type": "keyword"},
            "state": {"type": "keyword"},
            "zip_code": {"type": "keyword"},
            "water_source": {"type": "keyword"},
            "acre_feet": {"type": "float"},
            "adwr_certificate": {"type": "keyword"},
            "solar": {"type": "keyword"},
            "solar_provider": {"type": "keyword"},
            "hoa_name": {"type": "text"},
            "hoa_fee": {"type": "integer"}
        }
    }
}


def create_index():
    """Create Elasticsearch index with mapping"""
    if es_client.indices.exists(index=INDEX_NAME):
        print(f"[INFO] Index '{INDEX_NAME}' already exists, deleting...")
        es_client.indices.delete(index=INDEX_NAME)
    
    print(f"[INFO] Creating index '{INDEX_NAME}'...")
    es_client.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
    print(f"[OK] Index '{INDEX_NAME}' created successfully!")


def index_properties():
    """Index all properties into Elasticsearch"""
    print(f"[INFO] Indexing {len(PROPERTIES)} properties...")
    
    for prop in PROPERTIES:
        doc = {k: v for k, v in prop.items() if k != 'id'}
        es_client.index(index=INDEX_NAME, id=prop['id'], document=doc)
        print(f"  -> Indexed {prop['id']}: {prop['address'][:40]}...")
    
    # Refresh to make documents searchable immediately
    es_client.indices.refresh(index=INDEX_NAME)
    print("[OK] All properties indexed!")
    
    # Get count
    count = es_client.count(index=INDEX_NAME)['count']
    print(f"\n[STATS] Total documents: {count}")


def test_search():
    """Test full-text search"""
    queries = [
        "Phoenix groundwater",
        "Tesla solar",
        "HOA Paradise Valley"
    ]
    
    print("\n[TEST] Running test queries...")
    
    for query in queries:
        print(f"\n  Query: '{query}'")
        
        results = es_client.search(
            index=INDEX_NAME,
            body={
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["address", "city", "water_source", "solar_provider", "hoa_name"]
                    }
                },
                "size": 3
            }
        )
        
        hits = results['hits']['hits']
        if hits:
            for i, hit in enumerate(hits, 1):
                print(f"    {i}. Score: {hit['_score']:.2f} | {hit['_source']['address']}")
        else:
            print("    No results")


if __name__ == "__main__":
    print("=" * 60)
    print("PHASE 2: ELASTICSEARCH SETUP")
    print("=" * 60)
    
    # Check connection
    print("\n[INFO] Checking Elasticsearch connection...")
    try:
        info = es_client.info()
        print(f"[OK] Connected to Elasticsearch {info['version']['number']}")
    except Exception as e:
        print(f"[ERROR] Could not connect to Elasticsearch: {e}")
        print("\nMake sure Elasticsearch is running:")
        print("  docker-compose up -d elasticsearch")
        exit(1)
    
    # Step 1: Create index
    print("\n[Step 1] Creating Elasticsearch index...")
    create_index()
    
    # Step 2: Index properties
    print("\n[Step 2] Indexing properties...")
    index_properties()
    
    # Step 3: Test search
    print("\n[Step 3] Testing full-text search...")
    test_search()
    
    print("\n" + "=" * 60)
    print("[OK] ELASTICSEARCH SETUP COMPLETE!")
    print("=" * 60)
