"""Tests for DeviceBase — rate limiting, timeouts, circuit breaker, dry run."""

import os

import pytest

from src.constants.devices import TimeoutTier
from src.devices.base_device import DeviceBase


class TestDeviceBase:
    def test_default_timeout(self):
        device = DeviceBase("test-host")
        assert device.default_timeout == TimeoutTier.DEFAULT

    def test_rate_limiter_initialized(self):
        device = DeviceBase("test-host")
        assert device._rate_limiter.requests_per_minute == DeviceBase.API_RATE_LIMIT

    def test_circuit_breaker_initialized(self):
        device = DeviceBase("test-host")
        assert device._circuit_breaker.state.value == "closed"

    def test_dry_run_mode(self, monkeypatch):
        monkeypatch.setenv("AVOPS_DRY_RUN", "true")
        device = DeviceBase("test-host")
        assert device.dry_run is True

    def test_dry_run_off_by_default(self):
        device = DeviceBase("test-host")
        assert device.dry_run is False

    def test_get_status_not_implemented(self):
        device = DeviceBase("test-host")
        with pytest.raises(NotImplementedError):
            device.get_status()

    def test_reboot_not_implemented(self):
        device = DeviceBase("test-host")
        with pytest.raises(NotImplementedError):
            device.reboot()

    def test_apply_config_not_implemented(self):
        device = DeviceBase("test-host")
        with pytest.raises(NotImplementedError):
            device.apply_config({})

    def test_subclass_rate_limit(self):
        class TestDevice(DeviceBase):
            API_RATE_LIMIT = 60

        device = TestDevice("test-host")
        assert device._rate_limiter.requests_per_minute == 60

    def test_close_client(self):
        device = DeviceBase("test-host")
        device.close()  # should not raise even with no client
        assert device._client is None
