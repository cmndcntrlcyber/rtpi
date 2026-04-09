"""
Skill Discovery Service
========================
Indexes and retrieves relevant skills from the unified /skills/ directory.
Supports both agentskills.io YAML+MD format and ClaudeAdvancedPlugins format.

See: docs/enhancements/2.5/skills-directory-structure.mermaid
"""

import yaml
import structlog
from pathlib import Path
from typing import Optional

from ..config import settings

logger = structlog.get_logger()

# In-memory skill index — rebuilt on service startup
_skill_index: dict[str, dict] = {}


def build_index(skills_dir: str | None = None) -> None:
    """
    Scan the skills directory and build the in-memory index.
    Called once at service startup.
    """
    global _skill_index
    _skill_index = {}

    base = Path(skills_dir or settings.skills_dir)
    if not base.exists():
        logger.warning("Skills directory not found", path=str(base))
        return

    for skill_file in base.rglob("*.md"):
        try:
            content = skill_file.read_text(errors="replace")
            if content.startswith("---"):
                # agentskills.io YAML frontmatter format
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    meta = yaml.safe_load(parts[1]) or {}
                    _skill_index[skill_file.stem] = {
                        "name": meta.get("name", skill_file.stem),
                        "description": meta.get("description", ""),
                        "domain": meta.get("domain", "general"),
                        "tags": meta.get("tags", []),
                        "mitre_techniques": meta.get("mitre_techniques", []),
                        "path": str(skill_file),
                        "source": _detect_source(skill_file),
                    }
            else:
                # ClaudeAdvancedPlugins format — directory-based metadata
                _skill_index[skill_file.stem] = {
                    "name": skill_file.stem,
                    "description": content[:200],
                    "domain": _infer_domain(skill_file),
                    "tags": [],
                    "mitre_techniques": [],
                    "path": str(skill_file),
                    "source": "ClaudeAdvancedPlugins",
                }
        except Exception as e:
            logger.debug("Failed to index skill", path=str(skill_file), error=str(e))
            continue

    logger.info("Skill index built", total_skills=len(_skill_index))


def find_skills(
    query: str,
    domain: Optional[str] = None,
    mitre_technique: Optional[str] = None,
    engagement_id: Optional[str] = None,
    limit: int = 10,
) -> list[dict]:
    """
    Find relevant skills by keyword matching + domain/technique filters.
    Returns a list of skill metadata dicts sorted by relevance.
    """
    if not _skill_index:
        build_index()

    results = []
    query_lower = query.lower()

    for name, meta in _skill_index.items():
        score = 0

        # Keyword matching
        if query_lower in meta.get("description", "").lower():
            score += 3
        if query_lower in meta.get("name", "").lower():
            score += 5
        for tag in meta.get("tags", []):
            if query_lower in tag.lower():
                score += 2

        # Individual word matching for multi-word queries
        for word in query_lower.split():
            if len(word) < 3:
                continue
            if word in meta.get("name", "").lower():
                score += 2
            if word in meta.get("description", "").lower():
                score += 1
            for tag in meta.get("tags", []):
                if word in tag.lower():
                    score += 1

        # Domain filter boost
        if domain and meta.get("domain") == domain:
            score += 3

        # MITRE technique filter
        if mitre_technique and mitre_technique in meta.get("mitre_techniques", []):
            score += 5

        if score > 0:
            results.append({**meta, "relevance_score": score})

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results[:limit]


def get_skill_content(skill_name: str) -> str | None:
    """Load the full content of a skill file."""
    meta = _skill_index.get(skill_name)
    if not meta:
        return None
    try:
        return Path(meta["path"]).read_text(errors="replace")
    except Exception:
        return None


def _detect_source(path: Path) -> str:
    parts = str(path).lower()
    if "anthropic" in parts:
        return "Anthropic-Cybersecurity-Skills"
    if "payload" in parts:
        return "PayloadsAllTheThings"
    if "plugin" in parts:
        return "ClaudeAdvancedPlugins"
    return "Custom"


def _infer_domain(path: Path) -> str:
    parts = str(path).lower()
    domain_map = {
        "pentest": "offensive",
        "red-team": "offensive",
        "exploit": "offensive",
        "reverse": "reverse-engineering",
        "crypto": "cryptography",
        "cloud": "cloud-security",
        "api": "api-security",
        "frontend": "development",
        "backend": "development",
        "threat": "threat-modeling",
        "supply": "supply-chain",
        "devsecops": "devsecops",
        "secure-code": "code-review",
        "vuln": "vulnerability-research",
    }
    for key, domain in domain_map.items():
        if key in parts:
            return domain
    return "general"
