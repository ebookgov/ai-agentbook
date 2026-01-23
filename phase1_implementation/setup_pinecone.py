"""
Phase 2 - Pinecone Setup Script
Creates index and upserts Arizona property vectors for hybrid RAG
Uses local sentence-transformers for embeddings (all-MiniLM-L6-v2)
"""

import os
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer

# Load environment variables from project root .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Initialize embedding model (runs locally)
print("[INFO] Loading embedding model (first run downloads ~90MB)...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Index configuration
INDEX_NAME = "arizona-properties"
DIMENSION = 384  # all-MiniLM-L6-v2 produces 384-dim vectors
METRIC = "cosine"

# Arizona properties data (expanded from Phase 1)
PROPERTIES = [
    {
        "id": "prop_001",
        "address": "123 Main St, Phoenix, AZ 85001",
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
        "water_source": "surface_water",
        "acre_feet": 4.5,
        "adwr_certificate": "SWC-2022-089",
        "solar": "roof_mounted",
        "solar_provider": "SunPower",
        "hoa_name": "Copper Ridge Community",
        "hoa_fee": 195
    }
]


def create_index():
    """Create Pinecone index if it doesn't exist"""
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    
    if INDEX_NAME in existing_indexes:
        print(f"[OK] Index '{INDEX_NAME}' already exists")
        # Check if we need to delete and recreate (dimension mismatch)
        index = pc.Index(INDEX_NAME)
        stats = index.describe_index_stats()
        if stats.dimension != DIMENSION:
            print(f"[WARN] Dimension mismatch (current: {stats.dimension}, needed: {DIMENSION})")
            print(f"[INFO] Deleting existing index...")
            pc.delete_index(INDEX_NAME)
        else:
            return True
    
    print(f"[INFO] Creating index '{INDEX_NAME}' (dimension: {DIMENSION})...")
    pc.create_index(
        name=INDEX_NAME,
        dimension=DIMENSION,
        metric=METRIC,
        spec=ServerlessSpec(
            cloud="aws",
            region="us-east-1"  # Free tier region
        )
    )
    print(f"[OK] Index '{INDEX_NAME}' created successfully!")
    
    # Wait for index to be ready
    import time
    print("[INFO] Waiting for index to be ready...")
    time.sleep(10)
    return True


def generate_embedding(text: str) -> list:
    """Generate embedding using local sentence-transformers model"""
    embedding = embedding_model.encode(text)
    return embedding.tolist()


def property_to_text(prop: dict) -> str:
    """Convert property dict to searchable text"""
    parts = [
        f"Address: {prop['address']}",
        f"Water source: {prop['water_source']}",
        f"Water rights: {prop['acre_feet']} acre-feet per year",
        f"ADWR certificate: {prop['adwr_certificate']}"
    ]
    
    if prop['solar'] != "none":
        parts.append(f"Solar: {prop['solar']} by {prop['solar_provider']}")
    else:
        parts.append("Solar: none installed")
    
    if prop['hoa_name']:
        parts.append(f"HOA: {prop['hoa_name']} (${prop['hoa_fee']}/month)")
    else:
        parts.append("HOA: none")
    
    return " | ".join(parts)


def upsert_properties():
    """Generate embeddings and upsert to Pinecone"""
    index = pc.Index(INDEX_NAME)
    
    vectors = []
    print(f"[INFO] Processing {len(PROPERTIES)} properties...")
    
    for prop in PROPERTIES:
        text = property_to_text(prop)
        print(f"  -> Generating embedding for {prop['id']}...")
        
        embedding = generate_embedding(text)
        
        vectors.append({
            "id": prop["id"],
            "values": embedding,
            "metadata": {
                "address": prop["address"],
                "water_source": prop["water_source"],
                "acre_feet": prop["acre_feet"],
                "adwr_certificate": prop["adwr_certificate"],
                "solar": prop["solar"],
                "solar_provider": prop["solar_provider"] or "",
                "hoa_name": prop["hoa_name"] or "",
                "hoa_fee": prop["hoa_fee"],
                "text": text
            }
        })
    
    print(f"[INFO] Upserting {len(vectors)} vectors to Pinecone...")
    index.upsert(vectors=vectors)
    print("[OK] All vectors upserted successfully!")
    
    # Verify
    import time
    time.sleep(2)  # Wait for indexing
    stats = index.describe_index_stats()
    print(f"\n[STATS] Index Stats:")
    print(f"   Total vectors: {stats.total_vector_count}")
    print(f"   Dimension: {stats.dimension}")


def test_query():
    """Test a sample query"""
    index = pc.Index(INDEX_NAME)
    
    query = "property with groundwater rights in Phoenix"
    print(f"\n[TEST] Query: '{query}'")
    
    query_embedding = generate_embedding(query)
    
    results = index.query(
        vector=query_embedding,
        top_k=3,
        include_metadata=True
    )
    
    print(f"\n[RESULTS] Top {len(results.matches)} results:")
    for i, match in enumerate(results.matches, 1):
        print(f"   {i}. Score: {match.score:.4f}")
        print(f"      Address: {match.metadata['address']}")
        print(f"      Water: {match.metadata['water_source']} ({match.metadata['acre_feet']} acre-ft)")


if __name__ == "__main__":
    print("=" * 60)
    print("PHASE 2: PINECONE SETUP (Local Embeddings)")
    print("=" * 60)
    
    print(f"\n[CONFIG] Using model: all-MiniLM-L6-v2")
    print(f"[CONFIG] Vector dimension: {DIMENSION}")
    
    # Step 1: Create index
    print("\n[Step 1] Creating Pinecone index...")
    create_index()
    
    # Step 2: Upsert properties
    print("\n[Step 2] Upserting property vectors...")
    upsert_properties()
    
    # Step 3: Test query
    print("\n[Step 3] Testing vector search...")
    test_query()
    
    print("\n" + "=" * 60)
    print("[OK] PINECONE SETUP COMPLETE!")
    print("=" * 60)
