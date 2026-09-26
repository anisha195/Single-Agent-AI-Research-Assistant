"""Embeddings generator module for document chunks."""
from typing import List

def get_text_embedding(text: str) -> List[float]:
    """Generates embedding representation for text."""
    # Simplified numerical representation or Gemini embedContent hook
    return [float(ord(c)) for c in text[:16]]
