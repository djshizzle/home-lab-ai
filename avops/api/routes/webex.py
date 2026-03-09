"""Webex webhook receiver — validates signature and dispatches to bot handler."""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import ValidationError

from avops.webex.bot import handle_webhook_event
from avops.webex.client import verify_webhook_signature
from avops.webex.models import WebexWebhookEvent

import structlog

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks/webex", tags=["webex"])


@router.post("")
async def webex_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive Webex webhook events.

    Webex sends a POST with JSON body and X-Spark-Signature header (HMAC-SHA1).
    We acknowledge immediately (200) and process asynchronously.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Spark-Signature", "")

    # Verify webhook authenticity
    if not verify_webhook_signature(raw_body, signature):
        log.warning("webex.invalid_signature", signature=signature[:20])
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    try:
        payload = await request.json()
        event = WebexWebhookEvent.model_validate(payload)
    except (ValidationError, Exception) as exc:
        log.error("webex.parse_error", error=str(exc))
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    # Dispatch to bot handler in the background — webhook must return quickly
    background_tasks.add_task(handle_webhook_event, event)

    log.info(
        "webex.webhook_received",
        event_id=event.id,
        resource=event.resource,
        event_type=event.event,
    )
    return Response(status_code=200)
