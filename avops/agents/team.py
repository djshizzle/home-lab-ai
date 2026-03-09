"""
7-Agent team definitions for AVops Webex support.

Each agent is a single-turn call to Claude with a specialised system prompt.
The Orchestrator chains them in sequence, passing outputs as inputs downstream.
"""

from typing import Any

import structlog

from avops.agents.base import BaseAgent
from avops.agents.prompts import (
    DOCUMENTER_SYSTEM,
    IMPLEMENTER_SYSTEM,
    ORCHESTRATOR_SYSTEM,
    PLANNER_SYSTEM,
    RESEARCHER_SYSTEM,
    REVIEWER_SYSTEM,
    TESTER_SYSTEM,
)

log = structlog.get_logger(__name__)


def _build_context_message(context: dict[str, Any]) -> str:
    """Serialise ticket context into a human-readable user message."""
    lines = [
        f"**Ticket ID:** {context.get('ticket_id', 'N/A')}",
        f"**Intent:** {context.get('intent', 'general')}",
        f"**Priority:** {context.get('priority', 'medium')}",
        f"**Room:** {context.get('room_id', 'unknown')}",
        f"**Reported by:** {context.get('person_email', 'unknown')}",
        f"**Message:** {context.get('message', '')}",
    ]
    if context.get("device_inventory"):
        lines.append(f"\n**Device Inventory:**\n{context['device_inventory']}")
    if context.get("previous_agent_output"):
        lines.append(f"\n**Previous Agent Output:**\n{context['previous_agent_output']}")
    return "\n".join(lines)


# ── Agent 1: Orchestrator (classification only — routing is in orchestrator.py) ──

class OrchestratorAgent(BaseAgent):
    name = "orchestrator"
    use_fast_model = False

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(ORCHESTRATOR_SYSTEM, msg)


# ── Agent 2: Researcher ────────────────────────────────────────────────────────

class ResearcherAgent(BaseAgent):
    name = "researcher"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(RESEARCHER_SYSTEM, msg)


# ── Agent 3: Planner ──────────────────────────────────────────────────────────

class PlannerAgent(BaseAgent):
    name = "planner"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(PLANNER_SYSTEM, msg)


# ── Agent 4: Implementer ──────────────────────────────────────────────────────

class ImplementerAgent(BaseAgent):
    name = "implementer"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(IMPLEMENTER_SYSTEM, msg)


# ── Agent 5: Tester ───────────────────────────────────────────────────────────

class TesterAgent(BaseAgent):
    name = "tester"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(TESTER_SYSTEM, msg)


# ── Agent 6: Reviewer ─────────────────────────────────────────────────────────

class ReviewerAgent(BaseAgent):
    name = "reviewer"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(REVIEWER_SYSTEM, msg)


# ── Agent 7: Documenter ───────────────────────────────────────────────────────

class DocumenterAgent(BaseAgent):
    name = "documenter"

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        msg = _build_context_message(context)
        return self._call(DOCUMENTER_SYSTEM, msg)
