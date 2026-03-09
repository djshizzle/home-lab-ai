"""Pydantic models for Webex webhook events and bot messages."""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class WebexResource(StrEnum):
    MESSAGES = "messages"
    MEMBERSHIPS = "memberships"
    ROOMS = "rooms"
    ATTACHMENTS = "attachmentActions"


class WebexEventType(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


class WebexWebhookEvent(BaseModel):
    """Inbound Webex webhook payload."""

    id: str
    name: str = ""
    resource: str
    event: str
    filter: str = ""
    org_id: str = Field(default="", alias="orgId")
    created_by: str = Field(default="", alias="createdBy")
    app_id: str = Field(default="", alias="appId")
    owned_by: str = Field(default="", alias="ownedBy")
    status: str = ""
    actor_id: str = Field(default="", alias="actorId")
    data: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class WebexMessage(BaseModel):
    """Parsed Webex message content fetched via API after webhook notification."""

    id: str
    room_id: str = Field(alias="roomId")
    room_type: str = Field(default="", alias="roomType")
    text: str = ""
    person_id: str = Field(default="", alias="personId")
    person_email: str = Field(default="", alias="personEmail")
    created: str = ""
    files: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class SupportRequest(BaseModel):
    """Normalised support request derived from a Webex message."""

    ticket_id: str = ""
    webex_message_id: str
    webex_room_id: str
    webex_person_email: str
    raw_text: str
    intent: str = "general"
    room_id: str = ""           # AV room ID (building-room code)
    device_id: str = ""         # Specific device mentioned
    priority: str = "medium"
    context: dict[str, Any] = Field(default_factory=dict)


class BotResponse(BaseModel):
    """Outbound bot message back to Webex."""

    room_id: str
    markdown: str
    parent_id: str = ""         # Thread reply
