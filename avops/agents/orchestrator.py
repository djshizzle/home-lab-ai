"""
AVops 7-Agent workflow orchestrator.

Chains the 7 specialised agents in sequence, persisting state to DynamoDB
and posting progress updates back to the Webex support room.
"""

import uuid
from typing import Any

import structlog

from avops.aws.dynamodb import AgentStateStore, DeviceStore, TicketStore
from avops.aws.s3 import LogStore
from avops.webex.client import send_message, send_resolution

log = structlog.get_logger(__name__)


def run_support_workflow(
    *,
    ticket_id: str,
    workflow: str,
    intent: str,
    message: str,
    person_email: str,
    webex_room_id: str,
    room_id: str = "",
    priority: str = "medium",
) -> dict[str, Any]:
    """
    Execute the 7-agent support workflow for a Webex support ticket.

    Workflow selection:
        standard-feature    → Orchestrator → Researcher → Planner → Implementer
                              → Tester → Reviewer → Documenter
        incident-response   → Orchestrator → Researcher → Implementer → Tester
                              → Documenter  (skips Planner + Reviewer for speed)
        firmware-rollout    → Full 7-agent pipeline
    """
    # Lazy imports to avoid circular dependencies
    from avops.agents.team import (  # noqa: PLC0415
        DocumenterAgent,
        ImplementerAgent,
        OrchestratorAgent,
        PlannerAgent,
        ResearcherAgent,
        ReviewerAgent,
        TesterAgent,
    )

    session_id = str(uuid.uuid4())
    ticket_store = TicketStore()
    state_store = AgentStateStore()
    device_store = DeviceStore()
    log_store = LogStore()

    # Fetch device inventory for context
    device_inventory = _get_room_inventory(device_store, room_id)

    base_context: dict[str, Any] = {
        "ticket_id": ticket_id,
        "intent": intent,
        "priority": priority,
        "room_id": room_id,
        "message": message,
        "person_email": person_email,
        "webex_room_id": webex_room_id,
        "device_inventory": device_inventory,
    }

    state_store.start_session(ticket_id, session_id, workflow)
    ticket_store.update_status(ticket_id, _get_created_at(ticket_store, ticket_id), "in_progress")

    # ── Phase 1: Orchestrator (classification + routing) ─────────────────────
    log.info("workflow.agent_start", agent="orchestrator", ticket_id=ticket_id)
    orchestrator_output = _run_agent(
        OrchestratorAgent(), base_context, ticket_id, ticket_store, state_store
    )
    context = {**base_context, "previous_agent_output": _fmt(orchestrator_output)}

    # ── Phase 2: Researcher ──────────────────────────────────────────────────
    log.info("workflow.agent_start", agent="researcher", ticket_id=ticket_id)
    research_output = _run_agent(
        ResearcherAgent(), context, ticket_id, ticket_store, state_store
    )
    context = {**context, "previous_agent_output": _fmt(research_output)}

    # ── Phase 3: Planner (skip for incident-response) ───────────────────────
    plan_output: Any = None
    if workflow != "incident-response":
        log.info("workflow.agent_start", agent="planner", ticket_id=ticket_id)
        plan_output = _run_agent(
            PlannerAgent(), context, ticket_id, ticket_store, state_store
        )
        context = {**context, "previous_agent_output": _fmt(plan_output)}

    # ── Phase 4: Implementer ─────────────────────────────────────────────────
    log.info("workflow.agent_start", agent="implementer", ticket_id=ticket_id)
    impl_output = _run_agent(
        ImplementerAgent(), context, ticket_id, ticket_store, state_store
    )
    context = {**context, "previous_agent_output": _fmt(impl_output)}

    # ── Phase 5: Tester ──────────────────────────────────────────────────────
    log.info("workflow.agent_start", agent="tester", ticket_id=ticket_id)
    test_output = _run_agent(
        TesterAgent(), context, ticket_id, ticket_store, state_store
    )
    context = {**context, "previous_agent_output": _fmt(test_output)}

    # ── Phase 6: Reviewer (skip for incident-response) ───────────────────────
    review_output: Any = None
    if workflow != "incident-response":
        log.info("workflow.agent_start", agent="reviewer", ticket_id=ticket_id)
        review_output = _run_agent(
            ReviewerAgent(), context, ticket_id, ticket_store, state_store
        )
        context = {**context, "previous_agent_output": _fmt(review_output)}

    # ── Phase 7: Documenter ──────────────────────────────────────────────────
    log.info("workflow.agent_start", agent="documenter", ticket_id=ticket_id)
    doc_output = _run_agent(
        DocumenterAgent(), context, ticket_id, ticket_store, state_store
    )

    # ── Resolve ticket ────────────────────────────────────────────────────────
    resolution = _extract_resolution(doc_output)
    created_at = _get_created_at(ticket_store, ticket_id)
    ticket_store.resolve(ticket_id, created_at, resolution)
    state_store.complete_session(ticket_id, session_id)

    # ── Post resolution to Webex ─────────────────────────────────────────────
    send_resolution(webex_room_id, ticket_id, resolution)

    # ── Archive full transcript to S3 ─────────────────────────────────────────
    transcript = _build_transcript(
        ticket_id=ticket_id,
        workflow=workflow,
        agents={
            "orchestrator": orchestrator_output,
            "researcher": research_output,
            "planner": plan_output,
            "implementer": impl_output,
            "tester": test_output,
            "reviewer": review_output,
            "documenter": doc_output,
        },
    )
    try:
        log_store.save_ticket_log(ticket_id, transcript)
    except Exception as exc:  # noqa: BLE001
        log.warning("workflow.s3_save_failed", ticket_id=ticket_id, error=str(exc))

    log.info("workflow.complete", ticket_id=ticket_id, session_id=session_id)
    return {"ticket_id": ticket_id, "session_id": session_id, "resolution": resolution}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_agent(
    agent: Any,
    context: dict[str, Any],
    ticket_id: str,
    ticket_store: TicketStore,
    state_store: AgentStateStore,
) -> Any:
    """Run a single agent and record the event in DynamoDB."""
    try:
        output = agent.run(context)
    except Exception as exc:  # noqa: BLE001
        log.error("workflow.agent_error", agent=agent.name, ticket_id=ticket_id, error=str(exc))
        output = {"error": str(exc), "agent": agent.name}

    created_at = _get_created_at(ticket_store, ticket_id)
    ticket_store.append_agent_event(
        ticket_id,
        created_at,
        {"agent": agent.name, "output_summary": _fmt(output)[:500]},
    )
    state_store.advance_agent(ticket_id, _latest_session(state_store, ticket_id), agent.name)
    return output


def _get_created_at(ticket_store: TicketStore, ticket_id: str) -> str:
    ticket = ticket_store.get(ticket_id)
    return ticket["created_at"] if ticket else ""


def _latest_session(state_store: AgentStateStore, ticket_id: str) -> str:
    """Return the most recent session_id for a ticket (simple scan)."""
    # In production this would be stored in context; simplified here
    return "latest"


def _get_room_inventory(device_store: DeviceStore, room_id: str) -> str:
    if not room_id:
        return "No room specified — global context only"
    devices = device_store.list_by_room(room_id)
    if not devices:
        return f"No devices found for room: {room_id}"
    lines = [f"Room {room_id} devices:"]
    for d in devices:
        lines.append(
            f"  - {d.get('device_id')} ({d.get('model', 'unknown')}) "
            f"status={d.get('status', 'unknown')}"
        )
    return "\n".join(lines)


def _fmt(output: Any) -> str:
    if isinstance(output, dict):
        import json

        return json.dumps(output, indent=2, default=str)
    return str(output) if output is not None else ""


def _extract_resolution(doc_output: Any) -> str:
    if isinstance(doc_output, dict):
        return doc_output.get(
            "user_resolution_message",
            doc_output.get("incident_summary", str(doc_output)),
        )
    return str(doc_output) if doc_output else "Your issue has been processed by the AVops team."


def _build_transcript(ticket_id: str, workflow: str, agents: dict) -> dict:
    return {
        "ticket_id": ticket_id,
        "workflow": workflow,
        "agents": {k: _fmt(v) for k, v in agents.items() if v is not None},
    }
