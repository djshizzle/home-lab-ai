#!/usr/bin/env python3
"""Generate filesystem-based API wrappers from MCP server tool schemas.

Follows Anthropic's "Code Execution with MCP" pattern:
  1. Connects to each MCP server listed in .mcp.json
  2. Fetches tool schemas via MCP list_tools
  3. Generates a Python wrapper module per tool under servers/<server_name>/

Usage:
    python scripts/generate_server_wrappers.py
    python scripts/generate_server_wrappers.py --server code-execution
    python scripts/generate_server_wrappers.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import textwrap
from pathlib import Path


SERVERS_DIR = Path(__file__).resolve().parent.parent / "servers"
MCP_CONFIG = Path(__file__).resolve().parent.parent / ".mcp.json"


def sanitize_name(name: str) -> str:
    """Convert a tool/server name to a valid Python identifier."""
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_").lower()
    if name and name[0].isdigit():
        name = f"_{name}"
    return name


def generate_wrapper(
    server_name: str,
    tool_name: str,
    description: str,
    parameters: dict,
) -> str:
    """Generate Python source for a single tool wrapper."""
    func_name = sanitize_name(tool_name)
    params = []
    param_docs = []

    schema_props = parameters.get("properties", {})
    required = set(parameters.get("required", []))

    for param, spec in schema_props.items():
        py_name = sanitize_name(param)
        py_type = _json_type_to_python(spec.get("type", "Any"))
        desc = spec.get("description", "")

        if param in required:
            params.append(f"{py_name}: {py_type}")
            param_docs.append(f"        {py_name}: {desc}")
        else:
            default = spec.get("default", None)
            default_repr = repr(default)
            params.append(f"{py_name}: {py_type} = {default_repr}")
            param_docs.append(f"        {py_name}: {desc} (default: {default_repr})")

    params_str = ", ".join(params)
    param_docs_str = "\n".join(param_docs) if param_docs else "        None"

    return textwrap.dedent(f'''\
        """{description}

        Auto-generated wrapper for MCP tool: {server_name}/{tool_name}
        """

        from __future__ import annotations

        from typing import Any


        def {func_name}({params_str}) -> dict[str, Any]:
            """{description}

            Args:
        {param_docs_str}

            Returns:
                Tool result as a dictionary.
            """
            # In the code-execution sandbox, call via the MCP bridge:
            #   result = mcp_{sanitize_name(server_name)}.call_tool(
            #       "{tool_name}",
            #       {", ".join(f"{sanitize_name(p)}={sanitize_name(p)}" for p in schema_props)}
            #   )
            #   return result
            raise NotImplementedError(
                "This wrapper must be called inside the MCP code-execution sandbox. "
                "Use the run_python tool with servers=[\\"{server_name}\\"]."
            )
    ''')


def _json_type_to_python(json_type: str) -> str:
    """Map JSON Schema type to Python type hint."""
    mapping = {
        "string": "str",
        "integer": "int",
        "number": "float",
        "boolean": "bool",
        "array": "list",
        "object": "dict",
    }
    return mapping.get(json_type, "Any")


def generate_init(server_name: str, tool_names: list[str]) -> str:
    """Generate __init__.py for a server package."""
    imports = "\n".join(
        f"    from servers.{sanitize_name(server_name)}.{sanitize_name(t)} import {sanitize_name(t)}"
        for t in tool_names
    )
    all_list = ", ".join(f'"{sanitize_name(t)}"' for t in tool_names)
    return textwrap.dedent(f'''\
        """Auto-generated wrappers for MCP server: {server_name}

        Available tools:
        {chr(10).join(f"    - {t}" for t in tool_names)}
        """

        try:
        {imports}
        except ImportError:
            pass  # Wrappers are documentation; actual calls go through the sandbox

        __all__ = [{all_list}]
    ''')


def load_mcp_config() -> dict:
    """Load .mcp.json from the project root."""
    if not MCP_CONFIG.exists():
        print(f"No .mcp.json found at {MCP_CONFIG}")
        return {}
    with open(MCP_CONFIG) as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", help="Generate wrappers for a specific server only")
    parser.add_argument("--dry-run", action="store_true", help="Print output without writing files")
    parser.add_argument(
        "--schema-file",
        type=Path,
        help="Path to a JSON file containing tool schemas "
        "(format: {server_name: [{name, description, inputSchema}]})",
    )
    args = parser.parse_args()

    if args.schema_file:
        with open(args.schema_file) as f:
            schemas = json.load(f)
    else:
        # When no schema file is provided, show instructions
        config = load_mcp_config()
        servers = list(config.get("mcpServers", {}).keys())
        print("MCP servers configured:", servers or "(none)")
        print()
        print("To generate wrappers, export tool schemas from your MCP servers:")
        print("  1. Start each MCP server")
        print("  2. Call list_tools to get schemas")
        print("  3. Save to JSON: {\"server_name\": [{\"name\": ..., \"description\": ..., \"inputSchema\": ...}]}")
        print("  4. Run: python scripts/generate_server_wrappers.py --schema-file schemas.json")
        print()
        print("Or use the code-execution sandbox to discover tools at runtime:")
        print('  from servers import list_servers, list_tools, get_tool_docs')
        return

    for server_name, tools in schemas.items():
        if args.server and server_name != args.server:
            continue

        safe_name = sanitize_name(server_name)
        server_dir = SERVERS_DIR / safe_name

        tool_names = [t["name"] for t in tools]

        if args.dry_run:
            print(f"\n=== {server_name} ({len(tools)} tools) -> {server_dir}/ ===")
            for tool in tools:
                print(f"  {tool['name']}.py")
            continue

        server_dir.mkdir(parents=True, exist_ok=True)

        # Write __init__.py
        init_src = generate_init(server_name, tool_names)
        (server_dir / "__init__.py").write_text(init_src)

        # Write each tool wrapper
        for tool in tools:
            wrapper_src = generate_wrapper(
                server_name=server_name,
                tool_name=tool["name"],
                description=tool.get("description", f"MCP tool: {tool['name']}"),
                parameters=tool.get("inputSchema", {}),
            )
            filename = f"{sanitize_name(tool['name'])}.py"
            (server_dir / filename).write_text(wrapper_src)

        print(f"Generated {len(tools)} wrappers in {server_dir}/")

    print("\nDone. Agents can now import tools from the servers/ package.")


if __name__ == "__main__":
    main()
