import os
import sys
import numpy as np
from python_engine.core.config import PROJECT_DIR
from python_engine.vector.embedder import TextEmbedder
from python_engine.vector.id_map import IDMap

# Paths for vector index files
PDF_INDEX_PATH = os.path.join(PROJECT_DIR, 'db', 'pdf_cache_vectors.tvim')
PAPER_INDEX_PATH = os.path.join(PROJECT_DIR, 'db', 'paper_corpus_vectors.tvim')

class VectorIndexManager:
    _pdf_index = None
    _paper_index = None

    @classmethod
    def _load_or_create_index(cls, path: str):
        """Loads a turbovec IdMapIndex from disk, or creates a new one if missing."""
        try:
            from turbovec import IdMapIndex
        except ImportError:
            print("Error: turbovec is not installed in the python environment.", file=sys.stderr)
            raise

        if os.path.exists(path):
            try:
                return IdMapIndex.load(path)
            except Exception as e:
                print(f"Warning: Failed to load index at {path} ({e}). Creating new index.", file=sys.stderr)
        
        # Create new 768-dimension index (matching nomic-embed-text-v1.5) with 4-bit quantization (quality)
        return IdMapIndex(dim=768, bit_width=4)

    @classmethod
    def get_pdf_index(cls):
        if cls._pdf_index is None:
            cls._pdf_index = cls._load_or_create_index(PDF_INDEX_PATH)
        return cls._pdf_index

    @classmethod
    def get_paper_index(cls):
        if cls._paper_index is None:
            cls._paper_index = cls._load_or_create_index(PAPER_INDEX_PATH)
        return cls._paper_index

    @classmethod
    def add_pdf(cls, filename: str, text: str):
        """Embeds and indexes a cached PDF page 1 text."""
        if not filename or not text.strip():
            return
        
        uint64_id = IDMap.get_or_create_uint64(filename, 'pdf_cache')
        vector = TextEmbedder.embed_text(text, is_query=False) # Automatically prefixes with search_document:
        
        pdf_index = cls.get_pdf_index()
        # Add to index. turbovec add_with_ids expects numpy float32 arrays
        vectors_np = np.array([vector], dtype=np.float32)
        ids_np = np.array([uint64_id], dtype=np.uint64)
        pdf_index.add_with_ids(vectors_np, ids_np)
        
        # Persist to disk
        pdf_index.write(PDF_INDEX_PATH)

    @classmethod
    def add_paper(cls, paper_id: str, title: str, abstract: str):
        """Embeds and indexes a paper's title + abstract."""
        if not paper_id or not title.strip():
            return
        
        uint64_id = IDMap.get_or_create_uint64(paper_id, 'paper')
        text = f"{title} {abstract}" if abstract else title
        vector = TextEmbedder.embed_text(text, is_query=False) # Automatically prefixes with search_document:
        
        paper_index = cls.get_paper_index()
        vectors_np = np.array([vector], dtype=np.float32)
        ids_np = np.array([uint64_id], dtype=np.uint64)
        paper_index.add_with_ids(vectors_np, ids_np)
        
        # Persist to disk
        paper_index.write(PAPER_INDEX_PATH)

    @classmethod
    def search_pdf_by_text(cls, query_text: str, k: int = 5, allowlist_filenames: list = None) -> list:
        """Search PDF index for similar texts. query_text is prefixed with search_query:"""
        if not query_text.strip():
            return []
        
        pdf_index = cls.get_pdf_index()
        query_vector = TextEmbedder.embed_text(query_text, is_query=True)
        query_vector_2d = np.array([query_vector], dtype=np.float32)
        
        # Resolve allowlist if provided
        allowlist_ids = None
        if allowlist_filenames:
            ids = []
            for f in allowlist_filenames:
                try:
                    # Retrieve deterministic ID without creating it if it doesn't exist
                    import hashlib
                    h = hashlib.md5(f.encode('utf-8')).digest()
                    ids.append(int.from_bytes(h[:8], byteorder='big') & 0x7FFFFFFFFFFFFFFF)
                except Exception:
                    pass
            # Filter allowed IDs to only those actually present in the turbovec index,
            # since turbovec throws an error if any allowlist ID is missing from the index.
            ids = [uid for uid in ids if uid in pdf_index]
            if not ids:
                return []
            allowlist_ids = np.array(ids, dtype=np.uint64)
        
        # Search index
        # turbovec search(query, k, allowlist=...)
        # handles both 1D and 2D queries safely
        kwargs = {}
        if allowlist_ids is not None:
            kwargs['allowlist'] = allowlist_ids
            
        scores, ids = pdf_index.search(query_vector_2d, k=k, **kwargs)
        
        # Normalize shapes: turbovec returns lists/ndarrays
        # If 2D (batch size 1), extract the first row
        if len(scores.shape) > 1 and scores.shape[0] == 1:
            scores = scores[0]
            ids = ids[0]
            
        # Resolve uint64 IDs back to filenames
        resolved = IDMap.bulk_resolve(list(ids))
        
        results = []
        for score, uint_id in zip(scores, ids):
            filename = resolved.get(uint_id)
            if filename:
                results.append({
                    'filename': filename,
                    'score': float(score),
                    'id': int(uint_id)
                })
        return results

    @classmethod
    def search_papers_by_text(cls, query_text: str, k: int = 5, allowlist_paper_ids: list = None) -> list:
        """Search paper index for similar papers. query_text is prefixed with search_query:"""
        if not query_text.strip():
            return []
        
        paper_index = cls.get_paper_index()
        query_vector = TextEmbedder.embed_text(query_text, is_query=True)
        query_vector_2d = np.array([query_vector], dtype=np.float32)
        
        # Resolve allowlist if provided
        allowlist_ids = None
        if allowlist_paper_ids:
            ids = []
            for pid in allowlist_paper_ids:
                try:
                    import hashlib
                    h = hashlib.md5(pid.encode('utf-8')).digest()
                    ids.append(int.from_bytes(h[:8], byteorder='big') & 0x7FFFFFFFFFFFFFFF)
                except Exception:
                    pass
            # Filter allowed IDs to only those actually present in the turbovec index,
            # since turbovec throws an error if any allowlist ID is missing from the index.
            ids = [uid for uid in ids if uid in paper_index]
            if not ids:
                return []
            allowlist_ids = np.array(ids, dtype=np.uint64)
        
        kwargs = {}
        if allowlist_ids is not None:
            kwargs['allowlist'] = allowlist_ids
            
        scores, ids = paper_index.search(query_vector_2d, k=k, **kwargs)
        
        if len(scores.shape) > 1 and scores.shape[0] == 1:
            scores = scores[0]
            ids = ids[0]
            
        resolved = IDMap.bulk_resolve(list(ids))
        
        results = []
        for score, uint_id in zip(scores, ids):
            paper_id = resolved.get(uint_id)
            if paper_id:
                results.append({
                    'paper_id': paper_id,
                    'score': float(score),
                    'id': int(uint_id)
                })
        return results

    @classmethod
    def remove_pdf(cls, filename: str):
        """Remove PDF from index and ID mapping."""
        if not filename:
            return
        
        uint64_id = IDMap.get_or_create_uint64(filename, 'pdf_cache')
        pdf_index = cls.get_pdf_index()
        try:
            pdf_index.remove(uint64_id)
            pdf_index.write(PDF_INDEX_PATH)
        except Exception as e:
            print(f"Error removing {filename} from PDF index: {e}", file=sys.stderr)
        
        IDMap.remove(filename)

    @classmethod
    def remove_paper(cls, paper_id: str):
        """Remove paper from index and ID mapping."""
        if not paper_id:
            return
        
        uint64_id = IDMap.get_or_create_uint64(paper_id, 'paper')
        paper_index = cls.get_paper_index()
        try:
            paper_index.remove(uint64_id)
            paper_index.write(PAPER_INDEX_PATH)
        except Exception as e:
            print(f"Error removing {paper_id} from paper index: {e}", file=sys.stderr)
        
        IDMap.remove(paper_id)
