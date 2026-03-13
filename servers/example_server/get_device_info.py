"""Retrieve AV device information via REST API.

Template wrapper — replace the body with a real MCP tool call.
"""

from __future__ import annotations

from typing import Any


def get_device_info(device_id: str, fields: list[str] | None = None) -> dict[str, Any]:
    """Fetch device details from the inventory.

    Args:
        device_id: Device identifier (e.g., hq-conf3b-ctrl-01).
        fields: Optional list of fields to return. None returns all fields.

    Returns:
        Dict of device properties (model, firmware, status, etc.).
    """
    # --- MCP bridge call goes here ---
    # mcp_device_manager.call_tool("get_device_info", device_id=device_id, fields=fields)
    return {
        "device_id": device_id,
        "model": "Crestron CP4",
        "firmware": "2.8001.00108",
        "status": "online",
        "ip": "10.10.50.101",
    }
