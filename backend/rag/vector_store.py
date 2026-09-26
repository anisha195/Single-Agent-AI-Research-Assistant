import os
import math
import re
from typing import List, Dict, Any

class SimpleVectorStore:
    def __init__(self, documents_dir: str):
        self.documents_dir = documents_dir
        self.chunks: List[Dict[str, Any]] = []
        self.doc_frequencies: Dict[str, int] = {}
        self.vocabulary: set = set()
        self.is_indexed = False

    def tokenize(self, text: str) -> List[str]:
        return [w for w in re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower()).split() if len(w) > 2]

    def ingest(self):
        self.chunks.clear()
        self.doc_frequencies.clear()
        self.vocabulary.clear()

        if not os.path.exists(self.documents_dir):
            os.makedirs(self.documents_dir, exist_ok=True)

        for filename in os.listdir(self.documents_dir):
            if filename.endswith(('.md', '.txt')):
                full_path = os.path.join(self.documents_dir, filename)
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Split into chunks by headers or paragraphs
                sections = re.split(r'(?=^##?\s+)', content, flags=re.MULTILINE)
                chunk_idx = 0
                for sec in sections:
                    sec = sec.strip()
                    if not sec:
                        continue
                    chunk_idx += 1
                    self.chunks.append({
                        "id": f"{filename}-{chunk_idx}",
                        "document": filename,
                        "content": sec,
                        "score": 0.0,
                        "metadata": {"filename": filename, "chunk_index": chunk_idx}
                    })

        # Calculate TF-IDF vectors
        N = len(self.chunks)
        if N == 0:
            return

        for chunk in self.chunks:
            tokens = self.tokenize(chunk["content"])
            for t in set(tokens):
                self.vocabulary.add(t)
                self.doc_frequencies[t] = self.doc_frequencies.get(t, 0) + 1

        self.is_indexed = True

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not self.is_indexed:
            self.ingest()

        q_tokens = self.tokenize(query)
        if not q_tokens or not self.chunks:
            return self.chunks[:top_k]

        scored = []
        for chunk in self.chunks:
            tokens = self.tokenize(chunk["content"])
            score = 0.0
            for t in q_tokens:
                if t in tokens:
                    df = self.doc_frequencies.get(t, 1)
                    idf = math.log((len(self.chunks) + 1) / (df + 0.5))
                    score += (tokens.count(t) / len(tokens)) * idf
            if query.lower() in chunk["content"].lower():
                score += 0.5
            scored.append({**chunk, "score": round(score, 3)})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

# Global instance
docs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "documents"))
vector_store = SimpleVectorStore(docs_path)
