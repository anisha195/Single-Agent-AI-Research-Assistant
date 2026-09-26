import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
EXTERNAL_API_KEY = os.getenv("EXTERNAL_API_KEY", "")
MAX_TOOL_CALLS = int(os.getenv("MAX_TOOL_CALLS", "10"))
PORT = int(os.getenv("PORT", "8000"))
DOCUMENTS_DIR = os.getenv("DOCUMENTS_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "documents"))
