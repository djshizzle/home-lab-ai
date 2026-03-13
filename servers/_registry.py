"""Server discovery and tool documentation helpers.

Provides progressive tool discovery so agents only load the schemas
they need for the current task, keeping context overhead near zero.
"""

from __future__ import annotations

import importlib
import inspect
import pkgutil
from pathlib import Path
from typing import Any


_SERVERS_DIR = Path(__file__).parent


def list_servers() -> list[str]:
    """Return names of all available MCP server packages."""
    return sorted(
        name
        for _importer, name, is_pkg in pkgutil.iter_modules([str(_SERVERS_DIR)])
        if is_pkg and not name.startswith("_")
    )


def list_tools(server: str) -> list[str]:
    """Return tool names available in the given server package."""
    try:
        pkg = importlib.import_module(f"servers.{server}")
    except ModuleNotFoundError:
        raise ValueError(f"Unknown server: {server!r}. Available: {list_servers()}")

    return sorted(
        name
        for _importer, name, _is_pkg in pkgutil.iter_modules(pkg.__path__)
        if not name.startswith("_")
    )


def get_tool_docs(server: str, tool: str) -> dict[str, Any]:
    """Return documentation and signature for a specific tool.

    Returns a dict with keys: name, server, docstring, parameters.
    """
    try:
        mod = importlib.import_module(f"servers.{server}.{tool}")
    except ModuleNotFoundError:
        raise ValueError(
            f"Unknown tool: {server}/{tool}. "
            f"Available tools in {server!r}: {list_tools(server)}"
        )

    # Find the main callable (same name as module, or first public function)
    func = getattr(mod, tool, None)
    if func is None:
        public = [
            obj
            for name, obj in inspect.getmembers(mod, inspect.isfunction)
            if not name.startswith("_")
        ]
        func = public[0] if public else None

    if func is None:
        return {
            "name": tool,
            "server": server,
            "docstring": mod.__doc__ or "",
            "parameters": {},
        }

    sig = inspect.signature(func)
    params = {
        name: {
            "annotation": str(p.annotation) if p.annotation != inspect.Parameter.empty else "Any",
            "default": str(p.default) if p.default != inspect.Parameter.empty else "<required>",
        }
        for name, p in sig.parameters.items()
    }

    return {
        "name": tool,
        "server": server,
        "docstring": inspect.getdoc(func) or "",
        "parameters": params,
    }
