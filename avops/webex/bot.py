"""
Webex bot event handler.

Processes inbound webhook events → triage → ticket creation → agent dispatch.
This is the entry point called by the FastAPI webhook route.
"""

import structlog

from avops.aws.dynamodb import AgentStateStore, TicketStore
from avops.aws.sqs import AgentTaskQueue
from avops.webex.client import get_bot_me, get_message, send_ack
from avops.webex.models import SupportRequest, WebexWebhookEvent
from avops.webex.triage import classify_intent, classify_priority, extract_room_code

log = structlog.get_logger(__name__)

_bot_email: str | None = None  # Cached bot email to filter self-messages


def _get_bot_email() -> str:
    global _bot_email  # noqa: PLW0603
    if not _bot_email:
        me = get_bot_me()
        _bot_email = me.get("emails", [""])[0]
    return _bot_email


def handle_webhook_event(event: WebexWebhookEvent) -> dict:
    """
    Main entry point for Webex webhook events.

    Currently handles ``resource=messages, event=created``.
    Returns a summary dict for logging / response body.
    """
    if event.resource != "messages" or event.event != "created":
        log.debug("webex.event_ignored", resource=event.resource, event=event.event)
        return {"status": "ignored"}

    message_id = event.data.get("id", "")
    if not message_id:
        log.warning("webex.no_message_id", event_id=event.id)
        return {"status": "error", "reason": "no message id"}

    # Fetch full message (webhook only delivers a stub)
    message = get_message(message_id)
    if not message:
        return {"status": "error", "reason": "could not fetch message"}

    # Ignore messages from the bot itself
    bot_email = _get_bot_email()
    if message.person_email == bot_email:
        log.debug("webex.self_message_ignored")
        return {"status": "ignored", "reason": "self message"}

    text = message.text.strip()
    if not text:
        log.debug("webex.empty_message_ignored", message_id=message_id)
        return {"status": "ignored", "reason": "empty message"}

    # ── Triage ────────────────────────────────────────────────────────────────
    intent = classify_intent(text)
    priority = classify_priority(text, intent)
    room_code = extract_room_code(text)

    request = SupportRequest(
        webex_message_id=message_id,
        webex_room_id=message.room_id,
        webex_person_email=message.person_email,
        raw_text=text,
        intent=intent,
        room_id=room_code,
        priority=priority,
    )

    # ── Create ticket ─────────────────────────────────────────────────────────
    ticket_store = TicketStore()
    ticket = ticket_store.create(
        webex_room_id=request.webex_room_id,
        webex_person_email=request.webex_person_email,
        message=request.raw_text,
        intent=request.intent,
        room_id=request.room_id,
        device_id=request.device_id,
    )
    ticket_id = ticket["ticket_id"]
    request.ticket_id = ticket_id

    log.info(
        "webex.ticket_created",
        ticket_id=ticket_id,
        intent=intent,
        priority=priority,
        person=message.person_email,
    )

    # ── Acknowledge to user ───────────────────────────────────────────────────
    send_ack(
        room_id=request.webex_room_id,
        ticket_id=ticket_id,
        intent=intent,
        parent_id=message_id,
    )

    # ── Dispatch agent workflow via SQS ───────────────────────────────────────
    workflow = _select_workflow(intent, priority)
    try:
        queue = AgentTaskQueue()
        queue.enqueue(
            ticket_id=ticket_id,
            workflow=workflow,
            payload={
                "ticket_id": ticket_id,
                "intent": intent,
                "priority": priority,
                "room_id": room_code,
                "message": text,
                "person_email": message.person_email,
                "webex_room_id": message.room_id,
            },
            priority=priority,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "webex.sqs_enqueue_failed",
            ticket_id=ticket_id,
            error=str(exc),
            note="Falling back to synchronous agent dispatch",
        )
        # Fallback: trigger agent inline (for dev environments without SQS)
        _dispatch_inline(ticket_id, workflow, request)

    return {
        "status": "ok",
        "ticket_id": ticket_id,
        "intent": intent,
        "workflow": workflow,
        "priority": priority,
    }


def _select_workflow(intent: str, priority: str) -> str:
    """Choose the appropriate agent workflow based on triage results."""
    if priority == "critical":
        return "incident-response"
    if intent == "device_offline":
        return "incident-response"
    if intent == "firmware":
        return "firmware-rollout"
    return "standard-feature"


def _dispatch_inline(ticket_id: str, workflow: str, request: SupportRequest) -> None:
    """
    Fallback synchronous dispatch for development environments.
    In production SQS → Lambda/ECS worker handles this.
    """
    from avops.agents.orchestrator import run_support_workflow  # noqa: PLC0415

    log.info("webex.inline_dispatch", ticket_id=ticket_id, workflow=workflow)
    try:
        run_support_workflow(
            ticket_id=ticket_id,
            workflow=workflow,
            intent=request.intent,
            message=request.raw_text,
            person_email=request.webex_person_email,
            webex_room_id=request.webex_room_id,
            room_id=request.room_id,
            priority=request.priority,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("webex.inline_dispatch_failed", ticket_id=ticket_id, error=str(exc))
        state_store = AgentStateStore()
        ticket_store = TicketStore()
        ticket_store.update_status(ticket_id, ticket["created_at"], "error")
