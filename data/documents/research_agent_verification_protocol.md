# Research Assistant Protocol: Academic Paper Verification & Source Quality Assessment

## Purpose for AI Research Agents
This internal manual governs how the single-agent research assistant evaluates academic sources, verifies quantitative claims, detects retracted papers, and prevents source hallucination during automated literature reviews.

## Core Rules for the Research Agent
1. **Source Hierarchy of Reliability:**
   - Level 1 (Gold Standard): Peer-reviewed journal papers (IEEE Transactions, ACM, Nature, Science).
   - Level 2: Top-tier peer-reviewed conference proceedings (IEEE ICRA/CVPR, NeurIPS, ICML, ICLR).
   - Level 3: Curated preprints (arXiv with high community engagement and author citations).
   - Level 4: Industry technical whitepapers and official government repositories (VAHAN, US DoE, IEA).
   - Flag clearly when assertions come from preprints versus peer-reviewed publications.

2. **Automated Verification Checklist Before Citing:**
   - Never generate hallucinated URLs, authors, or DOIs.
   - For every paper cited, cross-reference the title and year through the agent's web search or internal document index.
   - In quantitative comparisons (e.g., benchmark accuracy, sales figures, battery costs), run the `calculator` tool to verify percentage improvements and deltas rather than trusting unverified claims in prose.

3. **Distinguishing Sourced Facts from Model Analysis:**
   - Sourced facts must have an explicit citation e.g. `[1]` or `[arXiv:YYMM.XXXX]`.
   - Methodological critiques, synthesis, and comparative observations must appear under the "Detailed Analysis" or "Limitations" sections of the research report.
