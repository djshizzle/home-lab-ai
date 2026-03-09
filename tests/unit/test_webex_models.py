"""Unit tests for Webex data models."""

import pytest
from pydantic import ValidationError

from avops.webex.models import BotResponse, SupportRequest, WebexMessage, WebexWebhookEvent


class TestWebexWebhookEvent:
    def test_valid_message_event(self):
        payload = {
            "id": "evt-123",
            "name": "Test",
            "resource": "messages",
            "event": "created",
            "orgId": "org-abc",
            "createdBy": "user-123",
            "appId": "app-456",
            "ownedBy": "creator",
            "status": "active",
            "actorId": "actor-789",
            "data": {"id": "msg-001", "roomId": "room-abc"},
        }
        event = WebexWebhookEvent.model_validate(payload)
        assert event.id == "evt-123"
        assert event.resource == "messages"
        assert event.data["id"] == "msg-001"
        assert event.org_id == "org-abc"  # aliased field

    def test_minimal_event(self):
        event = WebexWebhookEvent.model_validate({
            "id": "x",
            "resource": "messages",
            "event": "created",
            "data": {},
        })
        assert event.id == "x"
        assert event.name == ""


class TestWebexMessage:
    def test_valid_message(self):
        msg = WebexMessage.model_validate({
            "id": "msg-001",
            "roomId": "room-abc",
            "roomType": "group",
            "text": "Camera is not working in conf-3b",
            "personId": "person-123",
            "personEmail": "alice@corp.com",
            "created": "2026-03-09T10:00:00Z",
        })
        assert msg.text == "Camera is not working in conf-3b"
        assert msg.person_email == "alice@corp.com"
        assert msg.room_id == "room-abc"


class TestSupportRequest:
    def test_defaults(self):
        req = SupportRequest(
            webex_message_id="msg-001",
            webex_room_id="room-abc",
            webex_person_email="bob@corp.com",
            raw_text="Audio echo issue",
        )
        assert req.intent == "general"
        assert req.priority == "medium"
        assert req.room_id == ""
        assert req.ticket_id == ""


class TestBotResponse:
    def test_bot_response(self):
        resp = BotResponse(room_id="room-abc", markdown="**Hello**")
        assert resp.room_id == "room-abc"
        assert resp.parent_id == ""
