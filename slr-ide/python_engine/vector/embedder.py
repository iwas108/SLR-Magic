import sys
import numpy as np
from functools import lru_cache

@lru_cache(maxsize=128)
def _get_cached_embedding(text: str, is_query: bool, model_name: str) -> np.ndarray:
    # Use the singleton model to avoid reloading from disk on cache misses
    model = TextEmbedder.get_model()
    prefix = "search_query: " if is_query else "search_document: "
    prefixed_text = prefix + text.strip()
    embedding = model.encode(prefixed_text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.astype(np.float32)

class TextEmbedder:
    _model = None

    @classmethod
    def get_model(cls):
        """Lazy load the sentence-transformers model."""
        if cls._model is None:
            try:
                import torch
                import os
                torch.set_num_threads(os.cpu_count() or 4)
                from sentence_transformers import SentenceTransformer
            except ImportError:
                print("Error: sentence-transformers is not installed in the python environment.", file=sys.stderr)
                raise

            model_name = "nomic-ai/nomic-embed-text-v1.5"
            try:
                cls._model = SentenceTransformer(model_name, trust_remote_code=True)
            except Exception as e:
                print(f"Error loading model {model_name}: {e}", file=sys.stderr)
                raise
        return cls._model

    @classmethod
    def embed_text(cls, text: str, is_query: bool = False) -> np.ndarray:
        """
        Embed a single string.
        Applies the required prefix for nomic-embed-text-v1.5:
        - search_query: for queries/searches
        - search_document: for indexing documents
        """
        if not text:
            return np.zeros(768, dtype=np.float32)
        
        # Use module-level cache for query embeddings to optimize repeat searches
        if is_query:
            try:
                return _get_cached_embedding(text, is_query, "nomic-ai/nomic-embed-text-v1.5")
            except Exception:
                # Fallback to standard lazy-load path if cache fails
                pass
        
        prefix = "search_query: " if is_query else "search_document: "
        prefixed_text = prefix + text.strip()
        
        model = cls.get_model()
        embedding = model.encode(prefixed_text, convert_to_numpy=True, normalize_embeddings=True)
        return embedding.astype(np.float32)

    @classmethod
    def embed_batch(cls, texts: list[str], is_query: bool = False, show_progress: bool = False) -> np.ndarray:
        """
        Embed a batch of strings.
        Applies the prefix to each string in the batch.
        """
        if not texts:
            return np.empty((0, 768), dtype=np.float32)
        
        prefix = "search_query: " if is_query else "search_document: "
        prefixed_texts = [prefix + (t.strip() if t else "") for t in texts]
        
        model = cls.get_model()
        embeddings = model.encode(prefixed_texts, convert_to_numpy=True, show_progress_bar=show_progress, normalize_embeddings=True)
        return embeddings.astype(np.float32)
