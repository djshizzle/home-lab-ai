"""Batch device health check skill.

Example persistent skill: pings all devices in a room and generates
a summary report. Demonstrates the pattern of saving reusable agent
code that combines multiple MCP tool calls into a single operation.

This keeps intermediate results (individual ping responses) inside
the execution environment — only the summary reaches the model context.
"""

from __future__ import annotations

from typing import Any


def check_all_devices(
    room: str,
    timeout: int = 5,
) -> dict[str, Any]:
    """Ping every device in a room and return a health summary.

    Args:
        room: Room identifier (e.g., hq-conf3b).
        timeout: Per-device ping timeout in seconds.

    Returns:
        Dict with keys:
            room: str
            total: int
            healthy: int
            unhealthy: list[str]  — device_ids that failed
            summary: str          — one-line status for the model
    """
    # In the sandbox, this would:
    #   1. Call servers.device_inventory.list_devices(room=room)
    #   2. For each device, call servers.device_manager.ping_device(host=...)
    #   3. Aggregate results locally (no tokens spent on intermediate data)
    #   4. Return only the compact summary

    # Placeholder implementation:
    return {
        "room": room,
        "total": 0,
        "healthy": 0,
        "unhealthy": [],
        "summary": f"No devices configured for room {room}. Add devices to inventory first.",
    }
