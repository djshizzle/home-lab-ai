"""Tests for maintenance window checker."""

import os
from datetime import datetime

import pytest

from src.utils.maintenance_window import (
    MaintenanceWindowError,
    check_maintenance_window,
    is_within_business_hours,
)


class TestIsWithinBusinessHours:
    def test_weekday_morning(self):
        # Wednesday 10:00 AM
        dt = datetime(2026, 3, 11, 10, 0)
        assert is_within_business_hours(dt) is True

    def test_weekday_before_hours(self):
        # Wednesday 7:00 AM
        dt = datetime(2026, 3, 11, 7, 0)
        assert is_within_business_hours(dt) is False

    def test_weekday_after_hours(self):
        # Wednesday 7:00 PM
        dt = datetime(2026, 3, 11, 19, 0)
        assert is_within_business_hours(dt) is False

    def test_weekend(self):
        # Saturday 10:00 AM
        dt = datetime(2026, 3, 14, 10, 0)
        assert is_within_business_hours(dt) is False

    def test_boundary_start(self):
        # Wednesday 8:00 AM exactly
        dt = datetime(2026, 3, 11, 8, 0)
        assert is_within_business_hours(dt) is True

    def test_boundary_end(self):
        # Wednesday 6:00 PM exactly
        dt = datetime(2026, 3, 11, 18, 0)
        assert is_within_business_hours(dt) is False


class TestCheckMaintenanceWindow:
    def test_blocks_during_business_hours(self):
        dt = datetime(2026, 3, 11, 10, 0)
        with pytest.raises(MaintenanceWindowError):
            check_maintenance_window(dt)

    def test_allows_after_hours(self):
        dt = datetime(2026, 3, 11, 20, 0)
        check_maintenance_window(dt)  # should not raise

    def test_allows_weekend(self):
        dt = datetime(2026, 3, 14, 10, 0)
        check_maintenance_window(dt)  # should not raise

    def test_override_env_var(self, monkeypatch):
        monkeypatch.setenv("AVOPS_FORCE_MAINTENANCE", "1")
        dt = datetime(2026, 3, 11, 10, 0)
        check_maintenance_window(dt)  # should not raise despite business hours
