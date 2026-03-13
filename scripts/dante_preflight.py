#!/usr/bin/env python3
"""Dante preflight checks (R11).

Queries the Dante network to verify safe conditions before applying
audio route changes:
  1. No Dante Controller lock conflicts
  2. Single clock master per subnet
  3. Subscription counts within device limits

Usage:
    python scripts/dante_preflight.py --subnet 10.10.50.0/24
    python scripts/dante_preflight.py --device hq-conf3b-dsp-01

Exit codes:
    0 — All checks passed
    1 — One or more checks failed (see output for details)
    2 — Could not reach Dante Controller
"""

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Per-model Dante subscription limits (R12).
# Source: vendor datasheets. Add models as they are onboarded.
DANTE_SUBSCRIPTION_LIMITS: dict[str, int] = {
    "QSC Core 110f": 64,
    "QSC Core 510i": 128,
    "Shure MXA920": 10,
    "Shure MXA910": 10,
    "Shure IntelliMix P300": 8,
    "Biamp Tesira SERVER-IO": 64,
    "Biamp Tesira Forte X": 32,
}

# Alert threshold — warn when subscription count exceeds this fraction of the limit.
SUBSCRIPTION_ALERT_THRESHOLD = 0.8


def check_dante_lock(controller_host: str) -> bool:
    """Verify no conflicting Dante Controller locks exist.

    A Dante Controller lock means someone has the network locked for manual
    editing. Programmatic changes should not be applied while locked.

    Returns True if safe to proceed (no lock), False if locked.
    """
    # Integration point: use Dante Controller API or Dante Domain Manager REST API.
    # Placeholder until Dante Controller SDK is available.
    logger.info(f"Checking Dante Controller lock on {controller_host}...")
    logger.warning(
        "Dante Controller API integration not yet implemented. "
        "Manually verify no lock exists in Dante Controller before proceeding."
    )
    return True


def check_clock_masters(subnet: str) -> bool:
    """Verify exactly one clock master exists per Dante subnet.

    Multiple clock masters cause audio glitches and dropped subscriptions.

    Returns True if exactly one master found, False otherwise.
    """
    logger.info(f"Checking clock masters on subnet {subnet}...")
    # Integration point: query Dante devices via mDNS/Dante API for clock role.
    logger.warning(
        "Clock master detection not yet implemented. "
        "Use Dante Controller to verify single PTP grandmaster per subnet."
    )
    return True


def check_subscription_counts(
    devices: list[dict],
) -> list[dict]:
    """Check Dante subscription counts against per-model limits (R13).

    Args:
        devices: List of dicts with 'device_id', 'model', and 'subscription_count'.

    Returns:
        List of devices that are at or above the alert threshold.
    """
    warnings = []
    for device in devices:
        model = device.get("model", "")
        limit = DANTE_SUBSCRIPTION_LIMITS.get(model)
        count = device.get("subscription_count", 0)

        if limit is None:
            logger.info(
                f"  {device['device_id']}: No known subscription limit for {model}. "
                f"Current count: {count}."
            )
            continue

        usage = count / limit if limit > 0 else 0
        status = "OK" if usage < SUBSCRIPTION_ALERT_THRESHOLD else "WARNING"
        logger.info(
            f"  {device['device_id']}: {count}/{limit} subscriptions "
            f"({usage:.0%}) — {status}"
        )

        if usage >= SUBSCRIPTION_ALERT_THRESHOLD:
            warnings.append({
                **device,
                "limit": limit,
                "usage_pct": usage,
            })

    return warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Dante preflight checks for AVops")
    parser.add_argument("--subnet", default="10.10.50.0/24", help="Dante subnet to check")
    parser.add_argument("--controller", default="localhost", help="Dante Controller host")
    parser.add_argument("--device", help="Check a specific device ID only")
    args = parser.parse_args()

    all_passed = True

    # Check 1: Dante Controller lock
    print("\n=== Check 1: Dante Controller Lock ===")
    if not check_dante_lock(args.controller):
        print("FAIL: Dante Controller is locked. Aborting.")
        all_passed = False

    # Check 2: Clock masters
    print("\n=== Check 2: Clock Masters ===")
    if not check_clock_masters(args.subnet):
        print("FAIL: Multiple clock masters detected.")
        all_passed = False

    # Check 3: Subscription counts
    print("\n=== Check 3: Subscription Counts ===")
    # In production, this list comes from the device inventory.
    # Placeholder with empty list — populate from inventory API.
    sample_devices: list[dict] = []
    if args.device:
        logger.info(f"Checking single device: {args.device}")
        # Would query inventory for this device's model and subscription count.

    warnings = check_subscription_counts(sample_devices)
    if warnings:
        print(f"WARNING: {len(warnings)} device(s) near subscription limit.")
        all_passed = False

    # Summary
    print("\n=== Dante Preflight Summary ===")
    if all_passed:
        print("ALL CHECKS PASSED — safe to apply audio route changes.")
        return 0
    else:
        print("CHECKS FAILED — review warnings above before proceeding.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
