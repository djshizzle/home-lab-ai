"""Tests for SNMP poller with interval and concurrency limits."""

import asyncio
import time

import pytest

from src.utils.snmp_poller import SnmpPoller, SnmpPollingConfig


class TestSnmpPollingConfig:
    def test_default_intervals(self):
        assert SnmpPollingConfig.STATUS_INTERVAL_S == 60
        assert SnmpPollingConfig.TEMPERATURE_INTERVAL_S == 300
        assert SnmpPollingConfig.MAX_CONCURRENT_POLLS == 10


class TestSnmpPoller:
    @pytest.mark.asyncio
    async def test_first_poll_succeeds(self):
        poller = SnmpPoller(max_concurrent=5, default_interval=0.0)
        result = await poller.poll_device("dev-1", "10.10.50.1", [".1.3.6.1"])
        assert result is not None
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_skips_if_too_soon(self):
        poller = SnmpPoller(max_concurrent=5, default_interval=60.0)
        # First poll succeeds
        await poller.poll_device("dev-1", "10.10.50.1", [".1.3.6.1"])
        # Second poll skipped (interval not elapsed)
        result = await poller.poll_device("dev-1", "10.10.50.1", [".1.3.6.1"])
        assert result is None

    @pytest.mark.asyncio
    async def test_fleet_poll_returns_results(self):
        poller = SnmpPoller(max_concurrent=3, default_interval=0.0)
        devices = [{"device_id": f"dev-{i}", "hostname": f"10.10.50.{i}"} for i in range(5)]
        results = await poller.poll_fleet(devices, [".1.3.6.1"])
        assert len(results) == 5
        for did in [f"dev-{i}" for i in range(5)]:
            assert did in results

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrency(self):
        """Verify the semaphore is initialized with the correct limit."""
        poller = SnmpPoller(max_concurrent=3)
        # The internal semaphore should have a value of 3
        assert poller._semaphore._value == 3
