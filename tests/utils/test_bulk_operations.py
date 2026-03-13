"""Tests for bulk device operations with concurrency control."""

import asyncio

import pytest

from src.utils.bulk_operations import bulk_device_operation


class TestBulkDeviceOperation:
    @pytest.mark.asyncio
    async def test_runs_all_devices(self):
        results_order = []

        async def mock_op(device_id: str) -> str:
            results_order.append(device_id)
            return f"ok-{device_id}"

        devices = ["dev-1", "dev-2", "dev-3"]
        results = await bulk_device_operation(devices, mock_op, max_concurrent=5)

        assert len(results) == 3
        assert results["dev-1"] == "ok-dev-1"
        assert results["dev-2"] == "ok-dev-2"

    @pytest.mark.asyncio
    async def test_respects_concurrency_limit(self):
        active = 0
        max_active = 0

        async def track_concurrency(device_id: str) -> str:
            nonlocal active, max_active
            active += 1
            max_active = max(max_active, active)
            await asyncio.sleep(0.01)
            active -= 1
            return "ok"

        devices = [f"dev-{i}" for i in range(10)]
        await bulk_device_operation(devices, track_concurrency, max_concurrent=3)

        assert max_active <= 3

    @pytest.mark.asyncio
    async def test_handles_failures(self):
        async def fail_on_dev2(device_id: str) -> str:
            if device_id == "dev-2":
                raise ConnectionError("down")
            return "ok"

        devices = ["dev-1", "dev-2", "dev-3"]
        results = await bulk_device_operation(devices, fail_on_dev2)

        assert results["dev-1"] == "ok"
        assert "error" in results["dev-2"]
        assert results["dev-3"] == "ok"
