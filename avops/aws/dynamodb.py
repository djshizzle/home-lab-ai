"""DynamoDB data access layer for AVops support tickets, devices, and agent state."""

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from boto3.dynamodb.conditions import Attr, Key

from avops.aws.client import get_dynamodb
from avops.config import get_settings

log = structlog.get_logger(__name__)


def _ts() -> str:
    return datetime.now(UTC).isoformat()


def _table(name: str):
    return get_dynamodb().Table(name)


# ── Support Tickets ───────────────────────────────────────────────────────────

class TicketStore:
    """CRUD for avops-support-tickets DynamoDB table.

    Schema:
        PK: ticket_id (str, UUID)
        SK: created_at (ISO-8601)
        GSI1: webex_room_id + created_at   (list tickets per room)
        GSI2: status + created_at           (list by status)
    """

    def __init__(self):
        self._table = _table(get_settings().dynamo_tickets_table)

    def create(
        self,
        *,
        webex_room_id: str,
        webex_person_email: str,
        message: str,
        intent: str,
        room_id: str = "",
        device_id: str = "",
    ) -> dict[str, Any]:
        now = _ts()
        ticket_id = str(uuid.uuid4())
        item: dict[str, Any] = {
            "ticket_id": ticket_id,
            "created_at": now,
            "updated_at": now,
            "status": "open",
            "priority": "medium",
            "webex_room_id": webex_room_id,
            "webex_person_email": webex_person_email,
            "message": message,
            "intent": intent,
            "room_id": room_id,
            "device_id": device_id,
            "agent_workflow": [],
            "resolution": "",
        }
        self._table.put_item(Item=item)
        log.info("ticket.created", ticket_id=ticket_id, intent=intent)
        return item

    def get(self, ticket_id: str) -> dict[str, Any] | None:
        resp = self._table.query(
            KeyConditionExpression=Key("ticket_id").eq(ticket_id),
            Limit=1,
        )
        items = resp.get("Items", [])
        return items[0] if items else None

    def update_status(self, ticket_id: str, created_at: str, status: str) -> None:
        self._table.update_item(
            Key={"ticket_id": ticket_id, "created_at": created_at},
            UpdateExpression="SET #s = :s, updated_at = :ua",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status, ":ua": _ts()},
        )
        log.info("ticket.status_updated", ticket_id=ticket_id, status=status)

    def append_agent_event(
        self, ticket_id: str, created_at: str, event: dict[str, Any]
    ) -> None:
        event["timestamp"] = _ts()
        self._table.update_item(
            Key={"ticket_id": ticket_id, "created_at": created_at},
            UpdateExpression="SET agent_workflow = list_append(agent_workflow, :e), updated_at = :ua",
            ExpressionAttributeValues={":e": [event], ":ua": _ts()},
        )

    def resolve(self, ticket_id: str, created_at: str, resolution: str) -> None:
        self._table.update_item(
            Key={"ticket_id": ticket_id, "created_at": created_at},
            UpdateExpression="SET #s = :s, resolution = :r, resolved_at = :ra, updated_at = :ua",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":s": "resolved",
                ":r": resolution,
                ":ra": _ts(),
                ":ua": _ts(),
            },
        )
        log.info("ticket.resolved", ticket_id=ticket_id)

    def list_open(self, limit: int = 50) -> list[dict[str, Any]]:
        resp = self._table.scan(
            FilterExpression=Attr("status").eq("open"),
            Limit=limit,
        )
        return resp.get("Items", [])

    def list_by_room(self, webex_room_id: str, limit: int = 20) -> list[dict[str, Any]]:
        resp = self._table.query(
            IndexName="webex_room_id-created_at-index",
            KeyConditionExpression=Key("webex_room_id").eq(webex_room_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        return resp.get("Items", [])


# ── Device Inventory ──────────────────────────────────────────────────────────

class DeviceStore:
    """CRUD for avops-devices DynamoDB table.

    Schema:
        PK: device_id   (str, e.g. hq-conf3b-ctrl-01)
        SK: room_id     (str, e.g. hq-031)
    """

    def __init__(self):
        self._table = _table(get_settings().dynamo_devices_table)

    def put(self, device: dict[str, Any]) -> None:
        device.setdefault("created_at", _ts())
        device["updated_at"] = _ts()
        self._table.put_item(Item=device)
        log.info("device.upserted", device_id=device.get("device_id"))

    def get(self, device_id: str, room_id: str) -> dict[str, Any] | None:
        resp = self._table.get_item(Key={"device_id": device_id, "room_id": room_id})
        return resp.get("Item")

    def update_status(self, device_id: str, room_id: str, status: str) -> None:
        self._table.update_item(
            Key={"device_id": device_id, "room_id": room_id},
            UpdateExpression="SET #s = :s, updated_at = :ua",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status, ":ua": _ts()},
        )
        log.info(
            "device.status_updated",
            device_id=device_id,
            room_id=room_id,
            new_status=status,
        )

    def list_by_room(self, room_id: str) -> list[dict[str, Any]]:
        resp = self._table.query(
            IndexName="room_id-index",
            KeyConditionExpression=Key("room_id").eq(room_id),
        )
        return resp.get("Items", [])

    def list_webex_devices(self) -> list[dict[str, Any]]:
        resp = self._table.scan(
            FilterExpression=Attr("webex_supported").eq(True),
        )
        return resp.get("Items", [])


# ── Agent State ───────────────────────────────────────────────────────────────

class AgentStateStore:
    """Tracks running agent workflow sessions per ticket.

    Schema:
        PK: ticket_id
        SK: session_id
    """

    def __init__(self):
        self._table = _table(get_settings().dynamo_agent_state_table)

    def start_session(self, ticket_id: str, session_id: str, workflow: str) -> None:
        self._table.put_item(
            Item={
                "ticket_id": ticket_id,
                "session_id": session_id,
                "workflow": workflow,
                "status": "running",
                "started_at": _ts(),
                "agents_completed": [],
                "current_agent": "orchestrator",
            }
        )

    def advance_agent(self, ticket_id: str, session_id: str, agent_name: str) -> None:
        self._table.update_item(
            Key={"ticket_id": ticket_id, "session_id": session_id},
            UpdateExpression=(
                "SET current_agent = :a, "
                "agents_completed = list_append(agents_completed, :ac), "
                "updated_at = :ua"
            ),
            ExpressionAttributeValues={
                ":a": agent_name,
                ":ac": [agent_name],
                ":ua": _ts(),
            },
        )

    def complete_session(self, ticket_id: str, session_id: str) -> None:
        self._table.update_item(
            Key={"ticket_id": ticket_id, "session_id": session_id},
            UpdateExpression="SET #s = :s, completed_at = :ca",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": "completed", ":ca": _ts()},
        )
