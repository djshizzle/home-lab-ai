#!/usr/bin/env python3
"""Audit firmware versions across all registered AV devices.

Usage:
    python scripts/firmware_audit.py --report
    python scripts/firmware_audit.py --report --output firmware-report.json
"""

import argparse
import json
import sys
from pathlib import Path

from packaging.version import Version, InvalidVersion

from avops.constants.devices import FIRMWARE_BASELINE


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AV firmware audit")
    parser.add_argument("--report", action="store_true", help="Generate firmware report")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write JSON report to file",
    )
    return parser.parse_args()


def fetch_devices() -> list[dict]:
    """Fetch devices with firmware info from AVops API.

    TODO: Replace with real API call once AVOPS_API_URL is configured.
    """
    return []


def audit_device(device: dict) -> dict:
    """Check whether a device's firmware meets the baseline."""
    model = device.get("model", "")
    current = device.get("firmware_version") or "unknown"
    baseline = FIRMWARE_BASELINE.get(model)

    status = "unknown"
    if baseline and current != "unknown":
        try:
            status = "ok" if Version(current) >= Version(baseline) else "outdated"
        except InvalidVersion:
            status = "unknown"
    elif not baseline:
        status = "no-baseline"

    return {
        "device_id": device.get("device_id"),
        "model": model,
        "current_firmware": current,
        "required_firmware": baseline,
        "status": status,
    }


def main() -> int:
    args = parse_args()

    if not args.report:
        print("Use --report flag to generate a firmware audit report.")
        return 0

    devices = fetch_devices()

    if not devices:
        print("[audit] No devices found. Configure AVOPS_API_URL to connect to AVops API.")
        return 0

    results = [audit_device(d) for d in devices]

    # Single pass to count statuses
    ok_count = 0
    outdated: list[dict] = []
    for r in results:
        if r["status"] == "ok":
            ok_count += 1
        elif r["status"] == "outdated":
            outdated.append(r)

    report = {
        "total_devices": len(results),
        "outdated": len(outdated),
        "ok": ok_count,
        "devices": results,
    }

    if args.output:
        args.output.write_text(json.dumps(report, indent=2))
        print(f"[audit] Report written to {args.output}")
    else:
        print(json.dumps(report, indent=2))

    if outdated:
        print(f"\n[audit] WARNING: {len(outdated)} devices have outdated firmware")
        for d in outdated:
            print(
                f"  - {d['device_id']} ({d['model']}): "
                f"{d['current_firmware']} < {d['required_firmware']}"
            )
        return 1

    print(f"[audit] All {len(results)} devices meet firmware baseline")
    return 0


if __name__ == "__main__":
    sys.exit(main())
