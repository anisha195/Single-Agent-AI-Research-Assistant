import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.models.schemas import ResearchRequest, ResearchResponse, HealthResponse
from backend.agent import PythonResearchAgent
from backend.rag.vector_store import vector_store
import backend.config as config

app = FastAPI(title="Single-Agent AI Research Assistant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    vector_store.ingest()

@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        service="Single-Agent AI Research Assistant (FastAPI)",
        has_api_key=bool(config.GEMINI_API_KEY)
    )

@app.post("/api/research", response_model=ResearchResponse)
def research(request: ResearchRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    agent = PythonResearchAgent()
    result = agent.run_research(request.query)
    return ResearchResponse(**result)

@app.get("/api/documents")
def get_documents():
    return {
        "totalDocuments": len(set(c["document"] for c in vector_store.chunks)),
        "totalChunks": len(vector_store.chunks),
        "chunks": vector_store.chunks[:10]
    }

@app.post("/api/ingest")
def reingest_documents():
    vector_store.ingest()
    return {"status": "success", "chunks_indexed": len(vector_store.chunks)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=config.PORT, reload=True)
