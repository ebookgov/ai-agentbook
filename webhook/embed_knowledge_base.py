#!/usr/bin/env python3
"""
Embedding pipeline: Parse Markdown Q&A files → Chunk → Embed → Store in Supabase.

Usage:
  python embed_knowledge_base.py --dir webhook/Knowledge_Base_Implementation/ \
    --db-url postgresql://... --openai-key sk-...
"""

import os
import sys
import json
import hashlib
import argparse
from pathlib import Path
from typing import Optional, List, Dict
from dataclasses import dataclass, asdict

import psycopg
from openai import OpenAI
import tiktoken  # Token counter for OpenAI models

# ──────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────

TARGET_TOKENS = 400  # Target chunk size (tokens)
OVERLAP_TOKENS = 50  # 10% overlap for 500-token chunks
BATCH_SIZE = 50      # Texts per OpenAI API call
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536

# Initialize clients
tokenizer = tiktoken.encoding_for_model(EMBEDDING_MODEL)
# Client initialized in process_knowledge_base to allow key injection

# ──────────────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    """Single knowledge chunk (300-500 tokens)."""
    content: str
    source_file: str
    chunk_index: int
    metadata: Dict
    
    def to_dict(self):
        return asdict(self)
    
    def content_hash(self) -> str:
        """Hash for deduplication."""
        return hashlib.sha256(self.content.encode()).hexdigest()

# ──────────────────────────────────────────────────────────────────
# Markdown Parser (Preserve Q&A Pairs)
# ──────────────────────────────────────────────────────────────────

def parse_markdown_qa(file_path: Path) -> List[Dict]:
    """
    Parse Markdown file into Q&A pairs.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse YAML frontmatter
    metadata = {}
    if content.startswith('---'):
        try:
            parts = content.split('---', 2)
            if len(parts) >= 3:
                fm = parts[1]
                rest = parts[2]
                for line in fm.strip().split('\n'):
                    if ':' in line:
                        key, val = line.split(':', 1)
                        metadata[key.strip()] = val.strip()
                content = rest
        except ValueError:
            pass
    
    # Split into Q&A pairs (heuristic: "##" marks new section)
    sections = content.split('##')
    qa_pairs = []
    
    for section in sections:
        lines = section.strip().split('\n', 1)
        if len(lines) == 2:
            question_line, answer = lines
            question = question_line.strip().replace('Question:', '').strip()
            
            if question and answer.strip():
                qa_pairs.append({
                    'question': question,
                    'answer': answer.strip(),
                    'metadata': {**metadata, 'answer_preview': answer[:100]}
                })
    
    return qa_pairs

# ──────────────────────────────────────────────────────────────────
# Chunking Strategy (Q&A-Aware with Overlap)
# ──────────────────────────────────────────────────────────────────

def chunk_qa_content(qa_pairs: List[Dict], source_file: str) -> List[Chunk]:
    """
    Chunk Q&A pairs preserving complete question-answer relationships.
    """
    chunks = []
    chunk_index = 0
    
    for qa_pair in qa_pairs:
        question = qa_pair['question']
        answer = qa_pair['answer']
        
        # Combine question + answer (improves embedding relevance)
        full_text = f"Question: {question}\n\nAnswer: {answer}"
        
        # Check token count
        tokens = tokenizer.encode(full_text)
        
        if len(tokens) <= TARGET_TOKENS + OVERLAP_TOKENS:
            # Fits in single chunk
            chunk = Chunk(
                content=full_text,
                source_file=source_file,
                chunk_index=chunk_index,
                metadata={
                    **qa_pair['metadata'],
                    'question': question,
                    'chunk_type': 'qa_pair'
                }
            )
            chunks.append(chunk)
            chunk_index += 1
        else:
            # Split long answers with overlap, keep question in each
            answer_sentences = answer.split('. ')
            current_chunk = f"Question: {question}\n\n"
            current_tokens = tokenizer.encode(current_chunk)
            
            for sentence in answer_sentences:
                block = sentence + '. '
                sentence_tokens = tokenizer.encode(block)
                
                if len(current_tokens) + len(sentence_tokens) > TARGET_TOKENS:
                    # Emit chunk and start new one with overlap
                    chunk = Chunk(
                        content=current_chunk.strip(),
                        source_file=source_file,
                        chunk_index=chunk_index,
                        metadata={
                            **qa_pair['metadata'],
                            'question': question,
                            'chunk_type': 'qa_part'
                        }
                    )
                    chunks.append(chunk)
                    chunk_index += 1
                    
                    # Start new chunk with last OVERLAP_TOKENS from previous
                    overlap_text = '. '.join(answer_sentences[-2:]) if len(answer_sentences) > 1 else ""
                    current_chunk = f"Question: {question}\n\n{overlap_text}. "
                    current_tokens = tokenizer.encode(current_chunk)
                
                current_chunk += block
                current_tokens = tokenizer.encode(current_chunk)
            
            # Emit final chunk
            if current_chunk.strip() != f"Question: {question}":
                chunk = Chunk(
                    content=current_chunk.strip(),
                    source_file=source_file,
                    chunk_index=chunk_index,
                    metadata={
                        **qa_pair['metadata'],
                        'question': question,
                        'chunk_type': 'qa_part'
                    }
                )
                chunks.append(chunk)
                chunk_index += 1
    
    return chunks

# ──────────────────────────────────────────────────────────────────
# Batch Embedding Generation
# ──────────────────────────────────────────────────────────────────

def embed_batch(client: OpenAI, texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for batch of texts via OpenAI API.
    """
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
        encoding_format="float"
    )
    
    # Sort by index to match input order
    embeddings = sorted(
        [(item.index, item.embedding) for item in response.data],
        key=lambda x: x[0]
    )
    
    return [emb for _, emb in embeddings]

# ──────────────────────────────────────────────────────────────────
# Database Operations
# ──────────────────────────────────────────────────────────────────

def init_db(db_url: str):
    """Return Postgres connection with pgvector support."""
    try:
        conn = psycopg.connect(db_url)
        # Ensure pgvector extension exists
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.commit()
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        sys.exit(1)

def get_embedded_files(conn: psycopg.Connection) -> set:
    """Get set of already-embedded source files (avoid re-processing)."""
    try:
        result = conn.execute(
            "SELECT DISTINCT source_file FROM knowledge_chunks"
        ).fetchall()
        return {row[0] for row in result}
    except psycopg.errors.UndefinedTable:
        return set() # Table doesn't exist yet

def insert_chunks_batch(
    conn: psycopg.Connection,
    chunks_with_embeddings: List[tuple]
):
    """
    Batch insert chunks with embeddings.
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO knowledge_chunks 
              (content, embedding, metadata, source_file, chunk_index)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (source_file, chunk_index) DO UPDATE
              SET content = EXCLUDED.content,
                  embedding = EXCLUDED.embedding,
                  metadata = EXCLUDED.metadata,
                  updated_at = now()
            """,
            chunks_with_embeddings
        )
        conn.commit()

# ──────────────────────────────────────────────────────────────────
# Main Pipeline
# ──────────────────────────────────────────────────────────────────

def process_knowledge_base(
    kb_dir: Path,
    db_url: str,
    openai_key: str,
    force_refresh: bool = False
):
    """
    Main pipeline: Discover files → Parse → Chunk → Embed → Store.
    """
    # Initialize
    client = OpenAI(api_key=openai_key)
    conn = init_db(db_url)
    embedded_files = set() if force_refresh else get_embedded_files(conn)
    
    # Discover Markdown files
    md_files = sorted(kb_dir.rglob("*.md"))
    print(f"Found {len(md_files)} Markdown files in {kb_dir}")
    
    all_chunks = []
    
    # Parse and chunk
    for md_file in md_files:
        file_key = str(md_file.relative_to(kb_dir))
        
        if file_key in embedded_files:
            print(f"  ✓ {file_key} (already embedded)")
            continue
        
        print(f"  → {file_key}")
        
        qa_pairs = parse_markdown_qa(md_file)
        file_chunks = chunk_qa_content(qa_pairs, file_key)
        all_chunks.extend(file_chunks)
        
        print(f"     {len(file_chunks)} chunks from {len(qa_pairs)} Q&A pairs")
    
    if not all_chunks:
        print("No new content to embed.")
        conn.close()
        return

    # Batch embed
    print(f"\nEmbedding {len(all_chunks)} chunks (batches of {BATCH_SIZE})...")
    
    chunks_to_insert = []
    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch_chunks = all_chunks[i:i + BATCH_SIZE]
        texts = [chunk.content for chunk in batch_chunks]
        
        print(f"  [{i//BATCH_SIZE + 1}] Embedding {len(texts)} texts...")
        try:
            embeddings = embed_batch(client, texts)
            
            # Combine chunks with embeddings
            for chunk, embedding in zip(batch_chunks, embeddings):
                chunks_to_insert.append((
                    chunk.content,
                    embedding,  # pgvector.Vector (cast automatically)
                    json.dumps(chunk.metadata),
                    chunk.source_file,
                    chunk.chunk_index
                ))
        except Exception as e:
            print(f"Error embedding batch: {e}")
            continue
    
    # Insert into Supabase
    print(f"\nInserting {len(chunks_to_insert)} chunks into knowledge_chunks...")
    insert_chunks_batch(conn, chunks_to_insert)
    
    print("✓ Embedding pipeline complete!")
    print(f"  Total chunks: {len(chunks_to_insert)}")
    print(f"  Files processed: {len(md_files)}")
    print(f"  Avg tokens/chunk: ~{TARGET_TOKENS}")
    
    conn.close()

# ──────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Embed Arizona Real Estate Q&A knowledge base into Supabase pgvector"
    )
    parser.add_argument(
        "--dir",
        type=Path,
        required=True,
        help="Directory containing Markdown files"
    )
    parser.add_argument(
        "--db-url",
        required=True,
        help="Supabase connection string (use pooled URL: port 6543)"
    )
    parser.add_argument(
        "--openai-key",
        default=os.getenv("OPENAI_API_KEY"),
        help="OpenAI API key (default: OPENAI_API_KEY env var)"
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Re-embed all files even if already processed"
    )
    
    args = parser.parse_args()
    
    if not args.openai_key:
        print("Error: OpenAI API key required (--openai-key or OPENAI_API_KEY)")
        sys.exit(1)
    
    if not args.dir.exists():
        print(f"Error: Directory {args.dir} does not exist")
        sys.exit(1)

    process_knowledge_base(args.dir, args.db_url, args.openai_key, args.force_refresh)
