"""Tests for the agent heartbeat wrapper."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from avops.heartbeat.wrapper import (
    HeartbeatWrapper,
    NoTasksAvailableError,
    PermissionError,
)


@pytest.fixture()
def recovery_dir(tmp_path: Path) -> Path:
    return tmp_path / "recovery"


@pytest.fixture()
def wrapper(recovery_dir: Path) -> HeartbeatWrapper:
    return HeartbeatWrapper(
        agent_id="test-agent-01",
        paperclip_base_url="https://paperclip.test/api/v1",
        api_token="test-token",
        recovery_dir=recovery_dir,
    )


def _mock_response(json_data: dict, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://paperclip.test"),
    )


# --------------------------------------------------------------------- #
# 1. Permission verification
# --------------------------------------------------------------------- #


class TestVerifyPermissions:
    def test_passes_when_all_permissions_granted(self, wrapper: HeartbeatWrapper):
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.return_value = _mock_response(
            {"permissions": ["tasks:assign", "devices:read"]}
        )
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        wrapper.verify_permissions()  # should not raise

    def test_raises_when_missing_permissions(self, wrapper: HeartbeatWrapper):
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.return_value = _mock_response(
            {"permissions": ["devices:read"]}
        )
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        with pytest.raises(PermissionError, match="tasks:assign"):
            wrapper.verify_permissions()

    def test_raises_when_empty_permissions(self, wrapper: HeartbeatWrapper):
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.return_value = _mock_response({"permissions": []})
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        with pytest.raises(PermissionError):
            wrapper.verify_permissions()


# --------------------------------------------------------------------- #
# 2. Task fetching with retry
# --------------------------------------------------------------------- #


class TestFetchAssignedTask:
    def test_returns_task_on_first_attempt(self, wrapper: HeartbeatWrapper):
        task = {"id": "task-42", "type": "firmware_update"}
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.return_value = _mock_response({"tasks": [task]})
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        result = wrapper.fetch_assigned_task()
        assert result == task

    @patch("avops.heartbeat.wrapper.time.sleep")
    def test_retries_then_finds_task(self, mock_sleep, wrapper: HeartbeatWrapper):
        task = {"id": "task-99", "type": "health_check"}
        empty = _mock_response({"tasks": []})
        found = _mock_response({"tasks": [task]})

        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.side_effect = [empty, found]
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        result = wrapper.fetch_assigned_task()
        assert result == task
        mock_sleep.assert_called_once_with(2)  # backoff: 2^1

    @patch("avops.heartbeat.wrapper.time.sleep")
    def test_raises_after_max_retries(self, mock_sleep, wrapper: HeartbeatWrapper):
        empty = _mock_response({"tasks": []})

        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.return_value = empty
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        with pytest.raises(NoTasksAvailableError, match="3 attempts"):
            wrapper.fetch_assigned_task()

        # Should sleep twice (after attempt 1 and 2, not after 3)
        assert mock_sleep.call_count == 2


# --------------------------------------------------------------------- #
# 3. Recovery state
# --------------------------------------------------------------------- #


class TestRecoveryState:
    def test_write_and_load(self, wrapper: HeartbeatWrapper, recovery_dir: Path):
        task = {"id": "task-7", "type": "config_push"}
        wrapper.write_recovery_state(task, phase="interrupted")

        state = wrapper.load_recovery_state()
        assert state is not None
        assert state["task_id"] == "task-7"
        assert state["phase"] == "interrupted"

    def test_load_returns_none_when_no_file(self, wrapper: HeartbeatWrapper):
        assert wrapper.load_recovery_state() is None

    def test_clear_removes_file(self, wrapper: HeartbeatWrapper, recovery_dir: Path):
        task = {"id": "task-7", "type": "config_push"}
        wrapper.write_recovery_state(task, phase="error", error="boom")

        wrapper.clear_recovery_state()
        assert wrapper.load_recovery_state() is None

    def test_partial_result_persisted(self, wrapper: HeartbeatWrapper):
        task = {"id": "task-8", "type": "audit"}
        wrapper.write_recovery_state(
            task, phase="error", partial_result={"scanned": 5}
        )

        state = wrapper.load_recovery_state()
        assert state["partial_result"] == {"scanned": 5}


# --------------------------------------------------------------------- #
# 4. Status posting
# --------------------------------------------------------------------- #


class TestStatusPosting:
    def test_posts_json_with_proper_escaping(self, wrapper: HeartbeatWrapper):
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        wrapper._post_status(
            "executing",
            'Detail with "quotes" and special chars: <>&',
            task_id="task-1",
        )

        call_args = mock_client.post.call_args
        posted_body = json.loads(call_args.kwargs["content"])
        assert posted_body["phase"] == "executing"
        assert '"quotes"' in posted_body["detail"]
        assert "<>&" in posted_body["detail"]

    def test_status_post_failure_does_not_raise(self, wrapper: HeartbeatWrapper):
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.post.side_effect = httpx.ConnectError("connection refused")
        wrapper._client = mock_client

        # Should log warning but not raise
        wrapper._post_status("error", "test")


# --------------------------------------------------------------------- #
# 5. Full wrap() integration
# --------------------------------------------------------------------- #


class TestWrapIntegration:
    @patch("avops.heartbeat.wrapper.time.sleep")
    def test_happy_path(self, mock_sleep, wrapper: HeartbeatWrapper):
        task = {"id": "task-100", "type": "reboot"}
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.side_effect = [
            _mock_response({"permissions": ["tasks:assign"]}),
            _mock_response({"tasks": [task]}),
        ]
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        @wrapper.wrap
        def do_work(t: dict) -> dict:
            return {"rebooted": t["id"]}

        result = do_work()
        assert result == {"rebooted": "task-100"}

    @patch("avops.heartbeat.wrapper.time.sleep")
    def test_task_error_writes_recovery(
        self, mock_sleep, wrapper: HeartbeatWrapper, recovery_dir: Path
    ):
        task = {"id": "task-200", "type": "update"}
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.side_effect = [
            _mock_response({"permissions": ["tasks:assign"]}),
            _mock_response({"tasks": [task]}),
        ]
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        @wrapper.wrap
        def failing_work(t: dict) -> dict:
            raise RuntimeError("device unreachable")

        with pytest.raises(RuntimeError, match="device unreachable"):
            failing_work()

        state = wrapper.load_recovery_state()
        assert state is not None
        assert state["error"] == "device unreachable"

    @patch("avops.heartbeat.wrapper.time.sleep")
    def test_keyboard_interrupt_writes_recovery(
        self, mock_sleep, wrapper: HeartbeatWrapper, recovery_dir: Path
    ):
        task = {"id": "task-300", "type": "audit"}
        mock_client = MagicMock(spec=httpx.Client)
        mock_client.is_closed = False
        mock_client.get.side_effect = [
            _mock_response({"permissions": ["tasks:assign"]}),
            _mock_response({"tasks": [task]}),
        ]
        mock_client.post.return_value = _mock_response({"ok": True})
        wrapper._client = mock_client

        @wrapper.wrap
        def interrupted_work(t: dict) -> dict:
            raise KeyboardInterrupt()

        with pytest.raises(KeyboardInterrupt):
            interrupted_work()

        state = wrapper.load_recovery_state()
        assert state is not None
        assert state["phase"] == "interrupted"
