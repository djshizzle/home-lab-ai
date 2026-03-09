"""SQS message queue — Webex events and agent task dispatching."""

import json
import uuid
from typing import Any

import structlog

from avops.aws.client import get_sqs
from avops.config import get_settings

log = structlog.get_logger(__name__)


class AgentTaskQueue:
    """Dispatch and receive agent workflow tasks via SQS."""

    def __init__(self):
        self._sqs = get_sqs()
        self._queue_url = get_settings().sqs_agent_queue_url

    def enqueue(
        self,
        ticket_id: str,
        workflow: str,
        payload: dict[str, Any],
        priority: str = "medium",
    ) -> str:
        """Enqueue an agent workflow task. Returns SQS message ID."""
        body = {
            "task_id": str(uuid.uuid4()),
            "ticket_id": ticket_id,
            "workflow": workflow,
            "priority": priority,
            "payload": payload,
        }
        resp = self._sqs.send_message(
            QueueUrl=self._queue_url,
            MessageBody=json.dumps(body),
            MessageGroupId=ticket_id,          # FIFO queue — group by ticket
            MessageDeduplicationId=body["task_id"],
            MessageAttributes={
                "priority": {
                    "StringValue": priority,
                    "DataType": "String",
                },
            },
        )
        msg_id = resp["MessageId"]
        log.info("sqs.task_enqueued", ticket_id=ticket_id, workflow=workflow, msg_id=msg_id)
        return msg_id

    def receive(self, max_messages: int = 10) -> list[dict[str, Any]]:
        """Poll for pending agent tasks."""
        resp = self._sqs.receive_message(
            QueueUrl=self._queue_url,
            MaxNumberOfMessages=min(max_messages, 10),
            WaitTimeSeconds=5,
            MessageAttributeNames=["All"],
        )
        return resp.get("Messages", [])

    def delete(self, receipt_handle: str) -> None:
        """Acknowledge and delete a processed message."""
        self._sqs.delete_message(
            QueueUrl=self._queue_url,
            ReceiptHandle=receipt_handle,
        )
        log.debug("sqs.message_deleted")


class WebexEventQueue:
    """Buffer incoming Webex webhook events before agent processing."""

    def __init__(self):
        self._sqs = get_sqs()
        self._queue_url = get_settings().sqs_webex_event_queue_url

    def enqueue_event(self, event: dict[str, Any]) -> str:
        resp = self._sqs.send_message(
            QueueUrl=self._queue_url,
            MessageBody=json.dumps(event),
            MessageDeduplicationId=event.get("id", str(uuid.uuid4())),
            MessageGroupId="webex-events",
        )
        log.debug("sqs.webex_event_queued", event_id=event.get("id"))
        return resp["MessageId"]

    def receive_events(self, max_messages: int = 10) -> list[dict[str, Any]]:
        resp = self._sqs.receive_message(
            QueueUrl=self._queue_url,
            MaxNumberOfMessages=min(max_messages, 10),
            WaitTimeSeconds=2,
        )
        return resp.get("Messages", [])

    def delete(self, receipt_handle: str) -> None:
        self._sqs.delete_message(
            QueueUrl=self._queue_url,
            ReceiptHandle=receipt_handle,
        )
