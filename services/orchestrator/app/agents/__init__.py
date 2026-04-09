"""
RTPI Domain Agent Nodes
========================
Each module implements a LangGraph node function that:
1. Loads relevant skills from the discovery service
2. Queries mem0 for prior context
3. Executes domain-specific tools
4. Stores findings back to mem0
5. Returns updated state
"""
