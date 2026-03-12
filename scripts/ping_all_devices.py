#!/usr/bin/env python3
"""Ping all registered AV devices and report reachability.

Usage:
    python scripts/ping_all_devices.py
"""

import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed


# Sample device inventory — replace with DB/API call in production
DEVICES = [
    # {"device_id": "hq-conf3b-ctrl-01", "hostname": "av-hq-conf3b-ctrl-1.internal"},
]


def ping(device: dict) -> dict:
    """Ping a single device and return result."""
    hostname = device["hostname"]
    result = subprocess.run(
        ["ping", "-c", "1", "-W", "2", hostname],
        capture_output=True,
        text=True,
    )
    return {
        "device_id": device["device_id"],
        "hostname": hostname,
        "reachable": result.returncode == 0,
    }


def main() -> int:
    if not DEVICES:
        print("No devices configured. Add devices to DEVICES list or connect to AVops API.")
        return 0

    total = len(DEVICES)
    print(f"Pinging {total} devices...\n")
    unreachable = []

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(ping, d) for d in DEVICES]
        for future in as_completed(futures):
            result = future.result()
            status = "OK" if result["reachable"] else "UNREACHABLE"
            print(f"  [{status}] {result['device_id']} ({result['hostname']})")
            if not result["reachable"]:
                unreachable.append(result["device_id"])

    print(f"\nSummary: {total - len(unreachable)}/{total} reachable")
    if unreachable:
        print(f"Unreachable: {', '.join(unreachable)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
