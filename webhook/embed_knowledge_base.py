#!/usr/bin/env python3
"""
Embedding pipeline: Parse Markdown files → Chunk → Embed → Store in Supabase.
Supports:
1. "FAQ Style" (### Q: Question ... **A:** Answer)
2. "Guide Style" (Standard Markdown headers/paragraphs)

Model: all-MiniLM-L6-v2 (Local, Free, 384 dims)

Usage:
  python embed_knowledge_base.py --dir webhook/Knowledge_Base_Implementation/ --db-url postgresql://...
"""

import os
import sys
import json
import hashlib
import argparse
import re
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass, asdict

import psycopg
import tiktoken
from sentence_transformers import SentenceTransformer

# ──────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────

TARGET_TOKENS = 400
OVERLAP_TOKENS = 50
BATCH_SIZE = 50
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Initialize tokenizer (Approximation for length checks)
tokenizer = tiktoken.get_encoding("cl100k_base")

# Initialize Model (Lazy load in main)
model = None

# ──────────────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    content: str
    source_file: str
    chunk_index: int
    metadata: Dict
    
    def content_hash(self) -> str:
        """Hash for change detection."""
        return hashlib.sha256(self.content.encode()).hexdigest()

# ──────────────────────────────────────────────────────────────────
# 1. Parsing Logic
# ──────────────────────────────────────────────────────────────────

def parse_frontmatter(content: str) -> Tuple[str, Dict]:
    """Extract YAML frontmatter if present."""
    metadata = {}
    if content.startswith('---\n'):
        try:
            parts = content.split('---', 2)
            if len(parts) >= 3:
                fm = parts[1]
                content = parts[2]
                for line in fm.strip().split('\n'):
                    if ':' in line:
                        key, val = line.split(':', 1)
                        metadata[key.strip()] = val.strip()
        except ValueError:
            pass
    return content.strip(), metadata

def parse_faq_style(content: str, base_metadata: Dict) -> List[Dict]:
    """Parse '### Q:' style Q&A pairs."""
    lines = content.split('\n')
    qa_pairs = []
    
    current_question = None
    current_answer_lines = []
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('### Q'):
            if current_question and current_answer_lines:
                qa_pairs.append({
                    'question': current_question,
                    'answer': '\n'.join(current_answer_lines).strip(),
                    'metadata': {**base_metadata, 'type': 'faq'}
                })
            
            current_question = re.sub(r'^###\s*Q\w*:\s*', '', stripped).strip()
            current_answer_lines = []
        
        elif current_question:
            current_answer_lines.append(line)
            
    if current_question and current_answer_lines:
        qa_pairs.append({
            'question': current_question,
            'answer': '\n'.join(current_answer_lines).strip(),
            'metadata': {**base_metadata, 'type': 'faq'}
        })
        
    return qa_pairs

def determine_file_type(content: str) -> str:
    if "### Q:" in content or "### Question:" in content:
        return "faq"
    return "guide"

# ──────────────────────────────────────────────────────────────────
# 2. Chunking Logic
# ──────────────────────────────────────────────────────────────────

def chunk_text_semantic(text: str, max_tokens: int = TARGET_TOKENS) -> List[str]:
    """
    Split text by paragraphs, then sentences, respecting token limits.
    """
    tokens = tokenizer.encode(text)
    if len(tokens) <= max_tokens:
        return [text]
        
    chunks = []
    current_chunk = []
    current_length = 0
    
    paragraphs = text.split('\n\n')
    
    for para in paragraphs:
        para_tokens = tokenizer.encode(para + "\n\n")
        
        if current_length + len(para_tokens) > max_tokens:
            if len(para_tokens) > max_tokens:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    sent_tokens = tokenizer.encode(sent + " ")
                    if current_length + len(sent_tokens) > max_tokens:
                        if current_chunk:
                            chunks.append("".join(current_chunk).strip())
                            current_chunk = []
                            current_length = 0
                    current_chunk.append(sent + " ")
                    current_length += len(sent_tokens)
            else:
                if current_chunk:
                    chunks.append("".join(current_chunk).strip())
                current_chunk = [para + "\n\n"]
                current_length = len(para_tokens)
        else:
            current_chunk.append(para + "\n\n")
            current_length += len(para_tokens)
            
    if current_chunk:
        chunks.append("".join(current_chunk).strip())
        
    return chunks

def process_file_content(file_path: Path, relative_path: str) -> List[Chunk]:
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_content = f.read()
        
    content, metadata = parse_frontmatter(raw_content)
    file_type = determine_file_type(content)
    chunks = []
    
    if file_type == "faq":
        print(f"  Type: FAQ ({relative_path})")
        pairs = parse_faq_style(content, metadata)
        print(f"    Found {len(pairs)} Q&A pairs")
        
        idx = 0
        for pair in pairs:
            q = pair['question']
            a = pair['answer']
            full_text = f"Question: {q}\n\nAnswer: {a}"
            
            if len(tokenizer.encode(full_text)) > TARGET_TOKENS + 100:
                sub_chunks = chunk_text_semantic(a, TARGET_TOKENS - 50) 
                for part in sub_chunks:
                    chunk_text = f"Question: {q}\n\nAnswer Part: {part}"
                    chunks.append(Chunk(
                        content=chunk_text,
                        source_file=relative_path,
                        chunk_index=idx,
                        metadata={**pair['metadata'], 'question': q}
                    ))
                    idx += 1
            else:
                chunks.append(Chunk(
                    content=full_text,
                    source_file=relative_path,
                    chunk_index=idx,
                    metadata={**pair['metadata'], 'question': q}
                ))
                idx += 1
                
    else:
        print(f"  Type: Guide/Doc ({relative_path})")
        text_chunks = chunk_text_semantic(content, TARGET_TOKENS)
        for i, text in enumerate(text_chunks):
            chunks.append(Chunk(
                content=text,
                source_file=relative_path,
                chunk_index=i,
                metadata={**metadata, 'type': 'guide'}
            ))
            
    return chunks

# ──────────────────────────────────────────────────────────────────
# 3. Database & Embedding
# ──────────────────────────────────────────────────────────────────

def get_existing_file_hashes(conn) -> Dict[str, str]:
    try:
        cur = conn.execute("SELECT source_file FROM knowledge_chunks")
        rows = cur.fetchall()
        return {row[0] for row in rows} 
    except psycopg.errors.UndefinedTable:
        return set()

def embed_batch(texts: List[str]) -> List[List[float]]:
    try:
        # SentenceTransformers runs locally
        embeddings = model.encode(texts)
        return embeddings.tolist()
    except Exception as e:
        print(f"Error embedding batch: {e}")
        return []

def save_chunks(conn, chunks: List[Chunk]):
    texts = [c.content for c in chunks]
    total = len(texts)
    print(f"    Generating embeddings for {total} chunks...")
    
    all_embeddings = []
    for i in range(0, total, BATCH_SIZE):
        batch = texts[i:i+BATCH_SIZE]
        embs = embed_batch(batch)
        all_embeddings.extend(embs)
        
    unique_files = {c.source_file for c in chunks}
    with conn.cursor() as cur:
        # Note: In production, consider soft-deletes or strictly checking IDs.
        # For now, we clean up previous entries for these files to avoid duplication.
        for f in unique_files:
            # We must delete from the NEW table now
            # FIXED: logic to use 'source_url' column instead of non-existent jsonb 'metadata'
            cur.execute("DELETE FROM arizona_land_assistant_knowledge WHERE source_url = %s", (str(f),))
    
    data = []
    for chunk, emb in zip(chunks, all_embeddings):
        # ─────────────────────────────────────────────────────────────
        # MAPPING LOGIC: python objects -> postgres row
        # ─────────────────────────────────────────────────────────────
        
        # 1. Type (Enum)
        # We try to infer from metadata, default to 'guide' or 'faq' which we added to the enum
        row_type = chunk.metadata.get('type', 'guide')
        
        # 2. Category
        # Required field. Default to 'general' if not in frontmatter
        row_category = chunk.metadata.get('category', 'general')
        
        # 3. Jurisdiction
        # Required field. Default to 'Arizona' since this is an AZ bot
        row_jurisdiction = chunk.metadata.get('jurisdiction', 'Arizona')
        
        # 4. Content & Title
        # Title might be in metadata, otherwise use source filename
        row_title = chunk.metadata.get('title', f"Excerpt from {chunk.source_file}")
        row_content = chunk.content
        row_source_url = str(chunk.source_file)
        
        # 5. Metadata (Store the rest as JSONB) - DEPRECATED in new schema
        # We mapped everything to strict columns.
        
        # 6. Optional Fields
        row_authority = chunk.metadata.get('authority', None)
        row_related_statute = chunk.metadata.get('related_statute', None)

        data.append((
            row_type,
            row_category,
            row_title,
            row_content,
            row_source_url,
            row_jurisdiction,
            row_authority,
            row_related_statute,
            emb  # 384 dim vector
        ))
        
    with conn.cursor() as cur:
        try:
            cur.executemany("""
                INSERT INTO arizona_land_assistant_knowledge 
                (type, category, title, content, source_url, jurisdiction, authority, related_statute, content_vector)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, data)
            conn.commit()
            print(f"    Saved {len(data)} chunks to arizona_land_assistant_knowledge.")
        except Exception as e:
            print(f"    ERROR inserting chunks: {e}")
            conn.rollback()


# ──────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=Path, required=True)
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--force", action="store_true", help="Reprocess all files")
    args = parser.parse_args()

    # Load model
    print(f"Loading model {EMBEDDING_MODEL_NAME}...")
    global model
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    
    try:
        conn = psycopg.connect(args.db_url)
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.commit()
    except Exception as e:
        print(f"DB Connection failed: {e}")
        sys.exit(1)
        
    processed_files_in_db = get_existing_file_hashes(conn)
    
    files = sorted(args.dir.rglob("*.md"))
    print(f"Found {len(files)} markdown files.")
    
    for f_path in files:
        rel_path = str(f_path.relative_to(args.dir)).replace("\\", "/")
        
        if rel_path in processed_files_in_db and not args.force:
            print(f"Skipping {rel_path} (already in DB)")
            continue
            
        print(f"Processing {rel_path}...")
        try:
            file_chunks = process_file_content(f_path, rel_path)
            if file_chunks:
                save_chunks(conn, file_chunks)
            else:
                print("    No chunks generated (empty?)")
        except Exception as e:
            print(f"    FAILED: {e}")
            import traceback
            traceback.print_exc()
            
    conn.close()
    print("Done.")

if __name__ == "__main__":
    main()
