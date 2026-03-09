"""Support ticket management endpoints — list, get, update status."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from avops.aws.dynamodb import TicketStore

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketStatusUpdate(BaseModel):
    status: str
    created_at: str


@router.get("")
async def list_tickets(
    status: str = Query(default="open", description="Filter by status: open|in_progress|resolved"),
    limit: int = Query(default=50, ge=1, le=200),
):
    """List support tickets. Defaults to open tickets."""
    store = TicketStore()
    if status == "open":
        tickets = store.list_open(limit=limit)
    else:
        # Scan all — in production use GSI for efficiency
        from avops.aws.client import get_dynamodb  # noqa: PLC0415
        from avops.config import get_settings  # noqa: PLC0415
        from boto3.dynamodb.conditions import Attr  # noqa: PLC0415

        table = get_dynamodb().Table(get_settings().dynamo_tickets_table)
        resp = table.scan(FilterExpression=Attr("status").eq(status), Limit=limit)
        tickets = resp.get("Items", [])

    return {"tickets": tickets, "count": len(tickets)}


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Retrieve a single ticket by ID."""
    store = TicketStore()
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    return ticket


@router.patch("/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, body: TicketStatusUpdate):
    """Manually update ticket status (for AV technician use)."""
    store = TicketStore()
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    store.update_status(ticket_id, body.created_at, body.status)
    return {"ticket_id": ticket_id, "status": body.status}


@router.get("/room/{webex_room_id}")
async def tickets_by_room(
    webex_room_id: str,
    limit: int = Query(default=20, ge=1, le=100),
):
    """List recent tickets for a specific Webex room."""
    store = TicketStore()
    tickets = store.list_by_room(webex_room_id, limit=limit)
    return {"webex_room_id": webex_room_id, "tickets": tickets, "count": len(tickets)}
