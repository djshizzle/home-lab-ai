"""Webex API client wrapper — send messages, fetch message details, list rooms."""

import hashlib
import hmac
from typing import Any

import structlog
from webexpythonsdk import WebexAPI
from webexpythonsdk.exceptions import ApiError

from avops.config import get_settings
from avops.webex.models import WebexMessage

log = structlog.get_logger(__name__)


def _api() -> WebexAPI:
    """Return Webex API client (created per-call; SDK handles session internally)."""
    return WebexAPI(access_token=get_settings().webex_bot_token)


def verify_webhook_signature(raw_body: bytes, x_spark_signature: str) -> bool:
    """HMAC-SHA1 verification for Webex webhook payloads."""
    secret = get_settings().webex_webhook_secret
    if not secret:
        log.warning("webex.signature_check_skipped", reason="no webhook secret configured")
        return True  # Skip in dev; enforce in prod
    expected = hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha1,
    ).hexdigest()
    return hmac.compare_digest(expected, x_spark_signature.lower())


def get_message(message_id: str) -> WebexMessage | None:
    """Fetch full message details by ID (webhook only provides the ID)."""
    try:
        raw = _api().messages.get(message_id)
        return WebexMessage.model_validate(raw.to_dict())
    except ApiError as exc:
        log.error("webex.get_message_failed", message_id=message_id, error=str(exc))
        return None


def send_message(room_id: str, markdown: str, parent_id: str = "") -> bool:
    """Post a markdown message to a Webex room, optionally as a thread reply."""
    try:
        kwargs: dict[str, Any] = {"roomId": room_id, "markdown": markdown}
        if parent_id:
            kwargs["parentId"] = parent_id
        _api().messages.create(**kwargs)
        log.info("webex.message_sent", room_id=room_id)
        return True
    except ApiError as exc:
        log.error("webex.send_message_failed", room_id=room_id, error=str(exc))
        return False


def send_ack(room_id: str, ticket_id: str, intent: str, parent_id: str = "") -> None:
    """Send a standardised acknowledgement back to the user."""
    intent_label = intent.replace("_", " ").title()
    markdown = (
        f"**AVops Support** — Ticket `{ticket_id[:8]}` created ✓\n\n"
        f"> **Category:** {intent_label}\n\n"
        "I'm routing your request through the support agent team. "
        "I'll update you here when diagnostics are complete."
    )
    send_message(room_id, markdown, parent_id)


def send_resolution(
    room_id: str, ticket_id: str, resolution: str, parent_id: str = ""
) -> None:
    """Send a resolution summary to the user."""
    markdown = (
        f"**AVops Support — Resolution** `{ticket_id[:8]}`\n\n"
        f"{resolution}\n\n"
        "_If this didn't resolve your issue, reply here and a new ticket will be opened._"
    )
    send_message(room_id, markdown, parent_id)


def get_bot_me() -> dict[str, Any]:
    """Return the bot's own identity (used to filter self-messages)."""
    try:
        me = _api().people.me()
        return me.to_dict()
    except ApiError as exc:
        log.error("webex.get_me_failed", error=str(exc))
        return {}


def list_rooms() -> list[dict[str, Any]]:
    """List all rooms the bot is a member of."""
    try:
        return [r.to_dict() for r in _api().rooms.list()]
    except ApiError as exc:
        log.error("webex.list_rooms_failed", error=str(exc))
        return []
