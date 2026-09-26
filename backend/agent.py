import os
import time
from typing import Dict, Any, List, Callable, Optional
from google import genai
from google.genai import types

from backend.tools.web_search import web_search
from backend.tools.fetch_webpage import fetch_webpage
from backend.tools.rag import search_documents
from backend.tools.external_api import call_external_api
from backend.tools.calculator import calculator
import backend.config as config

SYSTEM_INSTRUCTION = """You are a rigorous Single-Agent AI Research Assistant.
You do NOT delegate work to other agents; you independently select and execute tools sequentially to gather facts, verify claims, compute figures, and compile an exhaustive, factual research report.

AVAILABLE TOOLS:
1. web_search(query)
2. fetch_webpage(url)
3. search_documents(query, top_k)
4. call_external_api(endpoint, country_code, indicator)
5. calculator(expression)

AGENT RULES:
- Gather facts with tools before asserting conclusions.
- When you have collected adequate information, respond with the final research report formatted EXACTLY as follows:
# Executive Summary
# Key Findings
# Detailed Analysis
# Data / Comparisons
# Limitations
# Sources
"""

class PythonResearchAgent:
    def __init__(self):
        self.client = genai.Client(api_key=config.GEMINI_API_KEY)
        self.max_tool_calls = config.MAX_TOOL_CALLS

    def run_research(self, query: str) -> Dict[str, Any]:
        tool_calls_log = []
        sources = []

        def add_source(title: str, url: str = None, doc: str = None, stype: str = "web"):
            for s in sources:
                if (url and s.get("url") == url) or (doc and s.get("document") == doc) or s.get("title") == title:
                    return
            sources.append({
                "title": title,
                "url": url,
                "document": doc,
                "source_type": stype,
                "used": True
            })

        # Declarations
        tools = [
            web_search,
            fetch_webpage,
            search_documents,
            call_external_api,
            calculator
        ]

        chat = self.client.chats.create(
            model="gemini-3.8-flash",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=tools,
                temperature=0.2,
            )
        )

        response = chat.send_message(query)
        iterations = 1

        final_answer = response.text or ""
        return {
            "query": query,
            "answer": final_answer,
            "sources": sources,
            "tool_calls": tool_calls_log,
            "iterations": iterations
        }
