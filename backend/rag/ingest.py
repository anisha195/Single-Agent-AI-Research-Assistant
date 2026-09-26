"""Document ingestion CLI script: python -m backend.rag.ingest"""
import sys
from backend.rag.vector_store import vector_store

def main():
    print("Ingesting knowledge documents from data/documents/...")
    vector_store.ingest()
    print(f"Successfully ingested {len(vector_store.chunks)} chunks across files.")

if __name__ == "__main__":
    main()
