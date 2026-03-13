"""Maintenance window checker (R19).

Blocks device config pushes during business hours (8am-6pm local)
unless explicitly overridden.
"""

import logging
import os
from datetime import datetime, time

logger = logging.getLogger(__name__)

BUSINESS_HOURS_START = time(8, 0)
BUSINESS_HOURS_END = time(18, 0)
BUSINESS_DAYS = {0, 1, 2, 3, 4}  # Monday=0 through Friday=4


class MaintenanceWindowError(Exception):
    """Raised when a change is attempted outside a maintenance window."""

    def __init__(self, current_time: datetime) -> None:
        self.current_time = current_time
        super().__init__(
            f"Changes blocked during business hours ({BUSINESS_HOURS_START}-"
            f"{BUSINESS_HOURS_END}). Current time: {current_time.strftime('%H:%M %A')}. "
            f"Set AVOPS_FORCE_MAINTENANCE=1 to override."
        )


def is_within_business_hours(dt: datetime | None = None) -> bool:
    """Check if the given (or current) time is within business hours."""
    dt = dt or datetime.now()
    if dt.weekday() not in BUSINESS_DAYS:
        return False
    return BUSINESS_HOURS_START <= dt.time() < BUSINESS_HOURS_END


def check_maintenance_window(dt: datetime | None = None) -> None:
    """Block if within business hours, unless override env var is set.

    Raises:
        MaintenanceWindowError: If currently within business hours and
            AVOPS_FORCE_MAINTENANCE is not set.
    """
    if os.environ.get("AVOPS_FORCE_MAINTENANCE", "").lower() in ("1", "true", "yes"):
        logger.warning("maintenance_window_override", extra={"env": "AVOPS_FORCE_MAINTENANCE"})
        return

    dt = dt or datetime.now()
    if is_within_business_hours(dt):
        raise MaintenanceWindowError(dt)

    logger.info(
        "maintenance_window_ok",
        extra={"current_time": dt.strftime("%H:%M %A")},
    )
