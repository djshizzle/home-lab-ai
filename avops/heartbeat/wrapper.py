"""Resilient heartbeat wrapper for Paperclip-based agents.

Provides pre-flight checks (permissions, task assignment) and resilience
(retry with backoff, session recovery, structured status posting) that run
before any task logic executes.

Usage:
    from avops.heartbeat import HeartbeatWrapper

    wrapper = HeartbeatWrapper(
        agent_id="hq-conf3b-ctrl-01",
        paperclip_base_url="https://paperclip.internal/api/v1",
        api_token=os.environ["PAPERCLIP_TOKEN"],
    )

    @wrapper.wrap
    def my_task_logic(task: dict) -> dict:
        # ... your agent skill logic ...
        return {"result": "ok"}

    # Runs permission check → task fetch (with retry) → your logic → status post.
    my_task_logic()
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import httpx

logger = logging.getLogger(__name__)

RECOVERY_DIR = Path(os.environ.get("HEARTBEAT_RECOVERY_DIR", ".agent-workspace"))
MAX_TASK_RETRIES = 3
BACKOFF_BASE_SECONDS = 2


@dataclass
class HeartbeatStatus:
    """Structured status payload posted to the Paperclip API."""

    agent_id: str
    timestamp: str
    phase: str  # "permission_check" | "task_fetch" | "executing" | "completed" | "error"
    detail: str = ""
    task_id: str | None = None
    recovery_file: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(self.__dict__, ensure_ascii=False)


class PermissionError(Exception):
    """Raised when the agent lacks required Paperclip permissions."""


class NoTasksAvailableError(Exception):
    """Raised after exhausting retries with no tasks assigned."""


class HeartbeatWrapper:
    """Wraps agent task logic with resilience and observability.

    Parameters
    ----------
    agent_id:
        Unique identifier for this agent instance.
    paperclip_base_url:
        Root URL for the Paperclip API (no trailing slash).
    api_token:
        Bearer token for Paperclip API auth.
    required_permissions:
        Permissions to verify before running. Defaults to ``["tasks:assign"]``.
    recovery_dir:
        Directory for recovery state files. Defaults to ``.agent-workspace``.
    http_timeout:
        Timeout in seconds for Paperclip API calls.
    """

    def __init__(
        self,
        agent_id: str,
        paperclip_base_url: str,
        api_token: str,
        required_permissions: list[str] | None = None,
        recovery_dir: Path | None = None,
        http_timeout: float = 30.0,
    ) -> None:
        self.agent_id = agent_id
        self.base_url = paperclip_base_url.rstrip("/")
        self.api_token = api_token
        self.required_permissions = required_permissions or ["tasks:assign"]
        self.recovery_dir = recovery_dir or RECOVERY_DIR
        self.http_timeout = http_timeout
        self._client: httpx.Client | None = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                },
                timeout=self.http_timeout,
            )
        return self._client

    def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            self._client.close()

    # ------------------------------------------------------------------
    # 1. Permission verification
    # ------------------------------------------------------------------

    def verify_permissions(self) -> None:
        """Check that the agent has all required Paperclip permissions.

        Raises ``PermissionError`` immediately if any are missing so the
        caller can escalate without running task logic.
        """
        resp = self.client.get(f"/agents/{self.agent_id}/permissions")
        resp.raise_for_status()

        granted: list[str] = resp.json().get("permissions", [])
        missing = [p for p in self.required_permissions if p not in granted]

        if missing:
            self._post_status("permission_check", f"Missing permissions: {missing}")
            raise PermissionError(
                f"Agent {self.agent_id} lacks required permissions: {missing}. "
                "Escalate to an admin to grant them before retrying."
            )

        logger.info("Permissions verified for %s: %s", self.agent_id, granted)

    # ------------------------------------------------------------------
    # 2. Task fetching with retry + backoff
    # ------------------------------------------------------------------

    def fetch_assigned_task(self) -> dict[str, Any]:
        """Fetch the next assigned task, retrying up to 3 times with backoff.

        Returns the task dict on success.  Raises ``NoTasksAvailableError``
        after all retries are exhausted.
        """
        for attempt in range(1, MAX_TASK_RETRIES + 1):
            resp = self.client.get(
                f"/agents/{self.agent_id}/tasks",
                params={"status": "assigned", "limit": 1},
            )
            resp.raise_for_status()

            tasks: list[dict[str, Any]] = resp.json().get("tasks", [])
            if tasks:
                task = tasks[0]
                logger.info("Task %s fetched on attempt %d", task.get("id"), attempt)
                return task

            wait = BACKOFF_BASE_SECONDS**attempt
            status_detail = (
                f"No tasks assigned (attempt {attempt}/{MAX_TASK_RETRIES}), "
                f"sleeping {wait}s"
            )
            self._post_status("task_fetch", status_detail)
            logger.info(status_detail)

            if attempt < MAX_TASK_RETRIES:
                time.sleep(wait)

        raise NoTasksAvailableError(
            f"No tasks assigned to {self.agent_id} after {MAX_TASK_RETRIES} attempts."
        )

    # ------------------------------------------------------------------
    # 3. Session recovery
    # ------------------------------------------------------------------

    def _recovery_path(self) -> Path:
        return self.recovery_dir / f"recovery-{self.agent_id}.json"

    def load_recovery_state(self) -> dict[str, Any] | None:
        """Load a previously written recovery state, if any."""
        path = self._recovery_path()
        if path.exists():
            state = json.loads(path.read_text())
            logger.info("Loaded recovery state from %s", path)
            return state
        return None

    def write_recovery_state(
        self,
        task: dict[str, Any],
        phase: str,
        partial_result: Any = None,
        error: str | None = None,
    ) -> Path:
        """Persist recovery state so the next heartbeat can resume."""
        self.recovery_dir.mkdir(parents=True, exist_ok=True)
        path = self._recovery_path()

        state = {
            "agent_id": self.agent_id,
            "task_id": task.get("id"),
            "task": task,
            "phase": phase,
            "partial_result": partial_result,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        path.write_text(json.dumps(state, indent=2, ensure_ascii=False))
        logger.info("Recovery state written to %s", path)
        return path

    def clear_recovery_state(self) -> None:
        """Remove recovery file after successful completion."""
        path = self._recovery_path()
        if path.exists():
            path.unlink()
            logger.info("Recovery state cleared: %s", path)

    # ------------------------------------------------------------------
    # 4. Structured status posting
    # ------------------------------------------------------------------

    def _post_status(
        self,
        phase: str,
        detail: str,
        task_id: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Post a structured JSON status comment to the Paperclip API."""
        status = HeartbeatStatus(
            agent_id=self.agent_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            phase=phase,
            detail=detail,
            task_id=task_id,
            extra=extra or {},
        )
        payload = status.to_json()

        try:
            resp = self.client.post(
                f"/agents/{self.agent_id}/status",
                content=payload,
            )
            resp.raise_for_status()
        except httpx.HTTPError:
            logger.warning("Failed to post status (phase=%s), continuing", phase)

    # ------------------------------------------------------------------
    # Main wrapper
    # ------------------------------------------------------------------

    def wrap(self, fn: Callable[[dict[str, Any]], Any]) -> Callable[[], Any]:
        """Decorator that wraps task logic with the full heartbeat sequence.

        The decorated function receives the assigned task dict and should
        return a result dict.  The wrapper handles:
        1. Permission verification (escalates on failure)
        2. Task fetch with retry/backoff
        3. Recovery state on interruption
        4. Status posting throughout
        """

        def _wrapped() -> Any:
            # --- Step 1: permissions ---
            self._post_status("permission_check", "Verifying agent permissions")
            self.verify_permissions()

            # --- Check for prior recovery state ---
            recovery = self.load_recovery_state()
            if recovery:
                logger.info(
                    "Resuming from recovery state for task %s",
                    recovery.get("task_id"),
                )
                self._post_status(
                    "executing",
                    f"Resuming from recovery (task {recovery.get('task_id')})",
                    task_id=recovery.get("task_id"),
                )

            # --- Step 2: fetch task ---
            task = self.fetch_assigned_task()
            task_id = task.get("id")

            # --- Step 3: execute with interruption protection ---
            self._post_status("executing", "Running task logic", task_id=task_id)
            try:
                result = fn(task)
            except KeyboardInterrupt:
                recovery_path = self.write_recovery_state(
                    task, phase="interrupted"
                )
                self._post_status(
                    "error",
                    "Session interrupted — recovery state saved",
                    task_id=task_id,
                    extra={"recovery_file": str(recovery_path)},
                )
                raise
            except Exception as exc:
                recovery_path = self.write_recovery_state(
                    task, phase="error", error=str(exc)
                )
                self._post_status(
                    "error",
                    f"Task failed: {exc}",
                    task_id=task_id,
                    extra={"recovery_file": str(recovery_path)},
                )
                raise

            # --- Step 4: success status ---
            self.clear_recovery_state()
            self._post_status(
                "completed",
                "Task completed successfully",
                task_id=task_id,
                extra={"result_summary": str(result)[:500]},
            )
            return result

        _wrapped.__name__ = fn.__name__
        _wrapped.__doc__ = fn.__doc__
        return _wrapped

    def run_once(self, fn: Callable[[dict[str, Any]], Any]) -> Any:
        """Convenience method: run the full heartbeat sequence once (no decorator)."""
        return self.wrap(fn)()
