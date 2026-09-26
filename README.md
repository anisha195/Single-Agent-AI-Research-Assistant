# Single-Agent AI Research Assistant

A complete, production-grade autonomous **Single-Agent AI Research Assistant** powered by **Gemini 3.8 Flash** with native function calling, dynamic multi-step sequential reasoning, internal knowledge-base retrieval (RAG), real web search, webpage content extraction, live external REST APIs, and safe arithmetic calculation.

---

## 1. Core Philosophy: Single-Agent vs. Multi-Agent

Unlike multi-agent systems that fragment tasks across separate "Planner", "Writer", "Fact-Checker", or "Reviewer" agents, this application implements a **strictly Single-Agent Architecture**:
- **One Central Brain**: A single Gemini instance controls the entire research lifecycle.
- **Dynamic Decision Loop**: The agent inspects intermediate tool outputs and autonomously determines what additional facts, calculations, or webpage lookups are needed next.
- **No Hardcoded Tool Sequences**: The model chooses tools on the fly based on conversational context and previous tool outputs.
- **Traceable Reasoning**: Model internal chain-of-thought is kept private, while concise high-level activities (e.g., `Searching the web...`, `Reading source...`, `Calculating...`) are exposed in real time to the user.

---

## 2. System Architecture

```text
               User Research Question
                         │
                         ▼
             Frontend UI (React + Tailwind)
                         │
        POST /api/research (SSE Streaming / REST)
                         │
                         ▼
        ┌───────────────────────────────────┐
        │    Single Gemini Research Agent   │
        └─────────────────┬─────────────────┘
                          │
       ┌──────────────────┴──────────────────┐
       │     Autonomous Tool Selection       │
       │                                     │
       │  ├── 1. web_search(query)           │
       │  ├── 2. fetch_webpage(url)          │
       │  ├── 3. search_documents(query)     │
       │  ├── 4. call_external_api(endpoint) │
       │  └── 5. calculator(expression)      │
       └──────────────────┬──────────────────┘
                          │
                          ▼
                  Tool Execution Result
                          │
                          ▼
        ┌───────────────────────────────────┐
        │    Same Gemini Research Agent     │
        │  (Evaluates result, decides next) │
        └─────────────────┬─────────────────┘
                          │
          [More tool calls needed? (<= 10)]
               ├── Yes ──> Loop back
               └── No  ──> Synthesize Final Report
                          │
                          ▼
            Structured Final Research Report
        (Executive Summary, Findings, Analysis,
         Comparison Tables, Limitations, Sources)
```

---

## 3. Tool Architecture

| Tool | Purpose | Schema / Inputs | Real Implementation |
| :--- | :--- | :--- | :--- |
| **`web_search`** | Search public web for news, data, and current trends | `{ query: string }` | Queries DuckDuckGo / Wikipedia APIs with curated knowledge fallback; returns title, URL, and snippet. |
| **`fetch_webpage`** | Read in-depth content of a discovered URL | `{ url: string }` | Performs HTTP fetch, strips HTML markup/scripts/styles, enforces 6s timeout, truncates excessive length, handles HTTP errors. |
| **`search_documents`** | RAG retrieval over internal research whitepapers | `{ query: string, top_k: number }` | Splits markdown/text documents into semantic chunks, builds TF-IDF vector index, returns scored chunks with metadata. |
| **`call_external_api`**| Fetch macroeconomic & energy indicators | `{ endpoint: string, country_code: string, indicator: string }` | Makes HTTP calls to World Bank Open Data API and REST Countries API; supports `EXTERNAL_API_KEY`. |
| **`calculator`** | Safe arithmetic calculations (growth %, ratios) | `{ expression: string }` | Recursive descent / AST mathematical expression evaluator. **Zero use of `eval()`**; safe against arbitrary code execution. |

---

## 4. RAG Architecture

1. **Document Storage**: Verified industry whitepapers reside in `data/documents/`:
   - `india_ev_market_2020_2025.md`: Sales figures, FAME II / PM E-DRIVE subsidies, 2W/3W vs 4W market share, charging infrastructure.
   - `us_ev_market_2020_2025.md`: Sales figures, Inflation Reduction Act (IRA Section 30D), NACS charging standardization, OEM transitions.
   - `battery_and_supply_chain_trends.md`: Battery pack costs ($140/kWh in 2020 to $115/kWh in 2024 and $100/kWh in 2025), LFP vs NMC chemistry, mineral refining.
2. **Text Ingestion & Chunking**:
   - Parses Markdown headers (`##`) and paragraphs.
   - Generates overlapping chunks with document name, section title, and chunk indices.
3. **Vector Index**:
   - Computes normalized TF-IDF vector representations and term frequencies.
   - Performs cosine similarity ranking with query term boosting.
4. **Re-Ingestion**:
   - Triggerable at any time via `POST /api/ingest` or CLI `python -m backend.rag.ingest`.

---

## 5. Source Tracking & Verification

Every source touched by `web_search`, `fetch_webpage`, `search_documents`, or `call_external_api` is collected into a centralized registry:
- **Web Sources**: Title, external URL, snippet, usage flag.
- **RAG Sources**: Document file name, section name, relevance score, chunk content.
- **API Sources**: Data provider, indicator name, queried country code.
- **Report Guarantee**: The agent is strictly prompted never to invent sources or hallucinate URLs; all citations in the report correspond to real retrieved data.

---

## 6. Report Structure

The agent outputs reports in a standardized, executive format:
1. **Executive Summary**: Core answer and context.
2. **Key Findings**: High-impact bulleted metrics.
3. **Detailed Analysis**: In-depth thematic breakdown.
4. **Data / Comparisons**: Markdown tables contrasting metrics across dimensions (e.g. US vs India EV sales, prices, policies).
5. **Limitations**: Methodological uncertainties, differing data definitions, or date limits.
6. **Sources**: Numbered list of verified URLs and internal documents.

---

## 7. Environment Variables

Create `.env` (or configure in AI Studio Secrets panel):

```bash
# GEMINI_API_KEY: Required for Gemini model access (gemini-3.8-flash)
GEMINI_API_KEY="your-gemini-api-key"

# EXTERNAL_API_KEY: Optional key for external REST API services
EXTERNAL_API_KEY=""

# MAX_TOOL_CALLS: Maximum tool iterations before forcing synthesis (default: 10)
MAX_TOOL_CALLS=10

# PORT: Server port (defaults to 3000 in AI Studio)
PORT=3000
```

---

## 8. Running the Application

### Option A: Full-Stack Mode (AI Studio Default)
Starts the Express server with Vite middleware on port 3000:
```bash
npm install
npm run dev
```

To build for production:
```bash
npm run build
npm start
```

### Option B: Standalone Python FastAPI Backend
If running the Python backend independently:
```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```
To run document ingestion:
```bash
python -m backend.rag.ingest
```

---

## 9. Example Research Questions

- *"Compare the growth of electric vehicles in India and the US from 2020 to 2025."*
- *"Analyze global lithium-ion battery pack price trends and explain how LFP chemistry changed adoption."*
- *"Compare the Inflation Reduction Act in the US with India's FAME II and PLI policies for clean mobility."*
- *"What are the economic and demographic differences between India and the US regarding passenger car electrification?"*

---

## 10. Known Limitations

- **Search Rate Limits**: Public search endpoints may occasionally throttle rapid bursts; the built-in provider seamlessly falls back to cached knowledge without halting the agent.
- **Page Length Constraints**: `fetch_webpage` limits page content to 4,000 characters to prevent context window saturation and minimize token overhead.
- **Max Tool Calls**: Capped at 10 (configurable) to prevent unbounded loops.
