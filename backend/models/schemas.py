from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class ResearchRequest(BaseModel):
    query: str = Field(..., description="Research question to investigate")

class ResearchSource(BaseModel):
    title: str
    url: Optional[str] = None
    document: Optional[str] = None
    source_type: str = Field(..., description="'web', 'internal_document', or 'external_api'")
    snippet: Optional[str] = None
    used: bool = True
    metadata: Optional[Dict[str, Any]] = None

class ToolCallLog(BaseModel):
    id: str
    tool: str
    arguments: Dict[str, Any]
    status: str
    duration_ms: int
    output_summary: Optional[str] = None
    timestamp: str

class ResearchResponse(BaseModel):
    query: str
    answer: str
    sources: List[ResearchSource]
    tool_calls: List[ToolCallLog]
    iterations: int

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str
    has_api_key: bool

class DocumentChunk(BaseModel):
    id: str
    document: str
    content: str
    score: float
    metadata: Dict[str, Any]
