# arXiv Verification and Citation Protocol for AI Research Assistants

## Purpose for AI Research Agents
This internal manual guides the autonomous research assistant when retrieving, evaluating, citing, and distinguishing preprints from peer-reviewed literature. When users request state-of-the-art AI literature, preprint comparisons, or arXiv submission workflows, the agent must reference this document.

## Critical arXiv Principles for Research Assistants to Enforce
1. **Preprint Status vs. Peer-Reviewed Literature:**
   - arXiv papers are preprints that have NOT undergone formal peer review.
   - The research assistant must explicitly indicate preprint status when citing arXiv sources in reports.
   - Screened by volunteer moderators only for academic relevance, subject classification (e.g., `cs.AI`, `cs.LG`, `stat.ML`), and basic presentation—not experimental verification.

2. **Source Packaging & Submission Standards:**
   - Format: Strongly requires LaTeX source bundles (`.tex` + figures + `.bbl` bibliography in `.tar.gz` or `.zip` up to 100 MB).
   - Abstract: Must be standard plain text (ASCII/UTF-8) without custom TeX macros. Math expressions must use basic TeX inline math syntax (`$x^2$`).
   - Endorsement System: First-time contributors in specific research categories require an endorsement from an established registered author.

3. **Citation & Versioning Protocol for Agents:**
   - Permanent identifier: `arXiv:YYMM.NNNNN` (e.g., `arXiv:2403.12345`).
   - Version tracking: Always note version tags (`v1`, `v2`, etc.). Once announced, an arXiv preprint cannot be deleted—only revised or formally withdrawn.
   - Standard citation format for research agents:
     `[arXiv:2401.09876] J. Doe et al., "Autonomous Agentic Workflows with Large Language Models," arXiv preprint arXiv:2401.09876, 2024.`
   - When a preprint is subsequently accepted by IEEE or ACM, the agent should preferentially cite the formal journal/conference DOI while referencing the open-access preprint link.

4. **Licensing & Open Access Verification:**
   - Default: arXiv perpetual non-exclusive license.
   - Open Access: Creative Commons Attribution (CC BY 4.0) recommended for public dissemination.
