from typing import List, Dict, Any
from backend.rag.vector_store import vector_store

def search_documents(query: str, top_k: int = 3) -> Dict[str, Any]:
    """Retrieve relevant chunks from internal documents knowledge base."""
    results = vector_store.search(query=query, top_k=top_k)
    return {
        "results": [
            {
                "document": r["document"],
                "content": r["content"],
                "score": r["score"],
                "metadata": r["metadata"]
            }
            for r in results
        ]
    }
