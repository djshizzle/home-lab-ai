"""Persistent skills for the MCP code-execution sandbox.

Skills are reusable Python functions that agents save after solving a task.
On future runs, agents can import skills instead of re-deriving solutions,
building a growing toolbox of higher-level capabilities.

Directory layout:
    skills/
    ├── __init__.py              # This file
    ├── device_health_check.py   # Example: batch device ping + report
    ├── room_signal_audit.py     # Example: validate signal path end-to-end
    └── ...

Usage inside the code-execution sandbox:
    from skills.device_health_check import check_all_devices
    results = check_all_devices(room="hq-conf3b")
"""
