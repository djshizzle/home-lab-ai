"""MCP Server API Wrappers.

This package exposes MCP tools as importable Python modules, following
Anthropic's "Code Execution with MCP" pattern. Instead of loading all tool
schemas into the agent context (~30K tokens), agents discover and import
only the wrappers they need (~200 tokens).

Directory layout:
    servers/
    ├── __init__.py          # This file
    ├── _registry.py         # Server discovery helpers
    ├── example_server/      # One sub-package per MCP server
    │   ├── __init__.py
    │   └── <tool_name>.py   # Thin wrapper per tool
    └── ...

Usage inside code-execution sandbox:
    from servers import list_servers, get_tool_docs
    from servers.example_server import some_tool

    # Or discover at runtime
    servers = list_servers()
    docs = get_tool_docs("example_server", "some_tool")
"""

from servers._registry import get_tool_docs, list_servers, list_tools

__all__ = ["list_servers", "list_tools", "get_tool_docs"]
