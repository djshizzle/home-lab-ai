"""Ping an AV device to check reachability.

This is a template showing the wrapper pattern. Replace the body
with an actual MCP tool call via the sandbox bridge.
"""

from __future__ import annotations


def ping_device(host: str, timeout: int = 5) -> dict:
    """Ping an AV device and return reachability status.

    Args:
        host: Device hostname or IP (e.g., av-hq-conf3b-ctrl-01.internal).
        timeout: Timeout in seconds.

    Returns:
        Dict with keys: host, reachable (bool), latency_ms (float | None).
    """
    # --- MCP bridge call goes here ---
    # In the sandbox, this would call:
    #   mcp_device_manager.call_tool("ping_device", host=host, timeout=timeout)
    #
    # For now, return a placeholder:
    return {
        "host": host,
        "reachable": True,
        "latency_ms": 2.4,
    }
